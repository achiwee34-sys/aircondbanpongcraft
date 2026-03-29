// ── Firebase Setup ─────────────────────────────────────────
let FSdb = null, _firebaseReady = false, _fsListener = null;

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

      // ── users: MERGE ไม่ทับ — local users ใหม่ที่ยังไม่ sync ต้องอยู่รอด ──
      if (Array.isArray(data.users) && data.users.length) {
        const remoteUsers = data.users.filter(u =>
          !DEMO_USERNAMES.includes(u.username) && !DEMO_IDS.includes(u.id)
        );
        const remoteIds = new Set(remoteUsers.map(u => u.id));
        // เก็บ local users ที่ยังไม่มีใน Firebase (เพิ่งสมัคร ยังไม่ sync)
        const localOnlyUsers = (db.users||[]).filter(u =>
          !remoteIds.has(u.id) &&
          !DEMO_USERNAMES.includes(u.username) &&
          !DEMO_IDS.includes(u.id)
        );
        db.users = [...remoteUsers, ...localOnlyUsers];
        // ถ้ามี local-only users → sync ขึ้น Firebase ทันที
        if (localOnlyUsers.length > 0) {
          console.log('fsLoad: syncing', localOnlyUsers.length, 'local-only users to Firebase');
          fsSaveNow().catch(() => {});
        }
      }

      if (Array.isArray(data.machines) && data.machines.length) db.machines = data.machines;
      if (Array.isArray(data.tickets))                          db.tickets  = data.tickets;
      if (Array.isArray(data.calEvents))                        db.calEvents = data.calEvents;
      if (data.chats)                                           db.chats    = data.chats;
      if (data._seq)                                            db._seq     = data._seq;
      // merge signatures กลับเข้า tickets
      try {
        const sigSnap = await FSdb.collection('appdata').doc('signatures').get();
        if (sigSnap.exists) {
          const allSigs = sigSnap.data();
          db.tickets.forEach(t => {
            if (allSigs[t.id]) t.signatures = allSigs[t.id];
          });
          // update local sig cache from Firebase
          try { localStorage.setItem('aircon_sigs', JSON.stringify(allSigs)); } catch(e) {}
        }
      } catch(e) {
        // Firebase ไม่พร้อม — ดึง signatures จาก local cache แทน
        try {
          const sigCache = JSON.parse(localStorage.getItem('aircon_sigs') || '{}');
          db.tickets.forEach(t => { if (sigCache[t.id]) t.signatures = sigCache[t.id]; });
        } catch(e2) {}
      }
      // strip signatures ออกก่อน save localStorage (ประหยัด quota)
      const dbForLocal = {...db, tickets: (db.tickets||[]).map(t=>{
        if(!t.signatures) return t;
        const {signatures:_s,...rest}=t; return rest;
      })};
      localStorage.setItem(DB_KEY, JSON.stringify(dbForLocal));
      return true;
    } else {
      // Firebase doc ยังไม่มี → upload local data ขึ้นไปเลย
      await fsSaveNow();
      return true;
    }
  } catch(e) { console.warn('fsLoad error:', e); return false; }
}

// บันทึกขึ้น Firestore ทันที (await ได้)
let _fsSaving = false;
let _fsChatSaving = false; // flag แยกสำหรับ chat save

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
    // ถ้า update ไม่ได้ (doc ยังไม่มี) fallback ไป set
    try { await fsSaveNow(); } catch(e2) {}
  } finally {
    _fsChatSaving = false;
  }
}

async function fsSaveNow() {
  if (!_firebaseReady || !FSdb) return;
  _fsSaving = true;
  try {
    // strip signatures ออกจาก tickets เพื่อลดขนาด document หลัก
    // signatures จะถูก save แยกใน doc 'signatures'
    const ticketsNoSig = (db.tickets||[]).map(t => {
      if (!t.signatures) return t;
      const { signatures, ...rest } = t;
      return rest;
    });
    // รวม signatures ทั้งหมดไว้ใน map tid → signatures
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
    // save signatures แยก (ถ้ามี)
    if (Object.keys(allSigs).length > 0) {
      await FSdb.collection('appdata').doc('signatures').set(allSigs);
    }
  } catch(e) { console.warn('fsSaveNow error:', e); }
  finally { setTimeout(() => { _fsSaving = false; }, 500); } // ลดจาก 1500 → 500ms
}

// fire-and-forget save
function fsSave() { fsSaveNow().catch(()=>{}); }

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
  if (_fsListener) _fsListener(); // unsubscribe เดิม

  let _refreshTimer = null; // debounce timer สำหรับ refresh

  _fsListener = FSdb.collection('appdata').doc('main').onSnapshot(snap => {
    if (!snap.exists || !CU) return;
    const data = snap.data();
    if (_fsSaving && !_fsChatSaving) return; // block เฉพาะ full save ไม่ใช่ chat save
    const DEMO_USERNAMES = ['somchai','somsak','malee','wichai'];
    const DEMO_IDS       = ['u2','u3','u4','u5'];
    const check = (key) => {
      let d = data[key];
      if (!d) return false;
      if (key === 'users' && Array.isArray(d)) {
        const remoteUsers = d.filter(u => !DEMO_USERNAMES.includes(u.username) && !DEMO_IDS.includes(u.id));
        const remoteIds = new Set(remoteUsers.map(u => u.id));
        // เก็บ local users ที่ยังไม่มีใน Firebase snapshot
        const localOnly = (db.users||[]).filter(u =>
          !remoteIds.has(u.id) &&
          !DEMO_USERNAMES.includes(u.username) &&
          !DEMO_IDS.includes(u.id)
        );
        const merged = [...remoteUsers, ...localOnly];
        const sig = a => a.map(u=>u.id).sort().join(',');
        if (sig(merged) === sig(db.users||[])) return false;
        db.users = merged;
        // sync local-only users ขึ้น Firebase
        if (localOnly.length > 0) fsSaveNow().catch(()=>{});
        return true;
      }
      const localArr = db[key];
      if (Array.isArray(d) && Array.isArray(localArr)) {
        if (d.length !== localArr.length) { db[key] = d; return true; }
        const sig = a => (a[0]?.updatedAt||a[0]?.id||'') + (a[a.length-1]?.updatedAt||a[a.length-1]?.id||'');
        if (sig(d) !== sig(localArr)) { db[key] = d; return true; }
        return false;
      }
      if (JSON.stringify(localArr) !== JSON.stringify(d)) { db[key] = d; return true; }
      return false;
    };

    // ── ตรวจ chats แยก — render ทันทีไม่ debounce ──
    const chatChanged = (() => {
      const newChats = data.chats;
      if (!newChats) return false;
      const oldSig = Object.entries(db.chats||{}).map(([k,v])=>k+':'+(v?.length||0)).join('|');
      const newSig = Object.entries(newChats).map(([k,v])=>k+':'+(v?.length||0)).join('|');
      if (oldSig === newSig) return false;
      db.chats = newChats;
      return true;
    })();

    // ── ตรวจ notifications แยก — update badge ทันที ──
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

    // แชทเปลี่ยน → render ทันที
    if (chatChanged) {
      try {
        const chatSheet = document.getElementById('chat-sheet');
        if (_chatKey && chatSheet && chatSheet.classList.contains('visible')) {
          renderChatMessages();
        }
        // update chatroom realtime
        if (_crCurrentKey) renderChatroomMessages();
        if (document.getElementById('pg-chatroom')?.classList.contains('active')) { renderChatroomList(); }
        updateChatroomBadge();
        updateNBadge();
      } catch(e) {}
    }

    // notification ใหม่ → flash bell ทันที
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

    if (!changed) return; // แค่ chat/notif เปลี่ยน ไม่ต้อง refresh page

    // ── debounce refreshPage 200ms ──
    if (_refreshTimer) clearTimeout(_refreshTimer);
    _refreshTimer = setTimeout(() => {
      try {
        refreshPage();
        updateOpenBadge();
        updateNBadge();
        if (CU) {
          const unread = (db.notifications||[]).filter(n => n.userId === CU.id && !n.read).length;
          const ndot = document.getElementById('ndot');
          if (ndot) ndot.classList.toggle('on', unread > 0);
        }
      } catch(e) {}
    }, 200);
  }, err => console.warn('fsListen error:', err));
}
