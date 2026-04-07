// notifyUser, notifyRole, updateNBadge, renderNotifPanel
// nowStr, openSheet, closeSheet, sendLineNotifyEvent
// ย้ายไปอยู่ใน app-core.js แล้ว (โหลดก่อน)

// openSheet, closeSheet ย้ายไปอยู่ใน app-core.js แล้ว (โหลดก่อน)

// ============================================================
// GOOGLE SHEETS
// ============================================================
async function manualSync() {
  const btn = event.target; btn.disabled = true; btn.textContent = '⏳ กำลัง sync...';
  try { await fsSave(); showToast('✅ Sync ขึ้น Firebase แล้ว'); }
  catch(e) { showToast('❌ Sync ผิดพลาด: ' + e.message); }
  finally { btn.disabled = false; btn.textContent = '⬆️ Sync ข้อมูลขึ้น Firebase ตอนนี้'; }
}
async function manualLoad() {
  const btn = event.target; btn.disabled = true; btn.textContent = '⏳ กำลังโหลด...';
  try {
    await fsLoad();
    const freshUser = db.users.find(u => u.id === CU.id);
    if (freshUser) { CU = freshUser; }
    refreshPage(); updateOpenBadge(); updateNBadge();
    showToast('✅ โหลดข้อมูลล่าสุดแล้ว');
  } catch(e) { showToast('❌ โหลดผิดพลาด: ' + e.message); }
  finally { btn.disabled = false; btn.textContent = '⬇️ โหลดข้อมูลล่าสุดจาก Firebase'; }
}

let _clearFSType = null;
function confirmClearFS(type) {
  _clearFSType = type;
  const labels = {
    reset:   '🔄 ล้าง Users + Tickets ทั้งหมด (เก็บเครื่องแอร์ไว้)',
    tickets: '🗑️ ล้าง Tickets ทั้งหมด',
    users:   '🗑️ ล้าง Users ทั้งหมด (เหลือแค่ตัวเอง)'
  };
  document.getElementById('clearfs-label').textContent = labels[type] || type;
  document.getElementById('clearfs-confirm').style.display = 'block';
  document.getElementById('clearfs-confirm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
async function executeClearFS() {
  const type = _clearFSType; if (!type) return;
  document.getElementById('clearfs-confirm').style.display = 'none';
  await clearFirestoreData(type);
}

async function clearFirestoreData(type) {
  showToast('⏳ กำลังล้างข้อมูล...');
  try {
    if (type === 'reset' || type === 'tickets') {
      db.tickets = [];
      db.notifications = [];
    }
    if (type === 'reset' || type === 'users') {
      // เพิ่ม id ที่ถูกล้างลง deletedUserIds blacklist — กัน onSnapshot merge กลับมา
      if (!db.deletedUserIds) db.deletedUserIds = [];
      (db.users || []).forEach(u => {
        if (u.id !== CU.id && db.deletedUserIds.indexOf(u.id) === -1) {
          db.deletedUserIds.push(u.id);
        }
      });
      // เก็บเฉพาะ user ที่ login อยู่
      db.users = db.users.filter(u => u.id === CU.id);
    }
    // machines ไม่แตะเลย — เก็บไว้ทุกกรณี

    // เพิ่ม _seq ให้สูงกว่า remote → onSnapshot ที่ยิงกลับมาจะถูก skip
    db._seq = (db._seq || 0) + 100;

    saveDB();
    if (_firebaseReady && FSdb) {
      // ✅ เขียน Firestore ถูก format (field ตรงๆ เหมือน fsSaveNow)
      const ticketsNoSig = (db.tickets || []).map(t => {
        if (!t.signatures) return t;
        const { signatures, ...rest } = t; return rest;
      });
      await FSdb.collection('appdata').doc('main').set({
        users:          db.users           || [],
        machines:       db.machines        || [],
        tickets:        ticketsNoSig,
        calEvents:      db.calEvents       || [],
        chats:          db.chats           || {},
        machineRequests:db.machineRequests || [],
        deletedUserIds: db.deletedUserIds  || [],
        _seq:           db._seq,
        gsUrl:          db.gsUrl           || '',
        updatedAt:      new Date().toISOString()
      });
      showToast('✅ ล้างข้อมูลใน Firestore เรียบร้อย — เครื่องแอร์ยังอยู่ครบ');
    } else {
      showToast('✅ ล้างข้อมูล Local เรียบร้อย (Firestore ไม่ได้เชื่อมต่อ)');
    }
    refreshPage(); updateOpenBadge(); updateNBadge();
  } catch(e) {
    showToast('❌ ผิดพลาด: ' + e.message);
    console.error('clearFirestoreData error:', e);
  }
}
// syncUser, syncTicket, syncMachine, _showSyncDot, _hideSyncDot ย้ายไปอยู่ใน app-core.js แล้ว

// ============================================================
// UTILS
// ============================================================

// ============================================================
// DARK MODE
// ============================================================
// ============================================================
// LANGUAGE / i18n  TH ↔ EN
// ============================================================
// _lang, I18N, t() ย้ายไปอยู่ใน app-core.js แล้ว (โหลดก่อน)
// ที่นี่ extend I18N.EN ด้วย admin-specific keys
Object.assign(I18N.EN, {
  'สวัสดี':'Hello','ยินดีต้อนรับ':'Welcome',
  'งานวันนี้':'Today\'s Jobs','งานค้าง':'Pending','งานด่วน':'Urgent Jobs',
  'งานทั้งหมด':'All Jobs','แจ้งซ่อมใหม่':'New Repair',
  'ผู้ใช้งาน':'Users','สั่งซื้อของ':'Purchase',
  'ทั้งหมด':'All','ค้นหา...':'Search...','ค้นหางาน...':'Search jobs...',
  'ไม่พบข้อมูล':'No data found','ปัญหา':'Problem',
  'ผู้แจ้ง':'Reporter','ช่างที่รับ':'Technician',
  'วันที่แจ้ง':'Reported','อัปเดตล่าสุด':'Updated',
  'รายละเอียด':'Detail','หมายเหตุ':'Note',
  'ปิด':'Close','ยกเลิก':'Cancel','บันทึก':'Save',
  'บันทึกผลการซ่อม':'Repair Record','รายการงานที่ดำเนินการ':'Work Done',
  'เลือกรายการงาน':'Select Tasks','วัสดุที่ใช้':'Materials Used',
  'น้ำยาแอร์':'Refrigerant','อะไหล่ที่เปลี่ยน':'Parts Replaced',
  'ค่าวัด':'Measurements','สรุปผลการดำเนินการ':'Summary',
  'รูปถ่ายหลังซ่อม':'After Photos','รูปถ่ายก่อนซ่อม':'Before Photos',
  'ส่งผลการซ่อม':'Submit','ก่อนซ่อม':'Before','หลังซ่อม':'After',
  'เครื่องทั้งหมด':'All Machines','แผนก':'Department',
  'ยี่ห้อ':'Brand','รุ่น':'Model','ซีเรียล':'Serial',
  'ขนาด':'Capacity','น้ำยา':'Refrigerant',
  'รอบ PM':'PM Interval','เดือน':'months',
  'ใบสั่งซื้อ':'Purchase Order','สั่งซื้อ':'Order',
  'รอดำเนินการ':'Pending','อนุมัติแล้ว':'Approved',
  'รับของแล้ว':'Received','รายการ':'Items','ราคา':'Price','รวม':'Total',
  'วางแผน PM':'PM Plan','เพิ่ม':'Add','วันนี้':'Today','สัปดาห์นี้':'This Week',
  'โปรไฟล์':'Profile','ชื่อ':'Name','ชื่อผู้ใช้':'Username',
  'รหัสผ่าน':'Password','บันทึกการตั้งค่า':'Save Settings',
  'ออกจากระบบ':'Logout','โหมดมืด':'Dark Mode',
  'ภาษา':'Language','ซิงค์ข้อมูล':'Sync Data',
  'โหลดข้อมูล':'Load Data','โซนอันตราย':'Danger Zone',
  'เพิ่มผู้ใช้':'Add User','แก้ไข':'Edit','ลบ':'Delete',
  'แอดมิน':'Admin','ช่างซ่อม':'Technician','ผู้แจ้งงาน':'Reporter',
  'รายงานสรุป':'Summary Report','ปัญหาที่พบบ่อย':'Frequent Problems',
  'ประสิทธิภาพ':'Performance',
  'เครื่อง':'Units','ทั้งหมด (จาก)':'All from',
  'ล้างใหญ่':'Major Clean','ล้างย่อย':'Minor Clean',
  'กรอกข้อมูลให้ครบถ้วน':'Fill in all required fields',
  '* จำเป็น':'* Required','ไม่บังคับ':'Optional',
  'สูงสุด 3 รูป / ประเภท':'Max 3 photos / type',
  'บีบอัดอัตโนมัติ':'Auto compressed',
});

function toggleTopSearch() {
  const wrap = document.getElementById('tb-search-wrap');
  const inp  = document.getElementById('tb-search-input');
  if (!wrap || !inp) return;
  const isOpen = wrap.style.width !== '32px' && wrap.style.width !== '';
  if (!isOpen) {
    wrap.style.width = '180px';
    inp.style.width = '130px';
    inp.style.opacity = '1';
    inp.style.padding = '0 10px 0 4px';
    setTimeout(() => inp.focus(), 250);
  } else {
    closeTopSearch();
  }
}

function closeTopSearch() {
  const wrap = document.getElementById('tb-search-wrap');
  const inp  = document.getElementById('tb-search-input');
  if (!wrap || !inp) return;
  wrap.style.width = '32px';
  inp.style.width = '0';
  inp.style.opacity = '0';
  inp.style.padding = '0';
  inp.value = '';
  // clear search results
  document.getElementById('_gsearch_ov')?.remove();
}

function tbSearchNow(q) {
  if (!q || q.length < 1) {
    document.getElementById('_gsearch_ov')?.remove();
    return;
  }
  // Reuse openGlobalSearch overlay or update existing
  let ov = document.getElementById('_gsearch_ov');
  if (!ov) {
    openGlobalSearch();
    ov = document.getElementById('_gsearch_ov');
    if (!ov) return;
    // pre-fill
    const inp = ov.querySelector('input');
    if (inp) { inp.value = q; inp.dispatchEvent(new Event('input')); }
    // close button closes topbar search too
    ov.querySelector('button')?.addEventListener('click', () => closeTopSearch());
  }
}

function toggleSidebar() {
  const app = document.getElementById('app');
  const collapsed = app.classList.toggle('sidebar-collapsed');
  localStorage.setItem('aircon_sidebar_collapsed', collapsed ? '1' : '0');
  const icon = document.getElementById('sidebar-toggle-icon');
  if (icon) {
    icon.innerHTML = collapsed
      ? '<polyline points="9 18 15 12 9 6"/>'
      : '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>';
  }
}

// initSidebarState ย้ายไปอยู่ใน app-core.js แล้ว

// ── Orientation change — sync sidebar state ──
window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    const app = document.getElementById('app');
    if (!app) return;
    const isLandscape = window.innerWidth > window.innerHeight;
    const isSmall = Math.min(window.innerWidth, window.innerHeight) < 600;
    if (isLandscape && isSmall) {
      // มือถือ landscape → ลบ collapsed class ป้องกันเมนูหาย (CSS จัดการ layout แทน)
      app.classList.remove('sidebar-collapsed');
    } else {
      // portrait หรือ tablet → restore saved state
      if (localStorage.getItem('aircon_sidebar_collapsed') === '1') {
        app.classList.add('sidebar-collapsed');
      } else {
        app.classList.remove('sidebar-collapsed');
      }
    }
    // force reflow
    app.style.display = 'none';
    app.offsetHeight;
    app.style.display = '';
  }, 150);
});

// resize event สำหรับ browser ที่ไม่ trigger orientationchange
window.addEventListener('resize', () => {
  const app = document.getElementById('app');
  if (!app) return;
  const isLandscape = window.innerWidth > window.innerHeight;
  const isSmall = Math.min(window.innerWidth, window.innerHeight) < 600;
  if (isLandscape && isSmall) {
    app.classList.remove('sidebar-collapsed');
  }
});

// ══════════════════════════════════════════════════════════════
// KEYBOARD / VIEWPORT FIX v2
// หลักการ: ไม่แตะ body.transform เด็ดขาด (ทำให้ fixed elements เลื่อน)
// ใช้แค่ --vh variable + scrollIntoView เท่านั้น
// ══════════════════════════════════════════════════════════════
(function() {
  const root = document.documentElement;
  let baseH = 0;

  function setVH(h) {
    root.style.setProperty('--vh', (h * 0.01) + 'px');
  }

  // รอ DOM load แล้วค่อยเก็บความสูงจริง
  function init() {
    baseH = window.innerHeight;
    setVH(baseH);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Visual Viewport API — hide bottom-nav when keyboard is up
  if (window.visualViewport) {
    let _navHidden = false;
    window.visualViewport.addEventListener('resize', () => {
      const vvh = window.visualViewport.height;
      const kbUp = (baseH - vvh) > 100;
      const h = kbUp ? vvh : baseH;
      setVH(h);

      // ซ่อน bottom-nav เมื่อ keyboard ขึ้น (ทุก user ทุกหน้า)
      const nav = document.getElementById('bottom-nav');
      if (nav) {
        if (kbUp && !_navHidden) {
          nav.style.display = 'none';
          _navHidden = true;
        } else if (!kbUp && _navHidden) {
          nav.style.display = '';
          _navHidden = false;
        }
      }

      // scroll focused input ให้ขึ้นมาเหนือ keyboard
      const el = document.activeElement;
      if (el && ['INPUT','TEXTAREA'].includes(el.tagName)) {
        setTimeout(() => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 100);
      }
    });
  }

  // หมุนจอ — อัปเดต baseH
  window.addEventListener('orientationchange', () => {
    setTimeout(() => { baseH = window.innerHeight; setVH(baseH); }, 500);
  });
})();

function toggleLang() {
  _lang = _lang === 'TH' ? 'EN' : 'TH';
  localStorage.setItem('aircon_lang', _lang);
  applyLang();
}

// applyLang ย้ายไปอยู่ใน app-core.js แล้ว


// ── Topbar Quick Menu ──
function _toggleTopMenu() {
  const m = document.getElementById('tb-quick-menu');
  if (!m) return;
  if (m.style.display === 'none') _openTopMenu();
  else _closeTopMenu();
}
function _openTopMenu() {
  const m = document.getElementById('tb-quick-menu');
  if (!m) return;
  m.style.display = 'block';
  // update dark icon
  const isDark = document.body.classList.contains('dark-mode');
  const di = document.getElementById('tb-qm-dark');
  if (di) di.textContent = isDark ? '☀️' : '🌙';
  // update lang
  const li = document.getElementById('tb-qm-lang');
  if (li) li.textContent = _lang === 'EN' ? 'Language EN → TH' : 'ภาษา TH → EN';
  // update role
  const ri = {admin:'👑 ADMIN', tech:'🔧 TECHNICIAN', reporter:'📢 REPORTER', executive:'📊 EXECUTIVE'};
  const rl = document.getElementById('tb-qm-role');
  if (rl && CU) rl.textContent = (ri[CU.role] || CU.role) + ' — ' + (CU.name || '');
  // close on outside tap
  setTimeout(() => document.addEventListener('click', _menuOutsideTap), 10);
}
// _closeTopMenu ย้ายไปอยู่ใน app-core.js แล้ว
function _menuOutsideTap(e) {
  const m = document.getElementById('tb-quick-menu');
  const btn = document.getElementById('tb-avatar-btn');
  if (m && !m.contains(e.target) && btn && !btn.contains(e.target)) {
    _closeTopMenu();
  }
}
function _tbMenu(page) {
  _closeTopMenu();
  goPage(page);
}
// initLang ย้ายไปอยู่ใน app-core.js แล้ว

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('aircon_dark', isDark ? '1' : '0');
  _updateDarkBtn(isDark);
}
// _updateDarkBtn ย้ายไปอยู่ใน app-core.js แล้ว
// initDarkMode ย้ายไปอยู่ใน app-core.js แล้ว

// ============================================================
// CHECKLIST + MEASUREMENTS TOGGLE
// ============================================================
function toggleMeasure() {
  const body = document.getElementById('measure-body');
  const icon = document.getElementById('measure-toggle-icon');
  if (!body) return;
  const open = body.style.display === 'none' || body.style.display === '';
  body.style.display = open ? 'block' : 'none';
  if (icon) icon.textContent = open ? '▲' : '▼';
}
// resetCompleteExtras ย้ายไปอยู่ใน app-core.js แล้ว

// ============================================================
// PM AUTO-SCHEDULE — สร้าง Ticket PM อัตโนมัติ (Admin)
// ============================================================


// ============================================================
// PM PLAN SHEET — ล้างใหญ่ / ล้างย่อย แยกแผนก
// ============================================================
// ══ PM Plan — Full Page ══

function setPMPageType(t) {
  document.getElementById('pmpage-type').value = t;
  const majorBtn = document.getElementById('pmpage-major-btn');
  const minorBtn = document.getElementById('pmpage-minor-btn');
  if (!majorBtn || !minorBtn) return;
  if (t === 'clean-major') {
    majorBtn.style.background = 'linear-gradient(135deg,#0369a1,#0c4a6e)';
    majorBtn.style.borderColor = '#0369a1';
    majorBtn.style.color = 'white';
    minorBtn.style.background = 'white';
    minorBtn.style.borderColor = '#e2e8f0';
    minorBtn.style.color = '#64748b';
  } else {
    minorBtn.style.background = 'linear-gradient(135deg,#059669,#065f46)';
    minorBtn.style.borderColor = '#059669';
    minorBtn.style.color = 'white';
    majorBtn.style.background = 'white';
    majorBtn.style.borderColor = '#e2e8f0';
    majorBtn.style.color = '#64748b';
  }
}

function renderPMPageDeptList() {
  const list = document.getElementById('pmpage-dept-list');
  if (!list) return;
  const deptCount = {};
  (db.machines||[]).forEach(m => {
    const d = m.dept || m.location || 'ไม่ระบุแผนก';
    deptCount[d] = (deptCount[d]||0) + 1;
  });
  const depts = Object.entries(deptCount).sort((a,b) => b[1]-a[1]);
  list.innerHTML = depts.map(([dept, count]) => `
    <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8fafc;border-radius:12px;border:1.5px solid #e5e7eb;cursor:pointer"
      onmouseover="this.style.borderColor='#38bdf8'" onmouseout="if(!this.querySelector('input').checked)this.style.borderColor='#e5e7eb'">
      <input type="checkbox" class="pmpage-dept-cb" data-dept="${dept}"
        style="width:17px;height:17px;accent-color:#0369a1;flex-shrink:0"
        onchange="pmPageUpdateCheck(this)">
      <div style="flex:1;min-width:0">
        <div style="font-size:0.85rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${dept}</div>
      </div>
      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
        <div style="background:#0369a1;color:white;border-radius:99px;padding:2px 10px;font-size:0.72rem;font-weight:800">${count}</div>
        <div style="font-size:0.62rem;color:#94a3b8;font-weight:600">เครื่อง</div>
      </div>
    </label>`).join('');
}

function pmPageUpdateCheck(cb) {
  const label = cb.closest('label');
  if (cb.checked) {
    label.style.borderColor = '#0369a1';
    label.style.background = '#eff6ff';
  } else {
    label.style.borderColor = '#e5e7eb';
    label.style.background = '#f8fafc';
  }
}

function pmPageSelectAll(val) {
  document.querySelectorAll('.pmpage-dept-cb').forEach(cb => {
    cb.checked = val;
    pmPageUpdateCheck(cb);
  });
}

function renderPMPageHistory() {
  const el = document.getElementById('pmpage-history');
  if (!el) return;
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth()-3, 1);
  const pmEvents = (db.calEvents||[])
    .filter(e => (e.type==='clean-major'||e.type==='clean-minor') && new Date(e.date) >= threeMonthsAgo)
    .sort((a,b) => new Date(b.date)-new Date(a.date));
  if (!pmEvents.length) {
    el.innerHTML = '<div style="text-align:center;color:#94a3b8;font-size:0.75rem;padding:16px">ยังไม่มีประวัติแผน PM</div>';
    return;
  }
  el.innerHTML = pmEvents.map(e => {
    const icon = e.type==='clean-major' ? '🔵' : '💦';
    const label = e.type==='clean-major' ? 'ล้างใหญ่' : 'ล้างย่อย';
    const d = new Date(e.date);
    const dateStr = d.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'});
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8fafc;border-radius:10px;border:1px solid #f1f5f9">
      <div style="font-size:1.2rem;flex-shrink:0">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.75rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.dept||e.title}</div>
        <div style="font-size:0.62rem;color:#94a3b8;margin-top:1px">${label} · ${dateStr}${e.tech?' · '+e.tech:''}</div>
      </div>
      <div style="font-size:0.65rem;background:${e.type==='clean-major'?'#eff6ff':'#f0fdf4'};color:${e.type==='clean-major'?'#0369a1':'#059669'};border-radius:99px;padding:2px 8px;font-weight:700;flex-shrink:0">${e.machineCount||''}${e.machineCount?' เครื่อง':''}</div>
    </div>`;
  }).join('');
}

function savePMPlanPage() {
  const type   = document.getElementById('pmpage-type').value;
  const date   = document.getElementById('pmpage-start-date').value;
  const techId = document.getElementById('pmpage-tech').value;
  const tech   = techId ? (db.users||[]).find(u=>u.id===techId) : null;
  if (!date) { showToast('⚠️ กรุณาเลือกวันที่'); return; }
  const checked = [...document.querySelectorAll('.pmpage-dept-cb:checked')];
  if (!checked.length) { showToast('⚠️ กรุณาเลือกอย่างน้อย 1 แผนก'); return; }
  const deptCount = {};
  (db.machines||[]).forEach(m => {
    const d = m.dept||m.location||'ไม่ระบุแผนก';
    deptCount[d] = (deptCount[d]||0)+1;
  });
  const typeLabel = type==='clean-major' ? 'ล้างใหญ่' : 'ล้างย่อย';
  const typeIcon  = type==='clean-major' ? '🔵' : '💦';
  if (!db.calEvents) db.calEvents = [];
  let added = 0;
  checked.forEach(cb => {
    const dept = cb.dataset.dept;
    const count = deptCount[dept]||0;
    db.calEvents.push({
      id: 'cev'+Date.now()+Math.random().toString(36).slice(2,6),
      type, date,
      title: `${typeIcon} ${typeLabel} — ${dept} (${count} เครื่อง)`,
      dept, start:'08:00', end:'17:00', machineId:'', machine:'',
      techId: techId||'', tech: tech?.name||'',
      note: `${typeLabel} ทั้งแผนก ${dept} — จำนวน ${count} เครื่อง`,
      machineCount: count,
    });
    added++;
  });
  saveDB(); fsSave();
  showToast(`${typeIcon} บันทึกแผน ${typeLabel} ${added} แผนกแล้ว`);
  renderPMPageHistory();
  // reset checkboxes
  pmPageSelectAll(false);
}


// ============================================================
// PM PLAN PAGE
// ============================================================
// goPagePMPlan ย้ายไปอยู่ใน app-core.js แล้ว

// switchPMPlanTab ย้ายไปอยู่ใน app-core.js แล้ว

// renderPMPlanSchedule ย้ายไปอยู่ใน app-core.js แล้ว

// deletePMEvent ย้ายไปอยู่ใน app-core.js แล้ว

// renderPMPlanHistory ย้ายไปอยู่ใน app-core.js แล้ว


// renderPMPlanDeptList ย้ายไปอยู่ใน app-core.js แล้ว

// pmplanUpdateCheck ย้ายไปอยู่ใน app-core.js แล้ว

function pmplanSelectAll(val) {
  document.querySelectorAll('.pmplan-dept-cb').forEach(cb => {
    cb.checked = val;
    pmplanUpdateCheck(cb);
  });
}

// setPMPlanType ย้ายไปอยู่ใน app-core.js แล้ว

function savePMPlan() {
  const type  = document.getElementById('pmplan-type').value;
  const date  = document.getElementById('pmplan-start-date').value;
  const techId = document.getElementById('pmplan-tech').value;
  const tech   = techId ? db.users.find(u => u.id===techId) : null;

  if (!date) { showToast('⚠️ กรุณาเลือกวันที่'); return; }

  const checked = [...document.querySelectorAll('.pmplan-dept-cb:checked')];
  if (!checked.length) { showToast('⚠️ กรุณาเลือกอย่างน้อย 1 แผนก'); return; }

  // นับแอร์แต่ละแผนก
  const deptCount = {};
  db.machines.forEach(m => {
    const d = m.dept || m.location || 'ไม่ระบุแผนก';
    deptCount[d] = (deptCount[d] || 0) + 1;
  });

  const typeLabel = type === 'clean-major' ? 'ล้างใหญ่' : 'ล้างย่อย';
  const typeIcon  = type === 'clean-major' ? '🔵' : '💦';

  if (!db.calEvents) db.calEvents = [];
  let added = 0;

  checked.forEach(cb => {
    const dept = cb.dataset.dept;
    const count = deptCount[dept] || 0;
    const ev = {
      id:      'cev' + Date.now() + Math.random().toString(36).slice(2,6),
      type,
      date,
      title:   `${typeIcon} ${typeLabel} — ${dept} (${count} เครื่อง)`,
      dept,
      start:   '08:00',
      end:     '17:00',
      machineId: '',
      machine:   '',
      techId:    techId || '',
      tech:      tech?.name || '',
      note:      `${typeLabel} ทั้งแผนก ${dept} — จำนวน ${count} เครื่อง`,
      machineCount: count,
    };
    db.calEvents.push(ev);
    added++;
  });

  saveDB();
  closeSheet('pmplan');
  renderCalendar();
  showToast(`${typeIcon} เพิ่ม ${typeLabel} ${added} แผนกลงปฏิทินแล้ว`);
}

// nowStr ย้ายไปอยู่ใน app-core.js แล้ว

// ============================================================
// LINE NOTIFY
// ============================================================
async function lineNotify(token, msg) {
  if (!token) return;
  try {
    await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'message=' + encodeURIComponent(msg)
    });
  } catch(e) { console.warn('Line Notify error:', e); }
}

// sendLineNotifyEvent ย้ายไปอยู่ใน app-core.js แล้ว

// ============================================================
// DIGITAL SIGNATURE
// ============================================================
let _sigTid = '';
let _sigType = ''; // 'tech_done' | 'reporter_verify' | 'admin_close'
let _sigCanvas = null;
let _sigCtx = null;
let _sigDrawing = false;
let _sigLastX = 0, _sigLastY = 0;

// openSignaturePad ย้ายไปอยู่ใน app-core.js แล้ว

function _sigPos(e) {
  const r = _sigCanvas.getBoundingClientRect();
  const scaleX = _sigCanvas.width  / r.width;
  const scaleY = _sigCanvas.height / r.height;
  const src = e.touches ? e.touches[0] : e;
  return { x: (src.clientX - r.left) * scaleX, y: (src.clientY - r.top) * scaleY };
}
function _sigTouchStart(e)  { e.preventDefault(); const p=_sigPos(e); _sigDrawing=true; _sigCtx.beginPath(); _sigCtx.moveTo(p.x,p.y); _sigLastX=p.x; _sigLastY=p.y; }
function _sigTouchMove(e)   { e.preventDefault(); if(!_sigDrawing) return; const p=_sigPos(e); _sigCtx.lineTo(p.x,p.y); _sigCtx.stroke(); _sigLastX=p.x; _sigLastY=p.y; }
function _sigTouchEnd(e)    { e.preventDefault(); _sigDrawing=false; }
function _sigMouseDown(e)   { const p=_sigPos(e); _sigDrawing=true; _sigCtx.beginPath(); _sigCtx.moveTo(p.x,p.y); _sigLastX=p.x; _sigLastY=p.y; }
function _sigMouseMove(e)   { if(!_sigDrawing) return; const p=_sigPos(e); _sigCtx.lineTo(p.x,p.y); _sigCtx.stroke(); _sigLastX=p.x; _sigLastY=p.y; }
function _sigMouseUp()      { _sigDrawing=false; }

// clearSignaturePad ย้ายไปอยู่ใน app-core.js แล้ว

// closeSignaturePad ย้ายไปอยู่ใน app-core.js แล้ว

// confirmSignature ย้ายไปอยู่ใน app-core.js แล้ว

// ============================================================
// DEPT QR SHEET — QR Code รายแผนก แถวละ 10
// ============================================================
let _deptQRFilter = '';

function openDeptQRSheet() {
  _deptQRFilter = '';
  const si = document.getElementById('deptqr-search');
  if (si) si.value = '';
  _buildDeptQRTabs();
  _renderDeptQRBody();
  openSheet('deptqr');
}

function _onDeptQRSearch() {
  _renderDeptQRBody();
}

function _buildDeptQRTabs() {
  const depts = [...new Set(db.machines.map(m => m.dept || m.location || 'ไม่ระบุแผนก'))].sort();
  const el = document.getElementById('deptqr-tabs'); if (!el) return;
  const tabs = [
    {label:'ทั้งหมด ('+db.machines.length+')', val:''},
    ...depts.map(d => ({label: d+' ('+db.machines.filter(m=>(m.dept||m.location||'ไม่ระบุแผนก')===d).length+')', val: d}))
  ];
  el.innerHTML = tabs.map((tab,i) => `
    <button data-qrtab="${i}"
      style="white-space:nowrap;border:none;border-radius:99px;padding:6px 13px;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.15s;flex-shrink:0;
      background:${_deptQRFilter===tab.val?'linear-gradient(135deg,#7c3aed,#5b21b6)':'#f3f4f6'};
      color:${_deptQRFilter===tab.val?'white':'#64748b'}">
      ${tab.label}
    </button>`).join('');
  // ใช้ event delegation แทน inline onclick เพื่อหลีกเลี่ยง quote escape
  el.querySelectorAll('button[data-qrtab]').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      _setDeptQRFilter(tabs[i].val);
    });
  });
}

function _setDeptQRFilter(val) {
  _deptQRFilter = val;
  _buildDeptQRTabs();
  _renderDeptQRBody();
}

function _renderDeptQRBody() {
  const body = document.getElementById('deptqr-body'); if (!body) return;
  const searchQ = (document.getElementById('deptqr-search')?.value || '').trim().toLowerCase();

  let machines = _deptQRFilter
    ? db.machines.filter(m => (m.dept||m.location||'ไม่ระบุแผนก') === _deptQRFilter)
    : db.machines;

  if (searchQ) {
    machines = machines.filter(m =>
      (m.serial||'').toLowerCase().includes(searchQ) ||
      (m.name||'').toLowerCase().includes(searchQ) ||
      (m.dept||m.location||'').toLowerCase().includes(searchQ) ||
      (m.id||'').toLowerCase().includes(searchQ)
    );
  }

  // Update count label
  const countEl = document.getElementById('deptqr-count');
  if (countEl) countEl.textContent = machines.length ? `พบ ${machines.length} เครื่อง` : '';

  if (!machines.length) {
    body.innerHTML = '<div style="text-align:center;padding:48px 20px;color:#94a3b8"><div style="font-size:2.5rem;margin-bottom:10px">🔍</div><div style="font-weight:700">ไม่พบเครื่องแอร์</div></div>';
    return;
  }

  // จัดกลุ่มตามแผนก
  const deptMap = {};
  machines.forEach(m => {
    const d = m.dept || m.location || 'ไม่ระบุแผนก';
    if (!deptMap[d]) deptMap[d] = [];
    deptMap[d].push(m);
  });

  const ITEM_W = 90; // px ต่อเครื่อง
  const GAP    = 8;
  const COLS   = 10; // แถวละ 10

  let html = '';
  Object.entries(deptMap).sort(([a],[b])=>a.localeCompare(b)).forEach(([dept, list]) => {
    const deptKey = encodeURIComponent(dept);
    const gridW = Math.min(list.length, COLS) * (ITEM_W + GAP);
    html += `
      <div style="margin-bottom:20px">
        <!-- Dept header -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:10px 14px;background:linear-gradient(135deg,#7c3aed,#5b21b6);border-radius:14px;box-shadow:0 3px 10px rgba(124,58,237,0.25)">
          <div style="width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.8);flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.85rem;font-weight:800;color:white;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${dept}</div>
            <div style="font-size:0.62rem;color:rgba(255,255,255,0.7);margin-top:1px">${list.length} เครื่อง · ${Math.ceil(list.length/COLS)} แถว</div>
          </div>
          <div style="background:rgba(255,255,255,0.2);color:white;border-radius:99px;padding:3px 10px;font-size:0.68rem;font-weight:800;flex-shrink:0">${list.length}</div>
          <!-- ปุ่มพิมพ์แผนกนี้ A4 -->
          <button onclick="printDeptQRA4('${deptKey}')"
            style="display:flex;align-items:center;gap:4px;padding:5px 10px;background:rgba(255,255,255,0.2);border:1.5px solid rgba(255,255,255,0.5);border-radius:8px;color:white;font-size:0.65rem;font-weight:800;cursor:pointer;font-family:inherit;flex-shrink:0;-webkit-tap-highlight-color:transparent">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            A4
          </button>
        </div>

        <!-- QR Grid — scroll แนวนอน แถวละ 10 -->
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:4px">
          <div style="display:grid;grid-template-columns:repeat(${Math.min(COLS,list.length)},${ITEM_W}px);grid-template-rows:auto;gap:${GAP}px;width:max-content;min-width:100%">
            ${list.map(m => {
              const qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=' + encodeURIComponent(m.id) + '&margin=2&format=png';
              // ข้อ 6: AIR ID = m.id (ตัดคำนำหน้า csv_)
              const airId = m.id.replace(/^csv_/,'');
              return `
              <div onclick="showMachineQR('${m.id}')"
                style="width:${ITEM_W}px;background:white;border-radius:10px;padding:7px 5px 5px;text-align:center;border:1.5px solid #e5e7eb;box-shadow:0 1px 4px rgba(0,0,0,0.06);cursor:pointer;box-sizing:border-box;transition:all 0.15s"
                ontouchstart="this.style.borderColor='#7c3aed';this.style.transform='scale(0.93)'"
                ontouchend="this.style.borderColor='#e5e7eb';this.style.transform=''">
                <div style="width:72px;height:72px;margin:0 auto 4px;border-radius:7px;overflow:hidden;background:#f3f4f6;display:flex;align-items:center;justify-content:center;position:relative">
                  <img
                    src="${qrSrc}"
                    width="72" height="72"
                    loading="lazy"
                    style="display:block;width:72px;height:72px;border-radius:6px"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
                    onload="this.style.opacity='1'"
                  />
                  <div style="display:none;position:absolute;inset:0;flex-direction:column;align-items:center;justify-content:center;background:#f8fafc;border-radius:6px">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>
                    <span style="font-size:0.45rem;color:#cbd5e1;margin-top:3px">ต้องการเน็ต</span>
                  </div>
                </div>
                <!-- AIR ID (ข้อ 6) -->
                <div style="font-family:'JetBrains Mono',monospace;font-size:0.5rem;font-weight:900;color:#c8102e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px;background:#fff0f2;border-radius:4px;margin-bottom:2px">${airId}</div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:0.5rem;font-weight:700;color:#7c3aed;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px">${m.serial||''}</div>
                <div style="font-size:0.45rem;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px;padding:0 2px">${(m.name||'').slice(0,14)}${m.name&&m.name.length>14?'…':''}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>`;
  });

  body.innerHTML = html;
}

// ── พิมพ์ QR แผนกนี้ A4 ──────────────────────────────────────
function printDeptQRA4(deptKey) {
  const dept = decodeURIComponent(deptKey);
  const list = (db.machines||[]).filter(m => (m.dept||m.location||'ไม่ระบุแผนก') === dept);
  if (!list.length) return;

  const QR_SIZE = 100; // px สำหรับ print
  const COLS_A4 = 6;   // 6 คอลัมน์ต่อหน้า A4

  const rows = [];
  for (let i = 0; i < list.length; i += COLS_A4) {
    rows.push(list.slice(i, i + COLS_A4));
  }

  const gridHtml = rows.map(row => `
    <tr>
      ${row.map(m => {
        const qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=' + encodeURIComponent(m.id) + '&margin=3&format=png';
        const airId = m.id.replace(/^csv_/,'');
        return `<td style="padding:6px;text-align:center;border:1px solid #e5e7eb;vertical-align:top;width:${Math.floor(170/COLS_A4)}mm">
          <img src="${qrSrc}" width="${QR_SIZE}" height="${QR_SIZE}" style="display:block;margin:0 auto 3px"/>
          <div style="font-family:monospace;font-size:7pt;font-weight:900;color:#c8102e;margin-bottom:1px">${airId}</div>
          <div style="font-family:monospace;font-size:6pt;font-weight:700;color:#7c3aed;margin-bottom:1px">${m.serial||''}</div>
          <div style="font-size:6pt;color:#374151;font-weight:600;line-height:1.3">${m.name||''}</div>
          <div style="font-size:5.5pt;color:#94a3b8">${m.dept||m.location||''}</div>
        </td>`;
      }).join('')}
      ${row.length < COLS_A4 ? Array(COLS_A4 - row.length).fill('<td style="border:1px solid #f1f5f9"></td>').join('') : ''}
    </tr>
  `).join('');

  const win = window.open('','_blank','width=900,height=700');
  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>QR Code — ${dept}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  body { font-family: 'Sarabun', 'TH Sarabun New', sans-serif; margin: 0; padding: 0; }
  .header { display:flex; align-items:center; justify-content:space-between; padding:8px 0 6px; border-bottom:2px solid #c8102e; margin-bottom:10px; }
  .logo-block { display:flex; align-items:center; gap:8px; }
  .logo-sq { width:32px; height:32px; background:#0a0a0a; border-radius:6px; display:flex; align-items:center; justify-content:center; color:white; font-size:16px; font-weight:900; }
  .title-main { font-size:13pt; font-weight:900; color:#0f172a; }
  .title-sub { font-size:7pt; color:#94a3b8; margin-top:1px; }
  .dept-badge { background:#7c3aed; color:white; border-radius:6px; padding:4px 12px; font-size:9pt; font-weight:800; }
  .meta { font-size:7pt; color:#94a3b8; text-align:right; margin-top:2px; }
  table { width:100%; border-collapse:collapse; }
  td { page-break-inside: avoid; }
  img { image-rendering: crisp-edges; }
  @media print {
    button { display: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head><body>
<div class="header">
  <div class="logo-block">
    <div class="logo-sq">A</div>
    <div>
      <div class="title-main">AIRCONDITION BP PROCESS</div>
      <div class="title-sub">SCG BP Plant Engineering — QR Code Registry</div>
    </div>
  </div>
  <div style="text-align:right">
    <div class="dept-badge">${dept}</div>
    <div class="meta">${list.length} เครื่อง &nbsp;·&nbsp; พิมพ์: ${new Date().toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'numeric'})}</div>
  </div>
</div>
<table>${gridHtml}</table>
<div style="margin-top:10px;padding-top:6px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center">
  <div style="font-size:6pt;color:#94a3b8">AIRCONDITION BP Process — SCG BP Plant Engineering</div>
  <div style="font-size:6pt;color:#94a3b8">สแกน QR เพื่อแจ้งซ่อมหรือดูประวัติ</div>
</div>
<div style="text-align:center;margin-top:12px">
  <button onclick="window.print()" style="padding:8px 24px;background:#7c3aed;color:white;border:none;border-radius:8px;font-size:10pt;font-weight:700;cursor:pointer;font-family:inherit">🖨️ พิมพ์ A4</button>
  <button onclick="window.close()" style="padding:8px 24px;background:#f1f5f9;color:#374151;border:none;border-radius:8px;font-size:10pt;font-weight:700;cursor:pointer;font-family:inherit;margin-left:8px">ปิด</button>
</div>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 800);
}

// ============================================================
