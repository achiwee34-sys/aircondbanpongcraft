// ============================================================
// PHOTO STORAGE — Firebase Storage (แทน base64 ใน Firestore)
// ============================================================
// วิธีทำงาน:
//   1. compressPhoto() ยังคง return base64 เหมือนเดิม (สำหรับ preview)
//   2. ก่อน save ticket จริง → uploadPendingPhotos() แปลง base64 → Storage URL
//   3. ticket จะมีแค่ URL (string สั้น) ไม่มี base64 ยัดใน Firestore
//   4. backward compatible: URL ที่ขึ้นต้นด้วย "data:" คือรูปเก่า (base64) แสดงได้ปกติ
// ============================================================

let FSstorage = null; // init ใน initFirebase()

/**
 * เริ่ม Firebase Storage (เรียกจาก initFirebase ใน firebase-init.js)
 */
function initStorage() {
  try {
    if (typeof firebase === 'undefined' || !firebase.apps.length) return;
    FSstorage = firebase.storage();
  } catch(e) {
    console.warn('[Storage] init error:', e);
  }
}

/**
 * Upload รูปเดียว (base64 string) ขึ้น Firebase Storage
 * @param {string} base64  - data:image/jpeg;base64,... หรือ URL เดิม
 * @param {string} path    - path ใน Storage เช่น "tickets/TK032026001/before_0.jpg"
 * @returns {Promise<string>} - download URL หรือ base64 เดิม (ถ้า upload ไม่ได้)
 */
async function uploadPhotoToStorage(base64, path) {
  // ถ้าเป็น URL แล้ว (https://) ไม่ต้อง upload ซ้ำ
  if (!base64 || !base64.startsWith('data:')) return base64;
  // ถ้า Storage ไม่พร้อม → fallback เป็น base64 เดิม (offline mode)
  if (!FSstorage) return base64;

  try {
    // แปลง base64 → Blob
    const res = await fetch(base64);
    const blob = await res.blob();
    const ref = FSstorage.ref(path);
    const snapshot = await ref.put(blob, { contentType: 'image/jpeg' });
    const url = await snapshot.ref.getDownloadURL();
    return url;
  } catch(e) {
    console.warn('[Storage] upload failed, using base64 fallback:', e);
    return base64; // fallback — ยังใช้งานได้ แค่ไม่ ideal
  }
}

/**
 * Upload รูปทั้งหมดใน pendingPhotos ก่อน save ticket
 * เปลี่ยน pendingPhotos array จาก base64 → Storage URL in-place
 * @param {string} ticketId - ใช้เป็น path prefix ใน Storage
 */
async function uploadPendingPhotosToStorage(ticketId) {
  if (!FSstorage) return; // offline → ใช้ base64 ไปก่อน

  const timestamp = Date.now();

  // before photos
  for (let i = 0; i < pendingPhotos.before.length; i++) {
    const p = pendingPhotos.before[i];
    if (p && p.startsWith('data:')) {
      const path = `tickets/${ticketId}/before_${i}_${timestamp}.jpg`;
      pendingPhotos.before[i] = await uploadPhotoToStorage(p, path);
    }
  }

  // after photos
  for (let i = 0; i < pendingPhotos.after.length; i++) {
    const p = pendingPhotos.after[i];
    if (p && p.startsWith('data:')) {
      const path = `tickets/${ticketId}/after_${i}_${timestamp}.jpg`;
      pendingPhotos.after[i] = await uploadPhotoToStorage(p, path);
    }
  }
}

/**
 * Upload รูปที่อยู่ใน ticket object แล้ว (สำหรับ migrate ข้อมูลเก่า)
 * @param {object} ticket
 */
async function migrateTicketPhotos(ticket) {
  if (!FSstorage || !ticket?.id) return ticket;

  const timestamp = Date.now();
  let changed = false;

  if (Array.isArray(ticket.photosBefore)) {
    for (let i = 0; i < ticket.photosBefore.length; i++) {
      if (ticket.photosBefore[i]?.startsWith('data:')) {
        const path = `tickets/${ticket.id}/before_${i}_${timestamp}.jpg`;
        ticket.photosBefore[i] = await uploadPhotoToStorage(ticket.photosBefore[i], path);
        changed = true;
      }
    }
  }

  if (Array.isArray(ticket.photosAfter)) {
    for (let i = 0; i < ticket.photosAfter.length; i++) {
      if (ticket.photosAfter[i]?.startsWith('data:')) {
        const path = `tickets/${ticket.id}/after_${i}_${timestamp}.jpg`;
        ticket.photosAfter[i] = await uploadPhotoToStorage(ticket.photosAfter[i], path);
        changed = true;
      }
    }
  }

  return { ticket, changed };
}

/**
 * ลบรูปใน Storage เมื่อ ticket ถูกลบ
 * @param {object} ticket
 */
/**
 * ตรวจว่า ticket มี base64 photos อยู่ไหม (สำหรับ detect ข้อมูลเก่า)
 */
function ticketHasBase64Photos(ticket) {
  const check = arr => (arr||[]).some(p => p?.startsWith('data:'));
  return check(ticket?.photosBefore) || check(ticket?.photosAfter);
}

/**
 * ประมาณขนาด base64 photos ใน ticket (bytes)
 */
function estimateTicketPhotoSize(ticket) {
  const calc = arr => (arr||[]).reduce((sum, p) => sum + (p?.length||0), 0);
  return calc(ticket?.photosBefore) + calc(ticket?.photosAfter);
}

// ============================================================
// MIGRATION — ย้ายรูปเก่า (base64) ใน Firestore → Firebase Storage
// ============================================================

let _migrationRunning = false;

/**
 * ตรวจและรายงานขนาด base64 photos ทั้งหมดใน db
 */
function auditPhotoStorage() {
  const tickets = db.tickets || [];
  let totalBase64 = 0;
  let ticketsWithBase64 = 0;
  let totalURL = 0;

  tickets.forEach(t => {
    const size = estimateTicketPhotoSize(t);
    if (size > 0) {
      totalBase64 += size;
      ticketsWithBase64++;
    }
    const urlCount = [...(t.photosBefore||[]), ...(t.photosAfter||[])]
      .filter(p => p?.startsWith('https://')).length;
    totalURL += urlCount;
  });

  return {
    totalTickets: tickets.length,
    ticketsWithBase64,
    base64SizeKB: Math.round(totalBase64 / 1024),
    base64SizeMB: (totalBase64 / 1024 / 1024).toFixed(2),
    urlPhotoCount: totalURL,
    estimatedFirestoreKB: Math.round(
      JSON.stringify(tickets.map(t => {
        const { photosBefore, photosAfter, ...rest } = t;
        return rest;
      })).length / 1024
    ),
  };
}

/**
 * Migrate รูปเก่าทั้งหมดใน db.tickets ขึ้น Firebase Storage
 * เรียกจาก Admin UI ปุ่ม "Migrate Photos"
 *
 * @param {function} onProgress  - callback(current, total, ticketId)
 * @param {function} onDone     - callback(result)
 */
async function migrateAllPhotosToStorage(onProgress, onDone) {
  if (_migrationRunning) {
    if (typeof showToast === 'function') showToast('⚠️ Migration กำลังทำงานอยู่');
    return;
  }
  if (!FSstorage) {
    if (typeof showToast === 'function') showToast('❌ Firebase Storage ยังไม่พร้อม');
    return;
  }

  _migrationRunning = true;
  const tickets = (db.tickets || []).filter(t => ticketHasBase64Photos(t));

  if (tickets.length === 0) {
    _migrationRunning = false;
    if (typeof showToast === 'function') showToast('✅ ไม่มีรูปเก่าให้ migrate');
    if (onDone) onDone({ migrated: 0, failed: 0 });
    return;
  }

  let migrated = 0, failed = 0;

  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i];
    if (onProgress) onProgress(i + 1, tickets.length, t.id);

    try {
      const { changed } = await migrateTicketPhotos(t);
      if (changed) {
        migrated++;
        // อัปเดต db.tickets ด้วย object เดิม (migrateTicketPhotos แก้ in-place)
        const idx = db.tickets.findIndex(x => x.id === t.id);
        if (idx >= 0) db.tickets[idx] = t;
      }
    } catch(e) {
      console.error('[Migration] failed for', t.id, e);
      failed++;
    }
  }

  // Save ขึ้น Firestore ครั้งเดียวหลัง migrate ครบ
  if (migrated > 0) {
    if (typeof saveDB === 'function') saveDB();
    if (typeof fsSaveNow === 'function') {
      try { await fsSaveNow(); } catch(e) {}
    }
  }

  _migrationRunning = false;
  const result = { migrated, failed, total: tickets.length };
  if (onDone) onDone(result);

  if (typeof showToast === 'function') {
    showToast(`✅ Migrate เสร็จ: ${migrated} tickets, ล้มเหลว: ${failed}`);
  }

  return result;
}

/**
 * UI wrapper — เรียกจากปุ่ม Admin
 * แสดง progress ใน toast และ console
 */
async function runPhotoMigrationUI() {
  const audit = auditPhotoStorage();
  if (audit.ticketsWithBase64 === 0) {
    if (typeof showToast === 'function') showToast('✅ ทุก ticket ใช้ Storage URL แล้ว ไม่มีอะไรให้ migrate');
    return;
  }

  const confirmed = confirm(
    `📦 พบ ${audit.ticketsWithBase64} tickets ที่มีรูป base64\n` +
    `ขนาดรวม: ${audit.base64SizeMB} MB\n\n` +
    `ต้องการ migrate รูปทั้งหมดขึ้น Firebase Storage ไหม?\n` +
    `(ใช้เวลาสักครู่ ขึ้นอยู่กับจำนวนรูป)`
  );
  if (!confirmed) return;

  if (typeof showToast === 'function') showToast('⏳ กำลัง migrate รูปภาพ...');

  await migrateAllPhotosToStorage(
    (current, total, tid) => {
      if (typeof showToast === 'function') {
        showToast(`⏳ Migrating ${current}/${total}: ${tid}`);
      }
    },
    (_result) => {
      // migration complete
    }
  );
}
