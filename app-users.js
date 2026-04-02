// ============================================================
// app-users.js  — User Management (rewritten clean v82)
// ============================================================
'use strict';

let currentUserTab = 'tech';

// ── Tab ──────────────────────────────────────────────────────
function switchUserTab(tab) {
  currentUserTab = tab;
  ['tech','reporter','admin','executive'].forEach(t => {
    const btn = document.getElementById('utab-'+t);
    if (btn) btn.classList.toggle('active', t === tab);
  });
  renderUsersSummary();
  renderUsers();
}

function openUserSheetRole() {
  openUserSheet(null, currentUserTab);
}

// ── Summary stat row ─────────────────────────────────────────
function renderUsersSummary() {
  const el = document.getElementById('users-summary');
  if (!el) return;
  const count = role => db.users.filter(u => u.role === role).length;
  const tabs = [
    { tab:'tech',      icon:'🔧', label:'ช่าง',    cl:'#166534', bg:'#f0fdf4', bd:'#86efac' },
    { tab:'reporter',  icon:'📢', label:'ผู้แจ้ง', cl:'#1d4ed8', bg:'#eff6ff', bd:'#bfdbfe' },
    { tab:'admin',     icon:'👑', label:'แอดมิน',  cl:'#7c3aed', bg:'#fdf4ff', bd:'#e9d5ff' },
    { tab:'executive', icon:'📊', label:'ผู้บริหาร',cl:'#0e7490', bg:'#ecfeff', bd:'#a5f3fc' },
  ];
  el.innerHTML = tabs.map(s => {
    const active = currentUserTab === s.tab;
    return `<div onclick="switchUserTab('${s.tab}')"
      style="background:${active ? s.bg : 'white'};border:1.5px solid ${active ? s.bd : '#e5e7eb'};
      border-radius:12px;padding:10px;text-align:center;cursor:pointer;transition:all 0.15s">
      <div style="font-size:1.3rem;font-weight:900;color:${s.cl}">${count(s.tab)}</div>
      <div style="font-size:0.6rem;font-weight:700;color:${active ? s.cl : 'var(--muted)'};margin-top:2px">${s.icon} ${s.label}</div>
    </div>`;
  }).join('');
}

// ── Render user list ─────────────────────────────────────────
function renderUsers() {
  const tabMeta = {
    tech:      { icon:'🔧', label:'ช่างซ่อม',   cl:'#166534', bg:'#f0fdf4', bd:'#86efac' },
    reporter:  { icon:'📢', label:'ผู้แจ้งงาน', cl:'#1d4ed8', bg:'#eff6ff', bd:'#bfdbfe' },
    admin:     { icon:'👑', label:'แอดมิน',     cl:'#7c3aed', bg:'#fdf4ff', bd:'#e9d5ff' },
    executive: { icon:'📊', label:'ผู้บริหาร',  cl:'#0e7490', bg:'#ecfeff', bd:'#a5f3fc' },
  };
  const list = db.users.filter(u => u.role === currentUserTab);
  const tm   = tabMeta[currentUserTab] || tabMeta.reporter;

  // update header count
  const countEl = document.getElementById('users-count');
  if (countEl) countEl.textContent = `${tm.icon} ${tm.label} · ${list.length} คน`;

  const el = document.getElementById('users-list');
  if (!el) return;

  if (list.length === 0) {
    el.innerHTML = `
      <div style="text-align:center;padding:48px 20px;color:var(--muted)">
        <div style="width:64px;height:64px;border-radius:50%;background:${tm.bg};border:2px solid ${tm.bd};
          display:flex;align-items:center;justify-content:center;font-size:1.8rem;margin:0 auto 12px">${tm.icon}</div>
        <div style="font-size:0.9rem;font-weight:700;color:var(--text);margin-bottom:4px">ยังไม่มี${tm.label}</div>
        <div style="font-size:0.75rem;margin-bottom:16px">กดปุ่ม + เพิ่ม ด้านบนเพื่อเพิ่ม</div>
      </div>`;
    return;
  }

  el.innerHTML = list.map(u => _renderUserCard(u, tm)).join('');
}

function _renderUserCard(u, tm) {
  const initials  = getAvatarInitials(u.name);
  const avatarBg  = getAvatarColor(u.id);
  const avatarHtml = (u.avatar || u.photo)
    ? `<img src="${u.avatar||u.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<span style="font-size:1rem;font-weight:900;color:white">${initials}</span>`;

  // workload bar (tech only)
  let workloadHtml = '';
  if (u.role === 'tech') {
    const active    = db.tickets.filter(t => t.assigneeId === u.id && !['done','verified','closed'].includes(t.status));
    const doneMonth = db.tickets.filter(t => t.assigneeId === u.id && ['done','verified','closed'].includes(t.status) &&
      (t.updatedAt || '').startsWith(new Date().toISOString().slice(0,7))).length;
    const urgent  = active.filter(t => t.priority === 'high').length;
    const waiting = active.filter(t => t.status === 'waiting_part').length;
    const pct      = Math.min(100, active.length * 14);
    const barColor = active.length > 4 ? '#c8102e' : active.length > 2 ? '#f59e0b' : '#22c55e';
    const manageBtn = (CU && CU.role === 'admin')
      ? `<button onclick="openAdminManageTechTickets('${u.id}')"
          style="margin-left:auto;font-size:0.65rem;padding:4px 10px;border-radius:7px;
          border:1.5px solid #c8102e;background:white;color:#c8102e;font-weight:800;cursor:pointer;font-family:inherit">
          ⚙️ จัดการงาน</button>` : '';
    workloadHtml = `
      <div style="border-top:1px solid #f1f5f9;padding:10px 14px;background:#fafafa">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:0.68rem;font-weight:700;color:var(--muted);flex:1">ภาระงาน</span>
          <span style="font-size:0.7rem;font-weight:900;color:${barColor}">${active.length} งานค้าง</span>
          <span style="font-size:0.68rem;color:#22c55e;font-weight:700">✅ ${doneMonth} เดือนนี้</span>
          ${manageBtn}
        </div>
        <div style="background:#e5e7eb;border-radius:99px;height:5px;overflow:hidden;margin-bottom:6px">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:99px;transition:width 0.5s ease"></div>
        </div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          ${urgent  > 0 ? `<span style="font-size:0.65rem;background:#fff0f2;color:#c8102e;border:1px solid #fecaca;border-radius:6px;padding:2px 7px;font-weight:700">🔴 ${urgent} ด่วน</span>` : ''}
          ${waiting > 0 ? `<span style="font-size:0.65rem;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:6px;padding:2px 7px;font-weight:700">⏳ ${waiting} รออะไหล่</span>` : ''}
          ${active.length === 0 ? `<span style="font-size:0.68rem;color:var(--muted)">✨ ไม่มีงานค้าง</span>` : ''}
        </div>
      </div>`;
  }

  const roleTag = { tech:'ช่าง', reporter:'ผู้แจ้ง', admin:'Admin', executive:'ผู้บริหาร' }[u.role] || u.role;

  return `
    <div style="background:white;border-radius:16px;margin-bottom:10px;border:1px solid #e5e7eb;
      box-shadow:0 1px 4px rgba(0,0,0,0.05);overflow:visible;position:relative">
      <div style="display:flex;align-items:center;gap:12px;padding:13px 14px">
        <!-- Avatar -->
        <div style="width:48px;height:48px;border-radius:50%;background:${avatarBg};
          display:flex;align-items:center;justify-content:center;flex-shrink:0;
          overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.12)">
          ${avatarHtml}
        </div>
        <!-- Info -->
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
            <div style="font-size:0.92rem;font-weight:800;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.name}</div>
            <span style="background:${tm.bg};color:${tm.cl};border:1px solid ${tm.bd};border-radius:99px;
              padding:1px 7px;font-size:0.6rem;font-weight:800;flex-shrink:0">${roleTag}</span>
          </div>
          <div style="font-size:0.72rem;color:var(--muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span>@${u.username}</span>
            ${u.dept ? `<span>· ${u.dept}</span>` : ''}
            ${u.tel  ? `<span>· 📞 ${u.tel}</span>`  : ''}
          </div>
        </div>
        <!-- Action buttons -->
        <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0">
          <button onclick="openUserSheet('${u.id}')"
            style="width:38px;height:38px;background:#f1f5f9;border:none;border-radius:10px;
            font-size:0.9rem;cursor:pointer;display:flex;align-items:center;justify-content:center;
            touch-action:manipulation;-webkit-tap-highlight-color:transparent">✏️</button>
          <button onclick="delUser('${u.id}')"
            style="width:38px;height:38px;background:#fff0f2;border:none;border-radius:10px;
            font-size:0.9rem;cursor:pointer;display:flex;align-items:center;justify-content:center;
            touch-action:manipulation;-webkit-tap-highlight-color:transparent">🗑️</button>
        </div>
      </div>
      ${workloadHtml}
    </div>`;
}

function initUsersEvents() { /* inline onclick — no delegation needed */ }

// ── Add / Edit user sheet ─────────────────────────────────────
function openUserSheet(id, defaultRole) {
  const u    = id ? db.users.find(x => x.id === id) : null;
  const role = u?.role || defaultRole || currentUserTab || 'reporter';
  const roleLabel = { admin:'แอดมิน', tech:'ช่างซ่อม', reporter:'ผู้แจ้งงาน', executive:'ผู้บริหาร' };

  document.getElementById('us-title').textContent = u
    ? '✏️ แก้ไขผู้ใช้'
    : `➕ เพิ่ม${roleLabel[role] || 'ผู้ใช้'}`;

  document.getElementById('u-id').value      = u?.id       || '';
  document.getElementById('u-name').value    = u?.name     || '';
  document.getElementById('u-photo').value   = u?.photo    || '';
  document.getElementById('u-uname').value   = u?.username || '';
  document.getElementById('u-pass').value    = '';
  document.getElementById('u-pass').type     = 'password';
  document.getElementById('u-role').value    = role;
  document.getElementById('u-dept').value    = u?.dept     || '';
  document.getElementById('u-tel').value     = u?.tel      || '';
  document.getElementById('u-contact').value = u?.contact  || '';

  // avatar preview
  const prevEl = document.getElementById('u-avatar-preview');
  if (prevEl) {
    prevEl.innerHTML = (u?.photo)
      ? `<img src="${u.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
      : `<span style="font-size:2rem">${{admin:'👑',tech:'🔧',reporter:'📢',executive:'📊'}[role]||'👤'}</span>`;
  }

  // pass toggle text
  const passToggle = document.getElementById('u-pass-toggle');
  if (passToggle) passToggle.textContent = '👁 ดู';

  // show hashed indicator for admin viewing existing user
  const passCurrentBox = document.getElementById('u-pass-current');
  const passVal        = document.getElementById('u-pass-val');
  if (passCurrentBox && passVal) {
    if (CU?.role === 'admin' && u?.password) {
      passVal.textContent = u.password.startsWith('sha256:') ? '••••••••  (hashed)' : '(plain text)';
      passCurrentBox.style.display = 'flex';
    } else {
      passCurrentBox.style.display = 'none';
    }
  }

  openSheet('user');
}

function triggerPhotoInput() {
  const inp = document.getElementById('u-photo-input');
  if (inp) { inp.value = ''; inp.click(); }
}

function previewUserPhoto(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('u-photo').value = e.target.result;
    const prevEl = document.getElementById('u-avatar-preview');
    if (prevEl) prevEl.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  };
  reader.readAsDataURL(input.files[0]);
}

async function saveUser() {
  const id   = document.getElementById('u-id').value;
  const pass = document.getElementById('u-pass').value;
  const photo= document.getElementById('u-photo').value;
  const d    = {
    name    : document.getElementById('u-name').value.trim(),
    username: document.getElementById('u-uname').value.trim(),
    role    : document.getElementById('u-role').value,
    dept    : document.getElementById('u-dept').value.trim(),
    tel     : document.getElementById('u-tel').value.trim(),
    contact : document.getElementById('u-contact').value.trim(),
    photo,
  };

  // clear old errors
  document.querySelectorAll('#user-sheet .field-error').forEach(e => e.remove());
  let hasErr = false;
  if (!d.name)     { showFormError('u-name',  'กรุณากรอกชื่อ-นามสกุล'); hasErr = true; }
  if (!d.username) { showFormError('u-uname', 'กรุณากรอก Username');     hasErr = true; }
  if (!id && !pass){ showFormError('u-pass',  'กรุณาตั้งรหัสผ่าน');     hasErr = true; }
  if (hasErr) return;

  const dupUser = db.users.find(u => u.username.toLowerCase() === d.username.toLowerCase() && u.id !== id);
  if (dupUser) { showFormError('u-uname', `Username "${d.username}" มีผู้ใช้งานอยู่แล้ว`); return; }

  try {
    if (id) {
      const u = db.users.find(x => x.id === id);
      Object.assign(u, d);
      if (pass) u.password = await hashPassword(pass);
    } else {
      db.users.push({ id: 'u' + Date.now(), ...d, password: await hashPassword(pass) });
    }
    if (window.bkAudit) window.bkAudit(id ? 'แก้ไข User' : 'เพิ่ม User', d.username || d.name, null, { name: d.name, role: d.role });
    db._seq = (db._seq || 1) + 1;
    saveDB();
    closeSheet('user');
    switchUserTab(d.role === 'tech' ? 'tech' : d.role === 'admin' ? 'admin' : d.role === 'executive' ? 'executive' : 'reporter');
  } catch (e) {
    console.error('[saveUser]', e);
    showToast('❌ บันทึกไม่สำเร็จ: ' + (e.message || 'กรุณาลองใหม่'));
  }
}

// ── Delete user ──────────────────────────────────────────────
function delUser(id) {
  if (id === CU.id) { showToast('⚠️ ไม่สามารถลบบัญชีของตัวเองได้'); return; }
  const u = db.users.find(x => x.id === id);
  if (!u) return;
  showConfirmDelete(u, () => {
    if (window.bkAudit) window.bkAudit('ลบ User', u.username || u.name, { name: u.name, role: u.role }, null);
    db.users = db.users.filter(x => x.id !== id);
    // คืนงานที่ยังไม่เสร็จ
    db.tickets.forEach(t => {
      if (t.assigneeId === id && !['done','verified','closed'].includes(t.status)) {
        t.assigneeId = null; t.assignee = null; t.status = 'new'; t.updatedAt = nowStr();
      }
    });
    // ลบ chat
    if (db.chats) {
      Object.keys(db.chats).forEach(key => {
        db.chats[key] = (db.chats[key] || []).filter(m => m.uid !== id);
        if (!db.chats[key].length) delete db.chats[key];
      });
    }
    // ลบ notification
    db.notifications = (db.notifications || []).filter(n => n.userId !== id);
    db._seq = (db._seq || 1) + 1;
    saveDB(); fsSaveNow();
    switchUserTab(currentUserTab || 'tech');
    renderTickets();
    showToast(`🗑️ ลบผู้ใช้ ${u.name} แล้ว`);
  });
}

function showConfirmDelete(u, onConfirm) {
  document.querySelectorAll('.cdel-overlay').forEach(el => el.remove());
  const overlay = document.createElement('div');
  overlay.className = 'cdel-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)';
  overlay.innerHTML = `
    <div style="background:white;border-radius:20px;padding:24px;max-width:320px;width:100%;
      box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center">
      <div style="width:56px;height:56px;border-radius:50%;background:#fff0f0;display:flex;
        align-items:center;justify-content:center;margin:0 auto 14px;font-size:1.6rem">🗑️</div>
      <div style="font-size:1rem;font-weight:800;color:var(--text);margin-bottom:8px">ลบผู้ใช้?</div>
      <div style="font-size:0.85rem;color:var(--muted);margin-bottom:6px">
        <b style="color:var(--text)">${u.name}</b><br>@${u.username}
      </div>
      <div style="font-size:0.75rem;color:#ef4444;margin-bottom:20px;
        background:#fff0f0;border-radius:10px;padding:8px">⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้</div>
      <div style="display:flex;gap:10px">
        <button id="cdel-cancel"
          style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #e5e7eb;background:white;
          font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit;color:var(--text)">ยกเลิก</button>
        <button id="cdel-confirm"
          style="flex:1;padding:12px;border-radius:12px;border:none;background:var(--accent);
          color:white;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit">ลบเลย</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cdel-cancel').onclick  = () => overlay.remove();
  overlay.querySelector('#cdel-confirm').onclick = () => { overlay.remove(); setTimeout(onConfirm, 50); };
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
}

// ── Admin manage tech tickets ────────────────────────────────
function openAdminManageTechTickets(techId) {
  const tech = db.users.find(u => u.id === techId);
  if (!tech) return;
  document.querySelectorAll('#admin-manage-tk-ov').forEach(e => e.remove());
  const ov = document.createElement('div');
  ov.id = 'admin-manage-tk-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9500;display:flex;align-items:flex-end;backdrop-filter:blur(3px)';
  const techTickets  = db.tickets.filter(t => t.assigneeId === techId && !['closed','verified'].includes(t.status));
  const allActive    = db.tickets.filter(t => !['closed','verified'].includes(t.status));
  const availTickets = allActive.filter(t => !t.assigneeId || t.assigneeId !== techId);
  const renderRows   = (list, isAssigned) => list.map(t =>
    `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #f1f5f9">
      <div style="flex:1;min-width:0">
        <div style="font-size:0.78rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.id} · ${t.problem}</div>
        <div style="font-size:0.65rem;color:#94a3b8;margin-top:2px">${t.machine||''}${t.assignee&&!isAssigned?' · ปัจจุบัน: '+t.assignee:''}</div>
      </div>
      ${isAssigned
        ? `<button onclick="adminUnassignTicket('${t.id}','${techId}')" style="font-size:0.68rem;padding:4px 10px;border-radius:8px;border:1.5px solid #dc2626;background:#fff5f5;color:#dc2626;font-weight:800;cursor:pointer;font-family:inherit;flex-shrink:0">🗑️ ถอด</button>`
        : `<button onclick="adminAssignTicket('${t.id}','${techId}')" style="font-size:0.68rem;padding:4px 10px;border-radius:8px;border:1.5px solid #16a34a;background:#f0fdf4;color:#16a34a;font-weight:800;cursor:pointer;font-family:inherit;flex-shrink:0">➕ มอบ</button>`}
    </div>`).join('') || `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:0.78rem">ไม่มีรายการ</div>`;
  ov.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;width:100%;max-height:88vh;overflow:hidden;display:flex;flex-direction:column">
      <div style="display:flex;justify-content:center;padding:10px 0 0">
        <div style="width:40px;height:4px;background:#e2e8f0;border-radius:99px"></div></div>
      <div style="padding:14px 16px 12px;border-bottom:1px solid #f1f5f9;flex-shrink:0">
        <div style="font-size:1rem;font-weight:900;color:#0f172a">⚙️ จัดการงาน — ${tech.name}</div>
        <div style="font-size:0.72rem;color:#94a3b8;margin-top:2px">เพิ่มหรือถอดงานแจ้งซ่อมของช่างคนนี้</div>
      </div>
      <div style="overflow-y:auto;flex:1">
        <div style="padding:10px 16px 4px;font-size:0.7rem;font-weight:800;color:#c8102e;letter-spacing:0.06em">งานที่มอบหมายอยู่ (${techTickets.length})</div>
        <div id="amtk-assigned-${techId}">${renderRows(techTickets,true)}</div>
        <div style="padding:10px 16px 4px;font-size:0.7rem;font-weight:800;color:#0369a1;letter-spacing:0.06em;border-top:2px solid #f1f5f9;margin-top:6px">งานอื่นที่พร้อมมอบ (${availTickets.length})</div>
        <div id="amtk-avail-${techId}">${renderRows(availTickets,false)}</div>
      </div>
      <div style="padding:12px 16px;background:white;border-top:1px solid #f1f5f9;flex-shrink:0">
        <button onclick="document.getElementById('admin-manage-tk-ov').remove()"
          style="width:100%;padding:12px;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;
          font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit">ปิด</button>
      </div>
    </div>`;
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}

function _refreshManageTk(techId) {
  const techTickets  = db.tickets.filter(t => t.assigneeId === techId && !['closed','verified'].includes(t.status));
  const allActive    = db.tickets.filter(t => !['closed','verified'].includes(t.status));
  const availTickets = allActive.filter(t => !t.assigneeId || t.assigneeId !== techId);
  const renderRows   = (list, isAssigned) => list.map(t =>
    `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #f1f5f9">
      <div style="flex:1;min-width:0">
        <div style="font-size:0.78rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.id} · ${t.problem}</div>
      </div>
      ${isAssigned
        ? `<button onclick="adminUnassignTicket('${t.id}','${techId}')" style="font-size:0.68rem;padding:4px 10px;border-radius:8px;border:1.5px solid #dc2626;background:#fff5f5;color:#dc2626;font-weight:800;cursor:pointer;font-family:inherit;flex-shrink:0">🗑️ ถอด</button>`
        : `<button onclick="adminAssignTicket('${t.id}','${techId}')" style="font-size:0.68rem;padding:4px 10px;border-radius:8px;border:1.5px solid #16a34a;background:#f0fdf4;color:#16a34a;font-weight:800;cursor:pointer;font-family:inherit;flex-shrink:0">➕ มอบ</button>`}
    </div>`).join('') || `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:0.78rem">ไม่มีรายการ</div>`;
  const a = document.getElementById('amtk-assigned-' + techId);
  const b = document.getElementById('amtk-avail-'    + techId);
  if (a) a.innerHTML = renderRows(techTickets, true);
  if (b) b.innerHTML = renderRows(availTickets, false);
}

function adminAssignTicket(ticketId, techId) {
  const t = db.tickets.find(x => x.id === ticketId);
  const tech = db.users.find(u => u.id === techId);
  if (!t || !tech) return;
  const now = nowStr();
  t.assigneeId = techId; t.assignee = tech.name;
  if (t.status === 'new') t.status = 'assigned';
  t.updatedAt = now;
  (t.history = t.history || []).push({ act: '📋 Admin มอบงานให้ ' + tech.name, by: CU.name, at: now });
  notifyUser(techId, '📋 งานใหม่จาก Admin [' + ticketId + ']', t.problem, ticketId);
  saveDB(); syncTicket(t); renderTickets(); renderUsers();
  _refreshManageTk(techId);
  showToast('✅ มอบงาน ' + ticketId + ' ให้ ' + tech.name + ' แล้ว');
}

function adminUnassignTicket(ticketId, techId) {
  const t = db.tickets.find(x => x.id === ticketId);
  if (!t) return;
  const techName = t.assignee || '';
  const now = nowStr();
  t.assigneeId = null; t.assignee = null; t.status = 'new'; t.updatedAt = now;
  (t.history = t.history || []).push({ act: '↩️ Admin ถอดงานจาก ' + techName, by: CU.name, at: now });
  saveDB(); syncTicket(t); renderTickets(); renderUsers();
  _refreshManageTk(techId);
  showToast('↩️ ถอดงาน ' + ticketId + ' เรียบร้อย');
}

// ── openTechPopup ────────────────────────────────────────────
function openTechPopup(techId) {
  const tech = db.users.find(u => u.id === techId);
  if (!tech) return;
  openAdminManageTechTickets(techId);
}

// ── Admin notification card ──────────────────────────────────
function showAdminCard(title, msg, tid = '', icon = '🔔') {
  if (!CU || CU.role !== 'admin') return;
  document.querySelectorAll('.admin-notif-card').forEach(el => el.remove());
  const card = document.createElement('div');
  card.className = 'admin-notif-card';
  card.style.cssText = [
    'position:fixed','bottom:calc(var(--nav-h) + var(--safe-bot) + 70px)','right:16px','z-index:8888',
    'background:#1e293b','border-radius:12px','box-shadow:0 4px 20px rgba(0,0,0,0.3)',
    'padding:12px 14px','max-width:min(320px,calc(100vw - 32px))','min-width:220px',
    'border-left:3px solid #c8102e','display:flex','align-items:flex-start','gap:10px',
    'animation:slideInRight 0.25s ease','cursor:pointer',
  ].join(';');
  card.innerHTML = `
    <div style="font-size:1.1rem;flex-shrink:0;margin-top:1px">${icon}</div>
    <div style="flex:1;overflow:hidden;min-width:0">
      <div style="font-size:0.82rem;font-weight:700;color:white;margin-bottom:2px">${title}</div>
      <div style="font-size:0.74rem;color:rgba(255,255,255,0.6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${msg}</div>
      ${tid ? '<div style="font-size:0.62rem;color:#93c5fd;font-weight:600;margin-top:3px">แตะเพื่อดู →</div>' : ''}
    </div>
    <button onclick="event.stopPropagation();this.closest('.admin-notif-card').remove()"
      style="background:rgba(0,0,0,0.06);border:none;color:#64748b;cursor:pointer;font-size:0.8rem;
      padding:4px 6px;border-radius:6px;flex-shrink:0;font-weight:700">✕</button>`;
  if (tid) card.onclick = e => {
    if (e.target.tagName !== 'BUTTON') {
      card.remove();
      const rawTid = tid.trim().replace(/^tk_/, '');
      if (title && title.startsWith('💬')) {
        const t = db.tickets?.find(x => x.id === rawTid);
        if (t) { const pid = CU?.role === 'tech' ? t.reporterId : (t.assigneeId || t.reporterId); if (pid) openChat(rawTid, pid); }
      } else { safeOpenDetail(rawTid); }
    }
  };
  document.body.appendChild(card);
  setTimeout(() => { card.style.animation = 'slideOutRight 0.3s ease forwards'; setTimeout(() => card.remove(), 300); }, 3000);
}

// ============================================================
// MACHINE QR CODE (kept in this file)
// ============================================================
let _mqrMachineId = '';

function showMachineQR(mid) {
  const m = db.machines.find(x => x.id === mid); if (!m) return;
  _mqrMachineId = mid;
  document.getElementById('mqr-title').textContent = '⬛ QR — ' + (m.serial || m.id);
  document.getElementById('mqr-info').innerHTML =
    `<b style="font-size:0.95rem;color:var(--text)">${m.name}</b><br>${m.serial||m.id} ${m.dept?'• '+m.dept:''}`;
  drawQR(mid, document.getElementById('mqr-canvas'));
  openSheet('mqr');
}

function downloadMachineQR() {
  const m = db.machines.find(x => x.id === _mqrMachineId); if (!m) return;
  const canvas = document.getElementById('mqr-canvas');
  const out = document.createElement('canvas'); out.width = 260; out.height = 300;
  const ctx = out.getContext('2d');
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 260, 300);
  ctx.drawImage(canvas, 20, 16, 220, 220);
  ctx.fillStyle = '#1a1a2e'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
  ctx.fillText(m.name, 130, 256);
  ctx.font = '11px Arial'; ctx.fillStyle = '#6b7280';
  ctx.fillText(m.serial || m.id, 130, 274);
  ctx.fillText('SCG.AIRCON', 130, 292);
  const a = document.createElement('a');
  a.download = 'QR_' + (m.serial || m.id).replace(/[^a-zA-Z0-9]/g, '_') + '.png';
  a.href = out.toDataURL('image/png'); a.click();
  showToast('✅ บันทึก QR Code แล้ว');
}

function drawQR(text, canvas) {
  const size = canvas.width; const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, size, size);
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(text) + '&margin=0';
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => { ctx.fillStyle='white'; ctx.fillRect(0,0,size,size); ctx.drawImage(img,0,0,size,size); };
  img.onerror = () => {
    ctx.fillStyle='#f3f4f6'; ctx.fillRect(0,0,size,size);
    ctx.fillStyle='#374151'; ctx.font='bold 13px Arial'; ctx.textAlign='center';
    ctx.fillText('QR: '+text, size/2, size/2-8);
    ctx.font='11px Arial'; ctx.fillStyle='#6b7280';
    ctx.fillText('(ต้องการอินเทอร์เน็ต)', size/2, size/2+14);
  };
  img.src = qrUrl;
}

// ============================================================
// QR CODE SCANNER
// ============================================================
let _qrStream = null; let _qrInterval = null;

function openQRScanner() {
  const modal = document.getElementById('qr-modal'); modal.style.display = 'flex';
  const statusEl = document.getElementById('qr-status'); statusEl.textContent = 'กำลังเริ่มกล้อง...';
  const prev = document.getElementById('qr-preview-img'); if (prev) prev.style.display = 'none';
  const video = document.getElementById('qr-video'); video.style.display = '';
  if (!navigator.mediaDevices?.getUserMedia) { statusEl.textContent = '📷 ไม่มีกล้อง — กด "เลือกรูป" เพื่อสแกน QR'; return; }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })
    .then(stream => {
      _qrStream = stream; video.srcObject = stream; video.setAttribute('playsinline', true); video.play();
      statusEl.textContent = 'ชี้กล้องไปที่ QR Code';
      _qrInterval = setInterval(() => scanQRFrame(video, statusEl), 300);
    })
    .catch(() => { statusEl.textContent = '📷 ไม่ได้รับสิทธิ์กล้อง — กด "เลือกรูป" เพื่อสแกน QR'; });
}
function triggerQRFilePicker() { const fi = document.getElementById('qr-file-input'); if (fi) { fi.value = ''; fi.click(); } }
function handleQRFileInput(input) {
  const file = input.files[0]; if (!file) return;
  const statusEl = document.getElementById('qr-status'); statusEl.textContent = '🔍 กำลังอ่าน QR Code...';
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const prev = document.getElementById('qr-preview-img');
      if (prev) { prev.src = ev.target.result; prev.style.display = 'block'; }
      const video = document.getElementById('qr-video'); if (video) video.style.display = 'none';
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      if ('BarcodeDetector' in window) {
        new BarcodeDetector({ formats: ['qr_code'] }).detect(canvas)
          .then(codes => { if (codes.length > 0) handleQRResult(codes[0].rawValue); else _decodeWithJsQR(imageData, statusEl); })
          .catch(() => _decodeWithJsQR(imageData, statusEl));
      } else { _decodeWithJsQR(imageData, statusEl); }
    };
    img.onerror = () => { statusEl.textContent = '❌ ไม่สามารถโหลดรูปได้'; };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}
function _decodeWithJsQR(imageData, statusEl) {
  if (typeof jsQR !== 'function') { statusEl.textContent = '❌ ไม่สามารถอ่าน QR ได้'; return; }
  const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
  if (code) handleQRResult(code.data); else statusEl.textContent = '❌ ไม่พบ QR Code ในรูป — ลองใหม่';
}
function scanQRFrame(video, statusEl) {
  if (!video.videoWidth || !video.videoHeight) return;
  const size = Math.min(video.videoWidth, video.videoHeight) * 0.8;
  const sx = (video.videoWidth - size) / 2; const sy = (video.videoHeight - size) / 2;
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  canvas.getContext('2d').drawImage(video, sx, sy, size, size, 0, 0, size, size);
  if ('BarcodeDetector' in window) {
    new BarcodeDetector({ formats: ['qr_code'] }).detect(canvas).then(codes => { if (codes.length > 0) handleQRResult(codes[0].rawValue); }).catch(() => _scanWithJsQR(canvas, statusEl));
    return;
  }
  _scanWithJsQR(canvas, statusEl);
}
function _scanWithJsQR(canvas, statusEl) {
  if (typeof jsQR !== 'function') { if (statusEl) statusEl.textContent = '⚠️ กำลังโหลด QR library...'; return; }
  const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
  if (code) handleQRResult(code.data);
}
function handleQRResult(text) {
  closeQRScanner();
  let machineId = text.trim();
  try { const p = JSON.parse(text); machineId = p.id || p.machineId || text; } catch(e) {}
  const m = db.machines.find(x => x.id === machineId || x.serial === machineId);
  if (m) {
    const deptSel = document.getElementById('nt-dept');
    if (deptSel) {
      [...deptSel.options].forEach(o => { if (o.value === m.dept) o.selected = true; });
      onDeptChange(m.dept);
      setTimeout(() => {
        const macSel = document.getElementById('nt-mac');
        if (macSel) { [...macSel.options].forEach(o => { if (o.value === m.id) o.selected = true; }); onMachineChange(m.id); }
      }, 150);
    }
    showToast('✅ พบเครื่อง: ' + m.name);
  } else { showToast('❌ ไม่พบเครื่องรหัส: ' + machineId); }
}
function closeQRScanner() {
  clearInterval(_qrInterval); _qrInterval = null;
  if (_qrStream) { _qrStream.getTracks().forEach(t => t.stop()); _qrStream = null; }
  const video = document.getElementById('qr-video'); if (video) { video.srcObject = null; video.style.display = ''; }
  const prev  = document.getElementById('qr-preview-img'); if (prev) { prev.style.display = 'none'; prev.src = ''; }
  const fi    = document.getElementById('qr-file-input'); if (fi) fi.value = '';
  document.getElementById('qr-modal').style.display = 'none';
}

// ── misc helpers kept in this file ──────────────────────────
function setProblem(text) {
  document.getElementById('nt-prob').value = text;
  document.querySelectorAll('.prob-chip').forEach(c => c.classList.toggle('selected', c.textContent === text));
}

// ============================================================
// Excel import (machines)
// ============================================================
function openImportSheet() { openSheet('import'); }
function readExcel(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    xlData = XLSX.utils.sheet_to_json(ws, { defval: '' });
    xlHeaders = xlData.length > 0 ? Object.keys(xlData[0]) : [];
    document.getElementById('xl-map').style.display = 'block';
    document.getElementById('xl-import-btn').style.display = '';
    renderColMap();
  };
  reader.readAsArrayBuffer(file);
}
function renderColMap() {
  const el = document.getElementById('xl-col-map'); if (!el) return;
  const fields = [
    { key:'name',   label:'ชื่อเครื่อง *' },
    { key:'serial', label:'Serial' },
    { key:'dept',   label:'แผนก' },
    { key:'room',   label:'ห้อง' },
    { key:'brand',  label:'ยี่ห้อ' },
    { key:'btu',    label:'BTU' },
    { key:'type',   label:'ประเภท' },
    { key:'note',   label:'หมายเหตุ' },
  ];
  el.innerHTML = fields.map(f =>
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <label style="width:90px;font-size:0.75rem;font-weight:700;color:var(--text)">${f.label}</label>
      <select id="xlmap-${f.key}" style="flex:1;padding:6px 8px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.75rem;font-family:inherit">
        <option value="">(ไม่นำเข้า)</option>
        ${xlHeaders.map(h => `<option value="${h}" ${h.toLowerCase().includes(f.key)?'selected':''}>${h}</option>`).join('')}
      </select>
    </div>`).join('');
}
function importMachines() {
  if (!xlData.length) return;
  const getCol = key => { const el = document.getElementById('xlmap-'+key); return el ? el.value : ''; };
  let added = 0;
  xlData.forEach(row => {
    const name = row[getCol('name')]; if (!name) return;
    const serial = row[getCol('serial')] || '';
    if (serial && db.machines.find(m => m.serial === serial)) return;
    db.machines.push({
      id: 'M' + Date.now() + Math.random().toString(36).slice(2,5),
      name: String(name).trim(),
      serial: String(serial).trim(),
      dept: String(row[getCol('dept')]||'').trim(),
      room: String(row[getCol('room')]||'').trim(),
      brand: String(row[getCol('brand')]||'').trim(),
      btu: String(row[getCol('btu')]||'').trim(),
      type: String(row[getCol('type')]||'').trim(),
      note: String(row[getCol('note')]||'').trim(),
      status: 'normal', createdAt: nowStr(),
    });
    added++;
  });
  if (added > 0) { saveDB(); if (typeof renderMachines === 'function') renderMachines(); }
  closeSheet('import'); resetExcel();
  showToast(added > 0 ? `✅ นำเข้า ${added} เครื่องแล้ว` : '⚠️ ไม่มีข้อมูลใหม่ที่นำเข้าได้');
}
function resetExcel() {
  xlData = []; xlHeaders = [];
  document.getElementById('xl-map').style.display = 'none';
  document.getElementById('xl-import-btn').style.display = 'none';
  document.getElementById('xl-file').value = '';
}
