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

function initFirebase() {
  try {
    if (typeof firebase === 'undefined') return;
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    FSdb = firebase.firestore();
    _firebaseReady = true;
    // ── PATCH v67: init Firebase Storage ──
    if (typeof initStorage === 'function') initStorage();
  } catch(e) { console.warn('Firebase init error:', e); }
}

// โหลดข้อมูลจาก Firestore → เขียนทับ db local
async function fsLoad() {
  if (!_firebaseReady || !FSdb) return false;
  const DEMO_USERNAMES = ['somchai','somsak','malee','wichai'];
  const DEMO_IDS       = ['u2','u3','u4','u5'];
  try {
    const snap = await FSdb.collection('appdata').doc('main').get();
    if (snap.exists) {
      const data = snap.data();
      // ── PATCH v67: sync _docVersion สำหรับ optimistic locking ──
      if (typeof syncDocVersion === 'function') syncDocVersion(data);

      // ── users: MERGE ไม่ทับ — local users ใหม่ที่ยังไม่ sync ต้องอยู่รอด ──
      if (Array.isArray(data.users) && data.users.length) {
        const remoteUsers = data.users.filter(u =>
          !DEMO_USERNAMES.includes(u.username) && !DEMO_IDS.includes(u.id)
        );
        const remoteIds = new Set(remoteUsers.map(u => u.id));
        const localOnlyUsers = (db.users||[]).filter(u =>
          !remoteIds.has(u.id) &&
          !DEMO_USERNAMES.includes(u.username) &&
          !DEMO_IDS.includes(u.id)
        );
        db.users = [...remoteUsers, ...localOnlyUsers];
        if (localOnlyUsers.length > 0) {
          fsSaveNow().catch(() => {});
        }
      }

      if (Array.isArray(data.machines) && data.machines.length) db.machines = data.machines;
      if (Array.isArray(data.tickets))                          db.tickets  = data.tickets;
      if (Array.isArray(data.calEvents))                        db.calEvents = data.calEvents;
      if (data.chats)                                           db.chats    = data.chats;
      if (data._seq)                                            db._seq     = data._seq;

      try {
        const sigSnap = await FSdb.collection('appdata').doc('signatures').get();
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
  _fsChatSaving = true;
  try {
    await FSdb.collection('appdata').doc('main').update({
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
  _fsSaving = true;
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
    await FSdb.collection('appdata').doc('main').set({
      users:           db.users           || [],
      machines:        db.machines        || [],
      tickets:         ticketsNoSig,
      calEvents:       db.calEvents       || [],
      chats:           db.chats           || {},
      machineRequests: db.machineRequests || [],
      _seq:            db._seq            || 1,
      updatedAt:       new Date().toISOString()
    });
    if (Object.keys(allSigs).length > 0) {
      await FSdb.collection('appdata').doc('signatures').set(allSigs);
    }
  } catch(e) { console.warn('fsSaveNow error:', e); }
  finally { setTimeout(() => { _fsSaving = false; }, 500); }
}

// fire-and-forget save
// ── PATCH audit-H1: แจ้งผู้ใช้เมื่อ Firebase sync ล้มเหลวต่อเนื่อง ──
let _fsSaveFailCount = 0;
function fsSave() {
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
function fsListen() {
  if (!_firebaseReady || !FSdb) return;
  if (_fsListener) _fsListener();

  let _refreshTimer = null;

  _fsListener = FSdb.collection('appdata').doc('main').onSnapshot(snap => {
    if (!snap.exists || !CU) return;
    const data = snap.data();
    if (_fsSaving && !_fsChatSaving) return;
    const DEMO_USERNAMES = ['somchai','somsak','malee','wichai'];
    const DEMO_IDS       = ['u2','u3','u4','u5'];
    const check = (key) => {
      let d = data[key];
      if (!d) return false;
      if (key === 'users' && Array.isArray(d)) {
        const remoteUsers = d.filter(u => !DEMO_USERNAMES.includes(u.username) && !DEMO_IDS.includes(u.id));
        const remoteIds = new Set(remoteUsers.map(u => u.id));
        const localOnly = (db.users||[]).filter(u =>
          !remoteIds.has(u.id) &&
          !DEMO_USERNAMES.includes(u.username) &&
          !DEMO_IDS.includes(u.id)
        );
        const merged = [...remoteUsers, ...localOnly];
        const sig = a => a.map(u=>u.id).sort().join(',');
        if (sig(merged) === sig(db.users||[])) return false;
        db.users = merged;
        if (localOnly.length > 0) fsSaveNow().catch(()=>{});
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

    let changed = check('users') | check('machines') | check('tickets') | check('calEvents') | check('machineRequests');
    if (data._seq && data._seq !== db._seq) { db._seq = data._seq; changed = true; }

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
        // ── PATCH: refresh dropdown แผนก เมื่อข้อมูล machines เปลี่ยนจาก Firebase ──
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
