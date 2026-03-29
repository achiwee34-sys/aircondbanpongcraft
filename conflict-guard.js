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
let _conflictHandling = false; // FIX: ป้องกัน handleSaveConflict ถูกเรียกซ้ำซ้อน
async function handleSaveConflict() {
  if (_conflictHandling) return; // FIX: debounce — ถ้ากำลัง handle อยู่ให้ skip
  _conflictHandling = true;
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
  } finally {
    setTimeout(() => { _conflictHandling = false; }, 5000); // FIX: รอ 5 วิก่อน allow ครั้งถัดไป
  }
}

/**
 * fsSaveNowSafe — แทน fsSaveNow() เดิม ใส่ conflict check
 * ใช้ signature เดิมทุกอย่าง (async, return promise)
 */
async function fsSaveNowSafe() {
  if (!_firebaseReady || !FSdb) return;
  _fsSaving = true;

  try {
    // strip signatures ออกจาก tickets
    const ticketsNoSig = (db.tickets||[]).map(t => {
      if (!t.signatures) return t;
      const { signatures, ...rest } = t;
      return rest;
    });

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
      _seq:            db._seq            || 1,
      updatedAt:       new Date().toISOString(),
    };

    // ตรวจขนาด payload — warn ถ้าใกล้ 1MB
    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > 800_000) {
      console.warn('[ConflictGuard] Firestore payload large:', (payloadSize/1024).toFixed(0)+'KB');
      if (typeof showToast === 'function') {
        showToast('⚠️ ข้อมูลมีขนาดใหญ่ (' + (payloadSize/1024).toFixed(0) + 'KB) ควร migrate รูปไป Storage');
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
