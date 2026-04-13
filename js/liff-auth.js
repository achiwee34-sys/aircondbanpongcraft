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

  // ตรวจ SDK — รอสูงสุด 6 วินาทีกรณี network ช้า
  if (typeof liff === 'undefined') {
    await new Promise((resolve) => {
      let waited = 0;
      const check = setInterval(() => {
        waited += 250;
        if (typeof liff !== 'undefined' || waited >= 6000) {
          clearInterval(check);
          resolve();
        }
      }, 250);
    });
  }
  if (typeof liff === 'undefined') {
    console.warn('[LIFF] liff SDK timeout — ตรวจสอบ network หรือ script tag ใน index.html');
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
      // อัพเดต Landing Page card ถ้ามี
      if (typeof window._liffLandingUpdateCard === 'function') {
        window._liffLandingUpdateCard(_liffProfile);
      }
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
//  _isLineUserAlreadyLoggedIn()
//  — ตรวจสอบว่า LINE User ID นี้กำลัง login อยู่ใน session อื่นหรือไม่
//  — ใช้ Firestore timestamp เพื่อตรวจ active session
// ══════════════════════════════════════════════════════════════
function _isLineUserAlreadyLoggedIn(lineUserId, existingUserId) {
  // ตรวจ localStorage session ปัจจุบัน
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // ถ้า session ยังไม่หมดอายุ และเป็น user เดิม → ถือว่า login อยู่แล้ว (ok ให้ผ่าน)
      if (s.uid === existingUserId && s.exp > Date.now()) {
        return false; // เป็น user คนเดิม → ไม่ซ้ำ
      }
    }
  } catch(e) {}

  // ตรวจ active session จาก db (Firestore) — ถ้ามี activeSessions field
  if (db.activeSessions) {
    const session = db.activeSessions[existingUserId];
    if (session && session.lineUserId === lineUserId && session.exp > Date.now()) {
      // มี session ที่ยังใช้งานอยู่จาก device อื่น
      const deviceInfo = session.device || 'อุปกรณ์อื่น';
      const loginTime  = session.loginAt ? new Date(session.loginAt).toLocaleTimeString('th-TH') : '';
      return { deviceInfo, loginTime };
    }
  }
  return false;
}

// ── บันทึก active session ลง db ──────────────────────────────
function _saveActiveSession(userId, lineUserId) {
  if (!db.activeSessions) db.activeSessions = {};
  db.activeSessions[userId] = {
    lineUserId,
    exp: Date.now() + 8 * 60 * 60 * 1000, // 8h
    loginAt: Date.now(),
    device: navigator.userAgent.includes('Mobile') ? '📱 มือถือ' : '💻 คอมพิวเตอร์'
  };
  // sync ไป Firestore เบื้องหลัง
  if (typeof fsSave === 'function') fsSave();
}

// ── ล้าง active session เมื่อ logout ─────────────────────────
function _clearActiveSession(userId) {
  if (db.activeSessions && db.activeSessions[userId]) {
    delete db.activeSessions[userId];
    if (typeof fsSave === 'function') fsSave();
  }
}

// ══════════════════════════════════════════════════════════════
//  _showDuplicateLoginWarning()
//  — แสดง popup เตือนเมื่อ LINE นี้ login อยู่ที่อื่นแล้ว
// ══════════════════════════════════════════════════════════════
function _showDuplicateLoginWarning(sessionInfo, onForceLogin) {
  // ลบ overlay เก่าถ้ามี
  document.querySelectorAll('.dup-login-overlay').forEach(el => el.remove());

  const ov = document.createElement('div');
  ov.className = 'dup-login-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)';

  const timeText = sessionInfo.loginTime ? ` (เข้าสู่ระบบ ${sessionInfo.loginTime})` : '';

  ov.innerHTML = `
    <div style="background:white;border-radius:20px;padding:24px 20px;max-width:320px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
      <div style="font-size:2.5rem;margin-bottom:12px">⚠️</div>
      <div style="font-size:1rem;font-weight:900;color:#1e293b;margin-bottom:8px">LINE นี้ถูกใช้งานอยู่แล้ว</div>
      <div style="font-size:0.82rem;color:#64748b;line-height:1.5;margin-bottom:6px">
        บัญชี LINE นี้กำลังเข้าสู่ระบบอยู่ที่<br>
        <b style="color:#0f172a">${sessionInfo.deviceInfo}</b>${timeText}
      </div>
      <div style="font-size:0.75rem;color:#ef4444;background:#fff0f0;border:1px solid #fecaca;border-radius:10px;padding:8px 12px;margin-bottom:20px;line-height:1.5">
        🔒 แต่ละบัญชีสามารถเข้าสู่ระบบได้<br>1 อุปกรณ์ในเวลาเดียวกัน
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="dup-force-btn" style="width:100%;padding:12px;border-radius:12px;border:none;background:#c8102e;color:white;font-size:0.88rem;font-weight:800;cursor:pointer;font-family:inherit">
          🔄 เข้าสู่ระบบที่นี่แทน
        </button>
        <div style="font-size:0.68rem;color:#94a3b8;margin-top:2px">(session บน${sessionInfo.deviceInfo}จะถูกยกเลิก)</div>
        <button class="dup-cancel-btn" style="width:100%;padding:11px;border-radius:12px;border:1.5px solid #e5e7eb;background:white;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;color:#374151">
          ยกเลิก
        </button>
      </div>
    </div>`;

  document.body.appendChild(ov);

  ov.querySelector('.dup-force-btn').addEventListener('click', () => {
    ov.remove();
    onForceLogin();
  });
  ov.querySelector('.dup-cancel-btn').addEventListener('click', () => {
    ov.remove();
  });
}

// ══════════════════════════════════════════════════════════════
//  doLoginWithLine()
//  — ค้นหา user จาก lineUserId → login เข้าระบบทันที
//  — ถ้ายังไม่มี user → เปิดหน้าสมัครพร้อม pre-fill ข้อมูล
//  — ถ้า login ซ้ำ (มี session อื่น active) → แสดง warning
// ══════════════════════════════════════════════════════════════
async function doLoginWithLine() {
  if (!_liffProfile) {
    showToast('❌ ไม่สามารถดึงข้อมูล LINE ได้');
    return;
  }

  const { userId: lineUserId, displayName, pictureUrl } = _liffProfile;

  // ── ตรวจ lineUserId ซ้ำใน db ─────────────────────────────
  // FIX: ป้องกัน user ซ้ำที่สมัครผ่าน race condition ก่อนหน้า
  const allMatches = (db.users || []).filter(u => u.lineUserId === lineUserId);
  if (allMatches.length > 1) {
    // มี user ซ้ำ → เลือก user ที่เก่าสุด (createdAt น้อยที่สุด) เป็น canonical
    const canonical = allMatches.slice().sort((a, b) =>
      (a.createdAt || '').localeCompare(b.createdAt || '')
    )[0];
    // ลบ duplicate ออกจาก local db
    const dupIds = allMatches.filter(u => u.id !== canonical.id).map(u => u.id);
    db.users = (db.users || []).filter(u => !dupIds.includes(u.id));
    // เพิ่ม dupIds เข้า deletedUserIds เพื่อป้องกัน sync กลับ
    db.deletedUserIds = [...new Set([...(db.deletedUserIds || []), ...dupIds])];
    // save เพื่อทำความสะอาด Firestore ด้วย
    if (typeof fsSave === 'function') fsSave(); // FIX v23-fix22: ผ่าน debounce
    console.warn('[LIFF] cleaned duplicate lineUserId:', lineUserId, '| removed:', dupIds, '| kept:', canonical.id);
    showToast('⚠️ พบข้อมูลซ้ำและทำความสะอาดแล้ว');
    // ดำเนินการต่อด้วย canonical user
    const dupSession = _isLineUserAlreadyLoggedIn(lineUserId, canonical.id);
    if (dupSession) {
      _showDuplicateLoginWarning(dupSession, () => _doLineLogin(canonical, lineUserId));
      return;
    }
    _doLineLogin(canonical, lineUserId);
    return;
  }

  // ── ค้นหา user ที่ผูก lineUserId ไว้แล้ว ──
  const existing = allMatches[0] || null;

  if (existing) {
    // ── ตรวจสอบ login ซ้ำ ────────────────────────────────────
    const dupSession = _isLineUserAlreadyLoggedIn(lineUserId, existing.id);

    if (dupSession) {
      // มี session อื่น active → แสดง warning
      _showDuplicateLoginWarning(dupSession, () => {
        // user กด "เข้าสู่ระบบที่นี่แทน" → force login
        _doLineLogin(existing, lineUserId);
      });
      return;
    }

    // ── Login ทันที ──────────────────────────────────────────
    _doLineLogin(existing, lineUserId);
  } else {
    // ── ตรวจซ้ำเผื่อกรณี lineUserId ซ้ำกันใน db ─────────────
    const dupByLineId = (db.users || []).filter(u => u.lineUserId === lineUserId);
    if (dupByLineId.length > 1) {
      showToast('⚠️ พบข้อมูลซ้ำในระบบ กรุณาติดต่อแอดมิน');
      console.warn('[LIFF] duplicate lineUserId found:', lineUserId, dupByLineId);
      return;
    }
    // ── ยังไม่มีบัญชี → เปิดหน้าสมัคร พร้อม pre-fill ──────
    showRegister();
    _prefillLineRegister(displayName, lineUserId, pictureUrl);
  }
}

// ── ฟังก์ชัน login หลัก (แยกออกมาเพื่อ reuse) ───────────────
function _doLineLogin(existing, lineUserId) {
  clearLoginErr();
  CU = existing;
  const sessionData = {
    uid: existing.id,
    uname: existing.username,
    exp: Date.now() + 8 * 60 * 60 * 1000,  // 8h
    lineAuth: true
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));

  // บันทึก active session เพื่อป้องกัน login ซ้ำ
  _saveActiveSession(existing.id, lineUserId);

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  initApp();
  loadMachinesData().then(() => {
    if (typeof refreshMachineList === 'function') refreshMachineList();
  });
  showToast('✅ เข้าสู่ระบบด้วย LINE สำเร็จ');
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

  // ── ตรวจซ้ำ lineUserId จาก Firestore โดยตรง (ป้องกัน local cache เก่า) ──
  // FIX: ป้องกัน race condition ที่ทำให้ user สมัครซ้ำได้เมื่อ local db ยังไม่ sync
  try {
    if (typeof FSdb !== 'undefined' && FSdb) {
      const snap = await FSdb.collection('appdata').doc('main').get();
      if (snap.exists) {
        const remoteUsers = snap.data().users || [];
        const remoteMatch = remoteUsers.find(u => u.lineUserId === lineUserId);
        if (remoteMatch) {
          // พบใน Firestore → merge เข้า local db ก่อน แล้ว redirect login
          const alreadyLocal = (db.users || []).find(u => u.id === remoteMatch.id);
          if (!alreadyLocal) {
            db.users = db.users || [];
            db.users.push(remoteMatch);
            try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch(e) {}
          }
          hideRegister();
          renderLinLoginButton();
          renderLoginDivider();
          showToast('✅ บัญชีนี้มีอยู่แล้ว กดปุ่ม LINE เพื่อเข้าสู่ระบบ');
          return;
        }
      }
    }
  } catch(fsCheckErr) {
    console.warn('[doRegisterWithLine] Firestore dup-check failed, fallback to local:', fsCheckErr.message);
  }

  // ── fallback: ตรวจ local db ด้วย (กันกด 2 ครั้งในระหว่าง Firestore check) ──
  const dupUser = (db.users || []).find(u => u.lineUserId === lineUserId);
  if (dupUser) {
    hideRegister();
    renderLinLoginButton();
    renderLoginDivider();
    showToast('✅ บัญชีนี้มีอยู่แล้ว กดปุ่ม LINE เพื่อเข้าสู่ระบบ');
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
      // ไม่ auto-login — ให้ผู้ใช้กดปุ่มเองที่หน้า login
      renderLinLoginButton();
      renderLoginDivider();
      showToast('✅ สมัครสำเร็จ! กดปุ่ม LINE เพื่อเข้าสู่ระบบ');
    });
  };

  if (typeof fsSaveNow === 'function' && typeof FSdb !== 'undefined' && FSdb) {
    fsSaveNow().then(doAfterSave).catch(doAfterSave);
  } else {
    if (typeof fsSave === 'function') fsSave();
    doAfterSave();
  }
}

// ── เปลี่ยน LINE Account (logout LIFF แล้ว login ใหม่) ────────
function switchLineAccount() {
  if (!_liffReady || typeof liff === 'undefined') return;
  // ล้าง active session
  if (typeof CU !== 'undefined' && CU && CU.id) {
    _clearActiveSession(CU.id);
  }
  _liffProfile = null;
  try {
    liff.logout();
  } catch(e) {}
  // login ใหม่ → LINE จะให้เลือก account
  liff.login({ redirectUri: location.href });
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
    // LIFF ยังไม่ ready → แสดงปุ่ม fallback แทนที่จะซ่อน
    _showFallbackLineButton();
    return;
  }

  container.style.display = 'block';

  // ถ้ามี profile แล้ว → แสดงชื่อ + ปุ่มเปลี่ยน account
  if (_liffProfile) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:center;gap:10px;background:#06C755;border-radius:14px;padding:12px 16px;cursor:pointer;box-shadow:0 4px 16px rgba(6,199,85,0.35)" onclick="doLoginWithLine()">
          <img src="${_liffProfile.pictureUrl}" style="width:36px;height:36px;border-radius:50%;border:2px solid rgba(255,255,255,0.5)" onerror="this.style.display='none'">
          <div style="flex:1">
            <div style="color:#fff;font-size:0.75rem;font-weight:600;opacity:0.8">เข้าสู่ระบบในฐานะ</div>
            <div style="color:#fff;font-size:0.9rem;font-weight:800">${_liffProfile.displayName}</div>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></svg>
        </div>
        <button onclick="switchLineAccount()" style="width:100%;background:none;border:1.5px solid #d1d5db;border-radius:10px;padding:8px 12px;font-size:0.78rem;color:#6b7280;font-weight:600;cursor:pointer;font-family:inherit">
          ไม่ใช่ฉัน? เปลี่ยน LINE Account
        </button>
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
//  initLiffUI() — โหลด LIFF แล้วแสดงปุ่มให้ผู้ใช้กดเอง
//  ไม่มี auto-login ทุกกรณี — ผู้ใช้ต้องกดปุ่มเข้าสู่ระบบเอง
// ══════════════════════════════════════════════════════════════
async function autoLiffLogin() {
  if (LIFF_ID === 'YOUR_LIFF_ID_HERE') {
    // ไม่มี LIFF_ID → ซ่อนปุ่ม LINE login ทิ้ง (ใช้ username เท่านั้น)
    return;
  }

  // ── ตรวจว่ามี session อยู่แล้วหรือเปล่า ──
  const isLoggedInApp = (function() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      return s.exp > Date.now();
    } catch(e) { return false; }
  })();

  // ถ้า login อยู่แล้ว (session restore เสร็จแล้ว) → ไม่ต้องทำอะไร
  if (isLoggedInApp) return;

  // แสดงปุ่ม LINE login ทันที (fallback ก่อน LIFF init เสร็จ)
  _showFallbackLineButton();

  const ok = await initLiff();

  if (!ok) {
    // LIFF init ล้มเหลว → ปุ่ม fallback ยังแสดงอยู่แล้ว
    return;
  }

  // ── Auto-login เฉพาะเมื่อ URL มี ?code= (LINE OAuth redirect จริงๆ) ──
  const isOAuthRedirect = location.search.includes('code=') && location.search.includes('liffClientId=');

  if (isOAuthRedirect && _liffProfile && !isLoggedInApp) {
    console.info('[LIFF] Auto-login after OAuth redirect:', _liffProfile.displayName);
    await doLoginWithLine();
    return;
  }

  // กรณีอื่น → render ปุ่มจริงจาก LIFF
  renderLinLoginButton();
  renderLoginDivider();
}

// ── ปุ่ม LINE fallback (แสดงก่อน LIFF init เสร็จ) ───────────
function _showFallbackLineButton() {
  const container = document.getElementById('line-login-btn-wrap');
  const divider   = document.getElementById('login-divider');
  if (!container) return;
  // ไม่ skip ถ้ามี HTML อยู่แล้ว — ปุ่ม fallback ต้องแสดงเสมอเมื่อถูกเรียก
  container.style.display = 'block';
  container.innerHTML = `
    <button onclick="loginWithLine()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;background:#06C755;color:#fff;border:none;border-radius:14px;padding:13px 16px;font-size:0.92rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 16px rgba(6,199,85,0.3)">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 5.92 2 10.72c0 3.16 1.88 5.94 4.72 7.56-.2.74-.72 2.68-.82 3.1-.12.52.19.52.4.38.17-.11 2.18-1.47 3.06-2.07.54.08 1.09.12 1.64.12 5.52 0 10-3.92 10-8.72S17.52 2 12 2z"/></svg>
      เข้าสู่ระบบด้วย LINE
    </button>`;
  if (divider) divider.style.display = 'flex';
}
