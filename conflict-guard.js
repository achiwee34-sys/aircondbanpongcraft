// ============================================================
// CONFLICT GUARD — Optimistic Locking สำหรับ Firestore
// ============================================================
// ปัญหา: fsSaveNow() ใช้ .set() ทับทั้ง document
//   → admin A แก้ ticket แล้ว save → admin B แก้ ticket เดียวกัน
//   → B save ทีหลัง → งาน A หาย (last-write-wins)
//
// วิธีแก้: Optimistic Locking ด้วย _docVersion
//   1. โหลดข้อมูล → จำ _docVersion ที่ได้มา
//   2. ก่อน save → runTransaction() ตรวจว่า version ยังตรงไหม
//   3. ถ้า version เปลี่ยน → มีคนอื่น save ไปก่อน → reload แล้วแจ้ง user
//   4. ถ้า version ตรง → save พร้อม bump version + 1
// ============================================================

let _localDocVersion = 0; // version ที่ load มาล่าสุด

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
 * แทน fsSaveNow() เดิม (เพิ่ม transaction layer)
 *
 * @param {object} payload  - ข้อมูลที่จะ save (เหมือน fsSaveNow เดิม)
 * @returns {Promise<'ok'|'conflict'|'error'>}
 */
async function fsSaveWithLock(payload) {
  if (!_firebaseReady || !FSdb) return 'error';

  const ref = FSdb.collection('appdata').doc('main');

  try {
    await FSdb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);

      if (snap.exists) {
        const remoteVersion = snap.data()._docVersion || 0;

        // ถ้า remote version ใหม่กว่า local → มีคนอื่น save ไปก่อน
        if (remoteVersion > _localDocVersion) {
          const err = new Error('CONFLICT');
          err.isConflict = true;
          throw err;
        }
      }

      // version ตรง หรือ doc ใหม่ → save ได้
      const newVersion = _localDocVersion + 1;
      tx.set(ref, { ...payload, _docVersion: newVersion });
      _localDocVersion = newVersion;
    });

    return 'ok';

  } catch(e) {
    if (e.isConflict) {
      return 'conflict';
    }
    console.warn('[ConflictGuard] transaction error:', e);
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
 */
async function fsSaveNowSafe() {
  if (!_firebaseReady || !FSdb) return;
  if (typeof _waitForAuth === "function") {
    const authed = await _waitForAuth();
    if (!authed) { console.warn("[fsSaveNowSafe] auth not ready"); return; }
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
      // ── BUG FIX: fields เหล่านี้ต้องอยู่ใน payload เสมอ ──
      // ถ้าขาด → .set() จะลบออกจาก Firestore ทุกครั้งที่ save ปกติ
      notifications:   db.notifications   || [],        // ← แจ้งเตือนหาย
      deletedUserIds:  db.deletedUserIds  || [],        // ← blacklist หาย → user ที่ลบกลับมา
      gsUrl:           db.gsUrl           || '',        // ← Google Sheet URL หาย
      _seq:            db._seq = (db._seq || 0) + 1,   // increment ก่อน write เสมอ
      updatedAt:       new Date().toISOString(),
    };

    // ตรวจขนาด payload — Firestore limit = 1MB (1,048,576 bytes)
    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > 950_000) {
      // ใกล้ limit มาก — block save เพื่อป้องกัน Firestore error เงียบ
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

    const result = await fsSaveWithLock(payload);

    if (result === 'conflict') {
      await handleSaveConflict();
      return;
    }

    if (result === 'error') {
      console.warn('[ConflictGuard] save error — falling back to direct set');
      // fallback: ใช้ .set() เดิม (ไม่มี lock แต่ดีกว่า fail เงียบ)
      await FSdb.collection('appdata').doc('main').set(payload);
    }

    // save signatures แยก (ถ้ามี)
    if (Object.keys(allSigs).length > 0) {
      await FSdb.collection('appdata').doc('signatures').set(allSigs);
    }

  } catch(e) {
    console.warn('[ConflictGuard] fsSaveNowSafe error:', e);
  } finally {
    setTimeout(() => { _fsSaving = false; }, 500);
  }
}
