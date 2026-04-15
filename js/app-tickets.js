// HOME
// ============================================================
// safeOpenDetail: ป้องกัน "openDetail is not defined" ถ้า app-tracking.js ยังโหลดไม่ครบ
function safeOpenDetail(tid) {
  if (typeof openDetail === 'function') openDetail(tid);
  else setTimeout(() => safeOpenDetail(tid), 100);
}
function updateChatBadge() {
  if (!db.chats || !CU) return;
  const myTickets = (db.tickets||[]).filter(t =>
    t.assigneeId === CU.id || t.reporterId === CU.id || CU.role === 'admin'
  );
  let total = 0;
  myTickets.forEach(t => {
    const msgs = db.chats['tk_'+t.id] || [];
    total += msgs.filter(m => m.uid !== CU.id).length;
  });
  const b = document.getElementById('chat-badge');
  if (b) b.textContent = total > 0 ? total : '';
}

function renderHome() {
  if (!CU) return;
  const T = db.tickets;
  const myT = CU.role==='admin' ? T
            : CU.role==='tech'  ? T.filter(t=>t.assigneeId===CU.id)
            : T.filter(t=>t.reporterId===CU.id);
  const ym = new Date().toISOString().slice(0,7);
  const byS = s => myT.filter(t=>t.status===s).length;
  const active = myT.filter(t=>!['closed','verified','done'].includes(t.status));
  const doneAll = byS('done')+byS('verified')+byS('closed');
  const pct = T.length ? Math.round(doneAll/T.length*100) : 0;

  const hcEl = document.getElementById('home-content');
  if(!hcEl) return;

  // greeting
  let html = `<div class="home-greeting">สวัสดี ${CU.name.split(' ')[0]}</div>
  <div class="home-date">${new Date().toLocaleDateString('th-TH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>`;

  // ── ADMIN ──
  if (CU.role === 'admin') {
    const nNew  = byS('new');
    const nProg = byS('assigned')+byS('accepted')+byS('inprogress');
    const nWait = byS('waiting_part');
    const monthTotal = myT.filter(t=>(t.createdAt||'').startsWith(ym)).length;

    // Circular ring values
    const _circ = 2 * Math.PI * 38;
    const _qToday = byS('assigned')+byS('accepted')+byS('inprogress')+byS('done')+byS('verified')+byS('closed');
    const _qDone  = byS('done')+byS('verified')+byS('closed');
    const _ringOffset = _qToday > 0 ? _circ * (1 - _qDone/_qToday) : _circ;
    const _techCount  = db.users.filter(u=>u.role==='tech').length;

    html += `
    <!-- ══ New Dashboard Card (design v2) ══ -->
    <div style="background:white;border-radius:24px;box-shadow:0 8px 40px rgba(0,0,0,0.13);overflow:hidden;border:1px solid #f0f0f0;margin-bottom:12px">

      <!-- Top Hero: repair count + ring -->
      <div style="display:flex;align-items:stretch;border-bottom:1.5px solid #f5e8e8">

        <!-- Left: จำนวนซ่อมเดือนนี้ -->
        <div style="flex:1;padding:16px 16px 14px;position:relative;overflow:hidden">
          <div style="position:absolute;bottom:-10px;left:0;right:0;height:50px;background:linear-gradient(180deg,transparent,rgba(200,16,46,0.04));border-radius:50% 50% 0 0"></div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="font-size:0.72rem;color:#64748b;font-weight:700">📅</span>
            <span style="font-size:0.72rem;font-weight:800;color:#374151">จำนวนซ่อมเดือนนี้</span>
          </div>
          <div style="display:flex;align-items:baseline;gap:8px">
            <span style="font-size:2.8rem;font-weight:900;color:#0f172a;line-height:1;font-family:'JetBrains Mono',monospace">${monthTotal}</span>
            <span style="font-size:0.72rem;color:#94a3b8;font-weight:600">จาก ${T.length} ใบงานทั้งหมด</span>
          </div>
          <!-- Progress bar -->
          <div style="margin-top:10px;height:6px;background:#f1f5f9;border-radius:99px;overflow:hidden">
            <div style="height:100%;border-radius:99px;width:${pct}%;background:linear-gradient(90deg,#c8102e,#e63950);box-shadow:0 0 8px rgba(200,16,46,0.4);transition:width 1s ease"></div>
          </div>
          <div style="margin-top:4px;display:flex;justify-content:space-between">
            <span style="font-size:0.6rem;color:#94a3b8;font-weight:600">${pct}% สำเร็จ</span>
            <span style="font-size:0.6rem;color:#94a3b8;font-weight:600">
              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#22c55e;margin-right:3px;vertical-align:middle;animation:pulse-dot 2s infinite"></span>Live
            </span>
          </div>
        </div>

        <!-- Right: SVG ring -->
        <div style="width:110px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 14px;border-left:1.5px solid #f5e8e8;background:linear-gradient(135deg,#fff8f8,#fff5f5)">
          <div style="font-size:0.58rem;font-weight:700;color:#94a3b8;margin-bottom:6px;letter-spacing:.06em">🏭 ${db.machines.length.toLocaleString()} เครื่อง</div>
          <div style="position:relative;width:84px;height:84px">
            <svg width="84" height="84" viewBox="0 0 84 84" style="display:block">
              <defs>
                <linearGradient id="ringGradAC" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#c8102e"/>
                  <stop offset="100%" stop-color="#e63950"/>
                </linearGradient>
              </defs>
              <circle cx="42" cy="42" r="38" fill="none" stroke="#f0f0f0" stroke-width="7"/>
              <circle cx="42" cy="42" r="38" fill="none"
                stroke="url(#ringGradAC)" stroke-width="7"
                stroke-linecap="round"
                stroke-dasharray="${_circ.toFixed(1)}"
                stroke-dashoffset="${_ringOffset.toFixed(1)}"
                transform="rotate(-90 42 42)"
                style="transition:stroke-dashoffset 0.6s ease"/>
              <text x="42" y="38" text-anchor="middle" font-size="15" font-weight="900" fill="#0f172a" font-family="'JetBrains Mono',Arial Black,sans-serif">${_qDone}/${_qToday}</text>
              <text x="42" y="52" text-anchor="middle" font-size="9" font-weight="700" fill="#94a3b8">คิว / เสร็จ</text>
            </svg>
          </div>
        </div>
      </div>

      <!-- Status Cards: 4 columns -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border-bottom:1.5px solid #f5e8e8">
        <!-- รอจ่ายงาน -->
        <div onclick="setFilter('status','new');goPage('tickets')" style="padding:14px 8px 12px;background:#f8f8f8;border-right:1px solid #f0eded;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;-webkit-tap-highlight-color:transparent" onmousedown="this.style.opacity='.75'" onmouseup="this.style.opacity='1'">
          <div style="width:36px;height:36px;border-radius:10px;background:#f3f4f6;border:1.5px solid #e5e7eb;display:flex;align-items:center;justify-content:center;font-size:1.05rem">📋</div>
          <div style="font-size:1.7rem;font-weight:900;color:#374151;line-height:1">${nNew}</div>
          <div style="font-size:0.6rem;font-weight:800;color:#374151;text-align:center;line-height:1.3;opacity:.85">รอนำงาน</div>
        </div>
        <!-- กำลังดำเนินการ -->
        <div onclick="setFilter('status','');goPage('tickets')" style="padding:14px 8px 12px;background:#fff7ed;border-right:1px solid #f0eded;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;-webkit-tap-highlight-color:transparent" onmousedown="this.style.opacity='.75'" onmouseup="this.style.opacity='1'">
          <div style="width:36px;height:36px;border-radius:10px;background:#ffedd5;border:1.5px solid #fed7aa;display:flex;align-items:center;justify-content:center;font-size:1.05rem">😊</div>
          <div style="font-size:1.7rem;font-weight:900;color:#c2410c;line-height:1">${nProg}</div>
          <div style="font-size:0.6rem;font-weight:800;color:#c2410c;text-align:center;line-height:1.3;opacity:.85">กำลังดำเนินการ</div>
        </div>
        <!-- รอคิวอะไหล่ -->
        <div onclick="goPage('tracking')" style="padding:14px 8px 12px;background:#fef2f2;border-right:1px solid #f0eded;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;-webkit-tap-highlight-color:transparent" onmousedown="this.style.opacity='.75'" onmouseup="this.style.opacity='1'">
          <div style="width:36px;height:36px;border-radius:10px;background:#ffe4e6;border:1.5px solid #fecaca;display:flex;align-items:center;justify-content:center;font-size:1.05rem">👷</div>
          <div style="font-size:1.7rem;font-weight:900;color:#be123c;line-height:1">${nWait}</div>
          <div style="font-size:0.6rem;font-weight:800;color:#be123c;text-align:center;line-height:1.3;opacity:.85">รอคิวอะไหล่</div>
        </div>
        <!-- เสร็จแล้ว -->
        <div onclick="setFilter('status','done');goPage('tickets')" style="padding:14px 8px 12px;background:#f0fdf4;position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;-webkit-tap-highlight-color:transparent" onmousedown="this.style.opacity='.75'" onmouseup="this.style.opacity='1'">
          <div style="width:36px;height:36px;border-radius:10px;background:#dcfce7;border:1.5px solid #bbf7d0;display:flex;align-items:center;justify-content:center;font-size:1.05rem">✅</div>
          <div style="font-size:1.7rem;font-weight:900;color:#15803d;line-height:1">${doneAll}</div>
          <div style="font-size:0.6rem;font-weight:800;color:#15803d;text-align:center;line-height:1.3;opacity:.85">เสร็จแล้ว</div>
          ${doneAll>0?`<div style="position:absolute;top:6px;right:4px;background:#22c55e;color:white;font-size:0.45rem;font-weight:800;border-radius:99px;padding:1px 5px">✓ เดือนนี้</div>`:''}
        </div>
      </div>

      <!-- Footer summary strip -->
      <div style="display:flex;align-items:center;padding:10px 16px;background:#f8fafc">
        <div style="flex:1;padding-right:12px;border-right:1px solid #e2e8f0">
          <div style="font-size:1.05rem;font-weight:900;color:#0f172a">${active.length}</div>
          <div style="font-size:0.58rem;color:#94a3b8;font-weight:600;margin-top:2px">งานเปิดอยู่</div>
        </div>
        <div style="flex:2;text-align:center;padding:0 12px;border-right:1px solid #e2e8f0">
          <div style="font-size:1.05rem;font-weight:900;color:#d97706">${nNew}/${nProg}/${nWait}</div>
          <div style="font-size:0.58rem;color:#94a3b8;font-weight:600;margin-top:2px">ใหม่/กำลังซ่อม/รออะไหล่</div>
        </div>
        <div style="flex:1;text-align:right;padding-left:12px;border-left:1px solid #e2e8f0">
          <div style="font-size:1.05rem;font-weight:900;color:#22c55e">${byS('closed')}</div>
          <div style="font-size:0.58rem;color:#94a3b8;font-weight:600;margin-top:2px">ปิดแล้ว</div>
        </div>
      </div>
    </div>
    <style>@keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:.4}}</style>

    <!-- Priority row — redesigned -->
    <div class="home-section-hd">
      <div class="home-section-lbl">🔥 ความเร่งด่วน</div>
      <button onclick="goPage('tickets')" style="font-size:0.7rem;color:var(--accent);background:none;border:none;cursor:pointer;font-weight:700;font-family:inherit">ดูทั้งหมด →</button>
    </div>
    <div style="display:flex;gap:7px;margin-bottom:14px;box-sizing:border-box;width:100%">
      ${[
        ['high','🔴','ด่วนมาก','linear-gradient(145deg,#7f1d1d,#b91c1c)','rgba(252,165,165,.2)','#fca5a5'],
        ['mid','🟡','ปานกลาง','linear-gradient(145deg,#78350f,#b45309)','rgba(253,230,138,.2)','#fde68a'],
        ['low','🟢','ปกติ','linear-gradient(145deg,#14532d,#15803d)','rgba(134,239,172,.2)','#86efac']
      ].map(([pr,ic,lb,bg,shadow,cl])=>{
        const n = T.filter(t=>t.priority===pr&&!['closed','verified','done'].includes(t.status)).length;
        return `<div style="flex:1;min-width:0;background:${bg};border-radius:16px;padding:12px 6px;text-align:center;cursor:pointer;box-sizing:border-box;box-shadow:0 4px 12px ${shadow};border:1px solid ${cl}22;-webkit-tap-highlight-color:transparent" onclick="setFilter('priority','${pr}');goPage('tickets')" onmousedown="this.style.opacity='.8'" onmouseup="this.style.opacity='1'">
          <div style="font-size:1.8rem;font-weight:900;color:white;font-family:'JetBrains Mono',monospace;line-height:1">${n}</div>
          <div style="font-size:0.58rem;font-weight:800;color:${cl};margin-top:4px">${ic} ${lb}</div>
        </div>`;}).join('')}
    </div>

    <!-- Tech workload — redesigned -->
    <div class="home-section-hd">
      <div class="home-section-lbl">👷 ภาระงานช่าง</div>
      <button onclick="goPage('users')" style="font-size:0.7rem;color:var(--accent);background:none;border:none;cursor:pointer;font-weight:700;font-family:inherit">ดูทั้งหมด →</button>
    </div>
    <div style="margin-bottom:14px;overflow:hidden;width:100%;box-sizing:border-box">
    ${db.users.filter(u=>u.role==='tech').map(u=>{
      const cnt = T.filter(t=>t.assigneeId===u.id&&!['closed','verified','done'].includes(t.status)).length;
      return {u, cnt};
    }).sort((a,b)=>b.cnt-a.cnt).slice(0,4).map(({u,cnt})=>{
      const bar  = Math.min(100,cnt*14);
      const bc   = cnt>4?'#ef4444':cnt>2?'#f59e0b':'#22c55e';
      const bgCard = cnt>4?'linear-gradient(135deg,#fef2f2,#fee2e2)':cnt>2?'linear-gradient(135deg,#fffbeb,#fef9c3)':'linear-gradient(135deg,#f0fdf4,#dcfce7)';
      const cl2  = cnt>4?'#dc2626':cnt>2?'#92400e':'#166534';
      const bdr  = cnt>4?'#fecaca':cnt>2?'#fde68a':'#bbf7d0';
      // Avatar gradient ตามตัวอักษรแรกของชื่อ
      const _initials = (u.name||'?').slice(0,2).toUpperCase();
      const _firstChar = (u.name||'?').charAt(0).toUpperCase();
      const _techGrad = {W:'linear-gradient(135deg,#1d4ed8,#3b82f6)',T:'linear-gradient(135deg,#ea580c,#fb923c)',S:'linear-gradient(135deg,#16a34a,#4ade80)',P:'linear-gradient(135deg,#7c3aed,#a78bfa)'}[_firstChar] || 'linear-gradient(135deg,#374151,#6b7280)';
      const av = (u.photo && u.photo !== 'undefined')
        ? `<img src="${u.photo}" onerror="this.style.display='none'" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid ${bdr}">`
        : `<div style="width:36px;height:36px;border-radius:50%;background:${_techGrad};display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:900;color:white;border:2px solid ${bdr};letter-spacing:0.02em;box-shadow:0 2px 8px rgba(0,0,0,0.15)">${_initials}</div>`;
      return `<div style="background:white;border-radius:14px;padding:10px 12px;margin-bottom:7px;border:1px solid #f1f5f9;box-shadow:0 1px 6px rgba(0,0,0,.05);display:flex;align-items:center;gap:10px;cursor:pointer" onclick="openTechPopup('${u.id}')">
        ${av}
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;font-size:0.85rem;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.name}</div>
          <div style="background:#f1f5f9;border-radius:99px;height:4px;overflow:hidden;margin-top:6px"><div style="height:100%;width:${bar}%;background:${bc};border-radius:99px;transition:width .5s ease;box-shadow:0 0 4px ${bc}88"></div></div>
        </div>
        <div style="background:${bgCard};border:1px solid ${bdr};border-radius:10px;padding:5px 10px;text-align:center;flex-shrink:0;min-width:44px">
          <div style="font-size:1.1rem;font-weight:900;color:${cl2};line-height:1;font-family:'JetBrains Mono',monospace">${cnt}</div>
          <div style="font-size:0.48rem;color:${cl2};opacity:.7;font-weight:700">งาน</div>
        </div>
      </div>`;}).join('')}
    </div>
    <!-- Quick access: Users, Report, Purchase -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;box-sizing:border-box;width:100%;overflow:hidden">
      <button onclick="goPage('users')" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 6px;background:white;border:1px solid #e8eaed;border-radius:12px;cursor:pointer;font-family:inherit;transition:opacity 0.15s;-webkit-tap-highlight-color:transparent" onmousedown="this.style.opacity='0.65'" onmouseup="this.style.opacity=''">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <div style="font-size:0.67rem;font-weight:600;color:#374151">ผู้ใช้</div>
      </button>
      <button onclick="goPage('report')" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 6px;background:white;border:1px solid #e8eaed;border-radius:12px;cursor:pointer;font-family:inherit;transition:opacity 0.15s;-webkit-tap-highlight-color:transparent" onmousedown="this.style.opacity='0.65'" onmouseup="this.style.opacity=''">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <div style="font-size:0.67rem;font-weight:600;color:#374151">รายงาน</div>
      </button>
      <button onclick="goPage('purchase')" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 6px;background:white;border:1px solid #e8eaed;border-radius:12px;cursor:pointer;font-family:inherit;transition:opacity 0.15s;-webkit-tap-highlight-color:transparent" onmousedown="this.style.opacity='0.65'" onmouseup="this.style.opacity=''">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
        <div style="font-size:0.67rem;font-weight:600;color:#374151">สั่งซื้อ</div>
        <span id="pur-badge" style="display:none;position:absolute;top:6px;right:10px;background:#c8102e;color:white;border-radius:99px;padding:1px 5px;font-size:0.6rem;font-weight:700"></span>
      </button>
    </div>
    ${renderOverdueAlert(T)}
    ${renderPMReminderBanner()}
    ${renderHomeRecentMachines()}
    ${renderHomeCal(T)}`;

  // ── TECH ──
  } else if (CU.role === 'tech') {
    const nAssigned = byS('assigned');
    const nInprog   = byS('accepted')+byS('inprogress');
    const nWait     = byS('waiting_part');
    const nDoneM    = myT.filter(t=>['done','verified','closed'].includes(t.status)&&(t.updatedAt||'').startsWith(ym)).length;
    const pending   = myT.filter(t=>!['done','verified','closed'].includes(t.status)).slice(0,5);

    html += `
    <div class="quick-row" style="margin-bottom:12px">
      <button class="quick-btn-main" onclick="goPage('new')">
        <div style="width:36px;height:36px;background:rgba(255,255,255,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.1rem">🔧</div>
        <div style="text-align:left"><div>แจ้งซ่อมแอร์</div><div style="font-size:0.65rem;opacity:0.8;margin-top:1px">บันทึกงานซ่อม</div></div>
      </button>
      <button class="quick-btn-sec" onclick="openMachineSheet()">
        <div style="width:28px;height:28px;background:rgba(99,102,241,0.15);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <div>เพิ่มแอร์</div>
      </button>
    </div>
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="kpi-card" style="padding:10px 8px;text-align:center" onclick="goPage('tickets')">
        <div class="kpi-val" style="color:#3b82f6;font-size:1.7rem">${nAssigned}</div>
        <div class="kpi-lbl" style="color:#6b7280;font-size:0.6rem">รอรับ</div>
      </div>
      <div class="kpi-card" style="padding:10px 8px;text-align:center" onclick="goPage('tickets')">
        <div class="kpi-val" style="color:#f59e0b;font-size:1.7rem">${nInprog}</div>
        <div class="kpi-lbl" style="color:#6b7280;font-size:0.6rem">กำลังซ่อม</div>
      </div>
      <div class="kpi-card" style="padding:10px 8px;text-align:center" onclick="goPage('tickets')">
        <div class="kpi-val" style="color:#ea580c;font-size:1.7rem">${nWait}</div>
        <div class="kpi-lbl" style="color:#6b7280;font-size:0.6rem">รออะไหล่</div>
      </div>
      <div class="kpi-card" style="padding:10px 8px;text-align:center;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-color:#bbf7d0">
        <div class="kpi-val" style="color:#16a34a;font-size:1.7rem">${nDoneM}</div>
        <div class="kpi-lbl" style="color:#16a34a;font-size:0.6rem">เดือนนี้</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;box-sizing:border-box;width:100%;overflow:hidden">
      <button onclick="goPage('purchase')" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 6px;background:white;border:1.5px solid #d1fae5;border-radius:12px;cursor:pointer;font-family:inherit;transition:opacity 0.15s;-webkit-tap-highlight-color:transparent" onmousedown="this.style.opacity='0.65'" onmouseup="this.style.opacity=''">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
        <div style="font-size:0.67rem;font-weight:700;color:#374151">สั่งซื้ออะไหล่</div>
        <span id="pur-badge-home" style="display:none;position:absolute;top:6px;right:10px;background:#c8102e;color:white;border-radius:99px;padding:1px 5px;font-size:0.6rem;font-weight:700"></span>
      </button>
      <button onclick="openRepairHistoryPage()" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 6px;background:white;border:1px solid #e8eaed;border-radius:12px;cursor:pointer;font-family:inherit;transition:opacity 0.15s;-webkit-tap-highlight-color:transparent" onmousedown="this.style.opacity='0.65'" onmouseup="this.style.opacity=''">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <div style="font-size:0.67rem;font-weight:600;color:#374151">ประวัติ</div>
      </button>
      <button onclick="goPage('chatroom')" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 6px;background:white;border:1px solid #e8eaed;border-radius:12px;cursor:pointer;font-family:inherit;transition:opacity 0.15s;-webkit-tap-highlight-color:transparent" onmousedown="this.style.opacity='0.65'" onmouseup="this.style.opacity=''">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <div style="font-size:0.67rem;font-weight:600;color:#374151">แชท</div>
      </button>
    </div>
    <div class="home-section-hd" style="margin-top:4px">
      <div class="home-section-lbl">งานของฉัน</div>
      <button onclick="goPage('tickets')" style="font-size:0.7rem;color:var(--accent);background:none;border:none;cursor:pointer;font-weight:700;font-family:inherit">ดูทั้งหมด →</button>
    </div>
    ${pending.length ? pending.map(t=>`
    <div class="home-row" onclick="safeOpenDetail('${t.id}')">
      <div class="home-row-bar" style="background:${sColor(t.status)}"></div>
      <div class="home-row-main">
        <div class="home-row-prob">${escapeHtml(t.problem)}</div>
        <div class="home-row-sub">${t.machine}</div>
      </div>
      <span class="tag ${stc(t.status)}">${sTH(t.status)}</span>
    </div>`).join('') : '<div style="text-align:center;padding:20px;background:white;border-radius:12px;border:1px solid #e5e7eb;color:#9ca3af;font-size:0.82rem">✅ ไม่มีงานค้าง</div>'}`;

  // ── REPORTER ──
  } else {
    const nNew  = byS('new');
    const nProg = byS('assigned')+byS('accepted')+byS('inprogress');
    const nWait = byS('waiting_part');
    const pending = myT.filter(t=>!['done','verified','closed'].includes(t.status)).slice(0,5);

    html += `
    <button class="quick-btn-main" style="width:100%;margin-bottom:12px;justify-content:center;border-radius:18px" onclick="goPage('new')">
      <span style="font-size:1.3rem">📢</span>
      <div><div>แจ้งงานซ่อมแอร์</div><div style="font-size:0.65rem;opacity:0.8;margin-top:1px">กดเพื่อแจ้งปัญหาใหม่</div></div>
    </button>
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="kpi-card" style="padding:10px 8px;text-align:center">
        <div class="kpi-val" style="color:#3b82f6;font-size:1.7rem">${nNew}</div>
        <div class="kpi-lbl" style="color:#6b7280;font-size:0.62rem">รอจ่ายงาน</div>
      </div>
      <div class="kpi-card" style="padding:10px 8px;text-align:center">
        <div class="kpi-val" style="color:#f59e0b;font-size:1.7rem">${nProg}</div>
        <div class="kpi-lbl" style="color:#6b7280;font-size:0.62rem">กำลังซ่อม</div>
      </div>
      <div class="kpi-card" style="padding:10px 8px;text-align:center">
        <div class="kpi-val" style="color:#ea580c;font-size:1.7rem">${nWait}</div>
        <div class="kpi-lbl" style="color:#6b7280;font-size:0.62rem">รออะไหล่</div>
      </div>
    </div>
    <div class="home-section-hd" style="margin-top:4px">
      <div class="home-section-lbl">📋 งานของฉัน</div>
      <button onclick="goPage('tickets')" style="font-size:0.7rem;color:var(--accent);background:none;border:none;cursor:pointer;font-weight:700;font-family:inherit">ดูทั้งหมด →</button>
    </div>
    ${pending.length ? pending.map(t=>`
    <div class="home-row" onclick="safeOpenDetail('${t.id}')">
      <div class="home-row-bar" style="background:${sColor(t.status)}"></div>
      <div class="home-row-main">
        <div class="home-row-prob">${escapeHtml(t.problem)}</div>
        <div class="home-row-sub">${t.machine}</div>
      </div>
      <span class="tag ${stc(t.status)}">${sTH(t.status)}</span>
    </div>`).join('') : '<div style="text-align:center;padding:20px;background:white;border-radius:12px;border:1px solid #e5e7eb;color:#9ca3af;font-size:0.82rem">✅ ไม่มีงานค้าง</div>'}`;
  }

  hcEl.innerHTML = html;
  requestAnimationFrame(() => typeof _resolveListPhotos === "function" && _resolveListPhotos(hcEl));

  // ── Phase 2: defer heavy sections (tech photos + calendar) ──
  if (CU.role === 'admin') {
    requestAnimationFrame(() => {
      // Tech photos lazy load — replace placeholder avatars with real images
      if (db.users.some(u => u.role === 'tech' && u.photo)) {
        hcEl.querySelectorAll('.tech-card img[data-src]').forEach(img => {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        });
      }
    });
  }
}
// ============================================================
// TICKETS
// ============================================================
function setFilter(type, val) {
  tkPage = 1;
  _tkLastFingerprint = ''; // force re-render
  if (type === 'status')    fStatus = val;
  else if (type === 'priority') fPriority = val;
  else if (type === 'machineId') { fMachineId = val; fStatus = ''; fPriority = ''; }
  else { fMachineId = ''; }

  // sync ptab ล่าง
  document.querySelectorAll('#ptab-tickets-row .ptab').forEach(btn => {
    const bv = btn.dataset.val;
    btn.classList.toggle('active', bv === fStatus || (bv === '' && fStatus === ''));
  });

  updateStatusScroller(); // จัดการ sc-card บน + สี
  renderTickets();
}

// ── setTicketFilter: เรียกจากหน้าอื่น (report cards) ──
function setTicketFilter(val) {
  // val เป็น status key ('high'=priority, 'waiting_part'=status, 'inprogress'=status)
  tkPage = 1; fMachineId = '';
  _tkLastFingerprint = ''; // force re-render
  if (val === 'high') { fPriority = 'high'; fStatus = ''; }
  else { fStatus = val; fPriority = ''; }
  updateStatusScroller();
  renderTickets();
}

// ── Skeleton loaders ──
function skeletonTickets(n=5) {
  return Array.from({length:n}, () => `
    <div class="skel-card">
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <div class="skel" style="width:52px;height:14px"></div>
        <div class="skel" style="width:70px;height:14px"></div>
        <div class="skel" style="width:40px;height:14px;margin-left:auto"></div>
      </div>
      <div class="skel" style="height:18px;width:75%;margin-bottom:6px"></div>
      <div class="skel" style="height:13px;width:55%"></div>
    </div>`).join('');
}
function skeletonMachines(n=3) {
  return Array.from({length:n}, () => `
    <div class="skel-card">
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
        <div class="skel" style="width:36px;height:36px;border-radius:9px;flex-shrink:0"></div>
        <div style="flex:1">
          <div class="skel" style="height:16px;width:65%;margin-bottom:6px"></div>
          <div class="skel" style="height:12px;width:40%"></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
        ${Array.from({length:4},()=>'<div class="skel" style="height:30px;border-radius:6px"></div>').join('')}
      </div>
    </div>`).join('');
}

// ── BUG FIX (Bug 1): debounce renderTickets — ป้องกัน re-render ทุกครั้งที่พิมพ์ search ──
// ใช้ debounce 80ms: fast enough ไม่รู้สึก lag แต่ลด DOM rebuild จาก O(n) ทุก keystroke
let _renderTicketsTimer = null;
function renderTickets() {
  if (!CU) return;
  // แสดง skeleton เฉพาะครั้งแรก (ยังไม่มี content)
  const tlEl = document.getElementById('ticket-list');
  if (tlEl && !tlEl.innerHTML) tlEl.innerHTML = skeletonTickets(5);
  // debounce: ยกเลิก render ก่อนหน้าถ้ายังไม่ทัน flush
  clearTimeout(_renderTicketsTimer);
  _renderTicketsTimer = setTimeout(() => requestAnimationFrame(_renderTicketsInner), 80);
}
// BUG FIX (Bug 1): dirty-check fingerprint — ถ้า list IDs + page ไม่เปลี่ยน ไม่ต้อง rebuild DOM
let _tkLastFingerprint = '';

function _renderTicketsInner() {
  if (!CU) return;
  fSearch = document.getElementById('f-search')?.value?.toLowerCase() || '';
  let base;
  if (CU.role === 'admin' || CU.role === 'executive') {
    base = db.tickets;
  } else if (CU.role === 'tech') {
    base = (db.tickets||[]).filter(t => t.assigneeId === CU.id);
  } else {
    base = (db.tickets||[]).filter(t => t.reporterId === CU.id);
  }
  const list = (base||[]).filter(t => {
    const txt = (t.id+t.machine+t.problem+t.detail+t.reporter+(t.assignee||'')).toLowerCase();
    if (fMachineId && t.machineId !== fMachineId) return false;
    if (fStatus === '_active') {
      // กลุ่ม: กำลังดำเนินการ (assigned + accepted + inprogress + waiting_part)
      return (!fSearch||txt.includes(fSearch)) && (!fPriority||t.priority===fPriority)
        && ['assigned','accepted','inprogress','waiting_part'].includes(t.status);
    }
    if (fStatus === '_done') {
      // กลุ่ม: เสร็จแล้ว (done + verified + closed)
      return (!fSearch||txt.includes(fSearch)) && (!fPriority||t.priority===fPriority)
        && ['done','verified','closed'].includes(t.status);
    }
    return (!fSearch||txt.includes(fSearch)) && (!fStatus||t.status===fStatus) && (!fPriority||t.priority===fPriority);
  }).reverse();

  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / TK_PER_PAGE));
  if (tkPage > totalPages) tkPage = totalPages;
  const start = (tkPage - 1) * TK_PER_PAGE;
  const pageItems = list.slice(start, start + TK_PER_PAGE);

  const tlEl = document.getElementById('ticket-list');
  if (!tlEl) return;

  // BUG FIX (Bug 1): dirty-check — skip DOM rebuild ถ้า content ไม่เปลี่ยน
  // fingerprint = IDs ของ page นี้ + status + updatedAt (ตรวจจับ edit ด้วย)
  const fingerprint = pageItems.map(t => t.id + '|' + (t.status||'') + '|' + (t.updatedAt||'')).join(',')
    + '::p' + tkPage + '::tot' + total;
  if (fingerprint === _tkLastFingerprint && tlEl.children.length > 0) {
    // list ไม่เปลี่ยน — อัปเดตแค่ badge/scroller ไม่ต้อง rebuild DOM
    updateOpenBadge();
    updateStatusScroller();
    return;
  }
  _tkLastFingerprint = fingerprint;

  if (total === 0) {
    tlEl.innerHTML = `<div class="empty"><div class="ei">${CU.role==='reporter'?'📋':'🔍'}</div><p>${fSearch||fStatus||fPriority?'ไม่พบรายการ':CU.role==='reporter'?'ยังไม่มีงานที่แจ้ง':'ไม่พบรายการ'}</p></div>`;
  } else {
    let html = pageItems.map(t => tkCard(t)).join('');
    html += renderPagination(tkPage, totalPages, total, start, Math.min(start+TK_PER_PAGE,total));
    tlEl.innerHTML = html;
    // auto-resolve fs: photo thumbnails in cards after render
    requestAnimationFrame(() => typeof _resolveListPhotos === "function" && _resolveListPhotos(tlEl));
  }

  const srch = document.getElementById('f-search');
  if (srch && !srch.value) srch.placeholder = CU.role==='reporter'?'🔍 ค้นหางานของฉัน...':CU.role==='tech'?'🔍 ค้นหางานของฉัน...':'🔍 ค้นหาทุกงาน...';
  updateOpenBadge();
  updateStatusScroller();
  requestAnimationFrame(() => initSwipeCards());
}

// ── Swipe left on ticket cards ──
function initSwipeCards() {
  document.querySelectorAll('.tk-swipeable').forEach(card => {
    if (card._swipeInit) return;
    card._swipeInit = true;
    let startX=0, startY=0, dx=0, dragging=false, moved=false, rafId=null;
    const THRESHOLD = 50;
    const MAX_SWIPE = 160;
    const SELECT_THRESHOLD = 40;
    card.style.willChange = 'transform';

    const getActions = () => card.closest('.' + 'tk-wrap')?.querySelector('.tk-swipe-actions');
    const getTid = () => card.dataset.tid;

    card.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dx=0; dragging=true; moved=false;
      card.style.transition = 'none';
      const a = getActions(); if(a) a.style.transition='none';
    }, {passive:true});

    card.addEventListener('touchmove', e => {
      if (!dragging) return;
      dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!moved && Math.abs(dy) > Math.abs(dx)+3) { dragging=false; return; }
      moved = true;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const actions = getActions();
        if (dx < 0) {
          const shift = Math.min(Math.abs(dx), MAX_SWIPE);
          card.style.transform = `translateX(-${shift}px)`;
          if (actions) actions.style.maxWidth = shift + 'px';
        } else if (dx > 0 && card._open) {
          const cur = Math.max(0, MAX_SWIPE - Math.min(dx, MAX_SWIPE));
          card.style.transform = `translateX(-${cur}px)`;
          if (actions) actions.style.maxWidth = cur + 'px';
        } else if (dx > 0 && !card._open) {
          const shift = Math.min(dx * 0.35, 20);
          card.style.transform = `translateX(${shift}px)`;
          card.style.borderLeftWidth = shift > 5 ? '6px' : '3px';
          card.style.borderLeftColor = shift > 8 ? '#16a34a' : '';
        }
      });
    }, {passive:true});

    card.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId=null; }
      const T = 'transform 0.22s cubic-bezier(0.4,0,0.2,1)';
      card.style.transition = T;
      const actions = getActions();
      if (actions) actions.style.transition = 'max-width 0.22s cubic-bezier(0.4,0,0.2,1)';
      card.style.borderLeftWidth = '';
      card.style.borderLeftColor = '';

      if (!card._open && dx < -THRESHOLD) {
        card.style.transform = `translateX(-${MAX_SWIPE}px)`;
        if (actions) actions.style.maxWidth = MAX_SWIPE + 'px';
        card._open = true;
      } else if (card._open && dx > THRESHOLD) {
        closeSwipeCard(card);
      } else if (card._open) {
        card.style.transform = `translateX(-${MAX_SWIPE}px)`;
        if (actions) actions.style.maxWidth = MAX_SWIPE + 'px';
      } else if (!card._open && dx > SELECT_THRESHOLD) {
        card.style.transform = 'translateX(0)';
        const tid = getTid();
        if (tid) {
          if (!_multiSelectMode) enterMultiSelect();
          toggleTicketSelect(tid);
          if (navigator.vibrate) navigator.vibrate(30);
        }
      } else {
        closeSwipeCard(card);
        card.style.transform = 'translateX(0)';
      }
    });
  });

  // Tap outside to close
  const list = document.getElementById('ticket-list');
  if (list && !list._swipeTapInit) {
    list._swipeTapInit = true;
    list.addEventListener('click', e => {
      document.querySelectorAll('.tk-swipeable').forEach(c => {
        if (c._open && !c.contains(e.target)) closeSwipeCard(c);
      });
    });
  }
}

function closeSwipeCard(card) {
  card.style.transition = 'transform 0.25s ease';
  card.style.transform = 'translateX(0)';
  card._open = false;
  const actions = card.closest('.tk-wrap')?.querySelector('.tk-swipe-actions');
  if (actions) { actions.style.transition = 'max-width 0.25s ease'; actions.style.maxWidth = '0'; }
}

// ── Global Search ──
// ── unlock body scroll after global search close ──
function _unlockBodyScroll() {
  const sy = parseInt(document.body.style.top || '0') * -1;
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.overflow = '';
  if (sy) window.scrollTo(0, sy);
}

function openGlobalSearch() {
  // ── ล็อก body scroll ป้องกัน Android viewport เลื่อนเมื่อ keyboard ขึ้น ──
  const _scrollY = window.scrollY;
  document.body.style.position = 'fixed';
  document.body.style.top = '-' + _scrollY + 'px';
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.overflow = 'hidden';

  const ov = document.createElement('div');
  ov.id = '_gsearch_ov';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9950;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);display:flex;flex-direction:column;animation:fadeIn 0.15s ease';

  const box = document.createElement('div');
  box.style.cssText = 'background:'+(document.body.classList.contains('dark-mode')?'#1e2235':'white')+';margin:0;padding:0;flex-shrink:0';

  // Search bar
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #e5e7eb';
  bar.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  const inp = document.createElement('input');
  inp.type='search'; inp.placeholder='ค้นหา Ticket / เครื่องแอร์ / ผู้ใช้...';
  inp.style.cssText='flex:1;border:none;outline:none;font-size:0.98rem;font-family:inherit;background:transparent;color:'+(document.body.classList.contains('dark-mode')?'#dde1f0':'#0f172a');
  inp.autocomplete='off';
  const closeBtn = document.createElement('button');
  closeBtn.textContent='✕';
  closeBtn.style.cssText='background:none;border:none;color:#94a3b8;font-size:1.1rem;cursor:pointer;padding:0 4px';
  closeBtn.onclick=()=>{
    ov.remove(); _unlockBodyScroll();
  };
  bar.appendChild(inp); bar.appendChild(closeBtn);
  box.appendChild(bar);
  ov.appendChild(box);

  // Results area
  const results = document.createElement('div');
  results.style.cssText='flex:1;overflow-y:auto;padding:8px 12px;-webkit-overflow-scrolling:touch';
  ov.appendChild(results);
  document.body.appendChild(ov);
  // ไม่ focus อัตโนมัติ — ป้องกัน page ขยับเมื่อ keyboard ขึ้น
  // inputmode/tabindex จัดการโดย global _lockField ใน DOMContentLoaded

  // Search function
  const doSearch = (q) => {
    const kw = q.toLowerCase().trim();
    results.innerHTML='';
    if(!kw || kw.length < 1) {
      results.innerHTML='<div style="text-align:center;padding:32px;color:#94a3b8;font-size:0.88rem">พิมพ์เพื่อค้นหา...</div>';
      return;
    }

    let html='';

    // Tickets
    const tickets = (db.tickets||[]).filter(t=>
      (t.id||'').toLowerCase().includes(kw) ||
      (t.problem||'').toLowerCase().includes(kw) ||
      (t.machine||'').toLowerCase().includes(kw) ||
      (t.reporter||'').toLowerCase().includes(kw) ||
      (t.assignee||'').toLowerCase().includes(kw) ||
      (t.summary||'').toLowerCase().includes(kw)
    ).slice(0,8);

    if(tickets.length) {
      html+='<div style="font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin:8px 4px 6px">📋 ใบงาน ('+tickets.length+')</div>';
      html+=tickets.map(t=>`
        <div onclick="ov.remove();_unlockBodyScroll();goPage('tickets');setTimeout(()=>safeOpenDetail('${t.id}'),200)" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:white;border-radius:12px;margin-bottom:6px;cursor:pointer;border:1px solid #f1f5f9;-webkit-tap-highlight-color:transparent" onmousedown="this.style.background='#f8fafc'" onmouseup="this.style.background='white'">
          <div style="width:36px;height:36px;border-radius:9px;background:${sColor(t.status)}20;border:1.5px solid ${sColor(t.status)}40;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;color:${sColor(t.status)};flex-shrink:0;font-family:'JetBrains Mono',monospace">${t.id.slice(-3)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.85rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.problem)}</div>
            <div style="font-size:0.7rem;color:#64748b;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.machine}</div>
          </div>
          <span style="font-size:0.6rem;padding:2px 7px;border-radius:4px;font-weight:700;background:${sColor(t.status)}15;color:${sColor(t.status)}">${sTH(t.status)}</span>
        </div>`).join('');
    }

    // Machines
    const machines = (db.machines||[]).filter(m=>
      (m.serial||'').toLowerCase().includes(kw) ||
      (m.name||'').toLowerCase().includes(kw) ||
      (m.dept||'').toLowerCase().includes(kw) ||
      (m.vendor||'').toLowerCase().includes(kw) ||
      (m.equipment||'').toLowerCase().includes(kw)
    ).slice(0,6);

    if(machines.length) {
      html+='<div style="font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin:12px 4px 6px">❄️ เครื่องแอร์ ('+machines.length+')</div>';
      html+=machines.map(m=>`
        <div onclick="ov.remove();setTimeout(()=>{goPage('machines');setTimeout(()=>openMachineDetail('${m.id}'),250)},100)" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:white;border-radius:12px;margin-bottom:6px;cursor:pointer;border:1px solid #f1f5f9;-webkit-tap-highlight-color:transparent" onmousedown="this.style.background='#f8fafc'" onmouseup="this.style.background='white'">
          <div style="width:36px;height:36px;border-radius:9px;background:#eff6ff;border:1.5px solid #bfdbfe;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">❄️</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.85rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(m.name)}</div>
            <div style="font-size:0.7rem;color:#64748b;margin-top:1px">${m.serial} · ${m.dept||'—'}</div>
          </div>
          ${m.vendor?`<span style="font-size:0.65rem;font-weight:700;color:#1d4ed8;background:#eff6ff;border-radius:5px;padding:1px 7px">${m.vendor}</span>`:''}
        </div>`).join('');
    }

    // Users
    const users = (db.users||[]).filter(u=>
      (u.name||'').toLowerCase().includes(kw) ||
      (u.username||'').toLowerCase().includes(kw) ||
      (u.dept||'').toLowerCase().includes(kw)
    ).slice(0,5);

    if(users.length) {
      html+='<div style="font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin:12px 4px 6px">👤 ผู้ใช้งาน ('+users.length+')</div>';
      const roleC={tech:{bg:'#f0fdf4',cl:'#166534'},reporter:{bg:'#eff6ff',cl:'#1d4ed8'},admin:{bg:'#fdf4ff',cl:'#7c3aed'}};
      html+=users.map(u=>`
        <div onclick="ov.remove();_unlockBodyScroll();goPage('users');setTimeout(()=>switchUserTab('${u.role}'),200)" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:white;border-radius:12px;margin-bottom:6px;cursor:pointer;border:1px solid #f1f5f9;-webkit-tap-highlight-color:transparent" onmousedown="this.style.background='#f8fafc'" onmouseup="this.style.background='white'">
          <div style="width:36px;height:36px;border-radius:50%;background:${getAvatarColor(u.id)};display:flex;align-items:center;justify-content:center;font-size:0.88rem;font-weight:900;color:white;flex-shrink:0">${getAvatarInitials(u.name)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.85rem;font-weight:700;color:#0f172a">${u.name}</div>
            <div style="font-size:0.7rem;color:#64748b">@${u.username}${u.dept?' · '+u.dept:''}</div>
          </div>
          <span style="font-size:0.65rem;font-weight:700;padding:2px 7px;border-radius:99px;background:${(roleC[u.role]||roleC.reporter).bg};color:${(roleC[u.role]||roleC.reporter).cl}">${{tech:'ช่าง',reporter:'ผู้แจ้ง',admin:'Admin'}[u.role]||u.role}</span>
        </div>`).join('');
    }

    if(!tickets.length && !machines.length && !users.length) {
      html='<div style="text-align:center;padding:40px 20px;color:#94a3b8"><div style="font-size:2rem;margin-bottom:8px">🔍</div><div style="font-size:0.88rem">ไม่พบ "'+q+'"</div></div>';
    }

    results.innerHTML=html;
    // Fix dark mode for results
    if(document.body.classList.contains('dark-mode')) {
      results.querySelectorAll('[style*="background:white"]').forEach(el=>{el.style.background='#2a2f45';});
      results.querySelectorAll('[style*="color:#0f172a"]').forEach(el=>{el.style.color='#dde1f0';});
    }
  };

  results.innerHTML='<div style="text-align:center;padding:32px;color:#94a3b8;font-size:0.88rem">พิมพ์เพื่อค้นหา...</div>';
  inp.addEventListener('input', () => doSearch(inp.value));
  ov.addEventListener('click', e => {
    if(e.target===ov) {
      ov.remove(); _unlockBodyScroll();
    }
  });
}

function renderPagination(page, totalPages, total, from, to) {
  if (totalPages <= 1) return `<div style="text-align:center;font-size:0.72rem;color:#9ca3af;padding:10px 0">ทั้งหมด ${total} รายการ</div>`;
  // สร้างปุ่มหน้า
  let pages = [];
  if (totalPages <= 7) {
    for (let i=1;i<=totalPages;i++) pages.push(i);
  } else {
    pages = [1];
    if (page > 3) pages.push('...');
    for (let i=Math.max(2,page-1);i<=Math.min(totalPages-1,page+1);i++) pages.push(i);
    if (page < totalPages-2) pages.push('...');
    pages.push(totalPages);
  }
  const btnBase = 'display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;font-size:0.82rem;font-weight:700;cursor:pointer;border:none;font-family:inherit;';
  let html = `<div style="padding:14px 4px 6px;display:flex;flex-direction:column;align-items:center;gap:10px">`;
  // info
  html += `<div style="font-size:0.72rem;color:#9ca3af">แสดง ${from+1}–${to} จาก ${total} รายการ</div>`;
  // buttons row
  html += `<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:center">`;
  // prev
  html += `<button onclick="tkGoPage(${page-1})" ${page<=1?'disabled':''} style="${btnBase}background:${page<=1?'#f3f4f6':'white'};color:${page<=1?'#d1d5db':'var(--text)'};border:1.5px solid ${page<=1?'#f3f4f6':'#e5e7eb'}">‹</button>`;
  pages.forEach(p => {
    if (p==='...') {
      html += `<span style="padding:0 4px;color:#9ca3af;font-size:0.8rem">…</span>`;
    } else {
      const isActive = p===page;
      html += `<button onclick="tkGoPage(${p})" style="${btnBase}background:${isActive?'var(--accent)':'white'};color:${isActive?'white':'var(--text)'};border:1.5px solid ${isActive?'var(--accent)':'#e5e7eb'};${isActive?'box-shadow:0 3px 10px rgba(200,16,46,0.3)':''}">${p}</button>`;
    }
  });
  // next
  html += `<button onclick="tkGoPage(${page+1})" ${page>=totalPages?'disabled':''} style="${btnBase}background:${page>=totalPages?'#f3f4f6':'white'};color:${page>=totalPages?'#d1d5db':'var(--text)'};border:1.5px solid ${page>=totalPages?'#f3f4f6':'#e5e7eb'}">›</button>`;
  html += `</div></div>`;
  return html;
}

function tkGoPage(p) {
  const totalPages = Math.ceil(
    (CU.role==='admin' ? (db.tickets||[])
      : CU.role==='tech' ? (db.tickets||[]).filter(t=>t.assigneeId===CU.id)
      : (db.tickets||[]).filter(t=>t.reporterId===CU.id)
    ).filter(t=>{
      const txt=(t.id+t.machine+t.problem+t.detail+t.reporter+(t.assignee||'')).toLowerCase();
      return (!fSearch||txt.includes(fSearch))&&(!fStatus||t.status===fStatus)&&(!fPriority||t.priority===fPriority);
    }).length / TK_PER_PAGE
  );
  tkPage = Math.max(1, Math.min(p, totalPages || 1));
  renderTickets();
  // scroll ขึ้นบนสุดของ ticket list
  const pg = document.getElementById('pg-tickets');
  if (pg) pg.scrollTo({top:0, behavior:'smooth'});
}

function renderMyWork() {
  const DONE_S = ['done','verified','closed'];
  const allMine = CU.role==='reporter' ? (db.tickets||[]).filter(t=>t.reporterId===CU.id)
                : CU.role==='tech'     ? (db.tickets||[]).filter(t=>t.assigneeId===CU.id) : [];
  const pending  = allMine.filter(t=>!DONE_S.includes(t.status)).reverse();
  const doneList = allMine.filter(t=>DONE_S.includes(t.status)).slice(0,5);
  const mwLabel  = document.getElementById('mywork-label');
  if (mwLabel) mwLabel.textContent = `งานของฉัน (${pending.length} รายการที่ยังไม่เสร็จ)`;
  const mwList = document.getElementById('mywork-list');
  if (!mwList) return;

  if (allMine.length === 0) {
    mwList.innerHTML = `<div class="empty"><div class="ei">📋</div><p>ยังไม่มีงาน</p></div>`;
    return;
  }

  // ── KPI strip ──
  const byS = s => allMine.filter(t=>t.status===s).length;
  const kpiItems = [
    {label:'รอจ่ายงาน',   val:byS('new'),          bg:'#eff6ff', cl:'#1d4ed8'},
    {label:'กำลังดำเนินการ',val:byS('assigned')+byS('accepted')+byS('inprogress'), bg:'#fff7ed', cl:'#c2410c'},
    {label:'รออะไหล่',    val:byS('waiting_part'),  bg:'#fff7ed', cl:'#ea580c'},
    {label:'เสร็จแล้ว',   val:byS('done')+byS('verified')+byS('closed'), bg:'#f0fdf4', cl:'#16a34a'},
  ];

  const kpiHtml = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">
    ${kpiItems.map(k=>`
      <div style="background:${k.bg};border-radius:10px;padding:8px 4px;text-align:center;border:1px solid ${k.cl}20">
        <div style="font-size:1.4rem;font-weight:900;color:${k.cl};font-family:'JetBrains Mono',monospace">${k.val}</div>
        <div style="font-size:0.52rem;font-weight:700;color:${k.cl};margin-top:2px;line-height:1.2">${k.label}</div>
      </div>`).join('')}
  </div>`;

  // ── Active groups ──
  const groups = [
    {key:'new',          label:'🆕 รอจ่ายงาน',      color:'#1d4ed8'},
    {key:'assigned',     label:'📋 จ่ายงานแล้ว',     color:'#6d28d9'},
    {key:'accepted',     label:'✋ รับงานแล้ว',      color:'#7c3aed'},
    {key:'inprogress',   label:'⚙️ กำลังซ่อม',       color:'#0e7490'},
    {key:'waiting_part', label:'⏳ รออะไหล่',         color:'#ea580c'},
    {key:'done',         label:'✅ เสร็จแล้ว',        color:'#16a34a'},
  ];

  let groupHtml = '';
  groups.forEach(g => {
    const items = pending.filter(t=>t.status===g.key);
    if (!items.length) return;
    groupHtml += `
      <div style="margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;padding:0 2px">
          <span style="font-size:0.75rem;font-weight:800;color:${g.color}">${g.label}</span>
          <span style="background:${g.color};color:white;border-radius:99px;padding:1px 7px;font-size:0.6rem;font-weight:700">${items.length}</span>
        </div>
        ${items.map(t=>tkCard(t)).join('')}
      </div>`;
  });

  if (!groupHtml) groupHtml = `<div class="empty"><div class="ei">✅</div><p>ไม่มีงานค้าง</p></div>`;

  mwList.innerHTML = kpiHtml + groupHtml;
  requestAnimationFrame(() => typeof _resolveListPhotos === "function" && _resolveListPhotos(mwList));
}

// ══ Overdue Ticket Alert Banner ══
function renderOverdueAlert(T) {
  const OVERDUE_DAYS = 3; // งานที่ค้างเกินกี่วัน ถือว่า "นาน"
  const now = Date.now();
  const activeStatuses = ['new','assigned','accepted','inprogress','waiting_part'];
  const overdue = (T || []).filter(t => {
    if (!activeStatuses.includes(t.status)) return false;
    const created = new Date(t.createdAt || t.updatedAt || 0).getTime();
    const days = (now - created) / (1000 * 60 * 60 * 24);
    return days >= OVERDUE_DAYS;
  }).sort((a, b) => new Date(a.createdAt||0) - new Date(b.createdAt||0)); // เก่าสุดก่อน

  if (!overdue.length) return '';

  const items = overdue.slice(0, 5).map(t => {
    const created = new Date(t.createdAt || t.updatedAt || 0).getTime();
    const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    const urgColor = days >= 7 ? '#b91c1c' : days >= 5 ? '#d97706' : '#c8102e';
    const urgBg   = days >= 7 ? '#fef2f2' : days >= 5 ? '#fffbeb' : '#fff0f2';
    const urgBdr  = days >= 7 ? '#fecaca' : days >= 5 ? '#fde68a' : '#fecaca';
    return `<div onclick="safeOpenDetail('${t.id}')" style="display:flex;align-items:center;gap:9px;padding:8px 10px;background:white;border-radius:10px;border:1px solid #f1f5f9;cursor:pointer;-webkit-tap-highlight-color:transparent;margin-bottom:5px" onmousedown="this.style.background='#f8fafc'" onmouseup="this.style.background='white'">
      <div style="background:${urgBg};border:1.5px solid ${urgBdr};border-radius:8px;padding:3px 8px;font-size:0.65rem;font-weight:900;color:${urgColor};flex-shrink:0;min-width:36px;text-align:center">${days}d</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.78rem;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.machine||'—')}</div>
        <div style="font-size:0.62rem;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.problem||'—')}</div>
      </div>
      <span style="font-size:0.6rem;font-weight:700;padding:2px 8px;border-radius:99px;background:${urgBg};color:${urgColor};border:1px solid ${urgBdr};flex-shrink:0">${t.assignee||'ยังไม่มีช่าง'}</span>
    </div>`;
  }).join('');

  const moreCount = overdue.length > 5 ? overdue.length - 5 : 0;

  return `
  <div style="background:linear-gradient(135deg,#fff5f5,#fff0f0);border:2px solid #fca5a5;border-radius:18px;padding:14px 14px 10px;margin-bottom:12px;position:relative;overflow:hidden">
    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#dc2626,#f87171)"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:7px">
        <div style="width:28px;height:28px;border-radius:9px;background:linear-gradient(135deg,#dc2626,#ef4444);display:flex;align-items:center;justify-content:center;font-size:0.85rem;box-shadow:0 3px 8px rgba(220,38,38,.3)">⚠️</div>
        <div>
          <div style="font-size:0.72rem;font-weight:900;color:#dc2626">งานค้างนานเกิน ${OVERDUE_DAYS} วัน!</div>
          <div style="font-size:0.58rem;color:#ef4444;margin-top:1px">พบ ${overdue.length} งาน ต้องดำเนินการ</div>
        </div>
      </div>
      <button onclick="setFilter('status','');goPage('tickets')" style="background:#dc2626;color:white;border:none;border-radius:8px;padding:5px 10px;font-size:0.62rem;font-weight:800;cursor:pointer;font-family:inherit;flex-shrink:0">ดูทั้งหมด →</button>
    </div>
    ${items}
    ${moreCount > 0 ? `<div style="text-align:center;font-size:0.65rem;color:#ef4444;font-weight:700;padding-top:4px">และอีก ${moreCount} งาน...</div>` : ''}
  </div>`;
}

// ══ PM Reminder Banner ══
function renderPMReminderBanner() {
  const WARN_DAYS = 7; // แจ้งเตือนล่วงหน้าก่อนกี่วัน
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const warnDate = new Date(now.getTime() + WARN_DAYS * 86400000).toISOString().slice(0, 10);

  const pmEvents = (db.calEvents || []).filter(e =>
    (e.type === 'clean-major' || e.type === 'clean-minor') &&
    e.date >= todayStr && e.date <= warnDate
  ).sort((a, b) => a.date.localeCompare(b.date));

  if (!pmEvents.length) return '';

  const items = pmEvents.slice(0, 3).map(e => {
    const d = new Date(e.date + 'T00:00');
    const diff = Math.round((d - now) / 86400000);
    const isMajor = e.type === 'clean-major';
    const tagColor = isMajor ? '#0369a1' : '#059669';
    const tagBg    = isMajor ? '#eff6ff' : '#f0fdf4';
    const tagBdr   = isMajor ? '#bfdbfe' : '#bbf7d0';
    const urgText  = diff === 0 ? '🔴 วันนี้!' : diff === 1 ? '🟠 พรุ่งนี้' : `🟡 อีก ${diff} วัน`;
    const dateStr  = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    return `<div onclick="goPage('calendar')" style="display:flex;align-items:center;gap:9px;padding:8px 10px;background:white;border-radius:10px;border:1px solid #f1f5f9;cursor:pointer;-webkit-tap-highlight-color:transparent;margin-bottom:5px" onmousedown="this.style.background='#f8fafc'" onmouseup="this.style.background='white'">
      <div style="font-size:1.2rem;flex-shrink:0">${isMajor ? '🔵' : '💦'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.78rem;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(e.title||'แผน PM')}</div>
        <div style="font-size:0.62rem;color:#94a3b8">📅 ${dateStr}${e.tech ? ' · 👷 ' + escapeHtml(e.tech) : ''}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
        <span style="font-size:0.58rem;font-weight:800;padding:2px 7px;border-radius:99px;background:${tagBg};color:${tagColor};border:1px solid ${tagBdr}">${isMajor ? 'Major' : 'Minor'}</span>
        <span style="font-size:0.6rem;font-weight:700;color:#64748b">${urgText}</span>
      </div>
    </div>`;
  }).join('');

  const moreCount = pmEvents.length > 3 ? pmEvents.length - 3 : 0;

  return `
  <div style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border:2px solid #7dd3fc;border-radius:18px;padding:14px 14px 10px;margin-bottom:12px;position:relative;overflow:hidden">
    <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#0284c7,#38bdf8)"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:7px">
        <div style="width:28px;height:28px;border-radius:9px;background:linear-gradient(135deg,#0284c7,#38bdf8);display:flex;align-items:center;justify-content:center;font-size:0.85rem;box-shadow:0 3px 8px rgba(2,132,199,.3)">📅</div>
        <div>
          <div style="font-size:0.72rem;font-weight:900;color:#0284c7">แผน PM ใน ${WARN_DAYS} วันข้างหน้า</div>
          <div style="font-size:0.58rem;color:#0369a1;margin-top:1px">พบ ${pmEvents.length} แผน ต้องเตรียมพร้อม</div>
        </div>
      </div>
      <button onclick="goPage('calendar')" style="background:#0284c7;color:white;border:none;border-radius:8px;padding:5px 10px;font-size:0.62rem;font-weight:800;cursor:pointer;font-family:inherit;flex-shrink:0">ดูปฏิทิน →</button>
    </div>
    ${items}
    ${moreCount > 0 ? `<div style="text-align:center;font-size:0.65rem;color:#0284c7;font-weight:700;padding-top:4px">และอีก ${moreCount} แผน...</div>` : ''}
  </div>`;
}

// ══ Calendar 7 days for admin home ══
function renderHomeRecentMachines() {
  if (!CU || !db.machines) return '';

  const ticketMachineIds = [...new Set(
    (db.tickets||[])
      .filter(t => t.machineId)
      .sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''))
      .map(t => t.machineId)
  )].slice(0, 5);

  const ids = ticketMachineIds.length >= 1 ? ticketMachineIds
    : (db.machines||[]).slice(-5).reverse().map(m=>m.id);

  const machines = ids.map(id => (db.machines||[]).find(m=>m.id===id)).filter(Boolean).slice(0,5);
  if (!machines.length) return '';

  const isAdmin = CU.role === 'admin';

  const vcMap = {
    SKIC:{bg:'#eff6ff',cl:'#1d4ed8',bd:'#bfdbfe'},
    TPC: {bg:'#f0fdf4',cl:'#166534',bd:'#bbf7d0'},
    SNP: {bg:'#fefce8',cl:'#92400e',bd:'#fde68a'},
    SCG: {bg:'#fff7ed',cl:'#c2410c',bd:'#fed7aa'},
    SCL: {bg:'#fdf4ff',cl:'#7c3aed',bd:'#e9d5ff'},
  };
  const dvc = {bg:'#f8fafc',cl:'#475569',bd:'#e2e8f0'};

  const rows = machines.map((m,i) => {
    const activeT = (db.tickets||[]).filter(t=>t.machineId===m.id&&!['closed','verified'].includes(t.status));
    const lastT   = (db.tickets||[]).filter(t=>t.machineId===m.id).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''))[0];
    const hasPendingPO = activeT.some(t => t.techRequest && !t.purchaseOrder);
    const hasIssue = activeT.length > 0;
    const vc = vcMap[m.vendor] || dvc;
    const isLast = i === machines.length - 1;

    return `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;${isLast?'':'border-bottom:1px solid #f8fafc;'}cursor:pointer;transition:background 0.12s;-webkit-tap-highlight-color:transparent"
      onclick="goPage('machines')"
      onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">

      <!-- Icon -->
      <div style="width:36px;height:36px;border-radius:10px;background:${hasIssue?'linear-gradient(135deg,#c8102e,#9b0020)':'linear-gradient(135deg,#0f172a,#1e293b)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.12)">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="3" width="20" height="8" rx="2"/><line x1="2" y1="7" x2="22" y2="7"/><path d="M7 11v5"/><path d="M12 11v9"/><path d="M17 11v5"/></svg>
      </div>

      <!-- Info -->
      <div style="flex:1;min-width:0">
        <div style="font-size:0.82rem;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:3px">${m.name||m.location||m.id}</div>
        <div style="display:flex;align-items:center;gap:5px;flex-wrap:nowrap;overflow:hidden">
          ${m.vendor?`<span style="background:${vc.bg};color:${vc.cl};border:1px solid ${vc.bd};border-radius:4px;padding:0 5px;font-size:0.58rem;font-weight:800;flex-shrink:0">${m.vendor}</span>`:''}
          ${m.btu?`<span style="font-size:0.62rem;color:#94a3b8;flex-shrink:0">${Number(m.btu).toLocaleString()} BTU</span>`:''}
          <span style="font-size:0.6rem;color:#cbd5e1;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.serial||''}</span>
        </div>
      </div>

      <!-- Right -->
      <div style="display:flex;align-items:center;gap:5px;flex-shrink:0" onclick="event.stopPropagation()">
        ${hasPendingPO ? `<span style="background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:6px;padding:2px 6px;font-size:0.58rem;font-weight:800">รอ PO</span>` : ''}
        ${hasIssue
          ? `<span style="background:#fff0f2;color:#c8102e;border:1px solid #fecaca;border-radius:99px;padding:2px 7px;font-size:0.62rem;font-weight:700;white-space:nowrap">${activeT.length} ค้าง</span>`
          : `<span style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:99px;padding:2px 7px;font-size:0.62rem;font-weight:600">ปกติ</span>`
        }
        ${isAdmin ? `<button onclick="openMachineSheet('${m.id}')"
          style="width:28px;height:28px;background:#f1f5f9;color:#64748b;border:none;border-radius:7px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background 0.12s"
          onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
        </button>` : `<span style="font-size:0.6rem;color:#cbd5e1">${lastT?(lastT.updatedAt||'').substring(0,10):'—'}</span>`}
      </div>
    </div>`;
  }).join('');

  const pendingCount = (db.machineRequests||[]).filter(r=>r.status==='pending').length;

  return `
  <div style="margin-bottom:12px">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:7px">
        <div style="width:22px;height:22px;background:#0f172a;border-radius:6px;display:flex;align-items:center;justify-content:center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="8" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
        </div>
        <span style="font-size:0.82rem;font-weight:800;color:#0f172a">เครื่องแอร์ล่าสุด</span>
        ${pendingCount>0&&isAdmin?`<span onclick="openMachineRequestsPage()" style="background:#1d4ed8;color:white;border-radius:99px;padding:1px 7px;font-size:0.58rem;font-weight:800;cursor:pointer">${pendingCount} รอ</span>`:''}
      </div>
      <button onclick="goPage('machines')" style="background:none;border:none;color:#c8102e;font-size:0.68rem;font-weight:700;cursor:pointer;font-family:inherit;padding:0">ดูทั้งหมด →</button>
    </div>

    <!-- Cards -->
    <div style="background:white;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.05)">
      ${rows}
    </div>
  </div>`;
}

function renderHomeCal(T) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);
  const DAYS = ['อา','จ','อ','พ','พฤ','ศ','ส'];
  const MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

  // header
  let html = '<div style="display:flex;align-items:center;justify-content:space-between;margin:8px 0 10px">'
    + '<div style="font-size:0.82rem;font-weight:800;color:var(--text)">📅 ปฏิทินงาน 7 วัน</div>'
    + '<button onclick="goPage(\'calendar\')" style="font-size:0.68rem;color:var(--accent);background:none;border:none;cursor:pointer;font-weight:700;padding:0;font-family:inherit">ดูทั้งหมด →</button>'
    + '</div>';

  // grid — 7 columns, equal width
  html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:14px">';

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const ds = d.toISOString().slice(0,10);
    const isToday = ds === todayStr;
    const isTomorrow = i === 1;
    const dayT = T.filter(t => (t.createdAt||'').startsWith(ds));
    const cnt = dayT.length;
    const dayName = DAYS[d.getDay()];
    const dateNum = d.getDate();

    // colors
    const bg     = isToday ? 'var(--accent)' : 'white';
    const txMain = isToday ? 'white' : 'var(--text)';
    const txSub  = isToday ? 'rgba(255,255,255,0.75)' : '#9ca3af';
    const border = isToday ? 'var(--accent)' : '#e5e7eb';
    const shadow = isToday ? '0 4px 14px rgba(200,16,46,0.35)' : '0 1px 3px rgba(0,0,0,0.06)';

    html += '<div onclick="goPage(\'calendar\')" style="'
      + 'display:flex;flex-direction:column;align-items:center;justify-content:space-between;'
      + 'background:'+bg+';border:1.5px solid '+border+';border-radius:14px;'
      + 'padding:8px 4px 7px;cursor:pointer;box-shadow:'+shadow+';min-height:68px;'
      + 'position:relative;overflow:hidden;transition:transform 0.15s">';

    // day name
    html += '<div style="font-size:0.62rem;font-weight:700;color:'+txSub+';letter-spacing:0.02em;line-height:1">'+dayName+'</div>';

    // date number — big
    html += '<div style="font-size:1.35rem;font-weight:900;color:'+txMain+';line-height:1;margin:2px 0">'+dateNum+'</div>';

    // badge or spacer
    if (cnt > 0) {
      const badgeBg = isToday ? 'rgba(255,255,255,0.25)' : 'var(--accent)';
      const badgeTx = 'white';
      html += '<div style="background:'+badgeBg+';color:'+badgeTx+';border-radius:99px;'
        + 'padding:1px 6px;font-size:0.58rem;font-weight:800;line-height:1.5;min-width:18px;text-align:center">'+cnt+'</div>';
    } else {
      html += '<div style="height:16px"></div>';
    }

    html += '</div>';
  }

  html += '</div>';
  return html;
}

// อัปเดต status scroller counts
function updateStatusScroller() {
  if (!CU) return;
  const base = getMyTickets();
  const counts = {};
  base.forEach(t => { counts[t.status] = (counts[t.status]||0) + 1; });

  // individual
  ['new'].forEach(s => {
    const el = document.getElementById('sc-n-'+s);
    if (el) el.textContent = counts[s]||0;
  });
  // grouped: _active = assigned + accepted + inprogress
  const activeCount = (counts['assigned']||0) + (counts['accepted']||0) + (counts['inprogress']||0) + (counts['waiting_part']||0);
  const activeEl = document.getElementById('sc-n-_active');
  if (activeEl) activeEl.textContent = activeCount;
  // grouped: _done = done + verified + closed
  const doneCount = (counts['done']||0) + (counts['verified']||0) + (counts['closed']||0);
  const doneEl = document.getElementById('sc-n-_done');
  if (doneEl) doneEl.textContent = doneCount;
  // all
  const allEl = document.getElementById('sc-n-all');
  if (allEl) allEl.textContent = base.length;

  // อัปเดตสี active card
  document.querySelectorAll('.sc-card').forEach(card => {
    const s = card.dataset.s;
    const isActive = s === fStatus;
    const col = s === '' ? 'var(--accent)'
      : s === '_active' ? '#e65100'
      : s === '_done'   ? '#16a34a'
      : sColor(s);
    if (isActive) {
      card.style.background = col;
      card.style.borderColor = col;
      card.style.boxShadow = 'none';
      card.querySelectorAll('.sc-n,.sc-l').forEach(e => e.style.color = 'white');
    } else {
      card.style.background = 'white';
      card.style.borderColor = '#e5e7eb';
      card.style.boxShadow = 'none';
      const numEl = card.querySelector('.sc-n');
      const lblEl = card.querySelector('.sc-l');
      if (numEl) numEl.style.color = s==='' ? 'var(--accent)' : col;
      if (lblEl) lblEl.style.color = '#6b7280';
    }
  });
}
function scrollToActiveCard(el) {
  if (el) el.scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' });
}
// ── Ticket cache — ลด repeated db.tickets.filter() ──
let _tkCache = null, _tkCacheRole = null, _tkCacheId = null;
// Per-ticket HTML cache — skip rebuild ถ้า ticket ไม่เปลี่ยน
const _tkCardCache = new Map();

// ── Multi-select state ──────────────────────────────────────
let _multiSelectMode = false;
let _selectedTickets = new Set();

// ── Multi-select functions ──────────────────────────────────
function toggleMultiSelect() {
  if (_multiSelectMode) exitMultiSelect();
  else enterMultiSelect();
}
function enterMultiSelect() {
  _multiSelectMode = true;
  _selectedTickets.clear();
  const bar = document.getElementById('multi-select-bar');
  const btn = document.getElementById('multi-select-toggle');
  if (bar) { bar.style.display = 'flex'; }
  if (btn) {
    btn.style.background = '#f1f5f9';
    btn.style.color = '#64748b';
    btn.style.border = '1.5px solid #e5e7eb';
    btn.style.boxShadow = 'none';
    btn.innerHTML = '✕ ยกเลิก';
  }
  // ปรับ title + action label + filter button ตาม role
  const titleEl = document.getElementById('multi-select-title');
  const actionLbl = document.getElementById('bulk-action-label');
  const newOnlyBtn = document.getElementById('bulk-new-only-btn');
  if (CU?.role === 'admin') {
    if (titleEl) titleEl.textContent = 'โหมดจ่ายงานหลายรายการ';
    if (actionLbl) actionLbl.textContent = 'จ่ายงาน';
    if (newOnlyBtn) newOnlyBtn.style.display = '';
  } else if (CU?.role === 'tech') {
    if (titleEl) titleEl.textContent = 'โหมดรับงานหลายรายการ';
    if (actionLbl) actionLbl.textContent = 'รับงาน';
    if (newOnlyBtn) newOnlyBtn.style.display = 'none';
  } else if (CU?.role === 'reporter') {
    if (titleEl) titleEl.textContent = 'โหมดตรวจรับหลายรายการ';
    if (actionLbl) actionLbl.textContent = 'ตรวจรับงาน';
    if (newOnlyBtn) newOnlyBtn.style.display = 'none';
  }
  _updateMultiSelectUI();
  renderTickets();
}

// router — เปิด sheet ที่ถูกต้องตาม role
function openBulkActionSheet() {
  if (_selectedTickets.size === 0) return;
  if (CU?.role === 'admin') openBulkAssignSheet();
  else if (CU?.role === 'tech') doBulkAccept();
  else if (CU?.role === 'reporter') doBulkVerify();
}

// Tech: รับงานหลายงานพร้อมกัน
function doBulkAccept() {
  if (_selectedTickets.size === 0) return;
  const now = nowStr();
  let count = 0;
  _selectedTickets.forEach(tid => {
    const t = db.tickets.find(x => x.id === tid);
    if (!t || t.assigneeId !== CU.id) return;
    if (!['assigned'].includes(t.status)) return;
    t.status = 'inprogress'; t.updatedAt = now; t.startedAt = t.startedAt || now;
    t.history.push({act:'🔧 เริ่มซ่อม (Bulk)', by:CU.name, at:now});
    notifyRole('admin','🔧 ช่างรับและเริ่มซ่อม ['+tid+']',CU.name+' รับงาน "'+t.problem+'"',tid);
    if (typeof sendLineNotifyEvent === 'function') sendLineNotifyEvent('accept', t);
    syncTicket(t);
    count++;
  });
  if (count === 0) { showToast('⚠️ ไม่มีงานที่รับได้ (ต้องเป็นงานที่จ่ายให้คุณแล้ว)'); return; }
  saveDB();
  if(typeof invalidateTkCache==='function') invalidateTkCache();
  exitMultiSelect();
  if (typeof refreshPage === "function") refreshPage(); else location.reload();
  updateOpenBadge();
  showToast(`✅ รับงานแล้ว ${count} รายการ`);
  if (navigator.vibrate) navigator.vibrate([100,30,100]);
}

// Reporter: ตรวจรับหลายงานพร้อมกัน
function doBulkVerify() {
  if (_selectedTickets.size === 0) return;
  const now = nowStr();
  let count = 0;
  _selectedTickets.forEach(tid => {
    const t = db.tickets.find(x => x.id === tid);
    if (!t || t.reporterId !== CU.id) return;
    if (!['done'].includes(t.status)) return;
    t.status = 'verified'; t.updatedAt = now;
    t.history.push({act:'🔍 ตรวจรับงาน (Bulk)', by:CU.name, at:now});
    if (t.assigneeId) notifyUser(t.assigneeId,'🔍 ผู้แจ้งตรวจรับ ['+tid+']','งาน "'+t.problem+'" ผ่านการตรวจรับแล้ว',tid);
    notifyRole('admin','🔍 ตรวจรับงาน ['+tid+']',CU.name+' ตรวจรับงาน "'+t.problem+'"',tid);
    syncTicket(t);
    count++;
  });
  if (count === 0) { showToast('⚠️ ไม่มีงานที่ตรวจรับได้ (ต้องเป็นงานเสร็จแล้วที่คุณเป็นผู้แจ้ง)'); return; }
  saveDB();
  if(typeof invalidateTkCache==='function') invalidateTkCache();
  exitMultiSelect();
  if (typeof refreshPage === "function") refreshPage(); else location.reload();
  updateOpenBadge();
  showToast(`✅ ตรวจรับงานแล้ว ${count} รายการ`);
  if (navigator.vibrate) navigator.vibrate([100,30,100]);
}
function exitMultiSelect() {
  _multiSelectMode = false;
  _selectedTickets.clear();
  const bar = document.getElementById('multi-select-bar');
  const btn = document.getElementById('multi-select-toggle');
  if (bar) bar.style.display = 'none';
  if (btn) {
    btn.style.background = 'linear-gradient(135deg,#9b0b22,#c8102e)';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.boxShadow = '0 2px 8px rgba(200,16,46,0.35)';
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="5" width="6" height="6" rx="1"/><rect x="3" y="13" width="6" height="6" rx="1"/><line x1="15" y1="8" x2="21" y2="8"/><line x1="15" y1="16" x2="21" y2="16"/></svg> จ่ายงาน';
  }
  renderTickets();
}
function toggleTicketSelect(tid, e) {
  if (e) e.stopPropagation();
  if (_selectedTickets.has(tid)) _selectedTickets.delete(tid);
  else _selectedTickets.add(tid);
  _updateMultiSelectUI();
  // update this card visually without full re-render
  const wrap = document.querySelector(`.tk-wrap[data-tid="${tid}"]`);
  if (wrap) _applyCardSelectStyle(wrap, _selectedTickets.has(tid));
}
function _applyCardSelectStyle(wrap, selected) {
  const card = wrap.querySelector('.tk');
  if (!card) return;
  // outline + background tint ให้เห็นชัดขึ้น
  card.style.outline = selected ? '2.5px solid #c8102e' : 'none';
  card.style.outlineOffset = selected ? '-2px' : '0';
  card.style.background = selected ? '#fff5f5' : 'white';
  card.style.borderLeftColor = selected ? '#c8102e' : '';
  card.style.borderLeftWidth = selected ? '5px' : '';
  // animate scale ให้รู้สึก "snap"
  card.style.transition = 'transform 0.15s ease, background 0.15s ease, outline 0.15s ease';
  card.style.transform = selected ? 'scale(0.985)' : 'scale(1)';
  const cb = wrap.querySelector('.tk-checkbox');
  if (cb) {
    cb.style.background = selected ? '#c8102e' : 'white';
    cb.style.borderColor = selected ? '#c8102e' : '#cbd5e1';
    cb.style.transform = selected ? 'scale(1.15)' : 'scale(1)';
    cb.style.transition = 'transform 0.15s ease, background 0.15s ease';
    cb.innerHTML = selected ? '<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="2 6 5 9 10 3"/></svg>' : '';
  }
}
function _updateMultiSelectUI() {
  const n = _selectedTickets.size;
  const countEl = document.getElementById('multi-select-count');
  if (countEl) countEl.textContent = `${n} งาน`;
  const btn = document.getElementById('bulk-assign-btn');
  if (btn) {
    const active = n > 0;
    btn.style.opacity = active ? '1' : '0.4';
    btn.style.pointerEvents = active ? 'auto' : 'none';
  }
}
function selectAllVisibleTickets() {
  document.querySelectorAll('.tk-wrap[data-tid]').forEach(wrap => {
    const tid = wrap.dataset.tid;
    if (tid) _selectedTickets.add(tid);
    _applyCardSelectStyle(wrap, true);
  });
  _updateMultiSelectUI();
}
// เลือกเฉพาะงานใหม่ที่ยังไม่จ่าย
function selectNewTickets() {
  // deselect all first
  document.querySelectorAll('.tk-wrap[data-tid]').forEach(wrap => {
    _applyCardSelectStyle(wrap, false);
  });
  _selectedTickets.clear();
  document.querySelectorAll('.tk-wrap[data-tid]').forEach(wrap => {
    const tid = wrap.dataset.tid;
    const t = tid ? db.tickets.find(x => x.id === tid) : null;
    if (t && t.status === 'new') {
      _selectedTickets.add(tid);
      _applyCardSelectStyle(wrap, true);
    }
  });
  _updateMultiSelectUI();
  if (_selectedTickets.size === 0) showToast('ไม่พบงานใหม่ในหน้านี้');
}
function openBulkAssignSheet() {
  if (_selectedTickets.size === 0) return;
  // Label
  const lbl = document.getElementById('bulk-assign-label');
  if (lbl) lbl.textContent = `${_selectedTickets.size} งานที่เลือก`;
  // Chips
  const chips = document.getElementById('bulk-ticket-chips');
  if (chips) {
    chips.innerHTML = [..._selectedTickets].map(tid => {
      const t = db.tickets.find(x => x.id === tid);
      return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:white;border:1.5px solid #fca5a5;border-radius:8px;font-size:0.62rem;font-weight:700;color:#9b0b22">
        <span style="font-family:'JetBrains Mono',monospace">${tid}</span>
        ${t ? `<span style="color:#64748b;font-weight:500;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.problem||''}</span>` : ''}
        <span onclick="event.stopPropagation();_selectedTickets.delete('${tid}');_updateMultiSelectUI();openBulkAssignSheet()" style="cursor:pointer;color:#c8102e;font-size:0.7rem;line-height:1">✕</span>
      </span>`;
    }).join('');
  }
  // Tech list
  let bulkSelTechId = null;
  const tl = document.getElementById('bulk-tech-list');
  if (tl) {
    tl.innerHTML = db.users.filter(u => u.role === 'tech').map(u => {
      const cnt = (db.tickets||[]).filter(t => t.assigneeId === u.id && !['closed','verified','done'].includes(t.status)).length;
      const wLevel = cnt === 0 ? 'free' : cnt <= 2 ? 'ok' : cnt <= 4 ? 'busy' : 'full';
      const wCfg = {
        free: { bar:'#22c55e', barW:'0%',    badge:'ว่าง',     badgeBg:'#dcfce7', badgeColor:'#166534', bdr:'#bbf7d0' },
        ok:   { bar:'#22c55e', barW:`${cnt*20}%`, badge:`${cnt} งาน`, badgeBg:'#f0fdf4', badgeColor:'#15803d', bdr:'#bbf7d0' },
        busy: { bar:'#f59e0b', barW:`${cnt*15}%`, badge:`${cnt} งาน`, badgeBg:'#fffbeb', badgeColor:'#92400e', bdr:'#fde68a' },
        full: { bar:'#ef4444', barW:'100%',   badge:`${cnt} งาน`, badgeBg:'#fef2f2', badgeColor:'#b91c1c', bdr:'#fecaca' },
      }[wLevel];
      const _ti = (u.name||'?').slice(0,2).toUpperCase();
      const _tc = (u.name||'?').charAt(0).toUpperCase();
      const _tGrad = {W:'linear-gradient(135deg,#1d4ed8,#3b82f6)',T:'linear-gradient(135deg,#ea580c,#fb923c)',S:'linear-gradient(135deg,#16a34a,#4ade80)',P:'linear-gradient(135deg,#7c3aed,#a78bfa)'}[_tc] || 'linear-gradient(135deg,#374151,#6b7280)';
      const avatar = (u.photo && u.photo !== 'undefined')
        ? `<img src="${u.photo}" onerror="this.style.display='none'" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid #e2e8f0;flex-shrink:0">`
        : `<div style="width:44px;height:44px;border-radius:50%;background:${_tGrad};display:flex;align-items:center;justify-content:center;flex-shrink:0;border:2px solid rgba(255,255,255,0.3);font-size:0.85rem;font-weight:900;color:white;letter-spacing:0.02em;box-shadow:0 2px 10px rgba(0,0,0,0.18)">${_ti}</div>`;
      return `<div id="btc-${u.id}" onclick="_bulkPickTech('${u.id}')"
        style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;border:2px solid #e5e7eb;background:white;cursor:pointer;transition:all 0.18s;touch-action:manipulation;box-shadow:0 1px 4px rgba(0,0,0,0.04)">
        ${avatar}
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
            <div style="font-size:0.88rem;font-weight:800;color:#0f172a">${u.name}</div>
            <span style="font-size:0.58rem;font-weight:800;padding:2px 7px;border-radius:99px;background:${wCfg.badgeBg};color:${wCfg.badgeColor};border:1px solid ${wCfg.bdr}">${wCfg.badge}</span>
          </div>
          <div style="font-size:0.7rem;color:#64748b;margin-bottom:6px">${u.dept||'ช่างเทคนิค'}</div>
          <div style="background:#f1f5f9;border-radius:99px;height:4px;overflow:hidden"><div style="height:100%;width:${wCfg.barW};background:${wCfg.bar};border-radius:99px"></div></div>
        </div>
      </div>`;
    }).join('');
    // click handler stored in closure
    window._bulkPickTech = function(id) {
      bulkSelTechId = id;
      document.querySelectorAll('#bulk-tech-list > div').forEach(card => {
        const sel = card.id === 'btc-'+id;
        card.style.borderColor = sel ? '#c8102e' : '#e5e7eb';
        card.style.background = sel ? 'linear-gradient(135deg,#fff0f2,#ffe4e8)' : 'white';
        card.style.boxShadow = sel ? '0 4px 16px rgba(200,16,46,0.2)' : '0 1px 4px rgba(0,0,0,0.04)';
        const nameEl = card.querySelector('div[style*="font-weight:800"]');
        if (nameEl) nameEl.style.color = sel ? '#9b0b22' : '#0f172a';
        const img = card.querySelector('img');
        if (img) img.style.borderColor = sel ? '#c8102e' : '#e2e8f0';
      });
      // store for doBulkAssign
      document.getElementById('bulk-assign-sheet')._selTechId = id;
    };
  }
  document.getElementById('bulk-note').value = '';
  openSheet('bulk-assign');
}
function doBulkAssign() {
  const sheet = document.getElementById('bulk-assign-sheet');
  const techId = sheet?._selTechId;
  if (!techId) { showToast('⚠️ กรุณาเลือกช่างก่อน'); const tl = document.getElementById('bulk-tech-list'); if(tl){tl.style.animation='shake 0.3s ease';setTimeout(()=>tl.style.animation='',350);} return; }
  if (_selectedTickets.size === 0) { showToast('⚠️ ไม่มีงานที่เลือก'); return; }
  const tech = db.users.find(u => u.id === techId);
  if (!tech) { showToast('⚠️ ไม่พบข้อมูลช่าง'); return; }
  const note = document.getElementById('bulk-note')?.value.trim() || '';
  const now = nowStr();
  let count = 0;
  _selectedTickets.forEach(tid => {
    const t = db.tickets.find(x => x.id === tid);
    if (!t || ['closed','verified','done'].includes(t.status)) return;
    t.assigneeId = techId; t.assignee = tech.name; t.status = 'assigned'; t.updatedAt = now;
    if (note) t.note = note;
    t.history.push({act:'📋 จ่ายงาน (Bulk)', by:CU.name, at:now, detail:note});
    notifyUser(techId,'📋 มีงานมอบหมาย ['+tid+']','งาน "'+t.problem+'" ที่ '+t.machine,tid);
    if (typeof sendLineNotifyEvent === 'function') sendLineNotifyEvent('assign', t);
    syncTicket(t);
    count++;
  });
  saveDB();
  closeSheet('bulk-assign');
  exitMultiSelect();
  if (typeof refreshPage === "function") refreshPage(); else location.reload();
  showToast(`✅ จ่าย ${count} งานให้ ${tech.name} แล้ว`);
  if (navigator.vibrate) navigator.vibrate([100,30,100]);
}
// ───────────────────────────────────────────────────────────
function _tkHash(t) { return (t.updatedAt||t.createdAt||'')+t.status+(t.assigneeId||'')+t.priority+((t.photosBefore?.length||0)+(t.photosAfter?.length||0)); }
function getMyTickets() {
  if (_tkCache && _tkCacheRole === CU?.role && _tkCacheId === CU?.id) return _tkCache;
  if (!CU) return [];
  _tkCacheRole = CU.role; _tkCacheId = CU.id;
  _tkCache = CU.role==='admin' ? (db.tickets||[])
    : CU.role==='tech' ? (db.tickets||[]).filter(t=>t.assigneeId===CU.id)
    : (db.tickets||[]).filter(t=>t.reporterId===CU.id);
  return _tkCache;
}
function invalidateTkCache() { _tkCache = null; if(typeof _tkCardCache!=="undefined") _tkCardCache.clear(); }

function updateOpenBadge() {
  if (!CU) return;
  const open = t => !['closed','verified','rejected'].includes(t.status);
  const myT = getMyTickets();
  const cnt = myT.filter(open).length;
  document.querySelectorAll('#open-badge').forEach(b=>{b.textContent=cnt;b.classList.toggle('on',cnt>0);});
  if (CU.role==='admin') {
    const nPur = (db.tickets||[]).filter(t => t.techRequest?.locked && !t.purchaseOrder).length;
    document.querySelectorAll('#pur-badge').forEach(b=>{ b.textContent=nPur||''; b.style.display=nPur>0?'flex':'none'; });
  }
}

function sColor(s){return{new:'#1d4ed8',assigned:'#4338ca',accepted:'#7c3aed',inprogress:'#0e7490',waiting_part:'#c2410c',done:'#15803d',verified:'#15803d',closed:'#6b7280',rejected:'#b91c1c',reject_verify:'#b91c1c'}[s]||'#6b7280';}
function sTH(s){
  const _m={new:'📩 ใหม่',assigned:'👤 จ่ายแล้ว',accepted:'🙋 รับแล้ว',inprogress:'⚙️ กำลังซ่อม',waiting_part:'⏳ รออะไหล่',done:'✅ เสร็จแล้ว',verified:'🔵 ตรวจรับ',closed:'🏁 ปิดงาน',rejected:'↩️ ส่งซ่อมใหม่'};
  if(!_m[s]) return s;
  const _p=_m[s].split(' '); return _p[0]+' '+t(_p.slice(1).join(' '));
}
function stc(s){return{new:'t-blue',assigned:'t-indigo',accepted:'t-purple',inprogress:'t-cyan',waiting_part:'t-orange',done:'t-green',verified:'t-green',closed:'t-muted',rejected:'t-red',reject_verify:'t-red'}[s]||'t-muted';}
function prTH(p){const _m={high:'🔴 ด่วนมาก',mid:'🟡 ปานกลาง',low:'🟢 ไม่เร่งด่วน'};if(!_m[p])return p;const _p=_m[p].split(' ');return _p[0]+' '+t(_p.slice(1).join(' '));}
function prC(p){return{high:'t-red',mid:'t-yellow',low:'t-green'}[p]||'t-muted';}

// ── Machine Map cache — ลด db.machines.find() O(n) → O(1) ──
let _macMap = null;
function getMacMap() {
  if (!_macMap) {
    _macMap = new Map((db.machines||[]).map(m => [m.id, m]));
  }
  return _macMap;
}
function invalidateMacCache() { _macMap = null; }

// ── Debounce — ป้องกัน render ถี่เกินไปขณะพิมพ์ search ──
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
const _debouncedRenderTickets = debounce(() => renderTickets(), 150);
const _debouncedRenderMachines = debounce(() => applyMachineFilter(), 200);

function getSerial(t) {
  return getMacMap().get(t.machineId)?.serial || '';
}
function vendorStyle(v) {
  const map = {
    'SKIC': ['#fef2f2','#b91c1c','#fecaca'],
    'TPC':  ['#eff6ff','#1d4ed8','#bfdbfe'],
    'TPL':  ['#eff6ff','#1d4ed8','#bfdbfe'],
    'SNP':  ['#f0fdf4','#15803d','#bbf7d0'],
    'SCG':  ['#fff7ed','#c2410c','#fed7aa'],
    'SCL':  ['#fdf4ff','#7e22ce','#e9d5ff'],
  };
  const s = map[v] || ['#f8fafc','#475569','#e2e8f0'];
  return {bg:s[0], color:s[1], border:s[2]};
}
function tkCard(t) {
  // ── HTML cache: skip rebuild ถ้า ticket ไม่เปลี่ยน ──
  const _hash = _tkHash(t);
  const _cached = _tkCardCache.get(t.id);
  if (_cached && _cached.hash === _hash) return _cached.html;

  const mac = getMacMap().get(t.machineId);
  const serial = mac?.serial || '';
  const btu    = mac?.btu ? Number(mac.btu).toLocaleString()+' BTU' : '';
  const vendor = mac?.vendor || '';
  const isArrived    = t.purchaseOrder?.receiveStatus === 'received';
  const isPurchasing = t.purchaseOrder?.purchasing && !isArrived;
  const canAssign       = CU.role==='admin' && ['new','open'].includes(t.status);
  const canReassign     = CU.role==='admin' && ['assigned','accepted','inprogress','waiting_part'].includes(t.status);
  const canAccept       = CU.role==='tech' && t.assigneeId===CU.id && t.status==='assigned';
  const canStart        = false; // รับงาน = เริ่มซ่อมทันที ไม่มีปุ่มแยก
  const canComplete     = CU.role==='tech' && t.assigneeId===CU.id && (
    ['inprogress'].includes(t.status) ||
    (t.status==='waiting_part' && isArrived)
    ) && !(t.status==='waiting_part' && !isArrived);
  const canWaitPart     = CU.role==='tech' && t.assigneeId===CU.id && ['inprogress'].includes(t.status);
  const canVerify       = CU.role==='reporter' && t.reporterId===CU.id && t.status==='done';
  const canMarkPurchasing = CU.role==='admin' && t.status==='waiting_part' && !t.purchaseOrder?.purchasing && !isArrived;
  const canMarkArrived  = CU.role==='admin' && t.status==='waiting_part' && (t.purchaseOrder?.purchasing||t.purchaseOrder) && !isArrived;
  const canClose        = CU.role==='admin' && ['done','verified'].includes(t.status);
  const hasPics = (t.photosBefore?.length||0)+(t.photosAfter?.length||0)>0;
  // chatPartner: Tech↔Reporter ปกติ, Admin↔Tech สำหรับ waiting_part
  let chatPartnerId, chatPartner;
  if (t.status === 'waiting_part') {
    if (CU.role==='tech' && t.assigneeId===CU.id) {
      // ช่างคุยกับ Admin
      const adminUser = db.users.find(u=>u.role==='admin');
      chatPartnerId = adminUser?.id || null;
      chatPartner = adminUser || null;
    } else if (CU.role==='admin') {
      // Admin คุยกับช่าง
      chatPartnerId = t.assigneeId || null;
      chatPartner = chatPartnerId ? db.users.find(u=>u.id===chatPartnerId) : null;
    }
  } else {
    chatPartnerId = CU.role==='tech' ? t.reporterId : (CU.role==='reporter' ? t.assigneeId : null);
    chatPartner   = chatPartnerId ? db.users.find(u=>u.id===chatPartnerId) : null;
  }
  // นับข้อความที่ยังไม่ได้อ่านของ ticket นี้
  const chatKey = 'tk_' + t.id;
  const chatMsgs = db.chats?.[chatKey] || [];
  const chatUnread = chatMsgs.filter(m => m.uid !== CU.id).length;
  const accentColor   = sColor(t.status);

  // banner เมื่อ waiting_part
  if (t.status==='waiting_part' && !isArrived && CU.role==='tech') {
    // เพิ่ม hint ให้ช่าง
  }
  // ── PR Status badge สำหรับ tech ──
  const hasPO_data = !!(t.purchaseOrder);
  const prNumber   = t.purchaseOrder?.pr || '';
  // ── TechRequest status badge สำหรับ admin ──
  const trRows = t.techRequest?.rows||[];
  const trLocked = !!(t.techRequest?.locked); // ช่างส่งมาแล้วเท่านั้น
  const trComplete = trLocked && trRows.length>0 && trRows.every(r=>r.name?.trim()&&(r.qty||0)>=1&&(r.price||0)>0);
  const trIncomplete = trLocked && trRows.length>0 && !trComplete;
  const adminTechBadge = CU.role==='admin' && t.status==='waiting_part' && !hasPO_data && trLocked
    ? trComplete
      ? `<span style="display:inline-flex;align-items:center;gap:3px;font-size:0.6rem;font-weight:800;background:#f0fdf4;color:#166534;border:1px solid #86efac;border-radius:6px;padding:2px 8px">✅ ช่างกรอกครบ รอออก PR</span>`
      : `<span style="display:inline-flex;align-items:center;gap:3px;font-size:0.6rem;font-weight:800;background:#fef2f2;color:#b91c1c;border:1px solid #fca5a5;border-radius:6px;padding:2px 8px">⚠️ ข้อมูลช่างไม่ครบ</span>`
    : '';
  const prBadge = CU.role === 'tech' && t.status === 'waiting_part'
    ? isArrived
      ? `<span style="display:inline-flex;align-items:center;gap:3px;font-size:0.6rem;font-weight:800;background:linear-gradient(135deg,#dcfce7,#bbf7d0);color:#166534;border:1px solid #86efac;border-radius:6px;padding:2px 8px;letter-spacing:0.01em"><span style="width:5px;height:5px;border-radius:50%;background:#22c55e;flex-shrink:0"></span>📦 ได้รับของแล้ว</span>`
      : hasPO_data && prNumber
      ? `<span style="display:inline-flex;align-items:center;gap:3px;font-size:0.6rem;font-weight:800;background:linear-gradient(135deg,#fef9c3,#fde68a);color:#92400e;border:1px solid #fbbf24;border-radius:6px;padding:2px 8px;letter-spacing:0.01em"><span style="width:5px;height:5px;border-radius:50%;background:#f59e0b;flex-shrink:0"></span>📋 ออก PR แล้ว · ${prNumber}</span>`
      : hasPO_data
      ? `<span style="display:inline-flex;align-items:center;gap:3px;font-size:0.6rem;font-weight:800;background:linear-gradient(135deg,#fef9c3,#fde68a);color:#92400e;border:1px solid #fbbf24;border-radius:6px;padding:2px 8px;letter-spacing:0.01em"><span style="width:5px;height:5px;border-radius:50%;background:#f59e0b;flex-shrink:0"></span>📋 ออก PR แล้ว</span>`
      : `<span style="display:inline-flex;align-items:center;gap:3px;font-size:0.6rem;font-weight:800;background:linear-gradient(135deg,#fff0f2,#fecaca);color:#b91c1c;border:1px solid #fca5a5;border-radius:6px;padding:2px 8px;letter-spacing:0.01em"><span style="width:5px;height:5px;border-radius:50%;background:#ef4444;flex-shrink:0;animation:pulse 1.5s infinite"></span>⏳ ยังไม่ออก PR</span>`
    : '';

  const banner = isArrived && t.status === 'inprogress'
    ? `<div style="background:linear-gradient(135deg,#dcfce7,#bbf7d0);border-bottom:2px solid #86efac;padding:7px 12px;display:flex;align-items:center;justify-content:space-between;gap:6px">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0;box-shadow:0 0 0 3px rgba(34,197,94,0.3)"></span>
          <span style="font-size:0.65rem;font-weight:800;color:#14532d;letter-spacing:0.02em">📦 ของมาแล้ว — บันทึกผลซ่อมได้เลย!</span>
        </div>
        ${prNumber?`<span style="font-size:0.6rem;font-weight:800;color:#166534;background:#bbf7d0;border-radius:4px;padding:1px 6px">PR: ${prNumber}</span>`:''}
       </div>`
    : isArrived
    ? `<div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-bottom:1px solid #d1fae5;padding:5px 12px;display:flex;align-items:center;justify-content:space-between;gap:6px">
        <div style="display:flex;align-items:center;gap:5px">
          <span style="width:7px;height:7px;border-radius:50%;background:#22c55e;flex-shrink:0;box-shadow:0 0 0 2px #bbf7d0"></span>
          <span style="font-size:0.62rem;font-weight:700;color:#166534;letter-spacing:0.02em">📦 อะไหล่มาถึงแล้ว — พร้อมซ่อม</span>
        </div>
        ${prNumber?`<span style="font-size:0.58rem;font-weight:800;color:#166534;background:#bbf7d0;border-radius:4px;padding:1px 6px">PR: ${prNumber}</span>`:''}
       </div>`
    : isPurchasing
    ? `<div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border-bottom:1px solid #fde68a;padding:5px 12px;display:flex;align-items:center;justify-content:space-between;gap:6px">
        <div style="display:flex;align-items:center;gap:5px">
          <span style="width:7px;height:7px;border-radius:50%;background:#f59e0b;flex-shrink:0;box-shadow:0 0 0 2px #fef3c7"></span>
          <span style="font-size:0.62rem;font-weight:700;color:#92400e;letter-spacing:0.02em">📋 ออก PR แล้ว — รอรับของ</span>
        </div>
        ${prNumber?`<span style="font-size:0.58rem;font-weight:800;color:#92400e;background:#fde68a;border-radius:4px;padding:1px 6px">PR: ${prNumber}</span>`:''}
       </div>`
    : t.status === 'waiting_part' && !hasPO_data
    ? `<div style="background:linear-gradient(135deg,#fff0f2,#fecaca);border-bottom:1px solid #fca5a5;padding:5px 12px;display:flex;align-items:center;gap:5px">
        <span style="width:7px;height:7px;border-radius:50%;background:#ef4444;flex-shrink:0;box-shadow:0 0 0 2px #fecaca"></span>
        <span style="font-size:0.62rem;font-weight:700;color:#b91c1c;letter-spacing:0.02em">⏳ รออะไหล่ — ยังไม่ออก PR</span>
       </div>`
    : '';

  // ── skip cache in multi-select mode so checkbox state renders correctly ──
  if (_multiSelectMode) {
    const isSelected = _selectedTickets.has(t.id);
    const canSelectThis = !['closed','verified','done'].includes(t.status);
    const _baseHtml = _buildTkCardHtml(t, mac, serial, btu, vendor, isArrived, isPurchasing, canAssign, canReassign, canAccept, canStart, canComplete, canVerify, canClose, canMarkPurchasing, canMarkArrived, canWaitPart, chatPartner, chatPartnerId, chatUnread, accentColor, banner, prBadge, adminTechBadge, hasPics, prNumber, hasPO_data);
    if (canSelectThis) {
      return _baseHtml.replace(
        `<div class="tk-wrap" data-tid="${t.id}"`,
        `<div class="tk-wrap" data-tid="${t.id}" onclick="toggleTicketSelect('${t.id}',event)"`
      ).replace(
        `<!-- Main card -->`,
        `<!-- Checkbox -->
    <div class="tk-checkbox" style="position:absolute;top:10px;left:10px;z-index:10;width:22px;height:22px;border-radius:6px;border:2px solid ${isSelected?'#c8102e':'#cbd5e1'};background:${isSelected?'#c8102e':'white'};display:flex;align-items:center;justify-content:center;transition:all 0.15s;box-shadow:0 1px 4px rgba(0,0,0,0.12)">${isSelected?'<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="2 6 5 9 10 3"/></svg>':''}</div>
    <!-- Main card -->`
      ).replace(
        `border-radius:10px;overflow:hidden;box-shadow:none;position:relative;z-index:1`,
        `border-radius:10px;overflow:hidden;box-shadow:none;position:relative;z-index:1;outline:${isSelected?'2.5px solid #c8102e':'none'};outline-offset:-2px;padding-left:${isSelected?'0':'0'}`
      );
    }
    return _baseHtml;
  }

  const _html = _buildTkCardHtml(t, mac, serial, btu, vendor, isArrived, isPurchasing, canAssign, canReassign, canAccept, canStart, canComplete, canVerify, canClose, canMarkPurchasing, canMarkArrived, canWaitPart, chatPartner, chatPartnerId, chatUnread, accentColor, banner, prBadge, adminTechBadge, hasPics, prNumber, hasPO_data);
  _tkCardCache.set(t.id, { hash: _hash, html: _html });
  return _html;
}

function _buildTkCardHtml(t, mac, serial, btu, vendor, isArrived, isPurchasing, canAssign, canReassign, canAccept, canStart, canComplete, canVerify, canClose, canMarkPurchasing, canMarkArrived, canWaitPart, chatPartner, chatPartnerId, chatUnread, accentColor, banner, prBadge, adminTechBadge, hasPics, prNumber, hasPO_data) {
  const _html = `<div class="tk-wrap" data-tid="${t.id}" style="position:relative;margin-bottom:8px;border-radius:10px">
    <div class="tk-swipe-actions" style="position:absolute;right:0;top:0;bottom:0;display:flex;align-items:stretch;border-radius:0 10px 10px 0;overflow:hidden;z-index:0;max-width:0;transition:max-width 0.25s ease">
      ${canAccept ? `<button onclick="doAccept('${t.id}')" style="padding:0 16px;background:#1565c0;color:white;border:none;cursor:pointer;font-size:0.72rem;font-weight:800;font-family:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:64px">✋<span>รับงาน</span></button>` : ''}
      ${canStart ? `<button onclick="doStart('${t.id}')" style="padding:0 16px;background:#e65100;color:white;border:none;cursor:pointer;font-size:0.72rem;font-weight:800;font-family:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:64px">⚙️<span>เริ่มซ่อม</span></button>` : ''}
      ${canComplete ? `<button onclick="openCompleteSheet('${t.id}')" style="padding:0 16px;background:#15803d;color:white;border:none;cursor:pointer;font-size:0.72rem;font-weight:800;font-family:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:64px">✅<span>บันทึกผล</span></button>` : ''}
      ${canVerify ? `<button onclick="openVerifySheet('${t.id}')" style="padding:0 16px;background:#166534;color:white;border:none;cursor:pointer;font-size:0.72rem;font-weight:800;font-family:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:64px">🔵<span>ตรวจรับ</span></button>` : ''}
      ${canAssign ? `<button onclick="openAssignSheet('${t.id}')" style="padding:0 16px;background:#c8102e;color:white;border:none;cursor:pointer;font-size:0.72rem;font-weight:800;font-family:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:64px">👤<span>จ่ายงาน</span></button>` : ''}
      <button onclick="safeOpenDetail('${t.id}')" style="padding:0 14px;background:#334155;color:white;border:none;cursor:pointer;font-size:0.72rem;font-weight:800;font-family:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:52px">📋<span>ดู</span></button>
      ${CU&&CU.role==='admin' ? `<button onclick="deleteTicket('${t.id}')" style="padding:0 14px;background:#dc2626;color:white;border:none;cursor:pointer;font-size:0.72rem;font-weight:800;font-family:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:52px">🗑️<span>ลบ</span></button>` : ''}
    </div>
    <!-- Main card -->
    <div class="tk tk-swipeable" data-tid="${t.id}" style="border-left:3px solid ${accentColor};border-radius:10px;overflow:hidden;box-shadow:none;position:relative;z-index:1;transition:transform 0.25s ease;will-change:transform;touch-action:pan-y;background:white">
    <div class="tk-body" style="padding:0">
      ${banner}
      <div style="padding:8px 10px 5px" onclick="safeOpenDetail('${t.id}')">
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
          <span style="font-family:'JetBrains Mono',monospace;font-size:0.52rem;font-weight:700;color:#b0b8c4">${t.id}</span>
          <span style="width:1px;height:7px;background:#e2e8f0;flex-shrink:0"></span>
          <span class="tag ${stc(t.status)}" style="font-size:0.55rem;padding:1px 6px;border-radius:4px">${sTH(t.status)}</span>
          <span class="tag ${prC(t.priority)}" style="font-size:0.55rem;padding:1px 6px;border-radius:4px">${prTH(t.priority)}</span>
          ${hasPics?`<span style="font-size:0.65rem">📷 ${(t.photosBefore?.length||0)+(t.photosAfter?.length||0)}</span>`:''}
          ${t.rating?.score?`<span style="font-size:0.65rem;margin-left:auto;color:#f59e0b;font-weight:800">⭐${t.rating.score}</span>`:`<span style="flex:1"></span>`}
        </div>
        <div style="font-size:0.82rem;font-weight:700;color:#0f172a;line-height:1.3;margin-bottom:4px;cursor:pointer" onclick="safeOpenDetail('${t.id}')">${escapeHtml(t.problem)}</div>
        <div style="font-size:0.6rem;color:#64748b;display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding-bottom:6px;border-bottom:1px solid #f1f5f9">
          ${serial?`<span style="font-family:'JetBrains Mono',monospace;background:#e0f2fe;color:#0369a1;padding:0 5px;border-radius:3px;font-weight:700;font-size:0.58rem">${serial}</span>`:''}
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px">${t.machine}${mac?.location ? ` · ${mac.location}` : ''}</span>
          ${btu?`<span style="background:#fef9c3;color:#854d0e;padding:0 5px;border-radius:3px;font-weight:600;font-size:0.58rem">${btu}</span>`:''}
          ${vendor?`<span style="background:${vendorStyle(vendor).bg};color:${vendorStyle(vendor).color};border:1px solid ${vendorStyle(vendor).border};padding:0 5px;border-radius:3px;font-weight:700;font-size:0.58rem">🏢 ${vendor}</span>`:''}
          ${t.assignee?`<span style="margin-left:auto;color:#64748b;font-size:0.58rem">👷 ${t.assignee.split(' ')[0]}</span>`:`<span style="margin-left:auto;font-size:0.55rem;color:#cbd5e1">${(t.createdAt||'').substring(0,10)}</span>`}
        </div>
        ${prBadge||adminTechBadge?`<div style="padding:4px 0 2px;display:flex;gap:4px;flex-wrap:wrap">${prBadge}${adminTechBadge}</div>`:''}
        ${hasPics ? `<div style="display:flex;gap:4px;padding:6px 0 2px;overflow-x:auto">
          ${[...(t.photosBefore||[]).slice(0,2).map(p=>{
            if (!p) return '';
            const _isFsKey = p.startsWith('fs:');
            return `<div onclick="event.stopPropagation();${_isFsKey?`_resolveAndLightbox(this)`:`openLightbox('${p}')`}" data-photo-key="${p}" data-tid="${t.id}" style="position:relative;flex-shrink:0;cursor:pointer">
              <img src="${_isFsKey?'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7':p}" loading="lazy" decoding="async" style="width:52px;height:40px;object-fit:cover;border-radius:6px;border:1.5px solid #e5e7eb;${_isFsKey?'opacity:0':''}"/>
              ${_isFsKey?`<div class="_ph-spin" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:1rem">⏳</div>`:''}
              <div style="position:absolute;top:2px;left:2px;background:rgba(0,0,0,0.55);color:white;border-radius:3px;padding:0 4px;font-size:0.5rem;font-weight:700">ก่อน</div>
            </div>`;
          }),
          ...(t.photosAfter||[]).slice(0,2).map(p=>{
            if (!p) return '';
            const _isFsKey = p.startsWith('fs:');
            return `<div onclick="event.stopPropagation();${_isFsKey?`_resolveAndLightbox(this)`:`openLightbox('${p}')`}" data-photo-key="${p}" data-tid="${t.id}" style="position:relative;flex-shrink:0;cursor:pointer">
              <img src="${_isFsKey?'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7':p}" loading="lazy" decoding="async" style="width:52px;height:40px;object-fit:cover;border-radius:6px;border:1.5px solid #86efac;${_isFsKey?'opacity:0':''}"/>
              ${_isFsKey?`<div class="_ph-spin" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:1rem">⏳</div>`:''}
              <div style="position:absolute;top:2px;left:2px;background:rgba(22,163,74,0.75);color:white;border-radius:3px;padding:0 4px;font-size:0.5rem;font-weight:700">หลัง</div>
            </div>`;
          })
          ].join('')}
          ${(t.photosBefore?.length||0)+(t.photosAfter?.length||0) > 4 ? `<div onclick="event.stopPropagation();safeOpenDetail('${t.id}')" style="width:52px;height:40px;background:#f1f5f9;border-radius:6px;border:1.5px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.65rem;font-weight:700;color:#6b7280;flex-shrink:0">+${(t.photosBefore?.length||0)+(t.photosAfter?.length||0)-4}</div>` : ''}
        </div>` : ''}
      </div>
      ${CU.role==='executive' ? `
      <div class="tk-actions" style="padding:6px 12px 10px;gap:5px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-xs" style="font-size:0.63rem" onclick="safeOpenDetail('${t.id}')">ดู</button>
        ${['done','verified','closed'].includes(t.status)
          ? `<button class="btn btn-ghost btn-xs" style="color:#1d4ed8;border-color:#bfdbfe;background:#eff6ff;font-size:0.63rem" onclick="openQuotationByRole('${t.id}')">📄 รายงาน</button>`
          : ''}
      </div>` : (canAssign||canReassign||canAccept||canStart||canComplete||canVerify||canClose||canMarkPurchasing||canMarkArrived||canWaitPart||chatPartner||(CU.role==='tech'&&t.assigneeId===CU.id&&t.status==='waiting_part'))?`
      <div class="tk-actions" style="padding:6px 12px 10px;gap:5px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-xs" style="font-size:0.63rem" onclick="safeOpenDetail('${t.id}')">ดู</button>
        ${chatPartner?`<button class="btn btn-xs" style="position:relative;background:#e0f2fe;color:#0369a1;font-weight:700;font-size:0.63rem;border:none" onclick="openChat('${t.id}','${chatPartnerId}')">
          💬 ${t.status==='waiting_part'&&CU.role==='admin'?'ช่าง: ':t.status==='waiting_part'&&CU.role==='tech'?'Admin':''} ${chatPartner.name.split(' ')[0]}
          ${chatUnread>0?`<span style="position:absolute;top:-5px;right:-5px;background:#ef4444;color:white;font-size:0.55rem;font-weight:800;min-width:16px;height:16px;border-radius:99px;display:flex;align-items:center;justify-content:center;padding:0 3px;box-shadow:0 1px 3px rgba(0,0,0,0.3)">${chatUnread}</span>`:''}
        </button>`:''}
        ${canAssign?`<button class="btn btn-purple btn-xs" style="font-size:0.63rem" onclick="openAssignSheet('${t.id}')">จ่ายงาน</button>`:''}
        ${canReassign?`<button class="btn btn-ghost btn-xs" style="font-size:0.63rem" onclick="openAssignSheet('${t.id}')">เปลี่ยนช่าง</button>`:''}
        ${canAccept?`<button class="btn btn-xs" style="background:#1565c0;color:white;font-size:0.63rem" onclick="doAccept('${t.id}')">รับงาน</button>`:''}
        ${canStart?`<button class="btn btn-xs" style="background:#e65100;color:white;font-size:0.63rem" onclick="doStart('${t.id}')">เริ่มซ่อม</button>`:''}
        ${canWaitPart && !t.techRequest?`<button class="btn btn-xs" style="background:#e65100;color:white;font-size:0.63rem" onclick="openTechReqForm('${t.id}')">แจ้งสั่งซื้ออะไหล่</button>`:''}
        ${canWaitPart && t.techRequest && !t.techRequest.locked?`<button class="btn btn-xs" style="background:#f1f5f9;color:#64748b;font-size:0.63rem" onclick="openTechReqForm('${t.id}')">📋 รายการอะไหล่</button>`:''}
        ${canWaitPart && t.techRequest?.locked?`<span style="font-size:0.6rem;color:#92400e;padding:2px 8px;background:linear-gradient(135deg,#fef3c7,#fde68a);border:1px solid #fbbf24;border-radius:6px;font-weight:800">📋 ส่งรายการแล้ว · รอ Admin ออก PR</span>`:''}
        ${canComplete?`<button class="btn btn-ok btn-xs" style="font-size:0.63rem" onclick="openCompleteSheet('${t.id}')">บันทึกผล</button>`:''}
        ${CU.role==='tech' && t.assigneeId===CU.id && t.status==='waiting_part' && !isArrived
          ? `<span style="font-size:0.58rem;color:#92400e;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:2px 7px;font-weight:700">⏳ รอของมาก่อน</span>`
          : ''}
        ${canVerify?`<button class="btn btn-xs" style="background:#2e7d32;color:white;font-size:0.63rem" onclick="openVerifySheet('${t.id}')">ตรวจรับ</button>`:''}
        ${canClose?`<button class="btn btn-ghost btn-xs" style="font-size:0.63rem" onclick="doClose('${t.id}')">ปิดงาน</button>`:''}
        ${['done','verified','closed'].includes(t.status)
          ?`<button class="btn btn-ghost btn-xs" style="color:#1d4ed8;border-color:#bfdbfe;background:#eff6ff;font-size:0.63rem;display:flex;align-items:center;gap:3px" onclick="openQuotationByRole('${t.id}')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>📄 รายงาน</button>`
          : ''}
      </div>`:`<div class="tk-actions" style="padding:6px 12px 10px">
        <button class="btn btn-ghost btn-xs" style="font-size:0.63rem" onclick="safeOpenDetail('${t.id}')">ดูรายละเอียด</button>
        ${['done','verified','closed'].includes(t.status)
          ? `<button class="btn btn-ghost btn-xs" style="color:#1d4ed8;border-color:#bfdbfe;background:#eff6ff;font-size:0.63rem;display:flex;align-items:center;gap:3px" onclick="openQuotationByRole('${t.id}')"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>📄 รายงาน</button>`
          : ''}
      </div>`}
    </div>
  </div>
  </div>`;
  if (_tkCardCache.size >= 300) {
    _tkCardCache.delete(_tkCardCache.keys().next().value);
  }
  return _html;
}

// ============================================================
// ITEM 10: Repair History Page (ย้ายจาก index.html)
// ============================================================
window.openRepairHistoryPage = function() {
  const inp = document.getElementById('repairhist-input');
  if (inp) {
    inp.value = '';
    // reset readonly ทุกครั้งเปิด — ป้องกัน Android auto-focus keyboard
    inp.setAttribute('inputmode', 'none');
  }
  openSheet('repairhist');
  setTimeout(() => {
    renderRepairHistResults();
  }, 350);
};

window.renderRepairHistResults = function() {
  const q = (document.getElementById('repairhist-input')?.value || '').trim().toLowerCase();
  const el = document.getElementById('repairhist-results');
  if (!el) return;

  const statusColor = { done:'#f59e0b', verified:'#16a34a', closed:'#64748b',
    inprogress:'#8b5cf6', accepted:'#3b82f6', assigned:'#0891b2', new:'#ef4444' };
  const statusLabel = { done:'เสร็จแล้ว', verified:'ตรวจรับแล้ว', closed:'ปิดแล้ว',
    inprogress:'กำลังซ่อม', accepted:'รับงาน', assigned:'จ่ายงาน', new:'ใหม่' };

  // แสดงทุก status ใน list ล่าสุด, กรองแค่ done/verified/closed ตอนค้นหา
  const allTickets = (window.db?.tickets || [])
    .sort((a,b) => (b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));
  let tickets = allTickets.filter(t => ['done','verified','closed'].includes(t.status));

  if (!q) {
    // ไม่มี keyword — แสดง 20 รายการล่าสุด ทุก status
    const recent = allTickets.slice(0, 20);
    const doneCount = tickets.length;
    const totalCost = tickets.reduce((s,t)=>s+(parseFloat(t.cost)||0),0);
    el.innerHTML = `
      <div style="font-size:0.68rem;font-weight:800;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px;padding:0 2px;display:flex;align-items:center;justify-content:space-between">
        <span>รายการล่าสุด 20 งาน</span>
        <span style="color:#16a34a;font-weight:900">${doneCount} งานเสร็จ · ฿${totalCost.toLocaleString()}</span>
      </div>
      ${recent.map(t => renderRepairHistRow(t, statusColor, statusLabel)).join('')}`;
    return;
  }

  const filtered = tickets.filter(t =>
    (t.id||'').toLowerCase().includes(q) ||
    (t.machine||'').toLowerCase().includes(q) ||
    (t.problem||'').toLowerCase().includes(q) ||
    (t.assignee||'').toLowerCase().includes(q) ||
    (t.summary||'').toLowerCase().includes(q)
  );

  if (!filtered.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px 16px;color:#94a3b8"><div style="font-size:1.6rem;margin-bottom:6px">📭</div><div style="font-size:0.82rem;font-weight:700">ไม่พบผลลัพธ์</div></div>';
    return;
  }

  el.innerHTML = `
    <div style="font-size:0.68rem;font-weight:800;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px;padding:0 2px">พบ ${filtered.length} รายการ</div>
    ${filtered.slice(0,30).map(t => renderRepairHistRow(t, statusColor, statusLabel)).join('')}`;
};

function renderRepairHistRow(t, statusColor, statusLabel) {
  // XSS fix: escape user-supplied string fields before innerHTML interpolation
  const _e = (typeof escapeHtml === 'function') ? escapeHtml : (s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'));
  t = {...t, machine: _e(t.machine||''), problem: _e(t.problem||''), assignee: _e(t.assignee||''), summary: _e(t.summary||''), reporter: _e(t.reporter||'')};
  const cost = parseFloat(t.cost) || 0;
  const repairCost = parseFloat(t.repairCost) || 0;
  const partsCost = parseFloat(t.partsCost) || 0;
  const tech = t.assignee || '—';
  const date = (t.updatedAt||t.createdAt||'').substring(0,10);
  const sc = statusColor[t.status] || '#64748b';
  const sl = statusLabel[t.status] || t.status;
  const items = (t.repairItems||[]).map(i=>typeof i==='string'?i:(i.name||'')).filter(Boolean);
  return `<div onclick="closeSheet('repairhist');setTimeout(()=>safeOpenDetail('${t.id}'),220)"
    style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin-bottom:8px;cursor:pointer;transition:all 0.15s;-webkit-tap-highlight-color:transparent"
    onmousedown="this.style.background='#f8fafc'" onmouseup="this.style.background='white'">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:4px">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px">
          <span style="font-size:0.7rem;font-family:'JetBrains Mono',monospace;font-weight:900;color:#c8102e;background:#fff0f2;border-radius:4px;padding:1px 6px">${t.id}</span>
          <span style="font-size:0.62rem;font-weight:800;padding:1px 7px;border-radius:99px;background:${sc}18;color:${sc};border:1px solid ${sc}40">${sl}</span>
        </div>
        <div style="font-size:0.85rem;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px">${t.machine||'—'}</div>
        <div style="font-size:0.65rem;color:#94a3b8;margin-top:1px">${t.problem||'—'}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
        ${cost > 0 ? `<span style="font-size:0.7rem;font-weight:900;color:#16a34a">฿${cost.toLocaleString()}</span>` : ''}
        <span style="font-size:0.6rem;color:#94a3b8">${date}</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:5px;border-top:1px dashed #f1f5f9">
      <span style="font-size:0.65rem;color:#64748b;display:flex;align-items:center;gap:4px">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#c8102e" stroke-width="2.2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        ${tech}
      </span>
      ${repairCost > 0 ? `<span style="font-size:0.62rem;background:#eff6ff;color:#1d4ed8;border-radius:5px;padding:1px 6px;font-weight:700">🔧 ฿${repairCost.toLocaleString()}</span>` : ''}
      ${partsCost > 0 ? `<span style="font-size:0.62rem;background:#fffbeb;color:#92400e;border-radius:5px;padding:1px 6px;font-weight:700">🛒 ฿${partsCost.toLocaleString()}</span>` : ''}
      <button onclick="event.stopPropagation();if(typeof generateRepairPDF==='function')generateRepairPDF('${t.id}')" style="margin-left:auto;padding:4px 9px;background:#1a5276;color:white;border:none;border-radius:7px;font-size:0.62rem;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:3px">PDF</button>
    </div>
    ${items.length > 0 ? `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">${items.slice(0,4).map(i=>`<span style="font-size:0.6rem;background:#f1f5f9;color:#475569;border-radius:5px;padding:1px 6px">${i}</span>`).join('')}${items.length>4?`<span style="font-size:0.6rem;color:#94a3b8">+${items.length-4}</span>`:''}</div>` : ''}
    ${t.summary ? `<div style="margin-top:6px;padding:6px 9px;background:#f8fafc;border-radius:8px;font-size:0.68rem;color:#374151;line-height:1.5;border-left:3px solid #c8102e">${(t.summary).substring(0,150)}${t.summary.length>150?'…':''}</div>` : ''}
  </div>`;
}

window.filterRepairHistPage = function(q) {
  const inp = document.getElementById('repairhist-input');
  if (inp) inp.value = q;
  renderRepairHistResults();
};
