// ============================================================
// EXCEL IMPORT
// ============================================================
let xlData=[], xlHeaders=[];
const MAC_FIELDS=[
  {key:'name',     label:'ชื่อเครื่อง *'},
  {key:'serial',   label:'Air ID / Serial No.'},
  {key:'dept',     label:'แผนก / Zone'},
  {key:'location', label:'ตำแหน่ง'},
  {key:'funcLoc',  label:'Function Location'},
  {key:'equipment',label:'Equipment No.'},
  {key:'mfrCDU',   label:'ผู้ผลิต CDU'},
  {key:'modelCDU', label:'รุ่น CDU (Model)'},
  {key:'mfrFCU',   label:'ผู้ผลิต FCU'},
  {key:'modelFCU', label:'รุ่น FCU (Model)'},
  {key:'btu',      label:'BTU'},
  {key:'refrigerant',label:'สารทำความเย็น'},
  {key:'vendor',   label:'Vendor / บริษัท'},
  {key:'interval', label:'รอบบำรุง (เดือน)'},
  {key:'install',  label:'วันติดตั้ง'},
  {key:'brand',    label:'ยี่ห้อ/รุ่น (legacy)'},
];
function openImportSheet() { openSheet('import'); }
function readExcel(input) {
  const f = input.files[0]; if(!f)return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result,{type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
      if (!data||data.length<2){alert('ไฟล์ไม่มีข้อมูล');return;}
      xlHeaders = data[0].map(String);
      xlData = data.slice(1).filter(r=>r.some(c=>c!==''));
      document.getElementById('xl-map').style.display='block';
      document.getElementById('xl-import-btn').style.display='flex';
      document.getElementById('xl-count').textContent='พบ '+xlData.length+' แถว';
      renderColMap();
    } catch(err){ alert('อ่านไฟล์ไม่ได้: '+err.message); }
  };
  reader.readAsArrayBuffer(f);
}
function renderColMap() {
  const opts='<option value="">— ไม่ใช้ —</option>'+xlHeaders.map((h,i)=>`<option value="${i}">${h}</option>`).join('');
  document.getElementById('col-map-box').innerHTML = MAC_FIELDS.map(f=>`
    <div class="col-row">
      <label>${f.label}</label>
      <select id="cm-${f.key}">${opts}</select>
    </div>`).join('');
  // Auto-match
  const autoMap={name:['ชื่อ','name'],location:['ตำแหน่ง','location','สถานที่'],brand:['ยี่ห้อ','brand','รุ่น'],serial:['serial','ซีเรียล'],btu:['btu'],interval:['รอบ','interval','เดือน'],install:['ติดตั้ง','install','date']};
  MAC_FIELDS.forEach(f=>{
    const kwds=autoMap[f.key]||[f.key];
    const idx=xlHeaders.findIndex(h=>kwds.some(k=>h.toLowerCase().includes(k)));
    if(idx>=0)document.getElementById('cm-'+f.key).value=String(idx);
  });
}
function importMachines() {
  const nameIdx=document.getElementById('cm-name').value;
  if(nameIdx===''){alert('กรุณาระบุคอลัมน์ชื่อเครื่อง');return;}
  let added=0,skip=0;
  xlData.forEach(row=>{
    const name=String(row[parseInt(nameIdx)]||'').trim();
    if(!name){skip++;return;}
    const gv=key=>{const el=document.getElementById('cm-'+key);return el&&el.value!==''?String(row[parseInt(el.value)]||'').trim():'';}
    db.machines.push({id:'m'+Date.now()+Math.random().toString(36).slice(2,6),name,location:gv('location'),brand:gv('brand'),serial:gv('serial'),btu:gv('btu'),interval:parseInt(gv('interval'))||6,install:gv('install')});
    added++;
  });
  saveDB(); renderMachines(); populateMachineSelect();
  alert(`✅ Import ${added} เครื่อง${skip?` (ข้าม ${skip} แถว)`:''}`) ;
  closeSheet('import'); resetExcel();
}
function resetExcel(){xlData=[];xlHeaders=[];document.getElementById('xl-map').style.display='none';document.getElementById('xl-import-btn').style.display='none';document.getElementById('xl-file').value='';}

// ============================================================
// USERS
// ============================================================
let currentUserTab = 'tech';
function switchUserTab(tab) {
  currentUserTab = tab;
  ['tech','reporter','admin','executive'].forEach(t => {
    const btn = document.getElementById('utab-'+t);
    if(btn) btn.classList.toggle('active', t===tab);
  });
  renderUsersSummary();
  renderUsers();
}
function openUserSheetRole() {
  openUserSheet(null, currentUserTab);
}
function renderUsersSummary() {
  const el = document.getElementById('users-summary');
  if(!el) return;
  const techs    = db.users.filter(u=>u.role==='tech').length;
  const reporters= db.users.filter(u=>u.role==='reporter').length;
  const admins   = db.users.filter(u=>u.role==='admin').length;
  const execs    = db.users.filter(u=>u.role==='executive').length;
  const activeJobs = db.tickets.filter(t=>!['done','verified','closed'].includes(t.status)&&t.assigneeId).length;
  el.innerHTML = [
    {icon:'🔧', label:'ช่าง',    val:techs,    bg:'#f0fdf4', cl:'#166534', bd:'#86efac', tab:'tech'},
    {icon:'📢', label:'ผู้แจ้ง', val:reporters, bg:'#eff6ff', cl:'#1d4ed8', bd:'#bfdbfe', tab:'reporter'},
    {icon:'👑', label:'Admin',   val:admins,   bg:'#fdf4ff', cl:'#7c3aed', bd:'#e9d5ff', tab:'admin'},
    {icon:'📊', label:'บริหาร',  val:execs,    bg:'#ecfeff', cl:'#0e7490', bd:'#a5f3fc', tab:'executive'},
  ].map(s=>`
    <div onclick="switchUserTab('${s.tab}')" style="background:${currentUserTab===s.tab?s.bg:'white'};border:1.5px solid ${currentUserTab===s.tab?s.bd:'#e5e7eb'};border-radius:12px;padding:10px;text-align:center;cursor:pointer;transition:all 0.15s">
      <div style="font-size:1.4rem;font-weight:900;color:${s.cl}">${s.val}</div>
      <div style="font-size:0.62rem;font-weight:700;color:${currentUserTab===s.tab?s.cl:'var(--muted)'};margin-top:2px">${s.icon} ${s.label}</div>
    </div>`).join('');
}
function renderUsers() {
  const tabLabel = {tech:'🔧 ช่างซ่อม', reporter:'📢 ผู้แจ้งงาน', admin:'👑 แอดมิน', executive:'📊 ผู้บริหาร'};
  const tabColor = {
    tech:      {bg:'#f0fdf4', cl:'#166534', bd:'#86efac', dot:'#22c55e'},
    reporter:  {bg:'#eff6ff', cl:'#1d4ed8', bd:'#bfdbfe', dot:'#3b82f6'},
    admin:     {bg:'#fdf4ff', cl:'#7c3aed', bd:'#e9d5ff', dot:'#a855f7'},
    executive: {bg:'#ecfeff', cl:'#0e7490', bd:'#a5f3fc', dot:'#06b6d4'},
  };
  const list = db.users.filter(u => u.role === currentUserTab);
  const tc = tabColor[currentUserTab] || tabColor.reporter;

  const countEl = document.getElementById('users-count');
  if(countEl) countEl.textContent = tabLabel[currentUserTab] + ' ' + list.length + ' คน';

  const el = document.getElementById('users-list');
  if(!el) return;

  if(list.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--muted)">
      <div style="width:64px;height:64px;border-radius:50%;background:${tc.bg};border:2px solid ${tc.bd};display:flex;align-items:center;justify-content:center;font-size:1.8rem;margin:0 auto 12px">
        ${{tech:'🔧',reporter:'📢',admin:'👑',executive:'📊'}[currentUserTab]||'👤'}
      </div>
      <div style="font-size:0.9rem;font-weight:700;color:var(--text);margin-bottom:4px">ยังไม่มี${tabLabel[currentUserTab]}</div>
      <div style="font-size:0.75rem;margin-bottom:16px">กดปุ่มด้านล่างเพื่อเพิ่ม</div>
      <button class="btn btn-primary btn-sm" onclick="openUserSheetRole()">➕ เพิ่ม${tabLabel[currentUserTab]}</button>
    </div>`;
    return;
  }

  el.innerHTML = list.map(u => {
    const initials = getAvatarInitials(u.name);
    const avatarBg = getAvatarColor(u.id);
    const avatarHtml = u.avatar || u.photo
      ? `<img src="${u.avatar||u.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
      : `<span style="font-size:1rem;font-weight:900;color:white">${initials}</span>`;

    // Tech workload stats
    let statsHtml = '';
    if(u.role === 'tech') {
      const active   = db.tickets.filter(t=>t.assigneeId===u.id&&!['done','verified','closed'].includes(t.status));
      const doneMonth= db.tickets.filter(t=>t.assigneeId===u.id&&['done','verified','closed'].includes(t.status)&&(t.updatedAt||'').startsWith(new Date().toISOString().slice(0,7))).length;
      const urgent   = active.filter(t=>t.priority==='high').length;
      const waiting  = active.filter(t=>t.status==='waiting_part').length;
      const pct = Math.min(100, active.length * 14);
      const barColor = active.length>4?'#c8102e':active.length>2?'#f59e0b':'#22c55e';
      statsHtml = `
        <div style="border-top:1px solid #f1f5f9;padding:10px 14px;background:#fafafa">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
            <div style="font-size:0.68rem;font-weight:700;color:var(--muted);flex:1">ภาระงาน</div>
            <div style="font-size:0.7rem;font-weight:900;color:${barColor}">${active.length} งานค้าง</div>
            <div style="font-size:0.68rem;color:#22c55e;font-weight:700">✅ ${doneMonth} เดือนนี้</div>
          </div>
          <div style="background:#e5e7eb;border-radius:99px;height:5px;overflow:hidden;margin-bottom:7px">
            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:99px;transition:width 0.5s ease"></div>
          </div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
            ${urgent>0?`<span style="font-size:0.65rem;background:#fff0f2;color:#c8102e;border:1px solid #fecaca;border-radius:6px;padding:2px 7px;font-weight:700">🔴 ${urgent} ด่วน</span>`:''}
            ${waiting>0?`<span style="font-size:0.65rem;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:6px;padding:2px 7px;font-weight:700">⏳ ${waiting} รออะไหล่</span>`:''}
            ${active.length===0?`<span style="font-size:0.68rem;color:var(--muted)">✨ ไม่มีงานค้าง</span>`:''}
            ${CU.role==='admin'?`<button onclick="openAdminManageTechTickets('${u.id}')" style="margin-left:auto;font-size:0.65rem;padding:4px 10px;border-radius:7px;border:1.5px solid #c8102e;background:white;color:#c8102e;font-weight:800;cursor:pointer;font-family:inherit">⚙️ จัดการงาน</button>`:''}
          </div>
        </div>`;
    }

    return `<div style="background:white;border-radius:16px;margin-bottom:10px;border:1px solid #e5e7eb;box-shadow:0 1px 4px rgba(0,0,0,0.05);overflow:hidden;transition:box-shadow 0.15s" onmousedown="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'" onmouseup="this.style.boxShadow='0 1px 4px rgba(0,0,0,0.05)'">
      <div style="display:flex;align-items:center;gap:12px;padding:13px 14px">
        <!-- Avatar -->
        <div style="width:48px;height:48px;border-radius:50%;background:${avatarBg};display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.12)">
          ${avatarHtml}
        </div>
        <!-- Info -->
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
            <div style="font-size:0.92rem;font-weight:800;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.name}</div>
            <span style="background:${tc.bg};color:${tc.cl};border:1px solid ${tc.bd};border-radius:99px;padding:1px 7px;font-size:0.6rem;font-weight:800;flex-shrink:0">${{tech:'ช่าง',reporter:'ผู้แจ้ง',admin:'Admin'}[u.role]||u.role}</span>
          </div>
          <div style="font-size:0.72rem;color:var(--muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span>@${u.username}</span>
            ${u.dept?`<span>· ${u.dept}</span>`:''}
            ${u.tel?`<span>· 📞 ${u.tel}</span>`:''}
          </div>
        </div>
        <!-- Actions -->
        <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0">
          <button data-uid="${u.id}" data-act="edit" style="padding:6px 10px;background:#f1f5f9;border:none;border-radius:8px;font-size:0.72rem;font-weight:700;cursor:pointer;color:#374151;font-family:inherit">✏️</button>
          <button data-uid="${u.id}" data-act="del" style="padding:6px 10px;background:#fff0f2;border:none;border-radius:8px;font-size:0.72rem;font-weight:700;cursor:pointer;color:#c8102e;font-family:inherit">🗑️</button>
        </div>
      </div>
      ${statsHtml}
    </div>`;
  }).join('');

  // Event delegation
  el.querySelectorAll('[data-uid]').forEach(btn => {
    btn.onclick = function() {
      const uid = this.dataset.uid;
      if(this.dataset.act==='edit') openUserSheet(uid);
      else if(this.dataset.act==='del') delUser(uid);
    };
  });
}
function openUserSheet(id, defaultRole) {
  const u = id ? db.users.find(x=>x.id===id) : null;
  const roleLabel = {admin:'แอดมิน',tech:'ช่างซ่อม',reporter:'ผู้แจ้งงาน'};
  const role = u?.role || defaultRole || currentUserTab || 'reporter';
  document.getElementById('us-title').textContent = u
    ? '✏️ แก้ไขผู้ใช้'
    : '➕ เพิ่ม' + (roleLabel[role]||'ผู้ใช้');
  document.getElementById('u-id').value = u?.id||'';
  document.getElementById('u-name').value = u?.name||'';
  document.getElementById('u-photo').value = u?.photo||'';
  const prevEl = document.getElementById('u-avatar-preview');
  if (u?.photo) { prevEl.innerHTML = `<img src="${u.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`; }
  else { prevEl.innerHTML = '<span style="font-size:2rem">' + ({admin:'👑',tech:'🔧',reporter:'📢'}[u?.role||role]||'👤') + '</span>'; }
  document.getElementById('u-uname').value = u?.username||'';
  document.getElementById('u-pass').value = '';
  document.getElementById('u-pass').type = 'password';
  const passToggle = document.getElementById('u-pass-toggle');
  if (passToggle) passToggle.textContent = '👁 ดู';
  // Admin สามารถดูรหัสผ่านปัจจุบันได้
  const passCurrentBox = document.getElementById('u-pass-current');
  const passVal = document.getElementById('u-pass-val');
  if (passCurrentBox && passVal) {
    if (CU.role === 'admin' && u?.password) {
      // ── PATCH: ไม่แสดง password แม้แต่ admin (เพราะ hash แล้ว) ──
      passVal.textContent = u.password.startsWith('sha256:') ? '••••••••  (hashed)' : '(plain text — login ใหม่เพื่อ migrate)';
      passCurrentBox.style.display = 'flex';
    } else {
      passCurrentBox.style.display = 'none';
    }
  }
  document.getElementById('u-role').value = role;
  document.getElementById('u-dept').value = u?.dept||'';
  document.getElementById('u-tel').value = u?.tel||'';
  document.getElementById('u-contact').value = u?.contact||'';
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
    document.getElementById('u-avatar-preview').innerHTML =
      `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  };
  reader.readAsDataURL(input.files[0]);
}
async function saveUser() {  // PATCH: async เพื่อ await hashPassword
  const id=document.getElementById('u-id').value;
  const pass=document.getElementById('u-pass').value;
  const photo=document.getElementById('u-photo').value;
  const d={name:document.getElementById('u-name').value.trim(),username:document.getElementById('u-uname').value.trim(),role:document.getElementById('u-role').value,dept:document.getElementById('u-dept').value.trim(),tel:document.getElementById('u-tel').value.trim(),contact:document.getElementById('u-contact').value.trim(),photo};

  // clear old errors
  document.querySelectorAll('#user-sheet .field-error').forEach(e=>e.remove());
  let hasErr = false;
  if(!d.name)     { showFormError('u-name',  'กรุณากรอกชื่อ-นามสกุล'); hasErr=true; }
  if(!d.username) { showFormError('u-uname', 'กรุณากรอก Username'); hasErr=true; }
  if(!id && !pass){ showFormError('u-pass',  'กรุณาตั้งรหัสผ่าน'); hasErr=true; }
  if(hasErr) return;

  // ตรวจ username ซ้ำ
  const dupUser = db.users.find(u => u.username.toLowerCase()===d.username.toLowerCase() && u.id!==id);
  if(dupUser){ showFormError('u-uname','Username "'+d.username+'" มีผู้ใช้งานอยู่แล้ว'); return; }
  // ── PATCH: hash password ก่อน save (admin edit) ──
  try {
  if(id){
    const u=db.users.find(x=>x.id===id);
    Object.assign(u,d);
    if(pass) u.password = await hashPassword(pass);
  } else {
    const hashedPass = await hashPassword(pass);
    db.users.push({id:'u'+Date.now(),...d,password:hashedPass});
  }
  saveDB(); closeSheet('user'); switchUserTab(d.role==='tech'?'tech':d.role==='admin'?'admin':d.role==='executive'?'executive':'reporter');
  } catch(e) {
    console.error('[saveUser] error:', e);
    showToast('❌ บันทึกไม่สำเร็จ: ' + (e.message || 'กรุณาลองใหม่'));
  }
}
function delUser(id) {
  if (id === CU.id) { showToast('⚠️ ไม่สามารถลบบัญชีของตัวเองได้'); return; }
  const u = db.users.find(x => x.id === id);
  if (!u) return;
  // ใช้ custom confirm sheet แทน browser confirm
  showConfirmDelete(u, () => {
    db.users = db.users.filter(x => x.id !== id);
    // คืนสถานะงานที่ยังไม่เสร็จ
    const DONE_S = ['done','verified','closed'];
    db.tickets.forEach(t => {
      if (t.assigneeId === id && !DONE_S.includes(t.status)) {
        t.assigneeId = null; t.assignee = null; t.status = 'new'; t.updatedAt = nowStr();
      }
    });
    // ── ลบ Chat ของ user นี้ทั้งหมด ──
    if (db.chats) {
      Object.keys(db.chats).forEach(key => {
        db.chats[key] = (db.chats[key] || []).filter(m => m.uid !== id);
        if (db.chats[key].length === 0) delete db.chats[key];
      });
    }
    // ── ลบ Notification ของ user นี้ ──
    db.notifications = (db.notifications || []).filter(n => n.userId !== id);
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    fsSaveNow();
    switchUserTab(currentUserTab || 'tech');
    renderTickets();
    showToast('🗑️ ลบผู้ใช้ ' + u.name + ' + แชทและการแจ้งเตือนแล้ว');
  });
}

// ── Admin: จัดการงานแจ้งซ่อมของช่างแต่ละคน ──────────────────────────
function openAdminManageTechTickets(techId) {
  const tech = db.users.find(u => u.id === techId);
  if (!tech) return;
  document.querySelectorAll('#admin-manage-tk-ov').forEach(e => e.remove());
  const ov = document.createElement('div');
  ov.id = 'admin-manage-tk-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9500;display:flex;align-items:flex-end;backdrop-filter:blur(3px)';
  const techTickets = db.tickets.filter(t => t.assigneeId === techId && !['closed','verified'].includes(t.status));
  const allActive = db.tickets.filter(t => !['closed','verified'].includes(t.status));
  const availTickets = allActive.filter(t => !t.assigneeId || t.assigneeId !== techId);
  const renderRows = (list, isAssigned) => list.map(t =>
    `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #f1f5f9">
      <div style="flex:1;min-width:0">
        <div style="font-size:0.78rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.id} · ${t.problem}</div>
        <div style="font-size:0.65rem;color:#94a3b8;margin-top:2px">${t.machine||''}${t.assignee&&!isAssigned?' · ปัจจุบัน: '+t.assignee:''}</div>
      </div>
      ${isAssigned
        ? `<button onclick="adminUnassignTicket('${t.id}','${techId}')" style="font-size:0.68rem;padding:4px 10px;border-radius:8px;border:1.5px solid #dc2626;background:#fff5f5;color:#dc2626;font-weight:800;cursor:pointer;font-family:inherit;flex-shrink:0">🗑️ ถอด</button>`
        : `<button onclick="adminAssignTicket('${t.id}','${techId}')" style="font-size:0.68rem;padding:4px 10px;border-radius:8px;border:1.5px solid #16a34a;background:#f0fdf4;color:#16a34a;font-weight:800;cursor:pointer;font-family:inherit;flex-shrink:0">➕ มอบ</button>`
      }
    </div>`).join('') || `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:0.78rem">ไม่มีรายการ</div>`;
  ov.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;width:100%;max-height:88vh;overflow:hidden;display:flex;flex-direction:column">
      <div style="display:flex;justify-content:center;padding:10px 0 0"><div style="width:40px;height:4px;background:#e2e8f0;border-radius:99px"></div></div>
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
        <button onclick="document.getElementById('admin-manage-tk-ov').remove()" style="width:100%;padding:12px;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit">ปิด</button>
      </div>
    </div>`;
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}
function _refreshManageTk(techId) {
  const techTickets = db.tickets.filter(t => t.assigneeId===techId && !['closed','verified'].includes(t.status));
  const allActive = db.tickets.filter(t => !['closed','verified'].includes(t.status));
  const availTickets = allActive.filter(t => !t.assigneeId || t.assigneeId !== techId);
  const renderRows = (list, isAssigned) => list.map(t =>
    `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #f1f5f9">
      <div style="flex:1;min-width:0">
        <div style="font-size:0.78rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.id} · ${t.problem}</div>
        <div style="font-size:0.65rem;color:#94a3b8;margin-top:2px">${t.machine||''}${t.assignee&&!isAssigned?' · ปัจจุบัน: '+t.assignee:''}</div>
      </div>
      ${isAssigned
        ? `<button onclick="adminUnassignTicket('${t.id}','${techId}')" style="font-size:0.68rem;padding:4px 10px;border-radius:8px;border:1.5px solid #dc2626;background:#fff5f5;color:#dc2626;font-weight:800;cursor:pointer;font-family:inherit;flex-shrink:0">🗑️ ถอด</button>`
        : `<button onclick="adminAssignTicket('${t.id}','${techId}')" style="font-size:0.68rem;padding:4px 10px;border-radius:8px;border:1.5px solid #16a34a;background:#f0fdf4;color:#16a34a;font-weight:800;cursor:pointer;font-family:inherit;flex-shrink:0">➕ มอบ</button>`
      }
    </div>`).join('') || `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:0.78rem">ไม่มีรายการ</div>`;
  const a = document.getElementById('amtk-assigned-'+techId);
  const b = document.getElementById('amtk-avail-'+techId);
  if (a) a.innerHTML = renderRows(techTickets, true);
  if (b) b.innerHTML = renderRows(availTickets, false);
}
function adminAssignTicket(ticketId, techId) {
  const t = db.tickets.find(x => x.id===ticketId);
  const tech = db.users.find(u => u.id===techId);
  if (!t || !tech) return;
  const now = nowStr();
  t.assigneeId = techId; t.assignee = tech.name;
  if (t.status==='new') t.status = 'assigned';
  t.updatedAt = now;
  (t.history=t.history||[]).push({act:'📋 Admin มอบงานให้ '+tech.name, by:CU.name, at:now});
  notifyUser(techId,'📋 งานใหม่จาก Admin ['+ticketId+']', t.problem, ticketId);
  saveDB(); syncTicket(t); renderTickets(); renderUsers();
  _refreshManageTk(techId);
  showToast('✅ มอบงาน '+ticketId+' ให้ '+tech.name+' แล้ว');
}
function adminUnassignTicket(ticketId, techId) {
  const t = db.tickets.find(x => x.id===ticketId);
  if (!t) return;
  const techName = t.assignee||'';
  const now = nowStr();
  t.assigneeId = null; t.assignee = null; t.status = 'new'; t.updatedAt = now;
  (t.history=t.history||[]).push({act:'↩️ Admin ถอดงานจาก '+techName, by:CU.name, at:now});
  saveDB(); syncTicket(t); renderTickets(); renderUsers();
  _refreshManageTk(techId);
  showToast('↩️ ถอดงาน '+ticketId+' เรียบร้อย');
}

function showConfirmDelete(u, onConfirm) {
  // ลบ overlay เก่าก่อน (ป้องกัน duplicate)
  document.querySelectorAll('.cdel-overlay').forEach(el => el.remove());
  const overlay = document.createElement('div');
  overlay.className = 'cdel-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)';
  overlay.innerHTML = `
    <div style="background:white;border-radius:20px;padding:24px;max-width:320px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center">
      <div style="width:56px;height:56px;border-radius:50%;background:#fff0f0;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:1.6rem">🗑️</div>
      <div style="font-size:1rem;font-weight:800;color:var(--text);margin-bottom:8px">ลบผู้ใช้?</div>
      <div style="font-size:0.85rem;color:var(--muted);margin-bottom:6px"><b style="color:var(--text)">${u.name}</b><br>@${u.username}</div>
      <div style="font-size:0.75rem;color:#ef4444;margin-bottom:20px;background:#fff0f0;border-radius:10px;padding:8px">⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้</div>
      <div style="display:flex;gap:10px">
        <button id="cdel-cancel" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #e5e7eb;background:white;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit;color:var(--text)">ยกเลิก</button>
        <button id="cdel-confirm" style="flex:1;padding:12px;border-radius:12px;border:none;background:var(--accent);color:white;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit">ลบเลย</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cdel-cancel').onclick  = () => overlay.remove();
  overlay.querySelector('#cdel-confirm').onclick = () => {
    overlay.remove();
    setTimeout(() => onConfirm(), 50);  // รอ DOM ก่อนทำงาน
  };
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
}




// ============================================================
// MACHINE QR CODE GENERATOR
// ============================================================
let _mqrMachineId = '';

function showMachineQR(mid) {
  const m = db.machines.find(x => x.id === mid);
  if (!m) return;
  _mqrMachineId = mid;

  document.getElementById('mqr-title').textContent = '⬛ QR — ' + (m.serial || m.id);
  document.getElementById('mqr-info').innerHTML =
    `<b style="font-size:0.95rem;color:var(--text)">${m.name}</b><br>${m.serial||m.id} ${m.dept?'• '+m.dept:''}`;

  // วาด QR บน canvas ด้วย pure JS (ไม่ต้องใช้ library)
  drawQR(mid, document.getElementById('mqr-canvas'));
  openSheet('mqr');
}

function downloadMachineQR() {
  const m = db.machines.find(x => x.id === _mqrMachineId);
  if (!m) return;
  const canvas = document.getElementById('mqr-canvas');
  // เพิ่มชื่อเครื่องใต้ QR
  const out = document.createElement('canvas');
  out.width = 260; out.height = 300;
  const ctx = out.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, 260, 300);
  ctx.drawImage(canvas, 20, 16, 220, 220);
  ctx.fillStyle = '#1a1a2e';
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(m.name, 130, 256);
  ctx.font = '11px Arial';
  ctx.fillStyle = '#6b7280';
  ctx.fillText(m.serial || m.id, 130, 274);
  ctx.fillText('SCG.AIRCON', 130, 292);

  const a = document.createElement('a');
  a.download = 'QR_' + (m.serial || m.id).replace(/[^a-zA-Z0-9]/g,'_') + '.png';
  a.href = out.toDataURL('image/png');
  a.click();
  showToast('✅ บันทึก QR Code แล้ว');
}

// ── QR Code generator (pure JS — no library needed) ──────────────
function drawQR(text, canvas) {
  // ใช้ qrcode-generator pattern แบบ simple
  // encode เป็น URL-safe แล้วใช้ Google Charts API fallback
  const size = canvas.width;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, size, size);

  // ลอง BarcodeDetector encode ไม่ได้ — ใช้ img จาก Google Charts
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(text) + '&margin=0';
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
  };
  img.onerror = () => {
    // fallback: วาด pattern placeholder
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('QR: ' + text, size/2, size/2 - 8);
    ctx.font = '11px Arial';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('(ต้องการอินเทอร์เน็ต)', size/2, size/2 + 14);
  };
  img.src = qrUrl;
}

// ============================================================
// QR CODE SCANNER
// ============================================================
let _qrStream = null;
let _qrInterval = null;

function openQRScanner() {
  const modal = document.getElementById('qr-modal');
  modal.style.display = 'flex';
  const statusEl = document.getElementById('qr-status');
  statusEl.textContent = 'กำลังเริ่มกล้อง...';
  // reset preview
  const prev = document.getElementById('qr-preview-img');
  if (prev) prev.style.display = 'none';
  const video = document.getElementById('qr-video');
  video.style.display = '';

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusEl.textContent = '📷 ไม่มีกล้อง — กด "เลือกรูป" เพื่อสแกน QR';
    return;
  }
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
  })
  .then(stream => {
    _qrStream = stream;
    video.srcObject = stream;
    video.setAttribute('playsinline', true);
    video.play();
    statusEl.textContent = 'ชี้กล้องไปที่ QR Code';
    _qrInterval = setInterval(() => scanQRFrame(video, statusEl), 300);
  })
  .catch(err => {
    console.warn('QR camera error:', err);
    statusEl.textContent = '📷 ไม่ได้รับสิทธิ์กล้อง — กด "เลือกรูป" เพื่อสแกน QR';
  });
}

// เปิด file picker (กดปุ่ม "เลือกรูป")
function triggerQRFilePicker() {
  const fi = document.getElementById('qr-file-input');
  if (fi) { fi.value = ''; fi.click(); }
}

// decode รูปที่เลือก
function handleQRFileInput(input) {
  const file = input.files[0]; if (!file) return;
  const statusEl = document.getElementById('qr-status');
  statusEl.textContent = '🔍 กำลังอ่าน QR Code...';
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      // แสดง preview ใน viewfinder
      const prev = document.getElementById('qr-preview-img');
      if (prev) { prev.src = ev.target.result; prev.style.display = 'block'; }
      const video = document.getElementById('qr-video');
      if (video) video.style.display = 'none';
      // decode
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let found = false;
      // ลอง BarcodeDetector ก่อน
      if ('BarcodeDetector' in window) {
        new BarcodeDetector({ formats: ['qr_code'] }).detect(canvas)
          .then(codes => {
            if (codes.length > 0) { found = true; handleQRResult(codes[0].rawValue); }
            else _decodeWithJsQR(imageData, statusEl);
          }).catch(() => _decodeWithJsQR(imageData, statusEl));
      } else {
        _decodeWithJsQR(imageData, statusEl);
      }
    };
    img.onerror = () => { statusEl.textContent = '❌ ไม่สามารถโหลดรูปได้'; };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function _decodeWithJsQR(imageData, statusEl) {
  if (typeof jsQR !== 'function') { statusEl.textContent = '❌ ไม่สามารถอ่าน QR ได้'; return; }
  const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
  if (code) { handleQRResult(code.data); }
  else { statusEl.textContent = '❌ ไม่พบ QR Code ในรูป — ลองใหม่'; }
}

function scanQRFrame(video, statusEl) {
  if (!video.videoWidth || !video.videoHeight) return;
  const canvas = document.createElement('canvas');
  // crop ตรงกลาง 60% เพื่อความแม่นยำ
  const size = Math.min(video.videoWidth, video.videoHeight) * 0.8;
  const sx = (video.videoWidth - size) / 2;
  const sy = (video.videoHeight - size) / 2;
  canvas.width = size; canvas.height = size;
  canvas.getContext('2d').drawImage(video, sx, sy, size, size, 0, 0, size, size);

  // Priority 1: BarcodeDetector (Chrome 83+, Android, Edge)
  if ('BarcodeDetector' in window) {
    const bd = new BarcodeDetector({ formats: ['qr_code'] });
    bd.detect(canvas).then(codes => {
      if (codes.length > 0) handleQRResult(codes[0].rawValue);
    }).catch(() => _scanWithJsQR(canvas, statusEl));
    return;
  }
  // Priority 2: jsQR (ทุก browser รองรับ)
  _scanWithJsQR(canvas, statusEl);
}

function _scanWithJsQR(canvas, statusEl) {
  if (typeof jsQR !== 'function') {
    if (statusEl) statusEl.textContent = '⚠️ กำลังโหลด QR library...';
    return;
  }
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'dontInvert'
  });
  if (code) handleQRResult(code.data);
}

function handleQRResult(text) {
  closeQRScanner();
  // หาเครื่องจากรหัส — รองรับ format: machineId หรือ JSON {"id":"m1"}
  let machineId = text.trim();
  try { const parsed = JSON.parse(text); machineId = parsed.id || parsed.machineId || text; } catch(e) {}
  const m = db.machines.find(x => x.id === machineId || x.serial === machineId);
  if (m) {
    // เติมข้อมูลเครื่องอัตโนมัติ
    const deptSel = document.getElementById('nt-dept');
    if (deptSel) {
      // set dept
      [...deptSel.options].forEach(o => { if(o.value === m.dept) o.selected = true; });
      onDeptChange(m.dept);
      setTimeout(() => {
        const macSel = document.getElementById('nt-mac');
        if (macSel) {
          [...macSel.options].forEach(o => { if(o.value === m.id) o.selected = true; });
          onMachineChange(m.id);
        }
      }, 150);
    }
    showToast('✅ พบเครื่อง: ' + m.name);
  } else {
    showToast('❌ ไม่พบเครื่องรหัส: ' + machineId);
  }
}

function closeQRScanner() {
  clearInterval(_qrInterval); _qrInterval = null;
  if (_qrStream) { _qrStream.getTracks().forEach(t => t.stop()); _qrStream = null; }
  const video = document.getElementById('qr-video');
  if (video) { video.srcObject = null; video.style.display = ''; }
  const prev = document.getElementById('qr-preview-img');
  if (prev) { prev.style.display = 'none'; prev.src = ''; }
  const fi = document.getElementById('qr-file-input');
  if (fi) fi.value = '';
  document.getElementById('qr-modal').style.display = 'none';
}

// ══ setProblem ══
function setProblem(text) {
  document.getElementById('nt-prob').value = text;
  document.querySelectorAll('.prob-chip').forEach(c => c.classList.toggle('selected', c.textContent === text));
}

// ══ showToast helper ══
// ── Admin notification popup card (มุมขวาล่าง) ──────────────
function showAdminCard(title, msg, tid='', icon='🔔') {
  if (!CU || CU.role !== 'admin') return;
  // ลบอันเก่าถ้ามี
  document.querySelectorAll('.admin-notif-card').forEach(el => el.remove());
  const card = document.createElement('div');
  card.className = 'admin-notif-card';
  card.style.cssText = [
    'position:fixed',
    'bottom:calc(var(--nav-h) + var(--safe-bot) + 70px)',
    'right:16px',
    'z-index:8888',
    'background:#1e293b',
    'border-radius:12px',
    'box-shadow:0 4px 20px rgba(0,0,0,0.3)',
    'padding:12px 14px',
    'max-width:min(320px,calc(100vw - 32px))',
    'min-width:220px',
    'border-left:3px solid #c8102e',
    'display:flex',
    'align-items:flex-start',
    'gap:10px',
    'animation:slideInRight 0.25s ease',
    'cursor:pointer',
  ].join(';');
  card.innerHTML = `
    <div style="font-size:1.1rem;flex-shrink:0;margin-top:1px;line-height:1">${icon}</div>
    <div style="flex:1;overflow:hidden;min-width:0">
      <div style="font-size:0.82rem;font-weight:700;color:white;margin-bottom:2px;line-height:1.3">${title}</div>
      <div style="font-size:0.74rem;color:rgba(255,255,255,0.6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.4">${msg}</div>
      ${tid ? '<div style="font-size:0.62rem;color:#93c5fd;font-weight:600;margin-top:3px">แตะเพื่อดู →</div>' : ''}
    </div>
    <button onclick="event.stopPropagation();this.closest('.admin-notif-card').remove()" style="background:rgba(0,0,0,0.06);border:none;color:#64748b;cursor:pointer;font-size:0.8rem;padding:4px 6px;border-radius:6px;flex-shrink:0;font-weight:700">✕</button>
  `;
  if (tid) card.onclick = (e) => {
    if(e.target.tagName!=='BUTTON'){
      card.remove();
      const isChatNotif = title && title.startsWith('💬');
      const rawTid = tid.trim().replace(/^tk_/,'');
      if (isChatNotif) {
        const t = db.tickets?.find(x=>x.id===rawTid);
        if (t) {
          const partnerId = CU?.role==='tech' ? t.reporterId : (t.assigneeId || t.reporterId);
          if (partnerId) openChat(rawTid, partnerId);
        }
      } else {
        openDetail(rawTid);
      }
    }
  };
  document.body.appendChild(card);
  // หายไปใน 3 วินาที
  setTimeout(() => {
    card.style.animation = 'slideOutRight 0.3s ease forwards';
    setTimeout(() => card.remove(), 300);
  }, 3000);
}

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
// MONTHLY REPORT
// ============================================================
let rptYear = new Date().getFullYear();
