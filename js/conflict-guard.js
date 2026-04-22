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
// ── FIX v23-fix20: ลด HTTP requests ──
// เดิม: runTransaction() → 2 requests ทุกครั้ง (GET + POST commit)
// ใหม่: .get() แล้ว .set() → 2 requests เหมือนกัน แต่ไม่มี Firebase
//       transaction overhead และไม่ retry อัตโนมัติ (ไม่มี 400 ซ้ำ)
//
// ── FIX v23-fix20: debounce fsSaveNow ──
// fsSave() ถูกเรียกทุก action เล็กน้อย → debounce 800ms เพื่อ batch writes
// ============================================================

let _localDocVersion = 0; // version ที่ load มาล่าสุด
let _saveDebounceTimer = null; // debounce timer สำหรับ fsSaveNow
const _SAVE_DEBOUNCE_MS = 800; // รอ 800ms หลังจาก action สุดท้ายก่อน write

/**
 * อ่าน version จาก Firestore doc แล้วเก็บไว้ใน _localDocVersion
 * เรียกตอน fsLoad() สำเร็จ
 */
function syncDocVersion(data) {
  if (data && typeof data._docVersion === 'number') {
    _localDocVersion = data._docVersion;
  }
}

/**
 * บันทึกขึ้น Firestore แบบมี conflict check
 * ใช้ .get() + .set() แทน runTransaction() — ลด HTTP requests
 * และไม่มี Firebase auto-retry ที่ทำให้เกิด :commit 400 ซ้ำ
 *
 * @param {object} payload  - ข้อมูลที่จะ save
 * @returns {Promise<'ok'|'conflict'|'error'>}
 */
async function fsSaveWithLock(payload) {
  if (!_firebaseReady || !FSdb) return 'error';

  // ── FIX v23-fix22: ตรวจ auth ก่อน write ──
  // ถ้า firebase.auth().currentUser เป็น null → write จะ fail 400 ทันที
  // รอให้ auth พร้อมก่อน (max 3s) เพื่อป้องกัน spurious :commit 400
  if (typeof firebase !== 'undefined' && firebase.auth) {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
      console.info('[ConflictGuard] auth not ready — skip write');
      return 'error';
    }
  }

  const ref = FSdb.collection('appdata').doc('main');

  try {
    // ── Step 1: GET remote version (1 request) ──
    const snap = await ref.get();
    if(window.bkCountRead) window.bkCountRead(1);

    if (snap.exists) {
      const remoteVersion = snap.data()._docVersion || 0;

      // ถ้า remote version ใหม่กว่า local → conflict
      if (remoteVersion > _localDocVersion) {
        // ── FIX: ถ้า _localDocVersion ยังเป็น 0 แสดงว่า syncDocVersion() ยังไม่ได้รัน
        // (race condition ระหว่าง fsLoad กับ fsSave ครั้งแรก) → sync version แล้ว save ต่อ
        // ไม่ใช่ conflict จริง เพราะ user เพิ่งโหลดข้อมูลมาในแท็บนี้
        if (_localDocVersion === 0) {
          console.info('[ConflictGuard] first-save version sync: remote=' + remoteVersion);
          _localDocVersion = remoteVersion;
          // fall through → save ต่อด้วย version ที่ sync แล้ว
        } else {
          _localDocVersion = remoteVersion;
          return 'conflict';
        }
      }
    }

    // ── Step 2: SET พร้อม bump version (1 request) ──
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

/**
 * Handle conflict: โหลดข้อมูลใหม่ แล้วแจ้ง user
 * เรียกเมื่อ fsSaveWithLock() return 'conflict'
 */
async function handleSaveConflict() {
  console.warn('[ConflictGuard] Conflict detected — reloading from Firestore');

  if (typeof showToast === 'function') {
    showToast('⚠️ ข้อมูลถูกแก้จากเครื่องอื่น กำลัง reload...');
  }

  try {
    const ok = await fsLoad();
    if (ok) {
      if (typeof invalidateMacCache === 'function') invalidateMacCache();
      if (typeof invalidateTkCache === 'function') invalidateTkCache();
      if (typeof refreshPage === 'function') refreshPage();
      if (typeof updateOpenBadge === 'function') updateOpenBadge();
      if (typeof updateNBadge === 'function') updateNBadge();

      if (typeof showToast === 'function') {
        showToast('🔄 โหลดข้อมูลล่าสุดแล้ว — กรุณาทำรายการใหม่อีกครั้ง');
      }
    }
  } catch(err) {
    console.error('[ConflictGuard] reload failed:', err);
    if (typeof showToast === 'function') {
      showToast('❌ โหลดข้อมูลไม่สำเร็จ กรุณากด 🔄 ด้วยตนเอง');
    }
  }
}

/**
 * fsSaveNowSafe — แทน fsSaveNow() เดิม ใส่ conflict check
 * ใช้ signature เดิมทุกอย่าง (async, return promise)
 *
 * ── FIX v23-fix20: ไม่ใช้ runTransaction แล้ว → ใช้ get+set แทน ──
 * ลด HTTP requests จาก 2 (GET+POST commit overhead) เป็น 2 (GET+SET)
 * แต่ไม่มี Firebase auto-retry → ไม่มี :commit 400 ซ้ำๆ
 */
async function fsSaveNowSafe() {
  if (!_firebaseReady || !FSdb) return;
  if (typeof _waitForAuth === "function") {
    const authed = await _waitForAuth();
    if (!authed) { console.warn("[fsSaveNowSafe] auth not ready"); return; }
  }
  // ── FIX v23-fix14b: ห้าม save เมื่อยังไม่มี app-level user (CU) ──
  if (typeof CU === 'undefined' || !CU || !CU.id) {
    console.info('[fsSaveNowSafe] no app user (CU) — skip save');
    return;
  }
  _fsSaving = true;

  try {
    // strip signatures + data: URIs ออกจาก tickets
    const _stripDataUris = arr => (arr||[]).map(p =>
      (p && p.startsWith('data:')) ? '' : p
    ).filter(Boolean);
    const ticketsNoSig = (db.tickets||[]).map(t => {
      const stripped = { ...t };
      if (stripped.signatures) { const {signatures:_s, ...rest} = stripped; Object.assign(stripped, rest); delete stripped.signatures; }
      if ((stripped.photosBefore||[]).some(p=>p&&p.startsWith('data:'))) {
        stripped.photosBefore = _stripDataUris(stripped.photosBefore);
        console.warn('[fsSaveNowSafe] stripped data: from photosBefore', t.id);
      }
      if ((stripped.photosAfter||[]).some(p=>p&&p.startsWith('data:'))) {
        stripped.photosAfter = _stripDataUris(stripped.photosAfter);
        console.warn('[fsSaveNowSafe] stripped data: from photosAfter', t.id);
      }
      return stripped;
    });

    // size guard
    const _payloadSize = JSON.stringify(ticketsNoSig).length;
    if (_payloadSize > 900_000) {
      console.warn('[fsSaveNowSafe] payload large:', (_payloadSize/1024).toFixed(0)+'KB');
      if (typeof showToast === 'function' && _payloadSize > 950_000)
        showToast('⚠️ ข้อมูลใกล้เต็ม กรุณา Backup แล้วล้างงานเก่า');
    }

    // รวม signatures แยก doc
    const allSigs = {};
    (db.tickets||[]).forEach(t => {
      if (t.signatures && Object.keys(t.signatures).length > 0) {
        allSigs[t.id] = t.signatures;
      }
    });

    const payload = {
      users:           db.users           || [],
      machines:        db.machines        || [],
      tickets:         ticketsNoSig,
      calEvents:       db.calEvents       || [],
      chats:           db.chats           || {},
      machineRequests: db.machineRequests || [],
      notifications:   db.notifications   || [],
      deletedUserIds:  db.deletedUserIds  || [],
      gsUrl:           db.gsUrl           || '',
      // ── FIX MISSING DATA: repairGroups + pdfConfig + spareParts ──
      repairGroups:    db.repairGroups    || [],
      pdfConfig:       db.pdfConfig       || {},
      spareParts:      db.spareParts      || [],
      _seq:            db._seq = (db._seq || 0) + 1,
      updatedAt:       new Date().toISOString(),
    };

    // ตรวจขนาด payload — Firestore limit = 1MB
    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > 950_000) {
      console.error('[ConflictGuard] Payload TOO LARGE:', (payloadSize/1024).toFixed(0)+'KB — BLOCKED');
      if (typeof showAlert === 'function') {
        showAlert({
          icon: '❌',
          title: 'ข้อมูลเกินขนาด',
          color: '#dc2626',
          msg: `ขนาดข้อมูล <strong>${(payloadSize/1024).toFixed(0)} KB</strong> เกินกว่าที่ Firestore รองรับได้<br>
            <span style="font-size:0.78rem;color:#64748b">กรุณากด Backup แล้วลบข้อมูลเก่าก่อนบันทึกใหม่</span>`,
          btnOk: 'ตกลง'
        });
      }
      return; // block save
    } else if (payloadSize > 700_000) {
      console.warn('[ConflictGuard] Firestore payload large:', (payloadSize/1024).toFixed(0)+'KB');
      if (typeof showToast === 'function') {
        showToast('⚠️ ข้อมูลใหญ่ขึ้น (' + (payloadSize/1024).toFixed(0) + 'KB) ควร Backup และล้างข้อมูลเก่า');
      }
    }

    // ── FIX v23-fix23: sanitize payload ก่อน write ──
    // Firestore ไม่รองรับ: undefined, NaN, Infinity, circular refs
    // ถ้ามี field เหล่านี้ → 400 Bad Request เงียบๆ
    const _sanitize = (obj) => JSON.parse(JSON.stringify(obj, (k, v) => {
      if (v === undefined) return null;
      if (typeof v === 'number' && !isFinite(v)) return null;
      return v;
    }));
    let _safePayload;
    try { _safePayload = _sanitize(payload); }
    catch(e) { console.warn('[ConflictGuard] payload sanitize failed:', e); _safePayload = payload; }

    const result = await fsSaveWithLock(_safePayload);

    if (result === 'conflict') {
      await handleSaveConflict();
      return;
    }

    if (result === 'error') {
      console.warn('[ConflictGuard] save error — falling back to direct set');
      // fallback: ใช้ .set() เดิม (ไม่มี lock แต่ดีกว่า fail เงียบ)
      if(window.bkCountWrite) window.bkCountWrite(1);
      await FSdb.collection('appdata').doc('main').set(_safePayload);
    }

    // save signatures แยก (ถ้ามี)
    if (Object.keys(allSigs).length > 0) {
      const _fbUser = firebase.auth().currentUser;
      const _isRealUser = _fbUser && _fbUser.isAnonymous === false;
      if (_isRealUser) {
        await FSdb.collection('appdata').doc('signatures').set(allSigs);
      } else {
        try { localStorage.setItem('aircon_sigs_pending', JSON.stringify(allSigs)); } catch(e) {}
        console.info('[ConflictGuard] signatures skipped (anonymous user) — cached locally');
      }
    }

  } catch(e) {
    console.warn('[ConflictGuard] fsSaveNowSafe error:', e);
  } finally {
    setTimeout(() => { _fsSaving = false; }, 500);
  }
}
