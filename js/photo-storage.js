// ============================================================
// PHOTO STORAGE — เก็บรูปใน Firestore collection "ticket_photos"
// ============================================================
// วิธีทำงาน:
//   1. compressPhoto() return base64 เหมือนเดิม (สำหรับ preview)
//   2. ก่อน save ticket → uploadPendingPhotosToStorage() เอา base64
//      ยัดใน Firestore doc "ticket_photos/{ticketId}" แยกจาก appdata/main
//      ไม่เกิน 1MB limit ของ Firestore
//   3. ticket เก็บ placeholder "fs:{ticketId}:b0" แทน base64
//   4. ตอนแสดงรูป → resolvePhotoUrl() ดึงกลับมา
// ============================================================

let FSstorage = null;
function initStorage() {
  try {
    if (typeof firebase !== 'undefined' && firebase.apps.length) {
      try { FSstorage = firebase.storage(); } catch(e) {}
    }
  } catch(e) {}
}

function _withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('[Photo] ' + label + ' timeout after ' + ms + 'ms')), ms)
    )
  ]);
}

// ── บันทึกรูปลง Firestore collection ticket_photos ──────────
async function savePhotosToFirestore(ticketId, photosBefore, photosAfter) {
  if (!ticketId) return { before: [], after: [] };
  if (!photosBefore.length && !photosAfter.length) return { before: [], after: [] };
  if (typeof FSdb === 'undefined' || !FSdb) return { before: [], after: [] };

  const authed = typeof _waitForAuth === 'function' ? await _waitForAuth(8000) : true;
  if (!authed) return { before: [], after: [] };

  try {
    // FIX: อ่านข้อมูลเดิมก่อน แล้ว merge array แทนการ overwrite
    // merge:true ของ Firestore ทับ array field ทั้งก้อน — ต้อง merge เองก่อน set
    let existingBefore = [];
    let existingAfter  = [];
    try {
      const snap = await _withTimeout(
        FSdb.collection('ticket_photos').doc(ticketId).get(),
        10000, 'readBeforeSave'
      );
      if (snap.exists) {
        existingBefore = snap.data().before || [];
        existingAfter  = snap.data().after  || [];
      }
    } catch(readErr) { /* ถ้าอ่านไม่ได้ ใช้ empty แล้ว overwrite เหมือนเดิม */ }

    const mergedBefore = existingBefore.concat(photosBefore || []);
    const mergedAfter  = existingAfter.concat(photosAfter  || []);

    const payload = {
      ticketId,
      before:  mergedBefore,
      after:   mergedAfter,
      savedAt: new Date().toISOString(),
    };
    if (typeof CU !== 'undefined' && CU && CU.id) payload.techId = CU.id;
    await _withTimeout(
      FSdb.collection('ticket_photos').doc(ticketId).set(payload, { merge: true }),
      30000, 'savePhotos'
    );

    // key ของรูปใหม่ใช้ index ต่อจากของเดิม
    const bOffset = existingBefore.length;
    const aOffset = existingAfter.length;
    const beforeKeys = (photosBefore||[]).map(function(_, i) { return 'fs:' + ticketId + ':b' + (bOffset + i); });
    const afterKeys  = (photosAfter||[]).map(function(_, i)  { return 'fs:' + ticketId + ':a' + (aOffset + i); });

    // invalidate cache ให้ load ใหม่ครั้งหน้า
    if (typeof _photoCache !== 'undefined') delete _photoCache[ticketId];
    if (typeof _photoCacheKeys !== 'undefined') {
      var idx = _photoCacheKeys.indexOf(ticketId);
      if (idx !== -1) _photoCacheKeys.splice(idx, 1);
    }

    return { before: beforeKeys, after: afterKeys };
  } catch(e) {
    console.warn('[Photo] savePhotosToFirestore failed:', e.message);
    return { before: [], after: [] };
  }
}

// ── โหลดรูปจาก Firestore ──────────────────────────────────
// BUG FIX (Bug 6): เพิ่ม cache จาก 20 → 60 entries
// เดิม 20 entries — session ที่มี 21+ tickets จะ evict ทุกครั้ง → re-fetch ซ้ำ
// 60 entries ≈ ~3MB max (แต่ละ entry มีแค่ URL strings ไม่ใช่ blob)
var _photoCache = {};
var _photoCacheKeys = [];
var _PHOTO_CACHE_MAX = 60;

const _PHOTO_CACHE_TTL_MS = 20 * 60 * 1000; // 20 นาที — ลด Firestore reads (เพิ่มจาก 5 นาที)

function _photoCacheSet(key, val) {
  if (_photoCacheKeys.includes(key)) {
    _photoCacheKeys.splice(_photoCacheKeys.indexOf(key), 1);
  } else if (_photoCacheKeys.length >= _PHOTO_CACHE_MAX) {
    delete _photoCache[_photoCacheKeys.shift()];
  }
  _photoCacheKeys.push(key);
  _photoCache[key] = { data: val, ts: Date.now() }; // เก็บ timestamp ด้วย
}

function _photoCacheGet(key) {
  const entry = _photoCache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > _PHOTO_CACHE_TTL_MS) {
    // หมดอายุ — ลบออก
    delete _photoCache[key];
    const idx = _photoCacheKeys.indexOf(key);
    if (idx !== -1) _photoCacheKeys.splice(idx, 1);
    return null;
  }
  return entry.data;
}

async function loadPhotosFromFirestore(ticketId) {
  if (!ticketId) return { before: [], after: [] };
  const _cached = _photoCacheGet(ticketId); if (_cached) return _cached;
  if (typeof FSdb === 'undefined' || !FSdb) return { before: [], after: [] };
  try {
    const snap = await _withTimeout(
      FSdb.collection('ticket_photos').doc(ticketId).get(),
      15000, 'loadPhotos'
    );
    if (snap.exists) {
      const data = { before: snap.data().before||[], after: snap.data().after||[] };
      _photoCacheSet(ticketId, data); // LRU + TTL eviction
      return data;
    }
  } catch(e) {
    console.warn('[Photo] loadPhotosFromFirestore failed:', e.message);
  }
  return { before: [], after: [] };
}

// ── แปลง photo key → base64/URL ───────────────────────────
async function resolvePhotoUrl(key, ticketId) {
  if (!key) return null;
  if (key.startsWith('data:') || key.startsWith('https://')) return key;
  if (key.startsWith('fs:')) {
    const parts = key.split(':');
    const tid  = parts[1];
    const slot = parts[2];
    const type = slot[0] === 'b' ? 'before' : 'after';
    const idx  = parseInt(slot.slice(1));
    const photos = await loadPhotosFromFirestore(tid || ticketId);
    return photos[type]?.[idx] || null;
  }
  return key;
}

// ── ฟังก์ชันหลัก: เรียกก่อน submit ticket ──────────────────
async function uploadPendingPhotosToStorage(ticketId) {
  const beforeData = (pendingPhotos.before || []).filter(function(p) { return p && p.startsWith('data:'); });
  const afterData  = (pendingPhotos.after  || []).filter(function(p) { return p && p.startsWith('data:'); });
  // รูปที่ resolve เป็น https:// แล้ว — เก็บ key เดิมไว้ ไม่ต้อง upload ใหม่
  const beforeExisting = (pendingPhotos.before || []).filter(function(p) { return p && (p.startsWith('https://') || p.startsWith('fs:')); });
  const afterExisting  = (pendingPhotos.after  || []).filter(function(p) { return p && (p.startsWith('https://') || p.startsWith('fs:')); });

  if (!beforeData.length && !afterData.length) {
    // ไม่มีรูปใหม่ แต่ preserve รูปเก่า
    if (beforeExisting.length) pendingPhotos.before = beforeExisting;
    if (afterExisting.length)  pendingPhotos.after  = afterExisting;
    return;
  }

  if (typeof showToast === 'function') showToast('⏳ กำลังบันทึกรูปภาพ...');

  try {
    const result = await _withTimeout(
      savePhotosToFirestore(ticketId, beforeData, afterData),
      35000, 'uploadPending'
    );

    if (result.before.length || result.after.length) {
      // merge รูปเก่า (https/fs) + รูปใหม่ที่ upload
      pendingPhotos.before = [...beforeExisting, ...result.before];
      pendingPhotos.after  = [...afterExisting,  ...result.after];
    } else {
      // upload ล้มเหลว — preserve รูปเก่า แต่ทิ้งรูปใหม่
      pendingPhotos.before = beforeExisting;
      pendingPhotos.after  = afterExisting;
      if (typeof showToast === 'function') showToast('⚠️ บันทึกรูปไม่สำเร็จ — ส่งงานโดยไม่มีรูป');
    }
  } catch(e) {
    console.warn('[Photo] error:', e.message);
    pendingPhotos.before = beforeExisting;
    pendingPhotos.after  = afterExisting;
    if (typeof showToast === 'function') showToast('⚠️ บันทึกรูปหมดเวลา — ส่งงานโดยไม่มีรูป');
  }
}

// ── Firestore rules ที่ต้องเพิ่ม ──────────────────────────
// match /ticket_photos/{docId} {
//   allow read, write: if isAuthenticated();
// }

// ── Backward compat stubs ──────────────────────────────────
function ticketHasBase64Photos(ticket) {
  var check = function(arr) { return (arr||[]).some(function(p) { return p && p.startsWith('data:'); }); };
  return check(ticket && ticket.photosBefore) || check(ticket && ticket.photosAfter);
}
function estimateTicketPhotoSize(ticket) {
  var calc = function(arr) { return (arr||[]).reduce(function(s,p) { return s+(p&&p.length||0); }, 0); };
  return calc(ticket && ticket.photosBefore) + calc(ticket && ticket.photosAfter);
}
async function migrateTicketPhotos(ticket) { return { ticket: ticket, changed: false }; }
async function migrateAllPhotosToStorage() {}
async function runPhotoMigrationUI() {
  if (typeof showToast === 'function') showToast('ℹ️ ระบบใช้ Firestore แทน Storage แล้ว');
}
function auditPhotoStorage() {
  const tickets = (typeof db !== 'undefined' ? db.tickets : []) || [];
  let base64Bytes = 0;
  let ticketsWithBase64 = 0;
  let urlPhotoCount = 0;

  for (const t of tickets) {
    const photos = t.photos || [];
    let hasBase64 = false;
    for (const p of photos) {
      if (typeof p === 'string' && p.startsWith('data:')) {
        base64Bytes += p.length * 0.75; // base64 to bytes approximation
        hasBase64 = true;
      } else if (typeof p === 'string' && (p.startsWith('http') || p.startsWith('fs:'))) {
        urlPhotoCount++;
      }
    }
    if (hasBase64) ticketsWithBase64++;
  }

  return {
    base64SizeMB: (base64Bytes / 1024 / 1024).toFixed(2),
    ticketsWithBase64,
    urlPhotoCount
  };
}

// ============================================================
// PHOTO RETENTION — ลบรูปจาก Firestore หลังงานปิดครบกี่วัน
// Fix29 — Admin ตั้งค่าได้ใน Settings
// ============================================================
const PHOTO_RETENTION_KEY = 'aircon_photo_retention';

function getPhotoRetentionConfig() {
  try {
    return JSON.parse(localStorage.getItem(PHOTO_RETENTION_KEY) || '{}');
  } catch(e) { return {}; }
}

function savePhotoRetentionSettings() {
  const enable = document.getElementById('sp-photo-del-enable')?.checked || false;
  const days   = parseInt(document.getElementById('sp-photo-del-days')?.value) || 90;
  const cfg    = { enable, days };
  localStorage.setItem(PHOTO_RETENTION_KEY, JSON.stringify(cfg));
  // sync ขึ้น Firestore ผ่าน db.photoRetention
  if (typeof db !== 'undefined') {
    db.photoRetention = cfg;
    if (typeof saveDB === 'function') saveDB();
    if (typeof fsSave === 'function') fsSave();
  }
  // อัปเดต toggle UI
  _updatePhotoRetentionUI(enable);
}

function _updatePhotoRetentionUI(enable) {
  const toggle = document.getElementById('sp-photo-del-toggle');
  const knob   = document.getElementById('sp-photo-del-knob');
  const row    = document.getElementById('sp-photo-del-row');
  const runBtn = document.getElementById('sp-photo-del-run');
  if (toggle) toggle.style.background = enable ? '#7c3aed' : '#e5e7eb';
  if (knob)   knob.style.transform    = enable ? 'translateX(18px)' : 'translateX(0)';
  if (row)    row.style.opacity       = enable ? '1' : '0.45';
  if (runBtn) runBtn.style.opacity    = enable ? '1' : '0.6';
}

function loadPhotoRetentionUI() {
  // โหลดค่าจาก db.photoRetention (Firestore) ก่อน localStorage
  const stored = (typeof db !== 'undefined' && db.photoRetention) ? db.photoRetention : getPhotoRetentionConfig();
  const enable = stored.enable || false;
  const days   = stored.days   || 90;
  const chk = document.getElementById('sp-photo-del-enable');
  const inp = document.getElementById('sp-photo-del-days');
  if (chk) chk.checked  = enable;
  if (inp) inp.value    = days;
  _updatePhotoRetentionUI(enable);
}

async function runPhotoCleanupNow() {
  const cfg = (typeof db !== 'undefined' && db.photoRetention) ? db.photoRetention : getPhotoRetentionConfig();
  const days = cfg.days || 90;
  const resultEl = document.getElementById('sp-photo-del-result');
  const btn      = document.getElementById('sp-photo-del-run');

  if (typeof FSdb === 'undefined' || !FSdb) {
    if (resultEl) resultEl.textContent = '❌ ไม่มีการเชื่อมต่อ Firestore';
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังตรวจสอบ...'; }
  if (resultEl) resultEl.textContent = '';

  try {
    const cutoffMs = Date.now() - (days * 24 * 60 * 60 * 1000);
    const tickets  = (typeof db !== 'undefined' ? db.tickets : []) || [];

    // หางานที่ปิดแล้ว (closed/verified) และ closedAt ก่อน cutoff
    const expired = tickets.filter(t => {
      if (!['closed','verified'].includes(t.status)) return false;
      // หาวันปิดงานจาก history หรือ updatedAt
      const closedEntry = (t.history || []).slice().reverse()
        .find(h => h.act && (h.act.includes('ปิดงาน') || h.act.includes('ตรวจรับ')));
      const closedAtStr = closedEntry?.at || t.updatedAt || '';
      if (!closedAtStr) return false;
      try {
        const closedTs = new Date(closedAtStr.replace(' ','T')).getTime();
        return closedTs < cutoffMs;
      } catch(e) { return false; }
    });

    if (!expired.length) {
      if (resultEl) resultEl.innerHTML = '✅ ไม่มีรูปที่หมดอายุ (ทุกงานยังอยู่ใน ' + days + ' วัน)';
      if (btn) { btn.disabled = false; btn.innerHTML = '🗑️ ลบรูปที่หมดอายุแล้ว (รันทันที)'; }
      return;
    }

    let deleted = 0;
    for (const t of expired) {
      try {
        const snap = await FSdb.collection('ticket_photos').doc(t.id).get();
        if (snap.exists) {
          await FSdb.collection('ticket_photos').doc(t.id).delete();
          // invalidate cache
          if (typeof _photoCache !== 'undefined') delete _photoCache[t.id];
          deleted++;
        }
      } catch(e) {
        console.warn('[PhotoCleanup] error deleting', t.id, e.message);
      }
    }
    const msg = deleted > 0
      ? `🗑️ ลบรูปแล้ว ${deleted} งาน (จาก ${expired.length} งานที่หมดอายุ)`
      : `ℹ️ ${expired.length} งานหมดอายุแล้ว แต่ไม่มีรูปใน Firestore`;
    if (resultEl) resultEl.textContent = msg;
    if (typeof showToast === 'function') showToast(msg);
  } catch(e) {
    if (resultEl) resultEl.textContent = '❌ เกิดข้อผิดพลาด: ' + e.message;
    console.error('[PhotoCleanup]', e);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '🗑️ ลบรูปที่หมดอายุแล้ว (รันทันที)'; }
  }
}

// เรียกจาก renderSettingsPage ให้ UI sync
function initPhotoRetentionUI() {
  loadPhotoRetentionUI();
}
