// ── Firebase Setup ─────────────────────────────────────────
let FSdb = null, _firebaseReady = false, _fsListener = null;
// expose to window so app-backend.js can read these
Object.defineProperty(window, '_fsListener', { get: () => _fsListener, configurable: true });
Object.defineProperty(window, 'FSdb', { get: () => FSdb, configurable: true });
let _fsSaving = false;
let _fsChatSaving = false;
// ── Pending Write Guard (FIX: race condition onSnapshot vs fsSave debounce) ──
// เก็บ ticket.id ที่ user เพิ่งเปลี่ยน status — onSnapshot จะไม่เขียนทับจนกว่า Firestore จะ confirm
const _pendingTicketIds = new Set();
function _lockTicket(tid)   { if (tid) _pendingTicketIds.add(tid); }
function _unlockTicket(tid) { if (tid) _pendingTicketIds.delete(tid); }
window._lockTicket   = _lockTicket;
window._unlockTicket = _unlockTicket;

const firebaseConfig = {
  apiKey: "AIzaSyBh14SxXJGgldlr6h1p8H0_S0la7xHkH6w",
  authDomain: "scg-aircon.firebaseapp.com",
  projectId: "scg-aircon",
  storageBucket: "scg-aircon.firebasestorage.app",
  messagingSenderId: "639214607106",
  appId: "1:639214607106:web:4a01a7f333a924b188c01b"
};

// ── ติดตามสถานะ auth แยกจาก _firebaseReady ──
let _firebaseAuthReady = false;

// ── รอ auth ก่อน write (max 5 วินาที) ──
async function _waitForAuth(maxMs = 8000) { // FIX: เพิ่มจาก 5000→8000ms ป้องกัน timeout บน slow connection
  if (_firebaseAuthReady) return true;
  const start = Date.now();
  while (!_firebaseAuthReady && Date.now() - start < maxMs) {
    await new Promise(r => setTimeout(r, 100));
  }
  return _firebaseAuthReady;
}

function initFirebase() {
  try {
    if (typeof firebase === 'undefined') return;
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    FSdb = firebase.firestore();
    // M2 Fix: เปิด offline persistence สำหรับ mobile ที่สัญญาณไม่ดี
    FSdb.enablePersistence({ synchronizeTabs: true }).catch(err => {
      if (err.code === 'failed-precondition') console.warn('[Firestore] persistence: multiple tabs open');
      else if (err.code === 'unimplemented') console.warn('[Firestore] persistence: browser not supported');
    });
    _firebaseReady = true;
    if (firebase.auth) {
      window.firebaseAuth = firebase.auth();
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          // รับทั้ง custom token (LIFF) และ anonymous (PC fallback)
          _firebaseAuthReady = true;
          console.info('[Firebase] auth ready | anonymous:', user.isAnonymous);
          // BUG FIX (Bug 3): ถ้าเป็น anonymous และ db.machines ว่าง
          // → โหลด machines จาก Firestore ทันทีเพื่อ populate dept picker
          if (user.isAnonymous && (!db || !db.machines || db.machines.length === 0)) {
            console.info('[Firebase] anonymous user + no machines — loading from Firestore');
            _loadMachinesForAnonymous();
          }
        } else {
          _firebaseAuthReady = false;
          // ── BUG FIX B: PC ไม่มี LIFF → ไม่มี user → _firebaseAuthReady = false ตลอด
          // Fallback signInAnonymously สำหรับ non-LIFF (PC, browser ทั่วไป)
          // LIFF จะ signInWithCustomToken ทับทีหลังอยู่แล้ว ──
          const isInLiff = (typeof liff !== 'undefined' &&
            typeof liff.isInClient === 'function' && liff.isInClient());
          if (!isInLiff) {
            console.info('[Firebase] ไม่ใช่ LIFF — fallback signInAnonymously');
            firebase.auth().signInAnonymously().catch(e => {
              console.warn('[Firebase] signInAnonymously failed:', e.message);
            });
          } else {
            console.info('[Firebase] รอ LIFF sign in...');
          }
        }
      });
    } else {
      _firebaseAuthReady = true;
    }
    if (typeof initStorage === 'function') initStorage();
  } catch(e) { console.warn('Firebase init error:', e); }
}

// BUG FIX (Bug 3): โหลด machines collection สำหรับ anonymous user
// → ใช้ทำ dept/machine picker ใน new-ticket form ก่อน login
async function _loadMachinesForAnonymous() {
  if (!FSdb) return;
  try {
    // FIX v6: machines ย้ายไป appdata/machine_data แล้ว
    const snap = await FSdb.collection('appdata').doc('machine_data').get();
    if (snap.exists) {
      const data = snap.data();
      if (Array.isArray(data.machines) && data.machines.length) {
        if (typeof db !== 'undefined') {
          db.machines = data.machines;
          console.info('[Firebase] loaded', data.machines.length, 'machines for anonymous');
        }
      }
    }
  } catch(e) {
    console.warn('[_loadMachinesForAnonymous] error:', e.message);
  } finally {
    // trigger populateMachineSelect ไม่ว่าจะสำเร็จหรือไม่
    const _trigger = () => {
      if (typeof populateMachineSelect === 'function') {
        populateMachineSelect._retryCount = 0;
        clearTimeout(populateMachineSelect._retryTimer);
        populateMachineSelect();
      }
    };
    setTimeout(_trigger, 0);
    setTimeout(_trigger, 800);
  }
}

// โหลดข้อมูลจาก Firestore → เขียนทับ db local
async function fsLoad() {
  if (!_firebaseReady || !FSdb) return false;
  // รอ Anonymous Auth ก่อน — ถ้า auth ยังไม่พร้อม Firestore จะ reject ด้วย permission-denied
  const authed = await _waitForAuth(8000);
  if (!authed) { console.warn('[fsLoad] Auth timeout — skip load'); return false; }
  const DEMO_USERNAMES = ['somchai','somsak','malee','wichai'];
  const DEMO_IDS       = ['u2','u3','u4','u5'];
  try {
    // ── FIX v6: โหลด appdata/main ก่อน แล้วโหลด doc แยกแบบ parallel ──
    const snap = await FSdb.collection('appdata').doc('main').get();
    if(window.bkCountRead) window.bkCountRead(1);

    if (snap.exists) {
      const data = snap.data();
      if (typeof syncDocVersion === 'function') syncDocVersion(data);

      // ── โหลด sub-docs แบบ parallel (ไม่รอทีละอัน) ──
      const [spareSnap, machineSnap, chatSnap, metaSnap] = await Promise.all([
        FSdb.collection('appdata').doc('spare_data').get().catch(() => null),
        FSdb.collection('appdata').doc('machine_data').get().catch(() => null),
        FSdb.collection('appdata').doc('chat_data').get().catch(() => null),
        FSdb.collection('appdata').doc('meta_data').get().catch(() => null),
      ]);
      if(window.bkCountRead) window.bkCountRead(4);

      // ── merge meta_data ก่อน (deletedUserIds ต้องมีก่อน merge users) ──
      const metaData = (metaSnap && metaSnap.exists) ? metaSnap.data() : {};
      // fallback: ดึงจาก main ถ้า meta_data ยังไม่มี (migrate ครั้งแรก)
      const deletedIdsArr = metaData.deletedUserIds || data.deletedUserIds || [];
      if (Array.isArray(deletedIdsArr)) {
        const existing = new Set(db.deletedUserIds || []);
        deletedIdsArr.forEach(id => existing.add(id));
        db.deletedUserIds = [...existing];
      }
      const deletedIds = new Set(db.deletedUserIds || []);

      if (Array.isArray(metaData.calEvents))     db.calEvents     = metaData.calEvents;
      else if (Array.isArray(data.calEvents))    db.calEvents     = data.calEvents; // fallback migrate
      if (Array.isArray(metaData.notifications)) db.notifications = metaData.notifications;
      else if (Array.isArray(data.notifications)) db.notifications = data.notifications;

      // ── users: MERGE ไม่ทับ ──
      if (Array.isArray(data.users) && data.users.length) {
        const remoteUsers = data.users.filter(u =>
          !DEMO_USERNAMES.includes(u.username) &&
          !DEMO_IDS.includes(u.id) &&
          !deletedIds.has(u.id)
        );
        const remoteIds = new Set(remoteUsers.map(u => u.id));
        const localOnlyUsers = (db.users||[]).filter(u =>
          !remoteIds.has(u.id) &&
          !DEMO_USERNAMES.includes(u.username) &&
          !DEMO_IDS.includes(u.id) &&
          !deletedIds.has(u.id)
        );
        db.users = [...remoteUsers, ...localOnlyUsers];
        if (localOnlyUsers.length > 0 && typeof CU !== 'undefined' && CU && CU.id) {
          fsSave();
        }
      }

      // ── machine_data ──
      const machineData = (machineSnap && machineSnap.exists) ? machineSnap.data() : {};
      const machinesArr = machineData.machines || data.machines || []; // fallback migrate
      if (Array.isArray(machinesArr) && machinesArr.length) {
        db.machines = machinesArr;
        const _triggerPopulate = () => {
          if (typeof populateMachineSelect === 'function') {
            populateMachineSelect._retryCount = 0;
            clearTimeout(populateMachineSelect._retryTimer);
            populateMachineSelect();
          }
        };
        setTimeout(_triggerPopulate, 0);
        setTimeout(_triggerPopulate, 500);
        setTimeout(_triggerPopulate, 1500);
      }
      if (Array.isArray(machineData.machineRequests))     db.machineRequests = machineData.machineRequests;
      else if (Array.isArray(data.machineRequests))       db.machineRequests = data.machineRequests;

      // ── spare_data ──
      const spareData = (spareSnap && spareSnap.exists) ? spareSnap.data() : {};
      if (Array.isArray(spareData.spareParts) && spareData.spareParts.length > 0)
        db.spareParts = spareData.spareParts;
      else if (Array.isArray(data.spareParts) && data.spareParts.length > 0)
        db.spareParts = data.spareParts; // fallback migrate
      if (typeof spareData.spareCatalogVersion === 'number')  db.spareCatalogVersion = spareData.spareCatalogVersion;
      else if (typeof data.spareCatalogVersion === 'number')  db.spareCatalogVersion = data.spareCatalogVersion;
      if (spareData.spareStock && typeof spareData.spareStock === 'object') db.spareStock = spareData.spareStock;
      else if (data.spareStock && typeof data.spareStock === 'object')      db.spareStock = data.spareStock;
      if (Array.isArray(spareData.stockMovements))  db.stockMovements = spareData.stockMovements;
      else if (Array.isArray(data.stockMovements))  db.stockMovements = data.stockMovements;

      // ── chat_data ──
      const chatData = (chatSnap && chatSnap.exists) ? chatSnap.data() : {};
      if (chatData.chats)      db.chats = chatData.chats;
      else if (data.chats)     db.chats = data.chats; // fallback migrate

      // ── tickets จาก main (active) ──
      if (Array.isArray(data.tickets)) db.tickets = data.tickets;

      // ── FIX v6 LAZY: ไม่โหลด archived tickets ตอน startup ──
      // จะโหลดเฉพาะตอน user กด filter done/verified/closed ผ่าน loadArchivedTickets()
      if (data._hasArchive) {
        db._hasArchive = true;  // flag บอกว่ามี archived อยู่ใน Firestore
        db._archiveLoaded = false; // ยังไม่ได้โหลด
      } else {
        db._hasArchive = false;
        db._archiveLoaded = true; // ไม่มีของ ถือว่า loaded แล้ว
      }

      // ── ค่าอื่นๆ จาก main ──
      if (data._seq)  db._seq = data._seq;
      if (data.gsUrl) db.gsUrl = data.gsUrl;
      if (Array.isArray(data.repairGroups) && data.repairGroups.length > 0) db.repairGroups = data.repairGroups;
      if (data.pdfConfig && typeof data.pdfConfig === 'object') db.pdfConfig = data.pdfConfig;

      // ── signatures ──
      try {
        const _fbUser = firebase.auth().currentUser;
        const _isRealUser = _fbUser && _fbUser.isAnonymous === false;
        if (_isRealUser) {
          const sigSnap = await FSdb.collection('appdata').doc('signatures').get();
          if(window.bkCountRead) window.bkCountRead(1);
          if (sigSnap.exists) {
            const allSigs = sigSnap.data();
            db.tickets.forEach(t => { if (allSigs[t.id]) t.signatures = allSigs[t.id]; });
            try { localStorage.setItem('aircon_sigs', JSON.stringify(allSigs)); } catch(e) {}
          }
        } else {
          const sigCache = JSON.parse(localStorage.getItem('aircon_sigs') || '{}');
          db.tickets.forEach(t => { if (sigCache[t.id]) t.signatures = sigCache[t.id]; });
        }
      } catch(e) {
        try {
          const sigCache = JSON.parse(localStorage.getItem('aircon_sigs') || '{}');
          db.tickets.forEach(t => { if (sigCache[t.id]) t.signatures = sigCache[t.id]; });
        } catch(e2) {}
      }

      const dbForLocal = {...db, tickets: (db.tickets||[]).map(t=>{
        if(!t.signatures) return t;
        const {signatures:_s,...rest}=t; return rest;
      })};
      localStorage.setItem(DB_KEY, JSON.stringify(dbForLocal));
      return true;
    } else {
      await fsSaveNow();
      return true;
    }
  } catch(e) { console.warn('fsLoad error:', e); return false; }
}

// บันทึกเฉพาะ chats — เร็วกว่า saveDB ทั้งก้อนมาก
async function saveChatsFast() {
  if (!_firebaseReady || !FSdb) return;
  const authed = await _waitForAuth();
  if (!authed) { console.warn("[saveChatsFast] auth not ready"); return; }
  // ── FIX v23-fix19: เพิ่ม CU guard เหมือน fsSaveNowSafe ──
  // ป้องกัน anonymous user ที่ยังไม่ login ยิง write → :commit 400
  if (typeof CU === 'undefined' || !CU || !CU.id) {
    console.info('[saveChatsFast] no app user (CU) — skip');
    return;
  }
  _fsChatSaving = true;
  try {
    if(window.bkCountWrite) window.bkCountWrite(1);
    // ── FIX v23-fix19: ใช้ set+merge แทน update ──
    // .update() จะ fail ด้วย 400 ถ้า doc ยังไม่มี (เช่น first-time user)
    // .set(merge:true) สร้าง doc ใหม่อัตโนมัติถ้าไม่มี → ไม่มี :commit 400
    // ── FIX v6: save chats ไป chat_data doc แยก ──
    await FSdb.collection('appdata').doc('chat_data').set({
      chats: db.chats || {},
      updatedAt: new Date().toISOString()
    });
  } catch(e) {
    // ── FIX v23-fix21: ใช้ fsSave() แทน fsSaveNow() → ผ่าน debounce ──
    if (typeof fsSave === 'function') fsSave();
  } finally {
    _fsChatSaving = false;
  }
}

// ── PATCH v67: fsSaveNow → delegate ไป fsSaveNowSafe (conflict-guard.js)
async function fsSaveNow() {
  if (typeof fsSaveNowSafe === 'function') {
    return fsSaveNowSafe();
  }
  // ─── FALLBACK (ถ้า conflict-guard.js ยังไม่โหลด) ─────────
  if (!_firebaseReady || !FSdb) return;
  const _authed = await _waitForAuth(8000);
  if (!_authed) { console.warn("[fsSaveNow] auth not ready"); return; }
  // FIX v23-fix14b: ใช้ CU (app user) แทน firebase.auth().isAnonymous
  // เพราะระบบ login ด้วย username/password → firebase user = anonymous เสมอ
  if (typeof CU === 'undefined' || !CU || !CU.id) {
    console.info('[fsSaveNow] no app user (CU) — skip save');
    return;
  }
  _fsSaving = true;
  // ── increment _seq ก่อน write เสมอ → ป้องกัน onSnapshot restore ข้อมูลที่เพิ่งลบ ──
  db._seq = (db._seq || 0) + 1;
  try {
    // ── Strip data: URIs + signatures before Firestore save ──
    // ป้องกัน Firestore 1MB doc limit: data: base64 ต้องไม่อยู่ใน appdata/main
    const _stripDataUris = arr => (arr||[]).map(p =>
      (p && p.startsWith('data:')) ? '' : p  // แทนด้วย '' — photo-storage.js จะ skip key ว่าง
    ).filter(Boolean);
    const ticketsNoSig = (db.tickets||[]).map(t => {
      const stripped = { ...t };
      if (stripped.signatures) { const {signatures:_s, ...rest} = stripped; return rest; }
      // strip data: URIs ที่อาจค้างจาก upload ล้มเหลว
      if ((stripped.photosBefore||[]).some(p=>p&&p.startsWith('data:'))) {
        stripped.photosBefore = _stripDataUris(stripped.photosBefore);
        console.warn('[fsSave] stripped data: from photosBefore', t.id);
      }
      if ((stripped.photosAfter||[]).some(p=>p&&p.startsWith('data:'))) {
        stripped.photosAfter = _stripDataUris(stripped.photosAfter);
        console.warn('[fsSave] stripped data: from photosAfter', t.id);
      }
      return stripped;
    });
    // ── Size guard: warn ถ้า payload ใกล้ 900KB ──
    const _payloadSize = JSON.stringify(ticketsNoSig).length;
    if (_payloadSize > 900_000) {
      console.warn('[fsSave] payload large:', (_payloadSize/1024).toFixed(0)+'KB — consider archiving old tickets');
      if (typeof showToast === 'function' && _payloadSize > 950_000)
        showToast('⚠️ ข้อมูลใกล้เต็ม กรุณา Backup แล้วล้างงานเก่า');
    }
    const allSigs = {};
    (db.tickets||[]).forEach(t => {
      if (t.signatures && Object.keys(t.signatures).length > 0) {
        allSigs[t.id] = t.signatures;
      }
    });
    // ── FIX v6: fallback save — ยังแยก doc เหมือน fsSaveNowSafe ──
    if(window.bkCountWrite) window.bkCountWrite(1);
    await FSdb.collection('appdata').doc('main').set({
      users:          db.users          || [],
      repairGroups:   db.repairGroups   || [],
      pdfConfig:      db.pdfConfig      || {},
      tickets:        ticketsNoSig,
      _seq:           db._seq,
      _hasArchive:    false,
      _hasSpareData:  true,
      _hasMachineData: true,
      _hasChatData:   true,
      _hasMetaData:   true,
      gsUrl:          db.gsUrl          || '',
      updatedAt:      new Date().toISOString()
    });
    // save doc แยก (best-effort)
    try { await FSdb.collection('appdata').doc('spare_data').set({ spareParts: db.spareParts||[], spareCatalogVersion: db.spareCatalogVersion||0, spareStock: db.spareStock||{}, stockMovements: db.stockMovements||[], updatedAt: new Date().toISOString() }); } catch(e) {}
    try { await FSdb.collection('appdata').doc('machine_data').set({ machines: db.machines||[], machineRequests: db.machineRequests||[], updatedAt: new Date().toISOString() }); } catch(e) {}
    try { await FSdb.collection('appdata').doc('chat_data').set({ chats: db.chats||{}, updatedAt: new Date().toISOString() }); } catch(e) {}
    try { await FSdb.collection('appdata').doc('meta_data').set({ notifications: (db.notifications||[]).slice(-200), calEvents: db.calEvents||[], deletedUserIds: db.deletedUserIds||[], updatedAt: new Date().toISOString() }); } catch(e) {}
    if (Object.keys(allSigs).length > 0) {
      // BUG FIX: appdata/signatures ต้องการ real user (custom token / LIFF)
      // ใช้ user.isAnonymous แทน providerData (custom token มี providerData = [] เหมือนกัน)
      const _fbUser = firebase.auth().currentUser;
      const _isRealUser = _fbUser && _fbUser.isAnonymous === false;
      if (_isRealUser) {
        if(window.bkCountWrite) window.bkCountWrite(1);
        await FSdb.collection('appdata').doc('signatures').set(allSigs);
      } else {
        try { localStorage.setItem('aircon_sigs_pending', JSON.stringify(allSigs)); } catch(e) {}
        console.info('[fsSaveNow] signatures skipped (anonymous user) — cached locally');
      }
    }
  } catch(e) { console.warn('fsSaveNow error:', e); }
  finally {
    setTimeout(() => {
      _fsSaving = false;
      // ── Pending Write Guard: unlock ทุก ticket หลัง Firestore confirm write ──
      // onSnapshot ที่ยิงหลังจากนี้จะ sync ได้ตามปกติ
      _pendingTicketIds.clear();
    }, 800); // FIX v23-track2: ลดจาก 3000→800ms ป้องกัน onSnapshot block นานเกิน
  }
}

// fire-and-forget save
let _fsSaveFailCount = 0;
// ── FIX v23-fix20: debounce fsSave 800ms ──
// fsSave() ถูกเรียกทุก action → batch writes ที่ยิงติดกัน
// ลด :commit requests จาก N ครั้งต่อ action เหลือ 1 ครั้งต่อ 800ms
let _fsSaveDebounceTimer = null;
const _FS_SAVE_DEBOUNCE_MS = 800;

function fsSave() {
  // ── Offline Queue: ถ้าไม่มีอินเทอร์เน็ต ให้เก็บใน queue ──
  if (!navigator.onLine) {
    if (typeof offlineEnqueue === 'function') offlineEnqueue('fsSave', {ts: new Date().toISOString()});
    return;
  }
  // ── Debounce: ยกเลิก timer เดิม แล้วเริ่มนับใหม่ ──
  // ถ้ามีการเรียก fsSave() ซ้ำภายใน 800ms → merge เป็น write เดียว
  if (_fsSaveDebounceTimer) {
    clearTimeout(_fsSaveDebounceTimer);
  }
  _fsSaveDebounceTimer = setTimeout(() => {
    _fsSaveDebounceTimer = null;
    fsSaveNow().then(() => {
      _fsSaveFailCount = 0;
      // ซ่อน Firebase-offline banner ถ้าแสดงอยู่
      const _fb = document.getElementById('_fb-offline-banner');
      if (_fb) _fb.remove();
    }).catch(e => {
      _fsSaveFailCount++;
      console.warn('[fsSave] fail #' + _fsSaveFailCount, e?.message || e);
      if (_fsSaveFailCount >= 3) {
        if (typeof showToast === 'function')
          showToast('⚠️ Firebase sync ล้มเหลว — ข้อมูลอยู่ใน local เท่านั้น');
        // แสดง persistent banner (ต่างจาก offline banner ปกติ — นี่คือ Firebase unreachable)
        if (!document.getElementById('_fb-offline-banner')) {
          const _b = document.createElement('div');
          _b.id = '_fb-offline-banner';
          _b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#92400e;color:white;font-size:0.72rem;font-weight:700;text-align:center;padding:6px 12px;display:flex;align-items:center;justify-content:center;gap:8px';
          _b.innerHTML = '⚠️ Cloud sync ขัดข้อง — ข้อมูลบันทึก local เท่านั้น <button onclick="this.parentElement.remove();if(typeof forceReloadFromFS===\'function\')forceReloadFromFS()" style="margin-left:8px;background:rgba(255,255,255,0.2);border:none;border-radius:4px;color:white;padding:2px 8px;cursor:pointer;font-size:0.7rem">🔄 ลองใหม่</button>';
          document.body.prepend(_b);
        }
        _fsSaveFailCount = 0;
      }
    });
  }, _FS_SAVE_DEBOUNCE_MS);
}

// ── Force reload จาก Firestore (ปุ่ม 🔄) ──
async function forceReloadFromFS() {
  const btn = document.getElementById('fs-sync-btn');
  if (btn) { btn.style.animation = 'spin 0.6s linear infinite'; btn.style.opacity='0.6'; }
  showToast('🔄 กำลังโหลดข้อมูล...');
  try {
    if (!_firebaseReady) initFirebase();
    const ok = await fsLoad();
    if (ok) {
      invalidateMacCache();
      refreshPage();
      updateOpenBadge();
      updateNBadge();
      // ── BUG FIX: populate เครื่อง/แผนกหลัง force reload ด้วย ──
      if (typeof populateMachineSelect === 'function') {
        populateMachineSelect._retryCount = 0;
        clearTimeout(populateMachineSelect._retryTimer);
        populateMachineSelect();
      }
      showToast('✅ โหลดข้อมูลล่าสุดแล้ว');
    } else {
      showToast('⚠️ ไม่สามารถเชื่อมต่อ Firebase');
    }
  } catch(e) {
    showToast('⚠️ Error: ' + e.message);
  } finally {
    if (btn) { btn.style.animation = ''; btn.style.opacity = '1'; }
  }
}

// realtime listener
async function fsListen() {
  if (!_firebaseReady || !FSdb) return;
  // รอ auth ก่อน attach listener — ป้องกัน permission-denied
  const authed = await _waitForAuth(8000);
  if (!authed) { console.warn('[fsListen] Auth timeout — skip listener'); return; }
  // FIX v23-fix14b: ถ้ายังไม่ login (ไม่มี CU) → ไม่ attach listener
  // เพราะ onSnapshot จะ trigger fsSave ซึ่งเขียน appdata/signatures ไม่ได้ → 403
  if (typeof CU === 'undefined' || !CU || !CU.id) {
    console.info('[fsListen] no app user yet — skip listener until login');
    return;
  }
  if (_fsListener) _fsListener();

  let _refreshTimer = null;

  _fsListener = FSdb.collection('appdata').doc('main').onSnapshot(snap => {
    if (!snap.exists || !CU) return;
    const data = snap.data();
    // FIX v34: ไม่ block onSnapshot ขณะ _fsSaving เพื่อป้องกันงานหายจาก device อื่น
    // เฉพาะ seq เท่ากัน (write ของตัวเอง) จึงจะ skip — ตรวจด้านล่างแล้ว
    const _onTrackingPage = document.querySelector('.page.active')?.id === 'pg-tracking';
    // ── BUG FIX (Bug 1 cross-device sync): ปรับ _seq check ──
    // เดิม: db._seq >= data._seq → skip ทั้งหมด
    // ปัญหา: อุปกรณ์ที่มี localStorage เก่า (_seq สูง) จะไม่รับ update จากอุปกรณ์อื่นเลย
    // แก้: skip เฉพาะเมื่อ _seq เท่ากัน (same write) หรือ local สูงกว่า remote มากเกิน 50
    //      ถ้า remote สูงกว่าหรือใกล้เคียง → ยังคง sync ปกติ
    const localSeq  = db._seq  || 0;
    const remoteSeq = data._seq || 0;
    // กัน onSnapshot ที่ยิงกลับมาจาก write ของตัวเอง (seq เท่ากัน)
    // FIX v23-track4: ถ้าอยู่หน้า tracking → refresh เสมอ แม้ seq เท่ากัน
    // เพราะ admin action (markPartArrived ฯลฯ) save เสร็จแล้วต้องเห็นผลทันที
    const _activePageId = document.querySelector('.page.active')?.id;
    if (remoteSeq > 0 && localSeq > 0 && localSeq === remoteSeq) {
      if (_activePageId === 'pg-tracking' && typeof renderTracking === 'function') {
        renderTracking();
      }
      return;
    }
    // กัน localStorage cache เก่ามากๆ ที่ _seq พุ่งสูงผิดปกติ (เช่น หลัง clear +100)
    // แต่ยังคง sync ถ้า remote ใหม่กว่า หรือ remote มีงานมากกว่า local (ป้องกันงานหาย)
    const _remoteTicketCount = Array.isArray(data.tickets) ? data.tickets.length : 0;
    const _localTicketCount  = Array.isArray(db.tickets)   ? db.tickets.length   : 0;
    if (localSeq > remoteSeq && (localSeq - remoteSeq) > 50 && _remoteTicketCount <= _localTicketCount) return;
    const DEMO_USERNAMES = ['somchai','somsak','malee','wichai'];
    const DEMO_IDS       = ['u2','u3','u4','u5'];
    const check = (key) => {
      let d = data[key];
      if (!d) return false;
      if (key === 'users' && Array.isArray(d)) {
        // ── sync deletedUserIds จาก remote ก่อน — ป้องกันมือถือที่มี blacklist เก่า ──
        if (Array.isArray(data.deletedUserIds) && data.deletedUserIds.length > 0) {
          const merged = new Set([...(db.deletedUserIds || []), ...data.deletedUserIds]);
          db.deletedUserIds = [...merged];
        }
        // deletedUserIds = blacklist ที่ admin ลบไปแล้ว ห้าม merge กลับ
        const deletedIds = new Set(db.deletedUserIds || []);
        const remoteUsers = d.filter(u =>
          !DEMO_USERNAMES.includes(u.username) &&
          !DEMO_IDS.includes(u.id) &&
          !deletedIds.has(u.id)   // ← กัน user ที่ลบแล้วกลับมา
        );
        const remoteIds = new Set(remoteUsers.map(u => u.id));
        const localOnly = (db.users||[]).filter(u =>
          !remoteIds.has(u.id) &&
          !DEMO_USERNAMES.includes(u.username) &&
          !DEMO_IDS.includes(u.id) &&
          !deletedIds.has(u.id)   // ← กัน user ที่ลบแล้วกลับมาจาก local ด้วย
        );
        const merged = [...remoteUsers, ...localOnly];
        const sig = a => a.map(u=>u.id).sort().join(',');
        if (sig(merged) === sig(db.users||[])) return false;
        db.users = merged;
        // ถ้า remote มี deletedUser อยู่ → force save เพื่อลบออกจาก Firestore ด้วย
        const remoteHasDeleted = d.some(u => deletedIds.has(u.id));
        // FIX v23-fix14b: save เฉพาะเมื่อมี app user (CU) เท่านั้น
        // ── FIX v23-fix21: ใช้ fsSave() แทน fsSaveNow() → ผ่าน debounce 800ms ──
        if ((localOnly.length > 0 || remoteHasDeleted) && typeof CU !== 'undefined' && CU && CU.id) fsSave();
        return true;
      }
      const localArr = db[key];
      if (Array.isArray(d) && Array.isArray(localArr)) {
        // deduplicate tickets by id before comparing
        if (key === 'tickets' && d.length > 0) {
          const seen = new Set();
          d = d.filter(t => { if (!t.id || seen.has(t.id)) return false; seen.add(t.id); return true; });
          // ── Pending Write Guard: อย่า overwrite ticket ที่ user เพิ่ง action แต่ยังรอ Firestore confirm ──
          // ป้องกัน race condition: fsSave debounce 800ms vs onSnapshot จากอุปกรณ์อื่น
          if (_pendingTicketIds.size > 0) {
            d = d.map(remote => {
              if (!_pendingTicketIds.has(remote.id)) return remote;
              // ใช้ local version แทน remote สำหรับ ticket ที่กำลัง pending
              const local = (db.tickets||[]).find(l => l.id === remote.id);
              return local || remote;
            });
          }
        }
        if (d.length !== localArr.length) { db[key] = d; return true; }
        // FIX: ใช้ sorted sig ป้องกัน false-match เมื่อ order ต่างกัน
        const sig = a => a.map(x => (x?.id||'') + ':' + (x?.updatedAt||x?.status||'')).sort().join(',');
        if (sig(d) !== sig(localArr)) { db[key] = d; return true; }
        return false;
      }
      if (JSON.stringify(localArr) !== JSON.stringify(d)) { db[key] = d; return true; }
      return false;
    };

    // ── FIX v6: chats/notifications/spare ย้ายไป doc แยกแล้ว ──
    // onSnapshot ของ appdata/main ไม่มี field เหล่านี้อีกต่อไป
    // ข้อมูลพวกนี้ sync ผ่าน fsLoad() เมื่อเปิดแอป
    const chatChanged = false;
    const notifChanged = false;

    // ── sync field ที่ยังอยู่ใน appdata/main ──
    if (data.gsUrl && data.gsUrl !== db.gsUrl) { db.gsUrl = data.gsUrl; console.info('[onSnapshot] gsUrl updated'); }
    if (Array.isArray(data.repairGroups) && data.repairGroups.length > 0 &&
        JSON.stringify(data.repairGroups) !== JSON.stringify(db.repairGroups||[])) {
      db.repairGroups = data.repairGroups;
      console.info('[onSnapshot] repairGroups updated:', data.repairGroups.length, 'groups');
    }
    if (data.pdfConfig && typeof data.pdfConfig === 'object' &&
        JSON.stringify(data.pdfConfig) !== JSON.stringify(db.pdfConfig||{})) {
      db.pdfConfig = data.pdfConfig;
    }

    // ── ตรวจสอบ role ของ CU ก่อน check('users') ──
    const _cuRoleBefore = CU ? CU.role : null;

    let changed = check('users') | check('machines') | check('tickets') | check('calEvents') | check('machineRequests');
    if (data._seq && data._seq !== db._seq) { db._seq = data._seq; changed = true; }

    // ── ถ้า role ของ CU เปลี่ยน (Admin สลับ Tech↔Reporter) → force re-init nav + page ──
    if (CU && _cuRoleBefore) {
      const freshCU = (db.users || []).find(u => u.id === CU.id);
      if (freshCU && freshCU.role !== _cuRoleBefore) {
        CU = freshCU;
        try {
          if (typeof setupBottomNav === 'function') setupBottomNav();
          if (typeof renderTopbarAvatar === 'function') renderTopbarAvatar();
          if (typeof renderSettingsPage === 'function') renderSettingsPage();
          const nextPage = CU.role === 'executive' ? 'executive' : 'home';
          if (typeof goPage === 'function') goPage(nextPage);
        } catch(e) { console.warn('[onSnapshot] role-change re-init error:', e); }
      } else if (freshCU) {
        CU = freshCU;
      }
    }

    if (chatChanged) {
      try {
        const chatSheet = document.getElementById('chat-sheet');
        if (_chatKey && chatSheet && chatSheet.classList.contains('visible')) renderChatMessages();
        if (_crCurrentKey) renderChatroomMessages();
        if (document.getElementById('pg-chatroom')?.classList.contains('active')) renderChatroomList();
        updateChatroomBadge();
        updateNBadge();
      } catch(e) {}
    }

    if (notifChanged) {
      try {
        updateNBadge();
        renderNotifPanel();
        const bell = document.getElementById('ntf-btn');
        if (bell) { bell.style.transform='scale(1.3)'; setTimeout(()=>bell.style.transform='',400); }
      } catch(e) {}
    }

    if (!changed && !chatChanged && !notifChanged) return;
    invalidateMacCache();
    invalidateTkCache();
    setTimeout(() => {
      try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch(e) {}
    }, 0);

    if (!changed) return;

    if (_refreshTimer) clearTimeout(_refreshTimer);
    _refreshTimer = setTimeout(() => {
      try {
        refreshPage();
        updateOpenBadge();
        updateNBadge();
        if (typeof populateMachineSelect === 'function') {
          populateMachineSelect._retryCount = 0;
          clearTimeout(populateMachineSelect._retryTimer);
          populateMachineSelect();
        }
        if (CU) {
          const unread = (db.notifications||[]).filter(n => n.userId === CU.id && !n.read).length;
          const ndot = document.getElementById('ndot');
          if (ndot) ndot.classList.toggle('on', unread > 0);
        }
      } catch(e) {}
    }, 200);
  }, err => console.warn('fsListen error:', err));
}

// ══════════════════════════════════════════════════════════════
// loadArchivedTickets — lazy load archived tickets on demand
// เรียกเฉพาะตอน user กด filter done/verified/closed/_done
// ══════════════════════════════════════════════════════════════
let _archiveLoading = false;

async function loadArchivedTickets() {
  // ถ้าโหลดไปแล้ว หรือไม่มี archive หรือกำลังโหลดอยู่ → skip
  if (!db._hasArchive || db._archiveLoaded || _archiveLoading) return;
  if (!_firebaseReady || !FSdb) return;

  _archiveLoading = true;
  console.log('[Archive] lazy loading archived tickets...');

  // แสดง loading indicator ถ้ามี ticket-list
  const tlEl = document.getElementById('ticket-list');
  if (tlEl && !tlEl.querySelector('.archive-loading')) {
    const loader = document.createElement('div');
    loader.className = 'archive-loading';
    loader.style.cssText = 'text-align:center;padding:16px;color:#6b7280;font-size:0.8rem';
    loader.innerHTML = '⏳ กำลังโหลดงานที่ปิดแล้ว...';
    tlEl.prepend(loader);
  }

  try {
    const archSnap = await FSdb.collection('appdata').doc('tickets_archive')
                                .collection('items').get();
    if(window.bkCountRead) window.bkCountRead(archSnap.size);

    if (!archSnap.empty) {
      const archiveIds = new Set((db.tickets||[]).map(t => t.id));
      let added = 0;
      archSnap.forEach(doc => {
        const t = doc.data();
        if (t && t.id && !archiveIds.has(t.id)) {
          db.tickets.push(t);
          archiveIds.add(t.id);
          added++;
        }
      });
      console.log('[Archive] loaded', added, 'archived tickets (total in snap:', archSnap.size, ')');
    }

    db._archiveLoaded = true;

    // re-render tickets หลังโหลดเสร็จ
    if (typeof renderTickets === 'function') renderTickets();

  } catch(e) {
    console.warn('[Archive] lazy load failed:', e);
    if (typeof showToast === 'function') showToast('⚠️ โหลดงานเก่าไม่ได้ กรุณาลองใหม่');
  } finally {
    _archiveLoading = false;
    // ลบ loading indicator
    document.querySelector('.archive-loading')?.remove();
  }
}

// expose ให้ใช้ได้จาก app-tickets.js
window.loadArchivedTickets = loadArchivedTickets;
