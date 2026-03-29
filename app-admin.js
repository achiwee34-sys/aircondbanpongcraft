// NOTIFICATIONS
// ============================================================
function notifyUser(uid,title,msg,tid='',_skipSync=false){
  if(!uid)return;
  if(!db.notifications)db.notifications=[];
  db.notifications.unshift({id:'n'+Date.now()+Math.random(),userId:uid,title,msg,tid,time:nowStr(),read:false});
  if(db.notifications.length>150)db.notifications=db.notifications.slice(0,150);
  if(CU && uid===CU.id){
    updateNBadge();
    const bell = document.getElementById('ntf-btn');
    if (bell) { bell.style.transform='scale(1.3)'; setTimeout(()=>bell.style.transform='',300); }
  }
  // sync Firebase realtime (ถ้าไม่ใช่ batch call)
  if(!_skipSync && typeof fsSave === 'function') fsSave();
}
function notifyRole(role,title,msg,tid=''){
  db.users.filter(u=>u.role===role).forEach(u=>notifyUser(u.id,title,msg,tid,true)); // batch — skip sync each
  // sync ครั้งเดียวหลัง push ทั้งหมด
  if(typeof fsSave === 'function') fsSave();
}
function updateNBadge(){
  const cnt=db.notifications.filter(n=>n.userId===CU?.id&&!n.read).length;
  document.getElementById('ndot')?.classList.toggle('on',cnt>0);
}
function renderNotifPanel(){
  const mine=db.notifications.filter(n=>n.userId===CU?.id).slice(0,10);
  document.getElementById('notif-body').innerHTML=mine.length===0
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
            style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:#f1f5f9;border:none;cursor:pointer;color:#94a3b8;font-size:0.85rem;font-weight:800;display:flex;align-items:center;justify-content:center"
            onmouseover="this.style.background='#fee2e2';this.style.color='#dc2626'"
            onmouseout="this.style.background='#f1f5f9';this.style.color='#94a3b8'">×</button>
        </div>
      </div><div class="ni-sep"></div>`).join('');
}
function dismissNotif(nid){
  const el=document.getElementById('ni-'+nid);
  if(el){
    el.style.transition='opacity 0.2s,max-height 0.25s';
    el.style.opacity='0';
    el.style.maxHeight='0';
    el.style.overflow='hidden';
    setTimeout(()=>{
      db.notifications=db.notifications.filter(n=>n.id!==nid);
      saveDB();updateNBadge();renderNotifPanel();
    },250);
  }
}
function openNotifSheet(){renderNotifPanel();openSheet('notif');}
function clickNotif(nid,tid){
  const n=db.notifications.find(x=>x.id===nid);
  if(n) n.read=true;
  saveDB(); updateNBadge(); renderNotifPanel();
  if(tid && tid.trim()){
    closeSheet('notif');
    const isChat = n && n.title && n.title.startsWith('💬');
    setTimeout(()=>{
      const tkId = tid.trim().replace(/^tk_/,'');
      if (isChat) {
        // เปิด chat full screen โดยตรง ไม่ผ่าน detail
        const t = db.tickets.find(x=>x.id===tkId);
        if (t) {
          const partnerId = CU.role==='tech' ? t.reporterId : (t.assigneeId || t.reporterId);
          if (partnerId) openChat(tkId, partnerId);
        }
      } else {
        openDetail(tkId);
      }
    }, 200);
  }
}
function markAllRead(){db.notifications.filter(n=>n.userId===CU?.id).forEach(n=>n.read=true);saveDB();updateNBadge();renderNotifPanel();}
function clearNotifs(){db.notifications=db.notifications.filter(n=>n.userId!==CU?.id);saveDB();updateNBadge();renderNotifPanel();}

// ============================================================
// SHEETS (Bottom Sheet Controller)
// ============================================================
function openSheet(name){
  // chat-sheet เป็น fullscreen แบบพิเศษ
  if (name === 'chat') {
    const sh = document.getElementById('chat-sheet');
    if (sh) {
      sh.classList.add('visible');
      // ── keyboard fix for chat-sheet ──
      function _chatKbFix() {
        if (!sh.classList.contains('visible')) return;
        const vv = window.visualViewport;
        if (!vv) return;
        const vvh = vv.height;
        const offsetTop = vv.offsetTop || 0;
        const offsetLeft = vv.offsetLeft || 0;
        // ใช้ transform แทน top/height เพื่อไม่ trigger layout reflow
        sh.style.transform = `translateY(${offsetTop}px) translateX(${offsetLeft}px)`;
        sh.style.height = vvh + 'px';
        // scroll messages ไปล่างสุดเมื่อ keyboard ขึ้น
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
  // ปิด sheet + overlay อื่นๆ ทั้งหมดก่อนเปิดอันใหม่ (force-close ป้องกันซ้อน)
  document.querySelectorAll('.sheet').forEach(s => {
    if (s.id !== name+'-sheet') {
      s.classList.remove('open');
      if (s._kbHandler) { s.removeEventListener('focusin', s._kbHandler); delete s._kbHandler; }
    }
  });
  document.querySelectorAll('.sheet-overlay').forEach(o => {
    if (o.id !== name+'-overlay') {
      o.classList.remove('open');
      o.style.display = 'none';
    }
  });

  const ov = document.getElementById(name+'-overlay');
  const sh = document.getElementById(name+'-sheet');
  if (!ov || !sh) { console.warn('openSheet: element not found for', name); return; }
  ov.classList.add('open');
  requestAnimationFrame(()=>{
    sh.classList.add('open');
    // ── keyboard fix: scroll focused input into view inside sheet ──
    const onFocusIn = (e) => {
      const el = e.target;
      if (!el || !['INPUT','TEXTAREA','SELECT'].includes(el.tagName)) return;
      setTimeout(() => {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 320);
    };
    sh.addEventListener('focusin', onFocusIn);
    sh._kbHandler = onFocusIn;
  });
  if (navigator.vibrate) navigator.vibrate(30);
}
function closeSheet(name){
  // chat-sheet fullscreen
  if (name === 'chat') {
    const sh = document.getElementById('chat-sheet');
    if (sh) {
      sh.classList.remove('visible');
      // cleanup keyboard fix listener
      if (sh._chatKbFix && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', sh._chatKbFix);
        window.visualViewport.removeEventListener('scroll', sh._chatKbFix);
        delete sh._chatKbFix;
      }
      sh.style.height = '';
      sh.style.top = '';
      sh.style.transform = '';
    }
    return;
  }
  // ── PATCH: reset machine sheet เมื่อปิด เพื่อป้องกัน sheet ค้าง ──
  if (name === 'machine') {
    const mid = document.getElementById('m-id');
    if (mid) mid.value = '';
    const titleText = document.getElementById('ms-title-text');
    if (titleText) titleText.textContent = 'เพิ่มเครื่องแอร์ใหม่';
    const addDeptBox = document.getElementById('m-add-dept-box');
    if (addDeptBox) addDeptBox.style.display = 'block';
    const missingBanner = document.getElementById('ms-missing-banner');
    if (missingBanner) missingBanner.style.display = 'none';
  }
  const sh = document.getElementById(name+'-sheet');
  const ov = document.getElementById(name+'-overlay');
  if (sh) {
    sh.classList.remove('open');
    // cleanup keyboard handler
    if (sh._kbHandler) { sh.removeEventListener('focusin', sh._kbHandler); delete sh._kbHandler; }
  }
  if (ov) setTimeout(() => {
    ov.classList.remove('open');
    ov.style.display = ''; // reset force-hide
  }, 350);
}

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
      db._seq = 1;
    }
    if (type === 'reset' || type === 'users') {
      // เก็บเฉพาะ user ที่ login อยู่
      db.users = db.users.filter(u => u.id === CU.id);
    }
    // machines ไม่แตะเลย — เก็บไว้ทุกกรณี

    saveDB();
    if (_firebaseReady && FSdb) {
      await FSdb.collection('appdata').doc('main').set({
        data: JSON.stringify(db),
        updatedAt: new Date().toISOString(),
        updatedBy: CU?.name || 'admin'
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
}async function syncUser(u){const url=db.gsUrl;if(!url)return;_showSyncDot();try{await fetch(url,{method:'POST',mode:'no-cors',body:JSON.stringify({action:'user',d:u}),headers:{'Content-Type':'application/json'}});}catch(e){}finally{_hideSyncDot();}}let _syncCount = 0;
function _showSyncDot() { _syncCount++; const d=document.getElementById('sync-dot'); if(d) d.style.display='inline'; }
function _hideSyncDot() { _syncCount=Math.max(0,_syncCount-1); if(_syncCount===0){const d=document.getElementById('sync-dot'); if(d) d.style.display='none';} }
async function syncTicket(t){const url=db.gsUrl;if(!url)return;_showSyncDot();try{const {signatures:_s,...tNoSig}=t;await fetch(url,{method:'POST',mode:'no-cors',body:JSON.stringify({action:'ticket',d:tNoSig}),headers:{'Content-Type':'application/json'}});}catch(e){}finally{_hideSyncDot();}}
async function syncMachine(m){const url=db.gsUrl;if(!url)return;_showSyncDot();try{await fetch(url,{method:'POST',mode:'no-cors',body:JSON.stringify({action:'machine',d:m}),headers:{'Content-Type':'application/json'}});}catch(e){}finally{_hideSyncDot();}}
// ============================================================
// UTILS
// ============================================================

// ============================================================
// DARK MODE
// ============================================================
// ============================================================
// LANGUAGE / i18n  TH ↔ EN
// ============================================================
let _lang = localStorage.getItem('aircon_lang') || 'TH';

const I18N = {
  TH: {},
  EN: {
    // ── Status ──
    'ใหม่':'New','จ่ายแล้ว':'Assigned','รับแล้ว':'Accepted',
    'กำลังซ่อม':'In Progress','รออะไหล่':'Waiting Part',
    'เสร็จแล้ว':'Done','ตรวจรับ':'Verified','ปิดงาน':'Closed',
    // ── Priority ──
    'ด่วนมาก':'Urgent','ปานกลาง':'Normal','ไม่เร่งด่วน':'Low',
    // ── Bottom nav ──
    'หน้าแรก':'Home','รายการ':'Tickets','เครื่องแอร์':'Machines',
    'ผู้ใช้':'Users','รายงาน':'Report','สั่งซื้อ':'Purchase',
    'ตั้งค่า':'Settings','แจ้งซ่อม':'New Job','ปฏิทิน':'Calendar',
    'ติดตาม':'Tracking','งานฉัน':'My Work',
    // ── Home page ──
    'สวัสดี':'Hello','ยินดีต้อนรับ':'Welcome',
    'งานวันนี้':'Today\'s Jobs','งานค้าง':'Pending','งานด่วน':'Urgent Jobs',
    'งานทั้งหมด':'All Jobs','แจ้งซ่อมใหม่':'New Repair',
    'ผู้ใช้งาน':'Users','รายงาน':'Report','สั่งซื้อของ':'Purchase',
    // ── Ticket list ──
    'ทั้งหมด':'All','ค้นหา...':'Search...','ค้นหางาน...':'Search jobs...',
    'ไม่พบข้อมูล':'No data found','ปัญหา':'Problem',
    'ผู้แจ้ง':'Reporter','ช่างที่รับ':'Technician',
    'วันที่แจ้ง':'Reported','อัปเดตล่าสุด':'Updated',
    'รายละเอียด':'Detail','หมายเหตุ':'Note',
    'ปิด':'Close','ยกเลิก':'Cancel','บันทึก':'Save',
    // ── Complete sheet ──
    'บันทึกผลการซ่อม':'Repair Record',
    'รายการงานที่ดำเนินการ':'Work Done',
    'เลือกรายการงาน':'Select Tasks',
    'วัสดุที่ใช้':'Materials Used',
    'น้ำยาแอร์':'Refrigerant',
    'อะไหล่ที่เปลี่ยน':'Parts Replaced',
    'ค่าวัด':'Measurements',
    'สรุปผลการดำเนินการ':'Summary',
    'รูปถ่ายหลังซ่อม':'After Photos',
    'รูปถ่ายก่อนซ่อม':'Before Photos',
    'ส่งผลการซ่อม':'Submit',
    'ก่อนซ่อม':'Before','หลังซ่อม':'After',
    // ── Machines ──
    'เครื่องทั้งหมด':'All Machines','แผนก':'Department',
    'ยี่ห้อ':'Brand','รุ่น':'Model','ซีเรียล':'Serial',
    'ขนาด':'Capacity','น้ำยา':'Refrigerant',
    'รอบ PM':'PM Interval','เดือน':'months',
    // ── Purchase ──
    'ใบสั่งซื้อ':'Purchase Order','สั่งซื้อ':'Order',
    'รอดำเนินการ':'Pending','อนุมัติแล้ว':'Approved',
    'รับของแล้ว':'Received','รายการ':'Items',
    'ราคา':'Price','รวม':'Total',
    // ── Calendar ──
    'วางแผน PM':'PM Plan','เพิ่ม':'Add',
    'วันนี้':'Today','สัปดาห์นี้':'This Week',
    // ── Settings ──
    'โปรไฟล์':'Profile','ชื่อ':'Name','ชื่อผู้ใช้':'Username',
    'รหัสผ่าน':'Password','บันทึกการตั้งค่า':'Save Settings',
    'ออกจากระบบ':'Logout','โหมดมืด':'Dark Mode',
    'ภาษา':'Language','ซิงค์ข้อมูล':'Sync Data',
    'โหลดข้อมูล':'Load Data','โซนอันตราย':'Danger Zone',
    // ── Users ──
    'เพิ่มผู้ใช้':'Add User','แก้ไข':'Edit','ลบ':'Delete',
    'แอดมิน':'Admin','ช่างซ่อม':'Technician','ผู้แจ้งงาน':'Reporter',
    // ── Report ──
    'รายงานสรุป':'Summary Report','ปัญหาที่พบบ่อย':'Frequent Problems',
    'ประสิทธิภาพ':'Performance',
    // ── Misc ──
    'เครื่อง':'Units','ทั้งหมด (จาก)':'All from',
    'ล้างใหญ่':'Major Clean','ล้างย่อย':'Minor Clean',
    'กรอกข้อมูลให้ครบถ้วน':'Fill in all required fields',
    '* จำเป็น':'* Required','ไม่บังคับ':'Optional',
    'สูงสุด 3 รูป / ประเภท':'Max 3 photos / type',
    'บีบอัดอัตโนมัติ':'Auto compressed',
  }
};

function t(key) {
  if (_lang === 'TH') return key;
  return (I18N.EN[key]) || key;
}

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
      else if (p==='calendar') renderCalendar();
      else if (p==='machines') renderMachines?.();
      else if (p==='users') renderUsers?.();
      else if (p==='purchase') renderPurchase?.();
    }
  });
}


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
  setTimeout(() => document.addEventListener('click', _menuOutsideTap, {once:true}), 10);
}
function _closeTopMenu() {
  const m = document.getElementById('tb-quick-menu');
  if (m) m.style.display = 'none';
  document.removeEventListener('click', _menuOutsideTap);
}
function _menuOutsideTap(e) {
  const m = document.getElementById('tb-quick-menu');
  const btn = document.getElementById('tb-avatar-btn');
  if (m && !m.contains(e.target) && !btn?.contains(e.target)) _closeTopMenu();
}
function _tbMenu(page) {
  _closeTopMenu();
  goPage(page);
}
function initLang() {
  _lang = localStorage.getItem('aircon_lang') || 'TH';
  const btn = document.getElementById('lang-btn');
  if (btn) btn.textContent = _lang === 'EN' ? '🇹🇭 TH' : '🇬🇧 EN';
  if (_lang === 'EN') applyLang();
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('aircon_dark', isDark ? '1' : '0');
  _updateDarkBtn(isDark);
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
function initDarkMode() {
  const saved = localStorage.getItem('aircon_dark');
  if (saved === '1') {
    document.body.classList.add('dark-mode');
    _updateDarkBtn(true);
  }
}

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

// ============================================================
// PM AUTO-SCHEDULE — สร้าง Ticket PM อัตโนมัติ (Admin)
// ============================================================
function generatePMTickets(filterDept) {
  if (CU.role !== 'admin') return;
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  let created = 0;
  // filter by dept if specified
  const machines = filterDept
    ? db.machines.filter(m => (m.dept||m.location||'') === filterDept)
    : db.machines;
  machines.forEach(m => {
    if (!m.interval || !m.serial) return;
    // หา PM ticket ล่าสุดของเครื่องนี้
    const pmTks = db.tickets.filter(t =>
      t.machineId === m.id && t.problem && t.problem.includes('PM') &&
      ['done','verified','closed'].includes(t.status)
    ).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    const lastPM = pmTks[0];
    let shouldCreate = false;
    if (!lastPM) {
      shouldCreate = true;
    } else {
      const lastDate = new Date(lastPM.createdAt||'');
      if (!isNaN(lastDate)) {
        const diffDays = (today - lastDate) / (1000*60*60*24);
        const intervalDays = (m.interval||6) * 30;
        shouldCreate = diffDays >= intervalDays;
      }
    }
    if (shouldCreate) {
      // ตรวจว่ามี PM pending อยู่แล้วไหม
      const hasPending = db.tickets.some(t =>
        t.machineId===m.id && t.problem?.includes('PM') &&
        !['done','verified','closed'].includes(t.status)
      );
      if (!hasPending) {
        const seq = (db._seq || 1);
        db._seq = seq + 1;
        const _n2=new Date();const _m2=String(_n2.getMonth()+1).padStart(2,'0');const _y2=_n2.getFullYear();
        const tid = 'TK'+_m2+_y2+String(seq).padStart(3,'0');
        const now = nowStr();
        db.tickets.push({
          id:tid, machineId:m.id, machine:m.name,
          problem:'PM บำรุงรักษาประจำงวด '+m.interval+' เดือน',
          detail:'PM ตามกำหนด interval '+m.interval+' เดือน — '+m.serial,
          priority:'mid', status:'new',
          reporterId:'u1', reporter:'ระบบอัตโนมัติ',
          assigneeId:null, assignee:null,
          createdAt:now, updatedAt:now,
          cost:0, summary:'', parts:'', note:'',
          contact:'', photosBefore:[], photosAfter:[],
          history:[{act:'📅 สร้าง PM อัตโนมัติ',by:'ระบบ',at:now}]
        });
        created++;
      }
    }
  });
  const deptLabel = filterDept ? ' ('+filterDept+')' : '';
  const resultEl = document.getElementById('pm-result');
  if (created > 0) {
    saveDB();
    const msg = '📅 สร้าง PM '+created+' รายการ'+deptLabel;
    showToast(msg);
    if (resultEl) { resultEl.style.display='block'; resultEl.style.background='#f0fdf4'; resultEl.style.color='#15803d'; resultEl.style.border='1px solid #bbf7d0'; resultEl.textContent=msg; }
    refreshPage();
  } else {
    const msg = '✅ ไม่มี PM ที่ถึงกำหนด'+deptLabel;
    showToast(msg);
    if (resultEl) { resultEl.style.display='block'; resultEl.style.background='#eff6ff'; resultEl.style.color='#1d4ed8'; resultEl.style.border='1px solid #bfdbfe'; resultEl.textContent=msg; }
  }
}


// ============================================================
// PM PLAN SHEET — ล้างใหญ่ / ล้างย่อย แยกแผนก
// ============================================================
// ══ PM Plan — Full Page ══
function openPMPlanPage() {
  goPage('pmplan');
  // set default date = today
  const today = new Date().toISOString().split('T')[0];
  const dateEl = document.getElementById('pmpage-start-date');
  if (dateEl) dateEl.value = today;
  // populate tech dropdown
  const techSel = document.getElementById('pmpage-tech');
  if (techSel) {
    techSel.innerHTML = '<option value="">— ทุกช่าง —</option>';
    (db.users||[]).filter(u => u.role==='tech').forEach(u => {
      const o = document.createElement('option');
      o.value = u.id; o.textContent = u.name;
      techSel.appendChild(o);
    });
  }
  setPMPageType('clean-major');
  renderPMPageDeptList();
  renderPMPageHistory();
}

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

function deletePMEvent(id) {
  db.calEvents = (db.calEvents||[]).filter(e => e.id !== id);
  saveDB(); fsSave();
  renderPMPlanSchedule();
  showToast('🗑️ ลบแผน PM แล้ว');
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

function pmplanSelectAll(val) {
  document.querySelectorAll('.pmplan-dept-cb').forEach(cb => {
    cb.checked = val;
    pmplanUpdateCheck(cb);
  });
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

function nowStr(){
  // เก็บเป็น ISO format เพื่อให้ new Date() parse ได้
  const d = new Date();
  const pad = n => String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
}

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

function sendLineNotifyEvent(event, t) {
  const ln = db.lineNotify;
  if (!ln) return;
  const ser = getSerial(t) ? ' ['+getSerial(t)+']' : '';
  const base = '\n🏭 SCG AIRCON BP\n';
  if (event === 'new' && ln.evNew) {
    const msg = base + '🆕 งานใหม่เข้า!\n📋 ' + t.id + ser + '\n🔧 ' + t.problem + '\n❄️ ' + t.machine + '\n📢 ผู้แจ้ง: ' + t.reporter + '\n🔥 ด่วน: ' + (prTH(t.priority)) + '\n🕐 ' + nowStr();
    if (ln.tokenAdmin) lineNotify(ln.tokenAdmin, msg);
    if (ln.tokenTech)  lineNotify(ln.tokenTech,  msg);
  } else if (event === 'accept' && ln.evAccept) {
    const msg = base + '🔧 ช่างรับงานและเริ่มซ่อมแล้ว\n📋 ' + t.id + ser + '\n🔧 ' + t.problem + '\n👷 ช่าง: ' + (t.assignee||'—') + '\n🕐 ' + nowStr();
    if (ln.tokenAdmin) lineNotify(ln.tokenAdmin, msg);
  } else if (event === 'start' && ln.evAccept) {
    const msg = base + '⚙️ เริ่มซ่อมแล้ว\n📋 ' + t.id + ser + '\n🔧 ' + t.problem + '\n👷 ช่าง: ' + (t.assignee||'—') + '\n🕐 ' + nowStr();
    if (ln.tokenAdmin) lineNotify(ln.tokenAdmin, msg);
  } else if (event === 'done' && ln.evDone) {
    const msg = base + '✅ ซ่อมเสร็จแล้ว!\n📋 ' + t.id + ser + '\n🔧 ' + t.problem + '\n❄️ ' + t.machine + '\n👷 ช่าง: ' + (t.assignee||'—') + '\n📝 ' + (t.summary||'') + '\n🕐 ' + nowStr();
    if (ln.tokenAdmin) lineNotify(ln.tokenAdmin, msg);
    if (ln.tokenTech)  lineNotify(ln.tokenTech,  msg);
  }
}

// ============================================================
// DIGITAL SIGNATURE
// ============================================================
let _sigTid = '';
let _sigType = ''; // 'tech_done' | 'reporter_verify' | 'admin_close'
let _sigCanvas = null;
let _sigCtx = null;
let _sigDrawing = false;
let _sigLastX = 0, _sigLastY = 0;

function clearSignaturePad() {
  if (_sigCtx && _sigCanvas) {
    _sigCtx.clearRect(0, 0, _sigCanvas.width, _sigCanvas.height);
    const ph = document.getElementById('sig-placeholder');
    if(ph) ph.style.opacity='1';
  }
}

function closeSignaturePad() {
  document.getElementById('sig-overlay')?.remove();
  _sigTid = ''; _sigType = ''; _sigCanvas = null; _sigCtx = null;
}

function confirmSignature() {
  if (!_sigCanvas) return;
  // ตรวจว่ามีการเซ็นจริง (pixel ไม่ว่าง)
  const data = _sigCtx.getImageData(0,0,_sigCanvas.width,_sigCanvas.height).data;
  const hasInk = data.some((v,i) => i%4===3 && v>0);
  if (!hasInk) { showToast('⚠️ กรุณาเซ็นชื่อในกรอบก่อน'); return; }

  // compress signature: วาด white background ก่อน export JPEG (ไม่งั้น transparent → ดำ)
  const _sigExport = document.createElement('canvas');
  _sigExport.width = _sigCanvas.width;
  _sigExport.height = _sigCanvas.height;
  const _sigExportCtx = _sigExport.getContext('2d');
  _sigExportCtx.fillStyle = 'white';
  _sigExportCtx.fillRect(0, 0, _sigExport.width, _sigExport.height);
  _sigExportCtx.drawImage(_sigCanvas, 0, 0);
  const sigDataUrl = _sigExport.toDataURL('image/jpeg', 0.4);
  const t = db.tickets.find(x=>x.id===_sigTid);
  if (!t) { closeSignaturePad(); return; }

  if (!t.signatures) t.signatures = {};
  const now = nowStr();

  if (_sigType === 'tech_done') {
    t.signatures.tech = { data: sigDataUrl, by: CU.name, at: now };
    t.history.push({ act:'✍️ ช่างเซ็นชื่อยืนยัน', by: CU.name, at: now });
  } else if (_sigType === 'reporter_verify') {
    t.signatures.reporter = { data: sigDataUrl, by: CU.name, at: now };
    t.history.push({ act:'✍️ ผู้แจ้งเซ็นชื่อตรวจรับ', by: CU.name, at: now });
  } else if (_sigType === 'admin_close') {
    t.signatures.admin = { data: sigDataUrl, by: CU.name, at: now };
    t.history.push({ act:'✍️ Admin เซ็นชื่อปิดงาน', by: CU.name, at: now });
  }

  t.updatedAt = now;
  saveDB(); syncTicket(t);

  // ── backup signatures ไว้ใน localStorage แยก (ไม่ถูก strip) ──
  try {
    const sigCache = JSON.parse(localStorage.getItem('aircon_sigs') || '{}');
    if (!sigCache[t.id]) sigCache[t.id] = {};
    Object.assign(sigCache[t.id], t.signatures);
    localStorage.setItem('aircon_sigs', JSON.stringify(sigCache));
  } catch(e) {}

  closeSignaturePad();
  showToast('✅ บันทึกลายเซ็นแล้ว');
  renderTickets();
  if (navigator.vibrate) navigator.vibrate([50,30,50]);
}

// ============================================================
// DEPT QR SHEET — QR Code รายแผนก แถวละ 10
// ============================================================
let _deptQRFilter = '';

function openDeptQRSheet() {
  _deptQRFilter = '';
  _buildDeptQRTabs();
  _renderDeptQRBody();
  openSheet('deptqr');
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

  const machines = _deptQRFilter
    ? db.machines.filter(m => (m.dept||m.location||'ไม่ระบุแผนก') === _deptQRFilter)
    : db.machines;

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
        </div>

        <!-- QR Grid — scroll แนวนอน แถวละ 10 -->
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:4px">
          <div style="display:grid;grid-template-columns:repeat(${Math.min(COLS,list.length)},${ITEM_W}px);grid-template-rows:auto;gap:${GAP}px;width:max-content;min-width:100%">
            ${list.map(m => {
              const qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=' + encodeURIComponent(m.id) + '&margin=2&format=png';
              return `
              <div onclick="showMachineQR('${m.id}')"
                style="width:${ITEM_W}px;background:white;border-radius:10px;padding:7px 5px;text-align:center;border:1.5px solid #e5e7eb;box-shadow:0 1px 4px rgba(0,0,0,0.06);cursor:pointer;box-sizing:border-box;transition:all 0.15s"
                ontouchstart="this.style.borderColor='#7c3aed';this.style.transform='scale(0.93)'"
                ontouchend="this.style.borderColor='#e5e7eb';this.style.transform=''">
                <div style="width:72px;height:72px;margin:0 auto 5px;border-radius:7px;overflow:hidden;background:#f3f4f6;display:flex;align-items:center;justify-content:center;position:relative">
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
                <div style="font-family:'JetBrains Mono',monospace;font-size:0.55rem;font-weight:800;color:#7c3aed;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px">${m.serial||m.id.replace('csv_','')}</div>
                <div style="font-size:0.48rem;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px;padding:0 2px">${(m.name||'').slice(0,14)}${m.name&&m.name.length>14?'…':''}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>`;
  });

  body.innerHTML = html;
}

// ============================================================
