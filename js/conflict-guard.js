// ============================================================
// CONFLICT GUARD — Optimistic Locking สำหรับ Firestore
// ============================================================
// ปัญหา: fsSaveNow() ใช้ .set() ทับทั้ง document
//   → admin A แก้ ticket แล้ว save → admin B แก้ ticket เดียวกัน
//   → B save ทีหลัง → งาน A หาย (last-write-wins)
//
// วิธีแก้: Optimistic Locking ด้วย _docVersion
//   1. โหลดข้อมูล → จำ _docVersion ที่ได้มา
//   2. ก่อน save → ตรวจ version กับ remote (ด้วย .get() ก่อน)
//   3. ถ้า version เปลี่ยน → มีคนอื่น save ไปก่อน → reload แล้วแจ้ง user
//   4. ถ้า version ตรง → save ด้วย .set() ตรงๆ (ไม่ใช้ transaction)
//
// ── FIX v6: Multi-doc split — ลด appdata/main ให้เล็กที่สุด ──
// แยก field ใหญ่ออกเป็น doc แยก:
//   appdata/spare_data  → spareParts, spareCatalogVersion, spareStock, stockMovements
//   appdata/machine_data → machines, machineRequests
//   appdata/chat_data   → chats
//   appdata/meta_data   → notifications, calEvents, deletedUserIds
//   appdata/tickets_archive/items/{id} → archived tickets (subcollection)
// ============================================================

let _localDocVersion = 0;
let _saveDebounceTimer = null;
const _SAVE_DEBOUNCE_MS = 800;

function syncDocVersion(data) {
  if (data && typeof data._docVersion === 'number') {
    _localDocVersion = data._docVersion;
  }
}

async function fsSaveWithLock(payload) {
  if (!_firebaseReady || !FSdb) return 'error';

  if (typeof firebase !== 'undefined' && firebase.auth) {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      console.info('[ConflictGuard] auth not ready — skip write');
      return 'error';
    }
  }

  const ref = FSdb.collection('appdata').doc('main');

  try {
    const snap = await ref.get();
    if(window.bkCountRead) window.bkCountRead(1);

    if (snap.exists) {
      const remoteVersion = snap.data()._docVersion || 0;
      if (remoteVersion > _localDocVersion) {
        if (_localDocVersion === 0) {
          console.info('[ConflictGuard] first-save version sync: remote=' + remoteVersion);
          _localDocVersion = remoteVersion;
        } else {
          _localDocVersion = remoteVersion;
          return 'conflict';
        }
      }
    }

    const newVersion = _localDocVersion + 1;
    if(window.bkCountWrite) window.bkCountWrite(1);
    await ref.set({ ...payload, _docVersion: newVersion });
    _localDocVersion = newVersion;
    return 'ok';

  } catch(e) {
    console.warn('[ConflictGuard] save error:', e);
    return 'error';
  }
}

async function handleSaveConflict() {
  console.warn('[ConflictGuard] conflict detected — reloading');
  if (typeof showToast === 'function') {
    showToast('⚠️ ข้อมูลถูกแก้จากอุปกรณ์อื่น — กำลังโหลดใหม่...');
  }
  if (typeof fsLoad === 'function') {
    await fsLoad();
    if (typeof refreshPage === 'function') refreshPage();
  }
}

// ── helper: check real user ──
function _isRealFirebaseUser() {
  if (typeof firebase === 'undefined' || !firebase.auth) return false;
  const u = firebase.auth().currentUser;
  return u && u.isAnonymous === false;
}

// ── helper: strip data URIs + signatures from a ticket ──
function _stripTicket(t) {
  const stripped = { ...t };
  if (stripped.signatures) { delete stripped.signatures; }
  const _stripUris = arr => (arr||[]).map(p => (p && p.startsWith('data:')) ? '' : p).filter(Boolean);
  if ((stripped.photosBefore||[]).some(p=>p&&p.startsWith('data:'))) {
    stripped.photosBefore = _stripUris(stripped.photosBefore);
    console.warn('[fsSaveNowSafe] stripped data: from photosBefore', t.id);
  }
  if ((stripped.photosAfter||[]).some(p=>p&&p.startsWith('data:'))) {
    stripped.photosAfter = _stripUris(stripped.photosAfter);
    console.warn('[fsSaveNowSafe] stripped data: from photosAfter', t.id);
  }
  return stripped;
}

// ── helper: sanitize payload ก่อน write ──
function _sanitize(obj) {
  return JSON.parse(JSON.stringify(obj, (k, v) => {
    if (v === undefined) return null;
    if (typeof v === 'number' && !isFinite(v)) return null;
    return v;
  }));
}

// ── helper: batch write array to subcollection ──
async function _batchWriteSubcollection(colRef, items, idKey) {
  const _CHUNK = 50;
  for (let i = 0; i < items.length; i += _CHUNK) {
    const chunk = items.slice(i, i + _CHUNK);
    const batch = FSdb.batch();
    chunk.forEach((item, j) => {
      const docId = item[idKey] || ('item_' + (i + j));
      batch.set(colRef.doc(docId), item);
    });
    if(window.bkCountWrite) window.bkCountWrite(1);
    await batch.commit();
  }
}

// ══════════════════════════════════════════════════════════════
// fsSaveNowSafe — main save entry point (เรียกจาก firebase-init.js)
// ══════════════════════════════════════════════════════════════
// Note: _fsSaving declared in firebase-init.js — do not re-declare here
if (typeof _fsSaving === 'undefined') var _fsSaving = false;

async function fsSaveNowSafe() {
  if (!_firebaseReady || !FSdb) return;
  if (_fsSaving) { console.info('[ConflictGuard] already saving — skip'); return; }

  if (typeof _waitForAuth === 'function') {
    const authed = await _waitForAuth();
    if (!authed) { console.warn('[fsSaveNowSafe] auth not ready'); return; }
  }
  if (typeof CU === 'undefined' || !CU || !CU.id) {
    console.info('[fsSaveNowSafe] no app user (CU) — skip save');
    return;
  }

  _fsSaving = true;
  const _now = Date.now();

  try {
    // ── 1. แบ่ง tickets → active / archived (>30 วัน + ปิดแล้ว) ──
    const _ARCHIVE_STATUSES = ['done', 'verified', 'closed'];
    const _ARCHIVE_CUTOFF_MS = 30 * 24 * 60 * 60 * 1000;

    const activeTickets = [];
    const archivedTickets = [];
    (db.tickets||[]).forEach(t => {
      const isClosed = _ARCHIVE_STATUSES.includes(t.status);
      const updatedAt = t.updatedAt || t.date || '';
      const ageMs = updatedAt ? (_now - new Date(updatedAt).getTime()) : 0;
      if (isClosed && ageMs > _ARCHIVE_CUTOFF_MS) {
        archivedTickets.push(_stripTicket(t));
      } else {
        activeTickets.push(_stripTicket(t));
      }
    });
    console.log(`[ConflictGuard] tickets: ${activeTickets.length} active, ${archivedTickets.length} archived`);

    // ── 2. ล้าง notifications เก่า > 7 วัน (max 200 รายการ) ──
    const _7d = 7 * 24 * 60 * 60 * 1000;
    const trimmedNotifs = (db.notifications||[])
      .filter(n => (_now - new Date(n.createdAt || n.timestamp || 0).getTime()) < _7d)
      .slice(-200);

    // ── 3. รวม signatures แยก ──
    const allSigs = {};
    (db.tickets||[]).forEach(t => {
      if (t.signatures && Object.keys(t.signatures).length > 0) {
        allSigs[t.id] = t.signatures;
      }
    });

    // ── 4. payload หลัก (appdata/main) — เล็กที่สุด ──
    const mainPayload = {
      users:          db.users          || [],
      repairGroups:   db.repairGroups   || [],
      pdfConfig:      db.pdfConfig      || {},
      tickets:        activeTickets,
      _seq:           db._seq = (db._seq || 0) + 1,
      _hasArchive:    archivedTickets.length > 0,
      _hasSpareData:  true,
      _hasMachineData: true,
      _hasChatData:   true,
      _hasMetaData:   true,
      gsUrl:          db.gsUrl          || '',
      updatedAt:      new Date().toISOString(),
    };

    // ── 5. ตรวจขนาด payload + AUTO-TRIM ก่อน save Firestore ──
    // Firestore limit = 1 MB (1,048,576 bytes) ต่อ document
    // เพื่อป้องกัน error "Document exceeds maximum size" → trim ก่อน write เสมอ
    const FS_LIMIT      = 1_000_000;  // 1 MB hard limit ของ Firestore
    const FS_WARN       = 700_000;    // 700 KB → warn + soft trim
    const CLOSED_STATUS = ['done', 'verified', 'closed', 'cancelled'];

    let mainSize = JSON.stringify(mainPayload).length;
    console.log('[ConflictGuard] main payload size:', (mainSize/1024).toFixed(0)+'KB');

    // ── Auto-trim: ถ้า payload ใหญ่เกิน 700KB → ตัด activeTickets เก่าออก ──
    if (mainSize > FS_WARN) {
      // เรียง active tickets จากใหม่→เก่า แล้วตัด closed เก่า > 14 วัน ออกก่อน
      const now14d  = Date.now() - 14 * 86400000;
      const now7d   = Date.now() - 7  * 86400000;
      const cutoffMs = mainSize > FS_LIMIT ? now14d : now14d; // ใช้ 14 วัน สำหรับ active payload

      const before = mainPayload.tickets.length;
      mainPayload.tickets = mainPayload.tickets.filter(t => {
        if (!CLOSED_STATUS.includes(t.status)) return true; // เก็บ open tickets ทั้งหมด
        const updMs = t.updatedAt ? new Date(t.updatedAt).getTime() : 0;
        return updMs > cutoffMs; // เก็บ closed ที่ปิดไม่เกิน 14 วัน
      });
      const after = mainPayload.tickets.length;
      const removed = before - after;
      if (removed > 0) {
        mainSize = JSON.stringify(mainPayload).length;
        console.warn(`[ConflictGuard] auto-trim active payload: ลบ ${removed} tickets → ${(mainSize/1024).toFixed(0)}KB`);
        if (typeof bkLog === 'function') bkLog('sync', `Auto-trim Firestore payload: ลบ ${removed} tickets`, `${(mainSize/1024).toFixed(0)}KB`);
      }
    }

    // ── ถ้ายังใหญ่เกิน limit → trim หนักขึ้น (เหลือแค่ open tickets) ──
    if (mainSize > FS_LIMIT) {
      const before = mainPayload.tickets.length;
      mainPayload.tickets = mainPayload.tickets.filter(t => !CLOSED_STATUS.includes(t.status));
      mainSize = JSON.stringify(mainPayload).length;
      console.error(`[ConflictGuard] emergency trim: เหลือแค่ open tickets (${mainPayload.tickets.length}/${before}) → ${(mainSize/1024).toFixed(0)}KB`);
      if (typeof bkLog === 'function') bkLog('sync', 'Emergency trim Firestore: open tickets only', `${(mainSize/1024).toFixed(0)}KB`);
      if (typeof showToast === 'function')
        showToast('🧹 ล้างงานเก่าอัตโนมัติก่อน sync Firestore');
    }

    // ── ถ้ายังเกิน limit แม้หลัง trim → abort save (ป้องกัน SDK error popup) ──
    if (mainSize > FS_LIMIT) {
      console.error('[ConflictGuard] payload ยังใหญ่เกิน Firestore limit หลัง trim — abort save');
      if (typeof showToast === 'function')
        showToast('⚠️ ข้อมูลใหญ่เกินไป — กรุณา Backup แล้วล้างงานเก่าในหน้า Admin');
      _fsSaving = false;
      return;
    }

    if (mainSize > FS_WARN) {
      console.warn('[ConflictGuard] main payload large:', (mainSize/1024).toFixed(0)+'KB');
    }

    // ── 6. save appdata/main (มี conflict lock) ──
    let _safeMain;
    try { _safeMain = _sanitize(mainPayload); }
    catch(e) { _safeMain = mainPayload; }

    const result = await fsSaveWithLock(_safeMain);
    if (result === 'conflict') {
      await handleSaveConflict();
      return;
    }
    if (result === 'error') {
      console.warn('[ConflictGuard] save error — fallback to direct set');
      if(window.bkCountWrite) window.bkCountWrite(1);
      await FSdb.collection('appdata').doc('main').set(_safeMain);
    }

    // ── ส่วนที่เหลือ: save เฉพาะ real user ──
    const isReal = _isRealFirebaseUser();

    // ── 7. save appdata/spare_data ──
    try {
      const sparePayload = _sanitize({
        spareParts:          db.spareParts          || [],
        spareCatalogVersion: db.spareCatalogVersion || 0,
        spareStock:          db.spareStock          || {},
        stockMovements:      db.stockMovements      || [],
        updatedAt:           new Date().toISOString(),
      });
      if(window.bkCountWrite) window.bkCountWrite(1);
      await FSdb.collection('appdata').doc('spare_data').set(sparePayload);
      console.log('[ConflictGuard] spare_data saved:', (JSON.stringify(sparePayload).length/1024).toFixed(0)+'KB');
    } catch(e) {
      console.warn('[ConflictGuard] spare_data save failed:', e);
    }

    // ── 8. save appdata/machine_data ──
    try {
      const machinePayload = _sanitize({
        machines:        db.machines        || [],
        machineRequests: db.machineRequests || [],
        updatedAt:       new Date().toISOString(),
      });
      if(window.bkCountWrite) window.bkCountWrite(1);
      await FSdb.collection('appdata').doc('machine_data').set(machinePayload);
      console.log('[ConflictGuard] machine_data saved:', (JSON.stringify(machinePayload).length/1024).toFixed(0)+'KB');
    } catch(e) {
      console.warn('[ConflictGuard] machine_data save failed:', e);
    }

    // ── 9. save appdata/chat_data ──
    try {
      const chatPayload = _sanitize({
        chats:     db.chats || {},
        updatedAt: new Date().toISOString(),
      });
      if(window.bkCountWrite) window.bkCountWrite(1);
      await FSdb.collection('appdata').doc('chat_data').set(chatPayload);
    } catch(e) {
      console.warn('[ConflictGuard] chat_data save failed:', e);
    }

    // ── 10. save appdata/meta_data ──
    try {
      const metaPayload = _sanitize({
        notifications:  trimmedNotifs,
        calEvents:      db.calEvents      || [],
        deletedUserIds: db.deletedUserIds || [],
        updatedAt:      new Date().toISOString(),
      });
      if(window.bkCountWrite) window.bkCountWrite(1);
      await FSdb.collection('appdata').doc('meta_data').set(metaPayload);
    } catch(e) {
      console.warn('[ConflictGuard] meta_data save failed:', e);
    }

    // ── 11. save archived tickets → subcollection ──
    if (archivedTickets.length > 0 && isReal) {
      try {
        const archColRef = FSdb.collection('appdata').doc('tickets_archive').collection('items');
        await _batchWriteSubcollection(archColRef, archivedTickets, 'id');
        console.log('[ConflictGuard] archived', archivedTickets.length, 'tickets to subcollection');
      } catch(archiveErr) {
        console.warn('[ConflictGuard] archive write failed (non-critical):', archiveErr);
      }
    }

    // ── 12. save signatures ──
    if (Object.keys(allSigs).length > 0 && isReal) {
      try {
        if(window.bkCountWrite) window.bkCountWrite(1);
        await FSdb.collection('appdata').doc('signatures').set(allSigs);
      } catch(e) {
        try { localStorage.setItem('aircon_sigs_pending', JSON.stringify(allSigs)); } catch(e2) {}
        console.info('[ConflictGuard] signatures cached locally');
      }
    } else if (Object.keys(allSigs).length > 0) {
      try { localStorage.setItem('aircon_sigs_pending', JSON.stringify(allSigs)); } catch(e) {}
    }

  } catch(e) {
    console.warn('[fsSaveNowSafe] unexpected error:', e);
  } finally {
    setTimeout(() => {
      _fsSaving = false;
      if (typeof _pendingTicketIds !== 'undefined') _pendingTicketIds.clear();
    }, 800);
  }
}
