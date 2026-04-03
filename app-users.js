// app-users.js  v84-clean — จัดการผู้ใช้งาน
var currentUserTab = 'tech';

function switchUserTab(tab) {
  currentUserTab = tab;
  ['tech','reporter','admin','executive'].forEach(function(t) {
    var btn = document.getElementById('utab-' + t);
    if (btn) btn.classList.toggle('active', t === tab);
  });
  renderUsersSummary();
  renderUsers();
}
function debugUserBtn() {
  var log = [];
  // 1. ตรวจ DOM elements
  var ids = ['us-title','u-id','u-name','u-photo','u-uname','u-pass','u-role',
             'u-dept','u-tel','u-contact','u-avatar-preview','u-pass-toggle',
             'u-pass-current','u-pass-val','user-overlay','user-sheet'];
  var missing = ids.filter(function(id){ return !document.getElementById(id); });
  log.push('Missing IDs: ' + (missing.length ? missing.join(', ') : 'none ✅'));

  // 2. ตรวจ overlay ค้าง
  var stuckOv = [];
  document.querySelectorAll('.cdel-overlay').forEach(function(el){ stuckOv.push('cdel-overlay'); });
  var manOv = document.getElementById('admin-manage-tk-ov');
  if (manOv) stuckOv.push('admin-manage-tk-ov');
  log.push('Stuck overlays: ' + (stuckOv.length ? stuckOv.join(', ') : 'none ✅'));

  // 3. ตรวจ element ที่ทับ center จอ
  var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  var topEl = document.elementFromPoint(cx, cy);
  log.push('Element at center: ' + (topEl ? topEl.tagName + '#' + topEl.id + '.' + topEl.className.split(' ')[0] : 'none'));

  // 4. ตรวจ user-sheet state
  var sh = document.getElementById('user-sheet');
  var ov = document.getElementById('user-overlay');
  log.push('user-sheet open: ' + (sh ? sh.classList.contains('open') : 'N/A'));
  log.push('user-overlay open: ' + (ov ? ov.classList.contains('open') : 'N/A'));

  // 5. ลองเรียก openUserSheet จริง แล้วดู error
  try {
    openUserSheet(null, 'tech');
    log.push('openUserSheet call: ✅ no error');
    var shAfter = document.getElementById('user-sheet');
    log.push('user-sheet open after call: ' + (shAfter ? shAfter.classList.contains('open') : 'N/A'));
  } catch(e) {
    log.push('openUserSheet ERROR: ' + e.message);
  }

  var result = log.join('\n');
  console.log('[debugUserBtn]\n' + result);
  alert('[debugUserBtn]\n' + result);
  return result;
}

function initUsersEvents() {}

function renderUsersSummary() {
  var el = document.getElementById('users-summary');
  if (!el) return;
  var tabs = [
    { tab:'tech',      icon:'🔧', label:'ช่าง',     cl:'#166534', bg:'#f0fdf4', bd:'#86efac' },
    { tab:'reporter',  icon:'📢', label:'ผู้แจ้ง',  cl:'#1d4ed8', bg:'#eff6ff', bd:'#bfdbfe' },
    { tab:'admin',     icon:'👑', label:'แอดมิน',   cl:'#7c3aed', bg:'#fdf4ff', bd:'#e9d5ff' },
    { tab:'executive', icon:'📊', label:'ผู้บริหาร',cl:'#0e7490', bg:'#ecfeff', bd:'#a5f3fc' },
  ];
  el.innerHTML = tabs.map(function(s) {
    var cnt = db.users.filter(function(u){ return u.role===s.tab; }).length;
    var act = currentUserTab === s.tab;
    return '<div onclick="switchUserTab(\'' + s.tab + '\')" style="background:' + (act?s.bg:'white') + ';border:1.5px solid ' + (act?s.bd:'#e5e7eb') + ';border-radius:12px;padding:10px;text-align:center;cursor:pointer">'
      + '<div style="font-size:1.3rem;font-weight:900;color:' + s.cl + '">' + cnt + '</div>'
      + '<div style="font-size:0.6rem;font-weight:700;color:' + (act?s.cl:'#94a3b8') + ';margin-top:2px">' + s.icon + ' ' + s.label + '</div>'
      + '</div>';
  }).join('');
}

function renderUsers() {
  // cleanup dynamic overlays ที่อาจค้างอยู่
  document.querySelectorAll('.cdel-overlay, #admin-manage-tk-ov').forEach(function(el){el.remove();});
  var tabMeta = {
    tech:      { icon:'🔧', label:'ช่างซ่อม',   cl:'#166534', bg:'#f0fdf4', bd:'#86efac' },
    reporter:  { icon:'📢', label:'ผู้แจ้งงาน', cl:'#1d4ed8', bg:'#eff6ff', bd:'#bfdbfe' },
    admin:     { icon:'👑', label:'แอดมิน',     cl:'#7c3aed', bg:'#fdf4ff', bd:'#e9d5ff' },
    executive: { icon:'📊', label:'ผู้บริหาร',  cl:'#0e7490', bg:'#ecfeff', bd:'#a5f3fc' },
  };
  var tm   = tabMeta[currentUserTab] || tabMeta.reporter;
  var list = db.users.filter(function(u){ return u.role===currentUserTab; });
  var countEl = document.getElementById('users-count');
  if (countEl) countEl.textContent = tm.icon + ' ' + tm.label + ' · ' + list.length + ' คน';
  var el = document.getElementById('users-list');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<div style="text-align:center;padding:48px 20px;color:#94a3b8">'
      + '<div style="font-size:2.5rem;margin-bottom:8px">' + tm.icon + '</div>'
      + '<div style="font-size:0.9rem;font-weight:700;color:#374151;margin-bottom:4px">ยังไม่มี' + tm.label + '</div>'
      + '<div style="font-size:0.75rem">กดปุ่ม + เพิ่ม ด้านบน</div></div>';
    return;
  }
  el.innerHTML = list.map(function(u){ return buildUserCard(u, tm); }).join('');
}

function _esc(s) { return s ? String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }

function buildUserCard(u, tm) {
  var initials = typeof getAvatarInitials==='function' ? getAvatarInitials(u.name) : (u.name||'?').slice(0,2);
  var avatarBg = typeof getAvatarColor==='function' ? getAvatarColor(u.id) : '#c8102e';
  var avatarHtml = (u.avatar||u.photo)
    ? '<img src="' + _esc(u.avatar||u.photo) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
    : '<span style="font-size:1rem;font-weight:900;color:white">' + _esc(initials) + '</span>';

  var roleTag = {tech:'ช่าง',reporter:'ผู้แจ้ง',admin:'Admin',executive:'ผู้บริหาร'}[u.role]||u.role;

  // ── workload + machine cards (tech only) ──
  var workHtml = '';
  if (u.role === 'tech') {
    var active = db.tickets.filter(function(t){
      return t.assigneeId===u.id && ['done','verified','closed'].indexOf(t.status)===-1;
    });
    var doneMonth = db.tickets.filter(function(t){
      return t.assigneeId===u.id && ['done','verified','closed'].indexOf(t.status)>=0
        && (t.updatedAt||'').slice(0,7)===new Date().toISOString().slice(0,7);
    }).length;
    var urgent  = active.filter(function(t){return t.priority==='high';}).length;
    var waiting = active.filter(function(t){return t.status==='waiting_part';}).length;
    var pct     = Math.min(100, active.length*14);
    var barClr  = active.length>4?'#c8102e':active.length>2?'#f59e0b':'#22c55e';
    var manBtn  = (CU&&CU.role==='admin')
      ? '<button onclick="openAdminManageTechTickets(\'' + u.id + '\')" style="margin-left:auto;font-size:0.62rem;padding:4px 10px;border-radius:7px;border:1.5px solid #c8102e;background:white;color:#c8102e;font-weight:800;cursor:pointer;font-family:inherit;touch-action:manipulation">⚙️ จัดการงาน</button>'
      : '';

    // ── machine cards: แสดงเครื่องที่มีงานค้างอยู่กับช่างคนนี้ ──
    var macMap = typeof getMacMap==='function' ? getMacMap() : new Map();
    var machineCards = '';
    var uniqueMachines = [];
    var seenMac = {};
    active.forEach(function(t){
      if (t.machineId && !seenMac[t.machineId]) {
        seenMac[t.machineId] = true;
        var mac = macMap.get(t.machineId);
        uniqueMachines.push({ t: t, mac: mac });
      }
    });
    if (uniqueMachines.length > 0) {
      machineCards = '<div style="border-top:1px solid #f1f5f9;padding:8px 14px 10px;background:#fafafa">'
        + '<div style="font-size:0.6rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:7px">เครื่องที่รับผิดชอบ</div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:6px">'
        + uniqueMachines.slice(0, 6).map(function(item) {
            var mac = item.mac; var t = item.t;
            var btu = mac&&mac.btu ? Number(mac.btu).toLocaleString()+' BTU' : '';
            var macName = mac ? mac.name : (t.machine||'—');
            var stColor = {new:'#6b7280',assigned:'#7c3aed',accepted:'#0891b2',inprogress:'#e65100',waiting_part:'#b45309',done:'#059669'}[t.status]||'#6b7280';
            var stIcon  = {new:'🆕',assigned:'📋',accepted:'✋',inprogress:'⚙️',waiting_part:'⏳',done:'✅'}[t.status]||'❄️';
            return '<div onclick="openDetail(\'' + t.id + '\')" style="background:white;border:1.5px solid #e2e8f0;border-radius:10px;padding:7px 10px;cursor:pointer;touch-action:manipulation;min-width:0;flex:1;min-width:130px;max-width:calc(50% - 3px);box-sizing:border-box;-webkit-tap-highlight-color:transparent"'
              + ' ontouchstart="this.style.background=\'#f8fafc\'" ontouchend="this.style.background=\'white\'">'
              + '<div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">'
              + '<span style="font-size:0.75rem">❄️</span>'
              + '<div style="font-size:0.7rem;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">' + _esc(macName.length>18?macName.slice(0,18)+'…':macName) + '</div>'
              + '</div>'
              + (btu ? '<div style="font-size:0.58rem;color:#64748b;margin-bottom:3px">' + btu + '</div>' : '')
              + '<div style="display:flex;align-items:center;gap:4px">'
              + '<span style="font-size:0.65rem">' + stIcon + '</span>'
              + '<span style="font-size:0.6rem;font-weight:700;color:' + stColor + '">' + t.id + '</span>'
              + '</div>'
              + '</div>';
          }).join('')
        + (uniqueMachines.length > 6 ? '<div style="font-size:0.65rem;color:#94a3b8;padding:6px;display:flex;align-items:center">+' + (uniqueMachines.length-6) + ' เครื่อง</div>' : '')
        + '</div></div>';
    }

    workHtml = '<div style="border-top:1px solid #f1f5f9;padding:10px 14px 10px;background:#fafafa">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">'
      + '<span style="font-size:0.65rem;color:#94a3b8;flex:1">ภาระงาน</span>'
      + '<span style="font-size:0.7rem;font-weight:900;color:'+barClr+'">'+active.length+' งานค้าง</span>'
      + '<span style="font-size:0.65rem;color:#22c55e;font-weight:700">✅ '+doneMonth+' เดือนนี้</span>'
      + manBtn + '</div>'
      + '<div style="background:#e5e7eb;border-radius:99px;height:5px;overflow:hidden;margin-bottom:6px">'
      + '<div style="height:100%;width:'+pct+'%;background:'+barClr+';border-radius:99px;transition:width 0.5s"></div></div>'
      + '<div style="display:flex;gap:5px;flex-wrap:wrap">'
      + (urgent>0  ? '<span style="font-size:0.62rem;background:#fff0f2;color:#c8102e;border:1px solid #fecaca;border-radius:6px;padding:2px 7px;font-weight:700">🔴 '+urgent+' ด่วน</span>':'')
      + (waiting>0 ? '<span style="font-size:0.62rem;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:6px;padding:2px 7px;font-weight:700">⏳ '+waiting+' รออะไหล่</span>':'')
      + (active.length===0 ? '<span style="font-size:0.65rem;color:#94a3b8">✨ ไม่มีงานค้าง</span>':'')
      + '</div></div>'
      + machineCards;
  }

  var canDelete = (CU && CU.role === 'admin' && u.id !== CU.id);

  return '<div style="background:white;border-radius:16px;margin-bottom:10px;border:1.5px solid #e5e7eb;box-shadow:0 2px 8px rgba(0,0,0,0.05);overflow:hidden">'
    + '<div style="display:flex;align-items:center;gap:12px;padding:13px 14px">'
    + '<div style="width:48px;height:48px;border-radius:50%;background:'+avatarBg+';display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.12)">'+avatarHtml+'</div>'
    + '<div style="flex:1;min-width:0">'
    + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;flex-wrap:wrap">'
    + '<div style="font-size:0.92rem;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px">'+_esc(u.name)+'</div>'
    + '<span style="background:'+tm.bg+';color:'+tm.cl+';border:1px solid '+tm.bd+';border-radius:99px;padding:1px 7px;font-size:0.6rem;font-weight:800;flex-shrink:0">'+roleTag+'</span>'
    + '</div>'
    + '<div style="font-size:0.7rem;color:#94a3b8;display:flex;gap:5px;flex-wrap:wrap">'
    + '<span>@'+_esc(u.username)+'</span>'
    + (u.dept?'<span>· '+_esc(u.dept)+'</span>':'')
    + (u.tel ?'<span>· 📞 '+_esc(u.tel)+'</span>':'')
    + '</div></div>'
    + '<div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0">'
    + '<button onclick="openUserSheet(\''+u.id+'\')" title="แก้ไข" style="width:36px;height:36px;background:#f1f5f9;border:none;border-radius:10px;font-size:0.9rem;cursor:pointer;touch-action:manipulation;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent">✏️</button>'
    + (canDelete ? '<button onclick="delUser(\''+u.id+'\')" title="ลบ" style="width:36px;height:36px;background:#fff0f2;border:1px solid #fecaca;border-radius:10px;font-size:0.9rem;cursor:pointer;touch-action:manipulation;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent">🗑️</button>' : '<div style="width:36px;height:36px"></div>')
    + '</div></div>'
    + workHtml + '</div>';
}

function openUserSheet(id, defaultRole) {
  var u    = id ? db.users.find(function(x){return x.id===id;}) : null;
  var role = (u&&u.role)||defaultRole||currentUserTab||'reporter';
  var roleLabel = {admin:'แอดมิน',tech:'ช่างซ่อม',reporter:'ผู้แจ้งงาน',executive:'ผู้บริหาร'};

  document.getElementById('us-title').textContent = u ? '✏️ แก้ไขผู้ใช้' : '➕ เพิ่ม'+(roleLabel[role]||'ผู้ใช้');
  document.getElementById('u-id').value      = (u&&u.id)||'';
  document.getElementById('u-name').value    = (u&&u.name)||'';
  document.getElementById('u-photo').value   = (u&&u.photo)||'';
  document.getElementById('u-uname').value   = (u&&u.username)||'';
  document.getElementById('u-pass').value    = '';
  document.getElementById('u-pass').type     = 'password';
  document.getElementById('u-role').value    = role;
  document.getElementById('u-dept').value    = (u&&u.dept)||'';
  document.getElementById('u-tel').value     = (u&&u.tel)||'';
  document.getElementById('u-contact').value = (u&&u.contact)||'';

  var prevEl = document.getElementById('u-avatar-preview');
  if (prevEl) {
    prevEl.innerHTML = (u&&u.photo)
      ? '<img src="'+_esc(u.photo)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
      : '<span style="font-size:2rem">'+({admin:'👑',tech:'🔧',reporter:'📢',executive:'📊'}[role]||'👤')+'</span>';
  }
  var pt = document.getElementById('u-pass-toggle');
  if (pt) pt.textContent = '👁 ดู';

  var pcb = document.getElementById('u-pass-current');
  var pv  = document.getElementById('u-pass-val');
  if (pcb && pv) {
    if (CU&&CU.role==='admin'&&u&&u.password) {
      pv.textContent  = u.password.startsWith('sha256:') ? '•••••••• (hashed)' : '(plain)';
      pcb.style.display = 'flex';
    } else { pcb.style.display = 'none'; }
  }
  openSheet('user');
}

function triggerPhotoInput() {
  var inp = document.getElementById('u-photo-input');
  if (inp) { inp.value=''; inp.click(); }
}
function previewUserPhoto(input) {
  if (!input.files||!input.files[0]) return;
  var r = new FileReader();
  r.onload = function(e) {
    document.getElementById('u-photo').value = e.target.result;
    var pv = document.getElementById('u-avatar-preview');
    if (pv) pv.innerHTML = '<img src="'+e.target.result+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
  };
  r.readAsDataURL(input.files[0]);
}

async function saveUser() {
  var id    = document.getElementById('u-id').value;
  var pass  = document.getElementById('u-pass').value;
  var photo = document.getElementById('u-photo').value;
  var d = {
    name:     document.getElementById('u-name').value.trim(),
    username: document.getElementById('u-uname').value.trim(),
    role:     document.getElementById('u-role').value,
    dept:     document.getElementById('u-dept').value.trim(),
    tel:      document.getElementById('u-tel').value.trim(),
    contact:  document.getElementById('u-contact').value.trim(),
    photo:    photo,
  };
  document.querySelectorAll('#user-sheet .field-error').forEach(function(e){e.remove();});
  var hasErr = false;
  if (!d.name)      { showFormError('u-name',  'กรุณากรอกชื่อ-นามสกุล'); hasErr=true; }
  if (!d.username)  { showFormError('u-uname', 'กรุณากรอก Username');     hasErr=true; }
  if (!id && !pass) { showFormError('u-pass',  'กรุณาตั้งรหัสผ่าน');     hasErr=true; }
  if (hasErr) return;
  var dup = db.users.find(function(u){ return u.username.toLowerCase()===d.username.toLowerCase()&&u.id!==id; });
  if (dup) { showFormError('u-uname','Username "'+d.username+'" มีผู้ใช้งานอยู่แล้ว'); return; }
  try {
    if (id) {
      var ex = db.users.find(function(x){return x.id===id;});
      Object.assign(ex, d);
      if (pass) ex.password = await hashPassword(pass);
    } else {
      db.users.push(Object.assign({id:'u'+Date.now()}, d, {password: await hashPassword(pass)}));
    }
    if (window.bkAudit) window.bkAudit(id?'แก้ไข User':'เพิ่ม User', d.username||d.name, null, {name:d.name,role:d.role});
    db._seq = (db._seq||1)+1;
    saveDB();
    closeSheet('user');
    switchUserTab(d.role==='tech'?'tech':d.role==='admin'?'admin':d.role==='executive'?'executive':'reporter');
    showToast('✅ บันทึกผู้ใช้ '+d.name+' แล้ว');
  } catch(e) {
    console.error('[saveUser]',e);
    showToast('❌ บันทึกไม่สำเร็จ: '+(e.message||'ลองใหม่'));
  }
}

function delUser(id) {
  if (id===CU.id) { showToast('⚠️ ไม่สามารถลบบัญชีของตัวเองได้'); return; }
  var u = db.users.find(function(x){return x.id===id;});
  if (!u) return;
  showConfirmDelete(u, function() {
    if (window.bkAudit) window.bkAudit('ลบ User', u.username||u.name, {name:u.name,role:u.role}, null);
    db.users = db.users.filter(function(x){return x.id!==id;});
    db.tickets.forEach(function(t){
      if (t.assigneeId===id&&['done','verified','closed'].indexOf(t.status)===-1) {
        t.assigneeId=null; t.assignee=null; t.status='new'; t.updatedAt=nowStr();
      }
    });
    if (db.chats) Object.keys(db.chats).forEach(function(k){
      db.chats[k]=(db.chats[k]||[]).filter(function(m){return m.uid!==id;});
      if(!db.chats[k].length) delete db.chats[k];
    });
    db.notifications=(db.notifications||[]).filter(function(n){return n.userId!==id;});
    db._seq=(db._seq||1)+1;
    saveDB(); fsSaveNow();
    switchUserTab(currentUserTab||'tech');
    renderTickets();
    showToast('🗑️ ลบผู้ใช้ '+u.name+' แล้ว');
  });
}

function showConfirmDelete(u, onConfirm) {
  document.querySelectorAll('.cdel-overlay').forEach(function(el){el.remove();});
  var ov = document.createElement('div');
  ov.className = 'cdel-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)';
  ov.innerHTML = '<div style="background:white;border-radius:20px;padding:24px;max-width:320px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)">'
    + '<div style="font-size:2rem;margin-bottom:12px">🗑️</div>'
    + '<div style="font-size:1rem;font-weight:800;margin-bottom:8px">ลบผู้ใช้?</div>'
    + '<div style="font-size:0.85rem;color:#64748b;margin-bottom:6px"><b>'+_esc(u.name)+'</b><br>@'+_esc(u.username)+'</div>'
    + '<div style="font-size:0.75rem;color:#ef4444;background:#fff0f0;border-radius:10px;padding:8px;margin-bottom:20px">⚠️ ไม่สามารถย้อนกลับได้</div>'
    + '<div style="display:flex;gap:10px">'
    + '<button id="cdel-cancel" style="flex:1;padding:12px;border-radius:12px;border:1.5px solid #e5e7eb;background:white;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit">ยกเลิก</button>'
    + '<button id="cdel-confirm" style="flex:1;padding:12px;border-radius:12px;border:none;background:#c8102e;color:white;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit">ลบเลย</button>'
    + '</div></div>';
  document.body.appendChild(ov);
  ov.querySelector('#cdel-cancel').onclick  = function(){ov.remove();};
  ov.querySelector('#cdel-confirm').onclick = function(){ov.remove(); setTimeout(onConfirm, 50);};
  ov.onclick = function(e){if(e.target===ov)ov.remove();};
}

// ── Admin manage tech tickets ──
function openAdminManageTechTickets(techId) {
  var tech = db.users.find(function(u){return u.id===techId;}); if(!tech) return;
  document.querySelectorAll('#admin-manage-tk-ov').forEach(function(e){e.remove();});
  var ov = document.createElement('div'); ov.id='admin-manage-tk-ov';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9500;display:flex;align-items:flex-end;backdrop-filter:blur(3px)';
  var techTks  = db.tickets.filter(function(t){return t.assigneeId===techId&&['closed','verified'].indexOf(t.status)===-1;});
  var avail    = db.tickets.filter(function(t){return ['closed','verified'].indexOf(t.status)===-1&&(!t.assigneeId||t.assigneeId!==techId);});
  function rows(list, isAssigned) {
    if(!list.length) return '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:0.78rem">ไม่มีรายการ</div>';
    return list.map(function(t){
      var btn = isAssigned
        ? '<button onclick="adminUnassignTicket(\''+t.id+'\',\''+techId+'\')" style="font-size:0.68rem;padding:4px 10px;border-radius:8px;border:1.5px solid #dc2626;background:#fff5f5;color:#dc2626;font-weight:800;cursor:pointer;font-family:inherit;touch-action:manipulation">🗑️ ถอด</button>'
        : '<button onclick="adminAssignTicket(\''+t.id+'\',\''+techId+'\')" style="font-size:0.68rem;padding:4px 10px;border-radius:8px;border:1.5px solid #16a34a;background:#f0fdf4;color:#16a34a;font-weight:800;cursor:pointer;font-family:inherit;touch-action:manipulation">➕ มอบ</button>';
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #f1f5f9">'
        + '<div style="flex:1;min-width:0"><div style="font-size:0.78rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+t.id+' · '+_esc(t.problem)+'</div></div>'+btn+'</div>';
    }).join('');
  }
  ov.innerHTML = '<div style="background:white;border-radius:24px 24px 0 0;width:100%;max-height:88vh;overflow:hidden;display:flex;flex-direction:column">'
    + '<div style="display:flex;justify-content:center;padding:10px 0 0"><div style="width:40px;height:4px;background:#e2e8f0;border-radius:99px"></div></div>'
    + '<div style="padding:14px 16px 12px;border-bottom:1px solid #f1f5f9;flex-shrink:0"><div style="font-size:1rem;font-weight:900">⚙️ จัดการงาน — '+_esc(tech.name)+'</div></div>'
    + '<div style="overflow-y:auto;flex:1">'
    + '<div style="padding:10px 16px 4px;font-size:0.7rem;font-weight:800;color:#c8102e">งานที่มอบหมาย ('+techTks.length+')</div>'
    + '<div id="amtk-assigned-'+techId+'">'+rows(techTks,true)+'</div>'
    + '<div style="padding:10px 16px 4px;font-size:0.7rem;font-weight:800;color:#0369a1;border-top:2px solid #f1f5f9;margin-top:6px">งานพร้อมมอบ ('+avail.length+')</div>'
    + '<div id="amtk-avail-'+techId+'">'+rows(avail,false)+'</div>'
    + '</div>'
    + '<div style="padding:12px 16px;border-top:1px solid #f1f5f9;flex-shrink:0">'
    + '<button onclick="document.getElementById(\'admin-manage-tk-ov\').remove()" style="width:100%;padding:12px;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit">ปิด</button>'
    + '</div></div>';
  ov.onclick = function(e){if(e.target===ov)ov.remove();};
  document.body.appendChild(ov);
}
function _refreshManageTk(techId) {
  var techTks = db.tickets.filter(function(t){return t.assigneeId===techId&&['closed','verified'].indexOf(t.status)===-1;});
  var avail   = db.tickets.filter(function(t){return ['closed','verified'].indexOf(t.status)===-1&&(!t.assigneeId||t.assigneeId!==techId);});
  function rows(list, isAssigned) {
    return list.map(function(t){
      var btn = isAssigned
        ? '<button onclick="adminUnassignTicket(\''+t.id+'\',\''+techId+'\')" style="font-size:0.68rem;padding:4px 10px;border-radius:8px;border:1.5px solid #dc2626;background:#fff5f5;color:#dc2626;font-weight:800;cursor:pointer;font-family:inherit;touch-action:manipulation">🗑️ ถอด</button>'
        : '<button onclick="adminAssignTicket(\''+t.id+'\',\''+techId+'\')" style="font-size:0.68rem;padding:4px 10px;border-radius:8px;border:1.5px solid #16a34a;background:#f0fdf4;color:#16a34a;font-weight:800;cursor:pointer;font-family:inherit;touch-action:manipulation">➕ มอบ</button>';
      return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #f1f5f9"><div style="flex:1;min-width:0"><div style="font-size:0.78rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+t.id+' · '+_esc(t.problem)+'</div></div>'+btn+'</div>';
    }).join('') || '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:0.78rem">ไม่มีรายการ</div>';
  }
  var a=document.getElementById('amtk-assigned-'+techId); var b=document.getElementById('amtk-avail-'+techId);
  if(a)a.innerHTML=rows(techTks,true); if(b)b.innerHTML=rows(avail,false);
}
function adminAssignTicket(ticketId, techId) {
  var t=db.tickets.find(function(x){return x.id===ticketId;}); var tech=db.users.find(function(u){return u.id===techId;}); if(!t||!tech) return;
  var now=nowStr(); t.assigneeId=techId; t.assignee=tech.name; if(t.status==='new')t.status='assigned'; t.updatedAt=now;
  (t.history=t.history||[]).push({act:'📋 Admin มอบงานให้ '+tech.name,by:CU.name,at:now});
  notifyUser(techId,'📋 งานใหม่จาก Admin ['+ticketId+']',t.problem,ticketId);
  saveDB(); syncTicket(t); renderTickets(); renderUsers(); _refreshManageTk(techId);
  showToast('✅ มอบงาน '+ticketId+' ให้ '+tech.name);
}
function adminUnassignTicket(ticketId, techId) {
  var t=db.tickets.find(function(x){return x.id===ticketId;}); if(!t) return;
  var tname=t.assignee||''; var now=nowStr();
  t.assigneeId=null; t.assignee=null; t.status='new'; t.updatedAt=now;
  (t.history=t.history||[]).push({act:'↩️ Admin ถอดงานจาก '+tname,by:CU.name,at:now});
  saveDB(); syncTicket(t); renderTickets(); renderUsers(); _refreshManageTk(techId);
  showToast('↩️ ถอดงาน '+ticketId+' เรียบร้อย');
}
function openTechPopup(techId) { openAdminManageTechTickets(techId); }

// ── Admin notification card ──
function showAdminCard(title, msg, tid, icon) {
  tid=tid||''; icon=icon||'🔔';
  if(!CU||CU.role!=='admin') return;
  document.querySelectorAll('.admin-notif-card').forEach(function(el){el.remove();});
  var card=document.createElement('div'); card.className='admin-notif-card';
  card.style.cssText='position:fixed;bottom:calc(var(--nav-h) + var(--safe-bot) + 70px);right:16px;z-index:8888;background:#1e293b;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);padding:12px 14px;max-width:min(320px,calc(100vw - 32px));min-width:220px;border-left:3px solid #c8102e;display:flex;align-items:flex-start;gap:10px;cursor:pointer';
  card.innerHTML='<div style="font-size:1.1rem;flex-shrink:0">'+icon+'</div>'
    +'<div style="flex:1;overflow:hidden;min-width:0"><div style="font-size:0.82rem;font-weight:700;color:white;margin-bottom:2px">'+title+'</div>'
    +'<div style="font-size:0.74rem;color:rgba(255,255,255,0.6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+msg+'</div>'
    +(tid?'<div style="font-size:0.62rem;color:#93c5fd;font-weight:600;margin-top:3px">แตะเพื่อดู →</div>':'')+'</div>'
    +'<button onclick="event.stopPropagation();this.closest(\'.admin-notif-card\').remove()" style="background:rgba(0,0,0,0.06);border:none;color:#64748b;cursor:pointer;font-size:0.8rem;padding:4px 6px;border-radius:6px;flex-shrink:0;font-weight:700">✕</button>';
  if(tid) card.onclick=function(e){ if(e.target.tagName!=='BUTTON'){ card.remove(); var rawTid=tid.trim().replace(/^tk_/,''); if(title&&title.indexOf('💬')===0){var tk=db.tickets&&db.tickets.find(function(x){return x.id===rawTid;}); if(tk){var pid=CU.role==='tech'?tk.reporterId:(tk.assigneeId||tk.reporterId);if(pid)openChat(rawTid,pid);}}else safeOpenDetail(rawTid);}};
  document.body.appendChild(card);
  setTimeout(function(){card.style.opacity='0';card.style.transition='opacity 0.3s';setTimeout(function(){card.remove();},300);},3000);
}

// ── Machine QR ──
var _mqrMachineId='';
function showMachineQR(mid){var m=db.machines.find(function(x){return x.id===mid;});if(!m)return;_mqrMachineId=mid;document.getElementById('mqr-title').textContent='⬛ QR — '+(m.serial||m.id);document.getElementById('mqr-info').innerHTML='<b>'+_esc(m.name)+'</b><br>'+_esc(m.serial||m.id)+(m.dept?' · '+_esc(m.dept):'');drawQR(mid,document.getElementById('mqr-canvas'));openSheet('mqr');}
function downloadMachineQR(){var m=db.machines.find(function(x){return x.id===_mqrMachineId;});if(!m)return;var canvas=document.getElementById('mqr-canvas');var out=document.createElement('canvas');out.width=260;out.height=300;var ctx=out.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,260,300);ctx.drawImage(canvas,20,16,220,220);ctx.fillStyle='#1a1a2e';ctx.font='bold 13px Arial';ctx.textAlign='center';ctx.fillText(m.name,130,256);ctx.font='11px Arial';ctx.fillStyle='#6b7280';ctx.fillText(m.serial||m.id,130,274);ctx.fillText('SCG.AIRCON',130,292);var a=document.createElement('a');a.download='QR_'+(m.serial||m.id).replace(/[^a-zA-Z0-9]/g,'_')+'.png';a.href=out.toDataURL('image/png');a.click();showToast('✅ บันทึก QR Code แล้ว');}
function drawQR(text,canvas){var size=canvas.width;var ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,size,size);var img=new Image();img.crossOrigin='anonymous';img.onload=function(){ctx.fillStyle='white';ctx.fillRect(0,0,size,size);ctx.drawImage(img,0,0,size,size);};img.onerror=function(){ctx.fillStyle='#f3f4f6';ctx.fillRect(0,0,size,size);ctx.fillStyle='#374151';ctx.font='bold 13px Arial';ctx.textAlign='center';ctx.fillText('QR: '+text,size/2,size/2);};img.src='https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='+encodeURIComponent(text)+'&margin=0';}

// ── QR Scanner ──
var _qrStream=null,_qrInterval=null;
function openQRScanner(){var modal=document.getElementById('qr-modal');modal.style.display='flex';var se=document.getElementById('qr-status');se.textContent='กำลังเริ่มกล้อง...';var prev=document.getElementById('qr-preview-img');if(prev)prev.style.display='none';var video=document.getElementById('qr-video');video.style.display='';if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){se.textContent='📷 ไม่มีกล้อง — กด "เลือกรูป"';return;}navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}}).then(function(s){_qrStream=s;video.srcObject=s;video.setAttribute('playsinline',true);video.play();se.textContent='ชี้กล้องไปที่ QR Code';_qrInterval=setInterval(function(){scanQRFrame(video,se);},300);}).catch(function(){se.textContent='📷 ไม่ได้รับสิทธิ์กล้อง';});}
function triggerQRFilePicker(){var fi=document.getElementById('qr-file-input');if(fi){fi.value='';fi.click();}}
function handleQRFileInput(input){var file=input.files[0];if(!file)return;var se=document.getElementById('qr-status');se.textContent='🔍 กำลังอ่าน QR...';var reader=new FileReader();reader.onload=function(ev){var img=new Image();img.onload=function(){var prev=document.getElementById('qr-preview-img');if(prev){prev.src=ev.target.result;prev.style.display='block';}var video=document.getElementById('qr-video');if(video)video.style.display='none';var canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;canvas.getContext('2d').drawImage(img,0,0);var id=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);if('BarcodeDetector' in window){new BarcodeDetector({formats:['qr_code']}).detect(canvas).then(function(c){if(c.length>0)handleQRResult(c[0].rawValue);else _decodeWithJsQR(id,se);}).catch(function(){_decodeWithJsQR(id,se);});}else _decodeWithJsQR(id,se);};img.onerror=function(){se.textContent='❌ โหลดรูปไม่ได้';};img.src=ev.target.result;};reader.readAsDataURL(file);}
function _decodeWithJsQR(imageData,se){if(typeof jsQR!=='function'){se.textContent='❌ อ่าน QR ไม่ได้';return;}var c=jsQR(imageData.data,imageData.width,imageData.height,{inversionAttempts:'attemptBoth'});if(c)handleQRResult(c.data);else se.textContent='❌ ไม่พบ QR Code — ลองใหม่';}
function scanQRFrame(video,se){if(!video.videoWidth||!video.videoHeight)return;var size=Math.min(video.videoWidth,video.videoHeight)*0.8;var sx=(video.videoWidth-size)/2;var sy=(video.videoHeight-size)/2;var canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;canvas.getContext('2d').drawImage(video,sx,sy,size,size,0,0,size,size);if('BarcodeDetector' in window){new BarcodeDetector({formats:['qr_code']}).detect(canvas).then(function(c){if(c.length>0)handleQRResult(c[0].rawValue);}).catch(function(){_scanWithJsQR(canvas,se);});return;}_scanWithJsQR(canvas,se);}
function _scanWithJsQR(canvas,se){if(typeof jsQR!=='function'){if(se)se.textContent='⚠️ กำลังโหลด...';return;}var d=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);var c=jsQR(d.data,d.width,d.height,{inversionAttempts:'dontInvert'});if(c)handleQRResult(c.data);}
function handleQRResult(text){closeQRScanner();var mid=text.trim();try{var p=JSON.parse(text);mid=p.id||p.machineId||text;}catch(e){}var m=db.machines.find(function(x){return x.id===mid||x.serial===mid;});if(m){var ds=document.getElementById('nt-dept');if(ds){[].forEach.call(ds.options,function(o){if(o.value===m.dept)o.selected=true;});onDeptChange(m.dept);setTimeout(function(){var ms=document.getElementById('nt-mac');if(ms){[].forEach.call(ms.options,function(o){if(o.value===m.id)o.selected=true;});onMachineChange(m.id);}},150);}showToast('✅ พบเครื่อง: '+m.name);}else showToast('❌ ไม่พบเครื่องรหัส: '+mid);}
function closeQRScanner(){clearInterval(_qrInterval);_qrInterval=null;if(_qrStream){_qrStream.getTracks().forEach(function(t){t.stop();});_qrStream=null;}var video=document.getElementById('qr-video');if(video){video.srcObject=null;video.style.display='';}var prev=document.getElementById('qr-preview-img');if(prev){prev.style.display='none';prev.src='';}var fi=document.getElementById('qr-file-input');if(fi)fi.value='';document.getElementById('qr-modal').style.display='none';}

function setProblem(text){document.getElementById('nt-prob').value=text;document.querySelectorAll('.prob-chip').forEach(function(c){c.classList.toggle('selected',c.textContent===text);});}

// ── Excel import ──
var xlData=[],xlHeaders=[];
function openImportSheet(){openSheet('import');}
function readExcel(input){var file=input.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(e){var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});var ws=wb.Sheets[wb.SheetNames[0]];xlData=XLSX.utils.sheet_to_json(ws,{defval:''});xlHeaders=xlData.length>0?Object.keys(xlData[0]):[];document.getElementById('xl-map').style.display='block';document.getElementById('xl-import-btn').style.display='';renderColMap();};reader.readAsArrayBuffer(file);}
function renderColMap(){var el=document.getElementById('xl-col-map');if(!el)return;var fields=[{key:'name',label:'ชื่อเครื่อง *'},{key:'serial',label:'Serial'},{key:'dept',label:'แผนก'},{key:'room',label:'ห้อง'},{key:'brand',label:'ยี่ห้อ'},{key:'btu',label:'BTU'},{key:'type',label:'ประเภท'},{key:'note',label:'หมายเหตุ'}];el.innerHTML=fields.map(function(f){return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><label style="width:90px;font-size:0.75rem;font-weight:700">'+f.label+'</label><select id="xlmap-'+f.key+'" style="flex:1;padding:6px 8px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:0.75rem;font-family:inherit"><option value="">(ไม่นำเข้า)</option>'+xlHeaders.map(function(h){return '<option value="'+h+'"'+(h.toLowerCase().includes(f.key)?' selected':'')+'>'+h+'</option>';}).join('')+'</select></div>';}).join('');}
function importMachines(){if(!xlData.length)return;var gc=function(k){var el=document.getElementById('xlmap-'+k);return el?el.value:'';};var added=0;xlData.forEach(function(row){var name=row[gc('name')];if(!name)return;var serial=row[gc('serial')]||'';if(serial&&db.machines.find(function(m){return m.serial===serial;}))return;db.machines.push({id:'M'+Date.now()+Math.random().toString(36).slice(2,5),name:String(name).trim(),serial:String(serial).trim(),dept:String(row[gc('dept')]||'').trim(),room:String(row[gc('room')]||'').trim(),brand:String(row[gc('brand')]||'').trim(),btu:String(row[gc('btu')]||'').trim(),type:String(row[gc('type')]||'').trim(),note:String(row[gc('note')]||'').trim(),status:'normal',createdAt:nowStr()});added++;});if(added>0){saveDB();if(typeof renderMachines==='function')renderMachines();}closeSheet('import');resetExcel();showToast(added>0?'✅ นำเข้า '+added+' เครื่องแล้ว':'⚠️ ไม่มีข้อมูลใหม่');}
function resetExcel(){xlData=[];xlHeaders=[];document.getElementById('xl-map').style.display='none';document.getElementById('xl-import-btn').style.display='none';document.getElementById('xl-file').value='';}
