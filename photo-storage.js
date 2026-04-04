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
    await _withTimeout(
      FSdb.collection('ticket_photos').doc(ticketId).set({
        ticketId,
        before:  photosBefore || [],
        after:   photosAfter  || [],
        savedAt: new Date().toISOString()
      }),
      30000, 'savePhotos'
    );
    const beforeKeys = (photosBefore||[]).map(function(_, i) { return 'fs:' + ticketId + ':b' + i; });
    const afterKeys  = (photosAfter||[]).map(function(_, i)  { return 'fs:' + ticketId + ':a' + i; });
    return { before: beforeKeys, after: afterKeys };
  } catch(e) {
    console.warn('[Photo] savePhotosToFirestore failed:', e.message);
    return { before: [], after: [] };
  }
}

// ── โหลดรูปจาก Firestore ──────────────────────────────────
var _photoCache = {};

async function loadPhotosFromFirestore(ticketId) {
  if (!ticketId) return { before: [], after: [] };
  if (_photoCache[ticketId]) return _photoCache[ticketId];
  if (typeof FSdb === 'undefined' || !FSdb) return { before: [], after: [] };
  try {
    const snap = await _withTimeout(
      FSdb.collection('ticket_photos').doc(ticketId).get(),
      15000, 'loadPhotos'
    );
    if (snap.exists) {
      const data = { before: snap.data().before||[], after: snap.data().after||[] };
      _photoCache[ticketId] = data;
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

  if (!beforeData.length && !afterData.length) return;

  if (typeof showToast === 'function') showToast('⏳ กำลังบันทึกรูปภาพ...');

  try {
    const result = await _withTimeout(
      savePhotosToFirestore(ticketId, beforeData, afterData),
      35000, 'uploadPending'
    );

    if (result.before.length || result.after.length) {
      pendingPhotos.before = result.before;
      pendingPhotos.after  = result.after;
    } else {
      pendingPhotos.before = [];
      pendingPhotos.after  = [];
      if (typeof showToast === 'function') showToast('⚠️ บันทึกรูปไม่สำเร็จ — ส่งงานโดยไม่มีรูป');
    }
  } catch(e) {
    console.warn('[Photo] error:', e.message);
    pendingPhotos.before = [];
    pendingPhotos.after  = [];
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
function auditPhotoStorage() { return {}; }
