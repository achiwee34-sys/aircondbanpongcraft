// ══════════════════════════════════════════════════════════════
//  liff-auth.js  — LINE LIFF Integration for AIRCONDITION BP
//  v1.0 | เพิ่ม Line Login / สมัครผ่าน LIFF
// ══════════════════════════════════════════════════════════════
//
//  วิธีใช้งาน:
//  1. ไปที่ LINE Developers Console → สร้าง LIFF App
//     - Size: Full  (หรือ Tall ก็ได้)
//     - Endpoint URL: URL ของแอพนี้
//     - Scopes: profile, openid
//  2. Copy LIFF ID มาใส่ใน LIFF_ID ด้านล่าง
//  3. (Optional) ใส่ LINE Messaging API Channel Access Token
//     ใน LINE_CHANNEL_TOKEN เพื่อยิง push message กลับหา user
//
// ══════════════════════════════════════════════════════════════

const LIFF_ID = '2009699254-TXIz4KN1';   // ← ใส่ LIFF ID จาก LINE Developers

// ── State ──────────────────────────────────────────────────────
let _liffReady = false;
let _liffProfile = null;   // { userId, displayName, pictureUrl, statusMessage }
let _liffInLine  = false;  // true = เปิดใน LINE browser

// ── ตรวจว่าอยู่ใน LINE หรือเปล่า ────────────────────────────
function isInLineApp() {
  return _liffInLine;
}

// ── Init LIFF SDK ─────────────────────────────────────────────
async function initLiff() {
  if (LIFF_ID === 'YOUR_LIFF_ID_HERE') {
    console.info('[LIFF] LIFF_ID ยังไม่ได้ตั้งค่า — ข้าม LIFF init');
    return false;
  }

  // ตรวจ SDK
  if (typeof liff === 'undefined') {
    console.warn('[LIFF] liff SDK ไม่พบ — ตรวจสอบ script tag ใน index.html');
    return false;
  }

  try {
    await liff.init({ liffId: LIFF_ID });
    _liffInLine  = liff.isInClient();
    _liffReady   = true;
    console.info('[LIFF] init OK | inLine:', _liffInLine, '| loggedIn:', liff.isLoggedIn());

    if (_liffInLine && !liff.isLoggedIn()) {
      // ยังไม่ได้ login → ให้ LINE login อัตโนมัติ
      liff.login({ redirectUri: location.href });
      return false;
    }

    if (liff.isLoggedIn()) {
      _liffProfile = await liff.getProfile();
      console.info('[LIFF] profile:', _liffProfile.displayName);
    }

    return true;
  } catch (e) {
    console.warn('[LIFF] init error:', e);
    return false;
  }
}

// ── เรียกดู LINE Profile ──────────────────────────────────────
function getLiffProfile() {
  return _liffProfile;
}

// ── Login ด้วย LINE (สำหรับ browser ปกติ จะ redirect ไป LINE OAuth) ──
function loginWithLine() {
  if (!_liffReady || typeof liff === 'undefined') {
    showToast('⚠️ กรุณาเปิดแอพนี้ผ่าน LINE');
    return;
  }
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: location.href });
  }
}

// ══════════════════════════════════════════════════════════════
//  doLoginWithLine()
//  — ค้นหา user จาก lineUserId → login เข้าระบบทันที
//  — ถ้ายังไม่มี user → เปิดหน้าสมัครพร้อม pre-fill ข้อมูล
// ══════════════════════════════════════════════════════════════
async function doLoginWithLine() {
  if (!_liffProfile) {
    showToast('❌ ไม่สามารถดึงข้อมูล LINE ได้');
    return;
  }

  const { userId: lineUserId, displayName, pictureUrl } = _liffProfile;

  // ── ค้นหา user ที่ผูก lineUserId ไว้แล้ว ──
  const existing = (db.users || []).find(u => u.lineUserId === lineUserId);

  if (existing) {
    // ── Login ทันที ──────────────────────────────────────────
    clearLoginErr();
    CU = existing;
    const sessionData = {
      uid: existing.id,
      uname: existing.username,
      exp: Date.now() + 8 * 60 * 60 * 1000,  // 8h
      lineAuth: true
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').classList.add('visible');
    initApp();
    loadMachinesData().then(() => {
      if (typeof refreshMachineList === 'function') refreshMachineList();
    });
    showToast('✅ เข้าสู่ระบบด้วย LINE สำเร็จ');
  } else {
    // ── ยังไม่มีบัญชี → เปิดหน้าสมัคร พร้อม pre-fill ──────
    showRegister();
    _prefillLineRegister(displayName, lineUserId, pictureUrl);
  }
}

// ── Pre-fill ข้อมูล LINE ลงในฟอร์มสมัคร ─────────────────────
function _prefillLineRegister(displayName, lineUserId, pictureUrl) {
  // ใส่ชื่อจาก LINE
  const nameEl = document.getElementById('reg-name');
  if (nameEl && !nameEl.value) {
    nameEl.value = displayName || '';
  }

  // ซ่อน/disable ช่อง Username + Password เมื่อสมัครผ่าน LINE
  _setLineRegisterMode(true, lineUserId, pictureUrl);
}

// ── สลับโหมดฟอร์มสมัคร: LINE mode vs. Manual mode ────────────
function _setLineRegisterMode(isLine, lineUserId, pictureUrl) {
  const lineCardEl  = document.getElementById('rg-line-card');
  const acctSection = document.getElementById('rg-acct-section');
  const hiddenLine  = document.getElementById('reg-line-user-id');

  if (lineCardEl) {
    lineCardEl.style.display = isLine ? 'flex' : 'none';
    if (isLine && pictureUrl) {
      const img = lineCardEl.querySelector('#rg-line-avatar');
      if (img) img.src = pictureUrl;
      const nm  = lineCardEl.querySelector('#rg-line-name');
      if (nm) nm.textContent = document.getElementById('reg-name')?.value || '';
    }
  }

  if (acctSection) {
    // ซ่อน section username/password เมื่อ LINE mode
    acctSection.style.display = isLine ? 'none' : 'block';
  }

  if (hiddenLine) {
    hiddenLine.value = isLine ? (lineUserId || '') : '';
  }
}

// ══════════════════════════════════════════════════════════════
//  doRegisterWithLine()
//  — สมัครสมาชิกโดยใช้ LINE userId เป็น key
//  — ไม่ต้องกรอก username/password
// ══════════════════════════════════════════════════════════════
async function doRegisterWithLine() {
  const name       = document.getElementById('reg-name').value.trim();
  const lineUserId = document.getElementById('reg-line-user-id')?.value?.trim();
  const dept       = document.getElementById('reg-dept').value.trim();
  const tel        = document.getElementById('reg-tel').value.trim();
  const errEl      = document.getElementById('reg-err');

  errEl.style.display = 'none';
  document.querySelectorAll('#reg-wrap .field-error').forEach(e => e.remove());

  if (!name)       { showFormError('reg-name', 'กรุณากรอกชื่อ-นามสกุล'); return; }
  if (!lineUserId) { showToast('❌ ไม่พบ LINE User ID กรุณาลองใหม่'); return; }

  // ตรวจซ้ำ (กันกด 2 ครั้ง)
  if ((db.users || []).find(u => u.lineUserId === lineUserId)) {
    showToast('✅ บัญชีนี้มีอยู่แล้ว กำลังเข้าสู่ระบบ...');
    setTimeout(doLoginWithLine, 800);
    return;
  }

  const uname = 'line_' + lineUserId.slice(-8);  // auto username

  const newUser = {
    id:          'u' + Date.now(),
    name,
    username:    uname,
    password:    '__LINE_AUTH__',   // ไม่มี password — ใช้ LINE auth เท่านั้น
    lineUserId,
    lineAvatar:  _liffProfile?.pictureUrl || '',
    role:        'reporter',
    dept,
    tel,
    createdAt:   nowStr()
  };

  db.users.push(newUser);
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch(e) {}

  const submitBtn = document.querySelector('#reg-wrap .rg-btn, #register-screen .rg-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '⏳ กำลัง sync...'; }

  const doAfterSave = () => {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'สมัครเข้าใช้งาน'; }
    notifyRole('admin', '🟢 LINE User ใหม่สมัครแล้ว',
      name + ' (LINE: ' + lineUserId.slice(-6) + ') สมัครเป็นผู้แจ้งงาน');
    showRegisterSuccess(name, () => {
      hideRegister();
      // auto-login ทันทีหลังสมัคร
      CU = newUser;
      const sessionData = {
        uid: newUser.id, uname: newUser.username,
        exp: Date.now() + 8 * 60 * 60 * 1000, lineAuth: true
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').classList.add('visible');
      initApp();
    });
  };

  if (typeof fsSaveNow === 'function' && typeof FSdb !== 'undefined' && FSdb) {
    fsSaveNow().then(doAfterSave).catch(doAfterSave);
  } else {
    if (typeof fsSave === 'function') fsSave();
    doAfterSave();
  }
}

// ══════════════════════════════════════════════════════════════
//  แสดง LIFF Login Button ที่หน้า Login
//  (เรียกจาก DOMContentLoaded หลัง initLiff())
// ══════════════════════════════════════════════════════════════
function renderLinLoginButton() {
  if (LIFF_ID === 'YOUR_LIFF_ID_HERE') return;

  const container = document.getElementById('line-login-btn-wrap');
  if (!container) return;

  if (!_liffReady) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  // ถ้ามี profile แล้ว (เปิดใน LINE และ logged in) → แสดงชื่อ
  if (_liffProfile) {
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;background:#06C755;border-radius:14px;padding:12px 16px;cursor:pointer;box-shadow:0 4px 16px rgba(6,199,85,0.35)" onclick="doLoginWithLine()">
        <img src="${_liffProfile.pictureUrl}" style="width:36px;height:36px;border-radius:50%;border:2px solid rgba(255,255,255,0.5)" onerror="this.style.display='none'">
        <div style="flex:1">
          <div style="color:#fff;font-size:0.75rem;font-weight:600;opacity:0.8">เข้าสู่ระบบในฐานะ</div>
          <div style="color:#fff;font-size:0.9rem;font-weight:800">${_liffProfile.displayName}</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></svg>
      </div>`;
  } else {
    container.innerHTML = `
      <button onclick="loginWithLine()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;background:#06C755;color:#fff;border:none;border-radius:14px;padding:13px 16px;font-size:0.92rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 16px rgba(6,199,85,0.3)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 5.92 2 10.72c0 3.16 1.88 5.94 4.72 7.56-.2.74-.72 2.68-.82 3.1-.12.52.19.52.4.38.17-.11 2.18-1.47 3.06-2.07.54.08 1.09.12 1.64.12 5.52 0 10-3.92 10-8.72S17.52 2 12 2z"/></svg>
        เข้าสู่ระบบด้วย LINE
      </button>`;
  }
}

// ── Divider ─────────────────────────────────────────────────
function renderLoginDivider() {
  if (LIFF_ID === 'YOUR_LIFF_ID_HERE') return;
  const el = document.getElementById('login-divider');
  if (el) el.style.display = 'flex';
}

// ══════════════════════════════════════════════════════════════
//  Auto-detect LIFF login เมื่อโหลดหน้า
//  — ถ้าเปิดใน LINE + มี profile → auto-login ทันที
// ══════════════════════════════════════════════════════════════
async function autoLiffLogin() {
  if (LIFF_ID === 'YOUR_LIFF_ID_HERE') return;

  const ok = await initLiff();
  if (!ok) return;

  renderLinLoginButton();
  renderLoginDivider();

  // ถ้า LINE logged in (ทั้งใน LINE client และ browser ปกติ) → auto-login ทันที
  // _liffInLine = เปิดใน LINE browser | _liffProfile = ดึง profile ได้แล้ว
  if (_liffProfile) {
    const existing = (db.users || []).find(u => u.lineUserId === _liffProfile.userId);
    if (existing) {
      // ตรวจว่า session ปัจจุบันเป็นของ user คนนี้อยู่แล้วหรือยัง (ไม่ต้อง re-login ซ้ำ)
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          if (s.uid === existing.id && s.exp > Date.now()) {
            // session ยังใช้ได้และเป็น user เดิม → skip (initApp จะ restore session เอง)
            return;
          }
        }
      } catch(e) {}
      // มี account + session หมดหรือเป็นของคนอื่น → auto-login
      setTimeout(() => doLoginWithLine(), 300);
    }
    // ถ้าไม่มี account → แสดงปุ่มให้กดสมัคร (รอ user action)
  } else if (!_liffInLine) {
    // เปิดจาก browser ปกติ และยังไม่ได้ login LINE → แสดงปุ่มให้กดเอง
    // (ไม่ force redirect เพราะจะกวน user ที่ใช้ username/password)
  }
}
