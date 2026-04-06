// ============================================================
// i18n — ต้องอยู่ก่อนสุดเพื่อให้ทุก script ใช้ได้
// ============================================================
let _lang = (typeof localStorage !== 'undefined' && localStorage.getItem('aircon_lang')) || 'TH';

const I18N = {
  TH: {},
  EN: {
    'ใหม่':'New','จ่ายแล้ว':'Assigned','รับแล้ว':'Accepted',
    'กำลังซ่อม':'In Progress','รออะไหล่':'Waiting Part',
    'เสร็จแล้ว':'Done','ตรวจรับ':'Verified','ปิดงาน':'Closed',
    'ด่วนมาก':'Urgent','ปานกลาง':'Normal','ไม่เร่งด่วน':'Low',
    'หน้าแรก':'Home','รายการ':'Tickets','เครื่องแอร์':'Machines',
    'ผู้ใช้':'Users','รายงาน':'Report','สั่งซื้อ':'Purchase',
    'ตั้งค่า':'Settings','แจ้งซ่อม':'New Job','ปฏิทิน':'Calendar',
    'ติดตาม':'Tracking','งานฉัน':'My Work',
  }
};

function t(key) {
  if (_lang === 'TH') return key;
  return (I18N.EN[key]) || key;
}

// ============================================================
// DATABASE
// ============================================================
const DB_KEY = 'airtrack_pwa';
const APP_VER = 'v20260406_88';
const FUNC_LOC = window._FUNC_LOC_DATA || {};
// ── FUNC_LOC โหลดจาก func-loc-data.js (แยกไฟล์เพื่อลดขนาด app-core.js) ──
 // bump this to force reset
const VER_KEY = 'airtrack_ver';
const SIGS_KEY    = 'aircon_sigs';
const SESSION_KEY = 'aircon_session';
const PDF_CFG_KEY_NAME = 'aircon_pdf_cfg';

// Auto-reset if version changed (new features require fresh schema)
if (localStorage.getItem(VER_KEY) !== APP_VER) {
  // ── บันทึก users + tickets + chats จาก old DB ไว้ก่อน ──
  let oldDB = null;
  try { oldDB = JSON.parse(localStorage.getItem(DB_KEY)); } catch(e){}
  localStorage.removeItem(DB_KEY);
  localStorage.setItem(VER_KEY, APP_VER);
  // ── restore ข้อมูลสำคัญ (users, tickets, chats) ──
  if (oldDB) {
    const preserved = {};
    // เก็บ users ที่ไม่ใช่ demo
    const DEMO_IDS = ['u2','u3','u4','u5'];
    const DEMO_UNAMES = ['somchai','somsak','malee','wichai'];
    if (Array.isArray(oldDB.users)) {
      preserved.users = oldDB.users.filter(u =>
        !DEMO_IDS.includes(u.id) && !DEMO_UNAMES.includes(u.username)
      );
    }
    // เก็บ tickets ที่ไม่ใช่ demo
    if (Array.isArray(oldDB.tickets)) {
      preserved.tickets = oldDB.tickets.filter(t => !t.id?.startsWith('TK032026'));
    }
    // เก็บ chats
    if (oldDB.chats) preserved.chats = oldDB.chats;
    // เก็บ machines
    if (Array.isArray(oldDB.machines) && oldDB.machines.length > 0) preserved.machines = oldDB.machines;
    // เก็บ calEvents
    if (Array.isArray(oldDB.calEvents)) preserved.calEvents = oldDB.calEvents;
    // บันทึกลง localStorage ชั่วคราว ให้ initDB + merge ทีหลัง
    if (Object.keys(preserved).length > 0) {
      localStorage.setItem('aircon_preserved_' + APP_VER, JSON.stringify(preserved));
    }
  }
}

let db;
try {
  db = JSON.parse(localStorage.getItem(DB_KEY) || 'null') || initDB();
} catch(e) {
  console.error('[DB] localStorage corrupted, resetting:', e.message);
  try { localStorage.removeItem(DB_KEY); } catch(_) {}
  db = initDB();
  setTimeout(() => {
    if (typeof showToast === 'function')
      showToast('⚠️ ข้อมูล local เสียหาย — รีเซ็ตแล้ว กรุณา Sync จาก Firebase');
  }, 2000);
}

// ── Deduplicate tickets on load (ป้องกัน Firebase sync ทำให้ซ้ำ) ──
if (db && Array.isArray(db.tickets) && db.tickets.length > 0) {
  const seen = new Set();
  db.tickets = db.tickets.filter(t => {
    if (!t.id || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

// ── Ensure default system users always exist (ป้องกัน executive/admin หาย) ──
// SECURITY: ไม่ฝัง password hash ใน source code — ใช้ SETUP_REQUIRED sentinel แทน
// ผู้ใช้ใหม่จะต้องตั้ง password ครั้งแรกก่อน login ได้
(function() {
  const DEFAULT_USERS = [
    {id:'u1',name:'ผู้ดูแลระบบ',username:'admin',password:'__SETUP_REQUIRED__',role:'admin',dept:'IT',tel:'',contact:''},
    {id:'u6',name:'นายสมหมาย ผู้จัดการ',username:'manager',password:'__SETUP_REQUIRED__',role:'executive',dept:'ฝ่ายบริหาร',tel:'',contact:''},
  ];
  if (!db.users) db.users = [];
  let changed = false;
  DEFAULT_USERS.forEach(du => {
    const existing = db.users.find(u => u.id === du.id || u.username === du.username);
    // เพิ่มเฉพาะถ้าไม่มีเลย — ไม่ทับ password ที่ตั้งแล้ว
    if (!existing) { db.users.push(du); changed = true; }
    else if (existing.role !== du.role) { existing.role = du.role; changed = true; }
  });
  if (changed) try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch(e) {}
})();


(function() {
  const preservedKey = 'aircon_preserved_' + APP_VER;
  const preservedRaw = localStorage.getItem(preservedKey);
  if (!preservedRaw) return;
  try {
    const preserved = JSON.parse(preservedRaw);
    let changed = false;
    // merge users (ไม่ทับ users เดิมที่มีอยู่)
    if (Array.isArray(preserved.users) && preserved.users.length > 0) {
      const existingIds = new Set((db.users||[]).map(u => u.id));
      const toAdd = preserved.users.filter(u => !existingIds.has(u.id));
      if (toAdd.length > 0) { db.users = [...(db.users||[]), ...toAdd]; changed = true; }
    }
    // merge tickets
    if (Array.isArray(preserved.tickets) && preserved.tickets.length > 0) {
      const existingTids = new Set((db.tickets||[]).map(t => t.id));
      const toAdd = preserved.tickets.filter(t => !existingTids.has(t.id));
      if (toAdd.length > 0) { db.tickets = [...(db.tickets||[]), ...toAdd]; changed = true; }
    }
    // merge chats
    if (preserved.chats && typeof preserved.chats === 'object') {
      db.chats = Object.assign({}, preserved.chats, db.chats||{});
      changed = true;
    }
    // merge machines
    if (Array.isArray(preserved.machines) && preserved.machines.length > 0) {
      const existingMids = new Set((db.machines||[]).map(m => m.id));
      const toAdd = preserved.machines.filter(m => !existingMids.has(m.id));
      if (toAdd.length > 0) { db.machines = [...(db.machines||[]), ...toAdd]; changed = true; }
    }
    // merge calEvents
    if (Array.isArray(preserved.calEvents) && preserved.calEvents.length > 0) {
      const existingEvIds = new Set((db.calEvents||[]).map(e => e.id));
      const toAdd = preserved.calEvents.filter(e => !existingEvIds.has(e.id));
      if (toAdd.length > 0) { db.calEvents = [...(db.calEvents||[]), ...toAdd]; changed = true; }
    }
    if (changed) {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    // ลบ preserved key หลัง restore สำเร็จ
    localStorage.removeItem(preservedKey);
  } catch(e) { console.warn('restore preserved failed:', e); }
})();
// ── Auto-migrate: TPL → TPC ──
if (db.machines) {
  let migrated = 0;
  db.machines.forEach(m => { if (m.vendor === 'TPL') { m.vendor = 'TPC'; migrated++; } });
  if (migrated > 0) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
}

(function ensureDBDefaults() {
  if (!db.calEvents) db.calEvents = [];
  if (!db.chats)     db.chats     = {};
  if (!db.machines)  db.machines  = [];
  if (!db.users)     db.users     = [];
  if (!db.tickets)   db.tickets   = [];
  // backfill addedAt
  const _d = new Date(); _d.setDate(_d.getDate() - 30);
  db.machines.forEach(m => { if (!m.addedAt) m.addedAt = _d.toISOString(); });
})();

// machines.json ถูกลบออกแล้ว — ข้อมูลเครื่องโหลดจาก Firebase (fsLoad) อย่างเดียว
// ฟังก์ชันนี้เหลือไว้เพื่อ backward compat (ไม่ crash ถ้ายังมีที่เรียก)
async function loadMachinesData() {
  // no-op: Firebase เป็น source of truth สำหรับ machines
}

function initDB() {
  return {
    users: [
      // SECURITY: ไม่ฝัง password ใน source — ต้องตั้ง password ครั้งแรกผ่าน UI
      {id:'u1',name:'ผู้ดูแลระบบ',username:'admin',password:'__SETUP_REQUIRED__',role:'admin',dept:'IT',tel:'',contact:''},
      {id:'u6',name:'นายสมหมาย ผู้จัดการ',username:'manager',password:'__SETUP_REQUIRED__',role:'executive',dept:'ฝ่ายบริหาร',tel:'',contact:''},
    ],
    machines: [
    ],  // PATCH: โหลดจาก machines.json แทน (ดู loadMachinesData())
    calEvents: [],
    chats: {},
    vendors: [],
    tickets: [],
    _seq: 1,
    notifications: [],
    gsUrl: '',
    lineNotify: { tokenAdmin:'', tokenTech:'', evNew:true, evAccept:true, evDone:true },
  };
}
function saveDB() {
  invalidateMacCache();
  invalidateTkCache();
  setTimeout(() => {
    try {
      // strip signatures ออกก่อน save localStorage
      const dbForLocal = {...db, tickets: (db.tickets||[]).map(t=>{
        if(!t.signatures) return t;
        const {signatures:_s,...rest}=t; return rest;
      })};
      const json = JSON.stringify(dbForLocal);
      if (json.length > 4_000_000) {
        console.warn('[DB] Storage nearing limit:', (json.length/1024/1024).toFixed(1)+'MB');
        if (typeof showToast === 'function')
          showToast('⚠️ พื้นที่จัดเก็บใกล้เต็ม กรุณา Backup & ล้างข้อมูลเก่า');
      }
      localStorage.setItem(DB_KEY, json);
    } catch(e) {
      if (e && e.name === 'QuotaExceededError') {
        console.error('[DB] localStorage FULL!');
        if (typeof showToast === 'function')
          showToast('❌ พื้นที่เต็ม! กรุณากด Backup แล้วล้างข้อมูลเก่า');
      } else {
        console.error('[DB] saveDB error:', e);
      }
    }
  }, 0);
  if (typeof fsSave === 'function') fsSave();
}
// ============================================================
// SECURITY — Password Hashing (SHA-256 via WebCrypto)
// ============================================================
const HASH_PREFIX = 'sha256:';

async function hashPassword(plain) {
  try {
    const buf = await crypto.subtle.digest(
      'SHA-256', new TextEncoder().encode(plain)
    );
    return HASH_PREFIX + Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2,'0')).join('');
  } catch(e) {
    console.warn('[Auth] WebCrypto unavailable:', e);
    return plain; // fallback safe
  }
}

async function verifyPassword(plain, stored) {
  if (!stored) return false;
  try {
    if (stored.startsWith(HASH_PREFIX)) {
      const h = await hashPassword(plain);
      return h === stored;
    }
    // plain text เก่า: ตรง = true แล้ว migrate ต่อ
    return plain === stored;
  } catch(e) {
    // SECURITY FIX (audit #2): ไม่ fallback plain compare — ถ้า WebCrypto ล้มเหลวให้ปฏิเสธ login
    console.error('[verifyPassword] WebCrypto error — login rejected for security:', e.message);
    return false;
  }
}

// migrate plain text → SHA-256 โดยอัตโนมัติหลัง login สำเร็จ
async function migratePasswordIfNeeded(user, plainPass) {
  if (!user.password || user.password.startsWith(HASH_PREFIX)) return;
  try {
    user.password = await hashPassword(plainPass);
    saveDB();
  } catch(e) {
    console.warn('[migratePassword] WebCrypto error, keeping plain text:', e.message);
    // ไม่ migrate — ปล่อย plain text ไว้ก่อน ดีกว่า lock user ออก
  }
}

// ============================================================
// AUTH
// ============================================================
let CU = null;
let fStatus = '', fSearch = '', fPriority = '', fMachineId = '';
let tkPage = 1;

// ── Login Brute Force Protection ──
const _LOGIN_MAX_ATTEMPTS = 5;
const _LOGIN_LOCKOUT_MS   = 5 * 60 * 1000; // 5 นาที
let _loginAttempts = 0;
let _loginLockedUntil = 0;
const TK_PER_PAGE = 10;

// (demo login removed)

// ── Register Screen ──────────────────────────────────────────────
function showRegister() {
  document.getElementById('register-screen').style.display = 'block';
  document.getElementById('reg-err').textContent = '';
}
function hideRegister() {
  document.getElementById('register-screen').style.display = 'none';
}

async function doRegister() {  // PATCH: async เพื่อ await hashPassword
  // ── LIFF path: ถ้าสมัครผ่าน LINE → delegate ไป doRegisterWithLine ──
  const lineId = document.getElementById('reg-line-user-id')?.value?.trim();
  if (lineId && typeof doRegisterWithLine === 'function') {
    return doRegisterWithLine();
  }
  const name  = document.getElementById('reg-name').value.trim();
  const uname = document.getElementById('reg-user').value.trim().toLowerCase();
  const pass  = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  const dept  = document.getElementById('reg-dept').value.trim();
  const tel   = document.getElementById('reg-tel').value.trim();
  const errEl = document.getElementById('reg-err');

  errEl.style.display='none';
  // clear old inline errors
  document.querySelectorAll('#reg-wrap .field-error').forEach(e=>e.remove());

  let hasErr = false;
  if (!name)  { showFormError('reg-name', 'กรุณากรอกชื่อ-นามสกุล'); hasErr=true; }
  if (!uname) { showFormError('reg-user', 'กรุณากรอก Username'); hasErr=true; }
  else if (!/^[a-zA-Z0-9_]+$/.test(uname)) { showFormError('reg-user', 'ใช้ได้เฉพาะ a-z, 0-9, _'); hasErr=true; }
  if (pass.length < 6) { showFormError('reg-pass', 'Password ต้องมีอย่างน้อย 6 ตัวอักษร'); hasErr=true; }
  if (pass !== pass2)  { showFormError('reg-pass2', 'Password ไม่ตรงกัน'); hasErr=true; }
  if (hasErr) return;

  if (db.users.find(x => x.username.toLowerCase() === uname)) {
    showFormError('reg-user', 'Username นี้ถูกใช้แล้ว');
    return;
  }

  try {
    const hashedPass = await hashPassword(pass);
    const newUser = {
      id: 'u' + Date.now(),
      name, username: uname, password: hashedPass,
      role: 'reporter', dept, tel,
      createdAt: nowStr()
    };
    db.users.push(newUser);
    // บันทึก localStorage ทันที
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch(e) {}

    // แสดง loading ระหว่าง sync
    const submitBtn = document.querySelector('#reg-wrap .rg-btn, #register-screen .rg-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '⏳ กำลัง sync ข้อมูล...'; }

    // sync Firebase — รอให้เสร็จก่อน แล้วค่อย show success
    const doAfterSave = () => {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'สมัครสมาชิก'; }
      notifyRole('admin', '👤 ผู้ใช้ใหม่สมัครแล้ว', name + ' (' + uname + ') สมัครเป็นผู้แจ้งงาน');
      if (typeof lineMessagingEvent === 'function') lineMessagingEvent('newUser', newUser);
      showRegisterSuccess(name, () => {
        hideRegister();
        document.getElementById('lu').value = uname;
        document.getElementById('lp').value = '';
        document.getElementById('lerr').textContent = '';
      });
    };
    if (typeof fsSaveNow === 'function' && typeof FSdb !== 'undefined' && FSdb) {
      fsSaveNow().then(doAfterSave).catch(doAfterSave);
    } else {
      if (typeof fsSave === 'function') fsSave();
      doAfterSave();
    }
  } catch(e) {
    console.error('[doRegister] error:', e);
    const errEl = document.getElementById('reg-err');
    if (errEl) { errEl.textContent = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'; errEl.style.display = 'block'; }
  }
}

function showRegisterSuccess(name, callback) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
  const box = document.createElement('div');
  box.style.cssText = 'background:white;border-radius:24px;padding:36px 28px;max-width:320px;width:90%;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.3)';
  box.innerHTML =
    '<div style="width:72px;height:72px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:2.2rem">&#10003;</div>' +
    '<div style="font-size:1.2rem;font-weight:900;color:#0f172a;margin-bottom:8px">สมัครสมาชิกสำเร็จ!</div>' +
    '<div style="font-size:0.85rem;color:#64748b;line-height:1.6;margin-bottom:20px">ยินดีต้อนรับ <strong style="color:#c8102e">' + name + '</strong><br>กรุณาเข้าสู่ระบบด้วยบัญชีที่สมัคร</div>';
  const btn = document.createElement('button');
  btn.textContent = 'ไปหน้าเข้าสู่ระบบ';
  btn.style.cssText = 'width:100%;padding:14px;background:#0f172a;color:white;border:none;border-radius:14px;font-size:0.95rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(200,16,46,0.35)';
  btn.onclick = function() { ov.remove(); if (callback) callback(); };
  box.appendChild(btn);
  ov.appendChild(box);
  document.body.appendChild(ov);
}

async function doLogin() {
  // ── Brute Force Check ──
  if (Date.now() < _loginLockedUntil) {
    const remaining = Math.ceil((_loginLockedUntil - Date.now()) / 1000 / 60);
    showLoginErr(`🔒 Login ถูกล็อค กรุณารอ ${remaining} นาที`);
    shakeLoginInput('lu');
    return;
  }

  const u = document.getElementById('lu').value.trim();
  const p = document.getElementById('lp').value;
  if (!u || !p) {
    shakeLoginInput(!u ? 'lu' : 'lp');
    showLoginErr(!u ? 'กรุณากรอก Username' : 'กรุณากรอก Password');
    return;
  }
  try {
    // ── ค้นหา user จาก username ก่อน แล้วค่อย verify password ──
    const candidate = db.users.find(x => x.username === u);

    // ── SECURITY: First-time setup — บัญชีที่ยังไม่ตั้ง password ──
    if (candidate && candidate.password === '__SETUP_REQUIRED__') {
      // ให้ตั้ง password ใหม่ครั้งแรก (ใส่อะไรก็ได้ แต่ต้อง ≥ 8 ตัว)
      if (p.length < 8) {
        showLoginErr('🔑 บัญชีนี้ยังไม่มี Password — กรุณาตั้ง Password ใหม่ (อย่างน้อย 8 ตัวอักษร)');
        shakeLoginInput('lp');
        return;
      }
      candidate.password = await hashPassword(p);
      saveDB(); fsSave();
      showLoginErr('✅ ตั้ง Password เรียบร้อย — กำลัง Login...');
      // ไม่ return — ไหลต่อเข้า login ปกติด้านล่าง
    }

    const valid = candidate ? await verifyPassword(p, candidate.password) : false;
    if (!valid) {
      shakeLoginInput('lu'); shakeLoginInput('lp');
      document.getElementById('lp').value = '';
      _loginAttempts++;
      if (_loginAttempts >= _LOGIN_MAX_ATTEMPTS) {
        _loginLockedUntil = Date.now() + _LOGIN_LOCKOUT_MS;
        _loginAttempts = 0;
        showLoginErr(`🔒 Login ผิดเกิน ${_LOGIN_MAX_ATTEMPTS} ครั้ง — ถูกล็อค 5 นาที`);
      } else {
        showLoginErr(`Username หรือ Password ไม่ถูกต้อง (${_loginAttempts}/${_LOGIN_MAX_ATTEMPTS})`);
      }
      return;
    }
    clearLoginErr();
    await migratePasswordIfNeeded(candidate, p);
    _loginAttempts = 0; // reset หลัง login สำเร็จ
    CU = candidate;
    const sessionData = { uid: candidate.id, uname: candidate.username, exp: Date.now() + 8*60*60*1000 }; // 8h — ป้องกัน shared device
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').classList.add('visible');
    initApp();
    loadMachinesData().then(() => {
      if (typeof refreshMachineList === 'function') refreshMachineList();
    });
  } catch(e) {
    console.error('[doLogin] error:', e);
    showLoginErr('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
  }
}

function shakeLoginInput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth; // reflow
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 520);
}

function showLoginErr(msg) {
  const el = document.getElementById('lerr');
  if (!el) return;
  el.innerHTML = '<div class="lerr-box"><span class="lerr-icon">⚠️</span><span class="lerr-text">' + msg + '</span></div>';
}

function clearLoginErr() {
  const el = document.getElementById('lerr');
  if (el) el.innerHTML = '';
}
// ============================================================
// PROFILE / ACCOUNT
// ============================================================
// ── HTML Escape — ป้องกัน XSS จาก user input (global) ──
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAvatarInitials(name) {
  const parts = (name||'').split(' ');
  return parts.length>=2 ? parts[0][0]+parts[1][0] : (name||'?')[0];
}
function getAvatarColor(id) {
  const colors = ['#c8102e','#1d4ed8','#0e7490','#065f46','#7c3aed','#b45309','#0f766e'];
  let h = 0; for(const c of (id||'')) h = (h*31+c.charCodeAt(0))%colors.length;
  return colors[Math.abs(h)];
}
function renderSettingsPage() {
  if(!CU) return;
  const ri = {admin:['👑 แอดมิน','#7c3aed'],tech:['🔧 ช่างซ่อม','#059669'],reporter:['📢 ผู้แจ้งงาน','#0891b2'],executive:['📊 ผู้บริหาร','#0e7490']};

  // Avatar
  const inner = document.getElementById('sp-avatar-inner');
  if(inner) {
    if(CU.avatar) {
      inner.innerHTML = '<img src="'+CU.avatar+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>';
    } else {
      inner.innerHTML = '<span style="font-size:1.6rem;font-weight:900;color:#fff">'+getAvatarInitials(CU.name)+'</span>';
      const ring = document.getElementById('sp-avatar-ring');
      if(ring) ring.style.background = getAvatarColor(CU.id);
    }
  }

  // Name / role / dept
  const nameEl = document.getElementById('sp-name-display');
  if(nameEl) nameEl.textContent = CU.name||'';
  const roleEl = document.getElementById('sp-role-badge');
  if(roleEl) { roleEl.textContent = ri[CU.role]?.[0]||CU.role; roleEl.style.background = (ri[CU.role]?.[1]||'#888')+'33'; }
  const deptEl = document.getElementById('sp-dept-display');
  if(deptEl) deptEl.textContent = [CU.dept, CU.tel].filter(Boolean).join(' · ') || '';

  // Fill form
  const setVal = (id, v) => { const el=document.getElementById(id); if(el) el.value=v||''; };
  setVal('sp-name', CU.name); setVal('sp-dept', CU.dept);
  setVal('sp-tel', CU.tel);   setVal('sp-contact', CU.contact);
  setVal('sp-username', CU.username);
  // visible inputs
  setVal('sp-name-vi', CU.name);    setVal('sp-dept-vi', CU.dept);
  setVal('sp-tel-vi', CU.tel);      setVal('sp-contact-vi', CU.contact);

  // Stats card (tech only)
  const statsCard = document.getElementById('sp-stats-card');
  if(statsCard) {
    if(CU.role === 'tech') {
      statsCard.style.display = '';
      const myTickets = db.tickets.filter(t => t.assigneeId === CU.id);
      const done = myTickets.filter(t => ['done','verified','closed'].includes(t.status));
      const totalCost = done.reduce((s,t) => s+Number(t.cost||0), 0);
      const avgHours = done.length ? (done.reduce((s,t)=>s+Number(t.repairHours||0),0)/done.length).toFixed(1) : '—';
      const grid = document.getElementById('sp-stats-grid');
      if(grid) grid.innerHTML = [
        ['งานทั้งหมด', myTickets.length, '#c8102e'],
        ['งานเสร็จแล้ว', done.length, '#059669'],
        ['ค่าซ่อมสะสม', done.length ? '฿'+totalCost.toLocaleString() : '—', '#0891b2'],
        ['เฉลี่ย (ชม.)', avgHours, '#7c3aed'],
      ].map(([label,val,color]) =>
        '<div style="background:#f8fafc;border-radius:10px;padding:10px;text-align:center">'
        +'<div style="font-size:1.1rem;font-weight:900;color:'+color+'">'+val+'</div>'
        +'<div style="font-size:0.65rem;color:var(--muted);font-weight:600;margin-top:2px">'+label+'</div>'
        +'</div>'
      ).join('');
    } else {
      statsCard.style.display = 'none';
    }
  }

  // Admin tools — show only for admin
  const adminTools = document.getElementById('sp-admin-tools');
  if (adminTools) adminTools.style.display = CU.role === 'admin' ? 'block' : 'none';

  // LINE & GAS card — admin only + fill current URL
  const lineGasCard = document.getElementById('sp-line-gas-card');
  if (lineGasCard) {
    lineGasCard.style.display = CU.role === 'admin' ? 'block' : 'none';
    const urlEl = document.getElementById('sp-gs-url');
    if (urlEl) urlEl.value = db.gsUrl || '';
  }

  // Backend panel — show only for admin
  const backendPanel = document.getElementById('sp-backend-panel');
  if (backendPanel) {
    if (CU.role === 'admin') {
      if (typeof showBackendPanel === 'function') showBackendPanel();
    } else {
      backendPanel.style.display = 'none';
    }
  }
}

function spPreviewAvatar(input) {
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    window._pendingAvatar = e.target.result;
    const inner = document.getElementById('sp-avatar-inner');
    if(inner) inner.innerHTML = '<img src="'+e.target.result+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>';
  };
  reader.readAsDataURL(file);
}

function spSaveVI() {
  const name = document.getElementById('sp-name-vi')?.value.trim();
  document.querySelectorAll('#pg-settings .field-error').forEach(e=>e.remove());
  if (!name) { showFormError('sp-name-vi', 'กรุณาระบุชื่อ-นามสกุล'); return; }
  const u = db.users.find(x=>x.id===CU.id); if (!u) return;
  u.name    = name;
  u.dept    = document.getElementById('sp-dept-vi')?.value.trim()||'';
  u.tel     = document.getElementById('sp-tel-vi')?.value.trim()||'';
  u.contact = document.getElementById('sp-contact-vi')?.value.trim()||'';
  if (window._pendingAvatar) { u.avatar = window._pendingAvatar; window._pendingAvatar = null; }
  Object.assign(CU, u);
  ['name','dept','tel','contact'].forEach(k => {
    const el = document.getElementById('sp-'+k); if(el) el.value = u[k]||'';
  });
  saveDB(); if(typeof syncUser==='function') syncUser(u);
  renderSettingsPage(); renderTopbarAvatar();
  const ok = document.getElementById('sp-save-vi-ok');
  if (ok) { ok.style.display='block'; setTimeout(()=>ok.style.display='none', 2500); }
  showToast('✅ บันทึกข้อมูลแล้ว');
}

function spSave() {
  const name = document.getElementById('sp-name')?.value.trim();
  document.querySelectorAll('#pg-settings .field-error').forEach(e=>e.remove());
  if(!name) { showFormError('sp-name', 'กรุณาระบุชื่อ-นามสกุล'); return; }
  const u = db.users.find(x=>x.id===CU.id); if(!u) return;
  u.name    = name;
  u.dept    = document.getElementById('sp-dept')?.value.trim()||'';
  u.tel     = document.getElementById('sp-tel')?.value.trim()||'';
  u.contact = document.getElementById('sp-contact')?.value.trim()||'';
  if(window._pendingAvatar) { u.avatar = window._pendingAvatar; window._pendingAvatar = null; }
  Object.assign(CU, u);
  saveDB();
  renderSettingsPage();
  renderTopbarAvatar();
  // แสดง hint
  const hint = document.getElementById('sp-save-hint');
  if(hint) { hint.style.display=''; setTimeout(()=>hint.style.display='none',2500); }
  showToast('✅ บันทึกข้อมูลแล้ว');
}

// ── บันทึก Google Apps Script URL ──────────────────────────────
function spSaveGsUrl() {
  const url = document.getElementById('sp-gs-url')?.value.trim();
  if (!url) { showToast('⚠️ กรุณากรอก Google Apps Script URL'); return; }
  db.gsUrl = url;
  saveDB();
  // sync ขึ้น Firestore — device อื่นจะได้ gsUrl ผ่าน onSnapshot
  if (typeof fsSave === 'function') fsSave();
  const ok = document.getElementById('sp-gs-url-ok');
  if (ok) { ok.style.display = 'block'; setTimeout(() => ok.style.display = 'none', 3000); }
  showToast('✅ บันทึก GAS URL แล้ว — sync ขึ้น Firestore เรียบร้อย');
}

// ── ทดสอบส่ง LINE แจ้งเตือน ────────────────────────────────────
async function spTestLinePush() {
  const resultEl = document.getElementById('sp-gs-test-result');
  const gsUrl = db.gsUrl;
  if (!gsUrl) {
    showToast('⚠️ กรุณาบันทึก Google Apps Script URL ก่อน');
    return;
  }
  if (resultEl) { resultEl.style.display='block'; resultEl.style.color='#0891b2'; resultEl.textContent='⏳ กำลังส่งทดสอบ...'; }
  try {
    const testMsg = [{
      type: 'flex', altText: '🔔 ทดสอบแจ้งเตือน SCG AIRCON',
      contents: {
        type: 'bubble', size: 'kilo',
        header: { type:'box', layout:'vertical', backgroundColor:'#c8102e', paddingAll:'14px',
          contents:[{ type:'text', text:'🔔  ทดสอบแจ้งเตือน', color:'#ffffff', weight:'bold', size:'md' }] },
        body: { type:'box', layout:'vertical', spacing:'sm', paddingAll:'14px',
          contents:[
            { type:'box', layout:'horizontal', spacing:'sm', contents:[
              { type:'text', text:'ระบบ', color:'#888888', size:'sm', flex:2 },
              { type:'text', text:'SCG AIRCON BP', color:'#111111', size:'sm', flex:5, weight:'bold' }]},
            { type:'box', layout:'horizontal', spacing:'sm', contents:[
              { type:'text', text:'ทดสอบโดย', color:'#888888', size:'sm', flex:2 },
              { type:'text', text:CU ? CU.name : 'Admin', color:'#111111', size:'sm', flex:5, weight:'bold' }]},
            { type:'box', layout:'horizontal', spacing:'sm', contents:[
              { type:'text', text:'เวลา', color:'#888888', size:'sm', flex:2 },
              { type:'text', text:nowStr(), color:'#111111', size:'sm', flex:5, weight:'bold' }]}]},
        footer: { type:'box', layout:'vertical', paddingAll:'12px',
          contents:[{ type:'button', style:'primary', color:'#c8102e', height:'sm',
            action:{ type:'uri', label:'✅ การแจ้งเตือน LINE ใช้งานได้!', uri:'https://liff.line.me/2009699254-TXIz4KN1' }}]}
      }
    }];
    const adminIds = (db.users||[]).filter(u=>u.role==='admin'&&u.lineUserId).map(u=>u.lineUserId);
    const targets = adminIds.length > 0 ? adminIds : ['U06dd3c0d1756f7497ecf67c6fccf3e52'];
    await fetch(gsUrl, { method:'POST', mode:'no-cors', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'linePush', to:targets, messages:testMsg }) });
    if (resultEl) { resultEl.style.color='#15803d'; resultEl.textContent='✅ ส่งทดสอบแล้ว — ตรวจ LINE ของ Admin ('+targets.length+' คน)'; }
    showToast('📤 ส่ง LINE ทดสอบแล้ว');
  } catch(e) {
    if (resultEl) { resultEl.style.color='#dc2626'; resultEl.textContent='❌ ส่งไม่ได้: '+e.message; }
    showToast('❌ ส่งไม่ได้: '+e.message);
  }
}

// legacy aliases (ใช้ในที่อื่นอาจเรียก)
function renderAcctInfo() { renderSettingsPage(); }
function renderTopbarAvatar() {
  const el = document.getElementById('tb-avatar'); if(!el) return;
  if(CU && CU.avatar) {
    el.innerHTML = '<img src="'+CU.avatar+'" style="width:100%;height:100%;object-fit:cover"/>';
    el.style.background = 'transparent';
  } else if(CU) {
    el.innerHTML = getAvatarInitials(CU.name);
    el.style.background = getAvatarColor(CU.id);
  }
}function previewAvatar(input) { spPreviewAvatar(input); }

// ============================================================
// PDF GENERATOR - ใบสรุปงานซ่อม
// ============================================================
// ── PDF Config defaults ──
const PDF_CFG_KEY = 'scg_pdf_cfg';
function getPDFConfig() {
  try { return JSON.parse(localStorage.getItem(PDF_CFG_KEY)||'{}'); } catch(e){ return {}; }
}
function savePDFConfig(cfg) {
  localStorage.setItem(PDF_CFG_KEY, JSON.stringify(cfg));
  // sync to firebase
  if(typeof fsSaveNow==='function') {
    if(!db.pdfConfig) db.pdfConfig={};
    Object.assign(db.pdfConfig, cfg);
    fsSaveNow().catch(()=>{});
  }
}

const PDF_THEMES = {
  red:   {primary:'#c8102e', dark:'#8b0000', darkest:'#1a0505', accent:'#4ade80'},
  blue:  {primary:'#1d4ed8', dark:'#1e3a8a', darkest:'#0f172a', accent:'#60a5fa'},
  green: {primary:'#16a34a', dark:'#166534', darkest:'#052e16', accent:'#4ade80'},
  black: {primary:'#1a1a2e', dark:'#0f0f1a', darkest:'#050510', accent:'#94a3b8'},
};



// ── getPrice2: global alias ป้องกัน "getPrice2 is not defined" ──
// (โค้ดเก่าบางส่วนเรียก getPrice2 — ให้ใช้ logic เดียวกับ getPrice ใน generateRepairPDF)
function getPrice2(name, macBTU) {
  macBTU = macBTU || 0;
  const g = (db.repairGroups||[]);
  for(const grp of g){ const it=grp.items?.find(i=>i.name===name); if(it) return {price:it.price||0,unit:it.unit||'JOB'}; }
  if(typeof REPAIR_PRICE !== 'undefined' && REPAIR_PRICE[name]) return {price:REPAIR_PRICE[name], unit:'JOB'};
  if(macBTU > 0){
    // ลอง strip "ขนาด X,XXX BTU" และ K-range notation
    const baseNoSuffix = name.replace(/\s*ขนาด\s*[\d,]+\s*BTU\s*/gi,'').trim();
    const base = name.replace(/\s*\d+(?:\.\d+)?K\s*[-–—~]\s*\d+(?:\.\d+)?K/gi,'').replace(/\s*\d+(?:\.\d+)?K/gi,'').trim();
    const baseToUse = (baseNoSuffix && baseNoSuffix !== name) ? baseNoSuffix : base;
    if(baseToUse && baseToUse !== name){
      const tier = typeof getRepairKeyByBTU==='function' ? getRepairKeyByBTU(baseToUse, macBTU) : null;
      if(tier && tier.price > 0) return {price:tier.price, unit:'JOB'};
    }
    // fallback: หาจาก repairGroups ที่ชื่อ startsWith base
    if(baseToUse){
      for(const grp of g){
        const it=grp.items?.find(i=>i.name.startsWith(baseToUse));
        if(it&&it.price>0) return{price:it.price,unit:it.unit||'JOB'};
      }
    }
  }
  const refMap={'R-22':200,'R-32':350,'R-407C':330,'R-407c':330,'R-410A':340,'R-410a':340,'R-134A':330,'R-134a':330,'R-141B':280};
  for(const[ref,price] of Object.entries(refMap)){ if(name.includes(ref)) return{price,unit:'Kg.'}; }
  return {price:0, unit:'JOB'};
}

// ── Route by role: admin → Designer with panel, others → full view ──
function openQuotationByRole(tid) {
  // admin: เปิด designer แก้ไขได้
  // tech/reporter: fullscreen read-only view
  if (CU && CU.role === 'admin') {
    generateRepairPDF(tid);
  } else {
    viewQuotationFull(tid);
  }
}

// ── Format item name: แปลง K notation → BTU ──
// แปลง K notation และแทนที่ด้วย BTU จริงของเครื่อง
function formatItemName(name, realBTU) {
  if(!name) return name;
  if(realBTU && realBTU > 0){
    // มี BTU จริง → ตัด tier K range ออก แล้วใส่ "ขนาด X,XXX BTU" จริง
    var cleaned = name.replace(/\s*\d+(?:\.\d+)?K\s*[-\u2013\u2014~]\s*\d+(?:\.\d+)?K/gi,'').trim();
    cleaned = cleaned.replace(/\s*\d+(?:\.\d+)?K/gi,'').trim();
    return cleaned + ' ขนาด ' + Number(realBTU).toLocaleString('en-US') + ' BTU';
  }
  // ไม่มี BTU จริง → แปลง K range → "ขนาด X,XXX–Y,YYY BTU"
  return name.replace(/(\d+(?:\.\d+)?)K\s*[-\u2013\u2014~]\s*(\d+(?:\.\d+)?)K/gi, function(_,a,b){
    return 'ขนาด ' + Number(parseFloat(a)*1000).toLocaleString('en-US') + '–' + Number(parseFloat(b)*1000).toLocaleString('en-US') + ' BTU';
  }).replace(/\b(\d+(?:\.\d+)?)K\b/gi, function(_,n){
    return 'ขนาด ' + Number(parseFloat(n)*1000).toLocaleString('en-US') + ' BTU';
  });
}

// เลือก tier ราคาตาม BTU จริง — คืนชื่อ key ที่ตรง
function getRepairKeyByBTU(baseName, btu) {
  if(!btu || btu <= 0) return null;
  // tiers: 9K-48K=≤48000, 48K-150K=≤150000, 150K-240K=≤240000, 240K-400K=≤400000
  var tiers = [
    {max:48000,   key: baseName + ' 9K\u201348K'},
    {max:150000,  key: baseName + ' 48K\u2013150K'},
    {max:240000,  key: baseName + ' 150K\u2013240K'},
    {max:400000,  key: baseName + ' 240K\u2013400K'},
  ];
  // ลอง em-dash และ hyphen ด้วย
  var dashVariants = ['\u2013','\u2014','-'];
  for(var i=0;i<tiers.length;i++){
    if(btu <= tiers[i].max){
      // ลองหา key ใน REPAIR_PRICE หรือ repairGroups ด้วย dash variants
      for(var d=0;d<dashVariants.length;d++){
        var k = baseName + ' 9K' + (i===0?dashVariants[d]+'48K':i===1?dashVariants[d]+'150K':i===2?dashVariants[d]+'240K':dashVariants[d]+'400K') + (i===0?'':i===1?'':i===2?'':'');
        // rebuild key properly
        var suffixes = ['9K'+dashVariants[d]+'48K','48K'+dashVariants[d]+'150K','150K'+dashVariants[d]+'240K','240K'+dashVariants[d]+'400K'];
        k = baseName + ' ' + suffixes[i];
        const _rp = (typeof REPAIR_PRICE !== 'undefined') ? REPAIR_PRICE : {};
        if(_rp[k]) return {key:k, price:_rp[k]};
        // check repairGroups
        for(var g=0;g<(db.repairGroups||[]).length;g++){
          var it = (db.repairGroups[g].items||[]).find(function(x){return x.name===k;});
          if(it) return {key:k, price:it.price||0};
        }
      }
      return {key:tiers[i].key, price:0};
    }
  }
  return null;
}

// ── Full-screen read-only quotation (user / tech) ──
async function viewQuotationFull(tid) {
  const t        = db.tickets.find(x=>x.id===tid); if(!t){showToast('ไม่พบข้อมูลงาน');return;}

  // ── โหลด signatures: merge จาก cache + Firebase เสมอ (ไม่ใช่แค่ตอนว่าง) ──
  if (!t.signatures) t.signatures = {};
  try {
    const sigCache = JSON.parse(localStorage.getItem(SIGS_KEY) || '{}');
    if (sigCache[tid]) Object.assign(t.signatures, sigCache[tid]);
  } catch(e) {}
  if (_firebaseReady && FSdb) {
    try {
      const sigSnap = await FSdb.collection('appdata').doc('signatures').get();
      if (sigSnap.exists) {
        const allSigs = sigSnap.data() || {};
        if (allSigs[tid]) Object.assign(t.signatures, allSigs[tid]);
      }
    } catch(e) {}
  }

  try {

  const tech     = db.users.find(u=>u.id===t.assigneeId);
  const reporter = db.users.find(u=>u.id===t.reporterId);
  const machine  = getMacMap().get(t.machineId)||null;
  const cfg      = Object.assign({orgName:'SCG AIRCON',logo:''}, getPDFConfig(), db.pdfConfig||{});

  var _esc = escapeHtml; // REFACTOR (audit #8): use global escapeHtml instead of local duplicate
  const _fmt  = n=>n>0?n.toLocaleString('en-US',{minimumFractionDigits:2}):'—';
  const _fmtD = s=>{if(!s)return'—';try{const[y,m,d]=s.split('-');return`${parseInt(d)}/${m}/${parseInt(y)+543}`;}catch(e){return s;}};
  const today = _fmtD(new Date().toISOString().slice(0,10));

  const vendorName = (machine && machine.vendor && getVendorMap()[machine.vendor])
    ? getVendorMap()[machine.vendor]
    : 'บริษัท สยามคราฟท์อุตสาหกรรม จำกัด';

  const brand = [machine&&machine.mfrFCU, machine&&machine.modelFCU].filter(Boolean).join(' ')
    || (machine&&machine.brandFCU) || (machine&&machine.brandCDU) || (machine&&machine.brand) || 'Carrier';
  const btu = machine&&machine.btu ? Number(machine.btu).toLocaleString()+' BTU' : '';

  // parse repair rows only — แยก repairStr (ก่อน —) ก่อนเสมอ
  const parseItems = () => {
    const rows = [];
    const raw = (t.summary||'');
    // แยกส่วน repair tags (ก่อน em-dash —) กับ manual summary (หลัง —)
    const dashIdx = raw.indexOf(' \u2014 ');
    // รองรับทั้ง format ใหม่ (\n) และ format เก่า (", " + " — ")
    const isNewFmt = raw.includes('\n');
    let repairLines = [];
    if (isNewFmt) {
      // format ใหม่: แต่ละบรรทัด = 1 รายการ (บรรทัดสุดท้ายอาจเป็น description)
      repairLines = raw.split('\n').filter(Boolean);
    } else {
      // format เก่า: "A, B, C — desc"
      const repPart = dashIdx >= 0 ? raw.slice(0, dashIdx) : raw;
      repairLines = repPart.split(',').map(s=>s.trim()).filter(Boolean);
    }
    repairLines.forEach(seg => {
      const c = seg.trim().replace(/^[-\u2013\u2022\u00B7*]+\s*/, '').trim();
      if (!c) return;
      const mx = c.match(/^(.+?)\s*[\u00D7\u2715xX](\d+)\s*$/);
      if (mx) { rows.push({name: mx[1].trim(), qty: parseInt(mx[2])||1}); return; }
      const mkWm = c.match(/(สารทำความเย็น[^\d]*|น้ำยา[^\d]*)(R-\w+)\s*(\d+(?:\.\d+)?)\s*กก/);
      if (mkWm) { rows.push({name:'น้ำยา '+mkWm[2]+' (ต่อ กก.)', qty:parseFloat(mkWm[3])||1}); return; }
      rows.push({name: c, qty: 1});
    });
    return rows;
  };
  const items = parseItems()
    .filter(r => r.name && r.name.trim() !== '')
    // ── normalize: ตัด trailing punctuation และ whitespace ──
    .map(r => ({ ...r, name: r.name.trim().replace(/[.。．。]+$/, '').trim() }))
    // ── dedup: รวม qty ถ้าชื่อเดียวกัน (case-insensitive, ignore trailing dot) ──
    .reduce((acc, r) => {
      const key = r.name.toLowerCase().replace(/\s+/g,' ');
      const ex = acc.find(x => x.name.toLowerCase().replace(/\s+/g,' ') === key);
      if (ex) { ex.qty += r.qty; }
      else { acc.push({...r}); }
      return acc;
    }, [])
    .map(r=>{
      // inline getPrice — เหมือน generateRepairPDF (getPrice2 ไม่มีจริง)
      const _macBTU = machine&&machine.btu ? Number(machine.btu) : 0;
      const _g = (db.repairGroups||[]);
      let price=0, unit='JOB';
      for(const grp of _g){ const it=grp.items?.find(i=>i.name===r.name); if(it){price=it.price||0;unit=it.unit||'JOB';break;} }
      if(!price && (typeof REPAIR_PRICE !== 'undefined') && REPAIR_PRICE[r.name]) { price=REPAIR_PRICE[r.name]; unit='JOB'; }
      if(!price && _macBTU>0){
        // ลอง strip "ขนาด X,XXX BTU" suffix ออก แล้วหาจาก tier
        const baseNoSuffix = r.name.replace(/\s*ขนาด\s*[\d,]+\s*BTU\s*/gi,'').trim();
        const base=r.name.replace(/\s*\d+(?:\.\d+)?K\s*[-–—~]\s*\d+(?:\.\d+)?K/gi,'').replace(/\s*\d+(?:\.\d+)?K/gi,'').trim();
        const baseToUse = (baseNoSuffix && baseNoSuffix !== r.name) ? baseNoSuffix : base;
        if(baseToUse && baseToUse!==r.name){
          const tier=getRepairKeyByBTU(baseToUse,_macBTU);
          if(tier&&tier.price>0){price=tier.price;unit='JOB';}
        }
        // ลองค้นจาก repairGroups ด้วยชื่อ base
        if(!price && baseToUse){
          for(const grp of _g){
            const it=grp.items?.find(i=>i.name.startsWith(baseToUse));
            if(it&&it.price>0){price=it.price;unit=it.unit||'JOB';break;}
          }
        }
      }
      const refMap={'R-22':200,'R-32':350,'R-407C':330,'R-407c':330,'R-410A':340,'R-410a':340,'R-134A':330,'R-134a':330,'R-141B':280};
      if(!price){ for(const[ref,p]of Object.entries(refMap)){if(r.name.includes(ref)){price=p;unit='Kg.';break;}} }
      return{name:r.name,qty:r.qty,unit,price,total:r.qty*price};
    });
  const sub   = items.reduce((s,r)=>s+r.total,0);
  const vat   = Math.round(sub*0.07*100)/100;
  const grand = sub+vat;
  const empty = Math.max(0,7-items.length);

  const _baht = n=>{
    if(!n)return'ศูนย์บาทถ้วน';
    const ones=['','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
    const tens=['','สิบ','ยี่สิบ','สามสิบ','สี่สิบ','ห้าสิบ','หกสิบ','เจ็ดสิบ','แปดสิบ','เก้าสิบ'];
    const cv=x=>{if(x===0)return'';if(x<10)return ones[x];if(x<100)return tens[Math.floor(x/10)]+(x%10?ones[x%10]:'');
      if(x<1000)return ones[Math.floor(x/100)]+'ร้อย'+cv(x%100);if(x<10000)return ones[Math.floor(x/1000)]+'พัน'+cv(x%1000);
      if(x<100000)return cv(Math.floor(x/10000))+'หมื่น'+cv(x%10000);if(x<1000000)return cv(Math.floor(x/100000))+'แสน'+cv(x%100000);
      return cv(Math.floor(x/1000000))+'ล้าน'+cv(x%1000000);};
    const ip=Math.floor(n),sp=Math.round((n-ip)*100);
    return cv(ip)+'บาท'+(sp>0?cv(sp)+'สตางค์':'ถ้วน');
  };

  const nilSVG = (w,h) => '<svg width="'+w+'" height="'+h+'" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
    +'<circle cx="50" cy="50" r="46" fill="none" stroke="#1a5276" stroke-width="3"/>'
    +'<circle cx="50" cy="50" r="36" fill="none" stroke="#1a5276" stroke-width="1.5"/>'
    +'<circle cx="50" cy="50" r="11" fill="none" stroke="#1a5276" stroke-width="2"/>'
    +'<line x1="50" y1="4" x2="50" y2="39" stroke="#1a5276" stroke-width="2"/>'
    +'<line x1="50" y1="61" x2="50" y2="96" stroke="#1a5276" stroke-width="2"/>'
    +'<line x1="4" y1="50" x2="39" y2="50" stroke="#1a5276" stroke-width="2"/>'
    +'<line x1="61" y1="50" x2="96" y2="50" stroke="#1a5276" stroke-width="2"/>'
    +'<line x1="18" y1="18" x2="42" y2="42" stroke="#1a5276" stroke-width="1.5"/>'
    +'<line x1="58" y1="58" x2="82" y2="82" stroke="#1a5276" stroke-width="1.5"/>'
    +'<line x1="82" y1="18" x2="58" y2="42" stroke="#1a5276" stroke-width="1.5"/>'
    +'<line x1="42" y1="58" x2="18" y2="82" stroke="#1a5276" stroke-width="1.5"/>'
    +'<text x="50" y="54" text-anchor="middle" font-size="11" font-weight="900" fill="#1a5276" font-family="Arial">NIL</text>'
    +'<text x="50" y="76" text-anchor="middle" font-size="5.5" font-weight="700" fill="#1a5276" font-family="Arial">NIL ENGINEERING 2005</text>'
    +'<text x="50" y="83" text-anchor="middle" font-size="4.5" font-weight="600" fill="#1a5276" font-family="Arial">LIMITED PARTNERSHIP</text>'
    +'</svg>';

  const logoCell = cfg.logo ? '<img src="'+cfg.logo+'" style="width:68px;height:68px;object-fit:contain"/>' : nilSVG(68,68);

  let rowsHtml = items.map(function(r,i){
    return '<tr>'
      +'<td style="padding:8px 4px;border-right:1px solid #ddd;border-bottom:1px solid #eee;text-align:center;font-size:9pt">'+(i+1)+'</td>'
      +'<td style="padding:8px 8px;border-right:1px solid #ddd;border-bottom:1px solid #eee;text-align:center;font-size:8pt;color:#555">—</td>'
      +'<td style="padding:8px 10px;border-right:1px solid #ddd;border-bottom:1px solid #eee;font-size:9pt">'+_esc(formatItemName(r.name, machine&&machine.btu?Number(machine.btu):0))+'</td>'
      +'<td style="padding:8px 4px;border-right:1px solid #ddd;border-bottom:1px solid #eee;text-align:center;font-size:9pt">'+(r.qty>0?Number(r.qty).toFixed(2):'—')+'</td>'
      +'<td style="padding:8px 4px;border-right:1px solid #ddd;border-bottom:1px solid #eee;text-align:center;font-size:8.5pt">'+_esc(r.unit)+'</td>'
      +'<td style="padding:8px 6px;border-right:1px solid #ddd;border-bottom:1px solid #eee;text-align:right;font-size:9pt">'+(r.price>0?Number(r.price).toLocaleString('en-US',{minimumFractionDigits:2}):'—')+'</td>'
      +'<td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;font-size:9pt">'+(r.total>0?r.total.toLocaleString('en-US',{minimumFractionDigits:2}):'—')+'</td>'
      +'</tr>';
  }).join('');
  for(var ei=0;ei<empty;ei++){
    rowsHtml += '<tr style="height:26px"><td style="border-right:1px solid #ddd;border-bottom:1px solid #eee"></td><td style="border-right:1px solid #ddd;border-bottom:1px solid #eee"></td><td style="border-right:1px solid #ddd;border-bottom:1px solid #eee"></td><td style="border-right:1px solid #ddd;border-bottom:1px solid #eee"></td><td style="border-right:1px solid #ddd;border-bottom:1px solid #eee"></td><td style="border-right:1px solid #ddd;border-bottom:1px solid #eee"></td><td style="border-bottom:1px solid #eee"></td></tr>';
  }

  const html = '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">'
    +'<meta name="viewport" content="width=device-width,initial-scale=1">'
    +'<title>ใบเสนอราคา '+t.id+'</title>'
    +'<style>@import url(\'https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800;900&display=swap\');'
    +'*{margin:0;padding:0;box-sizing:border-box}'
    +'body{font-family:\'Sarabun\',Arial,sans-serif;font-size:9.5pt;color:#000;background:#c8c8c8;overflow-x:hidden}'
    +'.page{width:100%;max-width:210mm;min-height:297mm;margin:12px auto;background:white;box-shadow:0 4px 24px rgba(0,0,0,.25);padding:10mm;transform-origin:top left}'
    +'@media screen and (max-width:820px){.page{padding:6mm;transform:scale(var(--ps,1));margin-left:0!important;margin-right:0!important}}'
    +'table{border-collapse:collapse;width:100%}'
    +'td,th{font-family:\'Sarabun\',Arial,sans-serif}'
    +'@media print{body{background:white}html,body{width:210mm}.page{margin:0;padding:10mm;box-shadow:none;width:210mm;max-width:210mm;min-height:auto;transform:none!important}.no-print{display:none!important}@page{size:A4 portrait;margin:0}}'
    +'</style></head><body>'
    +'<div class="page">'

    // HEADER — ไม่มีกรอบนอก
    +'<table style="width:100%"><tr>'
    +'<td style="width:82px;padding:7px 8px 7px 0;text-align:center;vertical-align:middle">'
    +logoCell
    +'<div style="font-size:5pt;font-weight:800;color:#1a5276;line-height:1.5;margin-top:2px;font-family:Arial">NIL ENGINEERING 2005<br>LIMITED PARTNERSHIP</div></td>'
    +'<td style="padding:8px 12px;vertical-align:top">'
    +'<div style="font-size:12.5pt;font-weight:900">ห้างหุ้นส่วนจำกัด นิล เอ็นจิเนียริ่ง 2005</div>'
    +'<div style="font-size:8pt;margin-top:4px;color:#222">เลขที่ 12/1 ม.3 ต.วังศาลา อ.ท่าม่วง จ.กาญจนบุรี 71130</div>'
    +'<div style="font-size:8pt;color:#222">Tel 090-4388533 &nbsp;&nbsp; Email nilengineering2005@hotmail.com</div>'
    +'<div style="font-size:7.5pt;margin-top:12px;color:#444">เลขประจำตัวผู้เสียภาษี (Tax ID) &nbsp;<strong>713548000570</strong> &nbsp;&nbsp; สำนักงานใหญ่</div></td>'
    +(cfg.quotationImg?'<td style="padding:8px;vertical-align:middle;text-align:center"><img src="'+cfg.quotationImg+'" style="max-width:90px;max-height:80px;object-fit:contain;border-radius:3px"/></td>':'<td style="width:10px"></td>')
    +'<td style="width:140px;padding:8px 0 8px 8px;vertical-align:middle;text-align:center">'
    +'<div style="display:flex;flex-direction:column;align-items:center;gap:5px">'
    +'<div style="border:2px solid #333;padding:9px 10px;display:inline-block;min-width:88px">'
    +'<div style="font-size:10.5pt;font-weight:900">ใบเสนอราคา</div>'
    +'<div style="font-size:9pt;font-weight:700;color:#333">Quotation</div></div></div></td>'
    +'</tr></table>'
    +'<hr style="border:none;border-top:1.5px solid #333;margin:4px 0">'

    // TO BOX — ไม่มีกรอบนอก
    +'<table style="width:100%;border-collapse:collapse"><tr>'
    +'<td style="padding:7px 10px 7px 0;border-right:1px solid #ddd;vertical-align:top;width:55%">'
    +'<div style="border:1px solid #999;padding:7px 10px">'
    +'<div style="font-weight:800;font-size:9pt">'+_esc(vendorName)+'</div>'
    +'<div style="margin-top:3px;font-size:8.5pt">เรียน : '+_esc((reporter&&reporter.name||t.reporter||'—')+((reporter&&reporter.dept)?' / '+reporter.dept:''))+'</div>'
    +'<div style="margin-top:2px;font-size:8.5pt">สำเนา : '+_esc((tech&&tech.name||t.assignee||'—')+((tech&&tech.dept)?' / '+tech.dept:''))+'</div>'
    +'<div style="margin-top:2px;font-size:8.5pt">Tel. '+_esc(t.contact||'—')+'</div></div></td>'
    +'<td style="padding:0;vertical-align:top"><table style="font-size:8.5pt;width:100%">'
    +'<tr><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;width:50%">เลขที่ใบเสนอราคา No.</td><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;font-weight:800">'+_esc(t.id)+'</td></tr>'
    +'<tr><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0">วันที่ใบเสนอราคา Date</td><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;font-weight:700">'+today+'</td></tr>'
    +'<tr><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0">กำหนดยืนราคา Valid</td><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;font-weight:700">30 วัน</td></tr>'
    +'<tr><td style="padding:5px 10px">เงื่อนไขการชำระ Payment</td><td style="padding:5px 10px;font-weight:700">30 วัน</td></tr>'
    +'</table></td></tr></table>'
    +'<hr style="border:none;border-top:1px solid #ccc;margin:4px 0">'

    // JOB — ไม่มีกรอบนอก
    +'<div style="padding:6px 4px;font-size:8.5pt;line-height:1.8;border-bottom:1px solid #ccc;margin-bottom:4px">'
    +'<strong>งาน : ซ่อมแอร์ห้อง '+_esc(t.machine||(machine&&machine.location)||(machine&&machine.name)||t.problem||'—')+'</strong><br>'
    +'<strong>ยี่ห้อ (FCU) : '+_esc([machine&&machine.mfrFCU,machine&&machine.modelFCU].filter(Boolean).join(' ')||machine&&machine.brandFCU||brand)+'&nbsp;&nbsp; (CDU) : '+_esc([machine&&machine.mfrCDU,machine&&machine.modelCDU].filter(Boolean).join(' ')||machine&&machine.brandCDU||brand)+'&nbsp;&nbsp; ขนาด : '+_esc(btu)+'</strong><br>'
    +'มีความยินดีที่จะเสนอราคาสินค้าดังต่อไปนี้ &nbsp; Please to quote the following items'
    +'</div>'

    // ITEMS TABLE — เฉพาะเส้นแบ่งใน ไม่มีกรอบนอก
    +'<table style="width:100%;border-collapse:collapse"><thead>'
    +'<tr style="background:#f0f0f0">'
    +'<th style="padding:7px 6px;border-right:1px solid #bbb;border-bottom:1.5px solid #aaa;text-align:center;width:28px;font-size:8.5pt">ลำดับ<br><span style="font-weight:500;font-size:7pt">No.</span></th>'
    +'<th style="padding:7px 8px;border-right:1px solid #bbb;border-bottom:1.5px solid #aaa;text-align:center;width:62px;font-size:8.5pt">รหัสสินค้า<br><span style="font-weight:500;font-size:7pt">Code</span></th>'
    +'<th style="padding:7px 8px;border-right:1px solid #bbb;border-bottom:1.5px solid #aaa;text-align:center;font-size:8.5pt">รายละเอียดสินค้า<br><span style="font-weight:500;font-size:7pt">Description</span></th>'
    +'<th style="padding:7px 6px;border-right:1px solid #bbb;border-bottom:1.5px solid #aaa;text-align:center;width:50px;font-size:8.5pt">จำนวน<br><span style="font-weight:500;font-size:7pt">Quantity</span></th>'
    +'<th style="padding:7px 6px;border-right:1px solid #bbb;border-bottom:1.5px solid #aaa;text-align:center;width:38px;font-size:8.5pt">หน่วย<br><span style="font-weight:500;font-size:7pt">Unit</span></th>'
    +'<th style="padding:7px 6px;border-right:1px solid #bbb;border-bottom:1.5px solid #aaa;text-align:center;width:72px;font-size:8.5pt">ราคาต่อหน่วย<br><span style="font-weight:500;font-size:7pt">Unit price</span></th>'
    +'<th style="padding:7px 6px;border-bottom:1.5px solid #aaa;text-align:center;width:72px;font-size:8.5pt">จำนวนเงิน<br><span style="font-weight:500;font-size:7pt">Amount</span></th>'
    +'</tr></thead><tbody>'+rowsHtml+'</tbody>'
    +'</table>'

    // REMARK + TOTALS — ไม่มีกรอบนอก
    +'<table style="width:100%;border-collapse:collapse;margin-top:4px"><tr>'
    +'<td style="padding:10px 12px 10px 0;border-right:1px solid #ddd;vertical-align:top;width:55%">'
    +'<div style="font-weight:700;margin-bottom:6px;font-size:8.5pt">หมายเหตุ (Remark)</div>'
    +(t.note?'<div style="font-size:8pt;color:#333;line-height:1.7">'+_esc(t.note)+'</div>':'<div style="height:22px"></div>')
    +'</td>'
    +'<td style="padding:0;vertical-align:top"><table style="font-size:8.5pt;width:100%">'
    +'<tr><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;font-weight:700;width:60%">รวมเงิน<br><span style="font-weight:400;font-size:7.5pt">Total</span></td><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;text-align:right;font-weight:700">'+_fmt(sub)+'</td></tr>'
    +'<tr><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0">ส่วนลด<br><span style="font-size:7.5pt">Discount</span></td><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;text-align:right"></td></tr>'
    +'<tr><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;font-weight:700">จำนวนเงินหลังหักส่วนลด<br><span style="font-weight:400;font-size:7.5pt">After Discount</span></td><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;text-align:right;font-weight:700">'+_fmt(sub)+'</td></tr>'
    +'<tr><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;font-weight:700">จำนวนภาษีมูลค่าเพิ่ม<br><span style="font-weight:400;font-size:7.5pt">VAT Amount</span></td><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;text-align:right;font-weight:700">'+_fmt(vat)+'</td></tr>'
    +'<tr style="background:#f5f5f5"><td style="padding:6px 10px;font-weight:900;font-size:9pt">จำนวนเงินรวมทั้งสิ้น<br><span style="font-weight:400;font-size:7.5pt">Grand Total</span></td><td style="padding:6px 10px;text-align:right;font-weight:900;font-size:11pt">'+_fmt(grand)+'</td></tr>'
    +'</table></td></tr></table>'

    // AMOUNT IN WORDS
    +'<div style="padding:5px 12px;text-align:center;font-weight:700;font-size:8.5pt;border-top:1px solid #ccc;border-bottom:1px solid #ccc;margin-top:4px">'
    +'('+(grand>0?_baht(grand):'ศูนย์บาทถ้วน')+')'
    +'</div>'

    // SIGNATURES — แสดงลายเซ็นจริงถ้ามี
    +(()=>{
      const repSig = t.signatures?.reporter?.data;
      const techSig = t.signatures?.tech?.data;
      const repSigHtml = repSig
        ? '<img src="'+repSig+'" style="height:50px;max-width:130px;object-fit:contain"/>'
        : '<div style="height:50px"></div>';
      const techSigHtml = techSig
        ? '<img src="'+techSig+'" style="height:50px;max-width:130px;object-fit:contain"/>'
        : '<div style="height:50px"></div>';
      return '<table style="width:100%;border-collapse:collapse;margin-top:16px"><tr>'
        +'<td style="padding:12px 14px 12px 0;border-right:1px solid #e0e0e0;text-align:center;vertical-align:bottom;width:33%">'
        +'<div style="min-height:55px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:5px">'+repSigHtml+'</div>'
        +'<div style="border-top:1.5px solid #555;padding-top:5px">'
        +'<div style="font-size:7.5pt;color:#555">ตกลงตามรายการข้างต้น</div>'
        +'<div style="font-size:7.5pt;color:#555">Confirmation</div>'
        +'<div style="margin-top:4px;font-size:8.5pt;font-weight:700">'+_esc(reporter&&reporter.name||t.reporter||'(                    )')+'</div></div></td>'
        +'<td style="padding:12px 14px;border-right:1px solid #e0e0e0;text-align:center;vertical-align:bottom;width:33%">'
        +'<div style="min-height:55px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:5px">'+techSigHtml+'</div>'
        +'<div style="border-top:1.5px solid #555;padding-top:5px">'
        +'<div style="font-size:7.5pt;color:#555">ขอแสดงความนับถือ</div>'
        +'<div style="font-size:7.5pt;color:#555">Best Regards</div>'
        +'<div style="margin-top:4px;font-size:8.5pt;font-weight:700">'+_esc(tech&&tech.name||t.assignee||'นายเดชา ห่วงนิล')+'</div></div></td>'
        +'<td style="padding:12px 14px;text-align:center;vertical-align:middle;width:33%">'+nilSVG(82,82)+'</td>'
        +'</tr></table>';
    })()

    +'</div></body></html>';

  // open full-screen overlay
  let ov = document.getElementById('_pdf_overlay');
  if(ov) ov.remove();
  ov = document.createElement('div');
  ov.id = '_pdf_overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99998;background:#1a1a1a;display:flex;flex-direction:column;';

  const tb = document.createElement('div');
  tb.style.cssText = 'display:flex;align-items:center;gap:8px;padding:9px 14px;background:#1a5276;flex-shrink:0;';
  tb.innerHTML = '<div style="flex:1;min-width:0">'
    +'<div style="color:white;font-weight:900;font-size:0.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📄 ใบเสนอราคา — '+t.id+'</div>'
    +'<div style="color:rgba(255,255,255,.5);font-size:0.62rem;margin-top:1px">'+_esc(t.machine||t.problem||'')+'</div></div>';

  const printBtn = document.createElement('button');
  printBtn.innerHTML = '🖨️ พิมพ์';
  printBtn.style.cssText = 'padding:6px 14px;background:#27ae60;color:white;border:none;border-radius:8px;font-family:inherit;font-size:0.76rem;font-weight:800;cursor:pointer;flex-shrink:0';
  printBtn.onclick = function(){ const fr=document.getElementById('_vq_iframe'); if(fr&&fr.contentWindow)fr.contentWindow.print(); };

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'width:30px;height:30px;background:rgba(255,255,255,.12);color:white;border:1px solid rgba(255,255,255,.2);border-radius:7px;font-size:1rem;cursor:pointer;flex-shrink:0';
  closeBtn.onclick = function(){ ov.remove(); };

  tb.appendChild(printBtn); tb.appendChild(closeBtn);
  ov.appendChild(tb);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'flex:1;overflow-y:auto;overflow-x:hidden;background:#888;-webkit-overflow-scrolling:touch;min-height:0;';
  const iframe = document.createElement('iframe');
  iframe.id = '_vq_iframe';
  iframe.style.cssText = 'width:100%;border:none;background:transparent;display:block;min-height:100%;';
  iframe.setAttribute('sandbox','allow-same-origin allow-scripts allow-modals');
  wrap.appendChild(iframe);
  ov.appendChild(wrap);
  document.body.appendChild(ov);

  // ── applyPDFScale: scale เนื้อหาพอดีจอทุกขนาด ──
  var applyScale = function(){
    try {
      var doc = iframe.contentDocument;
      if(!doc || !doc.body) return;
      var page = doc.querySelector('.page');
      if(!page) return;
      var viewW = wrap.clientWidth || window.innerWidth;
      var pageW = 794; // A4 px at 96dpi = 210mm
      var scale = Math.min(1, (viewW - 8) / pageW);
      page.style.transformOrigin = 'top center';
      page.style.transform = 'scale('+scale+')';
      page.style.marginTop = '8px';
      page.style.marginBottom = (scale < 1 ? -(pageW * (1-scale) * 0.5) : 8) + 'px';
      // ปรับความสูง iframe: ใช้ความสูงจริงของเนื้อหาหลัง scale
      var rawH = doc.documentElement.scrollHeight || doc.body.scrollHeight || 1200;
      var scaledH = rawH * scale;
      // marginBottom: ชดเชย whitespace ที่เกิดจาก transform scale (ต้องลบออก ไม่ใช่บวก)
      page.style.marginBottom = (scale < 1 ? Math.ceil(rawH * (1 - scale) * -1) + 8 : 8) + 'px';
      iframe.style.height = Math.max(scaledH + 80, wrap.clientHeight || 400) + 'px';
    } catch(e){}
  };

  requestAnimationFrame(function(){
    // iOS Safari freezes on contentDocument.write — use blob URL instead
    var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    var blob = new Blob([html], {type:'text/html;charset=utf-8'});
    // เรียก applyScale หลายครั้งเพื่อรอ font/image load ครบ
    iframe.onload = function(){
      setTimeout(applyScale, 100);
      setTimeout(applyScale, 350);
      setTimeout(applyScale, 800);
      setTimeout(applyScale, 1500);
    };
    window.removeEventListener('resize', applyScale);
    window.addEventListener('resize', applyScale);
    iframe.src = URL.createObjectURL(blob);
  });
  showToast('📄 ใบเสนอราคา '+t.id);

  } catch(e) {
    console.error('[viewQuotationFull] error:', e);
    showToast('⚠️ ไม่สามารถแสดงรายงานได้ — ' + (e.message || 'unknown error'));
  }
}


async function generateRepairPDF(tid) {
  const t        = db.tickets.find(x=>x.id===tid); if(!t){showToast('ไม่พบข้อมูลงาน');return;}

  // ── โหลด signatures: merge จาก cache + Firebase เสมอ (ไม่ใช่แค่ตอนว่าง) ──
  if (!t.signatures) t.signatures = {};
  try {
    const sigCache = JSON.parse(localStorage.getItem(SIGS_KEY) || '{}');
    if (sigCache[tid]) Object.assign(t.signatures, sigCache[tid]);
  } catch(e) {}
  if (_firebaseReady && FSdb) {
    try {
      const sigSnap = await FSdb.collection('appdata').doc('signatures').get();
      if (sigSnap.exists) {
        const allSigs = sigSnap.data() || {};
        if (allSigs[tid]) Object.assign(t.signatures, allSigs[tid]);
      }
    } catch(e) {}
  }

  try {

  const tech     = db.users.find(u=>u.id===t.assigneeId);
  const reporter = db.users.find(u=>u.id===t.reporterId);
  const machine  = getMacMap().get(t.machineId)||null;

  const cfg = Object.assign({
    theme:'red', logo:'', orgName:'SCG AIRCON BP PLANT',
    orgSub:'ใบรายงานงานซ่อมบำรุงเครื่องปรับอากาศ',
    footerText:'', footerPhone:'',
    watermark:'', watermarkOpacity:0.06,
    showSteps:true, showEquip:true, showPeople:true,
    showResult:true, showCost:true, showPhotos:true, showSig:true,
  }, getPDFConfig(), db.pdfConfig||{});

  // ── Palette ──
  const PALETTE = {
    red:   { h:'#b91c1c', hd:'#7f1d1d', acc:'#ef4444', light:'#fff1f2', mid:'#fecaca' },
    blue:  { h:'#1d4ed8', hd:'#1e3a8a', acc:'#3b82f6', light:'#eff6ff', mid:'#bfdbfe' },
    green: { h:'#15803d', hd:'#14532d', acc:'#22c55e', light:'#f0fdf4', mid:'#bbf7d0' },
    black: { h:'#1e293b', hd:'#0f172a', acc:'#64748b', light:'#f8fafc', mid:'#e2e8f0' },
  };
  const pal = PALETTE[cfg.theme] || PALETTE.red;
  const H=pal.h, HD=pal.hd, ACC=pal.acc, LT=pal.light, MID=pal.mid;

  const stMap = {done:'ซ่อมเสร็จแล้ว',verified:'ตรวจรับแล้ว',closed:'ปิดงานสมบูรณ์',inprogress:'กำลังซ่อม',assigned:'จ่ายงานแล้ว',accepted:'รับงานแล้ว',new:'ใหม่',waiting_part:'รออะไหล่'};
  const prMap = {high:'🔴 ด่วนมาก',mid:'🟡 ปานกลาง',low:'🟢 ปกติ'};
  const _fl   = machine ? (FUNC_LOC[machine.serial||'']||{}) : {};
  const _eqNo = _fl.eq || machine?.equipment || '—';
  const _flNo = _fl.fl || machine?.funcLoc   || '—';

    // ── Parse repair rows — แยก repairStr (ก่อน —) ก่อนเสมอ ──
  const parseRepairItems = () => {
    const rows = [];
    const raw = (t.summary||'');
    // แยก repair tags ส่วนก่อน em-dash —
    const dashIdx = raw.indexOf(' \u2014 ');
    // รองรับ format ใหม่ (\n) และ format เก่า (", " + " — ")
    const _isNewFmt = raw.includes('\n');
    const _repLines = _isNewFmt
      ? raw.split('\n').filter(Boolean)
      : (dashIdx >= 0 ? raw.slice(0, dashIdx) : raw).split(',').map(s=>s.trim()).filter(Boolean);
    _repLines.forEach(seg => {
      const c = seg.trim().replace(/^[-\u2013\u2022\u00B7*]+\s*/, '').trim();
      if (!c) return;
      const mx = c.match(/^(.+?)\s*[\u00D7\u2715xX](\d+)\s*$/);
      if (mx) { rows.push({name: mx[1].trim(), qty: parseInt(mx[2])||1}); return; }
      rows.push({name: c, qty: 1});
    });
    // fallback: ถ้าไม่มี repair tags ลอง parse manual lines
    if (!rows.length) {
      raw.split('\n').forEach(line => {
        const s = line.trim(); if (!s) return;
        const c = s.replace(/^[-\u2013\u2014\u2022\u00B7*]+\s*/, '').trim(); if (!c) return;
        const mx = c.match(/^(.+?)\s*[\u00D7\u2715xX](\d+)\s*$/);
        if (mx) { rows.push({name: mx[1].trim(), qty: parseInt(mx[2])||1}); return; }
        const refMap = {
          'R-22':200,'R-32':350,'R-407C':330,'R-407c':330,
          'R-410A':340,'R-410a':340,'R-134A':330,'R-134a':330,'R-141B':280
        };
        for (const ref of Object.keys(refMap)) {
          if (c.includes(ref)) {
            const kgM = c.match(/(\d+(?:\.\d+)?)\s*กก/);
            const kg = kgM ? parseFloat(kgM[1]) : 1;
            rows.push({name:'น้ำยา '+ref+' (ต่อ กก.)', qty: kg});
            return;
          }
        }
        rows.push({name: c, qty: 1});
      });
    }
    return rows;
  };
  const repairRows = parseRepairItems();
  const macBTU = machine?.btu ? Number(machine.btu) : 0;
  const getPrice = (name) => {
    const g = (db.repairGroups||[]);
    for(const grp of g){ const it=grp.items?.find(i=>i.name===name); if(it) return {price:it.price||0,unit:it.unit||'JOB'}; }
    if((typeof REPAIR_PRICE !== 'undefined') && REPAIR_PRICE[name]) return {price:REPAIR_PRICE[name], unit:'JOB'};
    // BTU-tier
    if(macBTU > 0){
      const base = name.replace(/\s*\d+(?:\.\d+)?K\s*[-–—~]\s*\d+(?:\.\d+)?K/gi,'').replace(/\s*\d+(?:\.\d+)?K/gi,'').trim();
      if(base && base !== name){
        const tier = getRepairKeyByBTU(base, macBTU);
        if(tier && tier.price > 0) return {price:tier.price, unit:'JOB'};
      }
    }
    // fuzzy น้ำยา
    const refMap={'R-22':200,'R-32':350,'R-407C':330,'R-407c':330,'R-410A':340,'R-410a':340,'R-134A':330,'R-134a':330,'R-141B':280};
    for(const[ref,price]of Object.entries(refMap)){ if(name.includes(ref)) return{price,unit:'Kg.'}; }
    return {price:0, unit:'JOB'};
  };
  const quotRows = repairRows.map(r => {
    const {price,unit} = getPrice(r.name);
    return { name:r.name, qty:r.qty, unit, unitPrice:price, total:r.qty*price };
  });
  const poRows = (t.purchaseOrder?.rows||[]).filter(r=>r.name);
  // push เฉพาะ PO rows ที่ไม่ซ้ำกับ repairRows (normalize: lowercase + trim + remove spaces)
  const _norm = s => (s||'').toLowerCase().replace(/\s+/g,'').replace(/[\-–—]/g,'-');
  const repairNames = new Set(repairRows.map(r=>_norm(r.name)));
  // ตรวจ refrigerant types ที่มีใน repairRows แล้ว ป้องกัน PO ซ้ำ
  const REFS = ['R-22','R-32','R-407C','R-407c','R-410A','R-410a','R-134A','R-134a','R-141B'];
  const usedRefs = new Set(REFS.filter(ref => repairRows.some(r=>r.name.includes(ref))));
  // dedup quotRows เอง กันซ้ำในกรณีที่ parse ซ้ำ
  const seenQuot = new Set(quotRows.map(r=>_norm(r.name)));
  poRows.forEach(r => {
    const nm = _norm(r.name);
    if (repairNames.has(nm)) return; // ชื่อซ้ำตรงๆ
    if (seenQuot.has(nm)) return; // ซ้ำกับที่มีใน quotRows แล้ว
    if (REFS.some(ref => r.name.includes(ref) && usedRefs.has(ref))) return; // refrigerant ซ้ำ
    seenQuot.add(nm);
    quotRows.push({ name:r.name, qty:r.qty||1, unit:'EA', unitPrice:r.price||0, total:(r.qty||1)*(r.price||0) });
  });

  const subTotal    = quotRows.reduce((s,r)=>s+r.total,0);
  const baseCost    = subTotal>0 ? subTotal : Number(t.cost||0);
  const vatAmt      = Math.round(baseCost*0.07*100)/100;
  const grandTotal  = baseCost + vatAmt;
  const hasPrice    = quotRows.some(r=>r.unitPrice>0);
  const summaryDesc = (t.summary||'').includes('—') ? (t.summary||'').split('—').slice(1).join('—').trim() : (t.summary||'');

  // ── Date helpers ──
  const fmtDate = (s) => {
    if(!s) return '—';
    try { return new Date(s.replace(' ','T')).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'}); } catch(e){ return s.slice(0,10); }
  };
  const fmtTime = (s) => { if(!s) return ''; try { return s.slice(11,16); } catch(e){ return ''; } };

  // ── Steps timeline ──
  const STEPS = [
    {key:'new',      icon:'📢', label:'แจ้งงาน'},
    {key:'assigned', icon:'📋', label:'จ่ายงาน'},
    {key:'accepted', icon:'✋', label:'รับงาน'},
    {key:'inprogress',icon:'🔧',label:'เริ่มซ่อม'},
    {key:'done',     icon:'✅', label:'ซ่อมเสร็จ'},
    {key:'verified', icon:'🔵', label:'ตรวจรับ'},
    {key:'closed',   icon:'🔒', label:'ปิดงาน'},
  ];
  const ORDER = STEPS.map(s=>s.key);
  const curIdx = ORDER.indexOf(t.status);
  const stepsHtml = STEPS.map((s,i)=>{
    const done   = i < curIdx;
    const active = i === curIdx;
    const bg     = done ? H : active ? 'white' : '#e5e7eb';
    const cl     = done ? 'white' : active ? H : '#9ca3af';
    const lc     = active ? H : done ? '#374151' : '#9ca3af';
    const fw     = active ? '800' : '600';
    const hist   = t.history?.find(h=>h.act?.includes(s.label)||h.act?.includes(STEPS[i]?.label?.slice(0,3)));
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;position:relative">
      ${i<STEPS.length-1?`<div style="position:absolute;top:14px;left:50%;width:100%;height:2px;background:${done?H+'80':'#e5e7eb'};z-index:0"></div>`:''}
      <div style="width:28px;height:28px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:${done?'11':'10'}pt;border:2px solid ${active?H:done?H:'#e5e7eb'};position:relative;z-index:1;box-shadow:${active?'0 0 0 3px '+MID:'none'}">${done?'✓':s.icon}</div>
      <div style="font-size:6pt;font-weight:${fw};color:${lc};text-align:center;line-height:1.2;white-space:nowrap">${s.label}</div>
      ${hist?`<div style="font-size:5.5pt;color:#9ca3af;text-align:center">${fmtTime(hist.at)}</div>`:''}
    </div>`;
  }).join('');

  // ── Photo grid ──
  const mkPhotoGrid = (arr, label, accentColor) => {
    if (!arr||!arr.length) return `<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;height:60px;background:#f8fafc;border-radius:8px;color:#9ca3af;font-size:8pt">— ไม่มีรูป${label} —</div>`;
    return arr.slice(0,6).map(p=>`<div style="aspect-ratio:4/3;overflow:hidden;border-radius:8px;border:2px solid ${accentColor}30"><img src="${p}" style="width:100%;height:100%;object-fit:cover"/></div>`).join('');
  };

  // ── Signature box ──
  const mkSig = (name, role, sigObj, color) => {
    const sigImg = sigObj?.data ? `<img src="${sigObj.data}" style="height:40px;max-width:130px;object-fit:contain"/>` : `<div style="height:40px;border-bottom:1.5px dashed #cbd5e1"></div>`;
    const dt = sigObj?.at ? `<div style="font-size:6.5pt;color:#94a3b8;margin-top:2px">${fmtDate(sigObj.at)}</div>` : '';
    return `<div style="flex:1;background:#fafafa;border:1.5px solid #e5e7eb;border-radius:10px;padding:10px 12px;text-align:center;border-top:3px solid ${color}">
      <div style="font-size:7pt;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">${role}</div>
      <div style="min-height:44px;display:flex;align-items:center;justify-content:center;margin-bottom:8px">${sigImg}</div>
      <div style="border-top:1px solid #e5e7eb;padding-top:7px">
        <div style="font-size:9.5pt;font-weight:800;color:#1a1a2e">${name}</div>${dt}
      </div>
    </div>`;
  };

  // ── Watermark ──
  const wmHtml = cfg.watermark
    ? `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:60pt;font-weight:900;color:rgba(0,0,0,${cfg.watermarkOpacity});white-space:nowrap;pointer-events:none;z-index:0;user-select:none">${cfg.watermark}</div>` : '';

  // ── Number to Thai baht text ──
  const bahtTxt = (n) => {
    if(!n||n===0) return 'ศูนย์บาทถ้วน';
    const ones=['','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
    const tens=['','สิบ','ยี่สิบ','สามสิบ','สี่สิบ','ห้าสิบ','หกสิบ','เจ็ดสิบ','แปดสิบ','เก้าสิบ'];
    const convert = (num) => {
      if(num===0) return '';
      if(num<10) return ones[num];
      if(num<100) return tens[Math.floor(num/10)] + (num%10?ones[num%10]:'');
      if(num<1000) return ones[Math.floor(num/100)]+'ร้อย'+convert(num%100);
      if(num<10000) return ones[Math.floor(num/1000)]+'พัน'+convert(num%1000);
      if(num<100000) return convert(Math.floor(num/10000))+'หมื่น'+convert(num%10000);
      if(num<1000000) return convert(Math.floor(num/100000))+'แสน'+convert(num%100000);
      return convert(Math.floor(num/1000000))+'ล้าน'+convert(num%1000000);
    };
    const intPart = Math.floor(n);
    const satPart = Math.round((n-intPart)*100);
    let txt = convert(intPart)+'บาท';
    if(satPart>0) txt += convert(satPart)+'สตางค์';
    else txt += 'ถ้วน';
    return txt;
  };

  // ── helpers for old html template ──
  var _esc = escapeHtml; // REFACTOR (audit #8): use global escapeHtml instead of local duplicate

  // ── Build HTML (NIL Engineering Quotation style) ──
  const quotNo = t.id;
  const todayBE = (() => {
    const d = new Date();
    return d.getDate().toString().padStart(2,'0') + '/' + (d.getMonth()+1).toString().padStart(2,'0') + '/' + (d.getFullYear()+543);
  })();
  const machineName = machine?.name || t.machine || '—';
  const machineBTU  = machine?.btu ? Number(machine.btu).toLocaleString() + ' BTU' : '—';
  const machineBrand= [machine?.mfrFCU, machine?.modelFCU].filter(Boolean).join(' ') || machine?.brandFCU || machine?.brandCDU || machine?.brand || 'Carrier';

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ใบเสนอราคา ${t.id}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Sarabun',Arial,sans-serif;font-size:9.5pt;color:#000;background:#c8c8c8;min-height:100vh;overflow-x:hidden}
.page{width:210mm;min-height:297mm;margin:12px auto;background:white;box-shadow:0 4px 24px rgba(0,0,0,.25);padding:10mm;transform-origin:top center}
@media screen{.page{margin:8px auto}}
@media print{body{background:white}html,body{width:210mm}.page{box-shadow:none;margin:0;padding:10mm;width:210mm;max-width:210mm;min-height:auto;transform:none!important}.no-print{display:none!important}@page{size:A4 portrait;margin:0}}
table{border-collapse:collapse;width:100%}
td,th{font-family:'Sarabun',Arial,sans-serif}
</style>
</head>
<body>
<div class="page">

  <!-- ══ HEADER ══ -->
  <table style="width:100%;border:1.5px solid #333;border-bottom:none;font-size:9pt" cellpadding="0" cellspacing="0">
    <tr>
      <!-- Logo cell -->
      <td style="width:85px;padding:8px 10px;border-right:1.5px solid #333;vertical-align:middle;text-align:center">
        ${cfg.logo
          ? `<img src="${cfg.logo}" style="width:70px;height:70px;object-fit:contain"/>`
          : `<svg width="70" height="70" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#333" stroke-width="3"/>
              <circle cx="50" cy="50" r="35" fill="none" stroke="#333" stroke-width="2"/>
              <line x1="50" y1="4" x2="50" y2="96" stroke="#333" stroke-width="2"/>
              <line x1="4" y1="50" x2="96" y2="50" stroke="#333" stroke-width="2"/>
              <line x1="20" y1="15" x2="80" y2="85" stroke="#333" stroke-width="1.5"/>
              <line x1="80" y1="15" x2="20" y2="85" stroke="#333" stroke-width="1.5"/>
              <circle cx="50" cy="50" r="10" fill="#333"/>
              <text x="50" y="54" text-anchor="middle" font-size="9" font-weight="900" fill="white" font-family="Arial">NIL</text>
              <text x="50" y="92" text-anchor="middle" font-size="7" font-weight="700" fill="#333" font-family="Arial">NIL</text>
            </svg>`}
        <div style="font-size:5.5pt;font-weight:800;color:#333;line-height:1.3;margin-top:2px">NIL ENGINEERING 2005<br>LIMITED PARTNERSHIP</div>
      </td>
      <!-- Company info -->
      <td style="padding:8px 12px;vertical-align:top;border-right:1.5px solid #333">
        <div style="font-size:12pt;font-weight:900;color:#000;line-height:1.2">ห้างหุ้นส่วนจำกัด นิล เอ็นจิเนียริ่ง 2005</div>
        <div style="font-size:8pt;margin-top:3px;color:#222">เลขที่ 12/1 ม.3 ต.วังศาลา อ.ท่าม่วง จ.กาญจนบุรี 71130</div>
        <div style="font-size:8pt;color:#222">Tel 090-4388533 &nbsp; Email nilengineering2005@hotmail.com</div>
        <div style="font-size:7.5pt;margin-top:12px;color:#444">เลขประจำตัวผู้เสียภาษี (Tax ID) &nbsp;<strong>713548000570</strong> &nbsp;&nbsp; สำนักงานใหญ่</div>
      </td>
      <!-- Doc type -->
      <td style="width:105px;padding:8px;vertical-align:middle;text-align:center">
        <div style="border:2px solid #333;padding:8px 12px;display:inline-block;min-width:85px">
          <div style="font-size:10pt;font-weight:900;color:#000;line-height:1.3">ใบเสนอราคา</div>
          <div style="font-size:9pt;font-weight:700;color:#222">Quotation</div>
        </div>
      </td>
    </tr>
  </table>

  <!-- ══ TO / REF BOX ══ -->
  <table style="width:100%;border-left:1.5px solid #333;border-right:1.5px solid #333;border-bottom:none;font-size:8.5pt" cellpadding="0" cellspacing="0">
    <tr>
      <!-- To info -->
      <td style="padding:7px 10px;border-right:1.5px solid #333;vertical-align:top;width:55%">
        <div style="border:1.5px solid #555;padding:7px 10px">
          <div style="font-weight:800;font-size:9pt">${_esc((machine&&machine.vendor&&getVendorMap()[machine.vendor])||getVendorMap()['SKIC']||'บริษัท สยามคราฟท์อุตสาหกรรม จำกัด')}</div>
          <div style="margin-top:3px">เรียน : ${reporter?.name||t.reporter||'ผู้รับผิดชอบ'}</div>
          <div style="margin-top:1px">สำเนา : ${tech?.name||t.assignee||'ช่างผู้รับผิดชอบ'} / ฝ่าย BP Electrical Maintenance</div>
          <div style="margin-top:1px">Tel. ${t.contact||'—'}</div>
        </div>
      </td>
      <!-- Doc ref table -->
      <td style="padding:0;vertical-align:top">
        <table style="width:100%;font-size:8pt;border-collapse:collapse">
          <tr>
            <td style="padding:5px 10px;border-bottom:1px solid #ccc;width:50%">เลขที่ใบเสนอราคา No.</td>
            <td style="padding:5px 10px;border-bottom:1px solid #ccc;font-weight:800;color:#000"><strong>${quotNo}</strong></td>
          </tr>
          <tr>
            <td style="padding:5px 10px;border-bottom:1px solid #ccc">วันที่ใบเสนอราคา Date</td>
            <td style="padding:5px 10px;border-bottom:1px solid #ccc;font-weight:700">${todayBE}</td>
          </tr>
          <tr>
            <td style="padding:5px 10px;border-bottom:1px solid #ccc">กำหนดยืนราคา Valid</td>
            <td style="padding:5px 10px;border-bottom:1px solid #ccc;font-weight:700">30 &nbsp;วัน</td>
          </tr>
          <tr>
            <td style="padding:5px 10px">เงื่อนไขการชำระ Payment</td>
            <td style="padding:5px 10px;font-weight:700">30 &nbsp;วัน</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- ══ JOB DESCRIPTION ══ -->
  <table style="width:100%;border-left:1.5px solid #333;border-right:1.5px solid #333;border-bottom:none;font-size:8.5pt" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:7px 10px">
        <strong>งาน : ซ่อมแอร์ห้อง ${machineName}</strong><br>
        <strong>ยี่ห้อ : ${machineBrand} &nbsp;&nbsp; ขนาด : ${machineBTU}</strong><br>
        มีความยินดีที่จะเสนอราคาสินค้าดังต่อไปนี้ &nbsp; Please to quote the following items
      </td>
    </tr>
  </table>

  <!-- ══ ITEMS TABLE ══ -->
  <table style="width:100%;border-left:1.5px solid #333;border-right:1.5px solid #333;border-bottom:none;font-size:8.5pt;border-collapse:collapse" cellpadding="0" cellspacing="0">
    <!-- Column headers -->
    <thead>
      <tr style="background:#f0f0f0">
        <th style="padding:6px 8px;border-right:1px solid #999;border-bottom:1.5px solid #333;text-align:center;width:32px;white-space:nowrap">ลำดับ<br><span style="font-weight:400;font-size:7pt">No.</span></th>
        <th style="padding:6px 8px;border-right:1px solid #999;border-bottom:1.5px solid #333;text-align:center;width:65px;white-space:nowrap">รหัสสินค้า<br><span style="font-weight:400;font-size:7pt">Code</span></th>
        <th style="padding:6px 8px;border-right:1px solid #999;border-bottom:1.5px solid #333;text-align:center">รายละเอียดสินค้า<br><span style="font-weight:400;font-size:7pt">Description</span></th>
        <th style="padding:6px 8px;border-right:1px solid #999;border-bottom:1.5px solid #333;text-align:center;width:52px;white-space:nowrap">จำนวน<br><span style="font-weight:400;font-size:7pt">Quantity</span></th>
        <th style="padding:6px 8px;border-right:1px solid #999;border-bottom:1.5px solid #333;text-align:center;width:40px;white-space:nowrap">หน่วย<br><span style="font-weight:400;font-size:7pt">Unit</span></th>
        <th style="padding:6px 8px;border-right:1px solid #999;border-bottom:1.5px solid #333;text-align:center;width:75px;white-space:nowrap">ราคาต่อหน่วย<br><span style="font-weight:400;font-size:7pt">Unit price</span></th>
        <th style="padding:6px 8px;border-bottom:1.5px solid #333;text-align:center;width:75px;white-space:nowrap">จำนวนเงิน<br><span style="font-weight:400;font-size:7pt">Amount</span></th>
      </tr>
    </thead>
    <tbody>
      ${quotRows.length ? quotRows.map((r,i)=>`
      <tr>
        <td style="padding:8px 6px;border-right:1px solid #ddd;border-bottom:1px solid #eee;text-align:center;font-size:9pt">${i+1}</td>
        <td style="padding:8px 8px;border-right:1px solid #ddd;border-bottom:1px solid #eee;text-align:center;font-size:8pt;color:#555">${String(i+1).padStart(2,'0')}-${String(Math.floor(Math.random()*900)+100)}</td>
        <td style="padding:8px 10px;border-right:1px solid #ddd;border-bottom:1px solid #eee;font-size:9pt">${formatItemName(r.name, machine&&machine.btu?Number(machine.btu):0)||'—'}</td>
        <td style="padding:8px 6px;border-right:1px solid #ddd;border-bottom:1px solid #eee;text-align:center;font-size:9pt">${r.qty>0?Number(r.qty).toLocaleString('en-US',{minimumFractionDigits:2}):'—'}</td>
        <td style="padding:8px 6px;border-right:1px solid #ddd;border-bottom:1px solid #eee;text-align:center;font-size:8.5pt">${r.unit||'JOB'}</td>
        <td style="padding:8px 8px;border-right:1px solid #ddd;border-bottom:1px solid #eee;text-align:right;font-size:9pt">${r.unitPrice>0?r.unitPrice.toLocaleString('en-US',{minimumFractionDigits:2}):'—'}</td>
        <td style="padding:8px 8px;border-bottom:1px solid #eee;text-align:right;font-size:9pt">${r.total>0?r.total.toLocaleString('en-US',{minimumFractionDigits:2}):'—'}</td>
      </tr>`).join('')
      : `<tr><td colspan="7" style="padding:16px;text-align:center;color:#999;font-size:8.5pt">— ไม่มีรายการงาน —</td></tr>`}
      <!-- empty rows for visual spacing (like original) -->
      ${Array(Math.max(0,8-quotRows.length)).fill(0).map(()=>`
      <tr style="height:26px">
        <td style="border-right:1px solid #ddd;border-bottom:1px solid #eee"></td>
        <td style="border-right:1px solid #ddd;border-bottom:1px solid #eee"></td>
        <td style="border-right:1px solid #ddd;border-bottom:1px solid #eee"></td>
        <td style="border-right:1px solid #ddd;border-bottom:1px solid #eee"></td>
        <td style="border-right:1px solid #ddd;border-bottom:1px solid #eee"></td>
        <td style="border-right:1px solid #ddd;border-bottom:1px solid #eee"></td>
        <td style="border-bottom:1px solid #eee"></td>
      </tr>`).join('')}
    </tbody>
  </table>

  <!-- ══ REMARK + TOTALS ══ -->
  <table style="width:100%;border-left:1.5px solid #333;border-right:1.5px solid #333;border-bottom:none;font-size:8.5pt;border-collapse:collapse" cellpadding="0" cellspacing="0">
    <tr>
      <!-- Remark left -->
      <td style="padding:10px 12px;border-right:1.5px solid #333;vertical-align:top;width:55%">
        <div style="font-weight:700;margin-bottom:6px">หมายเหตุ (Remark)</div>
        ${t.note ? `<div style="font-size:8pt;color:#333;line-height:1.6">${t.note}</div>` : ''}
        ${summaryDesc ? `<div style="font-size:8pt;color:#333;margin-top:4px;line-height:1.6">${summaryDesc}</div>` : ''}
        <div style="margin-top:20px;font-size:11pt;font-weight:700;color:#555;letter-spacing:0.02em">${t.id}</div>
      </td>
      <!-- Totals right -->
      <td style="padding:0;vertical-align:top">
        <table style="width:100%;font-size:8.5pt;border-collapse:collapse">
          <tr>
            <td style="padding:5px 10px;border-bottom:1px solid #ccc;font-weight:700">รวมเงิน<br><span style="font-weight:400;font-size:7.5pt">Total</span></td>
            <td style="padding:5px 10px;border-bottom:1px solid #ccc;text-align:right;font-weight:700">${baseCost>0?baseCost.toLocaleString('en-US',{minimumFractionDigits:2}):'—'}</td>
          </tr>
          <tr>
            <td style="padding:5px 10px;border-bottom:1px solid #ccc">ส่วนลด<br><span style="font-size:7.5pt">Discount</span></td>
            <td style="padding:5px 10px;border-bottom:1px solid #ccc;text-align:right"></td>
          </tr>
          <tr>
            <td style="padding:5px 10px;border-bottom:1px solid #ccc;font-weight:700">จำนวนเงินหลังหักส่วนลด<br><span style="font-weight:400;font-size:7.5pt">After Discount</span></td>
            <td style="padding:5px 10px;border-bottom:1px solid #ccc;text-align:right;font-weight:700">${baseCost>0?baseCost.toLocaleString('en-US',{minimumFractionDigits:2}):'—'}</td>
          </tr>
          <tr>
            <td style="padding:5px 10px;border-bottom:1px solid #ccc;font-weight:700">จำนวนภาษีมูลค่าเพิ่ม<br><span style="font-weight:400;font-size:7.5pt">VAT Amount</span></td>
            <td style="padding:5px 10px;border-bottom:1px solid #ccc;text-align:right;font-weight:700">${vatAmt>0?vatAmt.toLocaleString('en-US',{minimumFractionDigits:2}):'—'}</td>
          </tr>
          <tr style="background:#f5f5f5">
            <td style="padding:6px 10px;font-weight:900;font-size:9pt">จำนวนเงินรวมทั้งสิ้น<br><span style="font-weight:400;font-size:7.5pt">Grand Total</span></td>
            <td style="padding:6px 10px;text-align:right;font-weight:900;font-size:11pt">${grandTotal>0?grandTotal.toLocaleString('en-US',{minimumFractionDigits:2}):'—'}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- ══ AMOUNT IN WORDS ══ -->
  <table style="width:100%;border-left:1.5px solid #333;border-right:1.5px solid #333;border-bottom:none;font-size:8.5pt" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:6px 12px;text-align:center;font-weight:700">
        (${grandTotal>0 ? bahtTxt(grandTotal) : 'ศูนย์บาทถ้วน'})
      </td>
    </tr>
  </table>

  <!-- ══ SIGNATURES ══ -->
  <table style="width:100%;border:1.5px solid #333;font-size:8.5pt;border-collapse:collapse" cellpadding="0" cellspacing="0">
    <tr>
      <!-- Confirm sig -->
      <td style="padding:12px 10px;border-right:1.5px solid #333;text-align:center;vertical-align:bottom;width:33%">
        <div style="min-height:60px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:6px">
          ${t.signatures?.reporter?.data ? `<img src="${t.signatures.reporter.data}" style="height:50px;max-width:130px;object-fit:contain"/>` : '<div style="height:50px"></div>'}
        </div>
        <div style="border-top:1.5px solid #555;padding-top:5px">
          <div style="font-size:7.5pt;color:#555">ตกลงตามรายการข้างต้น</div>
          <div style="font-size:7.5pt;color:#555;margin-top:1px">Confirmation</div>
          <div style="margin-top:4px;font-size:8pt;font-weight:700">${reporter?.name||t.reporter||'ผู้รับผิดชอบ'}</div>
        </div>
      </td>
      <!-- Best regards sig -->
      <td style="padding:12px 10px;border-right:1.5px solid #333;text-align:center;vertical-align:bottom;width:33%">
        <div style="min-height:60px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:6px">
          ${t.signatures?.tech?.data ? `<img src="${t.signatures.tech.data}" style="height:50px;max-width:130px;object-fit:contain"/>` : '<div style="height:50px"></div>'}
        </div>
        <div style="border-top:1.5px solid #555;padding-top:5px">
          <div style="font-size:7.5pt;color:#555">ขอแสดงความนับถือ</div>
          <div style="font-size:7.5pt;color:#555;margin-top:1px">Best Regards</div>
          <div style="margin-top:4px;font-size:8pt;font-weight:700">${tech?.name||t.assignee||'นายเดชา ห่วงนิล'}</div>
        </div>
      </td>
      <!-- Company stamp -->
      <td style="padding:12px 10px;text-align:center;vertical-align:middle;width:33%">
        <div style="display:inline-block">
          ${cfg.logo
            ? `<img src="${cfg.logo}" style="width:65px;height:65px;object-fit:contain;border-radius:50%;border:2px solid #333;padding:4px"/>`
            : `<svg width="80" height="80" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="46" fill="none" stroke="#1a5276" stroke-width="3"/>
                <circle cx="50" cy="50" r="38" fill="none" stroke="#1a5276" stroke-width="1.5"/>
                <circle cx="50" cy="50" r="12" fill="none" stroke="#1a5276" stroke-width="2"/>
                <line x1="50" y1="4" x2="50" y2="38" stroke="#1a5276" stroke-width="2"/>
                <line x1="50" y1="62" x2="50" y2="96" stroke="#1a5276" stroke-width="2"/>
                <line x1="4" y1="50" x2="38" y2="50" stroke="#1a5276" stroke-width="2"/>
                <line x1="62" y1="50" x2="96" y2="50" stroke="#1a5276" stroke-width="2"/>
                <line x1="18" y1="18" x2="42" y2="42" stroke="#1a5276" stroke-width="1.5"/>
                <line x1="58" y1="58" x2="82" y2="82" stroke="#1a5276" stroke-width="1.5"/>
                <line x1="82" y1="18" x2="58" y2="42" stroke="#1a5276" stroke-width="1.5"/>
                <line x1="42" y1="58" x2="18" y2="82" stroke="#1a5276" stroke-width="1.5"/>
                <text x="50" y="53" text-anchor="middle" font-size="10" font-weight="900" fill="#1a5276" font-family="Arial">NIL</text>
                <text x="50" y="73" text-anchor="middle" font-size="5.5" font-weight="700" fill="#1a5276" font-family="Arial">NIL ENGINEERING 2005</text>
                <text x="50" y="80" text-anchor="middle" font-size="4.5" font-weight="600" fill="#1a5276" font-family="Arial">LIMITED PARTNERSHIP</text>
              </svg>`}
        </div>
      </td>
    </tr>
  </table>

</div><!-- end page -->
</body></html>`;

  // ══════════════════════════════════════════════
  // QUOTATION DESIGNER OVERLAY  (linked to ticket)
  // ══════════════════════════════════════════════
  let ov = document.getElementById('_pdf_overlay');
  if(ov) ov.remove();
  ov = document.createElement('div');
  ov.id = '_pdf_overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99998;background:#1a1a1a;display:flex;flex-direction:column;font-family:"Noto Sans Thai",sans-serif;';

  // ── Pull ONLY repair rows (exclude PO/spare-part rows) ──
  // กรองเฉพาะรายการซ่อมจริง — ถ้าไม่มีรายการเลย ไม่ auto-fill
  // parse repair items จาก summary (รองรับน้ำยาแบบ kg)
    var _parseForDS = function() {
    const rows = [];
    const raw = (t.summary||'');
    const dashIdx = raw.indexOf(' \u2014 ');
    const _isNewFmt2 = raw.includes('\n');
    const _repLines2 = _isNewFmt2
      ? raw.split('\n').filter(Boolean)
      : (dashIdx >= 0 ? raw.slice(0, dashIdx) : raw).split(',').map(s=>s.trim()).filter(Boolean);
    _repLines2.forEach(seg => {
      const c = seg.trim().replace(/^[-\u2013\u2022\u00B7*]+\s*/, '').trim();
      if (!c) return;
      const mx = c.match(/^(.+?)\s*[\u00D7\u2715xX](\d+)\s*$/);
      if (mx) { rows.push({name: mx[1].trim(), qty: parseInt(mx[2])||1}); return; }
      const mkWm = c.match(/(สารทำความเย็น[^\d]*|น้ำยา[^\d]*)(R-\w+)\s*(\d+(?:\.\d+)?)\s*กก/);
      if (mkWm) { rows.push({name:'น้ำยา '+mkWm[2]+' (ต่อ กก.)', qty:parseFloat(mkWm[3])||1}); return; }
      rows.push({name: c, qty: 1});
    });
    if (!rows.length) {
      raw.split('\n').forEach(line => {
        const s = line.trim(); if (!s) return;
        const c = s.replace(/^[-\u2013\u2014\u2022\u00B7*]+\s*/, '').trim(); if (!c) return;
        const mx = c.match(/^(.+?)\s*[\u00D7\u2715xX](\d+)\s*$/);
        if (mx) { rows.push({name: mx[1].trim(), qty: parseInt(mx[2])||1}); return; }
        const mkWm = c.match(/(สารทำความเย็น[^\d]*|น้ำยา[^\d]*)(R-\w+)\s*(\d+(?:\.\d+)?)\s*กก/);
        if (mkWm) { rows.push({name:'น้ำยา '+mkWm[2]+' (ต่อ กก.)', qty:parseFloat(mkWm[3])||1}); return; }
        rows.push({name: c, qty: 1});
      });
    }
    return rows;
  };
    var _dsRepairOnlyRows = _parseForDS().length
    ? _parseForDS()
        .filter(r => r.name && r.name.trim() !== '')
        // กรองรายการที่เป็น combined repair tag (มี comma = รวมหลายรายการ)
        .map(r => { const {price,unit}=getPrice(r.name); return {code:'',name:r.name,qty:r.qty,unit,price}; })
    : [
        // ตัวอย่าง — แสดงเมื่อยังไม่มีรายการจริง
        {code:'', name:'ค่าแรงซ่อมเครื่องปรับอากาศ', qty:1, unit:'JOB', price:1500},
        {code:'', name:'น้ำยาทำความสะอาดคอล์ยร้อน', qty:1, unit:'EA',  price:350},
      ];

  // ── State for designer ──
  var DS = {
    company:     'ห้างหุ้นส่วนจำกัด นิล เอ็นจิเนียริ่ง 2005',
    logoSubLine: 'NIL ENGINEERING 2005\nLIMITED PARTNERSHIP',
    address:     'เลขที่ 12/1 ม.3 ต.วังศาลา อ.ท่าม่วง จ.กาญจนบุรี 71130',
    tel:         '090-4388533',
    email:       'nilengineering2005@hotmail.com',
    taxid:       '713548000570',
    logoData:    cfg.logo || '',
    quotationImg: cfg.quotationImg || '',
    quotNo:      (()=>{
      // แปลง TK+MMYYYY+seq → TKmm-yyyy-seq
      const raw = t.id || '';
      const m = raw.match(/^TK(\d{2})(\d{4})(\d+)$/);
      if (m) return 'TK' + m[1] + '-' + m[2] + '-' + String(parseInt(m[3])).padStart(3,'0');
      return raw;
    })(),
    dateStr:     new Date().toISOString().slice(0,10),
    validDays:   '30',
    paymentDays: '30',
    custCompany: (machine?.vendor && getVendorMap()[machine.vendor]) ? getVendorMap()[machine.vendor] : 'บริษัท สยามคราฟท์อุตสาหกรรม จำกัด',
    vendorCode:  machine?.vendor || 'SKIC',
    attn:        (reporter?.name || t.reporter || '') + (reporter?.dept ? ' / ' + reporter.dept : ''),
    cc:          (tech?.name || t.assignee || '') + (tech?.dept ? ' / ' + tech.dept : ''),
    custTel:     t.contact || '',
    job:         'ซ่อมแอร์ห้อง ' + (t.machine || (machine?.location) || (machine?.name) || t.problem || '—'),
    brand:       [machine?.mfrFCU, machine?.modelFCU].filter(Boolean).join(' ') || machine?.brandFCU || machine?.brandCDU || machine?.brand || 'Carrier',
    fcuModel:    [machine?.mfrFCU, machine?.modelFCU].filter(Boolean).join(' ') || machine?.brandFCU || '—',
    cduModel:    [machine?.mfrCDU, machine?.modelCDU].filter(Boolean).join(' ') || machine?.brandCDU || '—',
    btu:         machine?.btu ? Number(machine.btu).toLocaleString()+' BTU' : '',
    rawBTU:      machine?.btu ? Number(machine.btu) : 0,
    remark:      t.note || '',
    sellerSig:   tech?.name || t.assignee || 'นายเดชา ห่วงนิล',
    buyerSig:    reporter?.name || t.reporter || '',
    rows:        _dsRepairOnlyRows,
    formCollapsed: false,
  };

  // ── bahtText helper ──
  var _baht = function(n) {
    if(!n||n===0) return 'ศูนย์บาทถ้วน';
    const ones=['','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
    const tens=['','สิบ','ยี่สิบ','สามสิบ','สี่สิบ','ห้าสิบ','หกสิบ','เจ็ดสิบ','แปดสิบ','เก้าสิบ'];
    const cv=(num)=>{
      if(num===0)return '';if(num<10)return ones[num];if(num<100)return tens[Math.floor(num/10)]+(num%10?ones[num%10]:'');
      if(num<1000)return ones[Math.floor(num/100)]+'ร้อย'+cv(num%100);if(num<10000)return ones[Math.floor(num/1000)]+'พัน'+cv(num%1000);
      if(num<100000)return cv(Math.floor(num/10000))+'หมื่น'+cv(num%10000);if(num<1000000)return cv(Math.floor(num/100000))+'แสน'+cv(num%100000);
      return cv(Math.floor(n/1000000))+'ล้าน'+cv(n%1000000);
    };
    const ip=Math.floor(n),sp=Math.round((n-ip)*100);
    return cv(ip)+'บาท'+(sp>0?cv(sp)+'สตางค์':'ถ้วน');
  };
  var _fmtDate=(s)=>{if(!s)return'—';try{const[y,m,d]=s.split('-');return`${parseInt(d)}/${m}/${parseInt(y)+543}`;}catch(e){return s;}};
  var _fmt=(n)=>n>0?n.toLocaleString('en-US',{minimumFractionDigits:2}):'—';
  var _esc = escapeHtml; // REFACTOR (audit #8): use global escapeHtml instead of local duplicate

  // ── build print HTML ──
   var buildHTML = function() {
    // แสดงเฉพาะรายการที่มีค่าใช้จ่าย (price > 0)
    var paidRows = DS.rows.filter(function(r){ return (r.price||0) > 0; });
    var sub   = paidRows.reduce(function(s,r){return s+(r.qty*r.price);},0);
    var vat   = Math.round(sub*0.07*100)/100;
    var grand = sub+vat;
    var empty = Math.max(0,8-paidRows.length);
    var nilSVG = function(w,h){ return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="46" fill="none" stroke="#1a5276" stroke-width="3"/><circle cx="50" cy="50" r="36" fill="none" stroke="#1a5276" stroke-width="1.5"/><circle cx="50" cy="50" r="11" fill="none" stroke="#1a5276" stroke-width="2"/><line x1="50" y1="4" x2="50" y2="39" stroke="#1a5276" stroke-width="2"/><line x1="50" y1="61" x2="50" y2="96" stroke="#1a5276" stroke-width="2"/><line x1="4" y1="50" x2="39" y2="50" stroke="#1a5276" stroke-width="2"/><line x1="61" y1="50" x2="96" y2="50" stroke="#1a5276" stroke-width="2"/><line x1="18" y1="18" x2="42" y2="42" stroke="#1a5276" stroke-width="1.5"/><line x1="58" y1="58" x2="82" y2="82" stroke="#1a5276" stroke-width="1.5"/><line x1="82" y1="18" x2="58" y2="42" stroke="#1a5276" stroke-width="1.5"/><line x1="42" y1="58" x2="18" y2="82" stroke="#1a5276" stroke-width="1.5"/><text x="50" y="54" text-anchor="middle" font-size="11" font-weight="900" fill="#1a5276" font-family="Arial">NIL</text><text x="50" y="76" text-anchor="middle" font-size="5.5" font-weight="700" fill="#1a5276" font-family="Arial">NIL ENGINEERING 2005</text><text x="50" y="83" text-anchor="middle" font-size="4.5" font-weight="600" fill="#1a5276" font-family="Arial">LIMITED PARTNERSHIP</text></svg>'; };
    var logoCell  = DS.logoData ? '<img src="'+DS.logoData+'" style="width:68px;height:68px;object-fit:contain"/>' : nilSVG(68,68);
    var stampCell = DS.logoData ? '<img src="'+DS.logoData+'" style="width:80px;height:80px;object-fit:contain"/>' : nilSVG(80,80);
    var E = _esc;
    var stampCell = '<div style="display:inline-flex;flex-direction:column;align-items:center;gap:4px">'
      + (DS.logoData ? '<img src="'+DS.logoData+'" style="width:80px;height:80px;object-fit:contain"/>' : nilSVG(80,80))
      + '<div style="font-size:6pt;font-weight:800;color:#1a5276;text-align:center;line-height:1.5;white-space:pre-line">'+E(DS.logoSubLine||DS.company||'')+'</div>'
      + '</div>';
    var rowsHtml = paidRows.map(function(r,i){
      return '<tr>'
        +'<td style="padding:7px 4px;border-right:1px solid #ccc;text-align:center;font-size:9pt">'+(i+1)+'</td>'
        +'<td style="padding:7px 8px;border-right:1px solid #ccc;text-align:center;font-size:8pt;color:#444">'+E(r.code||'—')+'</td>'
        +'<td style="padding:7px 10px;border-right:1px solid #ccc;font-size:9pt">'+E(formatItemName(r.name, DS.rawBTU||0))+'</td>'
        +'<td style="padding:7px 4px;border-right:1px solid #ccc;text-align:center;font-size:9pt">'+(r.qty>0?Number(r.qty).toFixed(2):'—')+'</td>'
        +'<td style="padding:7px 4px;border-right:1px solid #ccc;text-align:center;font-size:8.5pt">'+E(r.unit||'JOB')+'</td>'
        +'<td style="padding:7px 7px;border-right:1px solid #ccc;text-align:right;font-size:9pt">'+Number(r.price).toLocaleString('en-US',{minimumFractionDigits:2})+'</td>'
        +'<td style="padding:7px 7px;text-align:right;font-size:9pt">'+(r.qty*r.price>0?(r.qty*r.price).toLocaleString('en-US',{minimumFractionDigits:2}):'—')+'</td>'
        +'</tr>';
    }).join('');
    var emptyRows='';
    for(var ei=0;ei<empty;ei++) emptyRows+='<tr style="height:26px"><td style="border-right:1px solid #ddd;border-bottom:1px solid #f0f0f0"></td><td style="border-right:1px solid #ddd;border-bottom:1px solid #f0f0f0"></td><td style="border-right:1px solid #ddd;border-bottom:1px solid #f0f0f0"></td><td style="border-right:1px solid #ddd;border-bottom:1px solid #f0f0f0"></td><td style="border-right:1px solid #ddd;border-bottom:1px solid #f0f0f0"></td><td style="border-right:1px solid #ddd;border-bottom:1px solid #f0f0f0"></td><td style="border-bottom:1px solid #f0f0f0"></td></tr>';

    return '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">'
    +'<meta name="viewport" content="width=device-width,initial-scale=1">'
    +'<title>ใบเสนอราคา '+E(DS.quotNo)+'</title>'
    +'<style>'
    +'@import url(\'https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800;900&display=swap\');'
    +'*{margin:0;padding:0;box-sizing:border-box}'
    +'body{font-family:\'Sarabun\',Arial,sans-serif;font-size:9.5pt;color:#000;background:#bfbfbf}'
    +'.page{width:100%;max-width:210mm;min-height:297mm;margin:12px auto;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.2);padding:10mm}'
    +'table{border-collapse:collapse;width:100%}'
    +'td,th{font-family:\'Sarabun\',Arial,sans-serif}'
    +'@media print{body{background:#fff}.page{margin:0;padding:10mm;box-shadow:none;width:100%}@page{size:A4;margin:0}}'
    +'</style></head><body><div class="page">'

    /* HEADER — ไม่มีกรอบนอก */
    +'<table style="width:100%;margin-bottom:0">'
    +'<tr>'
    +'<td style="width:88px;padding:8px 8px 8px 0;text-align:center;vertical-align:middle">'+logoCell+'<div style="font-size:5pt;font-weight:800;color:#1a5276;line-height:1.5;margin-top:3px;font-family:Arial;white-space:pre-line">'+E(DS.logoSubLine||'')+'</div></td>'
    +'<td style="padding:9px 14px;vertical-align:top">'
    +'<div style="font-size:12pt;font-weight:900;margin-bottom:3px">'+E(DS.company)+'</div>'
    +'<div style="font-size:7.5pt;color:#333;margin-bottom:2px">'+E(DS.address)+'</div>'
    +'<div style="font-size:7.5pt;color:#333;margin-bottom:4px">Tel '+E(DS.tel)+'&nbsp;&nbsp; Email '+E(DS.email)+'</div>'
    +'<div style="font-size:7pt;margin-top:12px;color:#555">เลขประจำตัวผู้เสียภาษี (Tax ID) &nbsp;<strong>'+E(DS.taxid)+'</strong>&nbsp;&nbsp; สำนักงานใหญ่</div>'
    +'</td>'
    +(DS.quotationImg?'<td style="padding:8px;vertical-align:middle;text-align:center"><img src="'+DS.quotationImg+'" style="max-width:90px;max-height:80px;object-fit:contain;border-radius:3px"/></td>':'<td style="width:10px"></td>')
    +'<td style="width:110px;padding:8px 0 8px 8px;text-align:center;vertical-align:middle">'
    +'<div style="display:flex;flex-direction:column;align-items:center;gap:5px">'
    +'<div style="border:1.5px solid #555;border-radius:2px;padding:7px 5px;display:inline-block;min-width:76px">'
    +'<div style="font-size:10pt;font-weight:900">ใบเสนอราคา</div>'
    +'<div style="font-size:8pt;font-weight:700;color:#444">Quotation</div>'
    +'</div></div></td>'
    +'</tr></table>'
    +'<hr style="border:none;border-top:1.5px solid #333;margin:4px 0">'

    /* TO / REF — ไม่มีกรอบนอก */
    +'<table style="width:100%;margin-bottom:0">'
    +'<tr>'
    +'<td style="padding:8px 10px 8px 0;vertical-align:top;width:56%">'
    +'<div style="border:1px solid #999;border-radius:2px;padding:7px 10px">'
    +'<div style="font-weight:800;font-size:9pt;margin-bottom:3px">'+E(DS.custCompany)+'</div>'
    +'<div style="font-size:8.5pt;margin-bottom:2px">เรียน : '+E(DS.attn)+'</div>'
    +'<div style="font-size:8.5pt;margin-bottom:2px">สำเนา : '+E(DS.cc)+'</div>'
    +'<div style="font-size:8.5pt">Tel. '+E(DS.custTel)+'</div>'
    +'</div></td>'
    +'<td style="padding:0;vertical-align:top">'
    +'<table style="font-size:8.5pt;width:100%">'
    +'<tr><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0">เลขที่ใบเสนอราคา No.</td><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;font-weight:800">'+E(DS.quotNo)+'</td></tr>'
    +'<tr><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0">วันที่ใบเสนอราคา Date</td><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;font-weight:700">'+_fmtDate(DS.dateStr)+'</td></tr>'
    +'<tr><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0">กำหนดยืนราคา Valid</td><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;font-weight:700">'+E(DS.validDays)+' วัน</td></tr>'
    +'<tr><td style="padding:5px 10px">เงื่อนไขการชำระ Payment</td><td style="padding:5px 10px;font-weight:700">'+E(DS.paymentDays)+' วัน</td></tr>'
    +'</table></td>'
    +'</tr></table>'
    +'<hr style="border:none;border-top:1px solid #ccc;margin:4px 0">'

    /* JOB — ไม่มีกรอบนอก */
    +'<div style="padding:6px 4px;font-size:8.5pt;line-height:1.8;border-bottom:1px solid #ccc;margin-bottom:4px">'
    +'<strong>งาน : '+E(DS.job)+'</strong><br>'
    +'<strong>ยี่ห้อ (FCU) : '+E(DS.fcuModel||DS.brand)+'&nbsp;&nbsp; (CDU) : '+E(DS.cduModel||DS.brand)+'&nbsp;&nbsp; ขนาด : '+E(DS.btu)+'</strong><br>'
    +'มีความยินดีที่จะเสนอราคาสินค้าดังต่อไปนี้ &nbsp; Please to quote the following items'
    +'</div>'

    /* ITEMS — กรอบนอก + เส้นแบ่งใน */
    +'<table style="width:100%;border-collapse:collapse;border:1.5px solid #aaa">'
    +'<thead><tr style="background:#f2f2f2">'
    +'<th style="padding:6px 4px;border-right:1px solid #bbb;border-bottom:1.5px solid #aaa;text-align:center;width:26px;font-size:8pt">ลำดับ<br><span style="font-weight:400;font-size:6.5pt">No.</span></th>'
    +'<th style="padding:6px 8px;border-right:1px solid #bbb;border-bottom:1.5px solid #aaa;text-align:center;width:60px;font-size:8pt">รหัสสินค้า<br><span style="font-weight:400;font-size:6.5pt">Code</span></th>'
    +'<th style="padding:6px 8px;border-right:1px solid #bbb;border-bottom:1.5px solid #aaa;text-align:center;font-size:8pt">รายละเอียดสินค้า<br><span style="font-weight:400;font-size:6.5pt">Description</span></th>'
    +'<th style="padding:6px 4px;border-right:1px solid #bbb;border-bottom:1.5px solid #aaa;text-align:center;width:46px;font-size:8pt">จำนวน<br><span style="font-weight:400;font-size:6.5pt">Quantity</span></th>'
    +'<th style="padding:6px 4px;border-right:1px solid #bbb;border-bottom:1.5px solid #aaa;text-align:center;width:36px;font-size:8pt">หน่วย<br><span style="font-weight:400;font-size:6.5pt">Unit</span></th>'
    +'<th style="padding:6px 4px;border-right:1px solid #bbb;border-bottom:1.5px solid #aaa;text-align:center;width:68px;font-size:8pt">ราคาต่อหน่วย<br><span style="font-weight:400;font-size:6.5pt">Unit price</span></th>'
    +'<th style="padding:6px 4px;border-bottom:1.5px solid #aaa;text-align:center;width:68px;font-size:8pt">จำนวนเงิน<br><span style="font-weight:400;font-size:6.5pt">Amount</span></th>'
    +'</tr></thead>'
    +'<tbody>'+rowsHtml+emptyRows+'</tbody>'
    +'</table>'

    /* REMARK + TOTALS — กรอบนอก ต่อจาก items */
    +'<table style="width:100%;border-collapse:collapse;border:1.5px solid #aaa;border-top:none">'
    +'<tr>'
    +'<td style="padding:10px 12px;border-right:1px solid #ccc;vertical-align:top;width:55%">'
    +'<div style="font-weight:700;margin-bottom:5px;font-size:8.5pt">หมายเหตุ (Remark)</div>'
    +(DS.remark?'<div style="font-size:8pt;color:#333;line-height:1.7;white-space:pre-wrap">'+E(DS.remark)+'</div>':'<div style="min-height:28px"></div>')
    +'</td>'
    +'<td style="padding:0;vertical-align:top">'
    +'<table style="font-size:8.5pt;width:100%">'
    +'<tr><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;font-weight:700">รวมเงิน<br><span style="font-weight:400;font-size:7pt">Total</span></td><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;text-align:right;font-weight:700">'+_fmt(sub)+'</td></tr>'
    +'<tr><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0">ส่วนลด<br><span style="font-size:7pt">Discount</span></td><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;text-align:right"></td></tr>'
    +'<tr><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;font-weight:700">จำนวนเงินหลังหักส่วนลด<br><span style="font-weight:400;font-size:7pt">After Discount</span></td><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;text-align:right;font-weight:700">'+_fmt(sub)+'</td></tr>'
    +'<tr><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;font-weight:700">จำนวนภาษีมูลค่าเพิ่ม<br><span style="font-weight:400;font-size:7pt">VAT Amount</span></td><td style="padding:5px 10px;border-bottom:1px solid #e0e0e0;text-align:right;font-weight:700">'+_fmt(vat)+'</td></tr>'
    +'<tr style="background:#f0f0f0"><td style="padding:6px 10px;font-weight:900;font-size:9pt">จำนวนเงินรวมทั้งสิ้น<br><span style="font-weight:400;font-size:7pt">Grand Total</span></td><td style="padding:6px 10px;text-align:right;font-weight:900;font-size:11pt">'+_fmt(grand)+'</td></tr>'
    +'</table></td>'
    +'</tr></table>'

    /* AMOUNT IN WORDS — กรอบต่อ */
    +'<table style="width:100%;border-collapse:collapse;border:1.5px solid #aaa;border-top:none">'
    +'<tr><td style="padding:5px 12px;text-align:center;font-weight:700;font-size:8.5pt">'
    +'('+( grand>0?_baht(grand):'ศูนย์บาทถ้วน')+')'
    +'</td></tr>'
    +'</table>'

    /* SIGNATURES */
    +'<table style="width:100%;border-collapse:collapse;margin-top:12px">'
    +'<tr>'
    +'<td style="padding:14px 16px;border-right:1px solid #e0e0e0;text-align:center;vertical-align:bottom;width:33%">'
    +(t.signatures?.reporter?.data
      ? '<div style="min-height:55px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:5px"><img src="'+t.signatures.reporter.data+'" style="height:50px;max-width:130px;object-fit:contain"/></div>'
      : '<div style="height:48px;border-bottom:1px dashed #bbb;margin-bottom:6px"></div>')
    +'<div style="font-size:7.5pt;color:#555">ตกลงตามรายการข้างต้น</div>'
    +'<div style="font-size:7pt;color:#888">Confirmation</div>'
    +'<div style="margin-top:5px;font-size:8.5pt;font-weight:700">'+(E(DS.buyerSig)||'(                    )')+'</div>'
    +'</td>'
    +'<td style="padding:14px 16px;border-right:1px solid #e0e0e0;text-align:center;vertical-align:bottom;width:33%">'
    +(t.signatures?.tech?.data
      ? '<div style="min-height:55px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:5px"><img src="'+t.signatures.tech.data+'" style="height:50px;max-width:130px;object-fit:contain"/></div>'
      : '<div style="height:48px;border-bottom:1px dashed #bbb;margin-bottom:6px"></div>')
    +'<div style="font-size:7.5pt;color:#555">ขอแสดงความนับถือ</div>'
    +'<div style="font-size:7pt;color:#888">Best Regards</div>'
    +'<div style="margin-top:5px;font-size:8.5pt;font-weight:700">'+E(DS.sellerSig)+'</div>'
    +'</td>'
    +'<td style="padding:14px 16px;text-align:center;vertical-align:middle;width:33%">'+stampCell+'</td>'
    +'</tr></table>'
    +'</div></body></html>';
  };

  // ── Render iframe ──
  var renderPreview = function() {
    const fr = document.getElementById('_ds_iframe');
    if(!fr) return;
    const h = buildHTML();
    const applyScale = () => {
      try {
        const doc = fr.contentDocument;
        if(!doc || !doc.body) return;
        const page = doc.querySelector('.page');
        if(!page) return;
        const container = fr.parentElement;
        const isMob = window.innerWidth < 768;
        const pad = isMob ? 4 : 32;
        const viewW = (container ? container.clientWidth : window.innerWidth) - pad;
        const pageW = 794; // A4 at 96dpi
        const scale = Math.min(1, viewW / pageW);
        page.style.transformOrigin = 'top left';
        page.style.transform = 'scale('+scale+')';
        page.style.margin = '0';
        doc.body.style.margin = '0';
        doc.body.style.padding = '8px';
        doc.body.style.background = '#c0c6cc';
        doc.body.style.overflow = 'auto'; // ← ให้ scroll ได้
        doc.body.style.boxSizing = 'border-box';
        // คำนวณ iframe height จากขนาดเนื้อหาจริงหลัง scale
        const naturalH = page.getBoundingClientRect().height || doc.body.scrollHeight || 900;
        const scaledH = naturalH * scale + 60;
        fr.style.height = Math.max(500, scaledH) + 'px';
        fr.style.minHeight = '';
      } catch(e){}
    };
    const blob = new Blob([h],{type:'text/html;charset=utf-8'});
    fr.onload = function(){
      setTimeout(applyScale, 80);
      setTimeout(applyScale, 400);
      setTimeout(applyScale, 900);
    };
    fr.src = URL.createObjectURL(blob);
  };

  // ── Row helpers ──
  var dsAddRow = function() { DS.rows.push({code:'',name:'',qty:1,unit:'JOB',price:0}); dsRenderRows(); renderPreview(); };
  var dsDelRow = function(i) { DS.rows.splice(i,1); dsRenderRows(); renderPreview(); };
  var dsUpdateRow = function(i,field,val) { DS.rows[i][field] = (field==='qty'||field==='price') ? (parseFloat(val)||0) : val; renderPreview(); };
  // debounce helper (ถ้ายังไม่มี — ป้องกัน render ทุก keystroke)
  var _localDebounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  var dsUpdateRowDebounced = _localDebounce(dsUpdateRow, 200);

  var dsRenderRows = function() {
    const el = document.getElementById('_ds_rows');
    if(!el) return;
    el.innerHTML = DS.rows.map((r,i) => `
      <div style="background:#f8fafc;border:1.5px solid #dde3ea;border-radius:8px;padding:8px 10px;margin-bottom:6px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:0.65rem;font-weight:800;color:#1a5276;background:rgba(26,82,118,0.1);padding:1px 7px;border-radius:4px">รายการ ${i+1}</span>
          <button onclick="_dsDelRow(${i})" style="width:22px;height:22px;background:#fee2e2;border:none;border-radius:5px;cursor:pointer;color:#ef4444;font-size:0.8rem">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 2fr;gap:5px;margin-bottom:5px">
          <div>
            <div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">รหัสสินค้า</div>
            <input value="${(r.code||'').replace(/"/g,'&quot;')}" oninput="_dsRowUp(${i},'code',this.value)" style="${_dsInput}">
          </div>
          <div>
            <div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">รายละเอียด</div>
            <input value="${(r.name||'').replace(/"/g,'&quot;')}" oninput="_dsRowUp(${i},'name',this.value)" style="${_dsInput}">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1.3fr;gap:5px">
          <div>
            <div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">จำนวน</div>
            <input type="number" value="${r.qty}" oninput="_dsRowUp(${i},'qty',this.value)" style="${_dsInput}">
          </div>
          <div>
            <div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">หน่วย</div>
            <select oninput="_dsRowUp(${i},'unit',this.value)" style="${_dsInput}">
              ${['JOB','EA','Kg.','L.','Set','ชิ้น','เมตร'].map(u=>`<option ${r.unit===u?'selected':''}>${u}</option>`).join('')}
            </select>
          </div>
          <div>
            <div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">ราคา/หน่วย</div>
            <input type="number" value="${r.price}" oninput="_dsRowUp(${i},'price',this.value)" style="${_dsInput}">
          </div>
        </div>
      </div>`).join('');
  };

  // ── Input style ──
  var _dsInput = 'width:100%;padding:5px 8px;border:1.5px solid #dde3ea;border-radius:6px;font-family:inherit;font-size:1rem;color:#1a1a2e;background:white;outline:none;box-sizing:border-box';

  // ── Bind DS globals (debounced versions assigned below with _dsRowUp) ──
  window._dsQiUpload = (input) => {
    const file = input.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      DS.quotationImg = e.target.result;
      const prev = document.getElementById('_ds_qi_preview');
      if(prev) prev.innerHTML = `<img src="${DS.quotationImg}" style="max-width:100%;max-height:100%;object-fit:contain"/><div style="font-size:0.6rem;color:#1a5276;font-weight:700;margin-top:3px">แตะเพื่อเปลี่ยน</div>`;
      // ── FIX: persist ทันทีที่อัปโหลด ──
      savePDFConfig(Object.assign(getPDFConfig(), { quotationImg: DS.quotationImg }));
      showToast('✅ บันทึกรูปใบเสนอราคาแล้ว');
      renderPreview();
    };
    reader.readAsDataURL(file);
  };
  window._dsQiClear = () => {
    DS.quotationImg = '';
    const prev = document.getElementById('_ds_qi_preview');
    if(prev) prev.innerHTML = '<span style="font-size:1rem">📄</span>';
    // ── FIX: persist การลบรูปด้วย ──
    savePDFConfig(Object.assign(getPDFConfig(), { quotationImg: '' }));
    renderPreview();
  };
  window._dsLogoUpload = (input) => {
    const file = input.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      DS.logoData = e.target.result;
      // update preview thumbnail
      const prev = document.getElementById('_ds_logo_preview');
      if(prev) prev.innerHTML = `<img src="${DS.logoData}" style="width:100%;height:100%;object-fit:contain"/>`;
      // ── FIX: persist logo ด้วย ──
      savePDFConfig(Object.assign(getPDFConfig(), { logo: DS.logoData }));
      renderPreview();
      // refresh form to show delete button
      const fp = document.getElementById('_ds_form_panel');
      if(fp) { const logoEl = fp.querySelector('#_ds_logo_preview'); }
    };
    reader.readAsDataURL(file);
  };
  window._dsSetVendor = (code) => {
    DS.vendorCode  = code;
    DS.custCompany = getVendorMap()[code] || code;
    // re-render form panel to update chip highlights
    const formPanel = document.getElementById('_ds_form_panel');
    if(formPanel) {
      // update chip buttons
      getVendors().forEach(v => { const c = v.code;
        const btn = formPanel.querySelector(`button[onclick="_dsSetVendor('${c}')"]`);
        if(btn){
          btn.style.borderColor = (c===code) ? '#1a5276' : '#dde3ea';
          btn.style.background  = (c===code) ? '#1a5276' : '#f8fafc';
          btn.style.color       = (c===code) ? 'white'   : '#374151';
        }
      });
      // update display label
      const label = formPanel.querySelector('#_ds_vendor_label');
      if(label) label.textContent = DS.custCompany;
    }
    renderPreview();
  };
  window._dsToggleForm = () => {
    DS.formCollapsed = !DS.formCollapsed;
    const panel = document.getElementById('_ds_form_panel');
    const btn   = document.getElementById('_ds_toggle_btn');
    const isMob = window.innerWidth < 768;
    if (DS.formCollapsed) {
      if (isMob) {
        panel.style.position = '';
        panel.style.width = '0'; panel.style.opacity = '0'; panel.style.overflow = 'hidden';
      } else {
        panel.style.width = '0'; panel.style.opacity = '0'; panel.style.overflow = 'hidden';
      }
      if (btn) btn.textContent = isMob ? '✏️ แก้' : '▶ ขยาย';
    } else {
      if (isMob) {
        // mobile: slide in as absolute overlay on top of preview
        panel.style.position = 'absolute';
        panel.style.top = '0'; panel.style.left = '0'; panel.style.bottom = '0';
        panel.style.zIndex = '10';
        panel.style.boxShadow = '4px 0 24px rgba(0,0,0,0.35)';
        panel.style.width = 'min(320px, 92vw)';
        panel.style.opacity = '1'; panel.style.overflow = '';
      } else {
        panel.style.position = '';
        panel.style.width = '320px'; panel.style.opacity = '1'; panel.style.overflow = '';
      }
      if (btn) btn.textContent = isMob ? '✕ ปิด' : '◀ ย่อ';
    }
    setTimeout(renderPreview, 300);
  };
  window._dsRowUp = dsUpdateRowDebounced;
  window._dsField = _localDebounce((key,val) => { DS[key]=val; renderPreview(); }, 200);
  window._dsDelRow = dsDelRow;
  window._dsAddRow = dsAddRow;
  window._dsPrint  = () => {
    const w = window.open('','_blank');
    if(w){ w.document.write(buildHTML()); w.document.close(); setTimeout(()=>w.print(),400); }
  };
  window._dsDL = () => {
    try {
      const blob = new Blob([buildHTML()],{type:'text/html;charset=utf-8'});
      const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='Quotation-'+DS.quotNo+'.html';
      document.body.appendChild(a); a.click(); a.remove(); showToast('📥 บันทึก ใบเสนอราคา แล้ว');
    } catch(e){ showToast('⚠️ ไม่สามารถดาวน์โหลดได้'); }
  };

  // ── Build overlay HTML ──
  // บนมือถือ: form panel ซ่อนอัตโนมัติ (preview เต็มจอ)
  const _isMobile = window.innerWidth < 768;
  if (_isMobile) DS.formCollapsed = true;

  ov.innerHTML = `
  <!-- TOPBAR -->
  <div style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:#1a5276;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
    <div style="width:26px;height:26px;background:rgba(255,255,255,.18);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:0.85rem;flex-shrink:0">📄</div>
    <div style="flex:1;min-width:0">
      <div style="color:white;font-weight:900;font-size:0.78rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">ใบเสนอราคา — ${t.id}</div>
      <div style="color:rgba(255,255,255,.5);font-size:0.55rem;margin-top:1px;display:flex;align-items:center;gap:5px">
        <span>${t.machine||t.problem||''}</span>
        ${t.signatures?.tech?.data ? '<span style="background:rgba(39,174,96,.3);color:#a7f3d0;border-radius:4px;padding:0 4px;font-weight:700">✍️ ช่างเซ็นแล้ว</span>' : ''}
        ${t.signatures?.reporter?.data ? '<span style="background:rgba(14,116,144,.3);color:#a5f3fc;border-radius:4px;padding:0 4px;font-weight:700">✍️ ผู้แจ้งเซ็นแล้ว</span>' : ''}
      </div>
    </div>
    <button onclick="_dsDL()" style="padding:5px 10px;background:#f39c12;color:white;border:none;border-radius:7px;font-family:inherit;font-size:0.68rem;font-weight:800;cursor:pointer;flex-shrink:0">⬇️</button>
    <button onclick="_dsPrint()" style="padding:5px 10px;background:#27ae60;color:white;border:none;border-radius:7px;font-family:inherit;font-size:0.68rem;font-weight:800;cursor:pointer;flex-shrink:0">🖨️ พิมพ์</button>
    <button id="_ds_toggle_btn" onclick="_dsToggleForm()" title="ย่อ/ขยายฟอร์ม" style="padding:5px 8px;background:rgba(255,255,255,0.12);color:white;border:1px solid rgba(255,255,255,0.2);border-radius:7px;font-size:0.68rem;font-weight:700;cursor:pointer;flex-shrink:0">${_isMobile?'✏️ แก้':'◀ ย่อ'}</button>
    <button onclick="document.getElementById('_pdf_overlay').remove()" style="width:28px;height:28px;background:rgba(255,255,255,0.12);color:white;border:1px solid rgba(255,255,255,0.2);border-radius:7px;font-size:1rem;cursor:pointer;flex-shrink:0">✕</button>
  </div>

  <!-- MAIN: FORM + PREVIEW -->
  <div style="display:flex;flex:1;overflow:hidden;position:relative">

    <!-- FORM PANEL -->
    <div style="width:${_isMobile?'0':'320px'};flex-shrink:0;background:white;overflow-y:auto;overflow-x:hidden;border-right:1px solid #dde3ea;transition:width 0.25s ease,opacity 0.2s ease;${_isMobile?'opacity:0;':'opacity:1;'}" id="_ds_form_panel">

      <!-- Company -->
      <div style="padding:12px 14px;border-bottom:1px solid #f1f5f9">
        <div style="font-size:0.65rem;font-weight:800;color:#1a5276;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;display:flex;align-items:center;gap:5px">
          <span style="width:3px;height:12px;background:#1a5276;border-radius:2px;display:block"></span>🏢 บริษัทผู้เสนอ
        </div>
        <div style="margin-bottom:8px">
          <div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:4px">โลโก้บริษัท</div>
          <div style="display:flex;align-items:center;gap:8px">
            <div id="_ds_logo_preview" style="width:52px;height:52px;border:2px dashed #dde3ea;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;background:#f8fafc">
              ${DS.logoData ? `<img src="${DS.logoData}" style="width:100%;height:100%;object-fit:contain"/>` : '<span style="font-size:1.4rem">🏢</span>'}
            </div>
            <div style="flex:1">
              <label style="display:block;padding:6px 10px;background:#1a5276;color:white;border-radius:6px;font-size:0.68rem;font-weight:700;cursor:pointer;text-align:center">
                📁 เลือกรูปโลโก้
                <input type="file" accept="image/*" onchange="_dsLogoUpload(this)" style="display:none">
              </label>
              ${DS.logoData ? `<button onclick="_dsField('logoData','');document.getElementById('_ds_logo_preview').innerHTML='<span style=\'font-size:1.4rem\'>🏢</span>'" style="margin-top:4px;width:100%;padding:4px;background:#fee2e2;color:#ef4444;border:none;border-radius:5px;font-size:0.65rem;cursor:pointer;font-family:inherit">✕ ลบโลโก้</button>` : ''}
            </div>
          </div>
        </div>
        <div style="margin-bottom:6px"><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">ชื่อบริษัท</div><input value="${(DS.company).replace(/"/g,'&quot;')}" oninput="_dsField('company',this.value)" style="${_dsInput}"></div>
        <div style="margin-bottom:6px"><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">ชื่อใต้โลโก้ <span style="font-weight:400;color:#9ca3af">(แสดงใต้รูป)</span></div><textarea oninput="_dsField('logoSubLine',this.value)" rows="2" style="${_dsInput};resize:none">${(DS.logoSubLine||'').replace(/</g,'&lt;')}</textarea></div>
        <div style="margin-bottom:6px"><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">ที่อยู่</div><input value="${(DS.address).replace(/"/g,'&quot;')}" oninput="_dsField('address',this.value)" style="${_dsInput}"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
          <div><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">โทรศัพท์</div><input value="${(DS.tel).replace(/"/g,'&quot;')}" oninput="_dsField('tel',this.value)" style="${_dsInput}"></div>
          <div><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">Tax ID</div><input value="${(DS.taxid).replace(/"/g,'&quot;')}" oninput="_dsField('taxid',this.value)" style="${_dsInput}"></div>
        </div>
        <div><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">Email</div><input value="${(DS.email).replace(/"/g,'&quot;')}" oninput="_dsField('email',this.value)" style="${_dsInput}"></div>
      </div>

      <!-- Quotation info -->
      <div style="padding:12px 14px;border-bottom:1px solid #f1f5f9">
        <div style="font-size:0.65rem;font-weight:800;color:#1a5276;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;display:flex;align-items:center;gap:5px">
          <span style="width:3px;height:12px;background:#1a5276;border-radius:2px;display:block"></span>📋 ใบเสนอราคา
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
          <div><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">เลขที่</div><input value="${(DS.quotNo).replace(/"/g,'&quot;')}" oninput="_dsField('quotNo',this.value)" style="${_dsInput}"></div>
          <div><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">วันที่</div><input type="date" value="${DS.dateStr}" oninput="_dsField('dateStr',this.value)" style="${_dsInput}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
          <div><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">ยืนราคา (วัน)</div><input value="${DS.validDays}" oninput="_dsField('validDays',this.value)" style="${_dsInput}"></div>
          <div><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">ชำระ (วัน)</div><input value="${DS.paymentDays}" oninput="_dsField('paymentDays',this.value)" style="${_dsInput}"></div>
        </div>
        <div>
          <div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:6px">รูปข้างใบเสนอราคา <span style="font-weight:400;color:#9ca3af">(ตราประทับ / โลโก้ลูกค้า)</span></div>
          <label style="display:block;cursor:pointer">
            <input type="file" accept="image/*" style="display:none" onchange="_dsQiUpload(this)">
            <div id="_ds_qi_preview" style="width:100%;min-height:90px;border:2px dashed ${DS.quotationImg?'#1a5276':'#dde3ea'};border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;background:${DS.quotationImg?'#f0f4ff':'#f8fafc'};transition:all 0.2s;gap:6px;padding:8px">
              ${DS.quotationImg
                ? `<img src="${DS.quotationImg}" style="max-width:100%;max-height:80px;object-fit:contain;border-radius:4px"/><div style="font-size:0.6rem;color:#1a5276;font-weight:700">แตะเพื่อเปลี่ยน</div>`
                : `<span style="font-size:1.8rem">🖼</span><div style="font-size:0.68rem;font-weight:700;color:#64748b">แตะเพื่ออัพโหลดรูป</div><div style="font-size:0.58rem;color:#94a3b8">ตราประทับ / ลายเซ็น / โลโก้</div>`}
            </div>
          </label>
          ${DS.quotationImg ? `<button onclick="_dsQiClear()" style="margin-top:5px;width:100%;padding:5px;background:#fef2f2;color:#c8102e;border:1px solid #fecaca;border-radius:7px;font-size:0.68rem;font-weight:700;cursor:pointer;font-family:inherit">✕ ลบรูป</button>` : ''}
        </div>
      </div>

      <!-- Customer -->
      <div style="padding:12px 14px;border-bottom:1px solid #f1f5f9">
        <div style="font-size:0.65rem;font-weight:800;color:#1a5276;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;display:flex;align-items:center;gap:5px">
          <span style="width:3px;height:12px;background:#1a5276;border-radius:2px;display:block"></span>👤 ลูกค้า
        </div>
        <div style="margin-bottom:8px">
          <div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:4px">บริษัทลูกค้า (Vendor)</div>
          <div style="display:flex;gap:5px;margin-bottom:5px;flex-wrap:wrap">
            ${getVendors().map(v=>`
              <button onclick="_dsSetVendor('${v.code}')" style="padding:5px 10px;border-radius:6px;border:2px solid ${DS.vendorCode===v.code?'#1a5276':'#dde3ea'};background:${DS.vendorCode===v.code?'#1a5276':'#f8fafc'};color:${DS.vendorCode===v.code?'white':'#374151'};font-family:inherit;font-size:0.72rem;font-weight:800;cursor:pointer;transition:all 0.15s">${v.code}</button>
            `).join('')}
          </div>
          <div id="_ds_vendor_label" style="font-size:0.78rem;font-weight:700;color:#1a1a2e;padding:6px 10px;background:#f0f4ff;border-radius:6px;border:1.5px solid #c7d2fe;min-height:32px">${DS.custCompany}</div>
        </div>
        <div style="margin-bottom:6px"><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">เรียน</div><input value="${(DS.attn).replace(/"/g,'&quot;')}" oninput="_dsField('attn',this.value)" style="${_dsInput}"></div>
        <div style="margin-bottom:6px"><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">สำเนา</div><input value="${(DS.cc).replace(/"/g,'&quot;')}" oninput="_dsField('cc',this.value)" style="${_dsInput}"></div>
        <div><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">เบอร์โทร</div><input value="${(DS.custTel).replace(/"/g,'&quot;')}" oninput="_dsField('custTel',this.value)" style="${_dsInput}"></div>
      </div>

      <!-- Job -->
      <div style="padding:12px 14px;border-bottom:1px solid #f1f5f9">
        <div style="font-size:0.65rem;font-weight:800;color:#1a5276;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;display:flex;align-items:center;gap:5px">
          <span style="width:3px;height:12px;background:#1a5276;border-radius:2px;display:block"></span>🔧 รายละเอียดงาน
        </div>
        <div style="margin-bottom:6px"><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">ชื่องาน / สถานที่</div><input value="${(DS.job).replace(/"/g,'&quot;')}" oninput="_dsField('job',this.value)" style="${_dsInput}"></div>
        <div style="margin-bottom:6px">
          <div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:4px">ยี่ห้อ / รุ่น</div>
          <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;padding:7px 10px;font-size:0.78rem;line-height:1.7">
            <div><span style="font-size:0.6rem;font-weight:800;color:#1a5276;background:#e0eaf4;padding:1px 5px;border-radius:3px;margin-right:5px">FCU</span>${DS.fcuModel||'—'}</div>
            <div style="margin-top:2px"><span style="font-size:0.6rem;font-weight:800;color:#7c3aed;background:#ede9fe;padding:1px 5px;border-radius:3px;margin-right:5px">CDU</span>${DS.cduModel||'—'}</div>
          </div>
          <input type="hidden" value="${(DS.brand).replace(/"/g,'&quot;')}" oninput="_dsField('brand',this.value)">
        </div>
        <div style="margin-bottom:6px">
          <div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">ขนาด</div>
          <input value="${(DS.btu).replace(/"/g,'&quot;')}" oninput="_dsField('btu',this.value)" style="${_dsInput}">
        </div>
        <div><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">หมายเหตุ</div><textarea oninput="_dsField('remark',this.value)" rows="2" style="${_dsInput};resize:vertical">${(DS.remark||'').replace(/</g,'&lt;')}</textarea></div>
      </div>

      <!-- Items -->
      <div style="padding:12px 14px;border-bottom:1px solid #f1f5f9">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:0.65rem;font-weight:800;color:#1a5276;text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:5px">
            <span style="width:3px;height:12px;background:#1a5276;border-radius:2px;display:block"></span>📦 รายการสินค้า
          </div>
          <button onclick="_dsAddRow()" style="padding:4px 10px;background:#1a5276;color:white;border:none;border-radius:6px;font-family:inherit;font-size:0.68rem;font-weight:700;cursor:pointer">+ เพิ่ม</button>
        </div>
        <div id="_ds_rows"></div>
      </div>

      <!-- Signatures -->
      <div style="padding:12px 14px">
        <div style="font-size:0.65rem;font-weight:800;color:#1a5276;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;display:flex;align-items:center;gap:5px">
          <span style="width:3px;height:12px;background:#1a5276;border-radius:2px;display:block"></span>✍️ ลายเซ็น
        </div>
        <div style="margin-bottom:6px"><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">ผู้เสนอราคา (Best Regards)</div><input value="${(DS.sellerSig).replace(/"/g,'&quot;')}" oninput="_dsField('sellerSig',this.value)" style="${_dsInput}"></div>
        <div><div style="font-size:0.62rem;color:#6b7280;font-weight:600;margin-bottom:2px">ผู้รับ (Confirmation)</div><input value="${(DS.buyerSig).replace(/"/g,'&quot;')}" placeholder="ชื่อผู้รับ" oninput="_dsField('buyerSig',this.value)" style="${_dsInput}"></div>
      </div>
    </div>

    <!-- PREVIEW PANEL -->
    <div style="flex:1;overflow-y:auto;overflow-x:hidden;background:#c0c6cc;padding:8px;display:flex;flex-direction:column;align-items:center;-webkit-overflow-scrolling:touch">
      <iframe id="_ds_iframe" style="width:100%;border:none;background:white;box-shadow:0 4px 24px rgba(0,0,0,0.25);min-height:600px;display:block"></iframe>
    </div>

  </div>`;

  document.body.appendChild(ov);

  // init rows UI + first render
  dsRenderRows();
  setTimeout(renderPreview, 100);

  showToast('📄 ใบเสนอราคา '+t.id+' — แก้ไขได้ก่อนพิมพ์');

  } catch(e) {
    console.error('[generateRepairPDF] error:', e);
    showToast('⚠️ ไม่สามารถสร้างรายงานได้ — ' + (e.message || 'unknown error'));
  }
}

// ── PDF Settings Sheet ──
function openPDFDesigner() {
  // Open Quotation Designer with best available sample ticket
  const sampleTicket = db.tickets.find(t=>['done','verified','closed'].includes(t.status) && t.summary)
    || db.tickets.find(t=>t.summary)
    || db.tickets.find(t=>['done','verified','closed'].includes(t.status))
    || db.tickets.slice(-1)[0]
    || db.tickets[0];
  if(sampleTicket) {
    generateRepairPDF(sampleTicket.id);
  } else {
    showToast('⚠️ ยังไม่มีงานในระบบ');
  }
}


function doLogout() {
  _closeAllModals();
  // clear intervals ก่อน reload
  if (window._autoBackupInterval) { clearInterval(window._autoBackupInterval); window._autoBackupInterval = null; }
  if (window._qrInterval) { clearInterval(window._qrInterval); window._qrInterval = null; }
  localStorage.removeItem(SESSION_KEY);
  window.location.reload();
}

function _closeAllModals() {
  // ปิด complete sheet (div)
  const cs = document.getElementById('complete-sheet');
  if (cs) { cs.style.display = 'none'; }
  // ปิด native dialog (อื่นๆ ถ้ามี)
  document.querySelectorAll('dialog').forEach(d => {
    try { if(d.open) d.close(); } catch(e){}
    d.removeAttribute('open'); d.style.display = 'none';
  });
  // ปิด sheet (bottom sheet) — force hide ทุก sheet ป้องกันซ้อนบน tablet
  document.querySelectorAll('.sheet').forEach(s => {
    s.classList.remove('open');
    s.style.visibility = 'hidden';
    s.style.pointerEvents = 'none';
    setTimeout(() => {
      if (!s.classList.contains('open')) {
        s.style.visibility = '';
        s.style.pointerEvents = '';
      }
    }, 450);
  });
  document.querySelectorAll('.sheet-overlay').forEach(o => {
    o.classList.remove('open');
    o.style.display = 'none';
    setTimeout(() => {
      if (!o.classList.contains('open')) {
        o.style.display = '';
      }
    }, 450);
  });
  // ปิด overlay divs
  ['_rp_ov','_gsearch_ov','_pdf_overlay'].forEach(id => {
    document.getElementById(id)?.remove();
  });
}function resetApp() {
  if (!confirm('⚠️ ล้างข้อมูลทั้งหมดและรีโหลดแอพ?\nTicket และผู้ใช้ที่เพิ่มไว้จะหายหมด')) return;
  localStorage.clear();
  location.reload();
}

// ============================================================
// APP INIT
// ============================================================

// ── Migrate old summary format (", " → "\n- ") ──
function migrateOldSummaryFormat() {
  var migKey = 'scg_summary_migrated_v116';
  if (localStorage.getItem(migKey)) return;
  var changed = false;
  (db.tickets || []).forEach(function(t) {
    if (!t.summary) return;
    // ถ้ายังไม่มี \n แต่มี " - " หรือ ", " → แปลงเป็น newline
    if (!t.summary.includes('\n') && (t.summary.includes(' - ') || t.summary.includes(', '))) {
      var lines;
      if (t.summary.includes(' — - ') || t.summary.includes(' - ')) {
        lines = t.summary.replace(/ — - /g, '\n').replace(/ - /g, '\n').split('\n');
      } else {
        lines = t.summary.split(', ');
      }
      lines = lines.map(function(l){ return l.trim(); }).filter(Boolean);
      if (lines.length > 1) {
        t.summary = lines.map(function(l){ return '- ' + l.replace(/^[-–]\s*/,''); }).join('\n');
        changed = true;
      }
    }
  });
  if (changed) {
    saveDB();
  }
  localStorage.setItem(migKey, '1');
}

// ── Offline Indicator ──────────────────────────────────────────
function initOfflineIndicator() {
  if (window._offlineInitialized) return;
  window._offlineInitialized = true;

  // สร้าง banner
  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.style.cssText = [
    'position:fixed','top:0','left:0','right:0','z-index:99999',
    'background:#ef4444','color:white','text-align:center',
    'font-size:0.8rem','font-weight:700','padding:8px 16px',
    'display:none','align-items:center','justify-content:center','gap:8px',
    'box-shadow:0 2px 8px rgba(0,0,0,0.2)','font-family:inherit',
  ].join(';');
  banner.innerHTML = '📵 ไม่มีการเชื่อมต่ออินเทอร์เน็ต — ข้อมูลอาจไม่ซิงค์';
  document.body.prepend(banner);

  function update() {
    const offline = !navigator.onLine;
    banner.style.display = offline ? 'flex' : 'none';
    if (!offline && typeof showToast === 'function') {
      showToast('✅ เชื่อมต่ออินเทอร์เน็ตแล้ว');
    }
  }

  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update(); // ตรวจสอบสถานะตอนแรก
}


// ── Session Expiry Check ──────────────────────────────────────
(function checkSessionExpiry() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (!s.exp || Date.now() > s.exp) {
      localStorage.removeItem(SESSION_KEY);
      // ไม่ force logout ตรงนี้ เพราะ CU อาจยังไม่ set — จะ handle ใน initApp guard
    }
  } catch(e) { localStorage.removeItem(SESSION_KEY); }
})();

// ── Idle Auto-Logout (30 นาที) ───────────────────────────────
let _idleTimer = null;
function _resetIdleTimer() {
  clearTimeout(_idleTimer);
  _idleTimer = setTimeout(() => {
    if (typeof CU !== 'undefined' && CU) {
      showToast('⏱️ หมดเวลา — กรุณา Login ใหม่');
      setTimeout(doLogout, 1500);
    }
  }, 30 * 60 * 1000); // 30 นาที
}
['click','keydown','touchstart','mousemove'].forEach(ev =>
  document.addEventListener(ev, _resetIdleTimer, { passive: true })
);

function _forceCloseAllSheets() {
  document.querySelectorAll('.sheet').forEach(s => {
    s.classList.remove('open');
    s.style.display = 'none';
    s.style.visibility = '';
    s.style.pointerEvents = '';
    requestAnimationFrame(() => {
      if (!s.classList.contains('open')) {
        s.style.display = '';
        s.style.visibility = '';
        s.style.pointerEvents = '';
      }
    });
  });
  document.querySelectorAll('.sheet-overlay').forEach(o => {
    o.classList.remove('open');
    o.style.display = 'none';
    requestAnimationFrame(() => {
      if (!o.classList.contains('open')) o.style.display = '';
    });
  });
  document.querySelectorAll('dialog[open]').forEach(d => {
    try { d.close(); } catch(e2) {}
    d.style.display = 'none';
  });
  // cleanup dynamic overlays
  document.querySelectorAll('.cdel-overlay, #admin-manage-tk-ov').forEach(el => el.remove());
}
// bfcache restore + Android Chrome restore
window.addEventListener('pageshow', (e) => {
  // เสมอ force close — ไม่ว่าจะมาจาก bfcache หรือไม่
  _forceCloseAllSheets();
  // ถ้ามาจาก bfcache ให้ reload หน้า (ป้องกัน state เก่า)
  if (e.persisted) {
    window.location.reload();
  }
});
// close ทันที DOMContentLoaded กัน sheet ค้างจาก session ก่อนหน้า
document.addEventListener('DOMContentLoaded', () => {
  _forceCloseAllSheets();

  // ── LIFF: ตรวจ LINE Login อัตโนมัติ ──
  if (typeof autoLiffLogin === 'function') {
    // defer เล็กน้อยให้ db load ก่อน (db อยู่ใน localStorage และ load ทันที)
    setTimeout(autoLiffLogin, 200);
  }

  // ══ Global: ป้องกัน input/textarea/select auto-focus ทั้งแอพ ══
  // ทุก field จะมี inputmode="none" + tabindex="-1" ตั้งต้น
  // เมื่อ user แตะเองจะถูก unlock ให้พิมพ์ได้ปกติ
  function _lockField(el) {
    if (el._noAutoFocusInit) return;
    if (['checkbox','radio','range','hidden','submit','button','file','image'].includes(el.type)) return;
    el._noAutoFocusInit = true;
    // ตั้งค่าเริ่มต้น
    el.setAttribute('inputmode', 'none');
    el.setAttribute('tabindex', '-1');
    const unlock = () => {
      el.removeAttribute('inputmode');
      el.removeAttribute('tabindex');
    };
    el.addEventListener('touchstart', unlock, { once: true, passive: true });
    el.addEventListener('mousedown',  unlock, { once: true });
  }

  // ล็อก fields ที่มีอยู่แล้ว
  document.querySelectorAll('input, textarea, select').forEach(_lockField);

  // ล็อก fields ที่ถูก inject ทีหลัง (dynamic forms, sheets, overlays)
  const _fieldObserver = new MutationObserver(mutations => {
    mutations.forEach(m => m.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      if (['INPUT','TEXTAREA','SELECT'].includes(node.tagName)) _lockField(node);
      node.querySelectorAll?.('input, textarea, select').forEach(_lockField);
    }));
  });
  _fieldObserver.observe(document.body, { childList: true, subtree: true });
});


// ── Emergency overlay reset — เคลียร์ทุก overlay ที่ค้างอยู่ ──
function resetAllOverlays() {
  document.querySelectorAll('.sheet.open').forEach(s => {
    s.classList.remove('open');
    s.style.visibility = ''; s.style.pointerEvents = '';
  });
  // Fix: ไม่ใช้ setTimeout ที่ทำให้ overlay ค้างและทับปุ่ม
  document.querySelectorAll('.sheet-overlay').forEach(o => {
    o.classList.remove('open');
    o.style.display = '';
  });
  // ลบ dynamic overlays ที่ append เข้า body โดยตรง
  document.querySelectorAll('.cdel-overlay, #admin-manage-tk-ov').forEach(el => el.remove());
  const qm = document.getElementById('tb-quick-menu'); if (qm) qm.style.display = 'none';
}

async function initApp() {
  // Guard
  if (!CU || !CU.role) { doLogout(); return; }
  _resetIdleTimer(); // เริ่มนับ idle หลัง login

  // ── Offline Indicator ──
  initOfflineIndicator();

  // ── Phase 1: UI critical (ทำทันที ก่อน paint) ──
  _closeAllModals();
  setupBottomNav();
  updateTopbarTitle(_activePage||'home');
  initDarkMode();
  initLang();
  renderTopbarAvatar();
  initSidebarState();
  if (typeof initFirebase === 'function' && !_firebaseReady) {
    try { initFirebase(); } catch(e) { console.warn('Phase1 Firebase init:', e); }
  }

  // ── Phase 2: แสดงหน้าหลักทันที ──
  requestAnimationFrame(() => {
    _closeAllModals();
    _forceCloseAllSheets();
    // Hide ทุก page ก่อน แล้วค่อย goPage (ป้องกัน page เก่าค้างจาก session ก่อน)
    document.querySelectorAll('.page.active').forEach(p => p.classList.remove('active'));
    _activePage = null;
    goPage(CU.role === 'executive' ? 'executive' : 'home');
    if (typeof checkAutoBackup === 'function') checkAutoBackup();
    setTimeout(() => _forceCloseAllSheets(), 300);
    setTimeout(() => _forceCloseAllSheets(), 800);
  });

  // ── Phase 3: งานที่เหลือ defer หลัง paint ──
  setTimeout(() => {
    migrateOldSummaryFormat();
    populateMachineSelect();
    renderAcctInfo();
    updateNBadge();
    renderNotifPanel();
    updateOpenBadge();
  }, 50);

  loadMachinesData().then(() => {
    // refresh machine list ถ้าอยู่หน้า machines อยู่
    if (typeof populateMachineSelect === 'function') populateMachineSelect();
    if (typeof renderMachineList === 'function') renderMachineList();
  }).catch(e => console.warn('[Phase3.5] loadMachinesData:', e));

  // ── Phase 4: Firebase async (ไม่ block UI เลย) ──
  setTimeout(async () => {
    try {
      if (!_firebaseReady) initFirebase();
      if (_firebaseReady) {
        const loaded = await fsLoad();
        if (loaded) {
          const fresh = db.users.find(u => u.id === CU.id);
          if (fresh) { CU = fresh; renderSettingsPage(); renderTopbarAvatar(); }
          refreshPage();
          updateOpenBadge();
          updateNBadge();
          if (typeof populateMachineSelect === 'function') populateMachineSelect();
        }
        fsListen();
      }
    } catch(e) { console.warn('initApp Firebase error:', e); }
  }, 300);
}

const _PAGE_LABELS = {
    'home': {title:'หน้าแรก', sub:'ภาพรวมระบบ'},
    'tickets': {title:'รายการงาน', sub:'ทั้งหมด'},
    'tracking': {title:'ติดตามงาน', sub:'Admin Dashboard'},
    'mywork': {title:'งานของฉัน', sub:'งานที่ได้รับมอบหมาย'},
    'new': {title:'แจ้งงานซ่อม', sub:'สร้างใบงานใหม่'},
    'calendar': {title:'ปฏิทิน PM', sub:'แผนซ่อมบำรุง'},
    'purchase': {title:'สั่งซื้อ / PR', sub:'ใบสั่งซื้ออะไหล่'},
    'report': {title:'รายงาน', sub:'สถิติและค่าใช้จ่าย'},
    'machines': {title:'เครื่องแอร์', sub:'ทะเบียนเครื่อง'},
    'users': {title:'ผู้ใช้งาน', sub:'จัดการสิทธิ์'},
    'settings': {title:'ตั้งค่า', sub:'โปรไฟล์และระบบ'},
    'chatroom': {title:'แชทรวม', sub:'ข้อความทุก TK'},
    'executive': {title:'Executive Dashboard', sub:'ภาพรวมผู้บริหาร'},
  };

function updateTopbarTitle(page) {
  const info = _PAGE_LABELS[page] || {title:'AIRCONDITION', sub:'BP Process'};
  const titleEl = document.getElementById('tb-title-text');
  const subEl   = document.getElementById('tb-title-sub');
  if (titleEl) titleEl.textContent = info.title;
  if (subEl)   subEl.textContent   = info.sub;
}

function setupBottomNav() {
  if (!CU || !CU.role) return;
  const nav = document.getElementById('bottom-nav');
  const isAdmin = CU.role === 'admin';
  const isExec  = CU.role === 'executive';
  nav.innerHTML = '';

  const SVG = {
    home:       '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    tickets:    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    calendar:   '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    mywork:     '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    report:     '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    new:        '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
    purchase:   '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>',
    users:      '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    machines:   '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 8h2"/><path d="M15 8h2"/><path d="M11 8h2"/>',
    chat:       '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    chatroom:   '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/>',
    settings:   '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    incomplete: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    history:    '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    executive:  '<rect x="2" y="3" width="6" height="8" rx="1"/><rect x="9" y="7" width="6" height="4" rx="1"/><rect x="16" y="5" width="6" height="6" rx="1"/><line x1="5" y1="11" x2="5" y2="21"/><line x1="12" y1="11" x2="12" y2="21"/><line x1="19" y1="11" x2="19" y2="21"/>',
    airsearch:  '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  };

  const mkIcon = p => `<span class="bn-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SVG[p]||''}</svg></span>`;

  const items = isAdmin
    ? [
        {page:'home',       label:'หน้าแรก'},
        {page:'tickets',    label:'งาน',       badge:'open-badge'},
        {page:'machines',   label:'เครื่องแอร์'},
        {page:'chatroom',   label:'แชท',       badge:'cr-nav-badge'},
        {page:'report',     label:'รายงาน'},
        {page:'history',    label:'ประวัติ',    action:()=>openRepairHistoryPage()},
        {page:'settings',   label:'ตั้งค่า'},
      ]
    : isExec
      ? [
          {page:'executive',  label:'Dashboard'},
          {page:'tickets',    label:'งานซ่อม',  badge:'open-badge'},
          {page:'machines',   label:'เครื่องแอร์'},
          {page:'settings',   label:'ตั้งค่า'},
        ]
    : CU.role === 'tech'
      ? [
          {page:'home',       label:'หน้าแรก'},
          {page:'new',        label:'แจ้งซ่อม'},
          {page:'tickets',    label:'รายการ',  badge:'open-badge'},
          {page:'purchase',   label:'อะไหล่',  badge:'pur-badge'},
          {page:'chatroom',   label:'แชท',     badge:'cr-nav-badge'},
          {page:'settings',   label:'ตั้งค่า'},
        ]
      : [
          {page:'home',     label:'หน้าแรก'},
          {page:'new',      label:'แจ้งซ่อม'},
          {page:'tickets',  label:'รายการ', badge:'open-badge'},
          {page:'purchase', label:'อะไหล่', badge:'pur-reporter-badge'},
          {page:'chatroom', label:'แชท',    badge:'cr-nav-badge'},
          {page:'settings', label:'ตั้งค่า'},
        ];

  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'bn-item';
    btn.dataset.page = item.page;
    if (item.action) {
      btn.onclick = item.action;
    } else {
      btn.onclick = () => goPage(item.page);
    }
    // incomplete item — icon สีเหลือง
    const iconColor = item.page === 'incomplete' ? 'color:#d97706' : '';
    const iconHtml = item.page === 'incomplete'
      ? `<span class="bn-icon" style="${iconColor}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SVG['incomplete']}</svg></span>`
      : mkIcon(item.page);
    btn.innerHTML = iconHtml + `<span class="bn-label"${item.page==='incomplete'?' style="color:#d97706"':''}>${item.label}</span>` + (item.badge ? `<span class="bn-badge" id="${item.badge}"></span>` : '');
    nav.appendChild(btn);
  });

  // clear more dropdown
  const dd = document.getElementById('more-dropdown');
  if (dd) dd.innerHTML = '';

  const fab = document.getElementById('fab-new');
  if (fab) fab.style.display = 'none';
  const lineCard = document.getElementById('line-notify-card');
  if (lineCard) lineCard.style.display = 'none';
  // gs-card และ admin-danger-zone ถูกรวมเข้า sp-admin-tools แล้ว
  const gsCard = document.getElementById('gs-card');
  if (gsCard) gsCard.style.display = 'none'; // ซ่อน standalone card
  const dangerZone = document.getElementById('admin-danger-zone');
  if (dangerZone) dangerZone.style.display = 'none'; // ซ่อน standalone card
  const adminToolsGroup = document.getElementById('sp-admin-tools');
  if (adminToolsGroup) adminToolsGroup.style.display = isAdmin ? 'block' : 'none';

  // Backend panel — show only for admin
  const bkPanel = document.getElementById('sp-backend-panel');
  if (bkPanel) {
    if (isAdmin) {
      if (typeof showBackendPanel === 'function') showBackendPanel();
    } else {
      bkPanel.style.display = 'none';
    }
  }
  // อัปเดต chat count badge
  if (isAdmin) {
    const chatBadge = document.getElementById('chat-count-badge');
    if (chatBadge && db.chats) {
      const total = Object.values(db.chats).reduce((s,arr)=>s+(arr.length||0),0);
      chatBadge.textContent = total + ' ข้อความ';
    }
  }
}
// ============================================================
// PAGES
// ============================================================
let _activePage = 'home'; // sync กับ HTML ที่ pg-home มี class active ตอนแรก
function goPage(name) {
  if (_activePage === name) return; // กดหน้าเดิม ไม่ต้องทำอะไร

  // ── 0. ปิด top menu ถ้าเปิดอยู่ ──
  if (typeof _closeTopMenu === 'function') _closeTopMenu();
  const _qm = document.getElementById('tb-quick-menu'); if (_qm) _qm.style.display = 'none';

  // ── 0.5. ปิด sheet/overlay ที่ค้างอยู่ ป้องกัน overlay บัง UI หน้าใหม่ ──
  document.querySelectorAll('.sheet.open').forEach(s => {
    s.classList.remove('open');
    s.style.visibility = ''; s.style.pointerEvents = '';
  });
  document.querySelectorAll('.sheet-overlay').forEach(o => {
    o.classList.remove('open'); o.style.display = '';
  });
  // cleanup dynamic overlays ที่ append เข้า body โดยตรง
  document.querySelectorAll('.cdel-overlay, #admin-manage-tk-ov').forEach(el => el.remove());

  // ── 1. Nav highlight ทันที ──
  document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
  document.querySelector(`.bn-item[data-page="${name}"]`)?.classList.add('active');

  // ── 1.5. Cleanup เมื่อออกจาก chatroom — reset keyboard/viewport ──
  if (_activePage === 'chatroom' && name !== 'chatroom') {
    const crInp = document.getElementById('cr-input');
    if (crInp) crInp.blur();
    const crPg = document.getElementById('pg-chatroom');
    if (crPg) { crPg.style.transform = ''; crPg.style.height = ''; }
    // cleanup visualViewport listener
    if (window._crVpHandler && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', window._crVpHandler);
      window.visualViewport.removeEventListener('scroll', window._crVpHandler);
      window._crVpHandler = null;
    }
  }

  // ── 2. Page switch — hide หน้าเก่า show หน้าใหม่ทันที ──
  const old = document.getElementById('pg-'+_activePage);
  if (old) old.classList.remove('active');
  _activePage = name;
  const pg = document.getElementById('pg-'+name);
  if (pg) pg.classList.add('active');
  updateTopbarTitle(name);

  // ── 3. Tabbar ──
  const tabbar = document.getElementById('page-tabbar');
  const hasTabs = ['tickets','users','calendar'].includes(name);
  if(tabbar) {
    tabbar.classList.toggle('visible', hasTabs);
    ['tickets','users','calendar'].forEach(p => {
      const el = document.getElementById('ptab-'+p);
      if(el) el.style.display = p===name ? 'block' : 'none';
    });
  }

  // ── 4. FAB ──
  const fabEl = document.getElementById('fab-new'); if(fabEl) fabEl.style.display = 'none';
  const calAddBtn = document.getElementById('cal-add-btn');
  if(calAddBtn) calAddBtn.style.display = name === 'calendar' ? 'flex' : 'none';

  // ── 5. Render content ──
  if (name === 'machines') {
    // machines: แสดงโครงหน้าทันที แล้วค่อย render dashboard ใน setTimeout (ไม่ block)
    _macDeptFilter=''; _macVendorFilter=''; _macZoneFilter=''; window._macPage=0;
    window._macView = 'dashboard';
    window._macFilteredList = db.machines || [];
    // แสดง skeleton stats ก่อน
    const macDash = document.getElementById('mac-dashboard-view');
    if (macDash && !macDash.innerHTML) {
      macDash.innerHTML = skeletonMachines(3);
    }
    // render stats เบาก่อนใน rAF
    requestAnimationFrame(() => {
      renderMachineDashboardStats(); // เฉพาะ KPI cards (เบา)
    });
    // render machine cards หนัก defer ออกไป
    setTimeout(() => {
      renderMachineDashboardCards();
      // อัปเดต badge "ไม่ครบ" ใน dropdown
      const count = (db.machines||[]).filter(m => !getMachineEqStatus(m).isComplete).length;
      const ddBadge = document.getElementById('incomplete-dropdown-badge');
      if (ddBadge) {
        ddBadge.textContent = count > 0 ? count : '';
        ddBadge.style.display = count > 0 ? 'inline' : 'none';
      }
      const navBadge = document.getElementById('incomplete-nav-badge');
      if (navBadge) {
        navBadge.textContent = count > 0 ? count : '';
        navBadge.className = count > 0 ? 'bn-badge on' : 'bn-badge';
        if (count > 0) navBadge.style.background = '#d97706';
      }
    }, 80);
    return;
  }

  // หน้าอื่น: render ใน rAF
  requestAnimationFrame(() => {
    if (name === 'home') renderHome();
    else if (name === 'executive') renderExecutiveDashboard();
    else if (name === 'tickets') {
      // แสดงปุ่ม multi-select สำหรับ admin, tech, reporter
      const msBtn = document.getElementById('multi-select-toggle');
      if (msBtn) {
        const canMulti = ['admin','tech','reporter'].includes(CU?.role);
        msBtn.style.display = canMulti ? 'flex' : 'none';
        if (canMulti) {
          const lbl = CU?.role === 'admin' ? 'จ่ายงาน' : CU?.role === 'tech' ? 'รับงาน' : 'ตรวจรับ';
          msBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="5" width="6" height="6" rx="1"/><rect x="3" y="13" width="6" height="6" rx="1"/><line x1="15" y1="8" x2="21" y2="8"/><line x1="15" y1="16" x2="21" y2="16"/></svg> ${lbl}`;
        }
      }
      // reset multi-select ถ้าออกจาก tickets แล้วกลับมา
      if (_multiSelectMode) exitMultiSelect(); else renderTickets();
    }
    else if (name === 'mywork') renderMyWork();
    else if (name === 'tracking') {
      if (CU?.role === 'admin') renderTracking();
      else renderMyWork();
    }
    else if (name === 'purchase') { renderPurchase(); setPurchaseTab(_currentPurchaseTab||'order'); }
    else if (name === 'report') { if (typeof renderReport === 'function') renderReport(); if (typeof switchReportTab === 'function') switchReportTab('summary'); }
    else if (name === 'chatroom') { if(typeof initChatroomLayout==='function') initChatroomLayout(); if(typeof renderChatroomList==='function') renderChatroomList(); }
    else if (name === 'calendar') {
      if(typeof renderCalendar==='function') renderCalendar();
      const cab=document.getElementById('cal-add-btn'); if(cab) cab.style.display = CU.role==='admin' ? 'flex' : 'none';
      const clearBtn=document.getElementById('cal-clear-btn'); if(clearBtn) clearBtn.style.display = CU.role==='admin' ? 'flex' : 'none';
      const pmPlanBtn = document.querySelector('#pg-calendar button[onclick="goPagePMPlan()"]');
      if(pmPlanBtn) pmPlanBtn.style.display = CU.role==='admin' ? 'flex' : 'none';
      if(fabEl) fabEl.style.display = 'none';
    }
    else if (name === 'users') {
      renderUsersSummary(); switchUserTab(currentUserTab||'tech'); if(typeof initUsersEvents==='function') initUsersEvents();
      // ถ้า Firebase ยังไม่ sync — retry หลังจากโหลดเสร็จ
      if (typeof _firebaseReady !== 'undefined' && !_firebaseReady) {
        setTimeout(function() { if(typeof renderUsersSummary==='function'){renderUsersSummary(); renderUsers();} }, 1500);
        setTimeout(function() { if(typeof renderUsersSummary==='function'){renderUsersSummary(); renderUsers();} }, 4000);
      }
    }
    else if (name === 'new') {
      populateMachineSelect();
      if (!db.machines || db.machines.length === 0) {
        setTimeout(() => { if (typeof populateMachineSelect === 'function') populateMachineSelect(); }, 600);
        setTimeout(() => { if (typeof populateMachineSelect === 'function') populateMachineSelect(); }, 1800);
        setTimeout(() => { if (typeof populateMachineSelect === 'function') populateMachineSelect(); }, 4000);
      }
      setTimeout(()=>{ const priField=document.getElementById('nt-priority-field'); if(priField) priField.style.display='none'; },50);
    }
    else if (name === 'chat') { renderChatPage(); }
    else if (name === 'settings') { renderSettingsPage(); renderTopbarAvatar(); }
    // close any open sheet
    document.querySelectorAll('.sheet-overlay.open').forEach(o => o.classList.remove('open'));
    document.querySelectorAll('.sheet.open').forEach(s => s.classList.remove('open'));
  });
}

// ============================================================
// ============================================================
// SHEETS + nowStr — ย้ายมาจาก app-admin.js เพื่อให้ทุก script ใช้ได้
// ============================================================
function nowStr(){
  const d = new Date();
  const pad = n => String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
}

function openSheet(name){
  if (name === 'chat') {
    const sh = document.getElementById('chat-sheet');
    if (sh) {
      sh.classList.add('visible');
      function _chatKbFix() {
        if (!sh.classList.contains('visible')) return;
        const vv = window.visualViewport; if (!vv) return;
        const vvh = vv.height, offsetTop = vv.offsetTop||0, offsetLeft = vv.offsetLeft||0;
        sh.style.transform = `translateY(${offsetTop}px) translateX(${offsetLeft}px)`;
        sh.style.height = vvh + 'px';
        const msgs = document.getElementById('chat-messages');
        if (msgs) setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 50);
      }
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', _chatKbFix);
        window.visualViewport.addEventListener('scroll', _chatKbFix);
        sh._chatKbFix = _chatKbFix;
      }
    }
    if (navigator.vibrate) navigator.vibrate(30);
    return;
  }
  document.querySelectorAll('.sheet').forEach(s => {
    if (s.id !== name+'-sheet') {
      s.classList.remove('open');
      s.style.visibility = ''; s.style.pointerEvents = '';
      if (s._kbHandler) { s.removeEventListener('focusin', s._kbHandler); delete s._kbHandler; }
    }
  });
  document.querySelectorAll('.sheet-overlay').forEach(o => {
    if (o.id !== name+'-overlay') {
      o.classList.remove('open'); o.style.display = '';
    }
  });
  // cleanup dynamic overlays
  document.querySelectorAll('.cdel-overlay, #admin-manage-tk-ov').forEach(el => el.remove());
  const ov = document.getElementById(name+'-overlay');
  const sh = document.getElementById(name+'-sheet');
  if (!ov || !sh) { console.warn('openSheet: not found:', name); return; }
  sh.style.visibility = ''; sh.style.pointerEvents = '';
  ov.classList.add('open');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      sh.classList.add('open');
      // lock body scroll เพื่อกัน page ขยับตอน keyboard ขึ้น
      if (typeof _lockBodyScroll === 'function') _lockBodyScroll();
      const onFocusIn = (e) => {
        const el = e.target;
        if (!el || !['INPUT','TEXTAREA','SELECT'].includes(el.tagName)) return;
        setTimeout(() => { el.scrollIntoView({ block:'nearest', behavior:'smooth' }); }, 320);
      };
      sh.addEventListener('focusin', onFocusIn);
      sh._kbHandler = onFocusIn;
    });
  });
  if (navigator.vibrate) navigator.vibrate(30);
}

function closeSheet(name){
  if (name === 'chat') {
    const sh = document.getElementById('chat-sheet');
    if (sh) {
      // blur ก่อนเพื่อ dismiss keyboard แล้ว reset transform
      if (document.activeElement && sh.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      sh.classList.remove('visible');
      if (sh._chatKbFix && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', sh._chatKbFix);
        window.visualViewport.removeEventListener('scroll', sh._chatKbFix);
        delete sh._chatKbFix;
      }
      sh.style.height = ''; sh.style.top = ''; sh.style.transform = '';
      if (typeof _unlockBodyScroll === 'function') _unlockBodyScroll();
    }
    return;
  }
  if (name === 'machine') {
    const mid = document.getElementById('m-id'); if (mid) mid.value = '';
    const titleText = document.getElementById('ms-title-text'); if (titleText) titleText.textContent = 'เพิ่มเครื่องแอร์ใหม่';
    const addDeptBox = document.getElementById('m-add-dept-box'); if (addDeptBox) addDeptBox.style.display = 'block';
    const missingBanner = document.getElementById('ms-missing-banner'); if (missingBanner) missingBanner.style.display = 'none';
  }
  const sh = document.getElementById(name+'-sheet');
  const ov = document.getElementById(name+'-overlay');
  if (sh) {
    // blur ก่อนเพื่อ dismiss keyboard
    if (document.activeElement && sh.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    sh.classList.remove('open');
    if (sh._kbHandler) { sh.removeEventListener('focusin', sh._kbHandler); delete sh._kbHandler; }
  }
  // unlock body scroll
  if (typeof _unlockBodyScroll === 'function') _unlockBodyScroll();
  if (ov) { ov.classList.remove('open'); ov.style.display = 'none'; setTimeout(() => { if (!ov.classList.contains('open')) ov.style.display = ''; }, 400); }
}

// ============================================================
// NOTIFY + LINE — ย้ายมาจาก app-admin.js
// ============================================================
function notifyUser(uid,title,msg,tid='',_skipSync=false){
  if(!uid)return;
  if(!db.notifications)db.notifications=[];
  db.notifications.unshift({id:'n'+Date.now()+Math.random(),userId:uid,title,msg,tid,time:nowStr(),read:false});
  if(db.notifications.length>150)db.notifications=db.notifications.slice(0,150);
  if(CU && uid===CU.id){
    updateNBadge();
    const bell=document.getElementById('ntf-btn');
    if(bell){bell.style.transform='scale(1.3)';setTimeout(()=>bell.style.transform='',300);}
  }
  if(!_skipSync && typeof fsSave==='function') fsSave();
}
function notifyRole(role,title,msg,tid=''){
  db.users.filter(u=>u.role===role).forEach(u=>notifyUser(u.id,title,msg,tid,true));
  if(typeof fsSave==='function') fsSave();
}
function updateNBadge(){
  const cnt=db.notifications.filter(n=>n.userId===CU?.id&&!n.read).length;
  document.getElementById('ndot')?.classList.toggle('on',cnt>0);
}
function renderNotifPanel(){
  const mine=db.notifications.filter(n=>n.userId===CU?.id).slice(0,10);
  const nb=document.getElementById('notif-body'); if(!nb)return;
  nb.innerHTML=mine.length===0
    ?'<div class="empty" style="padding:24px"><div class="ei">🔔</div><p>ไม่มีการแจ้งเตือน</p></div>'
    :mine.map(n=>`<div class="notif-item ${n.read?'':'unread'}" id="ni-${n.id}" onclick="clickNotif('${n.id}','${n.tid||''}')" style="cursor:pointer;position:relative">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="font-size:1.3rem;flex-shrink:0;margin-top:1px">${n.title.match(/^[^\s]+/)?.[0]||'🔔'}</div>
          <div style="flex:1;overflow:hidden">
            <div class="ni-title" style="font-size:0.84rem;font-weight:700">${n.title.replace(/^[^\s]+\s*/,'')}</div>
            <div class="ni-msg" style="font-size:0.78rem;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.msg}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
              <div class="ni-time" style="font-size:0.68rem;color:#9ca3af">${n.time}</div>
              ${n.tid&&!n.read?`<span style="font-size:0.65rem;background:#fff0f2;color:var(--accent);border-radius:99px;padding:2px 8px;font-weight:700">${n.tid.replace(/^tk_/,'')} →</span>`:''}
            </div>
          </div>
          ${!n.read?'<div style="width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:4px"></div>':''}
          <button onclick="event.stopPropagation();dismissNotif('${n.id}')"
            style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:#f1f5f9;border:none;cursor:pointer;color:#94a3b8;font-size:0.85rem;font-weight:800;display:flex;align-items:center;justify-content:center">×</button>
        </div>
      </div><div class="ni-sep"></div>`).join('');
}
function openNotifSheet() {
  renderNotifPanel();
  openSheet('notif');
}
function markAllRead() {
  if (!db.notifications) return;
  db.notifications.forEach(n => { if (n.userId === CU?.id) n.read = true; });
  saveDB(); updateNBadge(); renderNotifPanel();
}
function clearNotifs() {
  if (!db.notifications) return;
  db.notifications = db.notifications.filter(n => n.userId !== CU?.id);
  saveDB(); updateNBadge(); renderNotifPanel();
}
function clickNotif(id, tid) {
  const n = (db.notifications||[]).find(x => x.id === id);
  if (n) { n.read = true; saveDB(); updateNBadge(); }
  closeSheet('notif');
  if (tid) setTimeout(() => { if (typeof openDetail === 'function') openDetail(tid); else if (typeof safeOpenDetail === 'function') safeOpenDetail(tid); }, 300);
}
function dismissNotif(id) {
  db.notifications = (db.notifications||[]).filter(n => n.id !== id);
  saveDB(); updateNBadge(); renderNotifPanel();
}

function sendLineNotifyEvent(event, t) {
  // ── LINE Messaging API (push ตรงหา userId) ──
  if (typeof lineMessagingEvent === 'function') {
    lineMessagingEvent(event, t).catch(e => console.warn('[lineMessaging]', e));
  }
  const ln = db.lineNotify; if (!ln) return;
  const ser = (typeof getSerial==='function') ? (getSerial(t) ? ' ['+getSerial(t)+']' : '') : '';
  const base = '\n🏭 SCG AIRCON BP\n';
  const lineNotifyFn = (typeof lineNotify==='function') ? lineNotify : ()=>{};
  if (event==='new' && ln.evNew) {
    const msg = base+'🆕 งานใหม่เข้า!\n📋 '+t.id+ser+'\n🔧 '+t.problem+'\n❄️ '+t.machine+'\n📢 ผู้แจ้ง: '+t.reporter+'\n🔥 ด่วน: '+(typeof prTH==='function'?prTH(t.priority):t.priority)+'\n🕐 '+nowStr();
    if(ln.tokenAdmin) lineNotifyFn(ln.tokenAdmin,msg);
    if(ln.tokenTech)  lineNotifyFn(ln.tokenTech,msg);
  } else if (event==='accept' && ln.evAccept) {
    const msg = base+'🔧 ช่างรับงานและเริ่มซ่อมแล้ว\n📋 '+t.id+ser+'\n🔧 '+t.problem+'\n👷 ช่าง: '+(t.assignee||'—')+'\n🕐 '+nowStr();
    if(ln.tokenAdmin) lineNotifyFn(ln.tokenAdmin,msg);
  } else if (event==='start' && ln.evAccept) {
    const msg = base+'⚙️ เริ่มซ่อมแล้ว\n📋 '+t.id+ser+'\n🔧 '+t.problem+'\n👷 ช่าง: '+(t.assignee||'—')+'\n🕐 '+nowStr();
    if(ln.tokenAdmin) lineNotifyFn(ln.tokenAdmin,msg);
  } else if (event==='done' && ln.evDone) {
    const msg = base+'✅ ซ่อมเสร็จแล้ว!\n📋 '+t.id+ser+'\n🔧 '+t.problem+'\n❄️ '+t.machine+'\n👷 ช่าง: '+(t.assignee||'—')+'\n📝 '+(t.summary||'')+'\n🕐 '+nowStr();
    if(ln.tokenAdmin) lineNotifyFn(ln.tokenAdmin,msg);
    if(ln.tokenTech)  lineNotifyFn(ln.tokenTech,msg);
  }
}

// ============================================================
// showToast + showAlert — ย้ายมาจาก app-users.js
// ============================================================

function showToast(msg, type) {
  // type: 'success' | 'warn' | 'error' | 'info' (auto-detect from emoji)
  if (!type) {
    if (msg.startsWith('✅') || msg.startsWith('🎉')) type = 'success';
    else if (msg.startsWith('⚠️') || msg.startsWith('🔶')) type = 'warn';
    else if (msg.startsWith('❌') || msg.startsWith('🚫')) type = 'error';
    else type = 'info';
  }
  const cfg = {
    success: { bg:'#1e293b', icon:'✅', glow:'rgba(22,163,74,0.2)',  accent:'#22c55e' },
    warn:    { bg:'#1e293b', icon:'⚠️', glow:'rgba(217,119,6,0.2)',  accent:'#f59e0b' },
    error:   { bg:'#1e293b', icon:'❌', glow:'rgba(200,16,46,0.2)',  accent:'#ef4444' },
    info:    { bg:'#1e293b', icon:'ℹ️', glow:'rgba(29,78,216,0.2)',  accent:'#60a5fa' },
  };
  const c = cfg[type] || cfg.info;

  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    document.body.appendChild(el);
  }
  // Clear existing timeout
  clearTimeout(el._to);

  el.style.cssText = `
    position:fixed;
    bottom:calc(var(--nav-h,64px) + env(safe-area-inset-bottom,0px) + 12px);
    right:16px;
    transform:translateX(16px);
    z-index:19999;
    pointer-events:none;
    transition:all 0.2s ease;
    opacity:0;
    max-width:min(300px,calc(100vw - 32px));
    width:max-content;
  `;
  el.innerHTML = `
    <div style="
      background:#1e293b;
      color:white;
      padding:10px 14px;
      border-radius:10px;
      box-shadow:0 4px 20px rgba(0,0,0,0.3);
      display:flex;align-items:center;gap:8px;
      border-left:3px solid ${c.accent};
      min-width:180px;
    ">
      <div style="font-size:0.95rem;flex-shrink:0;line-height:1">${c.icon}</div>
      <div style="font-size:0.82rem;font-weight:600;line-height:1.4;font-family:inherit;color:rgba(255,255,255,0.95)">${msg.replace(/^[✅⚠️❌ℹ️🎉🚫🔶]\s*/,'')}</div>
    </div>`;

  // Animate in — slide from right
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(0)';
  });

  el._to = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(16px)';
  }, 2500);
}

// ── showAlert — confirmation modal กลางจอ (ใช้แทน alert()) ──
function showAlert(opts) {
  // opts: { title, msg, icon, color, btnOk, btnCancel, onOk, onCancel }
  const existing = document.getElementById('_alert_modal');
  if (existing) existing.remove();
  const o = {
    icon: opts.icon || 'ℹ️',
    title: opts.title || 'แจ้งเตือน',
    msg: opts.msg || '',
    color: opts.color || '#1d4ed8',
    btnOk: opts.btnOk || 'ตกลง',
    btnCancel: opts.btnCancel || null,
    onOk: opts.onOk || null,
    onCancel: opts.onCancel || null,
  };
  const ov = document.createElement('div');
  ov.id = '_alert_modal';
  ov.style.cssText = 'position:fixed;inset:0;z-index:19998;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px';

  const box = document.createElement('div');
  box.style.cssText = 'background:white;border-radius:24px;padding:28px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.3);animation:popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)';
  box.innerHTML = `
    <div style="width:64px;height:64px;border-radius:20px;background:${o.color}18;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:2.2rem;border:2px solid ${o.color}33">${o.icon}</div>
    <div style="font-size:1.05rem;font-weight:900;color:#0f172a;margin-bottom:8px;line-height:1.3">${o.title}</div>
    <div style="font-size:0.85rem;color:#64748b;line-height:1.75;margin-bottom:22px">${o.msg}</div>
    <div style="display:flex;gap:8px">
      ${o.btnCancel ? `<button id="_alert_cancel" style="flex:1;padding:14px;background:#f1f5f9;color:#64748b;border:none;border-radius:14px;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent">${o.btnCancel}</button>` : ''}
      <button id="_alert_ok" style="flex:${o.btnCancel?2:1};padding:14px;background:linear-gradient(135deg,${o.color},${o.color}cc);color:white;border:none;border-radius:14px;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px ${o.color}44;-webkit-tap-highlight-color:transparent">
        ${o.btnOk}
      </button>
    </div>`;

  ov.appendChild(box);
  document.body.appendChild(ov);

  document.getElementById('_alert_ok').onclick = () => {
    ov.remove(); if (o.onOk) o.onOk();
  };
  if (o.btnCancel) {
    document.getElementById('_alert_cancel').onclick = () => {
      ov.remove(); if (o.onCancel) o.onCancel();
    };
  }
  ov.addEventListener('click', e => { if(e.target===ov){ ov.remove(); if(o.onCancel) o.onCancel(); } });
}
// ============================================================
// SYNC FUNCTIONS — ย้ายมาจาก app-admin.js
// ============================================================
let _syncCount = 0;
function _showSyncDot(){_syncCount++;const d=document.getElementById("sync-dot");if(d)d.style.display="inline";}
function _hideSyncDot(){_syncCount=Math.max(0,_syncCount-1);if(_syncCount===0){const d=document.getElementById("sync-dot");if(d)d.style.display="none";}}
async function syncUser(u){const url=db.gsUrl;if(!url)return;_showSyncDot();try{await fetch(url,{method:"POST",mode:"no-cors",body:JSON.stringify({action:"user",d:u}),headers:{"Content-Type":"application/json"}});}catch(e){}finally{_hideSyncDot();}}
async function syncTicket(t){const url=db.gsUrl;if(!url)return;_showSyncDot();try{const {signatures:_s,...tNoSig}=t;await fetch(url,{method:"POST",mode:"no-cors",body:JSON.stringify({action:"ticket",d:tNoSig}),headers:{"Content-Type":"application/json"}});}catch(e){}finally{_hideSyncDot();}}
async function syncMachine(m){const url=db.gsUrl;if(!url)return;_showSyncDot();try{await fetch(url,{method:"POST",mode:"no-cors",body:JSON.stringify({action:"machine",d:m}),headers:{"Content-Type":"application/json"}});}catch(e){}finally{_hideSyncDot();}}

// ============================================================
// ADMIN UI FUNCTIONS — ย้ายมาจาก app-admin.js
// ============================================================

function initSidebarState() {
  const app = document.getElementById('app');
  if (!app) return;
  // landscape มือถือ — ไม่ต้องใช้ sidebar เลย ใช้ bottom nav แทน
  if (window.innerHeight < 600 && window.innerWidth > window.innerHeight) return;
  if (localStorage.getItem('aircon_sidebar_collapsed') === '1') {
    app.classList.add('sidebar-collapsed');
    const icon = document.getElementById('sidebar-toggle-icon');
    if (icon) icon.innerHTML = '<polyline points="9 18 15 12 9 6"/>';
  }
}

function _closeTopMenu() {
  const m = document.getElementById('tb-quick-menu');
  if (m) m.style.display = 'none';
  document.removeEventListener('click', _menuOutsideTap);
}

function initLang() {
  _lang = localStorage.getItem('aircon_lang') || 'TH';
  const btn = document.getElementById('lang-btn');
  if (btn) btn.textContent = _lang === 'EN' ? '🇹🇭 TH' : '🇬🇧 EN';
  if (_lang === 'EN') applyLang();
}

function initDarkMode() {
  const saved = localStorage.getItem('aircon_dark');
  if (saved === '1') {
    document.body.classList.add('dark-mode');
    _updateDarkBtn(true);
  }
}

function resetCompleteExtras() {
  document.querySelectorAll('.cl-item').forEach(c=>c.checked=false);
  ['m-temp-before','m-temp-after','m-amp-before','m-amp-after',
   'm-psi-lo-before','m-psi-lo-after','m-psi-hi-before','m-psi-hi-after'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const cb=document.getElementById('checklist-body'); if(cb){cb.style.display='none';}
  const mb=document.getElementById('measure-body'); if(mb){mb.style.display='none';}
  const ci=document.getElementById('checklist-toggle-icon'); if(ci) ci.textContent='▼';
  const mi=document.getElementById('measure-toggle-icon'); if(mi) mi.textContent='▼';
  // ซ่อนและ reset ตารางอะไหล่
  const partsBlock = document.getElementById('c-parts-block');
  if (partsBlock) {
    partsBlock.style.display = 'none';
    const pl = document.getElementById('c-parts-list');
    if (pl) pl.innerHTML = `<div style="display:flex;gap:7px;align-items:center">
      <input type="text" placeholder="ชื่ออะไหล่..." class="c-part-name" style="flex:3;font-size:0.85rem;padding:9px 10px;border:1.5px solid #fde68a;border-radius:9px;font-family:inherit"/>
      <input type="number" placeholder="จำนวน" class="c-part-qty" style="width:80px;font-size:0.85rem;padding:9px 8px;border:1.5px solid #fde68a;border-radius:9px;font-family:inherit;text-align:center"/>
    </div>`;
  }
  // ล้าง repair tags
  const rt = document.getElementById('c-repair-tags');
  if (rt) rt.innerHTML = '';
  const rc = document.getElementById('c-repair-count');
  if (rc) rc.textContent = '0 รายการ';
}

function goPagePMPlan() {
  // เติม tech dropdown + dept list + default date
  const today = new Date().toISOString().split('T')[0];
  const dateEl = document.getElementById('pmplan-start-date');
  if (dateEl) dateEl.value = today;
  const techSel = document.getElementById('pmplan-tech');
  if (techSel) {
    techSel.innerHTML = '<option value="">— เลือกช่าง —</option>';
    (db.users||[]).filter(u => u.role==='tech').forEach(u => {
      const o = document.createElement('option');
      o.value = u.id; o.textContent = u.name;
      techSel.appendChild(o);
    });
  }
  renderPMPlanDeptList();
  setPMPlanType('clean-major');
  switchPMPlanTab('create');
  goPage('pmplan');
}

function openSignaturePad(tid, type) {
  // type: 'tech_done' | 'reporter_verify' | 'admin_close'
  _sigTid = tid; _sigType = type;

  const labels = {
    tech_done:       { title: '✍️ เซ็นชื่อช่างผู้ซ่อม',    sub: 'ยืนยันการซ่อมเสร็จสมบูรณ์' },
    reporter_verify: { title: '✍️ เซ็นชื่อผู้ตรวจรับงาน', sub: 'ยืนยันการตรวจรับงาน' },
    admin_close:     { title: '✍️ เซ็นชื่อผู้ดูแลระบบ',    sub: 'ยืนยันการปิดงาน' },
  };
  const lbl = labels[type] || { title: '✍️ เซ็นชื่อ', sub: '' };

  // ลบ overlay เก่าก่อน
  document.getElementById('sig-overlay')?.remove();

  const ov = document.createElement('div');
  ov.id = 'sig-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.65);display:flex;align-items:flex-end;justify-content:center;';
  ov.innerHTML = `
    <div style="background:#fff;border-radius:22px 22px 0 0;width:100%;max-width:520px;padding:20px 20px 32px;box-shadow:0 -8px 40px rgba(0,0,0,0.18)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div>
          <div style="font-size:1rem;font-weight:800;color:#0f172a">${lbl.title}</div>
          <div style="font-size:0.72rem;color:#64748b;margin-top:1px">${lbl.sub}</div>
        </div>
        <button onclick="closeSignaturePad()" style="width:32px;height:32px;border-radius:8px;background:#f1f5f9;border:none;font-size:1rem;cursor:pointer;color:#64748b">✕</button>
      </div>
      <div style="font-size:0.65rem;color:#94a3b8;margin-bottom:8px;text-align:center">วาดลายเซ็นในกรอบด้านล่าง</div>
      <canvas id="sig-canvas"
        style="width:100%;height:180px;border:2px dashed #cbd5e1;border-radius:14px;background:#f8fafc;touch-action:none;display:block;cursor:crosshair">
      </canvas>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button onclick="clearSignaturePad()"
          style="flex:1;padding:11px;border-radius:12px;border:1.5px solid #e2e8f0;background:#fff;font-size:0.85rem;font-weight:700;color:#64748b;cursor:pointer;font-family:inherit">
          🗑️ ล้าง
        </button>
        <button onclick="confirmSignature()"
          style="flex:2;padding:11px;border-radius:12px;border:none;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;font-size:0.85rem;font-weight:800;cursor:pointer;font-family:inherit">
          ✅ ยืนยันลายเซ็น
        </button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  // Setup canvas — ใช้ setTimeout เพื่อให้ browser render overlay ก่อน
  const canvas = document.getElementById('sig-canvas');
  const _setupCanvas = () => {
    const rect = canvas.getBoundingClientRect();
    // ใช้ขนาดจริงจาก CSS (width:100% height:180px) 
    const w = rect.width  > 10 ? rect.width  : (window.innerWidth - 80);
    const h = rect.height > 10 ? rect.height : 180;
    canvas.width  = w;
    canvas.height = h;
    _sigCanvas = canvas;
    _sigCtx = canvas.getContext('2d');
    _sigCtx.strokeStyle = '#1e293b';
    _sigCtx.lineWidth = 2.5;
    _sigCtx.lineCap = 'round';
    _sigCtx.lineJoin = 'round';
    // Touch events
    canvas.addEventListener('touchstart',  _sigTouchStart,  {passive:false});
    canvas.addEventListener('touchmove',   _sigTouchMove,   {passive:false});
    canvas.addEventListener('touchend',    _sigTouchEnd,    {passive:false});
    // Mouse events
    canvas.addEventListener('mousedown',   _sigMouseDown);
    canvas.addEventListener('mousemove',   _sigMouseMove);
    canvas.addEventListener('mouseup',     _sigMouseUp);
    canvas.addEventListener('mouseleave',  _sigMouseUp);
  };
  // setTimeout 100ms — รอให้ overlay render+paint เสร็จสมบูรณ์ก่อน
  setTimeout(_setupCanvas, 100);
}

// --- additional admin UI ---

function applyLang() {
  const isEN = _lang === 'EN';

  // ── data-i18n attributes ──
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-ph'));
  });

  // ── Bottom nav ──
  const navTH = {
    'home':'หน้าแรก','tickets':'รายการ','machines':'เครื่องแอร์',
    'users':'ผู้ใช้','report':'รายงาน','purchase':'สั่งซื้อ',
    'settings':'ตั้งค่า','new':'แจ้งซ่อม','calendar':'ปฏิทิน',
    'tracking':'ติดตาม','mywork':'ติดตาม','chatroom':'แชท'
  };
  document.querySelectorAll('.bn-item[data-page]').forEach(item => {
    const page = item.getAttribute('data-page');
    const labelEl = item.querySelector('.bn-label');
    if (!labelEl || !navTH[page]) return;
    labelEl.textContent = t(navTH[page]);
  });

  // ── Tab bar (ptab) ──
  const tabTH = {
    '':'ทั้งหมด','new':'ใหม่','assigned':'จ่ายแล้ว','accepted':'รับแล้ว',
    'inprogress':'กำลังซ่อม','waiting_part':'รออะไหล่','done':'เสร็จแล้ว','verified':'ตรวจรับ'
  };
  document.querySelectorAll('.ptab[data-val]').forEach(btn => {
    const v = btn.getAttribute('data-val');
    if (v in tabTH) {
      const icon = btn.textContent.match(/^[^\w\u0E00-\u0E7F]+/)?.[0] || '';
      btn.textContent = icon + t(tabTH[v]);
    }
  });

  // ── Status scroll cards ──
  const scTH = {'':'ทั้งหมด','new':'ใหม่','assigned':'จ่ายแล้ว',
    'accepted':'รับแล้ว','inprogress':'กำลังซ่อม',
    'waiting_part':'รออะไหล่','done':'เสร็จแล้ว','verified':'ตรวจรับ'};
  const scIcon = {'':'','new':'📩','assigned':'👤','accepted':'🙋',
    'inprogress':'⚙️','waiting_part':'⏳','done':'✅','verified':'🔵'};
  document.querySelectorAll('.sc-card[data-s]').forEach(card => {
    const s = card.getAttribute('data-s');
    const lbl = card.querySelector('.sc-l');
    if (!lbl || !(s in scTH)) return;
    lbl.innerHTML = (scIcon[s] ? scIcon[s] + '<br>' : '') + t(scTH[s]);
  });

  // ── Page titles / section headers with data-i18n ──
  // ── Calendar ──
  const pmBtn = document.querySelector('#pg-calendar button[onclick="goPagePMPlan()"]');
  if (pmBtn) { const sp = pmBtn.querySelector('span')||pmBtn; sp.textContent = '📅 ' + t('วางแผน PM'); }
  const addBtn = document.getElementById('cal-add-btn');
  if (addBtn) { const sp = addBtn.querySelector('span'); if(sp) sp.textContent = t('เพิ่ม'); }

  // ── Search placeholders ──
  ['mac-search','tk-search-input','user-search'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.placeholder = isEN ? 'Search...' : (id==='mac-search'?'ค้นหาเครื่อง...':id==='user-search'?'ค้นหาผู้ใช้...':'ค้นหางาน...');
  });

  // ── Lang button ──
  const langBtn = document.getElementById('lang-btn');
  // Lang shown in quick menu
  const _langBtn = document.getElementById('lang-btn');
  if (_langBtn) _langBtn.textContent = isEN ? '🇹🇭 TH' : '🇬🇧 EN';

  // ── html lang attribute ──
  document.documentElement.lang = isEN ? 'en' : 'th';

  // re-render active page
  const pages = ['tickets','calendar','machines','users','purchase','report'];
  pages.forEach(p => {
    const pg = document.getElementById('pg-'+p);
    if (pg?.classList.contains('active')) {
      if (p==='tickets' && CU) renderTickets();
      else if (p==='calendar') renderCalendar?.();
      else if (p==='machines') renderMachines?.();
      else if (p==='users') renderUsers?.();
      else if (p==='purchase') renderPurchase?.();
    }
  });
}

function _updateDarkBtn(isDark) {
  const btn = document.getElementById('dark-toggle-btn');
  if (!btn) return;
  btn.textContent = isDark ? '☀️' : '🌙';
  btn.style.background = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)';
  // settings toggle (ถ้ามี)
  const knob = document.getElementById('dark-knob');
  if (knob) knob.style.left = isDark ? '27px' : '3px';
  const settBtn = document.getElementById('dark-settings-btn');
  if (settBtn) settBtn.style.background = isDark ? '#c8102e' : '#e2e8f0';
}

function switchPMPlanTab(tab) {
  ['create','schedule','history'].forEach(t => {
    const btn = document.querySelector(`.pmplan-tab-btn[data-tab="${t}"]`);
    const panel = document.getElementById('pmplan-panel-' + t);
    if (btn) btn.classList.toggle('active', t === tab);
    if (panel) panel.style.display = t === tab ? '' : 'none';
  });
  if (tab === 'schedule') renderPMPlanSchedule();
  if (tab === 'history')  renderPMPlanHistory();
}

function renderPMPlanDeptList() {
  const list = document.getElementById('pmplan-dept-list');
  if (!list) return;
  // นับจำนวนแอร์แต่ละแผนก
  const deptCount = {};
  db.machines.forEach(m => {
    const d = m.dept || m.location || 'ไม่ระบุแผนก';
    deptCount[d] = (deptCount[d] || 0) + 1;
  });
  const depts = Object.entries(deptCount).sort((a,b) => b[1]-a[1]);
  list.innerHTML = depts.map(([dept, count]) => `
    <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8fafc;border-radius:12px;border:1.5px solid #e5e7eb;cursor:pointer;transition:all 0.15s;"
      onmouseover="this.style.borderColor='#38bdf8'" onmouseout="if(!this.querySelector('input').checked)this.style.borderColor='#e5e7eb'">
      <input type="checkbox" class="pmplan-dept-cb" data-dept="${dept}"
        style="width:17px;height:17px;accent-color:#0369a1;flex-shrink:0;"
        onchange="pmplanUpdateCheck(this)">
      <div style="flex:1;min-width:0">
        <div style="font-size:0.85rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${dept}</div>
      </div>
      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
        <div style="background:#0369a1;color:white;border-radius:99px;padding:2px 10px;font-size:0.72rem;font-weight:800;">${count}</div>
        <div style="font-size:0.62rem;color:#94a3b8;font-weight:600">เครื่อง</div>
      </div>
    </label>`).join('');
}

function setPMPlanType(t) {
  document.getElementById('pmplan-type').value = t;
  const majorBtn = document.getElementById('pmplan-major-btn');
  const minorBtn = document.getElementById('pmplan-minor-btn');
  if (t === 'clean-major') {
    majorBtn.style.background = 'linear-gradient(135deg,#0369a1,#0c4a6e)';
    majorBtn.style.borderColor = '#0369a1';
    majorBtn.style.color = 'white';
    majorBtn.style.transform = 'scale(1.05) translateY(-2px)';
    majorBtn.style.boxShadow = '0 8px 24px rgba(3,105,161,0.5)';
    minorBtn.style.background = 'linear-gradient(135deg,#f8fafc,#f1f5f9)';
    minorBtn.style.borderColor = '#e2e8f0';
    minorBtn.style.color = '#64748b';
    minorBtn.style.transform = 'scale(1) translateY(0)';
    minorBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
  } else {
    minorBtn.style.background = 'linear-gradient(135deg,#059669,#065f46)';
    minorBtn.style.borderColor = '#059669';
    minorBtn.style.color = 'white';
    minorBtn.style.boxShadow = '0 8px 24px rgba(5,150,105,0.5)';
    minorBtn.style.transform = 'scale(1.05) translateY(-2px)';
    majorBtn.style.background = 'linear-gradient(135deg,#f8fafc,#f1f5f9)';
    majorBtn.style.borderColor = '#e2e8f0';
    majorBtn.style.color = '#64748b';
    majorBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
    majorBtn.style.transform = 'scale(1) translateY(0)';
  }
}

function clearSignaturePad() {
  if (!_sigCanvas || !_sigCtx) return;
  _sigCtx.clearRect(0, 0, _sigCanvas.width, _sigCanvas.height);
}

function closeSignaturePad() {
  document.getElementById('sig-overlay')?.remove();
  _sigTid = ''; _sigType = ''; _sigCanvas = null; _sigCtx = null;
}

async function confirmSignature() {
  if (!_sigCanvas) return;
  // ตรวจว่ามีการวาดหรือยัง (pixel ที่ไม่ใช่ transparent)
  const px = _sigCtx.getImageData(0,0,_sigCanvas.width,_sigCanvas.height).data;
  const hasStroke = px.some((v,i) => i%4===3 && v>10);
  if (!hasStroke) { showToast('⚠️ กรุณาวาดลายเซ็นก่อน'); return; }

  const dataUrl = _sigCanvas.toDataURL('image/png');
  const tid     = _sigTid;
  const type    = _sigType;

  // map type → key ใน t.signatures
  const keyMap = { tech_done:'tech', reporter_verify:'reporter', admin_close:'admin' };
  const sigKey = keyMap[type] || type;

  // บันทึกใน ticket object
  const t = db.tickets.find(x=>x.id===tid);
  if (t) {
    if (!t.signatures) t.signatures = {};
    t.signatures[sigKey] = { data: dataUrl, by: CU.name, at: nowStr() };
    saveDB();
  }

  // บันทึกใน localStorage cache
  try {
    const cache = JSON.parse(localStorage.getItem(SIGS_KEY)||'{}');
    if (!cache[tid]) cache[tid] = {};
    cache[tid][sigKey] = { data: dataUrl, by: CU.name, at: nowStr() };
    localStorage.setItem(SIGS_KEY, JSON.stringify(cache));
  } catch(e) {}

  // บันทึกขึ้น Firebase
  if (_firebaseReady && FSdb) {
    try {
      const sigSnap = await FSdb.collection('appdata').doc('signatures').get();
      const allSigs = sigSnap.exists ? (sigSnap.data()||{}) : {};
      if (!allSigs[tid]) allSigs[tid] = {};
      allSigs[tid][sigKey] = { data: dataUrl, by: CU.name, at: nowStr() };
      await FSdb.collection('appdata').doc('signatures').set(allSigs);
    } catch(e) { console.warn('sig firebase save error', e); }
  }

  closeSignaturePad();
  showToast('✅ บันทึกลายเซ็นเรียบร้อย');
}

// _fmt (number formatter) ย้ายมาจาก app-executive.js
function _fmt(n) {
  return Number(n || 0).toLocaleString('th-TH', {minimumFractionDigits: 0});
}

// PM Plan render functions ย้ายมาจาก app-admin.js

function renderPMPlanSchedule() {
  const el = document.getElementById('pmplan-schedule-list');
  if (!el) return;
  const pmEvents = (db.calEvents||[])
    .filter(e => e.type === 'clean-major' || e.type === 'clean-minor')
    .sort((a,b) => a.date.localeCompare(b.date));

  if (!pmEvents.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8">
      <div style="font-size:2.5rem;margin-bottom:10px">📋</div>
      <div style="font-size:0.85rem;font-weight:700">ยังไม่มีแผน PM</div>
      <div style="font-size:0.72rem;margin-top:4px">กดแท็บ "สร้างแผน" เพื่อเพิ่ม</div>
    </div>`;
    return;
  }

  // group by month
  const byMonth = {};
  pmEvents.forEach(e => {
    const m = e.date.slice(0,7);
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(e);
  });

  el.innerHTML = Object.entries(byMonth).map(([month, evs]) => {
    const [y, m] = month.split('-');
    const thMonth = new Date(y, m-1).toLocaleDateString('th-TH', { month:'long', year:'numeric' });
    return `<div style="margin-bottom:14px">
      <div style="font-size:0.7rem;font-weight:800;color:#0369a1;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;display:flex;align-items:center;gap:6px">
        <div style="flex:1;height:1px;background:#bfdbfe"></div>
        ${thMonth}
        <span style="background:#eff6ff;color:#0369a1;border-radius:99px;padding:1px 8px;font-size:0.62rem">${evs.length} รายการ</span>
        <div style="flex:1;height:1px;background:#bfdbfe"></div>
      </div>
      ${evs.map(e => `
        <div style="background:white;border-radius:12px;padding:11px 13px;margin-bottom:7px;border:1px solid #e8ecf0;display:flex;align-items:center;gap:10px">
          <div style="width:38px;height:38px;border-radius:10px;background:${e.type==='clean-major'?'#eff6ff':'#f0fdf4'};display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">${e.type==='clean-major'?'🔵':'💦'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.78rem;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.title}</div>
            <div style="font-size:0.63rem;color:#64748b;margin-top:2px">
              📅 ${new Date(e.date+'T00:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})}
              ${e.tech ? ' · 👷 '+e.tech : ''}
            </div>
          </div>
          <button onclick="deletePMEvent('${e.id}')" style="width:28px;height:28px;border-radius:8px;background:#fff0f2;border:1px solid #fecdd3;color:#c8102e;font-size:0.75rem;cursor:pointer;flex-shrink:0">✕</button>
        </div>`).join('')}
    </div>`;
  }).join('');
}

function renderPMPlanHistory() {
  const el = document.getElementById('pmplan-history-list');
  if (!el) return;
  // นับ PM tickets ที่ปิดแล้ว
  const pmDone = (db.tickets||[]).filter(t =>
    t.status === 'done' &&
    (t.problem||'').match(/ล้างแอร์|PM บำรุงรักษา|ตรวจเช็คระบบ/)
  ).sort((a,b) => (b.closedAt||b.createdAt||'').localeCompare(a.closedAt||a.createdAt||''));

  if (!pmDone.length) {
    el.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8">
      <div style="font-size:2.5rem;margin-bottom:10px">📊</div>
      <div style="font-size:0.85rem;font-weight:700">ยังไม่มีประวัติ PM</div>
    </div>`;
    return;
  }

  const total = pmDone.length;
  const deptCounts = {};
  pmDone.forEach(t => { const d = t.dept||'ไม่ระบุ'; deptCounts[d] = (deptCounts[d]||0)+1; });

  el.innerHTML = `
    <div style="background:linear-gradient(135deg,#0369a1,#0c4a6e);border-radius:16px;padding:16px;color:white;text-align:center;margin-bottom:12px">
      <div style="font-size:0.6rem;opacity:0.7;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">PM ที่ทำแล้วทั้งหมด</div>
      <div style="font-size:2.2rem;font-weight:900;line-height:1">${total}</div>
      <div style="font-size:0.65rem;opacity:0.65;margin-top:4px">รายการ</div>
    </div>
    <div style="background:white;border-radius:14px;padding:12px 14px;margin-bottom:10px;border:1px solid #e8ecf0">
      <div style="font-size:0.7rem;font-weight:800;color:#64748b;margin-bottom:10px">สรุปตามแผนก</div>
      ${Object.entries(deptCounts).sort((a,b)=>b[1]-a[1]).map(([dept,cnt]) => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
          <div style="font-size:0.75rem;font-weight:700;color:#0f172a;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${dept}</div>
          <div style="background:#eff6ff;color:#0369a1;border-radius:99px;padding:2px 10px;font-size:0.68rem;font-weight:800;flex-shrink:0">${cnt} ครั้ง</div>
        </div>
        <div style="background:#f1f5f9;border-radius:99px;height:4px;margin-bottom:8px">
          <div style="background:#0369a1;border-radius:99px;height:4px;width:${Math.round(cnt/total*100)}%"></div>
        </div>`).join('')}
    </div>
    ${pmDone.slice(0,20).map(t => `
      <div style="background:white;border-radius:10px;padding:10px 12px;margin-bottom:6px;border:1px solid #f1f5f9;display:flex;align-items:center;gap:9px">
        <div style="width:32px;height:32px;border-radius:9px;background:#f0fdf4;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">✅</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.75rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.machine||t.problem||t.id}</div>
          <div style="font-size:0.62rem;color:#64748b;margin-top:1px">${t.dept||''} · ${t.closedAt?(new Date(t.closedAt).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})):''}</div>
        </div>
      </div>`).join('')}
  `;
}

function pmplanUpdateCheck(cb) {
  const label = cb.closest('label');
  if (cb.checked) {
    label.style.borderColor = '#0369a1';
    label.style.background = '#eff6ff';
  } else {
    label.style.borderColor = '#e5e7eb';
    label.style.background = '#f8fafc';
  }
}

function deletePMEvent(id) {
  db.calEvents = (db.calEvents||[]).filter(e => e.id !== id);
  saveDB(); fsSave();
  renderPMPlanSchedule();
  showToast('🗑️ ลบแผน PM แล้ว');
}

// ════════════════════════════════════════════════
// OFFLINE QUEUE — บันทึกการกระทำเมื่อไม่มีอินเทอร์เน็ต
// ════════════════════════════════════════════════
const OFFLINE_Q_KEY = 'aircon_offline_queue';
let _offlineQueue = [];

function _loadOfflineQueue() {
  try { _offlineQueue = JSON.parse(localStorage.getItem(OFFLINE_Q_KEY) || '[]'); } catch(e){ _offlineQueue=[]; }
}
function _saveOfflineQueue() {
  try { localStorage.setItem(OFFLINE_Q_KEY, JSON.stringify(_offlineQueue)); } catch(e){}
}
_loadOfflineQueue();

function isOnline() { return navigator.onLine; }

function offlineEnqueue(type, payload) {
  _offlineQueue.push({ id: Date.now()+'_'+Math.random().toString(36).slice(2,6), type, payload, ts: new Date().toISOString() });
  _saveOfflineQueue();
  updateOfflineBadge();
  showToast('📴 ออฟไลน์ — บันทึกใน Queue แล้ว จะ Sync อัตโนมัติเมื่อออนไลน์');
}

async function offlineSync() {
  if(!isOnline() || _offlineQueue.length === 0) return;
  const pending = [..._offlineQueue];
  _offlineQueue = [];
  _saveOfflineQueue();
  updateOfflineBadge();
  let success = 0, fail = 0;
  for(const item of pending) {
    try {
      if(item.type === 'fsSave') {
        await fsSave();
        success++;
      }
    } catch(e) {
      console.warn('[offlineSync] failed:', item.type, e);
      // RETRY LIMIT FIX (audit #5): ไม่ retry ถ้าเกิน 5 ครั้ง ป้องกัน infinite loop
      if ((item.retryCount || 0) < 5) {
        item.retryCount = (item.retryCount || 0) + 1;
        _offlineQueue.push(item); // put back
      } else {
        console.warn('[offlineSync] Drop item after 5 retries:', item.id || item.type);
      }
      fail++;
    }
  }
  _saveOfflineQueue();
  updateOfflineBadge();
  if(success > 0) showToast(`✅ Sync ${success} รายการสำเร็จ`);
  if(fail > 0)    showToast(`⚠️ Sync ล้มเหลว ${fail} รายการ — ลองใหม่ภายหลัง`);
}

function updateOfflineBadge() {
  const cnt = _offlineQueue.length;
  // Update badge in status bar if it exists
  const badge = document.getElementById('offline-queue-badge');
  if(badge) {
    badge.textContent = cnt > 0 ? `📴 ${cnt} รายการรอ Sync` : '';
    badge.style.display = cnt > 0 ? 'flex' : 'none';
  }
  // Update nav badge
  document.querySelectorAll('.offline-count').forEach(el => {
    el.textContent = cnt > 0 ? String(cnt) : '';
    el.style.display = cnt > 0 ? 'inline-flex' : 'none';
  });
}

// Auto-sync when coming back online
window.addEventListener('online', () => {
  updateOfflineBadge();
  offlineSync();
  showToast('🌐 กลับมาออนไลน์แล้ว กำลัง Sync...');
});
window.addEventListener('offline', () => {
  updateOfflineBadge();
  showToast('📴 ไม่มีการเชื่อมต่ออินเทอร์เน็ต');
});

// Override fsSave to queue when offline
const _origFsSave = typeof fsSave !== 'undefined' ? fsSave : null;
