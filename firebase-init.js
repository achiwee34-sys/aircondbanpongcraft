// ── Firebase Setup ─────────────────────────────────────────
let FSdb = null, _firebaseReady = false, _fsListener = null;
let _fsSaving = false;
let _fsChatSaving = false;

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
async function _waitForAuth(maxMs = 5000) {
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
    _firebaseReady = true;
    if (firebase.auth) {
      firebase.auth().onAuthStateChanged(user => {
        if (user) {
          // รับทั้ง custom token (LIFF) และ anonymous (PC fallback)
          _firebaseAuthReady = true;
          console.info('[Firebase] auth ready | anonymous:', user.isAnonymous);
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

// โหลดข้อมูลจาก Firestore → เขียนทับ db local
async function fsLoad() {
  if (!_firebaseReady || !FSdb) return false;
  // รอ Anonymous Auth ก่อน — ถ้า auth ยังไม่พร้อม Firestore จะ reject ด้วย permission-denied
  const authed = await _waitForAuth(8000);
  if (!authed) { console.warn('[fsLoad] Auth timeout — skip load'); return false; }
  const DEMO_USERNAMES = ['somchai','somsak','malee','wichai'];
  const DEMO_IDS       = ['u2','u3','u4','u5'];
  try {
    const snap = await FSdb.collection('appdata').doc('main').get(); if(window.bkCountRead) window.bkCountRead(1);
    if (snap.exists) {
      const data = snap.data();
      if (typeof syncDocVersion === 'function') syncDocVersion(data);

      // โหลด deletedUserIds blacklist ก่อน — ใช้ตอน merge users
      if (Array.isArray(data.deletedUserIds)) {
        const existing = new Set(db.deletedUserIds || []);
        data.deletedUserIds.forEach(id => existing.add(id));
        db.deletedUserIds = [...existing];
      }
      const deletedIds = new Set(db.deletedUserIds || []);

      // ── users: MERGE ไม่ทับ — local users ใหม่ที่ยังไม่ sync ต้องอยู่รอด ──
      if (Array.isArray(data.users) && data.users.length) {
        const remoteUsers = data.users.filter(u =>
          !DEMO_USERNAMES.includes(u.username) &&
          !DEMO_IDS.includes(u.id) &&
          !deletedIds.has(u.id)    // ← กัน user ที่ลบแล้วกลับมา
        );
        const remoteIds = new Set(remoteUsers.map(u => u.id));
        const localOnlyUsers = (db.users||[]).filter(u =>
          !remoteIds.has(u.id) &&
          !DEMO_USERNAMES.includes(u.username) &&
          !DEMO_IDS.includes(u.id) &&
          !deletedIds.has(u.id)    // ← กัน local ด้วย
        );
        db.users = [...remoteUsers, ...localOnlyUsers];
        if (localOnlyUsers.length > 0) {
          fsSaveNow().catch(() => {});
        }
      }

      if (Array.isArray(data.machines) && data.machines.length) {
        db.machines = data.machines;
        // ── BUG FIX: trigger populateMachineSelect ทันทีหลัง fsLoad โหลด machines สำเร็จ
        // ป้องกัน race condition ที่อุปกรณ์ใหม่ไม่มี localStorage cache แล้ว
        // populateMachineSelect() retry หมดก่อน Firebase ตอบกลับ ──
        setTimeout(() => {
          if (typeof populateMachineSelect === 'function') {
            populateMachineSelect._retryCount = 0;
            clearTimeout(populateMachineSelect._retryTimer);
            populateMachineSelect();
          }
        }, 0);
      }
      if (Array.isArray(data.tickets))                          db.tickets  = data.tickets;
      if (Array.isArray(data.calEvents))                        db.calEvents = data.calEvents;
      if (data.chats)                                           db.chats    = data.chats;
      if (data._seq)                                            db._seq     = data._seq;
      if (data.gsUrl)                                           db.gsUrl    = data.gsUrl;

      try {
        const sigSnap = await FSdb.collection('appdata').doc('signatures').get(); if(window.bkCountRead) window.bkCountRead(1);
        if (sigSnap.exists) {
          const allSigs = sigSnap.data();
          db.tickets.forEach(t => { if (allSigs[t.id]) t.signatures = allSigs[t.id]; });
          try { localStorage.setItem('aircon_sigs', JSON.stringify(allSigs)); } catch(e) {}
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
  _fsChatSaving = true;
  try {
    if(window.bkCountWrite) window.bkCountWrite(1); await FSdb.collection('appdata').doc('main').update({
      chats: db.chats || {},
      updatedAt: new Date().toISOString()
    });
  } catch(e) {
    try { await fsSaveNow(); } catch(e2) {}
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
  const _authed = await _waitForAuth();
  if (!_authed) { console.warn("[fsSaveNow] auth not ready"); return; }
  _fsSaving = true;
  // ── increment _seq ก่อน write เสมอ → ป้องกัน onSnapshot restore ข้อมูลที่เพิ่งลบ ──
  db._seq = (db._seq || 0) + 1;
  try {
    const ticketsNoSig = (db.tickets||[]).map(t => {
      if (!t.signatures) return t;
      const { signatures, ...rest } = t;
      return rest;
    });
    const allSigs = {};
    (db.tickets||[]).forEach(t => {
      if (t.signatures && Object.keys(t.signatures).length > 0) {
        allSigs[t.id] = t.signatures;
      }
    });
    if(window.bkCountWrite) window.bkCountWrite(1); await FSdb.collection('appdata').doc('main').set({
      users:           db.users           || [],
      machines:        db.machines        || [],
      tickets:         ticketsNoSig,
      calEvents:       db.calEvents       || [],
      chats:           db.chats           || {},
      machineRequests: db.machineRequests || [],
      notifications:   db.notifications   || [],   // ← BUG FIX: ขาดไปเหมือน conflict-guard.js
      deletedUserIds:  db.deletedUserIds  || [],
      _seq:            db._seq,
      gsUrl:           db.gsUrl           || '',
      updatedAt:       new Date().toISOString()
    });
    if (Object.keys(allSigs).length > 0) {
      if(window.bkCountWrite) window.bkCountWrite(1); await FSdb.collection('appdata').doc('signatures').set(allSigs);
    }
  } catch(e) { console.warn('fsSaveNow error:', e); }
  finally { setTimeout(() => { _fsSaving = false; }, 3000); }
}

// fire-and-forget save
let _fsSaveFailCount = 0;
function fsSave() {
  // ── Offline Queue: ถ้าไม่มีอินเทอร์เน็ต ให้เก็บใน queue ──
  if (!navigator.onLine) {
    if (typeof offlineEnqueue === 'function') offlineEnqueue('fsSave', {ts: new Date().toISOString()});
    return;
  }
  fsSaveNow().then(() => {
    _fsSaveFailCount = 0; // reset เมื่อสำเร็จ
  }).catch(e => {
    _fsSaveFailCount++;
    console.warn('[fsSave] fail #' + _fsSaveFailCount, e?.message || e);
    if (_fsSaveFailCount >= 3 && typeof showToast === 'function') {
      showToast('⚠️ Firebase sync ล้มเหลว — ข้อมูลอยู่ใน local เท่านั้น');
      _fsSaveFailCount = 0; // reset หลังแจ้งแล้ว
    }
  });
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
  if (_fsListener) _fsListener();

  let _refreshTimer = null;

  _fsListener = FSdb.collection('appdata').doc('main').onSnapshot(snap => {
    if (!snap.exists || !CU) return;
    const data = snap.data();
    if (_fsSaving && !_fsChatSaving) return;
    // ── ถ้า local _seq ใหม่กว่าหรือเท่ากับ remote → remote เป็นข้อมูลเก่า ข้ามทั้งหมด ──
    // (ป้องกัน onSnapshot ที่ยิงกลับมาหลัง delete restore ข้อมูลที่เพิ่งลบ)
    if (data._seq && db._seq && db._seq >= data._seq) return;
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
        if (localOnly.length > 0 || remoteHasDeleted) fsSaveNow().catch(()=>{});
        return true;
      }
      const localArr = db[key];
      if (Array.isArray(d) && Array.isArray(localArr)) {
        // deduplicate tickets by id before comparing
        if (key === 'tickets' && d.length > 0) {
          const seen = new Set();
          d = d.filter(t => { if (!t.id || seen.has(t.id)) return false; seen.add(t.id); return true; });
        }
        if (d.length !== localArr.length) { db[key] = d; return true; }
        const sig = a => a.length + '|' + a.map(x => (x?.updatedAt||x?.id||'')).join(',');
        if (sig(d) !== sig(localArr)) { db[key] = d; return true; }
        return false;
      }
      if (JSON.stringify(localArr) !== JSON.stringify(d)) { db[key] = d; return true; }
      return false;
    };

    const chatChanged = (() => {
      const newChats = data.chats;
      if (!newChats) return false;
      const oldSig = Object.entries(db.chats||{}).map(([k,v])=>k+':'+(v?.length||0)).join('|');
      const newSig = Object.entries(newChats).map(([k,v])=>k+':'+(v?.length||0)).join('|');
      if (oldSig === newSig) return false;
      db.chats = newChats;
      return true;
    })();

    const notifChanged = (() => {
      const newNotifs = data.notifications;
      if (!Array.isArray(newNotifs)) return false;
      const myOld = (db.notifications||[]).filter(n=>n.userId===CU?.id).length;
      const myNew = newNotifs.filter(n=>n.userId===CU?.id).length;
      if (myOld === myNew) return false;
      db.notifications = newNotifs;
      return true;
    })();

    // ── sync gsUrl ทุกครั้งที่ onSnapshot ยิง (ป้องกัน Reporter ได้ db.gsUrl='' เพราะ cache เก่า) ──
    if (data.gsUrl && data.gsUrl !== db.gsUrl) { db.gsUrl = data.gsUrl; console.info('[onSnapshot] gsUrl updated'); }

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
