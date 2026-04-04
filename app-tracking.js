// ============================================================
// ACTIONS
// ============================================================
let pendingPhotos = {before:[], after:[]};
let _photoLoading = 0;
const MAX_PHOTOS_PER_TYPE = 3;   // สูงสุด 3 รูปต่อประเภท
const PHOTO_MAX_PX = 1024;       // resize ให้ไม่เกิน 1024px
const PHOTO_QUALITY = 0.72;      // JPEG quality

// ── Phone number auto-format: 091-234-5678 ──
function fmtPhone(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 10);
  if (v.length > 6)      v = v.slice(0,3) + '-' + v.slice(3,6) + '-' + v.slice(6);
  else if (v.length > 3) v = v.slice(0,3) + '-' + v.slice(3);
  el.value = v;
}
function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('compress timeout')), 10000);
    const reader = new FileReader();
    reader.onerror = () => { clearTimeout(timeout); reject(reader.error); };
    reader.onload = ev => {
      const img = new Image();
      img.onerror = () => { clearTimeout(timeout); reject(new Error('img load failed')); };
      img.onload = () => {
        clearTimeout(timeout);
        let w = img.width, h = img.height;
        if (w > PHOTO_MAX_PX || h > PHOTO_MAX_PX) {
          if (w > h) { h = Math.round(h * PHOTO_MAX_PX / w); w = PHOTO_MAX_PX; }
          else       { w = Math.round(w * PHOTO_MAX_PX / h); h = PHOTO_MAX_PX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', PHOTO_QUALITY));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Chat photo compress (smaller) ──
function compressChatPhoto(file) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('chat compress timeout')), 10000);
    const reader = new FileReader();
    reader.onerror = () => { clearTimeout(timeout); reject(reader.error); };
    reader.onload = ev => {
      const img = new Image();
      img.onerror = () => { clearTimeout(timeout); reject(new Error('img load failed')); };
      img.onload = () => {
        clearTimeout(timeout);
        const MAX = 512;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.55));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Upload status bar ──
function showPhotoStatus(gridId, msg, type) {
  const statusId = gridId + '-status';
  let el = document.getElementById(statusId);
  if (!el) {
    el = document.createElement('div');
    el.id = statusId;
    el.style.cssText = 'font-size:0.72rem;color:#64748b;margin-top:5px;display:flex;align-items:center;gap:6px;min-height:18px;transition:opacity 0.3s';
    document.getElementById(gridId)?.parentElement?.appendChild(el);
  }
  if (!msg) { el.style.opacity='0'; return; }
  const colors = {loading:'#f59e0b', ok:'#16a34a', err:'#c8102e', warn:'#d97706'};
  const icons  = {loading:'⏳', ok:'✅', err:'❌', warn:'⚠️'};
  el.style.opacity='1';
  el.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span style="color:${colors[type]||'#64748b'}">${msg}</span>`;
  if (type === 'ok') setTimeout(() => { el.style.opacity='0'; }, 2500);
}

function previewPics(input, gridId, type) {
  const files = Array.from(input.files);
  if (!files.length) return;

  const current = pendingPhotos[type].length;
  const remaining = MAX_PHOTOS_PER_TYPE - current;
  if (remaining <= 0) {
    showPhotoStatus(gridId, `สูงสุด ${MAX_PHOTOS_PER_TYPE} รูป`, 'warn'); return;
  }
  const toProcess = files.slice(0, remaining);
  if (files.length > remaining) {
    showPhotoStatus(gridId, `เพิ่มได้อีก ${remaining} รูป (เกิน ${files.length - remaining} รูปถูกข้าม)`, 'warn');
  }

  let done = 0;
  const total = toProcess.length;
  // แสดง progress bar
  const pct = () => Math.round((done / total) * 100);
  showPhotoStatus(gridId, `⏳ กำลังโหลด 0% (0/${total})`, 'loading');
  _photoLoading += total;

  toProcess.forEach(f => {
    compressPhoto(f).then(data => {
      pendingPhotos[type].push(data);
      done++;
      _photoLoading = Math.max(0, _photoLoading - 1); // guard: ไม่ให้ติดลบ
      if (done < total) {
        showPhotoStatus(gridId, `⏳ กำลังโหลด ${pct()}% (${done}/${total})`, 'loading');
      } else {
        showPhotoStatus(gridId, `✅ โหลดสำเร็จ ${done} รูป — เหลือ ${MAX_PHOTOS_PER_TYPE - pendingPhotos[type].length} ช่อง`, 'ok');
      }
      renderPhotoGrid(gridId, pendingPhotos[type], type);
    }).catch(() => {
      _photoLoading = Math.max(0, _photoLoading - 1); // guard: ไม่ให้ติดลบ
      done++;
      showPhotoStatus(gridId, '⚠️ บีบอัดรูปไม่สำเร็จ 1 รูป', 'err');
    });
  });
  input.value = '';
}

function renderPhotoGrid(gridId, photos, type) {
  const el = document.getElementById(gridId);
  if (!el) return;
  el.innerHTML = photos.map((p,i) => `
    <div class="pg-item" style="animation:fadeIn 0.25s ease">
      <img src="${p}" onclick="openLightbox('${p}')"/>
      <button class="pg-del" onclick="removePic(${i},'${gridId}','${type}')">✕</button>
    </div>`).join('');
  // Show slot count
  const statusId = gridId + '-status';
  const statusEl = document.getElementById(statusId);
  if (statusEl && photos.length > 0) {
    statusEl.style.opacity='1';
    statusEl.innerHTML = `<span style="color:#64748b">📷 ${photos.length}/${MAX_PHOTOS_PER_TYPE} รูป${photos.length===MAX_PHOTOS_PER_TYPE?' (เต็มแล้ว)':''}</span>`;
  }
}
function removePic(i, gridId, type) {
  pendingPhotos[type].splice(i,1);
  renderPhotoGrid(gridId, pendingPhotos[type], type);
}
function openLightbox(src) { document.getElementById('lb-img').src=src; document.getElementById('lightbox').classList.add('open'); }

// ── Photo action sheet — เลือก "ถ่ายรูป" หรือ "เลือกจากแกลเลอรี" ──
function openPhotoAfterSheet() {
  // ถ้าไม่ใช่ iOS / mobile ให้เปิด gallery เลย
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (!isIOS && !isMobile) { document.getElementById('c-pics').click(); return; }

  // ลบ sheet เก่าถ้ามี
  document.getElementById('_photo-action-sheet')?.remove();
  document.getElementById('_photo-action-overlay')?.remove();

  const ov = document.createElement('div');
  ov.id = '_photo-action-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:99998;animation:fadeIn 0.15s ease';
  ov.onclick = () => { ov.remove(); sheet.remove(); };

  const sheet = document.createElement('div');
  sheet.id = '_photo-action-sheet';
  sheet.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:white;border-radius:20px 20px 0 0;padding:16px 16px calc(env(safe-area-inset-bottom,0px)+16px);font-family:inherit;animation:slideUp 0.25s cubic-bezier(0.32,0.72,0,1)';
  sheet.innerHTML = `
    <div style="width:40px;height:4px;background:#e2e8f0;border-radius:2px;margin:0 auto 16px"></div>
    <div style="font-size:0.85rem;font-weight:800;color:#374151;margin-bottom:14px;text-align:center">เลือกรูปหลังซ่อม</div>
    <button id="_ps-cam" style="width:100%;padding:16px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:14px;font-size:0.92rem;font-weight:700;color:#15803d;cursor:pointer;font-family:inherit;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:10px;touch-action:manipulation">
      <span style="font-size:1.4rem">📷</span> ถ่ายรูป
    </button>
    <button id="_ps-gal" style="width:100%;padding:16px;background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:14px;font-size:0.92rem;font-weight:700;color:#0369a1;cursor:pointer;font-family:inherit;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:10px;touch-action:manipulation">
      <span style="font-size:1.4rem">🖼️</span> เลือกจากคลังรูป
    </button>
    <button id="_ps-cancel" style="width:100%;padding:14px;background:white;border:1.5px solid #e2e8f0;border-radius:14px;font-size:0.88rem;font-weight:700;color:#6b7280;cursor:pointer;font-family:inherit;touch-action:manipulation">ยกเลิก</button>`;

  document.body.appendChild(ov);
  document.body.appendChild(sheet);

  sheet.querySelector('#_ps-cam').onclick = () => {
    ov.remove(); sheet.remove();
    document.getElementById('c-pics-cam').click();
  };
  sheet.querySelector('#_ps-gal').onclick = () => {
    ov.remove(); sheet.remove();
    document.getElementById('c-pics').click();
  };
  sheet.querySelector('#_ps-cancel').onclick = () => { ov.remove(); sheet.remove(); };
}

function setPriority(val) {
  document.getElementById('nt-pri').value = val;
  const styles = {
    high: { border:'#ef4444', bg:'#fff5f5', shadow:'rgba(239,68,68,0.2)' },
    low:  { border:'#22c55e', bg:'#f0fdf4', shadow:'rgba(34,197,94,0.2)' },
  };
  ['high','low'].forEach(p => {
    const btn = document.getElementById('cs-pri-'+p) || document.getElementById('pri-'+p);
    if (!btn) return;
    const s = styles[p];
    const active = p === val;
    btn.style.borderColor = active ? s.border : '#e2e8f0';
    btn.style.background  = active ? s.bg : '#f8fafc';
    btn.style.transform   = active ? 'scale(1.04)' : 'scale(1)';
    btn.style.boxShadow   = active ? `0 4px 14px ${s.shadow}` : 'none';
    btn.style.opacity     = active ? '1' : '0.65';
  });
}

function showFormError(fieldId, msg) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  // Highlight
  el.style.borderColor = 'var(--accent)';
  el.style.boxShadow = '0 0 0 3px rgba(200,16,46,0.15)';
  el.style.animation = 'shake 0.3s ease';
  // Find best parent to attach error (fg, rg-fld, or direct parentNode)
  const parent = el.closest('.fg,.rg-fld,.form-group') || el.parentNode;
  const existing = parent.querySelector('.field-error');
  if (existing) existing.remove();
  const err = document.createElement('div');
  err.className = 'field-error';
  err.style.cssText = 'color:var(--accent);font-size:0.72rem;margin-top:5px;font-weight:700;display:flex;align-items:center;gap:4px;animation:fadeIn 0.2s ease';
  err.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ${msg}`;
  parent.appendChild(err);
  const clear = () => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
    el.style.animation = '';
    err.remove();
    el.removeEventListener('input', clear);
    el.removeEventListener('change', clear);
  };
  el.addEventListener('input', clear);
  el.addEventListener('change', clear);
  setTimeout(clear, 4000);
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

let _isSubmitting = false; // double-submit guard

async function submitTicket() { // PATCH v67
  if (_isSubmitting) return; // ป้องกันกด 2 ครั้ง

  // เคลียร์ error เก่า
  document.querySelectorAll('.field-error').forEach(e => e.remove());
  document.querySelectorAll('#pg-new input, #pg-new select, #pg-new textarea').forEach(e => e.style.borderColor = '');

  const deptEl = document.getElementById('nt-dept');
  const macEl  = document.getElementById('nt-mac');
  const probEl = document.getElementById('nt-prob');
  const mid    = macEl.value;
  const prob   = probEl.value.trim();

  let hasError = false;
  if (!deptEl.value) { showFormError('nt-dept', 'กรุณาเลือกแผนก'); hasError = true; }
  else if (!mid)     { showFormError('nt-mac',  'กรุณาเลือกเครื่องแอร์'); hasError = true; }
  if (!prob)         { showFormError('nt-prob', 'กรุณาระบุอาการที่พบ'); hasError = true; }

  // ถ้ารูปยังโหลดไม่เสร็จ → รอแล้ว retry อัตโนมัติ (ไม่ blocking ผู้ใช้)
  if (_photoLoading > 0) {
    const btn = document.getElementById('nt-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ กำลังโหลดรูป...'; }
    // ── PATCH audit-H2: timeout 15s ป้องกัน infinite interval ──
    const _photoDeadline = Date.now() + 15000;
    const retryTimer = setInterval(() => {
      const timedOut = Date.now() > _photoDeadline;
      if (_photoLoading <= 0 || timedOut) {
        clearInterval(retryTimer);
        _photoLoading = 0; // force reset
        if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" style="margin-right:6px"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>ส่งงานแจ้งซ่อม`; }
        if (timedOut) { showToast('⚠️ โหลดรูปช้า — ส่งงานโดยไม่รอรูปบางรูป'); }
        submitTicket();
      }
    }, 200);
    return;
  }

  if (hasError) { showToast('⚠️ กรุณากรอกข้อมูลที่จำเป็นให้ครบ'); return; }

  // ── ตรวจงานซ้ำ: เครื่องนี้มีงานค้างอยู่หรือไม่ ──
  const ACTIVE_STATUSES = ['new','assigned','accepted','inprogress','waiting_part'];
  const existingJobs = db.tickets.filter(t =>
    t.machineId === mid && ACTIVE_STATUSES.includes(t.status)
  );

  if (existingJobs.length > 0) {
    const m = db.machines.find(x=>x.id===mid);
    const latestJob = existingJobs.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0];
    const statusTH = {new:'🆕 รอจ่ายงาน',assigned:'📋 จ่ายงานแล้ว',accepted:'✋ รับงานแล้ว',inprogress:'⚙️ กำลังซ่อม',waiting_part:'⏳ รออะไหล่'};
    const jobList = existingJobs.slice(0,3).map(j =>
      `<div style="display:flex;align-items:center;gap:7px;padding:6px 0;border-bottom:1px solid #f1f5f9">
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.62rem;font-weight:800;color:#94a3b8">${j.id}</span>
        <span style="flex:1;font-size:0.75rem;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${j.problem}</span>
        <span style="font-size:0.62rem;color:#e65100;font-weight:700;white-space:nowrap">${statusTH[j.status]||j.status}</span>
      </div>`
    ).join('');

    showAlert({
      icon: '⚠️',
      title: 'มีงานค้างอยู่แล้ว!',
      color: '#e65100',
      msg: `<strong style="color:#0f172a">${m?.name||'เครื่องนี้'}</strong> มีงานซ่อมค้างอยู่ <strong style="color:#e65100">${existingJobs.length} งาน</strong><br>
        <div style="margin-top:10px;text-align:left;background:#f8fafc;border-radius:10px;padding:4px 10px">${jobList}</div>
        <div style="margin-top:10px;font-size:0.8rem;color:#64748b">ต้องการแจ้งงานใหม่เพิ่มเติมหรือไม่?</div>`,
      btnOk: '➕ แจ้งงานใหม่เพิ่ม',
      btnCancel: '← ดูงานเดิมก่อน',
      onOk: async () => { _isSubmitting = true; await _doSubmitTicket(mid, prob); _isSubmitting = false; }, // PATCH v67
      onCancel: () => {
        goPage('tickets');
        setTimeout(() => setFilter('machineId', mid), 200);
      }
    });
    return;
  }

  _isSubmitting = true;
  await _doSubmitTicket(mid, prob); // PATCH v67: await async upload
  _isSubmitting = false;
}

// ── PATCH v67: async เพื่อ await photo upload ──
async function _doSubmitTicket(mid, prob) {
  const m = db.machines.find(x=>x.id===mid);
  const _now = new Date();
  const _mm = String(_now.getMonth()+1).padStart(2,'0');
  const _yy = String(_now.getFullYear()).slice(-2); // 2 หลักท้าย เช่น 2025→25
  // สร้าง TK format: TK{YY}{MM}-{NNNN} เช่น TK2604-0001
  const _prefix = 'TK' + _yy + _mm; // เช่น TK2604
  // หาเลขลำดับสูงสุดของเดือนนี้จาก tickets ที่มีอยู่
  const _existSeq = (db.tickets||[])
    .map(t => t.id || '')
    .filter(id => id.startsWith(_prefix + '-'))
    .map(id => parseInt(id.slice(_prefix.length + 1)) || 0);
  const _nextSeq = (_existSeq.length > 0 ? Math.max(..._existSeq) : 0) + 1;
  const tid = _prefix + '-' + String(_nextSeq).padStart(4,'0');
  db._seq++; // ยังคง increment เพื่อ backward compat
  const now = nowStr();
  // ── PATCH v67: upload photos → Firebase Storage ก่อนสร้าง ticket ──
  try {
  if (typeof uploadPendingPhotosToStorage === 'function') {
    showToast('⏳ กำลัง upload รูปภาพ...');
    await uploadPendingPhotosToStorage(tid);
  }
  const t = {id:tid,machineId:mid,machine:m.name,problem:prob,detail:document.getElementById('nt-detail').value.trim(),priority:document.getElementById('nt-pri').value,status:'new',reporterId:CU.id,reporter:CU.name,assigneeId:null,assignee:null,createdAt:now,updatedAt:now,cost:0,summary:'',parts:'',note:document.getElementById('nt-note').value.trim(),contact:document.getElementById('nt-tel').value.trim(),photosBefore:[...pendingPhotos.before],photosAfter:[],history:[{act:'📢 แจ้งงาน',by:CU.name,at:now}]};
  db.tickets.push(t);
  notifyRole('admin','📢 แจ้งงานใหม่ ['+tid+']',CU.name+' แจ้ง: "'+prob+'" ที่ '+m.name,tid);
  showAdminCard('📢 แจ้งงานใหม่ ['+tid+']', CU.name+' แจ้ง: "'+prob+'"', tid, '📢');
  sendLineNotifyEvent('new', t);
  saveDB(); syncTicket(t);
  pendingPhotos = {before:[], after:[]};
  ['nt-prob','nt-detail','nt-note'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('nt-mac').value='';
  document.getElementById('nt-dept').value='';
  if (typeof resetDeptPicker === 'function') resetDeptPicker();
  document.getElementById('nt-room-wrap').style.display='none';
  document.getElementById('nt-equip-card').style.display='none';
  document.getElementById('nt-grid').innerHTML='';
  // reset photo previews
  ['before-grid','after-grid'].forEach(id => { const g = document.getElementById(id); if(g) g.innerHTML=''; });
  // reset prob chips
  document.querySelectorAll('.prob-chip').forEach(c => c.classList.remove('selected','active'));
  // reset priority to mid
  setTimeout(() => setPriority('mid'), 100);
  const telEl = document.getElementById('nt-tel');
  if(telEl) telEl.value = CU.tel || CU.phone || CU.contact || '';
  const repName = document.getElementById('nt-reporter-name');
  const repAvt  = document.getElementById('nt-reporter-avatar');
  if (repName) repName.textContent = CU.name;
  if (repAvt) {
    if (CU.photo) repAvt.innerHTML = `<img src="${CU.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    else repAvt.textContent = CU.name.slice(0,2);
  }
  if (navigator.vibrate) navigator.vibrate([100,50,100]);
  updateOpenBadge();

  // Success notification กลางจอ
  showAlert({
    icon: '✅',
    title: 'ส่งงานแจ้งซ่อมแล้ว!',
    color: '#16a34a',
    msg: `เลขที่ใบงาน <strong style="color:#0f172a;font-family:monospace">${tid}</strong><br>
      <span style="font-size:0.82rem;color:#64748b">${prob} · ${escapeHtml(m.name)}</span><br>
      <span style="font-size:0.78rem;color:#22c55e;font-weight:600">ระบบแจ้ง Admin แล้ว</span>`,
    btnOk: '🏠 กลับหน้าหลัก',
    onOk: () => { renderHome(); renderTickets(); goPage('home'); },
  });
  } catch(e) {
    console.error('[_doSubmitTicket] error:', e);
    db._seq--;
    showToast('❌ เกิดข้อผิดพลาด: ' + (e.message || 'กรุณาลองใหม่'));
  }
}

let selTechId = null;
function setAssignPriority(val) {
  document.getElementById('a-pri').value = val;
  const cfgs = {
    high: { activeBorder:'rgba(239,68,68,0.8)', activeBg:'rgba(239,68,68,0.22)', textActive:'#fca5a5', iconStroke:'#ef4444' },
    mid:  { activeBorder:'rgba(245,158,11,0.7)', activeBg:'rgba(245,158,11,0.18)', textActive:'#fde68a', iconStroke:'#fbbf24' },
    low:  { activeBorder:'rgba(255,255,255,0.4)', activeBg:'rgba(255,255,255,0.15)', textActive:'white', iconStroke:'rgba(255,255,255,0.8)' },
  };
  ['high','mid','low'].forEach(p => {
    const btn = document.getElementById('a-pri-'+p);
    if (!btn) return;
    const c = cfgs[p];
    const active = p === val;
    btn.style.borderColor  = active ? c.activeBorder : 'rgba(255,255,255,0.12)';
    btn.style.background   = active ? c.activeBg : 'rgba(255,255,255,0.06)';
    btn.style.transform    = active ? 'scale(1.04)' : 'scale(1)';
    btn.style.boxShadow    = active ? '0 2px 12px rgba(0,0,0,0.3)' : 'none';
    const textEl = btn.querySelector('span');
    if (textEl) textEl.style.color = active ? c.textActive : 'rgba(255,255,255,0.45)';
    const svgEl = btn.querySelector('svg');
    if (svgEl) {
      svgEl.style.opacity = active ? '1' : '0.35';
    }
  });
}
function openAssignSheet(tid) {
  document.getElementById('a-tid').value = tid;
  document.getElementById('a-note').value = '';
  // reset scheduled fields
  const sd = document.getElementById('a-sched-date');
  const st = document.getElementById('a-sched-time');
  if (sd) sd.value = '';
  if (st) st.value = '';
  selTechId = null;
  const _at = db.tickets.find(x=>x.id===tid);
  // แสดง ticket label
  const lbl = document.getElementById('assign-ticket-label');
  if (lbl && _at) lbl.textContent = _at.id + ' · ' + (_at.problem||'');
  setTimeout(()=>setAssignPriority(_at?.priority||'mid'), 50);
  document.getElementById('tech-list').innerHTML = db.users.filter(u=>u.role==='tech').map(u=>{
    const cnt = db.tickets.filter(t=>t.assigneeId===u.id&&!['closed','verified','done'].includes(t.status)).length;
    const isSelected = _at?.assigneeId === u.id;

    // workload level
    const wLevel = cnt === 0 ? 'free' : cnt <= 2 ? 'ok' : cnt <= 4 ? 'busy' : 'full';
    const wCfg = {
      free: { bar:'#22c55e', barW:'0%',    badge:'ว่าง',     badgeBg:'#dcfce7', badgeColor:'#166534', bdr:'#bbf7d0' },
      ok:   { bar:'#22c55e', barW:`${cnt*20}%`, badge:`${cnt} งาน`, badgeBg:'#f0fdf4', badgeColor:'#15803d', bdr:'#bbf7d0' },
      busy: { bar:'#f59e0b', barW:`${cnt*15}%`, badge:`${cnt} งาน`, badgeBg:'#fffbeb', badgeColor:'#92400e', bdr:'#fde68a' },
      full: { bar:'#ef4444', barW:'100%',   badge:`${cnt} งาน`, badgeBg:'#fef2f2', badgeColor:'#b91c1c', bdr:'#fecaca' },
    }[wLevel];

    // avatar
    const avatar = u.photo
      ? `<img src="${u.photo}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2.5px solid ${isSelected?'#c8102e':'#e2e8f0'};flex-shrink:0">`
      : `<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,${isSelected?'#9b0b22,#c8102e':'#475569,#334155'});display:flex;align-items:center;justify-content:center;flex-shrink:0;border:2.5px solid ${isSelected?'#c8102e':'transparent'}">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>`;

    return `<div class="tech-item${isSelected?' sel':''}" id="tc-${u.id}" onclick="pickTech('${u.id}')"
      style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:16px;border:2px solid ${isSelected?'#c8102e':'#e5e7eb'};background:${isSelected?'linear-gradient(135deg,#fff0f2,#ffe4e8)':'white'};cursor:pointer;transition:all 0.18s;touch-action:manipulation;box-shadow:${isSelected?'0 4px 16px rgba(200,16,46,0.2)':'0 1px 4px rgba(0,0,0,0.04)'}">
      ${avatar}
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">
          <div style="font-size:0.92rem;font-weight:800;color:${isSelected?'#9b0b22':'#0f172a'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.name}</div>
          <span style="flex-shrink:0;font-size:0.6rem;font-weight:800;padding:2px 8px;border-radius:99px;background:${wCfg.badgeBg};color:${wCfg.badgeColor};border:1px solid ${wCfg.bdr}">${wCfg.badge}</span>
          ${isSelected?`<span style="flex-shrink:0;font-size:0.6rem;font-weight:800;padding:2px 8px;border-radius:99px;background:#ffe4e8;color:#9b0b22;border:1px solid #fca5a5">✓ เลือกแล้ว</span>`:''}
        </div>
        <div style="font-size:0.72rem;color:${isSelected?'#c8102e':'#64748b'};margin-bottom:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${u.dept||'ช่างเทคนิค'}
        </div>
        <!-- Workload bar -->
        <div style="background:#f1f5f9;border-radius:99px;height:5px;overflow:hidden">
          <div style="height:100%;width:${wCfg.barW};background:${wCfg.bar};border-radius:99px;transition:width 0.4s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:3px">
          <div style="font-size:0.58rem;color:#94a3b8">ภาระงาน</div>
          <div style="font-size:0.58rem;color:${wCfg.badgeColor};font-weight:700">${cnt===0?'ว่าง':cnt<=2?'ปกติ':cnt<=4?'เยอะ':'หนักมาก'}</div>
        </div>
      </div>
    </div>`;
  }).join('');
  openSheet('assign');
}
function pickTech(id) {
  selTechId = id;
  document.querySelectorAll('.tech-item').forEach(card => {
    const selected = card.id === 'tc-'+id;
    card.classList.toggle('sel', selected);
    card.style.borderColor = selected ? '#c8102e' : '#e5e7eb';
    card.style.background  = selected ? 'linear-gradient(135deg,#fff0f2,#ffe4e8)' : 'white';
    card.style.boxShadow   = selected ? '0 4px 16px rgba(200,16,46,0.2)' : '0 1px 4px rgba(0,0,0,0.04)';
    // update avatar border
    const img = card.querySelector('img');
    if (img) img.style.borderColor = selected ? '#c8102e' : '#e2e8f0';
    const avatarDiv = card.querySelector('div[style*="border-radius:50%"]');
    if (avatarDiv && !img) avatarDiv.style.border = selected ? '2.5px solid #c8102e' : '2.5px solid transparent';
    // update name color
    const nameEl = card.querySelector('div[style*="font-weight:800"]');
    if (nameEl) nameEl.style.color = selected ? '#9b0b22' : '#0f172a';
  });
}
function doAssign() {
  if (!selTechId) {
    showToast('⚠️ กรุณาเลือกช่างก่อน');
    // shake tech-list
    const tl = document.getElementById('tech-list');
    if (tl) { tl.style.animation='shake 0.3s ease'; setTimeout(()=>tl.style.animation='',350); }
    return;
  }
  const tid = document.getElementById('a-tid').value;
  if (!tid) { showToast('⚠️ ไม่พบหมายเลขงาน'); return; }
  const note = document.getElementById('a-note')?.value.trim() || '';
  const t = db.tickets.find(x=>x.id===tid); if(!t){ showToast('⚠️ ไม่พบงาน'); return; }
  const tech = db.users.find(u=>u.id===selTechId);
  if (!tech) { showToast('⚠️ ไม่พบข้อมูลช่าง'); return; }
  const now = nowStr();
  const newPri = document.getElementById('a-pri')?.value || t.priority || 'mid';
  const schedDate = document.getElementById('a-sched-date')?.value || '';
  const schedTime = document.getElementById('a-sched-time')?.value || '';
  const schedAt = schedDate ? (schedDate + (schedTime ? ' ' + schedTime : '')) : '';
  t.assigneeId=selTechId; t.assignee=tech.name; t.status='assigned'; t.updatedAt=now; t.priority=newPri; if(note)t.note=note;
  if (schedAt) t.scheduledAt = schedAt;
  const schedNote = schedAt ? ` · นัดหมาย ${schedDate}${schedTime?' '+schedTime:''}` : '';
  t.history.push({act:'📋 จ่ายงาน'+schedNote,by:CU.name,at:now,detail:note||''});
  notifyUser(selTechId,'📋 มีงานมอบหมาย ['+tid+']','งาน "'+t.problem+'" ที่ '+t.machine+(schedAt?' · นัดหมาย '+schedAt:''),tid);
  notifyUser(t.reporterId,'✅ งานรับเข้าระบบ','มอบหมายให้ '+tech.name+' ดูแลแล้ว',tid);
  sendLineNotifyEvent('new', t);
  saveDB(); syncTicket(t);
  closeSheet('assign');
  refreshPage();
  showToast('✅ จ่ายงานให้ '+tech.name+' แล้ว');
  if (navigator.vibrate) navigator.vibrate([100,30,100]);
  setTimeout(()=>setAssignPriority('mid'),100);
  selTechId = null;
}

function doAccept(tid) {
  const t = db.tickets.find(x=>x.id===tid); if(!t)return;
  const now = nowStr();
  t.status = 'inprogress';   // รับงาน = เริ่มซ่อมทันที
  t.updatedAt = now;
  t.startedAt = t.startedAt || now;
  t.history.push({act:'✋ รับงาน',by:CU.name,at:now});
  t.history.push({act:'🔧 เริ่มซ่อม',by:CU.name,at:now});
  notifyUser(t.reporterId,'🔧 ช่างรับงานและเริ่มซ่อมแล้ว','ช่าง '+CU.name+' รับและเริ่มดำเนินการ ['+tid+'] แล้ว',tid);
  notifyRole('admin','🔧 ช่างเริ่มซ่อม',CU.name+' รับและเริ่ม ['+tid+']',tid);
  showAdminCard('🔧 ช่างเริ่มซ่อม', CU.name+' รับงานและเริ่มซ่อม ['+tid+'] แล้ว', tid, '🔧');

  // ── Auto-add to calendar ──────────────────────
  if (!db.calEvents) db.calEvents = [];
  if (!db.chats) db.chats = {};
  const today = fmtDate(new Date());
  // avoid duplicate for same ticket+date
  const dupCheck = db.calEvents.find(e => e.ticketId === tid && e.date === today);
  if (!dupCheck) {
    db.calEvents.push({
      id:         'cev_tk_' + tid + '_' + Date.now(),
      type:       'repair',
      date:       today,
      title:      '[' + tid + '] ' + t.problem,
      dept:       '',
      start:      '08:00',
      end:        '17:00',
      machineId:  t.machineId || '',
      machine:    t.machine || '',
      techId:     CU.id,
      tech:       CU.name,
      note:       t.detail || '',
      ticketId:   tid,
      autoAdded:  true,
      createdBy:  CU.name,
      createdAt:  now,
    });
  }

  saveDB(); syncTicket(t); refreshPage();
  sendLineNotifyEvent('accept', t);
  if (navigator.vibrate) navigator.vibrate(100);
}

function doStart(tid) {
  const t = db.tickets.find(x=>x.id===tid); if(!t)return;
  const now = nowStr(); t.status='inprogress'; t.updatedAt=now;
  t.history.push({act:'🔧 เริ่มซ่อม',by:CU.name,at:now});
  t.startedAt = now;
  notifyUser(t.reporterId,'🔧 เริ่มซ่อมแล้ว','ช่าง '+CU.name+' เริ่มดำเนินการ ['+tid+'] แล้ว',tid);
  saveDB(); syncTicket(t); refreshPage();
  sendLineNotifyEvent('start', t);
  // เริ่ม timer อัตโนมัติ
}


// ══ WP Parts chip functions (global) ══

function syncJobTypeChecks() {} // compat

// ช่างกดแจ้ง — ส่งให้ admin ทันที ไม่มี popup
function requestWaitPart(tid) {
  const t = db.tickets.find(x=>x.id===tid); if(!t) return;
  const now = nowStr();
  if (t.status !== 'waiting_part') {
    t.status = 'waiting_part';
    t.updatedAt = now;
    if (!t.waitPart) t.waitPart = { items:'', requestedAt:now, requestedBy:CU.name };
    t.history.push({act:'⏳ แจ้งรอสั่งซื้ออะไหล่',by:CU.name,at:now});
    notifyRole('admin','⏳ รอสั่งซื้ออะไหล่ ['+tid+']','ช่าง '+CU.name+' แจ้งรอสั่งซื้อ — กรุณาดำเนินการ',tid);
    showAdminCard('⏳ รออะไหล่ ['+tid+']', CU.name+' แจ้งรอสั่งซื้อ', tid, '⏳');
    saveDB(); syncTicket(t);
    showToast('✅ แจ้ง Admin เรียบร้อยแล้ว');
    renderTickets();
  } else {
    showToast('ℹ️ แจ้งแล้ว กำลังรอ Admin ดำเนินการ');
  }
}

// admin กดยืนยันว่ากำลังสั่งซื้อ
function markPurchasing(tid) {
  const t = db.tickets.find(x=>x.id===tid); if(!t) return;
  const now = nowStr();
  if (!t.purchaseOrder) t.purchaseOrder = { mowr:'', pr:'', po:'', rows:[], total:0, note:'', receiveStatus:'pending', savedAt:now, savedBy:CU.name };
  t.purchaseOrder.purchasing = true;
  t.purchaseOrder.purchasingAt = now;
  t.purchaseOrder.purchasingBy = CU.name;
  t.updatedAt = now;
  t.history.push({act:'🛒 กำลังดำเนินการสั่งซื้ออะไหล่',by:CU.name,at:now});
  notifyUser(t.assigneeId,'🛒 Admin ดำเนินการสั่งซื้อแล้ว ['+tid+']','กำลังดำเนินการสั่งซื้ออะไหล่ — รอรับของ',tid);
  if (t.reporterId) notifyUser(t.reporterId,'🛒 อะไหล่กำลังถูกสั่งซื้อ ['+tid+']','Admin กำลังดำเนินการสั่งซื้ออะไหล่',tid);
  saveDB(); syncTicket(t);
  showToast('✅ แจ้งช่างและผู้แจ้งแล้ว');
  renderTickets();
}

function openWaitPartSheet(tid) {
  // legacy — redirect to requestWaitPart
  requestWaitPart(tid);
}



// ══ PO / Purchase Order Form ══
let _poTid = '';
let _poRows = [];
function openPOForm(tid) {
  _poTid = tid;
  const t = db.tickets.find(x=>x.id===tid);
  const saved = t?.purchaseOrder || {};
  const mac = t ? getMacMap().get(t.machineId) : null;
  const _poSer = mac?.serial || '';

  // Fill header info
  document.getElementById('po-tid-label').textContent = tid + (t ? ' · ' + t.problem : '');
  const machineNameEl = document.getElementById('po-machine-name');
  const machineSerialEl = document.getElementById('po-machine-serial');
  if (machineNameEl) machineNameEl.textContent = t?.machine || '—';
  if (machineSerialEl) machineSerialEl.textContent = _poSer ? _poSer + (mac?.btu ? ' · '+Number(mac.btu).toLocaleString()+' BTU' : '') : '';

  document.getElementById('po-mowr').value = saved.mowr || '';
  const poPoEl = document.getElementById('po-po'); if (poPoEl) poPoEl.value = saved.po || '';
  document.getElementById('po-note').value = saved.note || '';

  const techRows = (t?.techRequest?.rows||[]).filter(r=>r.name && r.name.trim());
  const savedRows = (saved.rows||[]).filter(r=>r.name && r.name.trim());
  const techLocked = !!(t?.techRequest?.locked); // ช่างส่งมาแล้ว

  // ตรวจสอบว่าข้อมูลช่างครบไหม (ต้องมีชื่อ + จำนวน + ราคา > 0 ทุก row)
  const techRowsComplete = techLocked && techRows.length > 0 && techRows.every(r => r.name?.trim() && (r.qty||0) >= 1 && (r.price||0) > 0);
  const hasAnyTechData = techLocked && techRows.length > 0; // แสดง warning เฉพาะเมื่อช่างส่งมาแล้ว

  // Admin ดูได้ แต่ lock ชื่อ/จำนวน/ราคา ถ้ามาจาก techRequest
  // ถ้าข้อมูลไม่ครบ → แสดง warning + ปุ่มแจ้งช่าง
  _poRows = savedRows.length
    ? savedRows.map(r=>({name:r.name||'',qty:r.qty||1,price:Math.min(Number(r.price)||0,9999999),pr:r.pr||'',po:r.po||'',_fromTech:false}))
    : techRows.length
      ? techRows.map(r=>({name:r.name||'',qty:r.qty||1,price:Math.min(Number(r.price)||0,9999999),pr:r.pr||'',po:r.po||'',_fromTech:true}))
      : [{name:'',qty:1,price:0,pr:'',po:'',_fromTech:false}];

  // flag global ว่า rows นี้มาจากช่าง (lock name/qty/price)
  // lock เฉพาะเมื่อ: มี techRows + ยังไม่มี savedRows (admin ยังไม่ยืนยัน)
  window._poFromTech = techRows.length > 0 && !savedRows.length;
  window._poTechComplete = techRowsComplete;
  window._poHasTechData = hasAnyTechData;

  const showPOPanel = () => {
    const lp = document.getElementById('pur-list-panel');
    const pp = document.getElementById('pur-po-panel');
    if (lp) lp.style.display = 'none';
    if (pp) {
      pp.style.display = 'flex';
      pp.style.flexDirection = 'column';
      // ── Android keyboard fix for PO panel ──
      if (window.visualViewport && !pp._kbBound) {
        pp._kbFix = () => {
          if (pp.style.display === 'none') return;
          const vvh = window.visualViewport.height;
          const pg = document.getElementById('pg-purchase');
          if (pg) pg.style.height = vvh + 'px';
        };
        window.visualViewport.addEventListener('resize', pp._kbFix);
        pp._kbBound = true;
      }
    }

    // ── Warning / Info banner ── ต้องทำหลัง panel แสดงเพื่อให้ DOM พร้อม
    const poBody = document.getElementById('po-body');
    const warnEl = document.getElementById('po-tech-warn');
    if (warnEl) {
      if (hasAnyTechData && !techRowsComplete && !savedRows.length) {
        // ข้อมูลไม่ครบ — warning + ปุ่มแจ้งช่าง
        warnEl.innerHTML = `
          <div style="background:linear-gradient(135deg,#fef2f2,#fee2e2);border:1.5px solid #fca5a5;border-radius:14px;padding:14px 16px;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <span style="font-size:1.2rem">⚠️</span>
              <div>
                <div style="font-size:0.82rem;font-weight:800;color:#991b1b">รายการของช่างไม่ครบถ้วน</div>
                <div style="font-size:0.7rem;color:#b91c1c;margin-top:2px">ชื่ออะไหล่ / จำนวน / ราคา ต้องครบทุกรายการ</div>
              </div>
            </div>
            <div style="background:white;border-radius:10px;padding:10px 12px;margin-bottom:10px">
              ${techRows.map((r,i)=>{
                const missingFields = [];
                if(!r.name?.trim()) missingFields.push('ชื่ออะไหล่');
                if(!(r.qty>=1)) missingFields.push('จำนวน');
                if(!(r.price>0)) missingFields.push('ราคา');
                const ok = missingFields.length === 0;
                return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;${i>0?'border-top:1px solid #f8fafc':''}">
                  <span style="width:20px;height:20px;border-radius:6px;background:${ok?'#dcfce7':'#fee2e2'};color:${ok?'#16a34a':'#dc2626'};font-size:0.7rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span>
                  <span style="flex:1;font-size:0.78rem;font-weight:600;color:#374151">${r.name||'(ไม่มีชื่อ)'}</span>
                  ${!ok?`<span style="font-size:0.62rem;color:#dc2626;font-weight:700">ขาด: ${missingFields.join(', ')}</span>`:'<span style="font-size:0.68rem;color:#16a34a;font-weight:700">✓ ครบ</span>'}
                </div>`;
              }).join('')}
            </div>
            <button onclick="notifyTechToResubmit('${tid}');closePOInline()"
              style="width:100%;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:white;font-size:0.82rem;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:7px">
              🔔 แจ้งช่างให้กรอกรายการใหม่
            </button>
          </div>`;
        warnEl.style.display = 'block';
      } else if (hasAnyTechData && techRowsComplete && !savedRows.length) {
        // ข้อมูลครบ — info banner สีเขียว
        warnEl.innerHTML = `
          <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #86efac;border-radius:12px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
            <span style="font-size:1rem">✅</span>
            <div>
              <div style="font-size:0.78rem;font-weight:800;color:#166534">รายการจากช่างครบถ้วน</div>
              <div style="font-size:0.65rem;color:#15803d">กรอกเฉพาะ MO/PR/PO Number แล้วบันทึก — ชื่อ/จำนวน/ราคาแก้ไขไม่ได้</div>
            </div>
          </div>`;
        warnEl.style.display = 'block';
      } else {
        warnEl.style.display = 'none';
      }
    }

    renderPORows();
    // ซ่อนปุ่ม "เพิ่มรายการ" และปุ่มลบ ถ้า lock mode
    const addBtn = document.querySelector('#pur-po-panel button[onclick="addPORow()"]');
    if (addBtn) addBtn.style.display = window._poFromTech ? 'none' : '';
  };

  // แสดง panel
  const purPage = document.getElementById('pg-purchase');
  const purActive = purPage && purPage.classList.contains('active');
  if (purActive) {
    showPOPanel();
  } else {
    goPage('purchase');
    setTimeout(showPOPanel, 80); // รอให้ page switch เสร็จก่อน
  }
}
function savePODraft() {
  const t = db.tickets.find(x=>x.id===_poTid); if (!t) return;
  const rows = _poRows.filter(r=>r.name.trim());
  if (!rows.length) { showToast('⚠️ กรุณาเพิ่มรายการอะไหล่อย่างน้อย 1 รายการ'); return; }
  const total = rows.reduce((s,r)=>s+(r.qty||1)*(r.price||0), 0);
  const prList = [...new Set(rows.map(r=>r.pr).filter(Boolean))].join(', ');
  // บันทึกเป็น draft — ไม่ set purchasing = true ไม่แจ้งช่าง
  t.purchaseOrder = {
    mowr:          document.getElementById('po-mowr').value.trim(),
    pr:            prList,
    po:            '',
    note:          document.getElementById('po-note').value.trim(),
    rows:          rows.map(r=>({name:r.name,qty:r.qty||1,price:r.price||0,pr:r.pr||'',po:r.po||''})),
    total,
    receiveStatus: t.purchaseOrder?.receiveStatus || 'pending',
    receivedAt:    t.purchaseOrder?.receivedAt    || '',
    receivedBy:    t.purchaseOrder?.receivedBy    || '',
    purchasing:    false,   // draft = ยังไม่สั่งซื้อ
    isDraft:       true,
    savedAt:       nowStr(),
    savedBy:       CU.name,
  };
  t.partsCost=total; t.cost=(Number(t.repairCost)||0) + Number(total);
  t.updatedAt = nowStr();
  t.history = t.history||[];
  t.history.push({act:'📝 บันทึกร่างใบสั่งซื้อ'+(prList?' PR:'+prList:''), by:CU.name, at:nowStr()});
  saveDB(); syncTicket(t);
  // แสดง draft badge
  const badge = document.getElementById('po-draft-badge');
  if (badge) { badge.style.display='flex'; }
  showToast('📝 บันทึกร่างแล้ว — กด "บันทึกและแจ้งช่าง" เมื่อพร้อม');
}

function confirmSavePOForm() {
  const t = db.tickets.find(x=>x.id===_poTid); if (!t) return;
  const rows = _poRows.filter(r=>r.name.trim());
  if (!rows.length) { showToast('⚠️ กรุณาเพิ่มรายการอะไหล่อย่างน้อย 1 รายการ'); return; }
  // ── ตรวจสอบ PR ทุกแถว ──
  const missingPR = rows.filter(r => !r.pr || !r.pr.trim());
  if (missingPR.length > 0) {
    showToast('⚠️ กรุณากรอกเลข PR ให้ครบทุกรายการก่อนยืนยัน');
    // highlight ช่อง PR ที่ว่าง
    const wrap = document.getElementById('po-rows-wrap');
    if (wrap) {
      const prInputs = wrap.querySelectorAll('.po-pr-input');
      prInputs.forEach((inp, i) => {
        if (!rows[i]?.pr?.trim()) {
          inp.style.borderColor = '#c8102e';
          inp.focus();
          setTimeout(()=>{ inp.style.borderColor = ''; }, 2000);
        }
      });
    }
    return;
  }
  const total = rows.reduce((s,r)=>s+(r.qty||1)*(r.price||0), 0);
  const prList = [...new Set(rows.map(r=>r.pr).filter(Boolean))].join(', ');
  const mac = getMacMap().get(t.machineId);
  const serial = mac?.serial || '';

  // สร้าง modal สวยงาม แทน native confirm
  const existing = document.getElementById('_po_confirm_modal');
  if (existing) existing.remove();

  const ov = document.createElement('div');
  ov.id = '_po_confirm_modal';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9600;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px';

  const box = document.createElement('div');
  box.style.cssText = 'background:white;border-radius:24px;width:100%;max-width:400px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.25);animation:popIn 0.22s cubic-bezier(0.34,1.56,0.64,1)';

  const itemRows = rows.map((r,i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;${i>0?'border-top:1px solid #f1f5f9':''}">
      <div style="width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,#e65100,#c2410c);color:white;font-size:0.58rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.82rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.name}</div>
        <div style="font-size:0.68rem;color:#94a3b8;margin-top:1px">×${r.qty||1} ชิ้น${r.pr?` · <span style="color:#e65100;font-weight:700">PR: ${r.pr}</span>`:''}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:0.82rem;font-weight:800;color:#e65100">฿${((r.qty||1)*(r.price||0)).toLocaleString()}</div>
      </div>
    </div>`).join('');

  box.innerHTML = `
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#e65100,#c2410c);padding:18px 20px 16px;position:relative;overflow:hidden">
      <div style="position:absolute;right:-16px;top:-16px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.08)"></div>
      <div style="display:flex;align-items:center;gap:12px;position:relative">
        <div style="width:44px;height:44px;background:rgba(255,255,255,0.18);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;border:1.5px solid rgba(255,255,255,0.25)">📋</div>
        <div>
          <div style="font-size:1rem;font-weight:900;color:white;letter-spacing:0.01em">ยืนยันออกใบสั่งซื้อ</div>
          <div style="font-size:0.7rem;color:rgba(255,255,255,0.75);margin-top:2px">${t.id} · ${escapeHtml(t.problem)}</div>
        </div>
      </div>
    </div>

    <!-- Machine info -->
    <div style="background:#fff7ed;border-bottom:1px solid #fed7aa;padding:10px 18px;display:flex;align-items:center;gap:8px">
      <span style="font-size:0.95rem">❄️</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.75rem;font-weight:700;color:#92400e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.machine||'—'}</div>
        ${serial?`<div style="font-size:0.65rem;color:#c2410c;font-family:'JetBrains Mono',monospace;font-weight:700">${serial}</div>`:''}
      </div>
      <div style="font-size:0.65rem;color:#94a3b8">${nowStr().slice(0,10)}</div>
    </div>

    <!-- Items -->
    <div style="padding:12px 18px;max-height:240px;overflow-y:auto">
      <div style="font-size:0.65rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">รายการอะไหล่ (${rows.length} รายการ)</div>
      ${itemRows}
    </div>

    <!-- Total + PR -->
    <div style="margin:0 18px 14px;background:linear-gradient(135deg,#fff7ed,#fef3c7);border:1.5px solid #fed7aa;border-radius:14px;padding:12px 14px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:0.65rem;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.05em">มูลค่ารวมทั้งหมด</div>
          <div style="font-size:1.6rem;font-weight:900;color:#e65100;line-height:1;margin-top:3px">฿${total.toLocaleString()}</div>
        </div>
        ${prList?`<div style="text-align:right"><div style="font-size:0.6rem;color:#92400e;font-weight:600;margin-bottom:3px">เลข PR</div><div style="background:#e65100;color:white;border-radius:8px;padding:4px 10px;font-size:0.75rem;font-weight:800;letter-spacing:0.04em">${prList}</div></div>`:''}
      </div>
    </div>

    <!-- Notice -->
    <div style="margin:0 18px 16px;background:#eff6ff;border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:7px">
      <span style="font-size:0.9rem;flex-shrink:0">📣</span>
      <span style="font-size:0.72rem;color:#1d4ed8;line-height:1.5">ระบบจะ<strong>แจ้งช่างและผู้แจ้งงานทันที</strong>หลังยืนยัน</span>
    </div>

    <!-- Buttons -->
    <div style="display:flex;gap:8px;padding:0 18px 20px">
      <button onclick="document.getElementById('_po_confirm_modal').remove()"
        style="flex:1;padding:13px;background:#f1f5f9;color:#64748b;border:none;border-radius:14px;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.15s"
        onmousedown="this.style.background='#e2e8f0'" onmouseup="this.style.background='#f1f5f9'">
        ยกเลิก
      </button>
      <button onclick="document.getElementById('_po_confirm_modal').remove();savePOForm()"
        style="flex:2;padding:13px;background:linear-gradient(135deg,#e65100,#c2410c);color:white;border:none;border-radius:14px;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 16px rgba(230,81,0,0.4);display:flex;align-items:center;justify-content:center;gap:6px"
        onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform=''">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ยืนยันออก PR
      </button>
    </div>`;

  ov.appendChild(box);
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if(e.target===ov) ov.remove(); });
}

function savePOForm() {
  const t = db.tickets.find(x=>x.id===_poTid); if (!t) return;
  const rows = _poRows.filter(r=>r.name.trim());
  if (!rows.length) { showToast('⚠️ กรุณาเพิ่มรายการอะไหล่อย่างน้อย 1 รายการ'); return; }
  const total   = rows.reduce((s,r)=>s+(r.qty||1)*(r.price||0), 0);
  const isNew   = !t.purchaseOrder;
  const prList  = [...new Set(rows.map(r=>r.pr).filter(Boolean))].join(', ');
  t.purchaseOrder = {
    mowr:          document.getElementById('po-mowr').value.trim(),
    pr:            prList,
    po:            document.getElementById('po-po')?.value.trim() || '',
    note:          document.getElementById('po-note').value.trim(),
    rows:          rows.map(r=>({name:r.name,qty:r.qty||1,price:r.price||0,pr:r.pr||'',po:r.po||''})),
    total,
    receiveStatus: t.purchaseOrder?.receiveStatus || 'pending',
    receivedAt:    t.purchaseOrder?.receivedAt    || '',
    receivedBy:    t.purchaseOrder?.receivedBy    || '',
    purchasing:    t.purchaseOrder?.purchasing    || false,
    savedAt:       nowStr(),
    savedBy:       CU.name,
  };
  t.partsCost=total; t.cost=(Number(t.repairCost)||0) + Number(total);
  t.updatedAt = nowStr();
  t.history = t.history||[];
  // ตั้ง purchasing = true ทันทีเมื่อบันทึก
  t.purchaseOrder.purchasing    = true;
  t.purchaseOrder.purchasingAt  = nowStr();
  t.purchaseOrder.purchasingBy  = CU.name;
  t.history.push({act:(isNew?'🛒 ออก PR / สั่งซื้ออะไหล่':'✏️ แก้ไขใบสั่งซื้อ')+(prList?' PR:'+prList:''), by:CU.name, at:nowStr()});
  // แจ้งช่าง + ผู้แจ้ง
  const msgParts = rows.map(r=>r.name+(r.pr?' (PR:'+r.pr+')':'')).join(', ');
  const notifyMsg = 'ออก PR สั่งซื้ออะไหล่แล้ว'+(prList?' — PR: '+prList:'')+' รวม ฿'+total.toLocaleString();
  if (t.assigneeId)  notifyUser(t.assigneeId,  '🛒 สั่งซื้ออะไหล่แล้ว ['+_poTid+']', notifyMsg+' · '+msgParts, _poTid);
  if (t.reporterId && t.reporterId !== t.assigneeId) notifyUser(t.reporterId, '🛒 สั่งซื้ออะไหล่แล้ว ['+_poTid+']', notifyMsg, _poTid);
  notifyRole('admin', '🛒 ออกใบสั่งซื้อแล้ว ['+_poTid+']', (isNew?'ออก PR ใหม่':'แก้ไข PR')+' — '+notifyMsg+' · '+msgParts, _poTid);
  saveDB(); syncTicket(t);
  closePOInline();
  updateOpenBadge();
  showToast('🛒 ออก PR สั่งซื้ออะไหล่แล้ว'+(prList?' — PR: '+prList:''));
}
function closePOModal() { closePOInline(); }
function closePOInline() {
  const pp = document.getElementById('pur-po-panel');
  const lp = document.getElementById('pur-list-panel');
  if (pp) pp.style.display = 'none';
  if (lp) { lp.style.display = 'flex'; lp.style.flexDirection = 'column'; }
  // reset header bar เพื่อให้ renderPurchase สร้างใหม่ได้
  const hb = document.getElementById('pur-header-bar');
  if (hb) hb.innerHTML = '';
  setPurchaseTab('order');
}
function addPORow() {
  _poRows.push({name:'',qty:1,price:0,pr:'',po:''});
  const wrap = document.getElementById('po-rows-wrap');
  if (!wrap) { renderPORows(); return; }
  const newRow = buildPORow(_poRows.length - 1);
  wrap.appendChild(newRow);
  updatePOTotal();
  // focus ที่ช่องชื่ออะไหล่ของแถวใหม่ ไม่ scroll บังคับ
  newRow.querySelector('input')?.focus();
}
function removePORow(i) {
  _poRows.splice(i, 1);
  renderPORows(); // re-render เพื่อ renumber ทุก row
}
function buildPORow(i) {
  const r = _poRows[i];
  const isAdmin = CU.role === 'admin';
  // lock ชื่อ/จำนวน/ราคา ถ้า admin และ row มาจากช่าง (techRequest)
  const lockItemFields = isAdmin && !!(r._fromTech || window._poFromTech);

  const wrap = document.createElement('div');
  wrap.id = 'po-row-wrap-'+i;
  wrap.style.cssText = `padding:12px 14px;border-bottom:1px solid #f8fafc;background:${lockItemFields?'#fafbff':'white'};position:relative`;

  // lock badge
  if (lockItemFields) {
    const lockTag = document.createElement('div');
    lockTag.style.cssText = 'position:absolute;top:8px;right:10px;background:#ede9fe;color:#5b21b6;font-size:0.55rem;font-weight:800;padding:2px 7px;border-radius:6px;border:1px solid #c4b5fd';
    lockTag.textContent = '🔒 ข้อมูลจากช่าง';
    wrap.appendChild(lockTag);
  }

  // ── Row header: num + name ──
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px';

  const numBadge = document.createElement('div');
  numBadge.style.cssText = `width:22px;height:22px;border-radius:7px;background:${lockItemFields?'#7c3aed':'linear-gradient(135deg,#e65100,#c2410c)'};color:white;font-size:0.65rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0`;
  numBadge.textContent = i+1;

  const inName = document.createElement('input');
  inName.value = r.name||'';
  inName.placeholder = 'ชื่ออะไหล่ / รายการ...';
  inName.readOnly = lockItemFields;
  inName.style.cssText = `flex:1;border:1.5px solid ${lockItemFields?'#c4b5fd':'#e5e7eb'};border-radius:9px;padding:8px 10px;font-size:0.82rem;font-family:inherit;font-weight:600;color:${lockItemFields?'#5b21b6':'#0f172a'};outline:none;background:${lockItemFields?'#faf5ff':'white'};min-width:0;transition:border-color 0.2s;cursor:${lockItemFields?'default':'text'}`;
  if (!lockItemFields) {
    inName.addEventListener('input', e => _poRows[i].name = e.target.value);
    inName.addEventListener('focus', e => e.target.style.borderColor='#e65100');
    inName.addEventListener('blur',  e => e.target.style.borderColor='#e5e7eb');
  }

  header.append(numBadge, inName);
  // ปุ่มลบ — แสดงเฉพาะไม่ lock
  if (!lockItemFields) {
    const btnDel = document.createElement('button');
    btnDel.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    btnDel.style.cssText = 'width:28px;height:28px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;cursor:pointer;color:#ef4444;display:flex;align-items:center;justify-content:center;flex-shrink:0;-webkit-tap-highlight-color:transparent';
    btnDel.onclick = () => removePORow(i);
    header.appendChild(btnDel);
  }

  // ── Row body: qty × price = total ──
  const qtyPriceRow = document.createElement('div');
  qtyPriceRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px;padding-left:30px';

  // Qty
  const qtyWrap = document.createElement('div');
  qtyWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px';
  const qtyLabel = document.createElement('div');
  qtyLabel.style.cssText = 'font-size:0.55rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em';
  qtyLabel.textContent = 'จำนวน';
  const inQty = document.createElement('input');
  inQty.type='number'; inQty.inputMode='numeric'; inQty.min='1'; inQty.max='9999';
  inQty.value = String(r.qty||1);
  inQty.readOnly = lockItemFields;
  inQty.style.cssText = `width:60px;border:1.5px solid ${lockItemFields?'#c4b5fd':'#e5e7eb'};border-radius:9px;padding:7px 5px;font-size:0.82rem;font-family:inherit;font-weight:700;color:${lockItemFields?'#5b21b6':'#374151'};outline:none;text-align:center;box-sizing:border-box;background:${lockItemFields?'#faf5ff':'white'};cursor:${lockItemFields?'default':'text'}`;
  if (!lockItemFields) {
    inQty.addEventListener('input', e => {
      let v = parseInt(e.target.value)||1;
      if(v < 1) { v=1; e.target.value=1; }
      if(v > 9999) { v=9999; e.target.value=9999; }
      _poRows[i].qty = v;
      updatePORowTotal(i);
    });
    inQty.addEventListener('focus', e => e.target.style.borderColor='#e65100');
    inQty.addEventListener('blur',  e => e.target.style.borderColor='#e5e7eb');
  }
  qtyWrap.append(qtyLabel, inQty);

  const mulSign = document.createElement('span');
  mulSign.style.cssText = 'font-size:0.9rem;color:#cbd5e1;font-weight:700;margin-top:14px;flex-shrink:0';
  mulSign.textContent = '×';

  // Price
  const priceWrap = document.createElement('div');
  priceWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;flex:1';
  const priceLabel = document.createElement('div');
  priceLabel.style.cssText = 'font-size:0.55rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em';
  priceLabel.textContent = 'ราคา/ชิ้น (฿)';
  const inPrice = document.createElement('input');
  inPrice.type='number'; inPrice.inputMode='decimal'; inPrice.min='0'; inPrice.max='9999999';
  inPrice.value = String(r.price||0);
  inPrice.placeholder = '0';
  inPrice.readOnly = lockItemFields;
  inPrice.style.cssText = `width:100%;border:1.5px solid ${lockItemFields?'#c4b5fd':'#e5e7eb'};border-radius:9px;padding:7px 10px;font-size:0.82rem;font-family:inherit;font-weight:700;color:${lockItemFields?'#5b21b6':'#374151'};outline:none;text-align:right;box-sizing:border-box;background:${lockItemFields?'#faf5ff':'white'};cursor:${lockItemFields?'default':'text'}`;
  if (!lockItemFields) {
    inPrice.addEventListener('input', e => {
      let v = parseFloat(e.target.value)||0;
      if(v < 0) { v=0; e.target.value=0; }
      if(v > 9999999) { v=9999999; e.target.value=9999999; showToast('⚠️ ราคาสูงสุด ฿9,999,999 ต่อรายการ'); }
      _poRows[i].price = v;
      updatePORowTotal(i);
    });
    inPrice.addEventListener('focus', e => e.target.style.borderColor='#e65100');
    inPrice.addEventListener('blur',  e => e.target.style.borderColor='#e5e7eb');
  }
  priceWrap.append(priceLabel, inPrice);

  const eqSign = document.createElement('span');
  eqSign.style.cssText = 'font-size:0.9rem;color:#cbd5e1;font-weight:700;margin-top:14px;flex-shrink:0';
  eqSign.textContent = '=';

  // Total
  const totalWrap = document.createElement('div');
  totalWrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0;min-width:72px';
  const totalLabel = document.createElement('div');
  totalLabel.style.cssText = 'font-size:0.55rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em';
  totalLabel.textContent = 'ยอดรวม';
  const totalSpan = document.createElement('div');
  totalSpan.id = 'po-row-total-'+i;
  totalSpan.style.cssText = 'font-size:0.9rem;font-weight:900;color:#e65100;text-align:right;background:#fff7ed;border-radius:7px;padding:5px 8px;border:1px solid #fed7aa';
  totalSpan.textContent = '฿'+((r.qty||1)*(r.price||0)).toLocaleString();
  totalWrap.append(totalLabel, totalSpan);

  qtyPriceRow.append(qtyWrap, mulSign, priceWrap, eqSign, totalWrap);

  // ── PR / PO doc row — Admin กรอกได้เสมอ ──
  const docRow = document.createElement('div');
  docRow.style.cssText = 'display:flex;gap:6px;padding-left:30px';

  const mkDocInput = (label, val, color, bgFocus, cbFn) => {
    const box = document.createElement('div');
    box.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:2px';
    const lbl = document.createElement('div');
    lbl.style.cssText = `font-size:0.58rem;font-weight:800;color:${isAdmin?color:'#94a3b8'};letter-spacing:0.05em;text-transform:uppercase`;
    lbl.textContent = label+' Number';
    const inp = document.createElement('input');
    inp.type='text'; inp.value=val||'';
    inp.placeholder = label+'-';
    inp.disabled = !isAdmin; // Admin เท่านั้นที่กรอก PR/PO
    const hasVal = !!(val&&val.trim());
    inp.style.cssText = `width:100%;box-sizing:border-box;border:1.5px solid ${hasVal?color+'55':'#e5e7eb'};border-radius:9px;padding:7px 9px;font-size:0.75rem;font-family:inherit;font-weight:700;color:${isAdmin?color:'#c4c9d4'};outline:none;background:${isAdmin?(hasVal?bgFocus:'white'):'#f8fafc'};transition:all 0.2s`;
    inp.addEventListener('input', e => {
      cbFn(e.target.value);
      const hv = !!(e.target.value.trim());
      e.target.style.borderColor = hv?color+'55':'#e5e7eb';
      e.target.style.background  = hv?bgFocus:'white';
    });
    inp.addEventListener('focus', e => { if(isAdmin){ e.target.style.borderColor=color; e.target.style.background=bgFocus; } });
    inp.addEventListener('blur',  e => {
      const hv = !!(e.target.value.trim());
      e.target.style.borderColor = hv?color+'55':'#e5e7eb';
      e.target.style.background  = hv?bgFocus:'white';
    });
    box.append(lbl, inp);
    return box;
  };

  const prBox = mkDocInput('PR', r.pr||'', '#be123c', '#fff1f2', v => _poRows[i].pr=v);
  const prInp = prBox.querySelector('input');
  if (prInp) { prInp.classList.add('po-pr-input'); prInp.placeholder = 'PR- (บังคับ)'; }
  const poBox = mkDocInput('PO', r.po||'', '#6d28d9', '#f5f3ff', v => _poRows[i].po=v);
  docRow.append(prBox, poBox);

  wrap.append(header, qtyPriceRow, docRow);
  return wrap;
}

function renderPORows() {
  const wrap = document.getElementById('po-rows-wrap'); if (!wrap) return;
  wrap.innerHTML = '';
  _poRows.forEach((r, i) => wrap.appendChild(buildPORow(i)));
  updatePOTotal();
}


function updatePORowTotal(i) {
  const r = _poRows[i];
  const el = document.getElementById('po-row-total-'+i);
  if (el) el.textContent = '฿'+((r.qty||1)*(r.price||0)).toLocaleString();
  updatePOTotal();
}

function updatePOTotal() {
  const total = _poRows.reduce((s,r)=>s+(r.qty||1)*(r.price||0), 0);
  const el = document.getElementById('po-total');
  if (el) el.textContent = '฿'+total.toLocaleString();
}
function toggleChip(el, val) { el.classList.toggle('active'); }
function initRepairGroups() { /* replaced by openRepairPicker */ }

// ── REPAIR PICKER — fullscreen overlay ──
// ── ราคามาตรฐาน NIL Engineering (ต่อหน่วย บาท) ──
// ── Default vendors (fallback) ──
const DEFAULT_VENDORS = [
  { code:'SKIC', name:'บริษัท สยามคราฟอุตสาหกรรม จำกัด',                      addr:'13/1 ถ.พระราม 4 แขวงบางโคล่ เขตบางคอแหลม กรุงเทพฯ 10120' },
  { code:'TPC',  name:'บริษัท ผลิตภัณฑ์กระดาษไทย จำกัด',                      addr:'13/1 ถ.พระราม 4 แขวงบางโคล่ เขตบางคอแหลม กรุงเทพฯ 10120' },
  { code:'SNP',  name:'บริษัท สยามนิปปอน อินดัสเตรียล เปเปอร์ จำกัด',          addr:'13/1 ถ.พระราม 4 แขวงบางโคล่ เขตบางคอแหลม กรุงเทพฯ 10120' },
  { code:'SCG',  name:'บริษัท เอสซีจี แพคเกจจิ้ง จำกัด (มหาชน)',               addr:'1 ถ.ปูนซิเมนต์ไทย แขวงบางซื่อ เขตบางซื่อ กรุงเทพฯ 10800' },
];
// Dynamic — reads from db.vendors (editable), falls back to DEFAULT_VENDORS
function getVendors() {
  return (db.vendors && db.vendors.length > 0) ? db.vendors : DEFAULT_VENDORS;
}
function getVendorMap() {
  const m = {};
  getVendors().forEach(v => { m[v.code] = v.name; });
  return m;
}
// Keep VENDOR_MAP as a live getter for backward compatibility
const VENDOR_MAP = new Proxy({}, { get(_,k){ return getVendorMap()[k]; }, has(_,k){ return k in getVendorMap(); } });

const REPAIR_PRICE = {
  // PM / ล้างแอร์
  "ล้างแอร์ล้างย่อย":        200,
  "ล้างแอร์ล้างใหญ่":        300,
  "PM บำรุงรักษา":            200,
  "ตรวจเช็คระบบ":             200,
  // Compressor
  "เปลี่ยน Compressor 9K–48K":    850,
  "เปลี่ยน Compressor 48K–150K":  1350,
  "เปลี่ยน Compressor 150K–240K": 3000,
  "เปลี่ยน Compressor 240K–400K": 3350,
  // ซ่อมรั่ว
  "ซ่อมรั่ว 9K–48K":    980,
  "ซ่อมรั่ว 48K–150K":  1700,
  "ซ่อมรั่ว 150K–240K": 3400,
  "ซ่อมรั่ว 240K–400K": 6120,
  // เปลี่ยนแผง
  "เปลี่ยน CDU/FCU 9K–48K":    980,
  "เปลี่ยน CDU/FCU 48K–150K":  1700,
  "เปลี่ยน CDU/FCU 150K–240K": 3400,
  "เปลี่ยน CDU/FCU 240K–400K": 6120,
  // ติดตั้ง
  "ติดตั้ง FCU+CDU 9K–48K":    2100,
  "ติดตั้ง FCU+CDU 48K–150K":  3400,
  "ติดตั้ง FCU+CDU 150K–240K": 5100,
  "ติดตั้ง FCU+CDU 240K–400K": 7300,
  // รื้อถอน
  "รื้อถอน FCU+CDU 9K–48K":    1300,
  "รื้อถอน FCU+CDU 48K–150K":  1700,
  "รื้อถอน FCU+CDU 150K–240K": 2200,
  "รื้อถอน FCU+CDU 240K–400K": 4000,
  // ถาดน้ำทิ้ง
  "ถาดน้ำทิ้ง 9K–25K":    800,
  "ถาดน้ำทิ้ง 25K–60K":   800,
  "ถาดน้ำทิ้ง 60K–120K":  1300,
  "ถาดน้ำทิ้ง 150K–250K": 1800,
  "ถาดน้ำทิ้ง 250K–400K": 2300,
  // อุปกรณ์ไฟฟ้า
  "Breaker / Capacitor / Wiring":           420,
  "Motor CDU & FCU":                        720,
  "Temp Controller / Remote":               500,
  "ท่อน้ำยา / Pressure Switch / Dryer / EXV": 950,
  // Support
  "Support FCU 9K–48K":    350,
  "Support FCU 48K–150K":  500,
  "Support FCU 150K–240K": 900,
  "Support FCU 240K–400K": 1100,
  "Support CDU 9K–48K":    500,
  "Support CDU 48K–150K":  700,
  "Support CDU 150K–240K": 1300,
  "Support CDU 240K–400K": 1500,
  // ล้างระบบน้ำยา
  "ล้างระบบน้ำยา 9K–48K":    980,
  "ล้างระบบน้ำยา 48K–150K":  1700,
  "ล้างระบบน้ำยา 150K–240K": 3400,
  "ล้างระบบน้ำยา 240K–400K": 6120,
  // สารทำความเย็น (ต่อกก.)
  "น้ำยา R-22 (ต่อ กก.)":    200,
  "น้ำยา R-407C (ต่อ กก.)":  330,
  "น้ำยา R-410A (ต่อ กก.)":  340,
  "น้ำยา R-134A (ต่อ กก.)":  330,
  "น้ำยา R-32 (ต่อ กก.)":    350,
  "น้ำยา R-141B (ต่อ กก.)":  280,
  // งานท่อ
  "ซ่อมตู้น้ำดื่ม":         1000,
  "เดินท่อน้ำทิ้งใหม่":      900,
  "ซ่อมท่อน้ำทิ้ง":          700,
  // พิเศษ
  "ค่าแรง Stand by (ต่อชม.)": 600,
  "ค่าแรงนอกเวลา (ต่อชม.)":  110,
  "งานที่สูง / นั่งร้าน":    250,
  "อื่นๆ": 0,
};

const REPAIR_GROUPS = [
  ["PM / ล้างแอร์",         ["ล้างแอร์ล้างย่อย","ล้างแอร์ล้างใหญ่","PM บำรุงรักษา","ตรวจเช็คระบบ"]],
  ["ซ่อม Compressor",       ["เปลี่ยน Compressor 9K–48K","เปลี่ยน Compressor 48K–150K","เปลี่ยน Compressor 150K–240K","เปลี่ยน Compressor 240K–400K"]],
  ["ซ่อมรั่ว",              ["ซ่อมรั่ว 9K–48K","ซ่อมรั่ว 48K–150K","ซ่อมรั่ว 150K–240K","ซ่อมรั่ว 240K–400K"]],
  ["เปลี่ยนแผง / ยกชุด",   ["เปลี่ยน CDU/FCU 9K–48K","เปลี่ยน CDU/FCU 48K–150K","เปลี่ยน CDU/FCU 150K–240K","เปลี่ยน CDU/FCU 240K–400K"]],
  ["ล้างระบบน้ำยา",         ["ล้างระบบน้ำยา 9K–48K","ล้างระบบน้ำยา 48K–150K","ล้างระบบน้ำยา 150K–240K","ล้างระบบน้ำยา 240K–400K"]],
  ["งานติดตั้ง",            ["ติดตั้ง FCU+CDU 9K–48K","ติดตั้ง FCU+CDU 48K–150K","ติดตั้ง FCU+CDU 150K–240K","ติดตั้ง FCU+CDU 240K–400K"]],
  ["งานรื้อถอน",            ["รื้อถอน FCU+CDU 9K–48K","รื้อถอน FCU+CDU 48K–150K","รื้อถอน FCU+CDU 150K–240K","รื้อถอน FCU+CDU 240K–400K"]],
  ["ถาดน้ำทิ้ง",            ["ถาดน้ำทิ้ง 9K–25K","ถาดน้ำทิ้ง 25K–60K","ถาดน้ำทิ้ง 60K–120K","ถาดน้ำทิ้ง 150K–250K","ถาดน้ำทิ้ง 250K–400K"]],
  ["เปลี่ยนอุปกรณ์ไฟฟ้า",  ["Breaker / Capacitor / Wiring","Motor CDU & FCU","Temp Controller / Remote","ท่อน้ำยา / Pressure Switch / Dryer / EXV"]],
  ["สารทำความเย็น",         ["น้ำยา R-22 (ต่อ กก.)","น้ำยา R-407C (ต่อ กก.)","น้ำยา R-410A (ต่อ กก.)","น้ำยา R-134A (ต่อ กก.)","น้ำยา R-32 (ต่อ กก.)","น้ำยา R-141B (ต่อ กก.)"]],
  ["ค่า Support",           ["Support FCU 9K–48K","Support FCU 48K–150K","Support FCU 150K–240K","Support FCU 240K–400K","Support CDU 9K–48K","Support CDU 48K–150K","Support CDU 150K–240K","Support CDU 240K–400K"]],
  ["งานท่อ / ตู้น้ำ",       ["ซ่อมตู้น้ำดื่ม","เดินท่อน้ำทิ้งใหม่","ซ่อมท่อน้ำทิ้ง"]],
  ["งานพิเศษ",              ["งานที่สูง / นั่งร้าน","ค่าแรง Stand by (ต่อชม.)","ค่าแรงนอกเวลา (ต่อชม.)","อื่นๆ"]],
];

function _getRepairGroups() {
  // ถ้า admin เพิ่ม/แก้ไขแล้ว ใช้จาก db.repairGroups แทน
  if (db.repairGroups && db.repairGroups.length) return db.repairGroups;
  return REPAIR_GROUPS.map(([label, items]) => ({
    label, icon: _grpIcon(label),
    items: items.map(name => ({ name, price: REPAIR_PRICE[name]||0, unit:'JOB' }))
  }));
}
function _grpIcon(label) {
  const m = {'PM':'🧹','ล้างแอร์':'🧹','Compressor':'⚙️','รั่ว':'💧','แผง':'🔄','ติดตั้ง':'🔩','รื้อ':'🗜️','ถาด':'🪣','ไฟฟ้า':'⚡','สาร':'❄️','Support':'🏗️','ท่อ':'🔧','พิเศษ':'⭐','ตู้น้ำ':'💧'};
  return Object.entries(m).find(([k])=>label.includes(k))?.[1] || '📋';
}

function openRepairPicker() {
  document.getElementById('_rp_ov')?.remove();
  const ov = document.createElement('div');
  ov.id = '_rp_ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#f0f2f5;display:flex;flex-direction:column;animation:slideUp 0.25s cubic-bezier(0.32,0.72,0,1);font-family:inherit';

  const groups = _getRepairGroups();
  const selectedMap = {};
  document.querySelectorAll('#c-repair-tags .rtag').forEach(t => {
    selectedMap[t.dataset.val] = parseInt(t.dataset.qty)||1;
  });

  // ── ดึง BTU จาก ticket ปัจจุบัน ──
  const _rpTid = document.getElementById('c-tid')?.value || '';
  const _rpTicket = _rpTid ? db.tickets?.find(x=>x.id===_rpTid) : null;
  const _rpMac = _rpTicket ? getMacMap().get(_rpTicket.machineId) : null;
  const _rpBtu = _rpMac?.btu ? Number(_rpMac.btu) : 0;
  const _rpBtuLabel = _rpBtu > 0 ? Number(_rpBtu).toLocaleString() + ' BTU' : '';
  const _rpMacName = _rpMac?.name || _rpTicket?.machine || '';
  const _rpDept = _rpMac?.dept || _rpTicket?.dept || '';
  const _rpProblem = _rpTicket?.problem || '';
  const _rpVendor = _rpMac?.vendor || _rpTicket?.vendor || '';

  let searchQ = '';
  let activeGrp = null; // null = all

  const getTotal = () => Object.values(selectedMap).reduce((s,v)=>s+v,0);
  const getTotalPrice = () => {
    let sum = 0;
    groups.forEach(g => g.items.forEach(it => {
      if (selectedMap[it.name]) sum += (it.price||0) * selectedMap[it.name];
    }));
    return sum;
  };

  ov.innerHTML = `
    <!-- Header compact -->
    <div style="background:linear-gradient(160deg,#1a0a0e 0%,#7f1d1d 45%,#c8102e 100%);flex-shrink:0;padding:calc(env(safe-area-inset-top,0px) + 6px) 0 0">
      <!-- Top bar — single row -->
      <div style="padding:0 12px 6px;display:flex;align-items:center;gap:8px">
        <button id="rp-close" style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.15);color:white;font-size:1.2rem;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;touch-action:manipulation">‹</button>
        <div style="flex:1;min-width:0">
          <div style="color:white;font-size:0.88rem;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            เลือกรายการงาน
            ${_rpMacName ? `<span style="font-size:0.65rem;font-weight:600;opacity:.55;margin-left:6px">${_rpMacName.length>20?_rpMacName.slice(0,20)+'\u2026':_rpMacName}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:5px;margin-top:1px">
            ${_rpBtuLabel ? `<span style="background:rgba(251,191,36,.3);color:#fde68a;border-radius:4px;padding:1px 6px;font-size:0.62rem;font-weight:900;border:1px solid rgba(251,191,36,.35)">${_rpBtuLabel}</span>` : ''}
            ${_rpDept ? `<span style="font-size:0.6rem;color:rgba(255,255,255,.5);font-weight:600">🏢 ${_rpDept}</span>` : ''}
          </div>
        </div>
        <div style="flex-shrink:0;background:rgba(255,255,255,.12);border-radius:8px;padding:4px 10px;text-align:center;min-width:40px">
          <div id="rp-count-num" style="font-size:1.1rem;font-weight:900;color:white;line-height:1">0</div>
          <div style="font-size:0.5rem;color:rgba(255,255,255,.4);font-weight:700">เลือก</div>
        </div>
      </div>

      <!-- Search -->
      <div style="padding:0 12px 8px">
        <div style="background:rgba(255,255,255,.13);border-radius:10px;padding:0 10px;display:flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.1)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="rp-search" placeholder="ค้นหารายการ..." style="flex:1;background:none;border:none;outline:none;color:white;font-size:0.82rem;padding:8px 0;font-family:inherit" oninput="window._rpSearch(this.value)"/>
          <button id="rp-search-clear" onclick="document.getElementById('rp-search').value='';window._rpSearch('')" style="display:none;background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;font-size:1rem;padding:4px">✕</button>
        </div>
      </div>
    </div>

    <!-- Selected chips bar — horizontal scroll, compact -->
    <div id="rp-sel-bar" style="display:none;background:#fff8f8;border-bottom:2px solid #fecdd3;flex-shrink:0">
      <div style="padding:5px 12px 3px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:0.7rem;font-weight:900;color:#c8102e">เลือกแล้ว</span>
          <span id="rp-sel-count-badge" style="background:#c8102e;color:white;border-radius:99px;padding:1px 7px;font-size:0.62rem;font-weight:900"></span>
        </div>
        <span id="rp-price-total" style="font-size:0.78rem;font-weight:900;color:#047857"></span>
      </div>
      <!-- Horizontal scroll chips -->
      <div id="rp-sel-list" style="display:flex;gap:6px;padding:0 12px 7px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none"></div>
    </div>

    <!-- Group filter bar -->
    <div style="flex-shrink:0;background:white;border-bottom:2px solid #f1f5f9;padding:8px 14px">
      <div style="position:relative">
        <select id="rp-grp-select" onchange="window._rpSetGrp(this.value==='null'?null:parseInt(this.value))"
          style="width:100%;padding:10px 36px 10px 14px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;color:#0f172a;font-size:0.85rem;font-weight:700;font-family:inherit;cursor:pointer;outline:none;appearance:none;-webkit-appearance:none">
        </select>
        <div style="position:absolute;right:14px;top:50%;transform:translateY(-50%);pointer-events:none;color:#64748b;font-size:0.75rem">▼</div>
      </div>
    </div>

    <!-- List body -->
    <div id="rp-body" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:8px 0 16px"></div>

    <!-- Footer -->
    <div style="padding:14px 20px calc(env(safe-area-inset-bottom,0px)+16px);background:white;border-top:2px solid #f1f5f9;flex-shrink:0;display:flex;gap:14px;align-items:center;box-shadow:0 -6px 24px rgba(0,0,0,0.08)">
      <div id="rp-footer-summary" style="flex:1;min-width:0;padding-left:4px">
        <div id="rp-footer-count" style="font-size:0.82rem;font-weight:800;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div>
        <div id="rp-footer-price" style="font-size:1.05rem;font-weight:900;color:#047857;margin-top:1px"></div>
      </div>
      <button id="rp-done" style="padding:16px 32px;background:linear-gradient(135deg,#c8102e,#e63950);color:white;border:none;border-radius:16px;font-size:1rem;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 6px 20px rgba(200,16,46,.45);touch-action:manipulation;white-space:nowrap;letter-spacing:-0.01em;margin-right:4px">
        ✅ ยืนยัน
      </button>
    </div>`;

  document.body.appendChild(ov);

  const body       = ov.querySelector('#rp-body');
  const selBar     = ov.querySelector('#rp-sel-bar');
  const selList    = ov.querySelector('#rp-sel-list');
  const countEl    = ov.querySelector('#rp-count-num');
  // pillsEl replaced by select dropdown
  const priceEl    = ov.querySelector('#rp-price-total');
  const footCount  = ov.querySelector('#rp-footer-count');
  const footPrice  = ov.querySelector('#rp-footer-price');
  const searchClear= ov.querySelector('#rp-search-clear');

  // ── Group dropdown ──
  const pillsEl = null; // ไม่ใช้แล้ว
  function renderPills() {
    const sel = ov.querySelector('#rp-grp-select');
    if (!sel) return;
    const all = [{ label:'📋 ทั้งหมด', icon:'📋', _all:true }, ...groups];
    const cur = activeGrp === null ? 'null' : String(activeGrp);
    sel.innerHTML = all.map((g, i) => {
      const val = g._all ? 'null' : String(i-1);
      const selCnt = g._all ? getTotal() : (g.items||[]).reduce((s,it)=>s+(selectedMap[it.name]?1:0),0);
      const cntLabel = selCnt > 0 ? ` (✓${selCnt})` : '';
      const label = g._all ? `📋 ทั้งหมด${cntLabel}` : `${g.icon||'📋'} ${g.label}${cntLabel}`;
      return `<option value="${val}" ${val===cur?'selected':''}>${label}</option>`;
    }).join('');
  }

  // ── Selected summary ──
  function renderSelBar() {
    const entries = Object.entries(selectedMap).filter(([,q])=>q>0);
    const total = getTotal();
    const totalPrice = getTotalPrice();
    countEl.textContent = total;
    if (!entries.length) { selBar.style.display='none'; }
    else {
      selBar.style.display='block';
      priceEl.textContent = totalPrice>0 ? '฿'+totalPrice.toLocaleString() : '';
      // อัปเดต badge จำนวน
      const cntBadge = ov.querySelector('#rp-sel-count-badge');
      if (cntBadge) cntBadge.textContent = entries.length + ' รายการ';

      selList.innerHTML = entries.map(([name,qty])=>{
        const price = (() => { for(const g of groups) { const it=g.items?.find(i=>i.name===name); if(it) return it.price||0; } return REPAIR_PRICE[name]||0; })();
        let gColor = '#c8102e', gIcon = '🔧';
        groups.forEach(g => { const it=g.items?.find(i=>i.name===name); if(it){ gColor=grpColors[groups.indexOf(g)%grpColors.length]; gIcon=g.icon||'🔧'; } });
        const safe = name.replace(/'/g,"\'");
        const shortName = name.length > 16 ? name.slice(0,16)+'…' : name;
        return `<div style="flex-shrink:0;background:white;border:1.5px solid ${gColor}40;border-radius:20px;padding:5px 8px 5px 10px;display:flex;align-items:center;gap:6px;box-shadow:0 1px 4px rgba(0,0,0,0.08);white-space:nowrap">
          <span style="font-size:0.88rem">${gIcon}</span>
          <div style="min-width:0">
            <div style="font-size:0.72rem;font-weight:800;color:#0f172a">${shortName}</div>
            ${price>0 ? `<div style="font-size:0.6rem;color:${gColor};font-weight:700">฿${(price*qty).toLocaleString()}</div>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:2px;margin-left:2px">
            <button onclick="window.rpAdjust('${safe}',-1)" style="width:22px;height:22px;border-radius:6px;background:#f1f5f9;border:1px solid #e2e8f0;cursor:pointer;font-size:0.9rem;font-weight:900;color:#374151;display:flex;align-items:center;justify-content:center;touch-action:manipulation">−</button>
            <span style="font-size:0.72rem;font-weight:900;color:${gColor};min-width:18px;text-align:center">×${qty}</span>
            <button onclick="window.rpAdjust('${safe}',1)" style="width:22px;height:22px;border-radius:6px;background:#f1f5f9;border:1px solid #e2e8f0;cursor:pointer;font-size:0.9rem;font-weight:900;color:#374151;display:flex;align-items:center;justify-content:center;touch-action:manipulation">+</button>
          </div>
          <button onclick="window.rpAdjust('${safe}',-999)" style="width:20px;height:20px;border-radius:50%;background:#fee2e2;border:none;cursor:pointer;color:#dc2626;font-size:0.65rem;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;touch-action:manipulation;margin-left:1px">✕</button>
        </div>`;
      }).join('');
    }
    // footer
    const tp = getTotalPrice();
    footCount.textContent = total > 0 ? `${total} รายการที่เลือก` : 'ยังไม่เลือกรายการ';
    footPrice.textContent = tp > 0 ? `฿${tp.toLocaleString()} (ก่อน VAT)` : '';
    renderPills();
  }

  window.rpAdjust = (name, delta) => {
    const cur = selectedMap[name]||0;
    const next = cur + delta;
    if (next <= 0) delete selectedMap[name];
    else selectedMap[name] = next;
    const row = body.querySelector(`[data-rp="${CSS.escape(name)}"]`);
    if (row) _rpUpdateRow(row, name);
    renderSelBar();
  };

  window._rpSetGrp = (idx) => {
    activeGrp = idx;
    renderBody();
    renderPills();
  };

  window._rpSearch = (q) => {
    searchQ = q.trim().toLowerCase();
    searchClear.style.display = searchQ ? 'block' : 'none';
    activeGrp = null;
    renderBody();
    renderPills();
  };

  function _rpUpdateRow(row, name) {
    const qty = selectedMap[name]||0;
    const isSelected = qty > 0;
    let itemGrpIdx = 0;
    groups.forEach((g,gi) => { if (g.items?.find(i=>i.name===name)) itemGrpIdx = gi; });
    const iColor = grpColors[itemGrpIdx % grpColors.length];

    row.style.background = isSelected ? '#fff0f2' : row.dataset.btuMatch ? '#f0f9ff' : 'white';

    // top bar
    let topBar = row.querySelector('.rp-topbar');
    if (isSelected) {
      if (!topBar) {
        topBar = document.createElement('div');
        topBar.className = 'rp-topbar';
        topBar.style.cssText = `position:absolute;top:0;left:0;right:0;height:4px;background:${iColor};border-radius:0`;
        row.insertBefore(topBar, row.firstChild);
      }
    } else {
      if (topBar) topBar.remove();
    }

    // icon circle
    const iconCircle = row.querySelector('div[style*="border-radius:8px"]');
    if (iconCircle) {
      iconCircle.style.background = isSelected ? iColor : (row.dataset.btuMatch ? '#0369a1' : iColor+'22');
      iconCircle.style.boxShadow = isSelected ? `0 3px 8px ${iColor}55` : 'none';
    }

    // qty badge
    const qBadge = row.querySelector('.rp-q');
    if (qBadge) {
      qBadge.textContent = qty || '+';
      qBadge.style.background = isSelected ? iColor : '#e5e7eb';
      qBadge.style.color = isSelected ? 'white' : '#94a3b8';
      qBadge.style.boxShadow = isSelected ? `0 2px 8px ${iColor}44` : 'none';
      if (isSelected) { qBadge.style.transform='scale(1.18)'; setTimeout(()=>qBadge.style.transform='scale(1)',150); }
    }

    // del button
    const del = row.querySelector('.rp-del');
    if (del) del.style.display = isSelected ? 'flex' : 'none';

    // name color
    const nameEl = row.querySelector('div[style*="font-weight:800"]');
    if (nameEl) nameEl.style.color = isSelected ? '#c8102e' : '#1e293b';

    // price badge color
    const priceEl = row.querySelector('div[style*="border-radius:6px;padding:3px"]');
    if (priceEl) {
      priceEl.style.color = isSelected ? '#be123c' : iColor;
      priceEl.style.background = isSelected ? '#fee2e2' : iColor+'15';
    }
  }

  // Group color map
  const grpColors = ['#0369a1','#15803d','#7c3aed','#c2410c','#0891b2','#be185d','#065f46','#1d4ed8'];
  const grpBgColors = ['#eff6ff','#f0fdf4','#f5f3ff','#fff7ed','#ecfeff','#fdf2f8','#f0fdf4','#eff6ff'];

  function renderBody() {
    body.innerHTML = '';
    const filteredGroups = groups.map((g, gi) => {
      let items = g.items||[];
      if (searchQ) items = items.filter(it => it.name.toLowerCase().includes(searchQ));
      if (activeGrp !== null && gi !== activeGrp) return null;
      if (!items.length) return null;
      return { ...g, items, gi };
    }).filter(Boolean);

    if (!filteredGroups.length) {
      body.innerHTML = '<div style="text-align:center;padding:56px 20px;color:#94a3b8"><div style="font-size:2.5rem;margin-bottom:12px">🔍</div><div style="font-size:0.88rem;font-weight:700">ไม่พบรายการ</div></div>';
      return;
    }

    // ถ้ามี BTU ให้สร้าง lookup สำหรับ BTU-tier ไว้ด้านบน
    const btuInfo = _rpBtu > 0 ? (() => {
      const bk = _rpBtu;
      if (bk <= 9000) return '≤9K';
      if (bk <= 48000) return '9K–48K';
      if (bk <= 150000) return '48K–150K';
      if (bk <= 240000) return '150K–240K';
      return '240K–400K';
    })() : '';

    filteredGroups.forEach(({ label, icon, items, gi }) => {
      const colIdx = gi % grpColors.length;
      const grpColor = grpColors[colIdx];
      const grpBg = grpBgColors[colIdx];

      // Group section container
      const section = document.createElement('div');
      section.style.cssText = 'margin:0 10px 14px;background:white;border-radius:18px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);border:1.5px solid '+grpColor+'22';

      // Group header — sticky สีหมวด
      const selCnt = items.filter(it=>selectedMap[it.name]).length;
      const grpHdr = document.createElement('div');
      grpHdr.style.cssText = `display:flex;align-items:center;gap:10px;padding:11px 14px;background:linear-gradient(135deg,${grpColor}18,${grpColor}08);border-bottom:2px solid ${grpColor}30;position:sticky;top:0;z-index:2;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)`;
      grpHdr.innerHTML = `
        <div style="width:36px;height:36px;background:${grpColor};border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:1.15rem;flex-shrink:0;box-shadow:0 3px 10px ${grpColor}55">${icon||'📋'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.88rem;font-weight:900;color:#0f172a;letter-spacing:-0.01em">${label}</div>
          <div style="font-size:0.6rem;color:#94a3b8;margin-top:1px;font-weight:600">${items.length} รายการ</div>
        </div>
        ${selCnt > 0 ? `<span style="background:${grpColor};color:white;border-radius:99px;padding:4px 12px;font-size:0.62rem;font-weight:900;box-shadow:0 2px 8px ${grpColor}55;display:flex;align-items:center;gap:4px"><span style="font-size:0.7rem">✓</span> ${selCnt} เลือก</span>` : `<span style="background:${grpColor}15;color:${grpColor};border-radius:99px;padding:4px 10px;font-size:0.6rem;font-weight:700">${items.length} รายการ</span>`}`;
      section.appendChild(grpHdr);

      // Items — 2-col grid redesign: card ใหญ่ขึ้น icon ชัด กดง่าย
      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:2px;background:#f1f5f9';
      items.forEach((it, idx) => {
        const qty = selectedMap[it.name]||0;
        const price = it.price||REPAIR_PRICE[it.name]||0;
        const unit  = it.unit||'JOB';
        const isSelected = qty > 0;
        const isBtuMatch = btuInfo && it.name.includes(btuInfo);

        const card = document.createElement('div');
        card.dataset.rp = it.name;
        if (isBtuMatch) card.dataset.btuMatch = '1';
        card.style.cssText = [
          'display:flex;flex-direction:column;justify-content:center;',
          `padding:8px 9px;`,
          `background:${isSelected ? '#fff0f2' : isBtuMatch ? '#f0f9ff' : 'white'};`,
          'cursor:pointer;touch-action:manipulation;',
          'transition:background 0.12s;',
          'position:relative;',
          'min-height:52px;',
          'user-select:none;-webkit-user-select:none;'
        ].join('');

        // Icon map ตามชื่อหมวด
        const _iconMap = {
          'PM':'🧹','ล้างแอร์':'💦','ล้าง':'💦',
          'Compressor':'⚙️','ซ่อม Compressor':'⚙️','เปลี่ยน Compressor':'⚙️',
          'ซ่อมรั่ว':'💧','รั่ว':'💧',
          'เปลี่ยนแผง':'🔩','แผง':'🔩','CDU':'🌀','FCU':'💨',
          'ล้างระบบน้ำยา':'❄️','น้ำยา':'❄️','สารทำความเย็น':'❄️',
          'งานพิเศษ':'⭐','พิเศษ':'⭐','นั่งร้าน':'🏗️',
          'ติดตั้ง':'🔌','ยกชุด':'📦','ถาดน้ำทิ้ง':'🪣',
          'ไฟฟ้า':'⚡','อุปกรณ์ไฟฟ้า':'⚡',
        };
        let grpIcon = icon || '🔧';
        for (const [k,v] of Object.entries(_iconMap)) {
          if (label.includes(k)) { grpIcon = v; break; }
        }

        card.innerHTML = `
          ${isSelected ? `<div class="rp-topbar" style="position:absolute;top:0;left:0;right:0;height:4px;background:${grpColor};border-radius:0"></div>` : ''}
          ${isBtuMatch && !isSelected ? `<div style="position:absolute;top:5px;right:5px;background:#0369a1;color:white;border-radius:3px;padding:1px 4px;font-size:0.45rem;font-weight:800">BTU</div>` : ''}
          ${isSelected ? `<div style="position:absolute;top:5px;right:5px;background:${grpColor};color:white;border-radius:3px;padding:1px 4px;font-size:0.45rem;font-weight:800">✓</div>` : ''}

          <!-- Icon circle + name -->
          <div style="display:flex;align-items:flex-start;gap:9px;flex:1">
            <div style="width:22px;height:22px;border-radius:6px;background:${isSelected ? grpColor : isBtuMatch ? '#0369a1' : grpColor+'22'};display:flex;align-items:center;justify-content:center;font-size:0.7rem;flex-shrink:0;transition:background 0.12s">${grpIcon}</div>
            <div style="flex:1;min-width:0;padding-right:${(isBtuMatch||isSelected)?'24px':'0'}">
              <div style="font-size:0.7rem;font-weight:800;color:${isSelected ? '#c8102e' : '#1e293b'};line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.name}</div>
              <div style="font-size:0.6rem;font-weight:700;color:${isSelected ? '#be123c' : price > 0 ? grpColor : '#94a3b8'};margin-top:2px">
                ${price > 0 ? `฿${price.toLocaleString()}` : 'ตามจริง'}
              </div>
            </div>
          </div>

          <!-- Bottom row: del + qty badge -->
          <div style="display:flex;align-items:center;justify-content:flex-end;margin-top:5px;gap:4px">
            <div class="rp-del" style="display:${isSelected ? 'flex' : 'none'};width:18px;height:18px;border-radius:4px;background:#fee2e2;border:none;align-items:center;justify-content:center;cursor:pointer;color:#dc2626;font-size:0.6rem;font-weight:900;flex-shrink:0;touch-action:manipulation">✕</div>
            <div class="rp-q" style="background:${isSelected ? grpColor : '#e5e7eb'};color:${isSelected ? 'white' : '#94a3b8'};border-radius:6px;min-width:28px;height:24px;display:flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:900;flex-shrink:0;transition:all 0.15s;padding:0 5px">${qty || '+'}</div>
          </div>`;

        card.querySelector('.rp-del').onclick = (e) => { e.stopPropagation(); window.rpAdjust(it.name,-999); };
        card.onclick = () => {
          selectedMap[it.name] = (selectedMap[it.name]||0) + 1;
          _rpUpdateRow(card, it.name);
          renderSelBar();
        };
        grid.appendChild(card);
      });
      section.appendChild(grid);
      body.appendChild(section);
    });
  }

  renderBody();
  renderSelBar();

  // ── Done ──
  ov.querySelector('#rp-done').onclick = () => {
    const tags = document.getElementById('c-repair-tags');
    tags.innerHTML = '';
    const entries = Object.entries(selectedMap).filter(([,q])=>q>0);
    entries.forEach(([name,qty]) => {
      const tag = document.createElement('div');
      tag.className='rtag'; tag.dataset.val=name; tag.dataset.qty=qty;
      tag.style.cssText='display:flex;align-items:center;gap:5px;background:#fff0f2;border:1.5px solid #fecdd3;border-radius:8px;padding:5px 10px;font-size:0.72rem;font-weight:700;color:#c8102e;max-width:100%';
      const txt=document.createElement('span');
      txt.style.cssText='flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px';
      txt.textContent=name;
      const qEl=document.createElement('span');
      qEl.className='rtag-qty';
      qEl.style.cssText='background:#c8102e;color:white;border-radius:99px;padding:1px 7px;font-size:0.62rem;font-weight:900;flex-shrink:0;min-width:24px;text-align:center';
      qEl.textContent='×'+qty;
      const del=document.createElement('button');
      del.type='button'; del.textContent='✕';
      del.style.cssText='background:none;border:none;cursor:pointer;color:#ef4444;font-size:0.7rem;padding:0;flex-shrink:0';
      del.onclick=()=>{ removePartRowByName(tag.dataset.val); tag.remove(); updateRepairCount(); };
      tag.append(txt,qEl,del); tags.appendChild(tag);
    });
    updateRepairCount();

    // Auto-fill parts
    const EXCLUDE_KW = ['PM','ล้างแอร์','ซ่อมรั่ว','ตรวจเช็ค','Support','Stand by','นอกเวลา','นั่งร้าน','ซ่อมตู้น้ำ','ซ่อมท่อ','น้ำยา'];
    const partItems = entries.filter(([n]) => !EXCLUDE_KW.some(k => n.includes(k)));
    if (partItems.length) {
      const partsList = document.getElementById('c-parts-list');
      const partsBlock = document.getElementById('c-parts-block');
      if (partsList && partsBlock) {
        partsBlock.style.display = 'block';
        partsList.innerHTML = '';
        partItems.forEach(([name, qty]) => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:7px;align-items:center';
          const ni = document.createElement('input'); ni.type='text'; ni.className='c-part-name'; ni.value=name;
          ni.style.cssText='flex:3;font-size:0.85rem;padding:9px 10px;border:1.5px solid #fde68a;border-radius:9px;font-family:inherit';
          const qi = document.createElement('input'); qi.type='number'; qi.className='c-part-qty'; qi.value=qty>1?qty:''; qi.placeholder='จำนวน';
          qi.style.cssText='width:80px;font-size:0.85rem;padding:9px 8px;border:1.5px solid #fde68a;border-radius:9px;font-family:inherit;text-align:center';
          row.append(ni,qi); partsList.appendChild(row);
        });
      }
    }

    // Auto-fill summary
    const sumEl = document.getElementById('c-sum');
    if (sumEl) {
      const sumParts = [];
      entries.forEach(([n,q]) => sumParts.push(q>1?`${n} ×${q}`:n));
      document.querySelectorAll('#c-refrig-list .c-refrig-row').forEach(row => {
        const type=row.querySelector('.c-ref-type')?.value, kg=row.querySelector('.c-ref-kg')?.value;
        if(type) sumParts.push(`สารทำความเย็นและน้ำยาล้างระบบ ${type}${kg?' '+kg+'กก.':''}`);
      });
      if (sumParts.length) sumEl.value = sumParts.map(s=>'- '+s).join('\n');
    }
    ov.remove();
    delete window.rpAdjust; delete window._rpSetGrp; delete window._rpSearch;
  };

  ov.querySelector('#rp-close').onclick = () => {
    ov.remove();
    delete window.rpAdjust; delete window._rpSetGrp; delete window._rpSearch;
  };
}

// ════════════════════════════════════════════════════════════
// REPAIR MANAGER — Admin จัดการหมวด / รายการ / ราคา
// ════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════
// VENDOR MANAGER
// ══════════════════════════════════════════════
function openVendorManager() {
  // ensure db.vendors exists
  if (!db.vendors) db.vendors = [];

  let ov = document.getElementById('_vendor_mgr_ov');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = '_vendor_mgr_ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;justify-content:center;';

  const sheet = document.createElement('div');
  sheet.style.cssText = 'width:100%;max-width:540px;background:white;border-radius:24px 24px 0 0;max-height:90vh;display:flex;flex-direction:column;font-family:inherit;';

  const renderVendorList = () => {
    const vendors = getVendors();
    const isDefault = !db.vendors || db.vendors.length === 0;
    listEl.innerHTML = vendors.map((v, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:white;border:1.5px solid #e2e8f0;border-radius:12px;margin-bottom:8px">
        <div style="width:42px;height:42px;background:#1a5276;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <span style="font-size:0.75rem;font-weight:900;color:white">${v.code}</span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.85rem;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.name}</div>
          <div style="font-size:0.68rem;color:#94a3b8;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.addr||'—'}</div>
        </div>
        <button onclick="_vmEdit(${i})" style="width:32px;height:32px;background:#eff6ff;border:none;border-radius:8px;cursor:pointer;font-size:0.9rem">✏️</button>
        ${!isDefault ? `<button onclick="_vmDel(${i})" style="width:32px;height:32px;background:#fee2e2;border:none;border-radius:8px;cursor:pointer;font-size:0.9rem">🗑️</button>` : ''}
      </div>
    `).join('') + `
      <button onclick="_vmAdd()" style="width:100%;padding:11px;background:#f0f9ff;border:2px dashed #7dd3fc;border-radius:12px;font-family:inherit;font-size:0.82rem;font-weight:700;color:#0369a1;cursor:pointer;margin-top:4px">
        + เพิ่ม Vendor ใหม่
      </button>
      ${isDefault ? '<div style="margin-top:8px;padding:8px 12px;background:#fefce8;border-radius:8px;font-size:0.68rem;color:#854d0e;font-weight:600">⚠️ ใช้ข้อมูลเริ่มต้น — กด เพิ่ม Vendor เพื่อเริ่มแก้ไขได้</div>' : ''}
    `;
  };

  const showEditForm = (idx) => {
    const isNew = idx === -1;
    const vendors = getVendors();
    const v = isNew ? {code:'',name:'',addr:''} : {...vendors[idx]};
    const inp = (id,label,val,ph='') => `
      <div style="margin-bottom:10px">
        <div style="font-size:0.68rem;font-weight:700;color:#64748b;margin-bottom:3px">${label}</div>
        <input id="vm_${id}" value="${(val||'').replace(/"/g,'&quot;')}" placeholder="${ph}"
          style="width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-family:inherit;font-size:0.85rem;box-sizing:border-box;outline:none">
      </div>`;
    listEl.innerHTML = `
      <div style="padding:4px 0 10px">
        <div style="font-size:0.8rem;font-weight:900;color:#0f172a;margin-bottom:14px">${isNew?'➕ เพิ่ม Vendor ใหม่':'✏️ แก้ไข Vendor'}</div>
        ${inp('code','รหัสย่อ (เช่น SKIC)',v.code,'SKIC')}
        ${inp('name','ชื่อเต็มบริษัท',v.name,'บริษัท สยามคราฟท์อุตสาหกรรม จำกัด')}
        ${inp('addr','ที่อยู่',v.addr,'เลขที่ ถนน ตำบล อำเภอ จังหวัด')}
        <div style="display:flex;gap:8px;margin-top:4px">
          <button onclick="_vmSave(${idx})" style="flex:1;padding:11px;background:#1a5276;color:white;border:none;border-radius:10px;font-family:inherit;font-size:0.85rem;font-weight:800;cursor:pointer">💾 บันทึก</button>
          <button onclick="_vmCancelEdit()" style="flex:1;padding:11px;background:#f1f5f9;color:#64748b;border:none;border-radius:10px;font-family:inherit;font-size:0.85rem;font-weight:700;cursor:pointer">ยกเลิก</button>
        </div>
      </div>`;
    document.getElementById('vm_code')?.focus();
  };

  // header
  sheet.innerHTML = `
    <div style="padding:10px 0 0;display:flex;justify-content:center;flex-shrink:0">
      <div style="width:40px;height:4px;background:#e2e8f0;border-radius:99px"></div>
    </div>
    <div style="padding:14px 18px 12px;border-bottom:1px solid #f1f5f9;flex-shrink:0;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:1rem;font-weight:900;color:#0f172a">🏢 จัดการ Vendor / ลูกค้า</div>
        <div style="font-size:0.68rem;color:#94a3b8;margin-top:2px">แก้ไขรายชื่อบริษัทที่แสดงในใบเสนอราคา</div>
      </div>
      <button onclick="document.getElementById('_vendor_mgr_ov').remove()" style="width:30px;height:30px;border-radius:50%;background:#f1f5f9;border:none;cursor:pointer;color:#64748b;font-size:0.85rem">✕</button>
    </div>
    <div id="_vm_list" style="overflow-y:auto;flex:1;padding:14px 16px"></div>`;

  const listEl = sheet.querySelector('#_vm_list');
  renderVendorList();

  // helper fns
  window._vmAdd  = () => showEditForm(-1);
  window._vmEdit = (i) => showEditForm(i);
  window._vmCancelEdit = () => renderVendorList();
  window._vmDel  = (i) => {
    if (!confirm('ลบ Vendor นี้?')) return;
    if (!db.vendors || db.vendors.length===0) db.vendors = [...DEFAULT_VENDORS];
    db.vendors.splice(i, 1);
    saveDB(); renderVendorList();
    showToast('🗑️ ลบ Vendor แล้ว');
  };
  window._vmSave = (idx) => {
    const code = (document.getElementById('vm_code')?.value||'').trim().toUpperCase();
    const name = (document.getElementById('vm_name')?.value||'').trim();
    const addr = (document.getElementById('vm_addr')?.value||'').trim();
    if (!code || !name) { showToast('⚠️ กรุณากรอกรหัสและชื่อบริษัท'); return; }
    // If still using defaults, copy them first
    if (!db.vendors || db.vendors.length===0) db.vendors = DEFAULT_VENDORS.map(v=>({...v}));
    if (idx === -1) {
      db.vendors.push({ code, name, addr });
    } else {
      db.vendors[idx] = { code, name, addr };
    }
    saveDB();
    renderVendorList();
    showToast('✅ บันทึก Vendor แล้ว');
  };

  // close on backdrop
  ov.addEventListener('click', (e) => { if(e.target===ov) ov.remove(); });
  ov.appendChild(sheet);
  document.body.appendChild(ov);

  // slide up animation
  sheet.style.transform = 'translateY(100%)';
  sheet.style.transition = 'transform 0.3s cubic-bezier(0.32,0.72,0,1)';
  requestAnimationFrame(() => requestAnimationFrame(() => { sheet.style.transform = 'translateY(0)'; }));
}

function openRepairManager() {
  document.getElementById('_rm_page')?.remove();
  const page = document.createElement('div');
  page.id = '_rm_page';
  page.style.cssText = 'position:fixed;inset:0;z-index:9600;background:#f1f5f9;display:flex;flex-direction:column;animation:slideUp 0.25s cubic-bezier(0.32,0.72,0,1)';

  // init db.repairGroups จาก REPAIR_GROUPS ถ้ายังไม่มี
  if (!db.repairGroups || !db.repairGroups.length) {
    db.repairGroups = REPAIR_GROUPS.map(([label, items]) => ({
      label, icon: _grpIcon(label),
      items: items.map(name => ({ name, price: REPAIR_PRICE[name]||0, unit:'JOB' }))
    }));
  }

  let editGrpIdx = null; // null = list view, number = editing group

  const render = () => {
    if (editGrpIdx !== null) renderGroupEdit();
    else renderGroupList();
  };

  const _rmColors = [
    {bg:'#f0fdf4',accent:'#16a34a',border:'#bbf7d0',light:'#dcfce7'},
    {bg:'#f0f9ff',accent:'#0369a1',border:'#bae6fd',light:'#e0f2fe'},
    {bg:'#fef3c7',accent:'#d97706',border:'#fde68a',light:'#fefce8'},
    {bg:'#fdf2f8',accent:'#be185d',border:'#fbcfe8',light:'#fce7f3'},
    {bg:'#fff7ed',accent:'#c2410c',border:'#fed7aa',light:'#ffedd5'},
    {bg:'#f5f3ff',accent:'#7c3aed',border:'#ddd6fe',light:'#ede9fe'},
    {bg:'#ecfdf5',accent:'#065f46',border:'#a7f3d0',light:'#d1fae5'},
    {bg:'#eff6ff',accent:'#1d4ed8',border:'#bfdbfe',light:'#dbeafe'},
  ];
  const renderGroupList = () => {
    const totalItems = db.repairGroups.reduce((s,g)=>s+(g.items?.length||0),0);
    page.innerHTML = `
      <div style="background:linear-gradient(160deg,#1a0a0e 0%,#7f1d1d 50%,#c8102e 100%);padding:12px 16px 16px;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <button onclick="document.getElementById('_rm_page').remove()" style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);color:white;font-size:1.3rem;cursor:pointer;display:flex;align-items:center;justify-content:center;touch-action:manipulation">‹</button>
          <div style="flex:1">
            <div style="color:white;font-size:1rem;font-weight:900;letter-spacing:-0.01em">จัดการรายการงาน</div>
            <div style="color:rgba(255,255,255,.5);font-size:0.65rem;margin-top:3px">${db.repairGroups.length} หมวด · ${totalItems} รายการ</div>
          </div>
          <button onclick="window._rmAddGroup()" style="background:white;color:#c8102e;border:none;border-radius:12px;padding:9px 16px;font-size:0.78rem;font-weight:900;cursor:pointer;font-family:inherit;touch-action:manipulation;display:flex;align-items:center;gap:6px;box-shadow:0 3px 12px rgba(0,0,0,0.2)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c8102e" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>เพิ่มหมวด
          </button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
          <div style="background:rgba(255,255,255,.14);border-radius:12px;padding:10px 14px;border:1px solid rgba(255,255,255,.18)">
            <div style="font-size:0.55rem;color:rgba(255,255,255,.55);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">หมวดหมู่</div>
            <div style="font-size:1.6rem;font-weight:900;color:white;line-height:1">${db.repairGroups.length}</div>
          </div>
          <div style="background:rgba(255,255,255,.14);border-radius:12px;padding:10px 14px;border:1px solid rgba(255,255,255,.18)">
            <div style="font-size:0.55rem;color:rgba(255,255,255,.55);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">รายการทั้งหมด</div>
            <div style="font-size:1.6rem;font-weight:900;color:white;line-height:1">${totalItems}</div>
          </div>
        </div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:14px 14px 24px;background:#f8fafc">
        ${db.repairGroups.map((g, gi) => {
          const c = _rmColors[gi % _rmColors.length];
          const itemCount = g.items?.length||0;
          return `<div style="background:white;border-radius:18px;margin-bottom:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.07);border:1.5px solid ${c.border}">
            <div style="height:4px;background:${c.accent}"></div>
            <div style="display:flex;align-items:center;gap:12px;padding:13px 14px 10px">
              <div style="width:44px;height:44px;background:${c.bg};border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;border:1.5px solid ${c.border}">${g.icon||'📋'}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:0.92rem;font-weight:900;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g.label}</div>
                <span style="background:${c.light};color:${c.accent};border-radius:99px;padding:1px 8px;font-size:0.62rem;font-weight:800;margin-top:3px;display:inline-block">${itemCount} รายการ</span>
              </div>
              <div style="display:flex;gap:6px;flex-shrink:0">
                <button onclick="window._rmEditGroup(${gi})" style="padding:7px 14px;background:${c.bg};color:${c.accent};border:1.5px solid ${c.border};border-radius:10px;font-size:0.72rem;font-weight:800;cursor:pointer;font-family:inherit;touch-action:manipulation">✏️ แก้ไข</button>
                <button onclick="window._rmDelGroup(${gi})" style="width:34px;height:34px;background:#fff0f2;color:#dc2626;border:1.5px solid #fecaca;border-radius:10px;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;touch-action:manipulation">🗑</button>
              </div>
            </div>
            <div style="padding:0 14px 12px;display:flex;flex-wrap:wrap;gap:5px">
              ${(g.items||[]).slice(0,6).map(it=>`<span style="background:${c.light};border:1px solid ${c.border};border-radius:8px;padding:3px 10px;font-size:0.65rem;color:${c.accent};font-weight:700">${it.name}${it.price>0?` ฿${it.price.toLocaleString()}`:''}</span>`).join('')}
              ${(g.items||[]).length>6?`<span style="background:#f1f5f9;border-radius:8px;padding:3px 8px;font-size:0.62rem;color:#64748b;font-weight:600">+${(g.items||[]).length-6} อีก</span>`:''}
            </div>
          </div>`;
        }).join('')}
        <div style="text-align:center;padding-top:4px">
          <button onclick="window._rmReset()" style="font-size:0.72rem;color:#94a3b8;background:white;border:1px dashed #d1d5db;border-radius:10px;padding:10px 20px;cursor:pointer;font-family:inherit">🔄 รีเซ็ตเป็นค่าเริ่มต้น</button>
        </div>
      </div>`;
  };
  
  const renderGroupEdit = () => {
    const gi = editGrpIdx;
    const g = db.repairGroups[gi];
    const isNew = gi === db.repairGroups.length - 1 && !g._saved;
    const c = _rmColors[gi % _rmColors.length];
    page.innerHTML = `
      <!-- Header gradient แดง เหมือน list page -->
      <div style="background:linear-gradient(160deg,#1a0a0e 0%,#7f1d1d 50%,#c8102e 100%);padding:12px 16px 16px;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:12px">
          <button onclick="window._rmBackToList()" style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);color:white;font-size:1.3rem;cursor:pointer;display:flex;align-items:center;justify-content:center;touch-action:manipulation">‹</button>
          <div style="flex:1">
            <div style="color:white;font-size:1rem;font-weight:900;letter-spacing:-0.01em">${isNew?'เพิ่มหมวดใหม่':'แก้ไขหมวด'}</div>
            <div style="color:rgba(255,255,255,.5);font-size:0.65rem;margin-top:2px">${g.label||'หมวดใหม่'} · ${g.items?.length||0} รายการ</div>
          </div>
          <button onclick="window._rmSaveGroup()" style="background:white;color:#16a34a;border:none;border-radius:12px;padding:9px 16px;font-size:0.78rem;font-weight:900;cursor:pointer;font-family:inherit;touch-action:manipulation;box-shadow:0 2px 8px rgba(0,0,0,0.15)">💾 บันทึก</button>
        </div>
      </div>
      <!-- Edit form -->
      <div style="flex:1;overflow-y:auto;padding:14px 14px 24px;background:#f8fafc">
        <!-- Group name + icon card -->
        <div style="background:white;border-radius:18px;padding:16px;margin-bottom:12px;border:1.5px solid ${c.border};overflow:hidden;position:relative">
          <div style="height:3px;background:${c.accent};position:absolute;top:0;left:0;right:0;border-radius:18px 18px 0 0"></div>
          <div style="font-size:0.65rem;font-weight:900;color:${c.accent};text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px;margin-top:4px">ข้อมูลหมวด</div>
          <div style="display:flex;gap:10px;align-items:center">
            <!-- icon picker -->
            <div style="position:relative">
              <input id="rm-icon" value="${g.icon||'📋'}" placeholder="🔧"
                style="width:60px;height:60px;border:2px solid ${c.border};border-radius:14px;font-size:1.5rem;text-align:center;font-family:inherit;outline:none;background:${c.bg};cursor:pointer;box-sizing:border-box"/>
              <div style="position:absolute;bottom:-4px;right:-4px;width:18px;height:18px;background:${c.accent};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.55rem;color:white;pointer-events:none">✏️</div>
            </div>
            <!-- name input -->
            <div style="flex:1">
              <div style="font-size:0.62rem;color:#94a3b8;font-weight:700;margin-bottom:5px">ชื่อหมวด</div>
              <input id="rm-label" value="${g.label||''}" placeholder="เช่น PM / ล้างแอร์"
                style="width:100%;border:1.5px solid #e5e7eb;border-radius:10px;padding:11px 13px;font-size:0.92rem;font-family:inherit;font-weight:800;outline:none;box-sizing:border-box;color:#0f172a"
                onfocus="this.style.borderColor='${c.accent}'" onblur="this.style.borderColor='#e5e7eb'"/>
            </div>
          </div>
        </div>
        <!-- Items card -->
        <div style="background:white;border-radius:18px;overflow:hidden;border:1.5px solid #e5e7eb">
          <div style="padding:13px 16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;background:#fafbff">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:0.7rem;font-weight:900;color:#374151">รายการ</span>
              <span style="background:${c.light};color:${c.accent};border-radius:99px;padding:1px 8px;font-size:0.62rem;font-weight:800">${g.items?.length||0}</span>
            </div>
            <button onclick="window._rmAddItem()"
              style="font-size:0.75rem;color:white;background:#c8102e;border:none;border-radius:10px;padding:7px 14px;cursor:pointer;font-family:inherit;font-weight:800;touch-action:manipulation;display:flex;align-items:center;gap:5px">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              เพิ่มรายการ
            </button>
          </div>
          <div id="rm-items-list"></div>
        </div>
      </div>`;

    renderItems();
  };

  const renderItems = () => {
    const g = db.repairGroups[editGrpIdx];
    const el = document.getElementById('rm-items-list');
    if (!el) return;
    if (!g.items?.length) {
      el.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:0.82rem">ยังไม่มีรายการ — กดเพิ่มรายการ</div>';
      return;
    }
    const c2 = _rmColors[editGrpIdx % _rmColors.length];
    el.innerHTML = g.items.map((it, ii) => `
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #f8fafc">
        <!-- number badge -->
        <div style="width:26px;height:26px;background:${c2.light};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:900;color:${c2.accent};flex-shrink:0">${ii+1}</div>
        <div style="flex:1;min-width:0">
          <!-- name -->
          <input data-ii="${ii}" data-field="name" value="${it.name.replace(/"/g,'&quot;')}"
            style="width:100%;border:1.5px solid #e5e7eb;border-radius:10px;padding:9px 12px;font-size:0.85rem;font-family:inherit;font-weight:700;outline:none;margin-bottom:7px;box-sizing:border-box;color:#0f172a"
            placeholder="ชื่อรายการงาน" oninput="window._rmUpdateItem(${ii},'name',this.value)"/>
          <!-- price + unit row -->
          <div style="display:flex;gap:7px;align-items:center">
            <div style="flex:1;position:relative">
              <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:0.75rem;color:#94a3b8;font-weight:800;pointer-events:none">฿</span>
              <input data-ii="${ii}" data-field="price" type="number" value="${it.price||0}"
                style="width:100%;border:1.5px solid #e5e7eb;border-radius:10px;padding:9px 10px 9px 26px;font-size:0.85rem;font-family:inherit;font-weight:800;outline:none;box-sizing:border-box;color:#0369a1"
                placeholder="0" oninput="window._rmUpdateItem(${ii},'price',parseFloat(this.value)||0)"/>
            </div>
            <select data-ii="${ii}" data-field="unit" onchange="window._rmUpdateItem(${ii},'unit',this.value)"
              style="width:78px;border:1.5px solid #e5e7eb;border-radius:10px;padding:9px 6px;font-size:0.78rem;font-family:inherit;outline:none;flex-shrink:0;background:white;font-weight:700;color:#374151">
              ${['JOB','EA','KG','HOUR','M'].map(u=>`<option value="${u}" ${it.unit===u?'selected':''}>${u}</option>`).join('')}
            </select>
          </div>
        </div>
        <button onclick="window._rmDelItem(${ii})" style="width:34px;height:34px;background:#fff0f2;border:1.5px solid #fecaca;border-radius:10px;cursor:pointer;color:#dc2626;font-size:0.9rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;touch-action:manipulation">🗑</button>
      </div>`).join('');
  };

  // ── Handlers ──
  window._rmEditGroup = (gi) => { editGrpIdx = gi; render(); };
  window._rmBackToList = () => { editGrpIdx = null; render(); };
  window._rmAddGroup = () => {
    db.repairGroups.push({ label:'หมวดใหม่', icon:'📋', items:[], _saved:false });
    editGrpIdx = db.repairGroups.length-1;
    render();
  };
  window._rmDelGroup = (gi) => {
    if (!confirm(`ลบหมวด "${db.repairGroups[gi].label}" และรายการทั้งหมด?`)) return;
    db.repairGroups.splice(gi,1);
    saveDB(); render();
  };
  window._rmAddItem = () => {
    const g = db.repairGroups[editGrpIdx];
    if (!g.items) g.items=[];
    g.items.push({ name:'', price:0, unit:'JOB' });
    renderItems();
    // focus last input
    setTimeout(()=>{ const inputs=document.querySelectorAll('#rm-items-list input[data-field="name"]'); inputs[inputs.length-1]?.focus(); },100);
  };
  window._rmDelItem = (ii) => {
    db.repairGroups[editGrpIdx].items.splice(ii,1);
    renderItems();
  };
  window._rmUpdateItem = (ii, field, val) => {
    if (!db.repairGroups[editGrpIdx].items[ii]) return;
    db.repairGroups[editGrpIdx].items[ii][field] = val;
  };
  window._rmSaveGroup = () => {
    const g = db.repairGroups[editGrpIdx];
    const labelEl = document.getElementById('rm-label');
    const iconEl  = document.getElementById('rm-icon');
    if (labelEl) g.label = labelEl.value.trim() || g.label;
    if (iconEl)  g.icon  = iconEl.value.trim() || g.icon;
    // sync items from inputs
    document.querySelectorAll('#rm-items-list input[data-field="name"]').forEach(inp => {
      const ii = parseInt(inp.dataset.ii);
      if (g.items[ii] !== undefined) g.items[ii].name = inp.value.trim();
    });
    document.querySelectorAll('#rm-items-list input[data-field="price"]').forEach(inp => {
      const ii = parseInt(inp.dataset.ii);
      if (g.items[ii] !== undefined) g.items[ii].price = parseFloat(inp.value)||0;
    });
    // ลบ items ที่ name ว่าง
    g.items = (g.items||[]).filter(it=>it.name);
    g._saved = true;
    saveDB();
    showToast('💾 บันทึกหมวด "'+g.label+'" แล้ว');
    editGrpIdx = null;
    render();
  };
  window._rmReset = () => {
    if (!confirm('รีเซ็ตรายการงานทั้งหมดเป็นค่าเริ่มต้น?')) return;
    db.repairGroups = [];
    saveDB();
    showToast('🔄 รีเซ็ตแล้ว');
    render();
  };

  render();
  document.body.appendChild(page);
}
function addRepairItem(sel) {
  const val = sel.value; if(!val) return;
  const tags = document.getElementById('c-repair-tags');
  const existing = [...tags.querySelectorAll('.rtag')].find(t=>t.dataset.val===val);
  if (existing) {
    const qEl=existing.querySelector('.rtag-qty');
    if(qEl){const c=parseInt(qEl.textContent.replace('×',''))||1;qEl.textContent='×'+(c+1);existing.dataset.qty=c+1;}
    sel.value=''; updateRepairCount(); return;
  }
  const tag = document.createElement('div');
  tag.className='rtag'; tag.dataset.val=val; tag.dataset.qty='1';
  tag.style.cssText='display:flex;align-items:center;gap:5px;background:#fff0f2;border:1.5px solid #fecdd3;border-radius:8px;padding:5px 10px;font-size:0.72rem;font-weight:700;color:#c8102e;max-width:100%;transition:transform 0.15s';
  const txt=document.createElement('span');
  txt.style.cssText='flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  txt.textContent=val;
  const qty=document.createElement('span'); qty.className='rtag-qty';
  qty.style.cssText='background:#c8102e;color:white;border-radius:99px;padding:1px 6px;font-size:0.6rem;font-weight:800;flex-shrink:0;min-width:22px;text-align:center;cursor:pointer';
  qty.textContent='×1'; qty.title='กดเพื่อลด';
  qty.onclick=()=>{
    const c=parseInt(qty.textContent.replace('×',''))||1;
    if(c<=1){removePartRowByName(tag.dataset.val);tag.remove();}else{qty.textContent='×'+(c-1);tag.dataset.qty=c-1;}
    updateRepairCount();
  };
  const del=document.createElement('button'); del.innerHTML='✕';
  del.style.cssText='background:none;border:none;cursor:pointer;color:#ef4444;font-size:0.72rem;padding:0;flex-shrink:0;line-height:1';
  del.onclick=()=>{ removePartRowByName(tag.dataset.val); tag.remove(); updateRepairCount(); };
  tag.append(txt,qty,del); tags.appendChild(tag);
  sel.value=''; updateRepairCount();
}
function removePartRowByName(name) {
  // ลบ row ในตาราง c-parts-list ที่ชื่อตรงกับ name
  const rows = document.querySelectorAll('#c-parts-list > div');
  rows.forEach(row => {
    const input = row.querySelector('.c-part-name');
    if (input && input.value === name) row.remove();
  });
  // ถ้าไม่มี row เหลือ → ซ่อน block
  const remaining = document.querySelectorAll('#c-parts-list > div').length;
  if (!remaining) {
    const pb = document.getElementById('c-parts-block');
    if (pb) pb.style.display = 'none';
  }
}

function formatSummary(text) {
  if (!text) return '—';
  var lines = [];
  // แยก repairPart (ก่อน —) ออกเสมอ เพื่อแสดงเป็น bullet list
  if (text.includes('\n')) {
    lines = text.split('\n').filter(function(l){return l.trim();});
  } else if (text.includes(' — ')) {
    var dashIdx = text.indexOf(' — ');
    var repairPart = text.slice(0, dashIdx).trim();
    var descPart   = text.slice(dashIdx + 3).replace(/^[-\s]+/, '').trim();
    // repairPart แตก ด้วย ', '
    var repairLines = repairPart ? repairPart.split(', ').filter(function(l){return l.trim();}) : [];
    // descPart: ถ้าเหมือนกับ repairPart ทั้งหมด หรือเป็น subset → ตัดทิ้ง ไม่ซ้ำ
    var descClean = '';
    if (descPart) {
      // ตัดส่วนที่ซ้ำกับ repairPart ออก (กรณี old data copy repairItems ไปใน description)
      var descItems = descPart.replace(/ - /g,'\n').split('\n').map(function(l){return l.replace(/^[-\s]+/,'').trim();}).filter(Boolean);
      var repairSet = repairLines.map(function(l){return l.trim();});
      var newDesc = descItems.filter(function(l){ return repairSet.indexOf(l)<0; });
      descClean = newDesc.join('\n');
    }
    var descLines = descClean ? descClean.split('\n').filter(function(l){return l.trim();}) : [];
    lines = repairLines.concat(descLines);
  } else if (text.includes(', ')) {
    lines = text.split(', ').filter(function(l){return l.trim();});
  }
  if (lines.length > 1) {
    return lines.map(function(l){
      var safe = escapeHtml(l.replace(/^[-–\s]+/,'').trim());
      return '<div style="display:flex;gap:7px;align-items:flex-start;margin-bottom:5px;padding:4px 8px;background:#f8fafc;border-radius:7px;border-left:3px solid #c8102e">'
        + '<span style="color:#c8102e;font-weight:900;flex-shrink:0;font-size:0.85rem;line-height:1.4">•</span>'
        + '<span style="flex:1;font-size:0.82rem;font-weight:600;color:#1e293b;line-height:1.5">' + safe + '</span></div>';
    }).join('');
  }
  // PATCH audit-XSS1: escape plain text
  return '<div style="font-size:0.82rem;color:#1e293b;font-weight:500">' + escapeHtml(text) + '</div>';
}


function updateRepairCount(){
  const tags=[...document.querySelectorAll('#c-repair-tags .rtag')];
  const n=tags.length;
  const total=tags.reduce((s,t)=>s+parseInt(t.dataset.qty||1),0);
  const el=document.getElementById('c-repair-count');
  if(el) el.textContent = total>n ? n+' รายการ (รวม '+total+' ครั้ง)' : n+' รายการ';
  // เมื่อไม่มีรายการเหลือ → reset ฟอร์มทั้งหมด
  if (n === 0) {
    // ซ่อนและล้างตารางอะไหล่
    const pb = document.getElementById('c-parts-block');
    if (pb) {
      pb.style.display = 'none';
      const pl = document.getElementById('c-parts-list');
      if (pl) pl.innerHTML = `<div style="display:flex;gap:7px;align-items:center">
        <input type="text" placeholder="ชื่ออะไหล่..." class="c-part-name" style="flex:3;font-size:0.85rem;padding:9px 10px;border:1.5px solid #fde68a;border-radius:9px;font-family:inherit"/>
        <input type="number" placeholder="จำนวน" class="c-part-qty" style="width:80px;font-size:0.85rem;padding:9px 8px;border:1.5px solid #fde68a;border-radius:9px;font-family:inherit;text-align:center"/>
      </div>`;
    }
    // ล้างสรุปผล
    const sumEl = document.getElementById('c-sum');
    if (sumEl) sumEl.value = '';
    // reset น้ำยาแอร์
    if (typeof resetRefrigRows === 'function') resetRefrigRows();
    // ล้างรูปถ่าย
    const grid = document.getElementById('c-grid');
    if (grid) grid.innerHTML = '';
    const gridB = document.getElementById('c-grid-before');
    if (gridB) gridB.innerHTML = '';
    if (typeof pendingPhotos !== 'undefined') { pendingPhotos.after = []; pendingPhotos.before = []; }
  }
}
function toggleCheckCard(id, cb) {
  document.getElementById(id).classList.toggle('active', cb.checked);
}
function selectResult(activeId) {
  ['cr-ok','cr-partial','cr-part'].forEach(id => {
    document.getElementById(id)?.classList.toggle('active', id===activeId);
  });
}
function addPartRow() {
  const list = document.getElementById('c-parts-list');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;align-items:center';
  row.innerHTML = `<input type="text" placeholder="ชื่ออะไหล่..." style="flex:2;font-size:0.78rem;padding:7px 8px;border:1.5px solid #fde68a;border-radius:8px;font-family:inherit" class="c-part-name"/>
    <input type="number" placeholder="จำนวน" style="width:70px;font-size:0.78rem;padding:7px 8px;border:1.5px solid #fde68a;border-radius:8px;font-family:inherit" class="c-part-qty"/>
    <button onclick="this.parentElement.remove()" style="width:26px;height:26px;border-radius:50%;background:#fee2e2;border:none;cursor:pointer;color:#dc2626;font-size:0.85rem;font-weight:800;flex-shrink:0;display:flex;align-items:center;justify-content:center">×</button>`;
  list.appendChild(row);
}
function syncSummaryFromForm() {
  const sumEl = document.getElementById('c-sum');
  if (!sumEl) return;
  // BTU fix: ดึง BTU จริงของเครื่องเพื่อแปลงชื่อรายการ
  const _sfTid = document.getElementById('c-tid')?.value || '';
  const _sfTicket = _sfTid ? db.tickets?.find(x=>x.id===_sfTid) : null;
  const _sfMac = _sfTicket ? getMacMap().get(_sfTicket.machineId) : null;
  const _sfBtu = _sfMac?.btu ? Number(_sfMac.btu) : 0;
  const parts = [];
  document.querySelectorAll('#c-repair-tags .rtag').forEach(tag => {
    const qty = parseInt(tag.dataset.qty)||1;
    const rawName = tag.dataset.val;
    const displayName = (typeof formatItemName === 'function') ? formatItemName(rawName, _sfBtu) : rawName;
    parts.push(qty>1 ? `${displayName} ×${qty}` : displayName);
  });
  document.querySelectorAll('#c-refrig-list .c-refrig-row').forEach(row => {
    const type = row.querySelector('.c-ref-type')?.value;
    const kg   = row.querySelector('.c-ref-kg')?.value;
    if (type) parts.push(`สารทำความเย็นและน้ำยาล้างระบบ ${type}${kg ? ' '+kg+'กก.' : ''}`);
  });
  if (parts.length) sumEl.value = parts.map(s=>'- '+s).join('\n');
}

function addRefrigRow() {
  const list = document.getElementById('c-refrig-list');
  const row = document.createElement('div');
  row.className = 'c-refrig-row';
  row.style.cssText = 'display:flex;gap:6px;align-items:center';
  row.innerHTML = `
    <select class="c-ref-type" onchange="syncSummaryFromForm()" style="flex:2;font-size:0.78rem;padding:7px 8px;border:1.5px solid #d1fae5;border-radius:8px;font-family:inherit;background:white">
      <option value="">— ไม่ใช้ —</option>
      <option value="R-22">R-22</option><option value="R-32">R-32</option>
      <option value="R-410A">R-410A</option><option value="R-134A">R-134A</option>
      <option value="R-407C">R-407C</option><option value="R-141B">R-141B</option>
    </select>
    <input type="number" placeholder="กก." step="0.5" class="c-ref-kg" oninput="syncSummaryFromForm()" style="width:65px;font-size:0.82rem;padding:7px 8px;border:1.5px solid #d1fae5;border-radius:8px;font-family:inherit;box-sizing:border-box"/>
    <button onclick="removeRefrigRow(this)" style="width:26px;height:26px;border-radius:50%;background:#fee2e2;border:none;cursor:pointer;color:#dc2626;font-size:0.85rem;font-weight:800;flex-shrink:0;display:flex;align-items:center;justify-content:center">×</button>`;
  list.appendChild(row);
}
function removeRefrigRow(btn) {
  const rows = document.querySelectorAll('#c-refrig-list .c-refrig-row');
  if (rows.length <= 1) {
    // ถ้าแถวเดียว ล้างค่าแทนลบ
    btn.closest('.c-refrig-row').querySelector('.c-ref-type').value = '';
    btn.closest('.c-refrig-row').querySelector('.c-ref-kg').value = '';
  } else {
    btn.closest('.c-refrig-row').remove();
  }
}
function resetRefrigRows() {
  const list = document.getElementById('c-refrig-list');
  list.innerHTML = `<div style="display:flex;gap:6px;align-items:center" class="c-refrig-row">
    <select class="c-ref-type" onchange="syncSummaryFromForm()" style="flex:2;font-size:0.78rem;padding:7px 8px;border:1.5px solid #d1fae5;border-radius:8px;font-family:inherit;background:white">
      <option value="">— ไม่ใช้ —</option>
      <option value="R-22">R-22</option><option value="R-32">R-32</option>
      <option value="R-410A">R-410A</option><option value="R-134A">R-134A</option>
      <option value="R-407C">R-407C</option><option value="R-141B">R-141B</option>
    </select>
    <input type="number" placeholder="กก." step="0.5" class="c-ref-kg" oninput="syncSummaryFromForm()" style="width:65px;font-size:0.82rem;padding:7px 8px;border:1.5px solid #d1fae5;border-radius:8px;font-family:inherit;box-sizing:border-box"/>
    <button onclick="removeRefrigRow(this)" style="width:26px;height:26px;border-radius:50%;background:#fee2e2;border:none;cursor:pointer;color:#dc2626;font-size:0.85rem;font-weight:800;flex-shrink:0;display:flex;align-items:center;justify-content:center">×</button>
  </div>`;
}
function openCompleteSheetDialog(tid) {
  openCompleteSheet(tid);
}
function _showCompleteDialog() {
  const el = document.getElementById('complete-sheet');
  if (!el) return;
  el.style.display = 'flex';
  // close on backdrop tap
  el._backdropHandler = (e) => { if (e.target === el) closeCompleteSheet(); };
  el.addEventListener('click', el._backdropHandler);
}
function closeCompleteSheet() {
  const el = document.getElementById('complete-sheet');
  if (!el) return;
  el.style.display = 'none';
  if (el._backdropHandler) el.removeEventListener('click', el._backdropHandler);
  const bgrid = document.getElementById('c-grid-before');
  if (bgrid) bgrid.innerHTML = '';
  if (typeof pendingPhotos !== 'undefined') pendingPhotos.before = [];
  // ซ่อนและ reset ทุกอย่างทันที
  const pb = document.getElementById('c-parts-block');
  if (pb) { pb.style.display = 'none'; }
  const rt = document.getElementById('c-repair-tags');
  if (rt) { rt.innerHTML = ''; }
  const rc = document.getElementById('c-repair-count');
  if (rc) { rc.textContent = '0 รายการ'; }
  const cs = document.getElementById('c-sum');
  if (cs) { cs.value = ''; }
}

function openCompleteSheet(tid) {
  // ── RESET ทุกอย่างก่อนเสมอ ──
  const _pb = document.getElementById('c-parts-block');
  if (_pb) { _pb.style.display = 'none'; }
  const _rt = document.getElementById('c-repair-tags');
  if (_rt) { _rt.innerHTML = ''; }
  const _sum = document.getElementById('c-sum');
  if (_sum) { _sum.value = ''; }
  // re-enable options ที่ disabled ค้างจากครั้งก่อน
  document.querySelectorAll('#c-repair-item option').forEach(o => { o.disabled=false; o.style.color=''; });
  // init chip groups
  initRepairGroups();
  resetCompleteExtras();
  // reset chip selections
  document.querySelectorAll('#c-repair-groups button[data-val]').forEach(c=>{c.style.background='white';c.style.borderColor='#e2e8f0';c.style.color='#374151';});
  const countEl = document.getElementById('c-repair-count');
  if (countEl) countEl.textContent = '0 รายการ';
  const t = db.tickets.find(x=>x.id===tid); if(!t)return;
  document.getElementById('c-tid').value = tid;

  // ── ข้อมูลงานใน header strip ──
  document.getElementById('c-header-sub').textContent = t.id;
  const strip = document.getElementById('c-job-strip');
  if (strip) {
    const _csMac = getMacMap().get(t.machineId);
    const _csBtu = _csMac?.btu ? Number(_csMac.btu).toLocaleString() + ' BTU' : '';
    const _csDept = _csMac?.dept || t.dept || '';
    const _csVendor = _csMac?.vendor || t.vendor || '';
    // compact single-row layout — ป้องกัน header ล้นจอ
    strip.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.82rem;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.problem)||'—'}</div>
          <div style="font-size:0.65rem;color:#64748b;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ❄️ ${t.machine||'—'}${_csBtu?' · 🌡️ '+_csBtu:''}${_csDept?' · 🏢 '+_csDept:''}
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <span class="tag ${stc(t.status)}" style="font-size:0.58rem;padding:2px 7px">${sTH(t.status)}</span>
          <span class="tag ${prC(t.priority)}" style="font-size:0.58rem;padding:2px 7px">${prTH(t.priority)}</span>
        </div>
      </div>`;

  // ── แสดงอะไหล่ที่สั่งซื้อ (ถ้ามี) ──
  // แสดง/ซ่อน parts block
  const partsBlock = document.getElementById('c-parts-block');
  const pb = document.getElementById('c-purchase-block');
  const tr = t.techRequest;
  const po = t.purchaseOrder;
  const hasPurchase = tr?.rows?.some(r=>r.name) || po?.rows?.some(r=>r.name);

  // แสดง parts เฉพาะ: มีการสั่งซื้อจริง (PO ที่ purchasing=true หรือ received)
  if (partsBlock) {
    const hasPO = !!(po?.purchasing || po?.receiveStatus === 'received' || po?.po);
    partsBlock.style.display = hasPO ? 'block' : 'none';
  }
  if (hasPurchase) {
    const srcRows = po?.rows?.filter(r=>r.name) || tr?.rows?.filter(r=>r.name) || [];
    const srcLabel = po ? 'ใบสั่งซื้อ (PO)' : 'รายการแจ้งช่าง';
    const docBadges = [
      po?.pr ? `<span style="background:#fff7ed;color:#e65100;border:1px solid #fed7aa;border-radius:5px;padding:1px 7px;font-size:0.65rem;font-weight:700">PR: ${po.pr}</span>` : '',
      po?.po ? `<span style="background:#f5f3ff;color:#7c3aed;border:1px solid #c4b5fd;border-radius:5px;padding:1px 7px;font-size:0.65rem;font-weight:700">PO: ${po.po}</span>` : '',
    ].filter(Boolean).join('');
    const rowsHtml = srcRows.map((r,i)=>`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;${i>0?'border-top:1px solid #e0f2fe':''}">
        <div style="display:flex;align-items:center;gap:7px">
          <div style="width:20px;height:20px;border-radius:50%;background:#0ea5e9;color:white;font-size:0.6rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
          <span style="font-size:0.8rem;font-weight:600;color:#0f172a">${r.name}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:0.75rem;color:#64748b">×${r.qty||1}</span>
          ${r.price ? `<span style="font-size:0.72rem;font-weight:700;color:#0369a1">฿${Number(r.price).toLocaleString()}</span>` : ''}
        </div>
      </div>`).join('');
    const totalHtml = po?.total ? `
      <div style="border-top:2px solid #bae6fd;margin-top:6px;padding-top:6px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:0.7rem;color:#0369a1;font-weight:700">มูลค่ารวม</span>
        <span style="font-size:0.88rem;font-weight:900;color:#0369a1">฿${Number(po.total).toLocaleString()}</span>
      </div>` : '';

    pb.innerHTML = `
      <div style="background:#f0f9ff;border:1.5px solid #7dd3fc;border-radius:12px;overflow:hidden">
        <div style="background:#0ea5e9;padding:8px 13px;display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:0.88rem">📦</span>
            <span style="color:white;font-size:0.72rem;font-weight:800">อะไหล่ที่สั่งซื้อ — ${srcLabel}</span>
          </div>
          <div style="display:flex;gap:4px">${docBadges}</div>
        </div>
        <div style="padding:8px 13px">
          ${rowsHtml}
          ${totalHtml}
          <div style="margin-top:8px;background:#e0f2fe;border-radius:8px;padding:6px 10px;font-size:0.68rem;color:#0369a1;display:flex;align-items:center;gap:5px">
            <span>💡</span>
            <span>รายการด้านล่างจะถูกกรอกอัตโนมัติแล้ว — ตรวจสอบและแก้ไขได้</span>
          </div>
        </div>
      </div>`;
    pb.style.display = 'block';

    // ── กรอกข้อมูลอะไหล่ลงฟอร์มอัตโนมัติ ──
    const list = document.getElementById('c-parts-list');
    list.innerHTML = '';
    srcRows.forEach(r => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;align-items:center';
      row.innerHTML = `
        <input type="text" value="${r.name}" style="flex:2;font-size:0.78rem;padding:7px 8px;border:1.5px solid #fde68a;border-radius:8px;font-family:inherit" class="c-part-name"/>
        <input type="number" value="${r.qty||1}" style="width:70px;font-size:0.78rem;padding:7px 8px;border:1.5px solid #fde68a;border-radius:8px;font-family:inherit" class="c-part-qty"/>`;
      list.appendChild(row);
    });
    // ถ้าไม่มีรายการเลย ใส่ row ว่าง
    if (!srcRows.length) {
      list.innerHTML = `<div style="display:flex;gap:6px;align-items:center">
        <input type="text" placeholder="ชื่ออะไหล่..." style="flex:2;font-size:0.78rem;padding:7px 8px;border:1.5px solid #fde68a;border-radius:8px;font-family:inherit" class="c-part-name"/>
        <input type="number" placeholder="จำนวน" style="width:70px;font-size:0.78rem;padding:7px 8px;border:1.5px solid #fde68a;border-radius:8px;font-family:inherit" class="c-part-qty"/>
      </div>`;
    }
  } else {
    pb.style.display = 'none';
    pb.innerHTML = '';
    // รีเซ็ตอะไหล่
    document.getElementById('c-parts-list').innerHTML = `<div style="display:flex;gap:6px;align-items:center">
      <input type="text" placeholder="ชื่ออะไหล่..." style="flex:2;font-size:0.78rem;padding:7px 8px;border:1.5px solid #fde68a;border-radius:8px;font-family:inherit" class="c-part-name"/>
      <input type="number" placeholder="จำนวน" style="width:70px;font-size:0.78rem;padding:7px 8px;border:1.5px solid #fde68a;border-radius:8px;font-family:inherit" class="c-part-qty"/>
    </div>`;
  }

  // ── รีเซ็ตฟิลด์อื่นๆ ──
  ['c-sum'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  resetRefrigRows();
  document.getElementById('c-repair-tags').innerHTML = '';
  const ri = document.getElementById('c-repair-item'); if(ri) ri.value='';
  pendingPhotos.after = [];
  pendingPhotos.before = [];
  document.getElementById('c-grid').innerHTML = '';

  // ── แสดงรูปก่อนซ่อมจากผู้แจ้ง (ถ้ามี) ──
  const beforeSection = document.getElementById('c-before-section');
  const reporterPhotos = t.photosBefore || [];
  if (beforeSection) {
    if (reporterPhotos.length > 0) {
      beforeSection.style.display = 'block';
      // แสดง thumbnail รูปที่ผู้แจ้งส่งมา (read-only preview)
      const previewId = 'c-reporter-photos-preview';
      let previewEl = document.getElementById(previewId);
      if (!previewEl) {
        previewEl = document.createElement('div');
        previewEl.id = previewId;
        previewEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:6px';
        beforeSection.querySelector('.photo-upload')?.before(previewEl);
      }
      previewEl.innerHTML = reporterPhotos.map((src, i) =>
        `<div style="position:relative;flex-shrink:0">
          <img src="${src}" onclick="openLightbox('${src}')"
            style="width:68px;height:68px;object-fit:cover;border-radius:10px;border:2px solid #fed7aa;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.1)"/>
          <div style="position:absolute;bottom:2px;right:2px;background:rgba(194,65,12,0.85);color:white;border-radius:4px;padding:1px 4px;font-size:0.5rem;font-weight:800">ผู้แจ้ง</div>
        </div>`
      ).join('');
      // แสดง info badge
      let infoBadge = document.getElementById('c-before-info');
      if (!infoBadge) {
        infoBadge = document.createElement('div');
        infoBadge.id = 'c-before-info';
        infoBadge.style.cssText = 'background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:6px 10px;display:flex;align-items:center;gap:6px;font-size:0.7rem;color:#92400e;font-weight:600;margin-bottom:6px';
        infoBadge.innerHTML = `<span>📋</span><span>ผู้แจ้งส่งรูปมา ${reporterPhotos.length} รูป — จะถูกบันทึกเป็นรูปก่อนซ่อมในรายงานอัตโนมัติ</span>`;
        previewEl.before(infoBadge);
      }
      // copy รูปผู้แจ้งเข้า pendingPhotos.before เพื่อบันทึกด้วย
      pendingPhotos.before = [...reporterPhotos];
    } else {
      beforeSection.style.display = 'none';
      const previewEl = document.getElementById('c-reporter-photos-preview');
      if (previewEl) previewEl.innerHTML = '';
      const infoBadge = document.getElementById('c-before-info');
      if (infoBadge) infoBadge.remove();
    }
  }

  _showCompleteDialog();
}
} // ── end openCompleteSheet ──
async function doComplete( /* PATCH v67 */) {
  const tid = document.getElementById('c-tid').value;
  const t = db.tickets.find(x=>x.id===tid); if(!t)return;
  const sum = document.getElementById('c-sum').value.trim();
  const tags = [...document.querySelectorAll('#c-repair-tags .rtag')];

  // ── Validation — scroll to missing field ──
  const errors = [];
  if (!tags.length) errors.push({msg:'เลือกรายการงานที่ดำเนินการ', el: document.querySelector('#complete-sheet [onclick="openRepairPicker()"]')});
  if (!sum) errors.push({msg:'กรอกสรุปผลการดำเนินการ', el: document.getElementById('c-sum')});
  if (errors.length) {
    const first = errors[0];
    showToast('⚠️ ' + errors.map(e=>e.msg).join(' และ '));
    if (first.el) {
      first.el.scrollIntoView({behavior:'smooth', block:'center'});
      setTimeout(() => {
        first.el.style.outline = '2.5px solid #c8102e';
        first.el.style.borderRadius = '12px';
        if (first.el.focus) first.el.focus();
        setTimeout(() => { first.el.style.outline = ''; }, 2000);
      }, 400);
    }
    return;
  }

  // ── PATCH audit-C2: outer try-catch ป้องกัน crash เงียบ ──
  try {

  const now = nowStr();
  // ── BTU fix: แสดง BTU จริงของเครื่องใน summary แทน K-range ──
  const _cMac = getMacMap ? getMacMap().get(t.machineId) : null;
  const _cBtu = _cMac?.btu ? Number(_cMac.btu) : 0;
  const repairItems = tags.map(el=>{
    const qty=parseInt(el.dataset.qty||1);
    const rawName = el.dataset.val;
    const displayName = (typeof formatItemName === 'function') ? formatItemName(rawName, _cBtu) : rawName;
    return qty>1 ? displayName+' ×'+qty : displayName;
  }).filter(Boolean);

  // อะไหล่
  const partNames = [...document.querySelectorAll('.c-part-name')].map(el=>el.value.trim()).filter(Boolean);
  const partQtys  = [...document.querySelectorAll('.c-part-qty')].map(el=>el.value.trim());
  const partsList = partNames.map((n,i)=>n+(partQtys[i]?` x${partQtys[i]}`:'')).join(', ');

  // น้ำยา
  const refrigPairs = [...document.querySelectorAll('#c-refrig-list .c-refrig-row')].map(row => {
    const type = row.querySelector('.c-ref-type')?.value;
    const kg   = row.querySelector('.c-ref-kg')?.value;
    return type ? type+(kg?' '+kg+'กก.':'') : '';
  }).filter(Boolean);
  const refStr = refrigPairs.join(', ');
  const allParts = [refStr, partsList].filter(Boolean).join(' | ');

  const repairStr = repairItems.join('\n');
  // ── Bug6 fix: กัน sum ซ้ำ repairItems ──
  // syncSummaryFromForm() pre-fill c-sum ด้วย "- item1\n- item2..." เหมือน repairStr
  // ถ้า user ไม่แก้ไข c-sum ก็จะซ้ำกัน → strip รายการที่ซ้ำออก เก็บเฉพาะ manual note
  const repairSet = new Set(repairItems.map(s => s.trim().replace(/^[-\s]+/,'')));
  const sumLines = sum.split('\n').map(l => l.trim().replace(/^[-\s•]+/,'').trim()).filter(Boolean);
  const manualLines = sumLines.filter(l => !repairSet.has(l));
  const manualNote = manualLines.join('\n');
  t.summary = (repairStr ? repairStr + (manualNote ? '\n' + manualNote : '') : sum);
  t.parts   = allParts;
  // คำนวณ repairCost จาก price list
  const _rg = _getRepairGroups ? _getRepairGroups() : (db.repairGroups||[]);
  let _rc = 0;
  tags.forEach(el => {
    const name=el.dataset.val, qty=parseInt(el.dataset.qty||1);
    let price=0;
    for(const g of _rg){const it=g.items?.find(i=>i.name===name);if(it){price=it.price||0;break;}}
    if(!price&&typeof REPAIR_PRICE!=='undefined') price=REPAIR_PRICE[name]||0;
    _rc += price*qty;
  });
  t.repairCost = _rc;
  // partsCost = PO total (ใช้ค่าล่าสุด ไม่ให้ 0 ทับค่าเดิมที่บันทึกไว้)
  const _poTotal = Number(t.purchaseOrder?.total || 0);
  t.partsCost = Math.max(_poTotal, Number(t.partsCost || 0));
  t.cost = Number(t.repairCost || 0) + Number(t.partsCost || 0) || Number(t.cost) || 0;
  // ── PATCH v67: upload photos → Firebase Storage ก่อน assign ──
  if (typeof uploadPendingPhotosToStorage === 'function') {
    showToast('⏳ กำลัง upload รูปภาพ...');
    await uploadPendingPhotosToStorage(t.id);
  }
  t.photosAfter = [...pendingPhotos.after];
  // pendingPhotos.before มีรูปผู้แจ้ง + รูปที่ช่างเพิ่มเอง (ถ้ามี)
  // ใช้ Set เพื่อกัน duplicate ในกรณี merge
  if (pendingPhotos.before.length) {
    const existing = new Set(t.photosBefore||[]);
    const merged = [...(t.photosBefore||[])];
    pendingPhotos.before.forEach(p => { if (!existing.has(p)) merged.push(p); });
    t.photosBefore = merged;
  }
  t.status  = 'done';
  t.updatedAt = now;
  t.history.push({act:'✅ ซ่อมเสร็จ', by:CU.name, at:now, detail:t.summary});
  notifyUser(t.reporterId,'🎉 ซ่อมเสร็จแล้ว! รอตรวจรับ','งาน ['+tid+'] "'+t.problem+'" เสร็จแล้ว กรุณาตรวจรับ',tid);
  notifyRole('admin','✅ งานซ่อมเสร็จ ['+tid+']','ช่าง '+CU.name+' ซ่อมเสร็จ รอปิดงาน',tid);
  showAdminCard('✅ ซ่อมเสร็จแล้ว ['+tid+']', 'ช่าง '+CU.name+' รอตรวจรับ', tid, '✅');
  sendLineNotifyEvent('done', t);
  saveDB(); syncTicket(t); pendingPhotos.after=[];
  closeCompleteSheet();
  refreshPage(); // refresh ก่อนเสมอ เพื่อให้ UI อัพเดทแม้ signature pad crash
  showToast('✅ บันทึกผลการซ่อมแล้ว — กรุณาเซ็นชื่อ');
  if (navigator.vibrate) navigator.vibrate([100,50,200]);
  try { setTimeout(() => openSignaturePad(tid, 'tech_done'), 500); } catch(e) {}

  } catch(e) {
    console.error('[doComplete] error:', e);
    showToast('❌ เกิดข้อผิดพลาดในการบันทึก: ' + (e.message || 'กรุณาลองใหม่'));
  }
}

function selectVerifyResult(val) {
  const isOk = val === 'verified';
  const cardOk     = document.getElementById('v-card-ok');
  const cardReject = document.getElementById('v-card-reject');
  const btn        = document.getElementById('v-confirm-btn');
  const rejectIcon = document.getElementById('v-reject-icon');
  const rejectSub  = document.getElementById('v-reject-sub');
  if (cardOk) {
    cardOk.style.background  = isOk ? '#f0fdf4' : '#fff8f8';
    cardOk.style.borderColor = isOk ? '#16a34a' : '#e2e8f0';
    cardOk.style.boxShadow   = isOk ? '0 4px 14px rgba(22,163,74,0.2)' : 'none';
    const icon = cardOk.querySelector('div');
    if(icon){icon.style.background=isOk?'linear-gradient(135deg,#22c55e,#16a34a)':'#fef2f2';icon.style.borderColor=isOk?'#16a34a':'#fecaca';}
  }
  if (cardReject) {
    cardReject.style.background  = !isOk ? '#fff1f2' : '#f8fafc';
    cardReject.style.borderColor = !isOk ? '#e65100' : '#e2e8f0';
    cardReject.style.boxShadow   = !isOk ? '0 4px 14px rgba(230,81,0,0.18)' : 'none';
  }
  if (rejectIcon) {
    rejectIcon.style.background  = !isOk ? '#c8102e' : '#f1f5f9';
    rejectIcon.style.borderColor = !isOk ? '#e65100' : '#e2e8f0';
    rejectIcon.style.boxShadow   = !isOk ? '0 4px 12px rgba(200,16,46,0.3)' : 'none';
  }
  if (rejectSub) rejectSub.style.color = !isOk ? '#e65100' : '#94a3b8';
  if (btn) {
    btn.style.background = isOk
      ? '#c8102e'
      : 'linear-gradient(135deg,#7f1d1d,#c8102e)';
    btn.style.boxShadow = '0 4px 14px rgba(200,16,46,0.3)';
    btn.textContent = isOk ? '✅ ยืนยันรับงาน' : '↩️ ส่งซ่อมใหม่';
  }
  const radio = document.querySelector(`input[name="v-result"][value="${val}"]`);
  if (radio) radio.checked = true;
}
function openVerifySheet(tid) {
  const t = db.tickets.find(x=>x.id===tid); if(!t){ showToast('⚠️ ไม่พบข้อมูลงาน'); return; }
  document.getElementById('v-tid').value = tid;
  document.getElementById('v-note').value = '';

  // ── Resolve machine: fallback to macMap if t.machine empty ──
  const _vm = getMacMap().get(t.machineId);
  const machineName = (t.machine && t.machine.trim()) ? t.machine : (_vm?.name || '(ไม่ระบุเครื่อง)');

  // hero header
  const serial = _vm?.serial || getSerial(t);
  const sb = document.getElementById('v-serial-badge');
  if (sb) { sb.textContent = serial; sb.style.display = serial ? 'block' : 'none'; }
  const heroTid = document.getElementById('v-hero-tid');
  if (heroTid) heroTid.textContent = t.id + (t.problem ? ' — ' + t.problem : '');
  const heroMac = document.getElementById('v-hero-machine');
  if (heroMac) heroMac.textContent = '❄️ ' + machineName;
  // tech avatar — handle null/empty assignee gracefully
  const assigneeName = t.assignee || '';
  const initials = assigneeName
    ? assigneeName.split(' ').map(w=>w[0]||'').join('').substring(0,2).toUpperCase()
    : '—';
  const ta = document.getElementById('v-tech-avatar');
  if (ta) { ta.textContent = initials; ta.style.background = assigneeName ? '#c8102e' : '#94a3b8'; }
  const tn = document.getElementById('v-tech-name');
  if (tn) tn.textContent = assigneeName || 'ยังไม่จ่ายงาน';

  selectVerifyResult('verified');

  // result box — ผลงานช่าง (reuse _vm resolved above)
  const hasAfter = t.photosAfter?.length > 0;
  const _vMachine = _vm;
  const _vDept = _vMachine?.dept || '—';
  const _vSerial = serial;
  document.getElementById('v-result-box').innerHTML = `
    <!-- header label -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <div style="width:3px;height:18px;background:#0369a1;border-radius:99px;flex-shrink:0"></div>
      <div style="font-size:0.68rem;font-weight:800;color:#0369a1;text-transform:uppercase;letter-spacing:0.08em">รายงานผลการซ่อม</div>
    </div>

    <!-- info table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:0.78rem">
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:6px 0;color:#94a3b8;font-weight:600;width:38%;vertical-align:top">เลขที่ใบงาน</td>
        <td style="padding:6px 0;color:#0f172a;font-weight:800;font-family:'JetBrains Mono',monospace">${t.id}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:6px 0;color:#94a3b8;font-weight:600;vertical-align:top">เครื่องแอร์</td>
        <td style="padding:6px 0;color:#0f172a;font-weight:700;line-height:1.4">${machineName}${_vSerial?`<br><span style="font-size:0.65rem;color:#3b82f6;font-family:'JetBrains Mono',monospace">${_vSerial}</span>`:''}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:6px 0;color:#94a3b8;font-weight:600">แผนก</td>
        <td style="padding:6px 0;color:#0f172a;font-weight:700">${_vDept}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:6px 0;color:#94a3b8;font-weight:600;vertical-align:top">Zone / Range</td>
        <td style="padding:6px 0;display:flex;gap:5px;align-items:center;flex-wrap:wrap">
          ${(()=>{ const z=_vMachine?.zone||'process'; return z==='office'?'<span style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:5px;padding:1px 7px;font-size:0.65rem;font-weight:800">🏢 Office</span>':'<span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:5px;padding:1px 7px;font-size:0.65rem;font-weight:800">⚙️ Process</span>'; })()}
          ${(()=>{ if(!_vMachine) return ''; const r=getMachineRange(_vMachine); const styles={A:'background:#fff1f2;color:#be123c;border:1px solid #fecdd3',B:'background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd',C:'background:#f7fee7;color:#4d7c0f;border:1px solid #d9f99d'}; const labels={A:'🔴 Range A',B:'🔵 Range B',C:'🟢 Range C'}; return `<span style="${styles[r]||styles.B};border-radius:5px;padding:1px 7px;font-size:0.65rem;font-weight:800">${labels[r]||r}</span>`; })()}
        </td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:6px 0;color:#94a3b8;font-weight:600">ช่างผู้ซ่อม</td>
        <td style="padding:6px 0;color:#0f172a;font-weight:700">${t.assignee||'—'}</td>
      </tr>
      ${t.cost ? `<tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:6px 0;color:#94a3b8;font-weight:600">ค่าใช้จ่าย</td>
        <td style="padding:6px 0;color:#0369a1;font-weight:800;font-family:'JetBrains Mono',monospace">฿${Number(t.cost).toLocaleString()}</td>
      </tr>` : ''}
    </table>

    <!-- สรุปการซ่อม -->
    <div style="margin-bottom:${t.parts||hasAfter?'10px':'0'}">
      <div style="font-size:0.6rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:5px">สรุปการซ่อม</div>
      <div style="font-size:0.85rem;color:#1e293b;line-height:1.65;font-weight:500">${formatSummary(t.summary)}</div>
    </div>

    <!-- อะไหล่ที่ใช้ -->
    ${t.parts ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:${hasAfter?'10px':'0'}">
      <div style="font-size:0.6rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:5px">อะไหล่ที่ใช้</div>
      <div style="font-size:0.8rem;color:#334155;line-height:1.6">${escapeHtml(t.parts)}</div>
    </div>` : ''}

    <!-- รูปหลังซ่อม -->
    ${hasAfter ? `<div>
      <div style="font-size:0.6rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">รูปหลังซ่อม</div>
      <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px">${t.photosAfter.map(p=>`<div class="ph-thumb" style="flex-shrink:0"><img src="${p}" onclick="openLightbox('${p}')" style="border-radius:8px"/></div>`).join('')}</div>
    </div>` : ''}
  `;
  openSheet('verify');
}
function doVerify() {
  const tid = document.getElementById('v-tid').value;
  const result = document.querySelector('input[name="v-result"]:checked')?.value || 'verified';
  const note = document.getElementById('v-note').value.trim();
  const t = db.tickets.find(x=>x.id===tid); if(!t)return;
  const now = nowStr();
  if (result==='verified') {
    t.status='verified'; t.history.push({act:'🎉 ตรวจรับงาน',by:CU.name,at:now,detail:note});
    notifyRole('admin','🎉 ตรวจรับงานแล้ว ['+tid+']',CU.name+' ตรวจรับ รอปิดงาน',tid);
    notifyUser(t.assigneeId,'🎉 งานผ่านตรวจรับ','งาน ['+tid+'] ผ่านการตรวจรับแล้ว',tid);
  } else {
    t.status='inprogress'; // กลับไปซ่อมต่อทันที ไม่ต้องกด รับงาน/เริ่มซ่อม ซ้ำ
    t.history.push({act:'↩️ ส่งซ่อมใหม่',by:CU.name,at:now,detail:note||'ไม่ผ่านการตรวจ'});
    notifyUser(t.assigneeId,'↩️ งานถูกส่งกลับ ซ่อมใหม่ด่วน!','งาน ['+tid+'] ส่งซ่อมใหม่: '+(note||'ไม่ผ่านการตรวจ'),tid);
    notifyRole('admin','↩️ งานส่งซ่อมใหม่ ['+tid+']',CU.name+' ส่งงานกลับให้ซ่อมใหม่',tid);
  }
  t.updatedAt=now; saveDB(); syncTicket(t); closeSheet('verify');
  if (result === 'verified') {
    refreshPage(); // refresh ก่อนเสมอ เพื่อให้ UI อัพเดทแม้ signature pad crash
    showToast('✅ ตรวจรับแล้ว — กรุณาเซ็นชื่อยืนยัน');
    try { setTimeout(() => openSignaturePad(tid, 'reporter_verify'), 500); } catch(e) {}
  } else {
    refreshPage();
  }
}

function doClose(tid) {
  const t = db.tickets.find(x=>x.id===tid); if(!t)return;
  // แสดง popup ถามก่อนปิดงาน
  openCloseConfirmSheet(tid);
}
function openCloseConfirmSheet(tid) {
  const t = db.tickets.find(x=>x.id===tid); if(!t)return;
  document.getElementById('cc-tid').value = tid;
  document.getElementById('cc-info').innerHTML = `
    <div style="font-weight:700;font-size:0.95rem;color:var(--text)">${t.id} — ${escapeHtml(t.problem)}</div>
    <div style="font-size:0.78rem;color:var(--muted);margin-top:2px">❄️ ${t.machine} &nbsp;·&nbsp; 🔧 ${t.assignee||'—'}</div>
    ${t.cost?`<div style="color:var(--ok);font-weight:700;margin-top:4px">฿${Number(t.cost).toLocaleString()}</div>`:''}
  `;
  openSheet('closeconfirm');
}
function doCloseConfirm(withPdf) {
  const tid = document.getElementById('cc-tid').value;
  const t = db.tickets.find(x=>x.id===tid); if(!t)return;
  const now = nowStr(); t.status='closed'; t.updatedAt=now;
  t.history.push({act:'🔒 ปิดงาน',by:CU.name,at:now});
  notifyUser(t.reporterId,'🔒 งานปิดสมบูรณ์','งาน ['+tid+'] ปิดสมบูรณ์แล้ว',tid);
  saveDB(); syncTicket(t);
  closeSheet('closeconfirm');
  if(withPdf) { setTimeout(()=>generateRepairPDF(tid), 300); }
  else { showToast('🔒 ปิดงานเรียบร้อย — กรุณาเซ็นชื่อ'); }
  setTimeout(() => { try { openSignaturePad(tid, 'admin_close'); } catch(e) {} refreshPage(); }, withPdf ? 600 : 400);
}

// ══ WaitPart & PO display blocks for detail sheet ══
function renderWaitPartBlock(t) {
  const w = t.waitPart;
  const po = t.purchaseOrder;
  const arrived = po?.receiveStatus === 'received';
  const purchasing = po?.purchasing && !arrived;

  // สีและข้อความตามสถานะ
  const statusBar = arrived
    ? '<div style="background:#d1fae5;border-radius:8px;padding:6px 10px;margin-bottom:8px;display:flex;align-items:center;gap:6px">'
      + '<span style="font-size:0.75rem">📦</span>'
      + '<span style="font-size:0.78rem;font-weight:800;color:#065f46">อะไหล่มาถึงแล้ว — พร้อมซ่อมต่อได้เลย</span></div>'
    : purchasing
    ? '<div style="background:#fef3c7;border-radius:8px;padding:6px 10px;margin-bottom:8px;display:flex;align-items:center;gap:6px">'
      + '<span style="font-size:0.75rem">🛒</span>'
      + '<span style="font-size:0.78rem;font-weight:800;color:#92400e">Admin กำลังดำเนินการสั่งซื้อ — รอรับของ</span></div>'
    : '<div style="background:#fee2e2;border-radius:8px;padding:6px 10px;margin-bottom:8px;display:flex;align-items:center;gap:6px">'
      + '<span style="font-size:0.75rem">⏳</span>'
      + '<span style="font-size:0.78rem;font-weight:800;color:#991b1b">รอ Admin ดำเนินการสั่งซื้อ — ยังบันทึกผลซ่อมไม่ได้</span></div>';

  return '<div style="background:#fff3e0;border:1.5px solid #fed7aa;border-radius:12px;padding:12px;margin-bottom:10px">'
    + '<div style="font-weight:800;color:#e65100;font-size:0.88rem;margin-bottom:8px">⏳ รอสั่งซื้ออะไหล่</div>'
    + statusBar
    + '<div style="font-size:0.82rem;color:var(--text);margin-bottom:4px"><b>อะไหล่:</b> ' + (w.items||'') + '</div>'
    + (w.qty ? '<div style="font-size:0.75rem;color:var(--muted)">📦 จำนวน: ' + w.qty + '</div>' : '')
    + (w.price ? '<div style="font-size:0.78rem;color:#e65100;font-weight:700">฿' + Number(w.price).toLocaleString() + ' (ประมาณ)</div>' : '')
    + (w.vendor ? '<div style="font-size:0.75rem;color:var(--muted)">🏪 ' + w.vendor + '</div>' : '')
    + (w.note ? '<div style="font-size:0.73rem;color:var(--muted);margin-top:3px">' + w.note + '</div>' : '')
    + '<div style="font-size:0.68rem;color:#9ca3af;margin-top:6px;padding-top:6px;border-top:1px solid #fed7aa">แจ้งโดย ' + (w.requestedBy||'') + ' · ' + (w.requestedAt||'') + '</div>'
    + '</div>';
}
function renderPOBlock(t) {
  const po = t.purchaseOrder;
  if (!po) return '';
  const rows = po.rows || [];
  const hasRows = rows.filter(r=>r.name).length > 0;
  let html = '<div style="background:#fefce8;border:1.5px solid #fde68a;border-radius:12px;padding:12px;margin-bottom:10px">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
    + '<div style="font-weight:800;color:#92400e;font-size:0.88rem">📋 ใบสั่งซื้ออะไหล่</div>'
    + (CU.role==='admin' ? '<button onclick="closeSheet(\'detail\');setTimeout(()=>openPOForm(\'' + t.id + '\'),200)" style="font-size:0.7rem;background:#92400e;color:white;border:none;border-radius:8px;padding:4px 10px;cursor:pointer;font-weight:700;font-family:inherit">✏️ แก้ไข</button>' : '')
    + '</div>';
  // เลขเอกสาร
  const refs = [];
  if (po.mowr) refs.push('MO/WR: <b>' + po.mowr + '</b>');
  if (po.pr)   refs.push('PR: <b>' + po.pr + '</b>');
  if (po.po)   refs.push('PO: <b>' + po.po + '</b>');
  if (refs.length) html += '<div style="font-size:0.75rem;color:#92400e;margin-bottom:8px">' + refs.join(' &nbsp;|&nbsp; ') + '</div>';
  // ตารางรายการ
  if (hasRows) {
    html += '<div style="overflow-x:auto"><table style="width:100%;min-width:300px;border-collapse:collapse;font-size:0.75rem">'
      + '<thead><tr style="background:#fef3c7"><th style="padding:5px 6px;text-align:left;color:#92400e">#</th>'
      + '<th style="padding:5px 6px;text-align:left;color:#92400e">ชื่ออะไหล่</th>'
      + '<th style="padding:5px 6px;text-align:left;color:#92400e">PR</th>'
      + '<th style="padding:5px 6px;text-align:center;color:#92400e">จำนวน</th>'
      + '<th style="padding:5px 6px;text-align:right;color:#92400e">ราคา/ชิ้น</th>'
      + '<th style="padding:5px 6px;text-align:right;color:#92400e">รวม</th></tr></thead><tbody>';
    rows.filter(r=>r.name).forEach((r,i) => {
      html += '<tr style="border-bottom:1px solid #fde68a">'
        + '<td style="padding:5px 6px;color:#9ca3af;text-align:center">' + (i+1) + '</td>'
        + '<td style="padding:5px 6px;font-weight:600">' + r.name + '</td>'
        + '<td style="padding:5px 6px;color:#92400e;font-size:0.72rem">' + (r.pr||'—') + '</td>'
        + '<td style="padding:5px 6px;text-align:center">' + (r.qty||1) + '</td>'
        + '<td style="padding:5px 6px;text-align:right">' + Number(r.price||0).toLocaleString() + '</td>'
        + '<td style="padding:5px 6px;text-align:right;font-weight:700;color:#e65100">฿' + ((r.qty||1)*(r.price||0)).toLocaleString() + '</td>'
        + '</tr>';
    });
    html += '</tbody><tfoot><tr style="background:#fef3c7;border-top:2px solid #fde68a">'
      + '<td colspan="5" style="padding:7px 6px;text-align:right;font-weight:800;color:#92400e">ราคาสุทธิรวม</td>'
      + '<td style="padding:7px 6px;text-align:right;font-weight:900;color:#e65100;font-size:0.95rem">฿' + Number(po.total||0).toLocaleString() + '</td>'
      + '</tr></tfoot></table></div>';
  }
  if (po.note) html += '<div style="font-size:0.75rem;color:var(--muted);margin-top:6px">📝 ' + po.note + '</div>';
  html += '<div style="font-size:0.68rem;color:#9ca3af;margin-top:6px;padding-top:6px;border-top:1px solid #fde68a">บันทึกโดย ' + (po.savedBy||'') + ' · ' + (po.savedAt||'') + '</div>';
  html += '</div>';
  return html;
}

function fmtDT(iso) {
  if (!iso) return '—';
  try {
    let d;
    // รองรับ Thai locale format เก่า เช่น "15/3/2569 10:01:34"
    const thaiMatch = iso.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (thaiMatch) {
      const beYear = parseInt(thaiMatch[3]);
      const ceYear = beYear > 2400 ? beYear - 543 : beYear;
      d = new Date(ceYear, parseInt(thaiMatch[2])-1, parseInt(thaiMatch[1]),
                   parseInt(thaiMatch[4]), parseInt(thaiMatch[5]));
    } else {
      d = new Date(iso);
    }
    if (isNaN(d.getTime())) return iso.substring(0,16).replace('T',' ');
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear() + 543; // แสดงปี พ.ศ.
    const hh = String(d.getHours()).padStart(2,'0');
    const min = String(d.getMinutes()).padStart(2,'0');
    return dd + '/' + mm + '/' + yyyy + ' ' + hh + ':' + min;
  } catch(e) { return iso.substring(0,16).replace('T',' '); }
}

// ── Delete Ticket (admin only) ──
function deleteTicket(tid) {
  if (!CU || CU.role !== 'admin') {
    showToast('⛔ ไม่มีสิทธิ์ลบงาน');
    return;
  }
  showAlert({
    icon: '🗑️', color: '#dc2626',
    title: 'ลบงานนี้?',
    msg: 'ลบแล้วไม่สามารถกู้คืนได้ ข้อมูลงาน รูปภาพ และแชทจะหายทั้งหมด',
    btnOk: '🗑️ ลบถาวร', btnCancel: 'ยกเลิก',
    onOk: () => {
      const _delTk = (db.tickets||[]).find(t=>t.id===tid);
      if(window.bkAudit && _delTk) window.bkAudit('ลบ Ticket', tid, {id:_delTk.id,problem:_delTk.problem,machine:_delTk.machine}, null);
      db.tickets = (db.tickets||[]).filter(t => t.id !== tid);
      // ลบ chat ที่เกี่ยวข้อง
      if (db.chats && db.chats[tid]) delete db.chats[tid];
      saveDB(); fsSave();
      invalidateTkCache();
      // ปิด detail sheet ถ้าเปิดอยู่
      closeSheet('detail');
      refreshPage();
      showToast('🗑️ ลบงานเรียบร้อยแล้ว');
    }
  });
}

function openDetail(tid) {
  const t = db.tickets.find(x=>x.id===tid); if(!t)return;
  const _ser = getSerial(t);
  const hasBefore = t.photosBefore?.length>0, hasAfter = t.photosAfter?.length>0;
  const _m = getMacMap().get(t.machineId);
  const _dept = _m?.dept || '—';
  const _serial = _m?.serial || '';

  // ── Header title (stays in old slot for compat) ──
  document.getElementById('detail-title').textContent = '';

  // ── Status colour helpers ──
  const ST = {
    new:          {label:'🆕 ใหม่',         bg:'#fef9c3',cl:'#854d0e',bc:'#fde047'},
    assigned:     {label:'📋 จ่ายแล้ว',     bg:'#ede9fe',cl:'#5b21b6',bc:'#a78bfa'},
    accepted:     {label:'✋ รับแล้ว',       bg:'#dbeafe',cl:'#1d4ed8',bc:'#93c5fd'},
    inprogress:   {label:'⚙️ กำลังซ่อม',   bg:'#ffedd5',cl:'#c2410c',bc:'#fb923c'},
    waiting_part: {label:'⏳ รออะไหล่',     bg:'#fff7ed',cl:'#ea580c',bc:'#fdba74'},
    done:         {label:'✅ ซ่อมเสร็จ',    bg:'#dcfce7',cl:'#16a34a',bc:'#86efac'},
    verified:     {label:'🔵 ตรวจรับแล้ว',  bg:'#e0f2fe',cl:'#0369a1',bc:'#7dd3fc'},
    closed:       {label:'🔒 ปิดงาน',       bg:'#f1f5f9',cl:'#475569',bc:'#94a3b8'},
    rejected:     {label:'↩️ ส่งใหม่',       bg:'#fee2e2',cl:'#b91c1c',bc:'#fca5a5'},
  };
  const PR = {
    high:{label:'🔴 ด่วนมาก',bg:'#fee2e2',cl:'#b91c1c'},
    mid: {label:'🟡 ปานกลาง',bg:'#fef9c3',cl:'#a16207'},
    low: {label:'⚪ ปกติ',   bg:'#f1f5f9',cl:'#64748b'},
  };
  const st = ST[t.status]||{label:t.status,bg:'#f1f5f9',cl:'#475569',bc:'#cbd5e1'};
  const pr = PR[t.priority]||PR.low;

  // ── Cost breakdown ──
  const rc = Number(t.repairCost||0), pc = Number(t.partsCost||0), tc = Number(t.cost||0);
  const totalCost = (rc||pc) ? rc+pc : tc;

  document.getElementById('detail-body').innerHTML = `

  <!-- ═══ HEADER ═══ -->
  <div style="margin:-12px -16px 0;background:white;border-bottom:1px solid #e5e7eb">

    <!-- Top bar: ticket ID + close -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:4px;height:28px;background:#c8102e;border-radius:2px;flex-shrink:0"></div>
        <div>
          <div style="font-size:0.58rem;font-family:'JetBrains Mono',monospace;color:#9ca3af;letter-spacing:.08em;margin-bottom:1px">${t.id}</div>
          <div style="font-size:0.78rem;font-weight:800;color:#0f172a">${escapeHtml(t.problem)}</div>
        </div>
      </div>
      <button onclick="closeSheet('detail')" style="width:28px;height:28px;border-radius:6px;background:#f1f5f9;border:none;color:#64748b;font-size:0.8rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
    </div>

    <!-- Status chips -->
    <div style="display:flex;align-items:center;gap:6px;padding:0 16px 12px;flex-wrap:wrap">
      <span style="background:${st.bg};color:${st.cl};border:1px solid ${st.bc};border-radius:5px;padding:3px 10px;font-size:0.68rem;font-weight:700">${st.label}</span>
      <span style="background:${pr.bg};color:${pr.cl};border-radius:5px;padding:3px 10px;font-size:0.68rem;font-weight:600">${pr.label}</span>
      ${totalCost?`<span style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:5px;padding:3px 10px;font-size:0.68rem;font-weight:700;margin-left:auto">฿${totalCost.toLocaleString()}</span>`:''}
    </div>

    <!-- Machine — prominent -->
    <div style="background:#0f172a;padding:12px 16px 14px">
      <div style="font-size:0.55rem;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">❄️ เครื่องแอร์ / ห้อง</div>
      <div style="font-size:1rem;font-weight:900;color:white;line-height:1.3;margin-bottom:2px">${t.machine||'—'}</div>
      ${_m?.location?`<div style="font-size:0.68rem;color:#94a3b8;margin-bottom:6px">📍 ${_m.location}</div>`:''}
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        ${_serial?`<span style="font-family:'JetBrains Mono',monospace;font-size:0.6rem;color:#475569;background:#1e293b;padding:2px 8px;border-radius:4px">${_serial}</span>`:''}
        ${_m?.btu?`<span style="font-size:0.6rem;color:#94a3b8;background:#1e293b;padding:2px 8px;border-radius:4px">${Number(_m.btu).toLocaleString()} BTU</span>`:''}
        ${_m?.refrigerant?`<span style="font-size:0.6rem;color:#fca5a5;background:#1e293b;padding:2px 8px;border-radius:4px">${_m.refrigerant}</span>`:''}
        ${_m?.vendor?`<span style="font-size:0.6rem;color:#a5b4fc;background:#1e293b;padding:2px 8px;border-radius:4px;font-weight:700">${_m.vendor}</span>`:''}
      </div>
    </div>
  </div>

  <!-- ═══ BODY ═══ -->
  <div style="padding:14px 0 0">

    <!-- People grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#f1f5f9;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:14px">
      <div style="background:white;padding:10px 12px">
        <div style="font-size:0.55rem;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">ผู้แจ้ง</div>
        <div style="font-size:0.82rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.reporter||'—'}</div>
        <div style="font-size:0.62rem;color:#6b7280;margin-top:2px">📍 ${_dept}</div>
        ${t.contact?`<div style="font-size:0.62rem;color:#3b82f6;margin-top:1px">📞 ${t.contact}</div>`:''}
      </div>
      <div style="background:white;padding:10px 12px">
        <div style="font-size:0.55rem;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">ช่างผู้รับผิดชอบ</div>
        <div style="font-size:0.82rem;font-weight:700;color:${t.assignee?'#0f172a':'#9ca3af'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.assignee||'ยังไม่มอบหมาย'}</div>
        ${t.scheduledAt?`<div style="font-size:0.62rem;color:#7c3aed;margin-top:2px">📅 ${t.scheduledAt}</div>`:`<div style="font-size:0.62rem;color:#d1d5db;margin-top:2px">—</div>`}
      </div>
      <div style="background:#f9fafb;padding:8px 12px;border-top:1px solid #f1f5f9">
        <div style="font-size:0.52rem;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">วันที่แจ้ง</div>
        <div style="font-size:0.72rem;font-weight:600;color:#374151">${fmtDT(t.createdAt)}</div>
      </div>
      <div style="background:#f9fafb;padding:8px 12px;border-top:1px solid #f1f5f9">
        <div style="font-size:0.52rem;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">อัปเดตล่าสุด</div>
        <div style="font-size:0.72rem;font-weight:600;color:#374151">${fmtDT(t.updatedAt)}</div>
      </div>
    </div>

    <!-- Problem detail -->
    ${t.detail?`
    <div style="border:1px solid #e5e7eb;border-left:3px solid #c8102e;border-radius:0 8px 8px 0;padding:10px 13px;margin-bottom:14px;background:white">
      <div style="font-size:0.55rem;font-weight:700;color:#c8102e;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">รายละเอียดปัญหา</div>
      <div style="color:#374151;font-size:0.82rem;line-height:1.65">${escapeHtml(t.detail)}</div>
    </div>`:''}

    ${t.waitPart?renderWaitPartBlock(t):''}
    ${t.purchaseOrder?renderPOBlock(t):''}

    <!-- Summary block -->
    ${t.summary?`
    <div style="border:1px solid #d1fae5;border-radius:10px;overflow:hidden;margin-bottom:14px;background:white">
      <div style="background:#15803d;padding:9px 13px;display:flex;align-items:center;justify-content:space-between">
        <span style="color:white;font-size:0.78rem;font-weight:800">✅ สรุปการซ่อม</span>
        ${totalCost?`<span style="font-family:'JetBrains Mono',monospace;font-size:0.85rem;font-weight:900;color:#bbf7d0">฿${totalCost.toLocaleString()}</span>`:''}
      </div>
      <div style="padding:10px 13px">
        <div style="color:#374151;font-size:0.82rem;line-height:1.65;margin-bottom:${t.parts||rc||pc?'8px':'0'}">${formatSummary(t.summary)}</div>
        ${t.parts?`<div style="font-size:0.75rem;color:#166534;background:#f0fdf4;border-radius:6px;padding:6px 10px;display:flex;gap:6px;align-items:flex-start"><span>🔩</span><span>อะไหล่: ${escapeHtml(t.parts)}</span></div>`:''}
        ${(rc||pc)?`<div style="display:grid;grid-template-columns:${rc&&pc?'1fr 1fr':'1fr'};gap:8px;margin-top:8px">
          ${rc?`<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:8px 10px">
            <div style="font-size:0.52rem;color:#1d4ed8;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">ค่าแรงซ่อม</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:0.95rem;font-weight:900;color:#1d4ed8">฿${rc.toLocaleString()}</div>
          </div>`:''}
          ${pc?`<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:8px 10px">
            <div style="font-size:0.52rem;color:#c2410c;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">ค่าอะไหล่</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:0.95rem;font-weight:900;color:#c2410c">฿${pc.toLocaleString()}</div>
          </div>`:''}
        </div>`:''}
      </div>
    </div>`:''}

    <!-- Photos -->
    ${hasBefore||hasAfter?`<div style="margin-bottom:14px">
      ${hasBefore?`<div style="margin-bottom:8px">
        <div style="font-size:0.62rem;font-weight:700;color:#c2410c;margin-bottom:6px">📸 ก่อนซ่อม</div>
        <div style="display:flex;gap:7px;overflow-x:auto;padding-bottom:4px">${t.photosBefore.map(p=>`<div class="ph-thumb"><img loading="lazy" decoding="async" src="${p}" onclick="openLightbox('${p}')"/></div>`).join('')}</div>
      </div>`:''}
      ${hasAfter?`<div>
        <div style="font-size:0.62rem;font-weight:700;color:#15803d;margin-bottom:6px">📸 หลังซ่อม</div>
        <div style="display:flex;gap:7px;overflow-x:auto;padding-bottom:4px">${t.photosAfter.map(p=>`<div class="ph-thumb"><img loading="lazy" decoding="async" src="${p}" onclick="openLightbox('${p}')"/></div>`).join('')}</div>
      </div>`:''}
    </div>`:''}

    <!-- Timeline -->
    <div style="margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <div style="height:1px;flex:1;background:#e5e7eb"></div>
        <span style="font-size:0.58rem;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em">ประวัติดำเนินการ</span>
        <div style="height:1px;flex:1;background:#e5e7eb"></div>
      </div>
      <div class="tl">${(t.history||[]).map((h,i)=>{
        const cfg=(act=>{
          if(act.includes('แจ้งงาน'))   return {icon:'📢',bg:'#fef9c3',cl:'#854d0e'};
          if(act.includes('จ่ายงาน'))   return {icon:'📋',bg:'#ede9fe',cl:'#5b21b6'};
          if(act.includes('รับงาน'))    return {icon:'✋',bg:'#dbeafe',cl:'#1d4ed8'};
          if(act.includes('เริ่มซ่อม')) return {icon:'🔧',bg:'#fee2e2',cl:'#b91c1c'};
          if(act.includes('รออะไหล่')) return {icon:'⏳',bg:'#ffedd5',cl:'#c2410c'};
          if(act.includes('อะไหล่มา')) return {icon:'📦',bg:'#d1fae5',cl:'#065f46'};
          if(act.includes('ซ่อมเสร็จ')||act.includes('บันทึกผล')) return {icon:'✅',bg:'#d1fae5',cl:'#065f46'};
          if(act.includes('ตรวจรับ'))  return {icon:'🔍',bg:'#cffafe',cl:'#0e7490'};
          if(act.includes('ปิดงาน'))   return {icon:'🔒',bg:'#f1f5f9',cl:'#475569'};
          if(act.includes('เปลี่ยนช่าง')) return {icon:'🔄',bg:'#ede9fe',cl:'#5b21b6'};
          if(act.includes('ออก PR')||act.includes('สั่งซื้อ')||act.includes('PR')||act.includes('PO')) return {icon:'🛒',bg:'#fff7ed',cl:'#c2410c'};
          if(act.includes('แก้ไขใบ')) return {icon:'✏️',bg:'#f5f3ff',cl:'#6d28d9'};
          if(act.includes('ช่างเซ็น')||act.includes('ยืนยัน')) return {icon:'✍️',bg:'#ecfdf5',cl:'#065f46'};
          if(act.includes('ยกเลิก')||act.includes('ไม่ผ่าน')) return {icon:'❌',bg:'#fee2e2',cl:'#b91c1c'};
          return {icon:'💬',bg:'#f3f4f6',cl:'#6b7280'};
        })(h.act||'');
        return `<div class="tl-item">
          <div class="tl-dot" style="background:${cfg.bg}">${cfg.icon}</div>
          <div class="tl-body">
            <div class="tl-t" style="color:${cfg.cl}">${h.act}</div>
            ${h.detail?(()=>{ var _d=h.detail; var _sep=_d.indexOf(' — '); var _desc=_sep>=0?_d.slice(_sep+3).replace(/^[-\s]+/,'').trim():_d; return _desc?`<div class="tl-d">${_desc}</div>`:''; })():''}
            <div class="tl-time">👤 ${h.by} &nbsp;·&nbsp; 🕐 ${h.at}</div>
          </div>
        </div>`;
      }).join('')}</div>
    </div>
  </div>
  `;

  // ── Action buttons ──
  const acts = [];
  if (CU.role==='admin' && ['new','open'].includes(t.status)) {
    acts.push(`<button class="btn btn-primary btn-full" onclick="closeSheet('detail');openAssignSheet('${t.id}')">📋 จ่ายงานให้ช่าง</button>`);
  }
  if (CU.role==='admin' && ['assigned','accepted'].includes(t.status)) {
    acts.push(`<button class="btn btn-ghost btn-full" onclick="closeSheet('detail');openAssignSheet('${t.id}')">🔄 เปลี่ยนช่าง</button>`);
  }
  if (CU.role==='tech' && t.assigneeId===CU.id && t.status==='assigned') {
    acts.push(`<button class="btn btn-primary btn-full" onclick="closeSheet('detail');doAccept('${t.id}')">✋ รับงาน</button>`);
  }
  if (CU.role==='tech' && t.assigneeId===CU.id && ['accepted','inprogress'].includes(t.status)) {
    acts.push(`<button class="btn btn-ok btn-full" onclick="closeSheet('detail');openCompleteSheet('${t.id}')">✅ บันทึกผลซ่อม</button>`);
  }
  if (CU.role==='tech' && t.assigneeId===CU.id && t.status==='waiting_part') {
    const arrived = t.purchaseOrder?.receiveStatus === 'received';
    const prNum = t.purchaseOrder?.pr || '';
    const poNum = t.purchaseOrder?.po || '';
    const hasPO = !!(t.purchaseOrder);
    if (arrived) {
      acts.push(`<button class="btn btn-ok btn-full" onclick="closeSheet('detail');openCompleteSheet('${t.id}')">✅ บันทึกผลซ่อม</button>`);
    } else {
      const prLine = prNum
        ? `<div style="margin-top:6px;display:flex;gap:5px;justify-content:center;flex-wrap:wrap">
            <span style="background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:5px;padding:2px 10px;font-size:0.72rem;font-weight:700">PR: ${prNum}</span>
            ${poNum?`<span style="background:#f5f3ff;color:#6d28d9;border:1px solid #c4b5fd;border-radius:5px;padding:2px 10px;font-size:0.72rem;font-weight:700">PO: ${poNum}</span>`:''}
           </div>`
        : hasPO
        ? `<div style="margin-top:5px;font-size:0.72rem;color:#92400e">⏳ Admin กำลังดำเนินการออก PR</div>`
        : `<div style="margin-top:5px;font-size:0.72rem;color:#b91c1c">⏳ Admin ยังไม่ได้กรอก PR/PO</div>`;
      acts.push(`<div style="background:#fffbeb;border:1.5px solid #fde68a;border-radius:12px;padding:12px 14px;text-align:center">
        <div style="font-size:1rem;margin-bottom:3px">⏳ รออะไหล่</div>
        <div style="font-size:0.78rem;color:#92400e;font-weight:600">ยังบันทึกผลซ่อมไม่ได้<br>รอจนกว่า Admin จะยืนยันว่าของมาถึงแล้ว</div>
        ${prLine}
      </div>`);
      acts.push(`<button class="btn btn-ghost btn-full" style="color:#1d4ed8;border-color:#bfdbfe;background:#eff6ff" onclick="openQuotationByRole('${t.id}')">📄 ดูรายงาน / ใบเสนอราคา</button>`);
    }
  }
  if (CU.role==='admin' && ['accepted','inprogress','waiting_part'].includes(t.status)) {
    const _po = t.purchaseOrder;
    const _tr = t.techRequest;
    const _arrived = _po?.receiveStatus === 'received';
    if (!_arrived && (_po || (_tr && _tr.rows && _tr.rows.some(r=>r.name)))) {
      acts.push(`<button class="btn btn-full" style="background:#e65100;color:white" onclick="closeSheet('detail');setTimeout(()=>openPOForm('${t.id}'),200)">${_po ? '✏️ แก้ไขใบสั่งซื้อ' : '📋 กรอกใบสั่งซื้อ'}</button>`);
    }
    if (t.status==='waiting_part' && t.assigneeId) {
      acts.push(`<button class="btn btn-ghost btn-full" style="color:#0369a1;border-color:#bae6fd;background:#f0f9ff" onclick="closeSheet('detail');openChat('${t.id}','${t.assigneeId}')">💬 แชทกับช่าง — ${t.assignee||'ช่าง'}</button>`);
    }
  }
  if (CU.role==='tech' && t.assigneeId===CU.id && t.status==='waiting_part') {
    const adminUser = db.users.find(u=>u.role==='admin');
    if (adminUser) {
      acts.push(`<button class="btn btn-ghost btn-full" style="color:#0369a1;border-color:#bae6fd;background:#f0f9ff" onclick="closeSheet('detail');openChat('${t.id}','${adminUser.id}')">💬 แชทกับ Admin</button>`);
    }
  }
  if (CU.role==='admin') {
    acts.push(`<button class="btn btn-full" style="background:#fff5f5;color:#dc2626;border:1.5px solid #fecaca" onclick="deleteTicket('${t.id}')">🗑️ ลบงานนี้</button>`);
  }
  document.getElementById('detail-actions').innerHTML = acts.join('');
  openSheet('detail');
}

function refreshPage() {
  const active = document.querySelector('.page.active')?.id?.replace('pg-','');
  if (active === 'home')     renderHome();
  else if (active === 'tickets')  renderTickets();
  else if (active === 'mywork')   renderMyWork();
  else if (active === 'tracking') renderTracking();
  else if (active === 'users') {
    if (typeof renderUsersSummary === 'function') renderUsersSummary();
    if (typeof renderUsers === 'function') renderUsers();
  }
  else if (active === 'purchase') {
    // refresh ทั้ง list และ tracking inline
    if (CU?.role === 'admin') renderPurchaseAdmin();
    else renderPurchaseTech();
    const tc = document.getElementById('pur-track-content');
    if (tc && tc.style.display !== 'none') renderTrackingInline(tc);
  }
  else if (active === 'report') renderReport?.();
  updateOpenBadge();
}


// ============================================================
// ADMIN TRACKING DASHBOARD
// ============================================================
function renderTracking() {
  const T = db.tickets;
  const daysSince = (d) => {
    if (!d) return 0;
    return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  };
  const ageBadge = (ds) => {
    if (ds >= 7) return `<span style="background:#fef2f2;color:#c8102e;border:1px solid rgba(200,16,46,0.3);border-radius:99px;padding:1px 7px;font-size:0.7rem;font-weight:700">${ds} วัน ⚠️</span>`;
    if (ds >= 3) return `<span style="background:#fff7ed;color:#e65100;border:1px solid rgba(230,81,0,0.3);border-radius:99px;padding:1px 7px;font-size:0.7rem;font-weight:700">${ds} วัน</span>`;
    return `<span style="background:#f3f4f6;color:var(--muted);border-radius:99px;padding:1px 7px;font-size:0.7rem">${ds} วัน</span>`;
  };

  const statuses = [
    { key: 'new',          label: '🆕 รอจ่ายงาน',         color: '#1565c0', bg: '#eff6ff' },
    { key: 'assigned',     label: '📋 จ่ายงานแล้ว',        color: '#f57f17', bg: '#fff8e1' },
    { key: 'accepted',     label: '✋ รับงานแล้ว',         color: '#7b1fa2', bg: '#f3e8ff' },
    { key: 'inprogress',   label: '🔧 กำลังซ่อม',          color: '#00acc1', bg: '#e0f7fa' },
    { key: 'waiting_part', label: '⏳ รอสั่งซื้ออะไหล่',   color: '#e65100', bg: '#fff3e0' },
    { key: 'done',         label: '✅ ซ่อมเสร็จ รอตรวจรับ', color: '#2e7d32', bg: '#f0fdf4' },
  ];

  // Summary row
  const summaryCards = statuses.map(s => {
    const cnt = T.filter(t => t.status === s.key).length;
    return `<div style="background:${s.bg};border:1px solid ${s.color}30;border-radius:14px;padding:12px 10px;text-align:center;min-width:80px;flex:1">
      <div style="font-size:1.5rem;font-weight:800;color:${s.color};font-family:'JetBrains Mono',monospace">${cnt}</div>
      <div style="font-size:0.65rem;color:${s.color};font-weight:600;margin-top:2px;line-height:1.3">${s.label}</div>
    </div>`;
  }).join('');

  // Waiting part detail table
  const wpTickets = T.filter(t => t.status === 'waiting_part');
  const wpSection = wpTickets.length > 0 ? `
  <div style="margin-top:16px">
    <div style="font-weight:700;color:#e65100;font-size:0.9rem;margin-bottom:8px;display:flex;align-items:center;gap:6px">
      <span>⏳ รอสั่งซื้ออะไหล่</span>
      <span style="background:#e65100;color:white;border-radius:99px;padding:1px 8px;font-size:0.72rem">${wpTickets.length}</span>
    </div>
    ${wpTickets.map(t => {
      const ds = daysSince(t.updatedAt);
      const hasPO  = !!(t.purchaseOrder);
      const hasPR  = !!(t.purchaseOrder?.pr);
      const isRecv = t.purchaseOrder?.receiveStatus === 'received';
      // สถานะ PR/PO badge
      const prBadge = hasPR
        ? `<span style="background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:5px;padding:1px 7px;font-size:0.6rem;font-weight:700">PR: ${t.purchaseOrder.pr}</span>`
        : hasPO
        ? `<span style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;border-radius:5px;padding:1px 7px;font-size:0.6rem;font-weight:700">⚠️ ยังไม่มีเลข PR</span>`
        : `<span style="background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:5px;padding:1px 7px;font-size:0.6rem;font-weight:700">⚠️ ยังไม่กรอก PR/PO</span>`;
      const poBadge = t.purchaseOrder?.po
        ? `<span style="background:#f5f3ff;color:#6d28d9;border:1px solid #c4b5fd;border-radius:5px;padding:1px 7px;font-size:0.6rem;font-weight:700">PO: ${t.purchaseOrder.po}</span>`
        : '';
      return `<div style="background:white;border:1.5px solid ${hasPO?'rgba(230,81,0,0.25)':'rgba(200,16,46,0.3)'};border-radius:14px;padding:12px;margin-bottom:8px" onclick="safeOpenDetail('${t.id}')" style="cursor:pointer">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:0.85rem;color:var(--text)">[${t.id}] ${escapeHtml(t.problem)}</div>
            <div style="font-size:0.72rem;color:var(--muted);margin-top:2px">❄️ ${t.machine}</div>
            <div style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap;align-items:center">
              ${prBadge}${poBadge}
            </div>
          </div>
          ${ageBadge(ds)}
        </div>
        ${t.waitPart ? `<div style="background:#fff3e0;border-radius:8px;padding:8px;font-size:0.78rem;color:var(--text);margin-bottom:8px">
          <span style="color:#e65100;font-weight:600">อะไหล่:</span> ${t.waitPart.items}
          ${t.waitPart.price ? `<span style="color:#e65100;font-family:'JetBrains Mono',monospace;margin-left:8px">฿${Number(t.waitPart.price).toLocaleString()}</span>` : ''}
        </div>` : ''}
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div style="font-size:0.72rem;color:var(--muted)">🔧 ${t.assignee||'ยังไม่จ่ายงาน'}</div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button onclick="event.stopPropagation();closeSheet('detail');setTimeout(()=>openPOForm('${t.id}'),200)"
              style="padding:5px 10px;border-radius:8px;border:1.5px solid #e65100;background:white;color:#e65100;font-size:0.65rem;font-weight:800;cursor:pointer;font-family:inherit">
              ✏️ ${hasPO?'แก้ PR':'กรอก PR'}
            </button>
            ${hasPO && !isRecv
              ? `<button onclick="event.stopPropagation();markPartArrived('${t.id}')"
                  style="padding:5px 10px;border-radius:8px;border:none;background:#16a34a;color:white;font-size:0.65rem;font-weight:800;cursor:pointer;font-family:inherit">
                  📦 ของมาแล้ว
                </button>`
              : `<button disabled
                  style="padding:5px 10px;border-radius:8px;border:none;background:#e2e8f0;color:#94a3b8;font-size:0.65rem;font-weight:700;cursor:not-allowed;font-family:inherit"
                  title="กรอก PR ก่อนถึงจะกดได้">
                  📦 ของมาแล้ว
                </button>`
            }
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>` : '';

  // Stale tickets (assigned/accepted/inprogress > 3 days)
  const stale = T.filter(t => ['assigned','accepted','inprogress'].includes(t.status) && daysSince(t.updatedAt) >= 3);
  const staleSection = stale.length > 0 ? `
  <div style="margin-top:16px">
    <div style="font-weight:700;color:var(--accent);font-size:0.9rem;margin-bottom:8px;display:flex;align-items:center;gap:6px">
      <span>⚠️ งานค้างนาน (≥3 วัน)</span>
      <span style="background:var(--accent);color:white;border-radius:99px;padding:1px 8px;font-size:0.72rem">${stale.length}</span>
    </div>
    ${stale.sort((a,b) => daysSince(b.updatedAt)-daysSince(a.updatedAt)).map(t => {
      const ds = daysSince(t.updatedAt);
      return `<div style="background:white;border:1px solid rgba(200,16,46,0.2);border-radius:14px;padding:12px;margin-bottom:8px;cursor:pointer" onclick="safeOpenDetail('${t.id}')">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div style="flex:1;overflow:hidden">
            <div style="font-weight:700;font-size:0.85rem;color:var(--text)">[${t.id}] ${escapeHtml(t.problem)}</div>
            <div style="font-size:0.75rem;color:var(--muted);margin-top:2px">❄️ ${t.machine}</div>
            <div style="font-size:0.75rem;color:var(--muted);margin-top:2px">🔧 ${t.assignee||'ยังไม่จ่ายงาน'}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${ageBadge(ds)}
            <div style="margin-top:4px"><span class="tag ${stc(t.status)}">${sTH(t.status)}</span></div>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>` : `<div style="background:#f0fdf4;border:1px solid rgba(21,128,61,0.2);border-radius:12px;padding:16px;text-align:center;color:var(--ok);font-size:0.85rem;margin-top:16px">✅ ไม่มีงานค้างนาน</div>`;

  // Pending admin review (done, waiting verify)
  const pendingVerify = T.filter(t => t.status === 'done');
  const verifySection = pendingVerify.length > 0 ? `
  <div style="margin-top:16px">
    <div style="font-weight:700;color:#2e7d32;font-size:0.9rem;margin-bottom:8px;display:flex;align-items:center;gap:6px">
      <span>✅ ซ่อมเสร็จ รอตรวจรับ</span>
      <span style="background:#2e7d32;color:white;border-radius:99px;padding:1px 8px;font-size:0.72rem">${pendingVerify.length}</span>
    </div>
    ${pendingVerify.map(t => `<div style="background:white;border:1px solid rgba(21,128,61,0.2);border-radius:14px;padding:12px;margin-bottom:8px;cursor:pointer" onclick="safeOpenDetail('${t.id}')">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;overflow:hidden">
          <div style="font-weight:700;font-size:0.85rem;color:var(--text)">[${t.id}] ${escapeHtml(t.problem)}</div>
          <div style="font-size:0.75rem;color:var(--muted);margin-top:2px">❄️ ${t.machine} • 🔧 ${t.assignee||''}</div>
          ${t.summary?`<div style="font-size:0.78rem;color:#2e7d32;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml((t.summary||"").split("\n")[0].replace(/^[-–]\s*/,""))}</div>`:''}
        </div>
        <button class="btn btn-ok btn-xs" onclick="event.stopPropagation();doAdminClose('${t.id}')">🔒 ปิดงาน</button>
      </div>
    </div>`).join('')}
  </div>` : '';

  document.getElementById('tracking-content').innerHTML = `
    <div style="font-weight:800;font-size:1rem;color:var(--text);margin-bottom:12px">📊 ติดตามงาน</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">${summaryCards}</div>
    ${wpSection}
    ${staleSection}
    ${verifySection}
  `;
}

function markPartArrived(tid) {
  const t = db.tickets.find(x => x.id===tid); if(!t) return;
  if (!t.purchaseOrder) {
    showToast('⚠️ กรุณากรอก PR/PO ก่อน แล้วค่อยกด "ของมาแล้ว"');
    return;
  }
  const now = nowStr();
  t.status = 'inprogress'; t.updatedAt = now;
  t.purchaseOrder.receiveStatus = 'received';
  t.purchaseOrder.receivedAt = now;
  t.purchaseOrder.receivedBy = CU.name;
  t.history.push({act:'📦 อะไหล่มาแล้ว — กลับซ่อม',by:CU.name,at:now});
  notifyUser(t.assigneeId,'📦 อะไหล่มาแล้ว','งาน ['+tid+'] อะไหล่มาแล้ว สามารถดำเนินการซ่อมต่อได้',tid);
  saveDB(); syncTicket(t); const _tc=document.getElementById("pur-track-content"); if(_tc&&_tc.style.display!=="none") renderTrackingInline(_tc);
  showToast('✅ บันทึกแล้ว แจ้งช่างแล้ว');
  if (navigator.vibrate) navigator.vibrate(100);
}

function doAdminClose(tid) {
  const t = db.tickets.find(x=>x.id===tid); if(!t) return;
  const now = nowStr();
  t.status = 'closed'; t.updatedAt = now;
  t.history.push({act:'🔒 ปิดงาน',by:CU.name,at:now});
  saveDB(); syncTicket(t); const _tc=document.getElementById("pur-track-content"); if(_tc&&_tc.style.display!=="none") renderTrackingInline(_tc); updateOpenBadge();
}


// ============================================================
// CALENDAR
// ============================================================

function openCalViewSheet(eid) {
  const ev = (db.calEvents||[]).find(x=>x.id===eid);
  if(!ev) return;
  const typeLabel = {repair:'🔧 ซ่อมแอร์', clean:'💧 ล้างแอร์', pm:'🔩 PM บำรุงรักษา'};
  const typeColor = {repair:'var(--accent)', clean:'#0369a1', pm:'#166534'};
  const dateTH = new Date(ev.date).toLocaleDateString('th-TH',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  document.getElementById('calview-title').textContent = typeLabel[ev.type]||'📅 งาน';
  document.getElementById('calview-body').innerHTML = `
    <div style="background:${{repair:'#fff0f2',clean:'#e0f2fe',pm:'#f0fdf4'}[ev.type]||'#f5f5f7'};border-radius:12px;padding:14px;margin-bottom:12px">
      <div style="font-size:1rem;font-weight:800;color:${typeColor[ev.type]||'var(--text)'};margin-bottom:4px">${ev.title}</div>
      <div style="font-size:0.8rem;color:var(--muted)">${dateTH}</div>
      ${ev.start||ev.end ? `<div style="font-size:0.8rem;color:var(--muted);margin-top:3px">⏰ ${ev.start||''} ${ev.end?'– '+ev.end:''}</div>` : ''}
    </div>
    ${ev.dept?`<div style="padding:10px 0;border-bottom:1px solid #f3f3f3;font-size:0.85rem"><span style="color:var(--muted)">🏭 แผนก</span><br><b>${ev.dept}</b></div>`:''}
    ${ev.machine?`<div style="padding:10px 0;border-bottom:1px solid #f3f3f3;font-size:0.85rem"><span style="color:var(--muted)">❄️ เครื่อง</span><br><b>${ev.machine}</b></div>`:''}
    ${ev.tech?`<div style="padding:10px 0;border-bottom:1px solid #f3f3f3;font-size:0.85rem"><span style="color:var(--muted)">🔧 ช่างผู้รับผิดชอบ</span><br><b>${ev.tech}</b></div>`:''}
    ${ev.note?`<div style="padding:10px 0;font-size:0.85rem"><span style="color:var(--muted)">📝 หมายเหตุ</span><br>${ev.note}</div>`:''}
    <div style="padding-top:10px;font-size:0.72rem;color:var(--muted)">สร้างโดย ${ev.createdBy||''} • ${ev.createdAt||''}</div>
  `;
  openSheet('calview');
}

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-based
let calFilter = 'all'; // all | repair | clean | pm
const MONTH_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

function setCalFilter(f) {
  calFilter = f;
  ['all','repair','clean'].forEach(x => {
    const btn = document.getElementById('cftab-'+x);
    if(btn) btn.classList.toggle('active', x === f);
  });
  const cg = document.getElementById('cal-grid');
  if(cg) renderCalGrid();
}

function confirmClearAllChats() {
  if (!db.chats) { showToast('ℹ️ ไม่มีแชท'); return; }
  const total = Object.values(db.chats).reduce((s,arr)=>s+(arr.length||0),0);
  if (!total) { showToast('ℹ️ ไม่มีข้อความแชท'); return; }
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px';
  const box = document.createElement('div');
  box.style.cssText = 'background:white;border-radius:22px;padding:28px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.25);animation:popIn 0.22s cubic-bezier(0.34,1.56,0.64,1)';
  box.innerHTML = `
    <div style="width:60px;height:60px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:1.8rem;border:2px solid #bfdbfe">💬</div>
    <div style="font-size:1rem;font-weight:900;color:#0f172a;margin-bottom:8px">ลบแชททั้งหมด?</div>
    <div style="font-size:0.82rem;color:#64748b;line-height:1.7;margin-bottom:20px">
      จะลบข้อความ <strong style="color:#1d4ed8">${total} ข้อความ</strong> ในทุก Ticket<br>
      <span style="font-size:0.75rem;color:#94a3b8">ไม่สามารถย้อนกลับได้</span>
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="this.closest('[style*=inset]').remove()"
        style="flex:1;padding:13px;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit">ยกเลิก</button>
      <button onclick="doDeleteAllChats();this.closest('[style*=inset]').remove()"
        style="flex:1;padding:13px;background:linear-gradient(135deg,#1d4ed8,#1e40af);color:white;border:none;border-radius:12px;font-size:0.88rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(29,78,216,0.35)">
        🗑️ ลบทั้งหมด
      </button>
    </div>`;
  ov.appendChild(box);
  ov.addEventListener('click', e => { if(e.target===ov) ov.remove(); });
  document.body.appendChild(ov);
}

function doDeleteAllChats() {
  const total = Object.values(db.chats||{}).reduce((s,arr)=>s+(arr.length||0),0);
  db.chats = {};
  saveDB();
  showToast(`🗑️ ลบแชท ${total} ข้อความแล้ว`);
  if (navigator.vibrate) navigator.vibrate([50,30,100]);
  // อัปเดต badge
  const chatBadge = document.getElementById('chat-count-badge');
  if (chatBadge) chatBadge.textContent = '0 ข้อความ';
  updateChatBadge();
}


function calPrevMonth() { calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderCalendar(); }
function calNextMonth() { calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderCalendar(); }
function openTicketSheet(tid) { openDetail(tid); }

function confirmClearAllCalEvents() {
  const total = (db.calEvents||[]).length;
  if (!total) { showToast('ℹ️ ไม่มีกิจกรรมในปฏิทิน'); return; }

  // สร้าง confirm modal
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px';
  const box = document.createElement('div');
  box.style.cssText = 'background:white;border-radius:22px;padding:28px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 24px 64px rgba(0,0,0,0.25);animation:popIn 0.22s cubic-bezier(0.34,1.56,0.64,1)';
  box.innerHTML = `
    <div style="width:60px;height:60px;background:linear-gradient(135deg,#fff0f2,#fecaca);border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:1.8rem;border:2px solid #fca5a5">🗑️</div>
    <div style="font-size:1rem;font-weight:900;color:#0f172a;margin-bottom:8px">ลบกิจกรรมทั้งหมด?</div>
    <div style="font-size:0.82rem;color:#64748b;line-height:1.7;margin-bottom:20px">
      จะลบกิจกรรม <strong style="color:#c8102e">${total} รายการ</strong> ออกจากปฏิทินทั้งหมด<br>
      <span style="font-size:0.75rem;color:#94a3b8">การกระทำนี้ไม่สามารถย้อนกลับได้</span>
    </div>
    <div style="display:flex;gap:8px">
      <button onclick="this.closest('[style*=inset]').remove()"
        style="flex:1;padding:13px;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit">
        ยกเลิก
      </button>
      <button onclick="doDeleteAllCalEvents();this.closest('[style*=inset]').remove()"
        style="flex:1;padding:13px;background:#c8102e;color:white;border:none;border-radius:12px;font-size:0.88rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(200,16,46,0.35)">
        🗑️ ลบทั้งหมด
      </button>
    </div>`;
  ov.appendChild(box);
  ov.addEventListener('click', e => { if(e.target===ov) ov.remove(); });
  document.body.appendChild(ov);
}

function doDeleteAllCalEvents() {
  const count = (db.calEvents||[]).length;
  db.calEvents = [];
  saveDB();
  renderCalendar();
  showToast(`🗑️ ลบกิจกรรม ${count} รายการแล้ว`);
  if (navigator.vibrate) navigator.vibrate([50,30,100]);
}



// ── Calendar Bottom Panels ──────────────────────────────────
let _cpanel = 'day';
let _calSelDate = fmtDate(new Date());

function setCPanel(name) {
  _cpanel = name;
  ['day','month','chat'].forEach(t => {
    document.getElementById('cpanel-tab-'+t)?.classList.toggle('active', t===name);
    const el = document.getElementById('cpanel-'+t);
    if(el) el.style.display = t===name ? (name==='chat'?'flex':'block') : 'none';
  });
  if(name==='day')   renderCalDayPanel(_calSelDate);
  if(name==='month') renderCalMonthSummary();
  if(name==='chat')  renderTeamChat();
}

function renderCalDayPanel(dateStr) {
  _calSelDate = dateStr || _calSelDate;
  const el = document.getElementById('cal-day-tickets'); if(!el) return;
  const d = new Date(dateStr||_calSelDate);
  const ds = fmtDate(d);
  const THAI_DAY = ['อา','จ','อ','พ','พฤ','ศ','ส'];
  const dayLabel = `${THAI_DAY[d.getDay()]} ${d.getDate()} ${MONTH_TH[d.getMonth()]} ${d.getFullYear()+543}`;

  // tickets ของวันนั้น (ตาม createdAt หรือ updatedAt)
  const dayTickets = (db.tickets||[]).filter(t => {
    const isMine = CU.role==='admin' || t.assigneeId===CU.id || t.reporterId===CU.id;
    const onDay = (t.createdAt||'').startsWith(ds) || (t.updatedAt||'').startsWith(ds);
    return isMine && onDay;
  });

  // calendar events ของวันนั้น
  const dayEvs = (db.calEvents||[]).filter(e => {
    const mine = CU.role==='admin' || !e.techId || e.techId===CU.id;
    return e.date===ds && mine;
  });

  if(!dayTickets.length && !dayEvs.length) {
    el.innerHTML = `<div style="text-align:center;color:var(--muted);padding:20px;font-size:0.82rem">ไม่มีงานใน${dayLabel}</div>`;
    return;
  }

  const stColor = {new:'#6b7280',assigned:'#7c3aed',accepted:'#0891b2',inprogress:'#e65100',done:'#059669',verified:'#065f46',closed:'#9ca3af',waiting_part:'#b45309'};
  const stTH = {new:'ใหม่',assigned:'จ่ายงาน',accepted:'รับงาน',inprogress:'กำลังซ่อม',done:'เสร็จ',verified:'ตรวจรับ',closed:'ปิด',waiting_part:'รออะไหล่'};

  let html = `<div style="font-size:0.72rem;font-weight:800;color:var(--accent);margin-bottom:8px">📅 ${dayLabel}</div>`;

  if(dayEvs.length) {
    html += dayEvs.map(e => `
      <div style="display:flex;align-items:center;gap:8px;background:white;border-radius:10px;padding:8px 10px;margin-bottom:6px;border-left:3px solid #7c3aed">
        <span style="font-size:1rem">${e.type==='clean'?'💧':e.type==='pm'?'🔩':'🔧'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text)">${e.title}</div>
          <div style="font-size:0.68rem;color:var(--muted)">${e.start||''}${e.end?' – '+e.end:''} ${e.note||''}</div>
        </div>
      </div>`).join('');
  }

  if(dayTickets.length) {
    html += dayTickets.map(t => `
      <div style="display:flex;align-items:center;gap:8px;background:white;border-radius:10px;padding:8px 10px;margin-bottom:6px;border-left:3px solid ${stColor[t.status]||'#ccc'};cursor:pointer" onclick="openTicketSheet('${t.id}')">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.8rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(t.problem)}</div>
          <div style="font-size:0.68rem;color:var(--muted)">${t.machine||''}</div>
        </div>
        <span style="font-size:0.65rem;font-weight:700;color:${stColor[t.status]};white-space:nowrap">${stTH[t.status]||t.status}</span>
      </div>`).join('');
  }
  el.innerHTML = html;
}

function renderCalMonthSummary() {
  const el = document.getElementById('cal-month-summary'); if(!el) return;
  const myTickets = (db.tickets||[]).filter(t => {
    const d = new Date(t.createdAt||t.updatedAt||'');
    const inMonth = d.getFullYear()===calYear && d.getMonth()===calMonth;
    const isMine = CU.role==='admin' || t.assigneeId===CU.id;
    return inMonth && isMine;
  });
  const done    = myTickets.filter(t=>['done','verified','closed'].includes(t.status)).length;
  const pending = myTickets.filter(t=>!['done','verified','closed'].includes(t.status)).length;
  const totalCost = myTickets.filter(t=>['done','verified','closed'].includes(t.status)).reduce((s,t)=>s+Number(t.cost||0),0);
  const myEvs = (db.calEvents||[]).filter(e=>{
    const d=parseLocalDate(e.date);
    return d.getFullYear()===calYear && d.getMonth()===calMonth && (CU.role==='admin'||!e.techId||e.techId===CU.id);
  });

  el.innerHTML = `
    <div style="font-size:0.72rem;font-weight:800;color:var(--accent);margin-bottom:10px">📊 ${MONTH_TH[calMonth]} ${calYear+543}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div style="background:white;border-radius:12px;padding:12px;text-align:center;border:1.5px solid #d1fae5">
        <div style="font-size:1.6rem;font-weight:900;color:#059669">${done}</div>
        <div style="font-size:0.68rem;color:var(--muted);font-weight:600">✅ เสร็จแล้ว</div>
      </div>
      <div style="background:white;border-radius:12px;padding:12px;text-align:center;border:1.5px solid #fee2e2">
        <div style="font-size:1.6rem;font-weight:900;color:var(--accent)">${pending}</div>
        <div style="font-size:0.68rem;color:var(--muted);font-weight:600">⏳ ค้างอยู่</div>
      </div>
      <div style="background:white;border-radius:12px;padding:12px;text-align:center;border:1.5px solid #e0e7ff">
        <div style="font-size:1.6rem;font-weight:900;color:#7c3aed">${myEvs.length}</div>
        <div style="font-size:0.68rem;color:var(--muted);font-weight:600">📅 กิจกรรม</div>
      </div>
      <div style="background:white;border-radius:12px;padding:12px;text-align:center;border:1.5px solid #fef3c7">
        <div style="font-size:1.1rem;font-weight:900;color:#b45309">฿${totalCost.toLocaleString()}</div>
        <div style="font-size:0.68rem;color:var(--muted);font-weight:600">💰 ค่าซ่อมรวม</div>
      </div>
    </div>`;
}

// ── Team Chat ───────────────────────────────────────────────
function renderTeamChat() {
  const el = document.getElementById('cpanel-chat-msgs'); if(!el) return;
  const msgs = (db.chats?.['team']||[]).slice(-30);
  if(!msgs.length) {
    el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:16px;font-size:0.8rem">ยังไม่มีข้อความในทีม</div>';
    return;
  }
  el.innerHTML = msgs.map(m => {
    const isMe = m.uid === CU.id;
    const u = db.users?.find(x=>x.id===m.uid);
    const initials = getAvatarInitials(m.name||'?');
    const bg = getAvatarColor(m.uid||'');
    const avatarHtml = u?.avatar
      ? `<img src="${u.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0"/>`
      : `<div style="width:28px;height:28px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:800;color:#fff;flex-shrink:0">${initials}</div>`;
    return `<div style="display:flex;gap:6px;align-items:flex-end;${isMe?'flex-direction:row-reverse':''}">
      ${avatarHtml}
      <div style="max-width:72%">
        ${!isMe?`<div style="font-size:0.62rem;color:var(--muted);margin-bottom:2px;${isMe?'text-align:right':''}">${escapeHtml(m.name)}</div>`:''}
        <div style="background:${isMe?'var(--accent)':'white'};color:${isMe?'#fff':'var(--text)'};border-radius:${isMe?'14px 14px 4px 14px':'14px 14px 14px 4px'};padding:7px 11px;font-size:0.8rem;box-shadow:0 1px 4px rgba(0,0,0,0.08)">${escapeHtml(m.text)}</div>
        <div style="font-size:0.6rem;color:var(--muted);margin-top:2px;${isMe?'text-align:right':''}">${(m.at||'').substring(11,16)}</div>
      </div>
    </div>`;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

function sendTeamChat() {
  const inp = document.getElementById('cpanel-chat-input');
  const text = inp?.value.trim(); if(!text) return;
  if(!db.chats) db.chats = {};
  if(!db.chats['team']) db.chats['team'] = [];
  db.chats['team'].push({ uid:CU.id, name:CU.name, text, at:nowStr() });
  // เก็บแค่ 200 ข้อความล่าสุด
  if(db.chats['team'].length > 200) db.chats['team'] = db.chats['team'].slice(-200);
  inp.value = '';
  saveDB();
  renderTeamChat();
}


function renderCalTechSummary() {
  const el = document.getElementById('cal-tech-summary');
  if (!el || CU.role !== 'admin') { el.style.display='none'; return; }
  const techs = db.users.filter(u => u.role === 'tech');
  if (techs.length === 0) { el.style.display = 'none'; return; }

  const evs = (db.calEvents||[]).filter(e => {
    const d = parseLocalDate(e.date);
    return d.getFullYear()===calYear && d.getMonth()===calMonth;
  });
  const T = db.tickets;

  const cards = techs.map(tech => {
    const myEvs   = evs.filter(e => e.techId === tech.id);
    const plan    = myEvs.length;
    const done    = T.filter(t=>t.assigneeId===tech.id&&['done','verified','closed'].includes(t.status)).length;
    const waiting = T.filter(t=>t.assigneeId===tech.id&&t.status==='waiting_part').length;
    const active  = T.filter(t=>t.assigneeId===tech.id&&!['closed','verified','done'].includes(t.status)).length;
    const activeColor = active>3?'var(--accent)':active>1?'#e65100':'#1a8a4a';
    const avatar = tech.photo
      ? `<img src="${tech.photo}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid white">`
      : `<div style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;font-size:1.1rem;border:2px solid rgba(255,255,255,0.4)">🔧</div>`;
    return `<div onclick="openTechPopup('${tech.id}')" style="flex-shrink:0;width:150px;background:white;border-radius:14px;border:1px solid #e5e7eb;overflow:hidden;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.06);transition:transform 0.15s,box-shadow 0.15s" onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform=''" onmouseleave="this.style.transform=''">
      <div style="background:linear-gradient(135deg,var(--accent),var(--accent2));padding:10px 12px;display:flex;align-items:center;gap:8px">
        ${avatar}
        <div style="flex:1;min-width:0">
          <div style="font-size:0.75rem;font-weight:800;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tech.name}</div>
          <div style="font-size:0.62rem;color:rgba(255,255,255,0.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tech.dept||'ช่างซ่อม'}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;padding:0">
        <div style="padding:8px 6px;text-align:center;border-right:1px solid #f3f3f3;border-bottom:1px solid #f3f3f3">
          <div style="font-size:1.1rem;font-weight:800;color:${plan>0?'var(--accent)':'#ccc'}">${plan}</div>
          <div style="font-size:0.58rem;color:var(--muted)">📅 แผน</div>
        </div>
        <div style="padding:8px 6px;text-align:center;border-bottom:1px solid #f3f3f3">
          <div style="font-size:1.1rem;font-weight:800;color:#166534">${done}</div>
          <div style="font-size:0.58rem;color:var(--muted)">✅ เสร็จ</div>
        </div>
        <div style="padding:8px 6px;text-align:center;border-right:1px solid #f3f3f3">
          <div style="font-size:1.1rem;font-weight:800;color:#e65100">${waiting}</div>
          <div style="font-size:0.58rem;color:var(--muted)">⏳ รออะไหล่</div>
        </div>
        <div style="padding:8px 6px;text-align:center">
          <div style="font-size:1.1rem;font-weight:800;color:${activeColor}">${active}</div>
          <div style="font-size:0.58rem;color:var(--muted)">🔧 ค้าง</div>
        </div>
      </div>
    </div>`;
  }).join('');

  el.style.display = 'block';
  el.innerHTML = `
    <div style="padding:8px 14px 4px;display:flex;align-items:center;justify-content:space-between">
      <div style="font-weight:800;font-size:0.82rem;color:var(--text)">👷 ช่างประจำเดือน ${MONTH_TH[calMonth]} ${calYear+543}</div>
      <div style="font-size:0.7rem;color:var(--muted)">${techs.length} คน • กดเพื่อดูงาน</div>
    </div>
    <div style="display:flex;gap:10px;overflow-x:auto;padding:6px 14px 10px;-webkit-overflow-scrolling:touch;scrollbar-width:none">
      ${cards}
    </div>`;
}
function renderCalendar() {
  const ml = document.getElementById('cal-month-label');
  if(ml) ml.textContent = MONTH_TH[calMonth] + ' ' + (calYear+543);
  renderCalGrid();
  renderCalTechSummary();
  // render panel ที่ active อยู่
  if(_cpanel==='day')   renderCalDayPanel(_calSelDate);
  if(_cpanel==='month') renderCalMonthSummary();
  if(_cpanel==='chat')  renderTeamChat();
}

function renderCalGrid() {
  const today = new Date(); today.setHours(0,0,0,0);
  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay  = new Date(calYear, calMonth+1, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  // filtered events for this month
  const evs = (db.calEvents||[]).filter(e => {
    const d = parseLocalDate(e.date);
    const matchMonth = d.getFullYear()===calYear && d.getMonth()===calMonth;
    const matchFilter = calFilter==='all' || e.type===calFilter;
    // admin เห็นทุกงาน, ช่างเห็นเฉพาะงานที่ตัวเองถูกมอบหมาย หรืองานที่ไม่ระบุช่าง
    const matchTech = CU.role==='admin' || !e.techId || e.techId===CU.id;
    return matchMonth && matchFilter && matchTech;
  });

  // group by day
  const evByDay = {};
  evs.forEach(e => {
    const d = parseLocalDate(e.date).getDate();
    if(!evByDay[d]) evByDay[d]=[];
    evByDay[d].push(e);
  });

  // build cells
  let cells = '';
  // leading empty cells
  for(let i=0;i<startDow;i++) {
    const prevDate = new Date(calYear, calMonth, -startDow+i+1);
    cells += `<div class="cal-cell other-month" onclick="openCalEventSheet('${fmtDate(prevDate)}')">
      <div class="cal-day-num">${prevDate.getDate()}</div></div>`;
  }
  for(let d=1;d<=totalDays;d++) {
    const thisDate = new Date(calYear, calMonth, d); thisDate.setHours(0,0,0,0);
    const isToday = thisDate.getTime()===today.getTime();
    const dayEvs = evByDay[d]||[];
    const evHtml = dayEvs.slice(0,3).map(e => {
      const cls = e.type==='clean-major'?'cal-ev-clean-major':e.type==='clean-minor'?'cal-ev-clean-minor':e.type==='clean'?'cal-ev-clean':e.type==='pm'?'cal-ev-pm':'cal-ev-repair';
      // ตัวย่อแทน emoji — กระชับในช่องปฏิทิน
      const badge = e.type==='clean-major'
        ? '<span style="background:#0369a1;color:white;border-radius:3px;padding:0 3px;font-size:0.5rem;font-weight:900;margin-right:2px;">ล้างใหญ่</span>'
        : e.type==='clean-minor'
        ? '<span style="background:#34d399;color:#064e3b;border-radius:3px;padding:0 3px;font-size:0.5rem;font-weight:900;margin-right:2px;">ล้างย่อย</span>'
        : e.type==='clean' ? '<span style="font-size:0.58rem;margin-right:2px;">💧</span>'
        : e.type==='pm'    ? '<span style="background:#166534;color:#bbf7d0;border-radius:3px;padding:0 3px;font-size:0.5rem;font-weight:900;margin-right:2px;">PM</span>'
        : '<span style="font-size:0.58rem;margin-right:2px;">🔧</span>';
      // ตัดชื่อเหลือส่วนสำคัญ (หลัง — )
      // ตัดเหลือแค่ชื่อแผนก (ก่อนวงเล็บ)
      let shortTitle = e.title.replace(/^[🔵💦💧🔩🔧]\s*(ล้างใหญ่|ล้างย่อย|PM|ซ่อม|)\s*[—–-]?\s*/u, '').trim() || e.title;
      shortTitle = shortTitle.replace(/\s*\(\d+\s*เครื่อง\)\s*$/, '').trim(); // ลบ (xx เครื่อง)
      shortTitle = shortTitle.length > 18 ? shortTitle.slice(0,16)+'…' : shortTitle;
      return `<div class="cal-event ${cls}" data-eid="${e.id}" onclick="event.stopPropagation();CU.role==='admin'?openCalEventSheet(null,'${e.id}'):openCalViewSheet('${e.id}')">${badge}${shortTitle}</div>`;
    }).join('') + (dayEvs.length>3?`<div style="font-size:0.6rem;color:var(--muted);padding:1px 3px">+${dayEvs.length-3} อื่นๆ</div>`:'');
    const dateStr = fmtDate(thisDate);
    cells += `<div class="cal-cell${isToday?' today':''}" onclick="selectCalDay('${dateStr}')" style="cursor:pointer">
      <div class="cal-day-num">${d}</div>${evHtml}</div>`;
  }
  // trailing cells to complete 6 rows
  const totalCells = startDow + totalDays;
  const trailing = totalCells%7===0 ? 0 : 7-(totalCells%7);
  for(let i=1;i<=trailing;i++) {
    const nextDate = new Date(calYear, calMonth+1, i);
    cells += `<div class="cal-cell other-month" onclick="openCalEventSheet('${fmtDate(nextDate)}')">
      <div class="cal-day-num">${nextDate.getDate()}</div></div>`;
  }
  const cgEl = document.getElementById('cal-grid');
  if(cgEl) cgEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(7,1fr)">${cells}</div>`;
}

function selectCalDay(dateStr) {
  _calSelDate = dateStr;
  // highlight วันที่เลือก
  document.querySelectorAll('.cal-cell').forEach(el => el.classList.remove('sel-day'));
  // เปิด panel งานวันนั้น
  setCPanel('day');
  renderCalDayPanel(dateStr);
  // ถ้า admin และ double-tap → เปิด add event
}

function fmtDate(d) { return d.toISOString().split('T')[0]; }
// แก้ timezone bug: new Date("YYYY-MM-DD") ใช้ UTC → ใน GMT+7 จะเป็นวันก่อน
// ใช้ฟังก์นี้แทนเสมอเมื่อ parse date string จาก e.date
function parseLocalDate(s) {
  if (!s) return new Date();
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}

// ── Calendar Event Sheet ────────────────────────────────────
let _editCalId = null;
function openCalEventSheet(dateStr, editId) {
  // Tech = read-only: open view sheet instead
  if (CU.role !== 'admin') {
    if (editId) openCalViewSheet(editId);
    return;
  }
  _editCalId = editId||null;
  const ev = editId ? (db.calEvents||[]).find(x=>x.id===editId) : null;
  document.getElementById('calevent-title').textContent = ev ? '✏️ แก้ไขงาน' : '📅 เพิ่มงาน';
  document.getElementById('cev-id').value = ev?.id||'';
  document.getElementById('cev-date').value = ev?.date || dateStr || fmtDate(new Date());
  document.getElementById('cev-title-input').value = ev?.title||'';
  document.getElementById('cev-note').value = ev?.note||'';
  document.getElementById('cev-start').value = ev?.start||'08:00';
  document.getElementById('cev-end').value = ev?.end||'12:00';
  setCeType(ev?.type||'repair');
  // populate dept dropdown (unique depts from machines)
  const depts = [...new Set(db.machines.map(m => m.dept||m.location||'').filter(Boolean))].sort();
  const ds = document.getElementById('cev-dept');
  ds.innerHTML = '<option value="">— เลือกแผนก (ไม่บังคับ) —</option>' +
    depts.map(d=>`<option value="${d}"${ev?.dept===d?' selected':''}>${d}</option>`).join('');

  // populate machine select (filter by dept if set, else all)
  const ms = document.getElementById('cev-mac');
  const deptVal = ev?.dept||'';
  const macList = deptVal ? db.machines.filter(m=>(m.dept||m.location||'')=== deptVal) : db.machines;
  ms.innerHTML = '<option value="">— เลือกเครื่อง (ถ้ามี) —</option>' +
    macList.map(m=>`<option value="${m.id}"${ev?.machineId===m.id?' selected':''}>[${m.serial}] ${escapeHtml(m.name)}</option>`).join('');
  // populate tech select
  const ts = document.getElementById('cev-tech');
  ts.innerHTML = '<option value="">— เลือกช่าง —</option>' +
    db.users.filter(u=>u.role==='tech').map(u=>`<option value="${u.id}"${ev?.techId===u.id?' selected':''}>${u.name}</option>`).join('');
  document.getElementById('cev-del-btn').style.display = ev ? 'block' : 'none';
  openSheet('calevent');
}

function onCevDeptChange(dept) {
  // Filter machine dropdown by selected dept
  const ms = document.getElementById('cev-mac');
  const macList = dept ? db.machines.filter(m=>(m.dept||m.location||'')=== dept) : db.machines;
  ms.innerHTML = '<option value="">— เลือกเครื่อง (ถ้ามี) —</option>' +
    macList.map(m=>`<option value="${m.id}">[${m.serial}] ${escapeHtml(m.name)}</option>`).join('');
  ms.value = '';
  // อัปเดต clean banner + auto-fill title
  updateCevCleanBanner();
}

function setCeType(t) {
  document.getElementById('cev-type').value = t;
  const cfg = {
    repair:        {bg:'#fff0f2', border:'var(--accent)', textColor:'var(--accent)'},
    clean:         {bg:'#eff6ff', border:'#3b82f6',       textColor:'#1d4ed8'},
    'clean-major': {bg:'#0369a1', border:'#0c4a6e',       textColor:'white'},
    'clean-minor': {bg:'#bae6fd', border:'#38bdf8',       textColor:'#0c4a6e'},
    pm:            {bg:'#f0fdf4', border:'#22c55e',       textColor:'#166534'},
  };
  ['repair','clean','clean-major','clean-minor'].forEach(x => {
    const btn = document.getElementById('cetype-'+x);
    if (!btn) return;
    const label = btn.querySelector('div:last-child');
    if (x === t) {
      btn.style.background  = cfg[x].bg;
      btn.style.borderColor = cfg[x].border;
      btn.style.boxShadow   = '0 3px 10px rgba(0,0,0,0.1)';
      btn.style.transform   = 'scale(1.04)';
      if (label) label.style.color = cfg[x].textColor;
    } else {
      btn.style.background  = 'white';
      btn.style.borderColor = '#e2e8f0';
      btn.style.boxShadow   = 'none';
      btn.style.transform   = 'scale(1)';
      if (label) label.style.color = '#94a3b8';
    }
  });

  // ── แสดง/ซ่อน clean banner ──
  const isClean = t === 'clean-major' || t === 'clean-minor';
  const banner  = document.getElementById('cev-clean-banner');
  const macWrap = document.getElementById('cev-mac-wrap');
  if (banner) banner.style.display = isClean ? 'block' : 'none';
  if (macWrap) macWrap.style.display = isClean ? 'none' : 'block';

  if (isClean) {
    // อัปเดต banner สี + label
    if (t === 'clean-major') {
      banner.style.background = 'linear-gradient(135deg,#0369a1,#0c4a6e)';
      document.getElementById('cev-clean-icon').textContent = '🔵';
      document.getElementById('cev-clean-type-label').textContent = 'ล้างใหญ่ (ถอดล้างทั้งระบบ)';
    } else {
      banner.style.background = 'linear-gradient(135deg,#38bdf8,#0369a1)';
      document.getElementById('cev-clean-icon').textContent = '💦';
      document.getElementById('cev-clean-type-label').textContent = 'ล้างย่อย (ล้างฟิลเตอร์/คอยล์)';
    }
    // refresh ด้วย dept ปัจจุบัน
    updateCevCleanBanner(t);
  }
}

function updateCevCleanBanner(type) {
  const dept = document.getElementById('cev-dept')?.value || '';
  const banner = document.getElementById('cev-clean-banner');
  if (!banner || banner.style.display === 'none') return;

  const t = type || document.getElementById('cev-type')?.value;
  const typeLabel = t === 'clean-major' ? 'ล้างใหญ่' : 'ล้างย่อย';
  const typeIcon  = t === 'clean-major' ? '🔵' : '💦';

  // นับแอร์ในแผนก
  const count = dept
    ? db.machines.filter(m => (m.dept||m.location||'') === dept).length
    : db.machines.length;

  const deptLabel   = document.getElementById('cev-clean-dept-label');
  const countBadge  = document.getElementById('cev-clean-count-badge');
  const autoTitle   = document.getElementById('cev-clean-auto-title');

  if (deptLabel)  deptLabel.textContent  = dept || '— กรุณาเลือกแผนก —';
  if (countBadge) countBadge.textContent = count + ' เครื่อง';

  // auto-fill ชื่องาน
  if (dept) {
    const titleEl = document.getElementById('cev-title-input');
    if (titleEl) titleEl.value = typeIcon + ' ' + typeLabel + ' — ' + dept + ' (' + count + ' เครื่อง)';
    if (autoTitle) autoTitle.textContent = '✅ กรอกชื่องานอัตโนมัติแล้ว';
  } else {
    if (autoTitle) autoTitle.textContent = '⬆️ เลือกแผนกด้านบนเพื่อกรอกชื่องานอัตโนมัติ';
  }
}

function saveCalEvent() {
  const id = document.getElementById('cev-id').value;
  const date  = document.getElementById('cev-date').value;
  const title = document.getElementById('cev-title-input').value.trim();

  // clear old errors
  document.querySelectorAll('#calevent-sheet .field-error').forEach(e=>e.remove());
  let hasErr = false;
  if(!date)  { showFormError('cev-date',        'กรุณาเลือกวันที่'); hasErr=true; }
  if(!title) { showFormError('cev-title-input', 'กรุณาระบุชื่องาน'); hasErr=true; }
  if(hasErr) return;
  if(!db.calEvents) db.calEvents=[];
  const machineId = document.getElementById('cev-mac').value;
  const machine   = machineId ? db.machines.find(x=>x.id===machineId) : null;
  const techId    = document.getElementById('cev-tech').value;
  const tech      = techId ? db.users.find(x=>x.id===techId) : null;
  const dept = document.getElementById('cev-dept').value;
  const ev = {
    id:        id||'cev'+Date.now(),
    type:      document.getElementById('cev-type').value,
    date, title, dept,
    start:     document.getElementById('cev-start').value,
    end:       document.getElementById('cev-end').value,
    machineId: machineId||'',
    machine:   machine?.name||'',
    techId:    techId||'',
    tech:      tech?.name||'',
    note:      document.getElementById('cev-note').value.trim(),
    createdBy: CU.name,
    createdAt: nowStr(),
  };
  const isNew = !id;
  if(id) {
    const idx = db.calEvents.findIndex(x=>x.id===id);
    if(idx>=0) db.calEvents[idx]=ev; else db.calEvents.push(ev);
  } else {
    db.calEvents.push(ev);
  }

  // แจ้งเตือนช่าง
  const typeLabel = {repair:'🔧 ซ่อมแอร์', clean:'💧 ล้างแอร์', pm:'🔩 PM'};
  const dateTH = new Date(ev.date).toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short'});
  if (ev.techId) {
    // แจ้งเฉพาะช่างที่ถูกมอบหมาย
    const msg = (isNew ? '📅 มีงานใหม่ในปฏิทิน: ' : '✏️ แก้ไขงานในปฏิทิน: ') + ev.title + ' (' + dateTH + ')';
    notifyUser(ev.techId, (isNew?'📅 งานแผนใหม่':'✏️ งานแผนอัปเดต') + ' — ' + (typeLabel[ev.type]||ev.type), msg);
  } else {
    // ไม่ระบุช่าง → แจ้งช่างทุกคน
    const msg = (isNew ? '📅 มีงานแผนใหม่: ' : '✏️ อัปเดตงานแผน: ') + ev.title + ' (' + dateTH + ')';
    notifyRole('tech', (isNew?'📅 งานแผนใหม่':'✏️ งานแผนอัปเดต') + ' — ' + (typeLabel[ev.type]||ev.type), msg);
  }

  saveDB(); closeSheet('calevent'); renderCalendar();
  if(navigator.vibrate) navigator.vibrate(60);
}

function confirmDelCalEvent(btn) {
  showAlert({
    icon:'🗑️', color:'#c8102e',
    title:'ลบกิจกรรมนี้?',
    msg:'การกระทำนี้ไม่สามารถย้อนกลับได้',
    btnOk:'🗑️ ลบ', btnCancel:'ยกเลิก',
    onOk: () => delCalEvent()
  });
}

function delCalEvent() {
  const id = document.getElementById('cev-id').value;
  if(!id) return;
  db.calEvents = (db.calEvents||[]).filter(x=>x.id!==id);
  saveDB(); closeSheet('calevent'); renderCalendar();
  showToast('🗑️ ลบงานเรียบร้อยแล้ว');
}



// ============================================================
// PULL TO REFRESH
// ============================================================
// ============================================================
// PULL TO REFRESH
// ============================================================
function initPullToRefresh() {
  let startY = 0, pulling = false, threshold = 70;
  const el = document.getElementById('app-main') || document.body;

  el.addEventListener('touchstart', e => {
    if (el.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; }
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 10 && el.scrollTop === 0) {
      const pct = Math.min(dy / threshold, 1);
      const ind = document.getElementById('ptr-indicator');
      if (ind) { ind.style.opacity = pct; ind.style.transform = `translateY(${Math.min(dy * 0.4, 28)}px) rotate(${pct * 180}deg)`; }
    }
  }, { passive: true });

  el.addEventListener('touchend', e => {
    if (!pulling) return;
    pulling = false;
    const dy = e.changedTouches[0].clientY - startY;
    const ind = document.getElementById('ptr-indicator');
    if (ind) { ind.style.opacity = 0; ind.style.transform = ''; }
    if (dy > threshold && el.scrollTop === 0) {
      showToast('🔄 กำลังโหลดข้อมูล...');
      setTimeout(() => { if (typeof forceReloadFromFS === 'function') forceReloadFromFS(); }, 100);
    }
  }, { passive: true });
}
