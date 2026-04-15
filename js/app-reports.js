let rptMonth = new Date().getMonth();
let rptYear  = new Date().getFullYear();
const RPT_GOAL = 20; // เป้าหมายงานเสร็จต่อเดือน (แก้ได้)

function reportPrevMonth() {
  rptMonth--;
  if (rptMonth < 0) { rptMonth = 11; rptYear--; }
  renderReport();
}
function reportNextMonth() {
  rptMonth++;
  if (rptMonth > 11) { rptMonth = 0; rptYear++; }
  renderReport();
}

let _rptDeptFilter = '';

function onRptDeptFilter(val) {
  _rptDeptFilter = val;
  renderReport();
}

// ════════════════════════════════════════════════
// HISTORY PAGE — งานซ่อมเสร็จทั้งหมด + PDF
// ════════════════════════════════════════════════
let _histPage = 0;
const HIST_PER_PAGE = 10;

function renderHistory() {
  const listEl  = document.getElementById('history-list');
  const pagerEl = document.getElementById('history-pager');
  const countEl = document.getElementById('history-count');
  if(!listEl) return;

  const kw = (document.getElementById('history-search')?.value||'').toLowerCase().trim();
  const dateFrom = document.getElementById('history-date-from')?.value || '';
  const dateTo   = document.getElementById('history-date-to')?.value   || '';
  const doneStatuses = ['done','verified','closed'];

  // filter: only done/verified/closed, optionally by keyword
  let tickets = (db.tickets||[]).filter(t => doneStatuses.includes(t.status));

  // Date range filter
  if(dateFrom) {
    const fromMs = new Date(dateFrom).getTime();
    tickets = tickets.filter(t => {
      const d = t.updatedAt || t.createdAt || '';
      return d && new Date(d.replace(' ','T')).getTime() >= fromMs;
    });
  }
  if(dateTo) {
    const toMs = new Date(dateTo).getTime() + 86399999; // end of day
    tickets = tickets.filter(t => {
      const d = t.updatedAt || t.createdAt || '';
      return d && new Date(d.replace(' ','T')).getTime() <= toMs;
    });
  }

  // Admin sees all; tech/reporter sees own
  if(CU.role === 'tech')     tickets = tickets.filter(t => t.assigneeId === CU.id);
  if(CU.role === 'reporter') tickets = tickets.filter(t => t.reporterId === CU.id);

  if(kw) tickets = tickets.filter(t =>
    (t.id||'').toLowerCase().includes(kw) ||
    (t.machine||'').toLowerCase().includes(kw) ||
    (t.problem||'').toLowerCase().includes(kw) ||
    (t.reporter||'').toLowerCase().includes(kw) ||
    (t.assignee||'').toLowerCase().includes(kw)
  );

  // dedup tickets by id (กัน Firebase merge ซ้ำ)
  const _seenTids = new Set();
  tickets = tickets.filter(t => { if (_seenTids.has(t.id)) return false; _seenTids.add(t.id); return true; });
  // sort newest first
  tickets.sort((a,b) => (b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));

  const total = tickets.length;
  const pages = Math.max(1, Math.ceil(total / HIST_PER_PAGE));
  if(_histPage >= pages) _histPage = pages - 1;

  const page = tickets.slice(_histPage * HIST_PER_PAGE, (_histPage+1) * HIST_PER_PAGE);

  // update count
  if(countEl) countEl.textContent = `ทั้งหมด ${total} รายการ`;

  // status map
  const stMap = {done:'✅ เสร็จแล้ว', verified:'🔵 ตรวจรับแล้ว', closed:'🔒 ปิดงาน'};
  const stColor = {done:'#15803d', verified:'#1d4ed8', closed:'#374151'};
  const stBg    = {done:'#f0fdf4', verified:'#eff6ff', closed:'#f8fafc'};

  const fmtDate = s => {
    if(!s) return '—';
    try { return new Date(s.replace(' ','T')).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}); }
    catch(e){ return s.slice(0,10); }
  };

  if(!page.length){
    listEl.innerHTML = `<div style="text-align:center;padding:40px 20px;color:var(--muted)">
      <div style="font-size:2.5rem;margin-bottom:10px">📭</div>
      <div style="font-size:0.88rem;font-weight:700">${kw ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีงานที่เสร็จสิ้น'}</div>
    </div>`;
    if(pagerEl) pagerEl.innerHTML = '';
    return;
  }

  listEl.innerHTML = page.map((t, idx) => {
    const globalIdx = _histPage * HIST_PER_PAGE + idx + 1;
    const st = t.status;
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--card);border:1.5px solid var(--border);border-radius:14px;margin-bottom:8px;transition:box-shadow 0.15s" onclick="openDetail('${t.id}')">
      <!-- No. -->
      <div style="width:28px;height:28px;background:${stBg[st]||'#f8fafc'};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:900;color:${stColor[st]||'#374151'};flex-shrink:0">${globalIdx}</div>
      <!-- Info -->
      <div style="flex:1;min-width:0">
        <div style="font-size:0.82rem;font-weight:800;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.machine||t.problem||'—'}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap">
          <span style="font-size:0.65rem;font-weight:700;color:#64748b;font-family:'JetBrains Mono',monospace">${t.id}</span>
          <span style="font-size:0.65rem;padding:1px 6px;border-radius:4px;background:${stBg[st]||'#f8fafc'};color:${stColor[st]||'#374151'};font-weight:700">${stMap[st]||st}</span>
          <span style="font-size:0.65rem;color:var(--muted)">${fmtDate(t.updatedAt||t.createdAt)}</span>
        </div>
        ${t.assignee ? `<div style="font-size:0.65rem;color:var(--muted);margin-top:2px">🔧 ${t.assignee}</div>` : ''}
        ${(()=>{ const rc=Number(t.repairCost||0); const pc=Number(t.partsCost||0); const po=Number(t.purchaseOrder?.total||0); const lc=(!rc&&!pc)?Number(t.cost||0):0;
          const parts = [
            rc>0?`<span style="background:#eff6ff;color:#0369a1;border-radius:5px;padding:1px 7px;font-size:0.6rem;font-weight:700">🔧฿${rc.toLocaleString()}</span>`:'',
            pc>0?`<span style="background:#fff7ed;color:#c2410c;border-radius:5px;padding:1px 7px;font-size:0.6rem;font-weight:700">📦฿${pc.toLocaleString()}</span>`:
              (po>0&&!rc?`<span style="background:#fff7ed;color:#c2410c;border-radius:5px;padding:1px 7px;font-size:0.6rem;font-weight:700">📦PO฿${po.toLocaleString()}</span>`:''),
          ].filter(Boolean);
          return parts.length?`<div style="display:flex;gap:5px;margin-top:4px;flex-wrap:wrap">${parts.join('')}</div>`:'';
        })()}
      </div>
      <!-- Right: cost + PDF -->
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
        ${Number(t.cost||0)>0?`<span style="font-size:0.85rem;font-weight:900;color:#c8102e;font-family:'JetBrains Mono',monospace">฿${Number(t.cost).toLocaleString()}</span>`:''}
        <button onclick="event.stopPropagation();openQuotationByRole('${t.id}')"
          style="padding:5px 10px;background:#0f172a;color:white;border:none;border-radius:8px;font-family:inherit;font-size:0.7rem;font-weight:800;cursor:pointer;white-space:nowrap">
          📄 PDF
        </button>
      </div>
    </div>`;
  }).join('');

  // pagination
  if(pagerEl){
    let pagerHtml = '';
    const btnStyle = (active, disabled) =>
      `style="padding:6px 12px;border-radius:8px;border:1.5px solid ${active?'#1a5276':disabled?'#e2e8f0':'#e2e8f0'};background:${active?'#1a5276':'white'};color:${active?'white':disabled?'#cbd5e1':'#374151'};font-family:inherit;font-size:0.75rem;font-weight:700;cursor:${disabled?'default':'pointer'};min-width:36px"`;

    pagerHtml += `<button ${btnStyle(false,_histPage===0)} onclick="if(${_histPage}>0){_histPage--;renderHistory()}" ${_histPage===0?'disabled':''}>‹</button>`;

    // show max 5 page buttons
    const start = Math.max(0, _histPage - 2);
    const end   = Math.min(pages - 1, start + 4);
    for(let i = start; i <= end; i++){
      pagerHtml += `<button ${btnStyle(i===_histPage,false)} onclick="_histPage=${i};renderHistory()">${i+1}</button>`;
    }

    pagerHtml += `<button ${btnStyle(false,_histPage>=pages-1)} onclick="if(${_histPage}<${pages-1}){_histPage++;renderHistory()}" ${_histPage>=pages-1?'disabled':''}>›</button>`;
    pagerHtml += `<span style="font-size:0.7rem;color:var(--muted);margin-left:4px">${_histPage+1}/${pages}</span>`;
    pagerEl.innerHTML = pagerHtml;
  }
}

// ── Report Tab switcher ──
function switchReportTab(tab) {
  const summary = document.getElementById('rpt-panel-summary');
  const history = document.getElementById('rpt-panel-history');
  const btnS    = document.getElementById('rpt-tab-summary');
  const btnH    = document.getElementById('rpt-tab-history');
  if(!summary||!history) return;

  if(tab === 'history'){
    summary.style.display = 'none';
    history.style.display = 'block';
    if(btnS){ btnS.style.color='#94a3b8'; btnS.style.borderBottomColor='transparent'; btnS.style.fontWeight='700'; }
    if(btnH){ btnH.style.color='#c8102e'; btnH.style.borderBottomColor='#c8102e'; btnH.style.fontWeight='900'; }
    renderHistory();
  } else {
    summary.style.display = 'block';
    history.style.display = 'none';
    if(btnS){ btnS.style.color='#c8102e'; btnS.style.borderBottomColor='#c8102e'; btnS.style.fontWeight='900'; }
    if(btnH){ btnH.style.color='#94a3b8'; btnH.style.borderBottomColor='transparent'; btnH.style.fontWeight='700'; }
  }
}

function renderReport() {
  const lbl = document.getElementById('rpt-month-label');
  if (lbl) lbl.textContent = MONTH_TH[rptMonth] + ' ' + (rptYear+543);

  // Populate dept dropdown
  const deptSel = document.getElementById('rpt-dept-filter');
  if (deptSel) {
    deptSel.innerHTML = '<option value="">— ทุกแผนก —</option>';
    const depts = [...new Set((db.machines||[]).map(m => m.dept||m.location||'').filter(Boolean))].sort();
    depts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = d;
      deptSel.appendChild(opt);
    });
    deptSel.value = _rptDeptFilter;
  }

  // กรองงานของเดือนนี้ (ตาม updatedAt หรือ createdAt)
  let T = db.tickets || [];

  // filter by dept via machine
  if (_rptDeptFilter) {
    const machIds = new Set((db.machines||[]).filter(m => (m.dept||m.location||'') === _rptDeptFilter).map(m => m.id));
    T = T.filter(t => machIds.has(t.machineId));
  }

  const monthTickets = T.filter(t => {
    const d = new Date(t.createdAt||t.updatedAt||'');
    return d.getFullYear()===rptYear && d.getMonth()===rptMonth;
  });
  const allActive   = T.filter(t => !['closed','verified','done'].includes(t.status));
  const done        = monthTickets.filter(t => ['done','verified','closed'].includes(t.status));
  const monthActive = monthTickets.filter(t => !['done','verified','closed'].includes(t.status));
  const pending     = allActive;
  const inprog      = T.filter(t => t.status==='inprogress');
  const waitP       = T.filter(t => t.status==='waiting_part');
  const highP       = allActive.filter(t => t.priority==='high');

  renderRptKPI(monthTickets.length, done.length, monthActive.length);
  renderRptCostMonthly();
  renderRptCostByDept(T, _rptDeptFilter);
  renderRptGoal(done.length);
  renderRptPending(pending, inprog, waitP, highP);
  renderRptTech(monthTickets);
  renderRptProblems(monthTickets);
  renderRptPriority(monthTickets);
}

function renderRptCostMonthly() {
  const el = document.getElementById('rpt-cost-monthly');
  if (!el) return;

  const allT = (db.tickets||[]).filter(t =>
    Number(t.cost||0)>0 || Number(t.repairCost||0)>0 || Number(t.partsCost||0)>0
  );
  if (!allT.length) {
    el.innerHTML = '<div style="font-size:0.82rem;color:#94a3b8;text-align:center;padding:20px">ยังไม่มีข้อมูลค่าใช้จ่าย</div>';
    return;
  }

  // 12 เดือนล่าสุด รวมเดือนปัจจุบัน
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(),
      label: MONTH_TH[d.getMonth()].slice(0,3) + "'" + String(d.getFullYear()+543).slice(2) });
  }

  const monthData = months.map(m => {
    const tks = allT.filter(t => {
      const d = new Date(t.updatedAt || t.createdAt || '');
      return d.getFullYear()===m.year && d.getMonth()===m.month;
    });
    const repair = tks.reduce((s,t) => {
      const rc=Number(t.repairCost||0), pc=Number(t.partsCost||0);
      const po=Number(t.purchaseOrder?.total||0), tc=Number(t.cost||0);
      if (rc>0||pc>0) return s+rc;
      if (po>0) return s;
      return s+tc;
    }, 0);
    const parts = tks.reduce((s,t) => {
      const rc=Number(t.repairCost||0), pc=Number(t.partsCost||0);
      const po=Number(t.purchaseOrder?.total||0);
      if (rc>0||pc>0) return s+Math.max(pc,po);
      if (po>0) return s+po;
      return s;
    }, 0);
    return { ...m, repair, parts, total: repair+parts, count: tks.length };
  });

  const maxVal      = Math.max(...monthData.map(m => m.total), 1);
  const grandTotal  = monthData.reduce((s,m) => s+m.total, 0);
  const grandRepair = monthData.reduce((s,m) => s+m.repair, 0);
  const grandParts  = monthData.reduce((s,m) => s+m.parts, 0);
  const curIdx      = monthData.findIndex(m => m.year===now.getFullYear() && m.month===now.getMonth());

  // ── Compact executive-style SVG (6 เดือนล่าสุด เพื่อให้กะทัดรัด) ──
  const last6   = monthData.slice(-6);
  const max6    = Math.max(...last6.map(m => m.total), 1);
  // SVG dimensions — เพิ่มความสูงเพื่อให้มีพื้นที่แสดงตัวเลขบนแท่ง
  const VW=280, VH=100, PL=0, PR=0, PT=18, PB=18;
  const cW=VW-PL-PR, cH=VH-PT-PB;
  const slotW = cW/6;
  const gap=2, bW=Math.max(Math.floor((slotW-gap*3)/2), 4);

  const _fmtK = v => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'K' : v > 0 ? v.toLocaleString() : '';

  const bars6 = last6.map((m,i) => {
    const sx=PL+i*slotW;
    const xR=sx+gap;
    const xP=sx+gap+bW+gap;
    const yB=PT+cH;
    const isCur=(i===5); // last slot = current month
    const rH=m.repair>0?Math.max(Math.round(m.repair/max6*cH),3):2;
    const pH=m.parts>0?Math.max(Math.round(m.parts/max6*cH),2):2;
    const rCol=isCur?'#1d4ed8':'#bfdbfe';
    const pCol=isCur?'#ea580c':'#fed7aa';
    let o='';
    o+=`<rect x="${xR}" y="${yB-rH}" width="${bW}" height="${rH}" rx="2" fill="${rCol}"/>`;
    o+=`<rect x="${xP}" y="${yB-pH}" width="${bW}" height="${pH}" rx="2" fill="${pCol}"/>`;

    // ── ตัวเลขยอดรวมเหนือแท่ง (เฉพาะเดือนที่มีข้อมูล) ──
    if (m.total > 0) {
      const hi = Math.max(rH, pH);
      const labelX = sx + slotW/2;
      const labelY = yB - hi - 3;
      const labelVal = _fmtK(m.total);
      const fontW = isCur ? 700 : 500;
      const fontCol = isCur ? '#0f172a' : '#64748b';
      o+=`<text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="6.5" font-weight="${fontW}" fill="${fontCol}">${labelVal}</text>`;
    }

    o+=`<rect x="${sx}" y="${PT}" width="${slotW}" height="${cH+2}" fill="transparent" style="cursor:pointer" onclick="openCostMonthDrill(${m.year},${m.month},'${m.label}')"><title>${m.label}: ค่าแรง ฿${m.repair.toLocaleString()} | อะไหล่ ฿${m.parts.toLocaleString()}</title></rect>`;
    return o;
  }).join('');

  const xlabels6 = last6.map((m,i) => {
    const x=PL+i*slotW+slotW/2, isCur=(i===5);
    return `<text x="${x}" y="${VH-2}" text-anchor="middle" font-size="6.5" font-weight="${isCur?900:400}" fill="${isCur?'#c8102e':'#94a3b8'}">${m.label}</text>`;
  }).join('');

  // current month data
  const cur = monthData[curIdx] || { repair:0, parts:0, total:0, count:0 };
  const repPct = cur.total>0 ? Math.round(cur.repair/cur.total*100) : 0;
  const parPct = cur.total>0 ? Math.round(cur.parts/cur.total*100) : 0;

  el.innerHTML = `
    <!-- ── Header row ── -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:26px;height:26px;border-radius:8px;background:#f5f3ff;display:flex;align-items:center;justify-content:center;font-size:0.78rem">📈</div>
        <div>
          <div style="font-size:0.82rem;font-weight:900;color:#0f172a">ค่าใช้จ่ายรายเดือน</div>
          <div style="font-size:0.55rem;color:#94a3b8">6 เดือนล่าสุด · แตะแท่งดูรายละเอียด</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:0.92rem;font-weight:900;color:#c8102e">฿${_fmtK(grandTotal)}</div>
        <div style="font-size:0.52rem;color:#94a3b8">รวม 12 เดือน</div>
      </div>
    </div>

    <!-- ── 2 KPI pills ── -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:8px 10px">
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
          <div style="width:8px;height:8px;border-radius:2px;background:#1d4ed8;flex-shrink:0"></div>
          <span style="font-size:0.58rem;color:#1d4ed8;font-weight:800">🔧 ค่าแรง (Price List)</span>
        </div>
        <div style="font-size:0.88rem;font-weight:900;color:#1d4ed8">${grandRepair>0?'฿'+_fmtK(grandRepair):'—'}</div>
        <div style="font-size:0.55rem;color:#64748b;margin-top:1px">${grandTotal>0?Math.round(grandRepair/grandTotal*100)+'% ของทั้งหมด':''}</div>
      </div>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 10px">
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px">
          <div style="width:8px;height:8px;border-radius:2px;background:#ea580c;flex-shrink:0"></div>
          <span style="font-size:0.58rem;color:#ea580c;font-weight:800">📦 สั่งซื้ออะไหล่ (PO)</span>
        </div>
        <div style="font-size:0.88rem;font-weight:900;color:#ea580c">${grandParts>0?'฿'+_fmtK(grandParts):'—'}</div>
        <div style="font-size:0.55rem;color:#64748b;margin-top:1px">${grandTotal>0?Math.round(grandParts/grandTotal*100)+'% ของทั้งหมด':''}</div>
      </div>
    </div>

    <!-- ── Compact dual bar chart (6 months) ── -->
    <div style="background:#f8fafc;border-radius:12px;padding:8px 6px 2px;margin-bottom:8px">
      <svg viewBox="0 0 ${VW} ${VH}" width="100%" style="display:block;overflow:visible">
        ${bars6}
        ${xlabels6}
      </svg>
    </div>

    <!-- ── Legend ── -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;padding:0 2px">
      <div style="display:flex;align-items:center;gap:4px">
        <div style="width:12px;height:8px;border-radius:2px;background:linear-gradient(90deg,#1d4ed8,#bfdbfe)"></div>
        <span style="font-size:0.6rem;color:#1d4ed8;font-weight:700">ค่าแรงซ่อม</span>
      </div>
      <div style="display:flex;align-items:center;gap:4px">
        <div style="width:12px;height:8px;border-radius:2px;background:linear-gradient(90deg,#ea580c,#fed7aa)"></div>
        <span style="font-size:0.6rem;color:#ea580c;font-weight:700">ค่าสั่งซื้อ/อะไหล่</span>
      </div>
      <span style="font-size:0.52rem;color:#cbd5e1;margin-left:auto">แตะดูรายละเอียด</span>
    </div>

    <!-- ── Current month breakdown bar ── -->
    ${cur.total > 0 ? `
    <div style="background:white;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:0.65rem;font-weight:800;color:#0f172a">เดือนนี้</span>
        <span style="font-size:0.78rem;font-weight:900;color:#c8102e">฿${cur.total.toLocaleString()}</span>
      </div>
      <div style="background:#f1f5f9;border-radius:99px;height:7px;overflow:hidden;display:flex;margin-bottom:5px">
        <div style="height:100%;width:${repPct}%;background:#1d4ed8;border-radius:99px 0 0 99px;transition:width 0.5s"></div>
        <div style="height:100%;width:${parPct}%;background:#ea580c;transition:width 0.5s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.58rem;color:#64748b">
        <span>🔧 ฿${cur.repair.toLocaleString()} (${repPct}%)</span>
        <span>📦 ฿${cur.parts.toLocaleString()} (${parPct}%)</span>
      </div>
    </div>` : ''}

    <!-- ── Top months list ── -->
    <div style="border-top:1px solid #f1f5f9;padding-top:8px">
      ${monthData.filter(m=>m.total>0).sort((a,b)=>b.total-a.total).slice(0,4).map(m => {
        const pct=Math.round(m.total/grandTotal*100);
        const barPct=Math.round(m.total/maxVal*100);
        const repW=m.total>0?Math.round(m.repair/m.total*100):0;
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f8fafc;cursor:pointer"
          onclick="openCostMonthDrill(${m.year},${m.month},'${m.label}')">
          <div style="min-width:56px">
            <div style="font-size:0.7rem;font-weight:800;color:#0f172a">${MONTH_TH[m.month].slice(0,3)} ${m.year+543}</div>
            <div style="font-size:0.55rem;color:#94a3b8;margin-top:1px">${m.count} งาน</div>
          </div>
          <div style="flex:1">
            <div style="background:#f1f5f9;border-radius:99px;height:6px;overflow:hidden;display:flex">
              <div style="height:100%;width:${barPct*repW/100}%;background:#3b82f6;border-radius:99px 0 0 99px;transition:width 0.5s"></div>
              <div style="height:100%;width:${barPct*(100-repW)/100}%;background:#f97316;transition:width 0.5s"></div>
            </div>
          </div>
          <div style="text-align:right;min-width:60px">
            <div style="font-size:0.72rem;font-weight:900;color:#c8102e">฿${_fmtK(m.total)}</div>
            <div style="font-size:0.52rem;color:#94a3b8">${pct}%</div>
          </div>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>`;
      }).join('')}
    </div>`;
}


function openCostMonthDrill(year, month, label) {
  const tickets = (db.tickets||[]).filter(t => {
    if (!Number(t.cost||0)) return false;
    const d = new Date(t.updatedAt||t.createdAt||'');
    return d.getFullYear()===year && d.getMonth()===month;
  }).sort((a,b) => Number(b.cost||0)-Number(a.cost||0));

  const totalCost = tickets.reduce((s,t)=>s+Number(t.cost||0),0);
  // ถ้ามีการแยก repairCost/partsCost ใช้นั้น ถ้าไม่มีถือว่าเป็น partsCost (สั่งซื้อ)
  const totalRepair = tickets.reduce((s,t)=>{
    const rc=Number(t.repairCost||0), pc=Number(t.partsCost||0);
    const po=Number(t.purchaseOrder?.total||0), tc=Number(t.cost||0);
    if (rc>0||pc>0) return s+rc;
    if (po>0) return s;
    return s+tc; // ไม่มีอะไร = ค่าแรงทั้งหมด
  },0);
  const totalParts = tickets.reduce((s,t)=>{
    const rc=Number(t.repairCost||0), pc=Number(t.partsCost||0);
    const po=Number(t.purchaseOrder?.total||0);
    if (rc>0||pc>0) return s+pc;
    if (po>0) return s+po;
    return s;
  },0);
  const totalLegacy = 0;

  // สร้าง overlay sheet
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end';
  ov.onclick = e => { if(e.target===ov) ov.remove(); };

  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:#f8fafc;border-radius:24px 24px 0 0;width:100%;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;animation:slideUp 0.25s cubic-bezier(0.32,0.72,0,1)';

  sheet.innerHTML = `
    <div style="background:linear-gradient(160deg,#1a0a0e,#7f1d1d,#c8102e);padding:16px 16px 14px;flex-shrink:0">
      <div style="width:36px;height:4px;background:rgba(255,255,255,0.3);border-radius:2px;margin:0 auto 12px"></div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="color:white;font-size:1rem;font-weight:900">💰 ${MONTH_TH[month]} ${year+543}</div>
          <div style="color:rgba(255,255,255,0.55);font-size:0.65rem;margin-top:2px">${tickets.length} งาน · รวม ฿${totalCost.toLocaleString()}</div>
        </div>
        <button onclick="this.closest('[style*=fixed]').remove()" style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.15);border:none;color:white;font-size:1.2rem;cursor:pointer">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
        <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:8px 10px">
          <div style="font-size:0.55rem;color:rgba(255,255,255,0.5);font-weight:700;text-transform:uppercase;margin-bottom:2px">🔧 ค่าแรงซ่อม</div>
          <div style="font-size:0.95rem;font-weight:900;color:white">${(totalRepair+totalLegacy)>0?'฿'+(totalRepair+totalLegacy).toLocaleString():'—'}</div>
          <div style="font-size:0.55rem;color:rgba(255,255,255,0.4);margin-top:1px">จาก Price List</div>
        </div>
        <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:8px 10px">
          <div style="font-size:0.55rem;color:rgba(255,255,255,0.5);font-weight:700;text-transform:uppercase;margin-bottom:2px">📦 ค่าสั่งซื้อ</div>
          <div style="font-size:0.95rem;font-weight:900;color:white">${totalParts>0?'฿'+totalParts.toLocaleString():'—'}</div>
          <div style="font-size:0.55rem;color:rgba(255,255,255,0.4);margin-top:1px">จาก PO/PR</div>
        </div>
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:12px 14px 24px">
      ${tickets.length===0 ? '<div style="text-align:center;padding:32px;color:#94a3b8;font-size:0.85rem">ไม่มีข้อมูล</div>' :
        tickets.map(t => {
          const m = getMacMap().get(t.machineId);
          const dept = m?.dept || m?.location || t.dept || '';
          const rc = Number(t.repairCost||0);
          const pc = Number(t.partsCost||0);
          const tc = Number(t.cost||0);
          return `<div onclick="ov.remove();setTimeout(()=>openDetail('${t.id}'),200)"
            style="background:white;border-radius:14px;padding:13px 14px;margin-bottom:8px;cursor:pointer;border:1.5px solid #e5e7eb;display:flex;align-items:center;gap:10px;transition:all 0.15s"
            onmousedown="this.style.background='#f8fafc'" onmouseup="this.style.background='white'">
            <div style="flex:1;min-width:0">
              <div style="font-size:0.65rem;color:#94a3b8;font-family:monospace;margin-bottom:2px">${t.id}</div>
              <div style="font-size:0.85rem;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.problem)}</div>
              <div style="font-size:0.68rem;color:#64748b;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">❄️ ${t.machine||''}${dept?' · '+dept:''}</div>
              ${(()=>{ 
                const po = Number(t.purchaseOrder?.total||0);
                const showPO = !pc && po > 0;
                return (rc||pc||showPO) ? `<div style="display:flex;gap:6px;margin-top:5px;flex-wrap:wrap">
                  ${rc?`<span style="background:#eff6ff;color:#0369a1;border-radius:6px;padding:1px 7px;font-size:0.6rem;font-weight:700">🔧 ฿${rc.toLocaleString()}</span>`:''}
                  ${pc?`<span style="background:#fff7ed;color:#c2410c;border-radius:6px;padding:1px 7px;font-size:0.6rem;font-weight:700">📦 ฿${pc.toLocaleString()}</span>`:''}
                  ${showPO?`<span style="background:#fff7ed;color:#c2410c;border-radius:6px;padding:1px 7px;font-size:0.6rem;font-weight:700">📦 PO ฿${po.toLocaleString()}</span>`:''}
                </div>` : '';
              })()}
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:0.92rem;font-weight:900;color:#c8102e;font-family:'JetBrains Mono',monospace">฿${tc.toLocaleString()}</div>
              <div style="margin-top:4px"><span class="tag ${stc(t.status)}" style="font-size:0.58rem;padding:1px 6px">${sTH(t.status)}</span></div>
            </div>
          </div>`;
        }).join('')
      }
    </div>`;

  ov.appendChild(sheet);
  document.body.appendChild(ov);
}

function renderRptCostByDept(tickets, deptFilter) {
  const el = document.getElementById('rpt-cost');
  if (!el) return;
  const withCost = tickets.filter(t => Number(t.cost||0) > 0 || Number(t.repairCost||0) > 0 || Number(t.partsCost||0) > 0);
  if (!withCost.length) {
    el.innerHTML = '<div style="font-size:0.82rem;font-weight:700;color:#94a3b8;text-align:center;padding:8px">ยังไม่มีข้อมูลค่าใช้จ่าย</div>';
    return;
  }
  const deptData = {};
  withCost.forEach(t => {
    const m = getMacMap().get(t.machineId);
    const dept = m?.dept || m?.location || 'ไม่ระบุแผนก';
    if (!deptData[dept]) deptData[dept] = {repair:0, parts:0};
    const rc = Number(t.repairCost||0);
    const pc = Number(t.partsCost||0);
    const po = Number(t.purchaseOrder?.total||0);
    const tc = Number(t.cost||0);
    if (rc > 0 || pc > 0) {
      // มีการแยกชัดเจน
      deptData[dept].repair += rc;
      deptData[dept].parts  += pc || po;
    } else if (po > 0) {
      // มี PO แต่ยังไม่ migrate — ทั้งหมดเป็นค่าอะไหล่
      deptData[dept].parts  += po;
    } else {
      // ไม่มีข้อมูลแยก — ใช้ cost ทั้งหมด เป็น repair
      deptData[dept].repair += tc;
    }
  });
  const totalRepair = Object.values(deptData).reduce((s,v)=>s+v.repair,0);
  const totalParts  = Object.values(deptData).reduce((s,v)=>s+v.parts,0);
  const totalCost   = totalRepair + totalParts;
  const sorted = Object.entries(deptData).sort((a,b)=>(b[1].repair+b[1].parts)-(a[1].repair+a[1].parts));
  const maxVal = Math.max(...sorted.map(([,v])=>v.repair+v.parts),1);
  el.innerHTML = `
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div>
        <div style="font-size:0.88rem;font-weight:900;color:#0f172a">💰 ค่าใช้จ่ายตามแผนก</div>
        <div style="font-size:0.62rem;color:#94a3b8;margin-top:2px">รวมทุกงาน · แยกค่าแรง / ค่าอะไหล่</div>
      </div>
      <div style="font-size:1rem;font-weight:900;color:#c8102e">฿${totalCost.toLocaleString()}</div>
    </div>

    <!-- inline summary (compact) -->
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      ${totalRepair>0?`<span style="background:#eff6ff;color:#1d4ed8;border-radius:8px;padding:4px 10px;font-size:0.68rem;font-weight:800">🔧 ค่าแรง ฿${totalRepair.toLocaleString()}</span>`:''}
      ${totalParts>0?`<span style="background:#fff7ed;color:#c2410c;border-radius:8px;padding:4px 10px;font-size:0.68rem;font-weight:800">📦 ค่าสั่งซื้อ ฿${totalParts.toLocaleString()}</span>`:''}
    </div>

    <!-- Dept rows -->
    <div style="border-top:1px solid #f1f5f9;padding-top:10px">
      ${sorted.map(([dept,v]) => {
        const total=v.repair+v.parts;
        const pct=Math.round(total/totalCost*100);
        const barW=Math.round(total/maxVal*100);
        const repW=total>0?Math.round(v.repair/total*100):0;
        return `<div style="margin-bottom:12px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
            <span style="font-size:0.75rem;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%">${dept}</span>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
              ${v.repair>0?`<span style="font-size:0.62rem;color:#0369a1;font-weight:700">🔧฿${v.repair.toLocaleString()}</span>`:''}
              ${v.parts>0?`<span style="font-size:0.62rem;color:#c2410c;font-weight:700">📦฿${v.parts.toLocaleString()}</span>`:''}
              <span style="font-size:0.7rem;font-weight:900;color:#c8102e">฿${total.toLocaleString()}</span>
              <span style="font-size:0.58rem;color:#94a3b8">${pct}%</span>
            </div>
          </div>
          <div style="background:#f1f5f9;border-radius:99px;height:7px;overflow:hidden;display:flex">
            <div style="height:100%;width:${barW*repW/100}%;background:#3b82f6;transition:width 0.6s;border-radius:99px 0 0 99px"></div>
            <div style="height:100%;width:${barW*(100-repW)/100}%;background:#f97316;transition:width 0.6s"></div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <!-- legend -->
    <div style="display:flex;gap:10px;margin-top:4px">
      <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:#3b82f6"></div><span style="font-size:0.6rem;color:#64748b">ค่าแรง</span></div>
      <div style="display:flex;align-items:center;gap:4px"><div style="width:8px;height:8px;border-radius:2px;background:#f97316"></div><span style="font-size:0.6rem;color:#64748b">ค่าอะไหล่</span></div>
    </div>`;
}


function renderRptKPI(total, done, pending) {
  const el = document.getElementById('rpt-kpi');
  if (!el) return;
  const rate    = total > 0 ? Math.round(done/total*100) : 0;
  const inprog  = Math.max(0, total - done - pending);
  const rateColor = rate>=80?'#22c55e':rate>=50?'#f59e0b':'#f87171';
  const rateBg    = rate>=80?'rgba(34,197,94,0.15)':rate>=50?'rgba(245,158,11,0.15)':'rgba(248,113,113,0.15)';
  const circ = 2*Math.PI*30; // r=30

  el.innerHTML = `
    <!-- ═══ Hero Banner ═══ -->
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1a2744 55%,#0f172a 100%);border-radius:20px;padding:0;margin-bottom:10px;overflow:hidden;position:relative">
      <!-- decorative blobs -->
      <div style="position:absolute;right:-30px;top:-30px;width:140px;height:140px;border-radius:50%;background:rgba(200,16,46,0.12)"></div>
      <div style="position:absolute;left:-20px;bottom:-20px;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,0.03)"></div>

      <!-- top row -->
      <div style="display:flex;align-items:stretch;position:relative">
        <!-- left: total -->
        <div style="flex:1;padding:20px 18px 14px;border-right:1px solid rgba(255,255,255,0.07)">
          <div style="font-size:0.6rem;color:rgba(255,255,255,0.45);font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">งานทั้งหมดเดือนนี้</div>
          <div style="display:flex;align-items:baseline;gap:6px">
            <div style="font-size:3.8rem;font-weight:900;color:white;line-height:1">${total}</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.4);font-weight:600">ใบงาน</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:10px">
            <div style="flex:1;background:rgba(255,255,255,0.1);border-radius:99px;height:4px;overflow:hidden">
              <div style="height:100%;width:${rate}%;background:${rateColor};border-radius:99px;transition:width 0.8s cubic-bezier(0.4,0,0.2,1)"></div>
            </div>
            <div style="font-size:0.68rem;font-weight:800;color:${rateColor};white-space:nowrap">${rate}% สำเร็จ</div>
          </div>
        </div>
        <!-- right: circular progress -->
        <div style="padding:16px 20px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:100px">
          <div style="position:relative;width:80px;height:80px">
            <svg width="80" height="80" viewBox="0 0 80 80" style="transform:rotate(-90deg)">
              <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8"/>
              <circle cx="40" cy="40" r="30" fill="none" stroke="${rateColor}" stroke-width="8"
                stroke-dasharray="${(rate/100*circ).toFixed(2)} ${circ.toFixed(2)}"
                stroke-linecap="round" style="transition:stroke-dasharray 0.8s ease;filter:drop-shadow(0 0 6px ${rateColor}88)"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
              <div style="font-size:1.25rem;font-weight:900;color:${rateColor};line-height:1">${rate}%</div>
            </div>
          </div>
          <div style="margin-top:7px;background:${rateBg};border-radius:8px;padding:3px 8px;border:1px solid ${rateColor}33">
            <div style="font-size:0.58rem;font-weight:800;color:${rateColor};text-align:center">อัตราสำเร็จ</div>
          </div>
        </div>
      </div>

      <!-- bottom divider stats -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid rgba(255,255,255,0.07)">
        ${[
          {n:done,    l:'เสร็จแล้ว', c:'#22c55e', icon:'✓'},
          {n:pending, l:'งานค้าง',  c:'#f87171', icon:'!'},
          {n:inprog,  l:'กำลังซ่อม',c:'#60a5fa', icon:'⟳'},
        ].map((s,i) => `
          <div style="padding:12px 8px;text-align:center;${i<2?'border-right:1px solid rgba(255,255,255,0.07)':''}">
            <div style="font-size:0.55rem;color:rgba(255,255,255,0.35);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">${s.l}</div>
            <div style="font-size:1.6rem;font-weight:900;color:${s.c};line-height:1">${s.n}</div>
          </div>`).join('')}
      </div>
    </div>

    <!-- ═══ 3 Action Cards ═══ -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      <!-- เสร็จแล้ว -->
      <div onclick="setFilter('status','done');goPage('tickets')"
        style="background:white;border-radius:16px;padding:14px 10px;text-align:center;border:1.5px solid #bbf7d0;cursor:pointer;box-shadow:0 2px 8px rgba(22,163,74,0.1);transition:all 0.15s;position:relative;overflow:hidden"
        onmousedown="this.style.transform='scale(0.94)';this.style.boxShadow='0 4px 16px rgba(22,163,74,0.2)'"
        onmouseup="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(22,163,74,0.1)'"
        ontouchstart="this.style.transform='scale(0.94)'"
        ontouchend="this.style.transform=''">
        <div style="position:absolute;top:-8px;right:-8px;width:44px;height:44px;border-radius:50%;background:rgba(22,163,74,0.07)"></div>
        <div style="width:38px;height:38px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;box-shadow:0 4px 10px rgba(22,163,74,0.35)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.8" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div style="font-size:2rem;font-weight:900;color:#16a34a;line-height:1;margin-bottom:4px">${done}</div>
        <div style="font-size:0.65rem;color:#15803d;font-weight:700;letter-spacing:0.02em">เสร็จแล้ว</div>
        <div style="margin-top:6px;font-size:0.55rem;color:#86efac;background:#f0fdf4;border-radius:6px;padding:2px 5px;display:inline-block">ดูรายการ →</div>
      </div>

      <!-- งานค้าง -->
      <div onclick="setFilter('status','');goPage('tickets')"
        style="background:white;border-radius:16px;padding:14px 10px;text-align:center;border:1.5px solid #fca5a5;cursor:pointer;box-shadow:0 2px 8px rgba(200,16,46,0.1);transition:all 0.15s;position:relative;overflow:hidden"
        onmousedown="this.style.transform='scale(0.94)';this.style.boxShadow='0 4px 16px rgba(200,16,46,0.2)'"
        onmouseup="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(200,16,46,0.1)'"
        ontouchstart="this.style.transform='scale(0.94)'"
        ontouchend="this.style.transform=''">
        <div style="position:absolute;top:-8px;right:-8px;width:44px;height:44px;border-radius:50%;background:rgba(200,16,46,0.06)"></div>
        <div style="width:38px;height:38px;background:linear-gradient(135deg,#ef4444,#c8102e);border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;box-shadow:0 4px 10px rgba(200,16,46,0.35)">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div style="font-size:2rem;font-weight:900;color:#c8102e;line-height:1;margin-bottom:4px">${pending}</div>
        <div style="font-size:0.65rem;color:#b91c1c;font-weight:700;letter-spacing:0.02em">งานค้าง</div>
        <div style="margin-top:6px;font-size:0.55rem;color:#fca5a5;background:#fff0f2;border-radius:6px;padding:2px 5px;display:inline-block">ดูรายการ →</div>
      </div>

      <!-- กำลังดำเนิน -->
      <div onclick="setFilter('status','inprogress');goPage('tickets')"
        style="background:white;border-radius:16px;padding:14px 10px;text-align:center;border:1.5px solid #93c5fd;cursor:pointer;box-shadow:0 2px 8px rgba(29,78,216,0.08);transition:all 0.15s;position:relative;overflow:hidden"
        onmousedown="this.style.transform='scale(0.94)';this.style.boxShadow='0 4px 16px rgba(29,78,216,0.15)'"
        onmouseup="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(29,78,216,0.08)'"
        ontouchstart="this.style.transform='scale(0.94)'"
        ontouchend="this.style.transform=''">
        <div style="position:absolute;top:-8px;right:-8px;width:44px;height:44px;border-radius:50%;background:rgba(29,78,216,0.05)"></div>
        <div style="width:38px;height:38px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);border-radius:12px;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;box-shadow:0 4px 10px rgba(29,78,216,0.3)">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div style="font-size:2rem;font-weight:900;color:#1d4ed8;line-height:1;margin-bottom:4px">${inprog}</div>
        <div style="font-size:0.65rem;color:#1e40af;font-weight:700;letter-spacing:0.02em">กำลังดำเนิน</div>
        <div style="margin-top:6px;font-size:0.55rem;color:#93c5fd;background:#eff6ff;border-radius:6px;padding:2px 5px;display:inline-block">ดูรายการ →</div>
      </div>
    </div>`;
}

function renderRptGoal(done) {
  const el = document.getElementById('rpt-goal');
  if (!el) return;
  const pct = Math.min(100, Math.round(done/RPT_GOAL*100));
  const isFull = pct >= 100;
  const color = isFull ? '#16a34a' : pct>=60 ? '#d97706' : '#c8102e';
  const barColor = isFull ? '#22c55e' : pct>=60 ? '#f59e0b' : '#c8102e';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      <div style="flex:1">
        <div style="font-size:0.72rem;font-weight:700;color:#64748b;margin-bottom:2px">🎯 เป้าหมายประจำเดือน</div>
        <div style="font-size:0.85rem;font-weight:800;color:#0f172a">${done} <span style="color:#94a3b8;font-weight:500;font-size:0.75rem">/ ${RPT_GOAL} งาน</span></div>
      </div>
      <div style="width:54px;height:54px;position:relative;flex-shrink:0">
        <svg width="54" height="54" viewBox="0 0 54 54">
          <circle cx="27" cy="27" r="22" fill="none" stroke="#f1f5f9" stroke-width="5"/>
          <circle cx="27" cy="27" r="22" fill="none" stroke="${barColor}" stroke-width="5"
            stroke-dasharray="${(pct/100*138.2).toFixed(1)} 138.2"
            stroke-dashoffset="34.55" stroke-linecap="round"
            style="transition:stroke-dasharray 0.6s ease"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:900;color:${color}">${pct}%</div>
      </div>
    </div>
    <div style="background:#f1f5f9;border-radius:99px;height:8px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${barColor},${barColor}cc);border-radius:99px;transition:width 0.6s ease"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:5px;font-size:0.62rem;color:#94a3b8">
      <span>0</span>
      ${isFull ? '<span style="color:#16a34a;font-weight:700">🎉 บรรลุเป้าหมาย!</span>' : '<span>เป้า '+RPT_GOAL+' งาน</span>'}
    </div>`;
}

function renderRptPending(pending, inprog, waitP, highP) {
  const el = document.getElementById('rpt-pending');
  if (!el) return;

  const mkRow = (t, icon, color) => `
    <div onclick="openDetail('${t.id}')" style="display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:12px;background:#fafbff;border:1px solid #f1f5f9;margin-bottom:5px;cursor:pointer;transition:all 0.15s" onmousedown="this.style.background='#f0f4ff'" onmouseup="this.style.background='#fafbff'">
      <div style="width:28px;height:28px;border-radius:9px;background:${color}18;display:flex;align-items:center;justify-content:center;font-size:0.85rem;flex-shrink:0">${icon}</div>
      <div style="flex:1;overflow:hidden">
        <div style="font-size:0.78rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.problem)||'—'}</div>
        <div style="font-size:0.62rem;color:#94a3b8;margin-top:1px">${t.id} · ${(t.machine||'—').slice(0,22)}</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;

  el.innerHTML = `
    <!-- mini stats row -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:14px">
      <div onclick="goPage('tickets');setTimeout(()=>setTicketFilter&&setTicketFilter('high'),200)"
        style="background:linear-gradient(135deg,#fff0f2,#fecaca);border-radius:13px;padding:10px 8px;text-align:center;border:1px solid #fca5a5;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:transform 0.12s,box-shadow 0.12s;active:transform:scale(0.96)"
        ontouchstart="this.style.transform='scale(0.94)'" ontouchend="this.style.transform=''">
        <div style="font-size:1.4rem;font-weight:900;color:#c8102e;line-height:1">${highP.length}</div>
        <div style="font-size:0.6rem;color:#b91c1c;margin-top:3px;font-weight:700">🔴 ด่วนมาก</div>
      </div>
      <div onclick="goPage('tickets');setTimeout(()=>setTicketFilter&&setTicketFilter('waiting_part'),200)"
        style="background:linear-gradient(135deg,#fff7ed,#fed7aa);border-radius:13px;padding:10px 8px;text-align:center;border:1px solid #fdba74;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:transform 0.12s"
        ontouchstart="this.style.transform='scale(0.94)'" ontouchend="this.style.transform=''">
        <div style="font-size:1.4rem;font-weight:900;color:#ea580c;line-height:1">${waitP.length}</div>
        <div style="font-size:0.6rem;color:#c2410c;margin-top:3px;font-weight:700">⏳ รออะไหล่</div>
      </div>
      <div onclick="goPage('tickets');setTimeout(()=>setTicketFilter&&setTicketFilter('inprogress'),200)"
        style="background:linear-gradient(135deg,#eff6ff,#bfdbfe);border-radius:13px;padding:10px 8px;text-align:center;border:1px solid #93c5fd;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:transform 0.12s"
        ontouchstart="this.style.transform='scale(0.94)'" ontouchend="this.style.transform=''">
        <div style="font-size:1.4rem;font-weight:900;color:#1d4ed8;line-height:1">${inprog.length}</div>
        <div style="font-size:0.6rem;color:#1e40af;margin-top:3px;font-weight:700">⚙️ กำลังซ่อม</div>
      </div>
    </div>

    ${pending.length === 0
      ? '<div style="text-align:center;padding:20px;background:#f0fdf4;border-radius:14px;color:#16a34a;font-weight:700;font-size:0.85rem">✅ ไม่มีงานค้าง</div>'
      : `<div style="font-size:0.7rem;font-weight:700;color:#64748b;margin-bottom:7px;text-transform:uppercase;letter-spacing:0.05em">งานที่ต้องดูแล (${Math.min(pending.length,8)} จาก ${pending.length})</div>
         ${highP.length>0 ? `<div style="font-size:0.68rem;font-weight:700;color:#c8102e;margin-bottom:5px;display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:#c8102e;display:inline-block"></span>ด่วนมาก</div>${highP.slice(0,3).map(t=>mkRow(t,'🔴','#c8102e')).join('')}`:''}
         ${waitP.length>0 ? `<div style="font-size:0.68rem;font-weight:700;color:#ea580c;margin-top:8px;margin-bottom:5px;display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:#ea580c;display:inline-block"></span>รออะไหล่</div>${waitP.slice(0,3).map(t=>mkRow(t,'⏳','#ea580c')).join('')}`:''}
         ${pending.length>8?`<div style="text-align:center;font-size:0.7rem;color:#94a3b8;padding:6px;cursor:pointer" onclick="goPage('tickets')">+${pending.length-8} รายการ → ดูทั้งหมด</div>`:''}`}
  `;
}

function renderRptTech(monthTickets) {
  const el = document.getElementById('rpt-tech');
  if (!el) return;
  const techs = (db.users||[]).filter(u=>u.role==='tech');
  if (!techs.length) { el.innerHTML='<div style="color:var(--muted);text-align:center;padding:12px">ไม่มีข้อมูลช่าง</div>'; return; }

  const rows = techs.map(tech => {
    const myJobs  = monthTickets.filter(t=>t.assigneeId===tech.id);
    const myDone  = myJobs.filter(t=>['done','verified','closed'].includes(t.status));
    const myHigh  = myJobs.filter(t=>t.priority==='high'&&!['done','verified','closed'].includes(t.status));
    const myWait  = myJobs.filter(t=>t.status==='waiting_part');
    const pct     = myJobs.length ? Math.round(myDone.length/myJobs.length*100) : 0;
    const barColor= pct>=80?'#22c55e':pct>=50?'#f59e0b':'#c8102e';
    const avBg    = getAvatarColor(tech.id);
    const avatar  = tech.photo
      ? `<img src="${tech.photo}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.1)">`
      : `<div style="width:40px;height:40px;border-radius:50%;background:${avBg};display:flex;align-items:center;justify-content:center;font-size:0.9rem;font-weight:900;color:white;flex-shrink:0;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.1)">${getAvatarInitials(tech.name)}</div>`;
    return `
      <div style="background:white;border-radius:14px;padding:12px 14px;margin-bottom:8px;border:1px solid #f1f5f9;box-shadow:0 1px 4px rgba(0,0,0,0.04)">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">
          ${avatar}
          <div style="flex:1;min-width:0">
            <div style="font-size:0.86rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${tech.name}</div>
            <div style="font-size:0.65rem;color:#94a3b8;margin-top:1px">${tech.dept||'ช่างซ่อม'}</div>
          </div>
          <div style="text-align:center;background:${pct>=80?'#f0fdf4':pct>=50?'#fffbeb':'#fff0f2'};border-radius:10px;padding:6px 10px;min-width:48px">
            <div style="font-size:1.1rem;font-weight:900;color:${barColor};line-height:1">${pct}%</div>
            <div style="font-size:0.56rem;color:#94a3b8;margin-top:1px">${myDone.length}/${myJobs.length}</div>
          </div>
        </div>
        <!-- Progress bar -->
        <div style="background:#f1f5f9;border-radius:99px;height:6px;overflow:hidden;margin-bottom:7px">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:99px;transition:width 0.5s ease"></div>
        </div>
        <!-- tags -->
        ${myJobs.length === 0
          ? '<div style="font-size:0.68rem;color:#94a3b8;text-align:center">ไม่มีงานเดือนนี้</div>'
          : `<div style="display:flex;gap:5px;flex-wrap:wrap">
              ${myHigh.length>0?`<span style="font-size:0.62rem;background:#fff0f2;color:#c8102e;border-radius:6px;padding:2px 8px;font-weight:700;border:1px solid #fecaca">🔴 ${myHigh.length} ด่วน</span>`:''}
              ${myWait.length>0?`<span style="font-size:0.62rem;background:#fff7ed;color:#c2410c;border-radius:6px;padding:2px 8px;font-weight:700;border:1px solid #fed7aa">⏳ ${myWait.length} รออะไหล่</span>`:''}
              ${myJobs.length>0&&myHigh.length===0&&myWait.length===0?`<span style="font-size:0.62rem;background:#f0fdf4;color:#16a34a;border-radius:6px;padding:2px 8px;font-weight:700;border:1px solid #bbf7d0">✅ งานเป็นปกติ</span>`:''}
            </div>`}
      </div>`;
  }).join('');

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-weight:800;font-size:0.9rem;color:#0f172a">👷 ผลงานรายช่าง</div>
      <div style="font-size:0.68rem;color:#94a3b8">${techs.length} คน</div>
    </div>
    ${rows}`;
}

function renderRptProblems(monthTickets) {
  const el = document.getElementById('rpt-problems');
  if (!el) return;
  const counts = {};
  monthTickets.forEach(t => {
    const k = t.problem||'อื่นๆ';
    counts[k] = (counts[k]||0)+1;
  });
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const total = monthTickets.length || 1;
  const max = sorted[0]?.[1]||1;

  if (!sorted.length) {
    el.innerHTML = '<div style="font-weight:800;font-size:0.88rem;color:var(--text);margin-bottom:8px">📊 ปัญหาที่พบบ่อย</div><div style="color:var(--muted);text-align:center;padding:16px;font-size:0.82rem">ไม่มีข้อมูลเดือนนี้</div>';
    return;
  }

  const palette = ['#c8102e','#e65100','#1d4ed8','#166534','#7c3aed','#0891b2','#92400e','#0f766e'];

  // ── Horizontal bar chart ──
  const bars = sorted.map(([prob, cnt], i) => {
    const pct = Math.round(cnt/max*100);
    const pctOfTotal = Math.round(cnt/total*100);
    const col = palette[i % palette.length];
    return `
    <div style="margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="font-size:0.74rem;font-weight:700;color:#1e293b;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:8px">${i+1}. ${prob}</div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <span style="font-size:0.7rem;font-weight:800;color:${col}">${cnt}</span>
          <span style="font-size:0.62rem;color:#94a3b8;background:#f1f5f9;border-radius:4px;padding:1px 5px">${pctOfTotal}%</span>
        </div>
      </div>
      <div style="background:#f1f5f9;border-radius:6px;height:9px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${col};border-radius:6px;transition:width 0.5s cubic-bezier(.4,0,.2,1)"></div>
      </div>
    </div>`;
  }).join('');

  // ── Donut SVG (top 5) ──
  const donutTop = sorted.slice(0,5);
  const donutTotal = donutTop.reduce((s,[,n])=>s+n,0)||1;
  const R=40, CX=56, CY=56, stroke=18;
  const circ = 2*Math.PI*R;
  let offset=0;
  const slices = donutTop.map(([,cnt],i)=>{
    const frac = cnt/donutTotal;
    const dash = frac*circ;
    const gap = circ - dash;
    const s = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${palette[i]}" stroke-width="${stroke}"
      stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      stroke-dashoffset="${(-offset*circ+circ/4).toFixed(2)}"
      style="transition:all 0.5s"/>`;
    offset += frac;
    return s;
  }).join('');
  const legend = donutTop.map(([prob,cnt],i)=>
    `<div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
      <div style="width:10px;height:10px;border-radius:3px;background:${palette[i]};flex-shrink:0"></div>
      <div style="font-size:0.65rem;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${prob}</div>
      <div style="font-size:0.65rem;font-weight:800;color:${palette[i]};flex-shrink:0">${cnt}</div>
    </div>`).join('');

  el.innerHTML = `
    <div style="font-weight:800;font-size:0.92rem;color:#0f172a;margin-bottom:12px">📊 ปัญหาที่พบบ่อย</div>

    <!-- Donut + legend row -->
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;background:#f8fafc;border-radius:14px;padding:12px">
      <div style="flex-shrink:0">
        <svg width="112" height="112" viewBox="0 0 112 112">
          <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#f1f5f9" stroke-width="${stroke}"/>
          ${slices}
          <text x="${CX}" y="${CY+5}" text-anchor="middle" font-size="13" font-weight="900" fill="#0f172a">${monthTickets.length}</text>
          <text x="${CX}" y="${CY+18}" text-anchor="middle" font-size="7.5" fill="#94a3b8">รายการ</text>
        </svg>
      </div>
      <div style="flex:1;overflow:hidden">${legend}</div>
    </div>

    <!-- Horizontal bars -->
    <div style="font-size:0.72rem;font-weight:800;color:#64748b;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em">รายละเอียด Top ${sorted.length}</div>
    ${bars}
  `;
}

function renderRptPriority(monthTickets) {
  const el = document.getElementById('rpt-priority');
  if (!el) return;
  const high = monthTickets.filter(t=>t.priority==='high');
  const mid  = monthTickets.filter(t=>t.priority==='mid');
  const low  = monthTickets.filter(t=>t.priority==='low');
  const total = monthTickets.length||1;

  const bar = (cnt, color) => {
    const pct = Math.round(cnt/total*100);
    return `<div style="height:100%;width:${pct}%;background:${color};transition:width 0.4s"></div>`;
  };

  el.innerHTML = `
    <div style="font-weight:800;font-size:0.88rem;color:var(--text);margin-bottom:10px">📊 สัดส่วนความเร่งด่วน</div>
    <div style="display:flex;border-radius:99px;overflow:hidden;height:14px;margin-bottom:10px;background:#f3f4f6">
      ${bar(high.length,'var(--accent)')}
      ${bar(mid.length,'#f59e0b')}
      ${bar(low.length,'#22c55e')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      <div style="text-align:center;background:#fff0f2;border-radius:10px;padding:8px">
        <div style="font-size:1.1rem;font-weight:800;color:var(--accent)">${high.length}</div>
        <div style="font-size:0.62rem;color:var(--muted)">🔴 ด่วนมาก</div>
      </div>
      <div style="text-align:center;background:#fffbeb;border-radius:10px;padding:8px">
        <div style="font-size:1.1rem;font-weight:800;color:#92400e">${mid.length}</div>
        <div style="font-size:0.62rem;color:var(--muted)">🟡 ปานกลาง</div>
      </div>
      <div style="text-align:center;background:#f0fdf4;border-radius:10px;padding:8px">
        <div style="font-size:1.1rem;font-weight:800;color:#166534">${low.length}</div>
        <div style="font-size:0.62rem;color:var(--muted)">🟢 ไม่เร่งด่วน</div>
      </div>
    </div>
  `;
}

// ============================================================
// CHAT
// ============================================================
let _chatKey = '';

// ── Chat List Page ─────────────────────────────────────────────
// ============================================================
// CHATROOM — 2-panel: list left, messages right
// ============================================================
// ============================================================
// CHATROOM — unified 2-panel (desktop) / fullscreen (mobile)
// ============================================================
let _crCurrentKey  = null;
let _crCurrentTid  = null;
let _crPanelOpen   = true; // desktop: panel visible

// ── responsive: ย่อ/ขยาย list panel ──
function toggleCrPanel() {
  _crPanelOpen = !_crPanelOpen;
  _applyCrLayout();
}

function _applyCrLayout() {
  const panel  = document.getElementById('cr-list-panel');
  const btn    = document.getElementById('cr-toggle-btn');
  const search = document.getElementById('cr-search');
  if (!panel) return;
  const isMobile = window.innerWidth < 768;
  if (_crPanelOpen) {
    panel.style.width    = isMobile ? '100%' : '300px';
    panel.style.display  = 'flex';
    const icon = document.getElementById('cr-toggle-icon');
    if (icon) icon.setAttribute('transform', '');
    if (btn) btn.title = 'ซ่อนรายการ';
    if (search) search.style.display = '';
    // mobile: ซ่อน right panel
    const right = document.getElementById('cr-chat-panel');
    if (right) right.style.display = isMobile ? 'none' : 'flex';
  } else {
    panel.style.width   = '0px';
    panel.style.display = 'none';
    const icon = document.getElementById('cr-toggle-icon');
    if (icon) icon.setAttribute('transform', 'rotate(180,12,12)');
    if (btn) btn.title = 'แสดงรายการ';
    // show right panel
    const right = document.getElementById('cr-chat-panel');
    if (right) right.style.display = 'flex';
    // back button
    const back = document.getElementById('cr-back-btn');
    if (back) back.style.display = isMobile ? 'flex' : 'none';
  }
}

function crGoBack() {
  _crPanelOpen = true;
  _applyCrLayout();
  const back  = document.getElementById('cr-back-btn');
  const right = document.getElementById('cr-chat-panel');
  if (back)  back.style.display  = 'none';
  // mobile: ซ่อน right panel กลับไป
  if (window.innerWidth < 768 && right) right.style.display = 'none';
}

function crOpenDetail() {
  if (_crCurrentTid) {
    openDetail(_crCurrentTid);
  }
}

// ── init layout on page enter ──
// BUG FIX (Bug 3 Chat): ป้องกัน listener leak เมื่อ goPage('chatroom') ถูกเรียกซ้ำ
// layout adjust ทำทุกครั้ง แต่ addEventListener ทำครั้งเดียว
let _crLayoutInited = false;

function initChatroomLayout() {
  const isMobile = window.innerWidth < 768;
  const right = document.getElementById('cr-chat-panel');
  const back  = document.getElementById('cr-back-btn');
  const pg    = document.getElementById('pg-chatroom');

  if (isMobile) {
    _crPanelOpen = true;
    _applyCrLayout();
    if (right) right.style.display = 'none';
    if (back)  back.style.display  = 'none';
  } else {
    _crPanelOpen = true;
    _applyCrLayout();
    if (right) right.style.display = 'flex';
    if (back)  back.style.display  = 'none';
  }

  // ── listeners ลงทะเบียนครั้งเดียว — ป้องกัน leak ──
  if (_crLayoutInited) return;
  _crLayoutInited = true;

  // ── visualViewport handler: แก้ keyboard ลอยค้าง บน Android ──
  if (window.visualViewport && pg) {
    if (window._crVpHandler) {
      window.visualViewport.removeEventListener('resize', window._crVpHandler);
      window.visualViewport.removeEventListener('scroll', window._crVpHandler);
    }
    window._crVpHandler = () => {
      const pgEl = document.getElementById('pg-chatroom');
      if (!pgEl || !pgEl.classList.contains('active')) return;
      const vv = window.visualViewport;
      const offsetTop = vv.offsetTop || 0;
      pgEl.style.transform = offsetTop > 0 ? `translateY(${offsetTop}px)` : '';
      pgEl.style.height    = offsetTop > 0 ? `${vv.height}px` : '';
      const msgs = document.getElementById('cr-messages');
      if (msgs && offsetTop === 0) {
        pgEl.style.transform = '';
        pgEl.style.height    = '';
      }
      if (msgs) setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 60);
    };
    window.visualViewport.addEventListener('resize', window._crVpHandler);
    window.visualViewport.addEventListener('scroll', window._crVpHandler);
  }

  // resize listener — ปรับ layout เมื่อหมุนจอ
  const crResizeHandler = () => {
    const nowMobile = window.innerWidth < 768;
    const r = document.getElementById('cr-chat-panel');
    const b = document.getElementById('cr-back-btn');
    if (!nowMobile) {
      _crPanelOpen = true;
      _applyCrLayout();
      if (r) r.style.display = 'flex';
      if (b) b.style.display = 'none';
    }
    const pgEl = document.getElementById('pg-chatroom');
    if (pgEl) { pgEl.style.transform = ''; pgEl.style.height = ''; }
  };
  window.removeEventListener('resize', window._crResizeHandler || (()=>{}));
  window._crResizeHandler = crResizeHandler;
  window.addEventListener('resize', crResizeHandler);
}

// ── Render TK list ──
function renderChatroomList() {
  const listEl = document.getElementById('cr-list');
  if (!listEl) return;
  const kw = (document.getElementById('cr-search')?.value || '').toLowerCase().trim();

  const myTickets = (db.tickets||[]).filter(t =>
    CU.role === 'admin' || t.assigneeId === CU.id || t.reporterId === CU.id
  );
  const rows = myTickets.map(t => {
    const key  = 'tk_' + t.id;
    const msgs = db.chats?.[key] || [];
    if (!msgs.length) return null;
    const last   = msgs[msgs.length - 1];
    const unread = msgs.filter(m => !m.readBy?.[CU.id] && m.uid !== CU.id).length;
    if (kw && !(t.id+t.problem+t.machine+(t.assignee||'')).toLowerCase().includes(kw)) return null;
    return { t, key, msgs, last, unread };
  }).filter(Boolean).sort((a,b)=>(b.last?.at||'').localeCompare(a.last?.at||''));

  // update badges
  const totalUnread = rows.reduce((s,r)=>s+r.unread,0);
  const navBadge = document.getElementById('cr-nav-badge');
  if (navBadge) { navBadge.textContent = totalUnread||''; navBadge.style.display = totalUnread?'':'none'; }
  const subText = document.getElementById('cr-total-badge-text');
  if (subText) subText.textContent = rows.length ? `${rows.length} การสนทนา${totalUnread?` · ${totalUnread} ยังไม่อ่าน`:''}` : 'ยังไม่มีแชท';

  if (!rows.length) {
    listEl.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;color:#94a3b8;text-align:center;padding:20px">
      <div style="font-size:2.5rem;margin-bottom:10px;opacity:0.4">💬</div>
      <div style="font-size:0.82rem;font-weight:700">${kw?'ไม่พบ':'ยังไม่มีแชท'}</div>
      <div style="font-size:0.7rem;margin-top:4px">ข้อความจะปรากฏเมื่อมีการแชทในงานซ่อม</div>
    </div>`;
    return;
  }

  listEl.innerHTML = rows.map(({ t, key, last, unread }) => {
    const isCurrent = key === _crCurrentKey;
    const lastText  = last ? (last.images?.length ? '📷 รูปภาพ' : (last.text||'')) : '';
    const fmtTime   = last?.at ? (()=>{
      try {
        const d = new Date(last.at.replace(' ','T'));
        const now = new Date();
        if (d.toDateString()===now.toDateString()) return d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});
        return d.toLocaleDateString('th-TH',{day:'numeric',month:'short'});
      } catch(e){ return ''; }
    })() : '';

    return `<div onclick="openChatroomChat('${t.id}')"
      style="display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;border-bottom:1px solid #f1f5f9;background:${isCurrent?'#fff5f6':'white'};border-left:3px solid ${isCurrent?'#c8102e':'transparent'};transition:background 0.1s">
      <div style="width:40px;height:40px;border-radius:12px;background:${isCurrent?'#c8102e':'#f1f5f9'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.7rem;font-weight:900;color:${isCurrent?'white':'#475569'}">
        ${t.id.slice(-4)}
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:4px;margin-bottom:3px">
          <span style="font-size:0.8rem;font-weight:${unread?'900':'700'};color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.problem||t.machine||t.id}</span>
          <span style="font-size:0.58rem;color:#94a3b8;flex-shrink:0">${fmtTime}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:0.7rem;color:${unread?'#374151':'#94a3b8'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${lastText}</span>
          ${unread?`<span style="background:#c8102e;color:white;border-radius:99px;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:0.58rem;font-weight:900;flex-shrink:0;padding:0 4px">${unread}</span>`:''}
        </div>
        <div style="font-size:0.6rem;color:#94a3b8;margin-top:2px">❄️ ${t.machine||''} <span style="color:#cbd5e1">·</span> ${t.id}</div>
      </div>
    </div>`;
  }).join('');
}

// ── Open chat for TK ──
function openChatroomChat(ticketId) {
  _crCurrentKey = 'tk_' + ticketId;
  _crCurrentTid = ticketId;
  const t = db.tickets.find(x => x.id === ticketId);
  if (!t) return;

  // mark read
  if (!db.chats) db.chats = {};
  if (!db.chats[_crCurrentKey]) db.chats[_crCurrentKey] = [];
  let changed = false;
  db.chats[_crCurrentKey].forEach(m => {
    if (!m.readBy) m.readBy = {};
    if (!m.readBy[CU.id]) { m.readBy[CU.id] = true; changed = true; }
  });
  if (changed) { saveDB(); fsSave(); }

  // update header
  const nameEl  = document.getElementById('cr-chat-name');
  const subEl   = document.getElementById('cr-chat-sub');
  const detBtn  = document.getElementById('cr-open-detail-btn');
  if (nameEl) nameEl.textContent = t.problem || t.id;
  if (subEl)  subEl.textContent  = `[${ticketId}] · ❄️${t.machine||''} · 🔧${t.assignee||'ยังไม่มอบหมาย'}`;
  if (detBtn) detBtn.style.display = 'flex';

  // show messages, hide empty
  const emptyEl  = document.getElementById('cr-empty');
  const msgBox   = document.getElementById('cr-messages');
  const inputBar = document.getElementById('cr-input-bar');
  if (emptyEl)  emptyEl.style.display  = 'none';
  if (msgBox)   { msgBox.style.display = 'flex'; }
  if (inputBar) { inputBar.style.display = 'flex'; inputBar.classList.add('active'); }

  // mobile: switch to messages view
  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    _crPanelOpen = false;
    _applyCrLayout();
  }

  renderChatroomMessages();
  renderChatroomList();
  setTimeout(() => document.getElementById('cr-input')?.focus(), 100);
}

// ── Render messages ──
function renderChatroomMessages() {
  const box = document.getElementById('cr-messages');
  if (!box || !_crCurrentKey) return;
  const msgs = db.chats?.[_crCurrentKey] || [];

  if (!msgs.length) {
    box.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:0.82rem;padding:40px">ยังไม่มีข้อความ</div>`;
    box.scrollTop = 0; return;
  }

  box.innerHTML = msgs.map((m,i) => {
    const isMe   = m.uid === CU.id;
    const sender = db.users.find(u => u.id === m.uid);
    const name   = sender?.name || m.uname || '?';
    const roleIcon = {admin:'👑',tech:'🔧',reporter:'📢'}[sender?.role||m.role] || '👤';
    const fmtTime = (()=>{
      try { return new Date((m.at||'').replace(' ','T')).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}); }
      catch(e){ return ''; }
    })();
    const prevDate = i>0?(msgs[i-1].at||'').slice(0,10):'';
    const thisDate = (m.at||'').slice(0,10);
    const divider  = thisDate && thisDate!==prevDate
      ? `<div style="text-align:center;margin:10px 0 6px;font-size:0.6rem;color:#94a3b8;font-weight:700;letter-spacing:.04em">${thisDate}</div>` : '';

    if (isMe) return divider + `
      <div style="display:flex;justify-content:flex-end;margin-bottom:3px">
        <div style="max-width:75%">
          <div style="background:#c8102e;color:white;border-radius:18px 4px 18px 18px;padding:10px 14px;font-size:0.85rem;line-height:1.5;word-break:break-word;box-shadow:0 2px 8px rgba(200,16,46,0.25)">${escapeHtml(m.text)}</div>
          <div style="text-align:right;font-size:0.58rem;color:#94a3b8;margin-top:3px">${fmtTime}</div>
        </div>
      </div>`;

    return divider + `
      <div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:3px">
        <div style="width:30px;height:30px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:0.75rem;flex-shrink:0;border:1.5px solid #e5e7eb">${roleIcon}</div>
        <div style="max-width:75%">
          <div style="font-size:0.6rem;color:#64748b;margin-bottom:3px;font-weight:700">${escapeHtml(name)}</div>
          <div style="background:white;border:1px solid #e5e7eb;border-radius:4px 18px 18px 18px;padding:10px 14px;font-size:0.85rem;line-height:1.5;word-break:break-word;box-shadow:0 1px 4px rgba(0,0,0,0.06)">${m.text||''}</div>
          <div style="font-size:0.58rem;color:#94a3b8;margin-top:3px">${fmtTime}</div>
        </div>
      </div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

// ── Send message ──
function sendChatroomMsg() {
  const input = document.getElementById('cr-input');
  if (!input || !_crCurrentKey) return;
  const text = input.value.trim();
  if (!text) return;
  if (text.length > 500) { showToast('⚠️ ข้อความยาวเกิน 500 ตัวอักษร'); return; }
  if (!db.chats) db.chats = {};
  if (!db.chats[_crCurrentKey]) db.chats[_crCurrentKey] = [];
  const msg = { uid:CU.id, uname:CU.name, role:CU.role, text, at:nowStr(), readBy:{[CU.id]:true} };
  db.chats[_crCurrentKey].push(msg);
  input.value = ''; input.style.height = 'auto';
  saveDB(); fsSave();
  renderChatroomMessages();
  renderChatroomList();
  const tid = _crCurrentKey.replace('tk_','');
  const t   = db.tickets.find(x=>x.id===tid);
  if (t) [t.assigneeId,t.reporterId].forEach(uid=>{
    if (uid&&uid!==CU.id) notifyUser(uid,`💬 ${CU.name}`,text,tid);
  });
}

// ── Badge update ──
function updateChatroomBadge() {
  const myTickets = (db.tickets||[]).filter(t=>CU.role==='admin'||t.assigneeId===CU.id||t.reporterId===CU.id);
  const total = myTickets.reduce((s,t)=>{
    const msgs=db.chats?.['tk_'+t.id]||[];
    return s+msgs.filter(m=>!m.readBy?.[CU.id]&&m.uid!==CU.id).length;
  },0);
  const badge = document.getElementById('cr-nav-badge');
  if (badge) { badge.textContent=total||''; badge.style.display=total?'':'none'; }
}

function openChat(ticketId, partnerId) {
  _chatKey = 'tk_' + ticketId;
  _chatPartnerId = partnerId;
  if (!db.chats) db.chats = {};
  if (!db.chats[_chatKey]) db.chats[_chatKey] = [];

  const partner = db.users.find(u => u.id === partnerId);
  const ticket  = db.tickets.find(t => t.id === ticketId);

  // Header
  const avatarEl = document.getElementById('chat-avatar');
  if (partner?.photo) {
    avatarEl.innerHTML = `<img src="${partner.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  } else {
    avatarEl.textContent = {admin:'👑',tech:'🔧',reporter:'📢'}[partner?.role||'']||'👤';
  }
  document.getElementById('chat-name').textContent = partner?.name || 'ผู้ใช้';
  if (ticket) {
    const _chatMac = getMacMap().get(ticket.machineId);
    const _chatSerial = _chatMac?.serial || '';
    const _chatBtu = _chatMac?.btu ? Number(_chatMac.btu).toLocaleString() + ' BTU' : '';
    const _chatRef = _chatMac?.refrigerant || '';
    const _chatDept = _chatMac?.dept || ticket.dept || '';
    const _chatVendor = _chatMac?.vendor || ticket.vendor || '';
    const _chatParts = ['['+ticketId+'] '+ticket.problem];
    if (_chatDept) _chatParts.push(_chatDept);
    if (_chatSerial) _chatParts.push(_chatSerial);
    if (_chatBtu) _chatParts.push(_chatBtu);
    if (_chatRef) _chatParts.push(_chatRef);
    if (_chatVendor) _chatParts.push('📋 '+_chatVendor);
    document.getElementById('chat-sub').textContent = _chatParts.join(' · ');
    // Mark messages from partner as read
    const key = 'tk_' + ticketId;
    if (db.chats && db.chats[key]) {
      db.chats[key].forEach(m => { if (m.uid !== CU.id) { if (!m.readBy) m.readBy = {}; m.readBy[CU.id] = true; } });
      saveChatsFast();
    }
  } else {
    document.getElementById('chat-sub').textContent = '';
  }

  renderChatMessages();
  openSheet('chat');
  setTimeout(() => {
    const box = document.getElementById('chat-messages');
    if (box) box.scrollTop = box.scrollHeight;
    document.getElementById('chat-input')?.focus();
  }, 200);
}

// ── Chat pending images ──
let _chatPendingImgs = [];

function onChatFileSelect(input) {
  const preview = document.getElementById('chat-img-preview');
  const files = Array.from(input.files);
  if (!files.length) return;
  // แสดง loading indicator
  let loadingEl = document.getElementById('chat-upload-progress');
  if (!loadingEl) {
    loadingEl = document.createElement('div');
    loadingEl.id = 'chat-upload-progress';
    loadingEl.style.cssText = 'font-size:0.72rem;color:#92400e;background:#fef3c7;border-radius:8px;padding:4px 10px;margin:4px 12px;display:flex;align-items:center;gap:5px';
    preview?.parentElement?.insertBefore(loadingEl, preview);
  }
  let done = 0;
  const total = files.length;
  const updateProgress = () => {
    const pct = Math.round((done/total)*100);
    if (loadingEl) loadingEl.innerHTML = done>=total ? '' : `⏳ โหลดรูป ${pct}% (${done}/${total})`;
    if (done >= total && loadingEl) { setTimeout(()=>{ if(loadingEl) loadingEl.remove(); }, 1000); }
  };
  updateProgress();
  files.forEach(f => {
    if (f.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = e => {
        _chatPendingImgs.push({ type:'pdf', name:f.name, data:e.target.result });
        done++; updateProgress(); renderChatImgPreview();
      };
      reader.readAsDataURL(f);
    } else {
      compressChatPhoto(f).then(data => {
        _chatPendingImgs.push({ type:'img', data });
        done++; updateProgress(); renderChatImgPreview();
      }).catch(() => {
        const reader = new FileReader();
        reader.onload = e => { _chatPendingImgs.push({ type:'img', data:e.target.result }); done++; updateProgress(); renderChatImgPreview(); };
        reader.readAsDataURL(f);
      });
    }
  });
  input.value = '';
}

function renderChatImgPreview() {
  const box = document.getElementById('chat-img-preview');
  if (!box) return;
  if (_chatPendingImgs.length === 0) { box.style.display='none'; box.innerHTML=''; return; }
  box.style.display = 'flex';
  box.innerHTML = _chatPendingImgs.map((img,i) =>
    img.type==='pdf'
    ? `<div style="position:relative;display:inline-flex;align-items:center;gap:5px;background:#fef3c7;border:1.5px solid #fde68a;border-radius:8px;padding:5px 8px;font-size:0.72rem;font-weight:700;color:#92400e;flex-shrink:0">
        📄 ${img.name.slice(0,16)}${img.name.length>16?'…':''}
        <button onclick="_chatPendingImgs.splice(${i},1);renderChatImgPreview()" style="width:18px;height:18px;border-radius:50%;background:#92400e;border:none;color:white;font-size:0.65rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
      </div>`
    : `<div style="position:relative;flex-shrink:0">
        <img src="${img.data}" style="width:60px;height:60px;object-fit:cover;border-radius:10px;border:1.5px solid #e5e7eb"/>
        <button onclick="_chatPendingImgs.splice(${i},1);renderChatImgPreview()" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:var(--accent);border:none;color:white;font-size:0.65rem;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
      </div>`
  ).join('');
}

function renderChatMessages() {
  const msgs = db.chats[_chatKey] || [];
  const box  = document.getElementById('chat-messages');
  if (!box) return;
  if (msgs.length === 0) {
    box.innerHTML = `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:40px 20px;opacity:0.6">
      <div style="width:64px;height:64px;border-radius:50%;background:rgba(200,16,46,0.08);display:flex;align-items:center;justify-content:center;font-size:1.8rem">💬</div>
      <div style="font-size:0.82rem;color:#9ca3af;text-align:center;line-height:1.6">เริ่มต้นการสนทนา<br>ข้อความจะปรากฏที่นี่</div>
    </div>`;
    return;
  }

  let html = '';
  let lastDate = '';
  const fmtDate = (at) => {
    if (!at) return '';
    const d = new Date((at||'').replace(' ','T'));
    if (isNaN(d)) return at.slice(0,10)||'';
    const today = new Date(); const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
    if (d.toDateString()===today.toDateString()) return 'วันนี้';
    if (d.toDateString()===yesterday.toDateString()) return 'เมื่อวาน';
    return d.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'});
  };
  const fmtTime = (at) => at ? (at.split(' ')[1]||'').slice(0,5) : '';

  msgs.forEach((m, idx) => {
    const isMe = m.uid === CU.id;
    const msgDate = fmtDate(m.at);
    const time = fmtTime(m.at);
    const prevMsg = idx > 0 ? msgs[idx-1] : null;
    const isFirstOfSender = !prevMsg || prevMsg.uid !== m.uid;
    const isLastOfSender = idx === msgs.length-1 || msgs[idx+1]?.uid !== m.uid;

    // Date separator
    if (msgDate && msgDate !== lastDate) {
      lastDate = msgDate;
      html += `<div style="display:flex;align-items:center;gap:10px;margin:12px 0 8px">
        <div style="flex:1;height:1px;background:rgba(200,16,46,0.12)"></div>
        <div style="font-size:0.62rem;font-weight:700;color:#c8102e;background:rgba(200,16,46,0.08);padding:3px 10px;border-radius:99px;white-space:nowrap">${msgDate}</div>
        <div style="flex:1;height:1px;background:rgba(200,16,46,0.12)"></div>
      </div>`;
    }

    // Avatar (แสดงเฉพาะ message สุดท้ายของกลุ่ม)
    const avatarInitial = (m.name||'?').charAt(0).toUpperCase();
    const avatarHtml = !isMe && isLastOfSender
      ? `<div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#c8102e,#9b0a24);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:800;color:white;flex-shrink:0;margin-bottom:2px">${avatarInitial}</div>`
      : `<div style="width:30px;flex-shrink:0"></div>`;

    // Bubble styles
    const myBubble = 'background:linear-gradient(135deg,#c8102e,#a50d25);color:white';
    const theirBubble = 'background:white;color:#1a1a2e;border:1px solid #f5e0e2';
    const myRadius = isFirstOfSender ? '18px 18px 4px 18px' : '18px 4px 4px 18px';
    const theirRadius = isFirstOfSender ? '18px 18px 18px 4px' : '4px 18px 18px 4px';

    let content = '';
    if (m.images && m.images.length) {
      content += `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:${m.text?'6px':'0'}">` +
        m.images.map(img => img.type==='pdf'
          ? `<a href="${img.data}" download="${img.name}" style="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.18);border-radius:8px;padding:5px 10px;font-size:0.72rem;font-weight:700;color:${isMe?'white':'#c8102e'};text-decoration:none">📄 ${img.name.slice(0,14)}</a>`
          : `<img src="${img.data}" onclick="openLightbox('${img.data}')" style="width:130px;height:100px;object-fit:cover;border-radius:12px;cursor:pointer;border:2px solid rgba(255,255,255,0.25)"/>`
        ).join('') + '</div>';
    }
    if (m.text) content += `<div style="font-size:0.88rem;line-height:1.5;word-break:break-word">${escapeHtml(m.text)}</div>`;

    // Name above first bubble (their messages)
    const nameLabel = !isMe && isFirstOfSender
      ? `<div style="font-size:0.62rem;font-weight:700;color:#c8102e;margin-bottom:3px;padding-left:2px">${escapeHtml(m.name)}</div>`
      : '';

    html += `<div style="display:flex;align-items:flex-end;gap:6px;margin-bottom:${isLastOfSender?'8px':'2px'};${isMe?'flex-direction:row-reverse':''}" >
      ${!isMe ? avatarHtml : ''}
      <div style="flex:1;display:flex;flex-direction:column;align-items:${isMe?'flex-end':'flex-start'};min-width:0">
        ${nameLabel}
        <div style="max-width:82%;${isMe?myBubble:theirBubble};border-radius:${isMe?myRadius:theirRadius};padding:9px 13px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">${content}</div>
        ${isLastOfSender ? `<div style="font-size:0.58rem;color:#9ca3af;margin-top:3px;padding:0 4px;display:flex;align-items:center;gap:4px">
          ${isMe && m.pending ? '<span style="color:#f59e0b">⏳</span>' : ''}
          ${time}${isMe && !m.pending ? ' <span style="color:#c8102e">✓✓</span>' : ''}
        </div>` : ''}
      </div>
      ${isMe ? '<div style="width:30px;flex-shrink:0"></div>' : ''}
    </div>`;
  });

  box.innerHTML = html;
  box.scrollTop = box.scrollHeight;
}

function sendChat() {
  const inp = document.getElementById('chat-input');
  if (!inp) return;
  const text = inp.value.trim();
  if (!text && _chatPendingImgs.length === 0) return;
  if (text.length > 500) { showToast('⚠️ ข้อความยาวเกิน 500 ตัวอักษร'); return; }

  // ตรวจ offline
  if (!navigator.onLine) {
    showToast('⚠️ ไม่มีอินเทอร์เน็ต — ข้อความบันทึก Local แล้ว จะ sync เมื่อออนไลน์');
  }

  if (!db.chats) db.chats = {};
  if (!db.chats[_chatKey]) db.chats[_chatKey] = [];
  const msg = { uid:CU.id, name:CU.name, text, at:nowStr(), pending: !navigator.onLine };
  if (_chatPendingImgs.length > 0) msg.images = [..._chatPendingImgs];
  db.chats[_chatKey].push(msg);
  if (_chatPartnerId && navigator.onLine) {
    const preview = _chatPendingImgs.length ? (text||'📷 รูปภาพ') : text;
    notifyUser(_chatPartnerId, '💬 ข้อความจาก '+CU.name, preview.slice(0,60)+(preview.length>60?'...':''), _chatKey);
  }

  try {
    // บันทึก localStorage ทันที
    setTimeout(() => {
      try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch(e) {}
    }, 0);
    // ส่งเฉพาะ chats ไป Firebase — เร็วกว่า saveDB ทั้งก้อน
    saveChatsFast();
  } catch(e) {
    if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
      showToast('⚠️ พื้นที่เต็ม — ลองลบข้อความเก่าออก');
    } else {
      showToast('❌ บันทึกไม่สำเร็จ: ' + (e.message||''));
    }
  }

  updateChatBadge();
  inp.value=''; inp.style.height='auto';
  _chatPendingImgs=[];
  renderChatImgPreview();
  renderChatMessages();

  if (!navigator.onLine) {
    const syncOnline = () => {
      saveChatsFast().then(() => {
        if (db.chats && db.chats[_chatKey]) {
          db.chats[_chatKey].forEach(m => delete m.pending);
        }
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        renderChatMessages();
        showToast('✅ sync ข้อความแล้ว');
      }).catch(()=>{});
      window.removeEventListener('online', syncOnline);
    };
    window.addEventListener('online', syncOnline);
  }
}

// ============================================================
// PURCHASE TRACKING
// ============================================================
let _purFilter = 'all';

function setPurFilter(f) {
  _purFilter = f;
  const configs = {
    all:  { color:'#1d4ed8', bg:'#eff6ff' },
    wait: { color:'#c2410c', bg:'#fff7ed' },
    po:   { color:'#7c3aed', bg:'#faf5ff' },
    done: { color:'#166534', bg:'#f0fdf4' },
  };
  ['all','wait','po','done'].forEach(x => {
    const btn = document.getElementById('pur-filter-'+x);
    if (!btn) return;
    const isActive = x === f;
    const cfg = configs[x];
    btn.style.background  = isActive ? cfg.bg  : 'transparent';
    btn.style.color       = isActive ? cfg.color : '#94a3b8';
    btn.style.fontWeight  = isActive ? '800' : '600';
    btn.style.boxShadow   = isActive ? '0 1px 4px rgba(0,0,0,0.1)' : 'none';
    btn.style.borderBottom = isActive ? `2.5px solid ${cfg.color}` : '2.5px solid transparent';
  });
  renderPurchase();
}

// ── Tech: state สำหรับ inline request form ──
let _techReqTid = null;
let _techReqRows = [];
let _currentPurchaseTab = 'order'; // 'order' | 'track'

function setPurchaseTab(tab, skipRender) {
  _currentPurchaseTab = tab;
  const orderBtn = document.getElementById('pur-tab-order');
  const trackBtn = document.getElementById('pur-tab-track');
  const headerBar = document.getElementById('pur-header-bar');
  const list = document.getElementById('pur-list');
  const trackContent = document.getElementById('pur-track-content');
  if (!orderBtn || !trackBtn) return;

  const activeStyle  = 'flex:1;padding:12px 4px;border:none;background:transparent;font-size:0.78rem;font-weight:800;border-bottom:2.5px solid;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:5px;';
  const inactiveStyle = 'flex:1;padding:12px 4px;border:none;background:transparent;font-size:0.78rem;font-weight:600;color:#94a3b8;border-bottom:2.5px solid transparent;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:5px;';

  if (tab === 'order') {
    orderBtn.style.cssText = activeStyle + 'color:#e65100;border-bottom-color:#e65100;';
    trackBtn.style.cssText = inactiveStyle;
    if (headerBar) headerBar.style.display = '';
    if (list) list.style.display = '';
    if (trackContent) trackContent.style.display = 'none';
    if (!skipRender) renderPurchase();
  } else {
    trackBtn.style.cssText = activeStyle + 'color:#1d4ed8;border-bottom-color:#1d4ed8;';
    orderBtn.style.cssText = inactiveStyle;
    if (headerBar) headerBar.style.display = 'none';
    if (list) list.style.display = 'none';
    if (trackContent) {
      trackContent.style.display = '';
      // ถ้า Firebase ยังไม่พร้อม — แสดง loading + retry อัตโนมัติ
      if (typeof _firebaseReady !== 'undefined' && !_firebaseReady) {
        trackContent.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#94a3b8"><div style="font-size:2rem;margin-bottom:10px">⏳</div><div style="font-size:0.85rem;font-weight:600">กำลังโหลดข้อมูล...</div></div>';
        const _retryTrack = setInterval(() => {
          if (typeof _firebaseReady === 'undefined' || _firebaseReady) {
            clearInterval(_retryTrack);
            if (trackContent.style.display !== 'none') renderTrackingInline(trackContent);
          }
        }, 800);
      } else {
        renderTrackingInline(trackContent);
      }
    }
  }
}

function renderTrackingInline(container) {
  // render tracking content ลงใน container ที่ระบุ (แทนที่ pg-tracking)
  const T = db.tickets;
  const daysSince = (d) => !d ? 0 : Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  const ageBadge = (ds) => {
    if (ds >= 7) return `<span style="background:#fef2f2;color:#c8102e;border:1px solid rgba(200,16,46,0.3);border-radius:99px;padding:1px 7px;font-size:0.7rem;font-weight:700">${ds} วัน ⚠️</span>`;
    if (ds >= 3) return `<span style="background:#fff7ed;color:#e65100;border:1px solid rgba(230,81,0,0.3);border-radius:99px;padding:1px 7px;font-size:0.7rem;font-weight:700">${ds} วัน</span>`;
    return `<span style="background:#f3f4f6;color:var(--muted);border-radius:99px;padding:1px 7px;font-size:0.7rem">${ds} วัน</span>`;
  };

  // สรุป KPI
  const statuses = [
    { key:'new', label:'🆕 รอจ่ายงาน', color:'#1565c0', bg:'#eff6ff' },
    { key:'assigned', label:'📋 จ่ายงานแล้ว', color:'#f57f17', bg:'#fff8e1' },
    { key:'accepted', label:'✋ รับงานแล้ว', color:'#7b1fa2', bg:'#f3e8ff' },
    { key:'inprogress', label:'🔧 กำลังซ่อม', color:'#00acc1', bg:'#e0f7fa' },
    { key:'waiting_part', label:'⏳ รออะไหล่', color:'#e65100', bg:'#fff3e0' },
    { key:'done', label:'✅ รอตรวจรับ', color:'#2e7d32', bg:'#f0fdf4' },
  ];
  const summaryCards = statuses.map(s => {
    const cnt = T.filter(t => t.status === s.key).length;
    return `<div onclick="goPage('tickets')" style="background:${s.bg};border:1px solid ${s.color}30;border-radius:12px;padding:10px 8px;text-align:center;flex:1;cursor:pointer">
      <div style="font-size:1.4rem;font-weight:800;color:${s.color};font-family:'JetBrains Mono',monospace">${cnt}</div>
      <div style="font-size:0.58rem;color:${s.color};font-weight:600;margin-top:2px;line-height:1.3">${s.label}</div>
    </div>`;
  }).join('');

  // waiting_part cards
  const wpTickets = T.filter(t => t.status === 'waiting_part');
  const wpHtml = wpTickets.length ? wpTickets.map(t => {
    const ds = daysSince(t.updatedAt);
    const hasPO = !!(t.purchaseOrder);
    const hasPR = !!(t.purchaseOrder?.pr);
    const isRecv = t.purchaseOrder?.receiveStatus === 'received';
    const prBadge = hasPR
      ? `<span style="background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:5px;padding:1px 7px;font-size:0.6rem;font-weight:700">PR: ${t.purchaseOrder.pr}</span>`
      : hasPO
      ? `<span style="background:#fef3c7;color:#92400e;border:1px solid #fde68a;border-radius:5px;padding:1px 7px;font-size:0.6rem;font-weight:700">⚠️ ยังไม่มีเลข PR</span>`
      : `<span style="background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:5px;padding:1px 7px;font-size:0.6rem;font-weight:700">⚠️ ยังไม่กรอก PR/PO</span>`;
    const poBadge = t.purchaseOrder?.po ? `<span style="background:#f5f3ff;color:#6d28d9;border:1px solid #c4b5fd;border-radius:5px;padding:1px 7px;font-size:0.6rem;font-weight:700">PO: ${t.purchaseOrder.po}</span>` : '';
    return `<div style="background:white;border:1.5px solid rgba(230,81,0,0.25);border-radius:14px;padding:12px;margin-bottom:8px" onclick="openDetail('${t.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:0.85rem;color:var(--text)">[${t.id}] ${escapeHtml(t.problem)}</div>
          <div style="font-size:0.72rem;color:var(--muted);margin-top:2px">❄️ ${t.machine}</div>
          <div style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap">${prBadge}${poBadge}</div>
        </div>
        ${ageBadge(ds)}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="font-size:0.72rem;color:var(--muted)">🔧 ${t.assignee||'ยังไม่จ่ายงาน'}</div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          ${CU&&CU.role==='admin' ? `
          <button onclick="event.stopPropagation();notifyTechToResubmit('${t.id}')"
            style="padding:5px 9px;border-radius:8px;border:1.5px solid #7c3aed;background:white;color:#7c3aed;font-size:0.62rem;font-weight:800;cursor:pointer;font-family:inherit">
            🔔 แจ้งช่างกรอกใหม่
          </button>
          <button onclick="event.stopPropagation();closeSheet('detail');setTimeout(()=>openPOForm('${t.id}'),200)"
            style="padding:5px 9px;border-radius:8px;border:1.5px solid #e65100;background:white;color:#e65100;font-size:0.62rem;font-weight:800;cursor:pointer;font-family:inherit">
            ✏️ ${hasPO?'แก้ PR':'กรอก PR'}
          </button>
          ${hasPO && !isRecv
            ? `<button onclick="event.stopPropagation();markPartsArrivedAndNotify('${t.id}')"
                style="padding:5px 9px;border-radius:8px;border:none;background:#16a34a;color:white;font-size:0.62rem;font-weight:800;cursor:pointer;font-family:inherit">
                📦 ของมาแล้ว
               </button>`
            : `<button disabled style="padding:5px 9px;border-radius:8px;border:none;background:#e2e8f0;color:#94a3b8;font-size:0.62rem;cursor:not-allowed;font-family:inherit">📦 ของมาแล้ว</button>`}
          ` : ''}
        </div>
      </div>
    </div>`;
  }).join('') : `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px;text-align:center;color:#166534;font-size:0.82rem">✅ ไม่มีงานรออะไหล่</div>`;

  // done/verified รอตรวจรับ
  const doneTickets = T.filter(t => t.status === 'done');
  const doneHtml = doneTickets.length ? doneTickets.map(t => `
    <div style="background:white;border:1px solid rgba(21,128,61,0.2);border-radius:14px;padding:12px;margin-bottom:8px;cursor:pointer" onclick="openDetail('${t.id}')">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div>
          <div style="font-weight:700;font-size:0.85rem;color:var(--text)">[${t.id}] ${escapeHtml(t.problem)}</div>
          <div style="font-size:0.72rem;color:var(--muted);margin-top:2px">❄️ ${t.machine} · 🔧 ${t.assignee||'—'}</div>
          ${t.summary?`<div style="font-size:0.78rem;color:#2e7d32;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(t.summary||'').split('\n')[0].replace(/^[-–]\s*/,'')}</div>`:''}
        </div>
        <button onclick="event.stopPropagation();closeSheet('detail');openDetail('${t.id}')" style="padding:6px 12px;background:#16a34a;color:white;border:none;border-radius:8px;font-size:0.65rem;font-weight:800;cursor:pointer;font-family:inherit;flex-shrink:0">🔒 ปิดงาน</button>
      </div>
    </div>`).join('') : '';

  // stale tickets
  const stale = T.filter(t => ['assigned','accepted','inprogress'].includes(t.status) && daysSince(t.updatedAt) >= 3);
  const staleHtml = stale.length ? stale.sort((a,b)=>daysSince(b.updatedAt)-daysSince(a.updatedAt)).map(t => {
    const ds = daysSince(t.updatedAt);
    return `<div style="background:white;border:1px solid rgba(200,16,46,0.2);border-radius:14px;padding:12px;margin-bottom:8px;cursor:pointer" onclick="openDetail('${t.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="flex:1;overflow:hidden">
          <div style="font-weight:700;font-size:0.85rem;color:var(--text)">[${t.id}] ${escapeHtml(t.problem)}</div>
          <div style="font-size:0.72rem;color:var(--muted);margin-top:2px">❄️ ${t.machine} · 🔧 ${t.assignee||'—'}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">${ageBadge(ds)}</div>
      </div>
    </div>`;}).join('') : `<div style="background:#f0fdf4;border:1px solid rgba(21,128,61,0.2);border-radius:12px;padding:14px;text-align:center;color:var(--ok);font-size:0.82rem">✅ ไม่มีงานค้างนาน</div>`;

  container.innerHTML = `
    <div style="font-weight:800;font-size:0.95rem;color:var(--text);margin-bottom:10px">📊 ติดตามงานทั้งหมด</div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px">${summaryCards}</div>
    ${wpTickets.length?`<div style="font-weight:700;color:#e65100;font-size:0.88rem;margin-bottom:8px;display:flex;align-items:center;gap:6px">⏳ รอสั่งซื้ออะไหล่ <span style="background:#e65100;color:white;border-radius:99px;padding:1px 7px;font-size:0.7rem">${wpTickets.length}</span></div>${wpHtml}`:''}
    ${doneTickets.length?`<div style="font-weight:700;color:#166534;font-size:0.88rem;margin:12px 0 8px;display:flex;align-items:center;gap:6px">✅ ซ่อมเสร็จ รอตรวจรับ <span style="background:#16a34a;color:white;border-radius:99px;padding:1px 7px;font-size:0.7rem">${doneTickets.length}</span></div>${doneHtml}`:''}
    <div style="font-weight:700;color:var(--accent);font-size:0.88rem;margin:12px 0 8px;display:flex;align-items:center;gap:6px">⚠️ งานค้างนาน (≥3 วัน) <span style="background:var(--accent);color:white;border-radius:99px;padding:1px 7px;font-size:0.7rem">${stale.length}</span></div>
    ${staleHtml}
    <div style="height:20px"></div>
  `;
}

// แจ้งช่างให้กรอกรายการสั่งซื้อใหม่
function notifyTechToResubmit(tid) {
  const t = db.tickets.find(x=>x.id===tid); if(!t) return;
  const now = nowStr();
  // ปลด lock techRequest เพื่อให้ช่างแก้ไขได้
  if (t.techRequest) {
    t.techRequest.locked = false;
    t.techRequest.resetAt = now;
    t.techRequest.resetBy = CU.name;
  }
  t.history = t.history||[];
  t.history.push({act:'🔔 แจ้งช่างกรอกรายการใหม่', by:CU.name, at:now});
  saveDB(); syncTicket(t);
  // แจ้งเตือนช่าง
  if (t.assigneeId) {
    notifyUser(t.assigneeId, '🔔 กรุณากรอกรายการอะไหล่ใหม่ ['+tid+']',
      'Admin ('+CU.name+') ขอให้ตรวจสอบและกรอกรายละเอียดอะไหล่ใหม่อีกครั้ง', tid);
  }
  showToast('✅ แจ้งช่างแล้ว — ช่างจะสามารถแก้ไขรายการได้');
  // re-render
  const tc = document.getElementById('pur-track-content');
  if (tc && tc.style.display !== 'none') renderTrackingInline(tc);
}

function renderPurchase() {
  if (!CU) return;
  if (CU.role === 'admin')    { renderPurchaseAdmin();    return; }
  if (CU.role === 'tech')     { renderPurchaseTech();     return; }
  if (CU.role === 'reporter') { renderPurchaseReporter(); return; }
}

// ════════════════════════════════════════════════
// REPORTER VIEW — ดูสถานะอะไหล่ของงานที่แจ้ง
// ════════════════════════════════════════════════
function renderPurchaseReporter() {
  const hb = document.getElementById('pur-header-bar');
  const list = document.getElementById('pur-list');
  const tabBar = document.getElementById('pur-tab-bar');
  if (tabBar) tabBar.style.display = 'none'; // reporter ไม่มี tab ติดตาม

  if (hb) hb.innerHTML = `
    <div style="padding:12px 14px 8px;border-bottom:1px solid #f1f5f9">
      <div style="font-size:0.72rem;font-weight:800;color:#0f172a">🛒 สถานะอะไหล่งานของฉัน</div>
      <div style="font-size:0.62rem;color:#94a3b8;margin-top:2px">รายการงานที่มีการสั่งซื้ออะไหล่</div>
    </div>`;

  if (!list) return;

  // หา tickets ของ reporter ที่มี purchaseOrder
  const myTickets = (db.tickets||[]).filter(t =>
    t.reporterId === CU.id && t.purchaseOrder
  ).sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''));

  if (!myTickets.length) {
    list.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;gap:12px;color:#94a3b8">
      <div style="font-size:2.5rem">📦</div>
      <div style="font-size:0.85rem;font-weight:700;color:#64748b">ยังไม่มีรายการสั่งซื้ออะไหล่</div>
      <div style="font-size:0.72rem;text-align:center;line-height:1.6">เมื่อมีการสั่งซื้ออะไหล่สำหรับงานที่คุณแจ้ง<br>จะแสดงสถานะที่นี่</div>
    </div>`;
    return;
  }

  const STEP_LABELS = ['แจ้งรายการ','รอ Admin','Admin ออก PO','รับแล้ว'];
  const stepOf = t => {
    const po = t.purchaseOrder;
    if (!po) return 0;
    if (po.arrived) return 3;
    if (po.purchasing || (po.items&&po.items.some(x=>x.poNumber))) return 2;
    return 1;
  };

  list.innerHTML = myTickets.map(t => {
    const po = t.purchaseOrder;
    const step = stepOf(t);
    const total = (po.items||[]).reduce((s,x)=>s+(Number(x.price||0)*Number(x.qty||1)),0);
    const prList = (po.items||[]).map(x=>x.prNumber).filter(Boolean).join(', ');
    const statusColor = step===3?'#16a34a':step===2?'#0369a1':step===1?'#d97706':'#94a3b8';
    const statusBg = step===3?'#f0fdf4':step===2?'#eff6ff':step===1?'#fffbeb':'#f8fafc';
    const statusBorder = step===3?'#bbf7d0':step===2?'#bfdbfe':step===1?'#fde68a':'#e5e7eb';

    return `<div onclick="goPage('tickets');setTimeout(()=>openDetail('${t.id}'),300)"
      style="background:white;border:1px solid #f1f5f9;border-left:3px solid ${statusColor};margin:8px 14px;border-radius:12px;padding:12px;cursor:pointer;-webkit-tap-highlight-color:transparent"
      onmousedown="this.style.background='#f8fafc'" onmouseup="this.style.background='white'">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.7rem;font-family:monospace;color:#94a3b8;margin-bottom:2px">${t.id}</div>
          <div style="font-size:0.85rem;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.problem)||'—'}</div>
          <div style="font-size:0.68rem;color:#64748b;margin-top:2px">❄️ ${t.machine||'—'}</div>
        </div>
        <span style="background:${statusBg};color:${statusColor};border:1px solid ${statusBorder};border-radius:8px;padding:3px 10px;font-size:0.65rem;font-weight:800;flex-shrink:0;white-space:nowrap">${STEP_LABELS[step]}</span>
      </div>

      <!-- Progress steps -->
      <div style="display:flex;align-items:center;gap:0;margin-bottom:10px">
        ${STEP_LABELS.map((lbl,i) => {
          const done = i <= step;
          const active = i === step;
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;position:relative">
            <div style="width:20px;height:20px;border-radius:50%;background:${done?statusColor:'#e5e7eb'};display:flex;align-items:center;justify-content:center;z-index:1;position:relative">
              ${done?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>':''}
            </div>
            ${i<STEP_LABELS.length-1?`<div style="position:absolute;top:10px;left:50%;width:100%;height:2px;background:${i<step?statusColor:'#e5e7eb'}"></div>`:''}
            <div style="font-size:0.5rem;font-weight:600;color:${done?statusColor:'#94a3b8'};text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:54px">${lbl}</div>
          </div>`;
        }).join('')}
      </div>

      <!-- Items -->
      <div style="background:#f8fafc;border-radius:8px;padding:8px 10px">
        ${(po.items||[]).slice(0,3).map(x=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid #f1f5f9">
            <div style="font-size:0.72rem;color:#374151;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.name||'อะไหล่'}</div>
            <div style="font-size:0.72rem;font-weight:700;color:#0369a1;flex-shrink:0;margin-left:8px">×${x.qty||1}</div>
          </div>`).join('')}
        ${po.items&&po.items.length>3?`<div style="font-size:0.62rem;color:#94a3b8;margin-top:3px">+${po.items.length-3} รายการ</div>`:''}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
          ${prList?`<div style="font-size:0.65rem;color:#64748b">PR: ${prList}</div>`:'<div></div>'}
          ${total?`<div style="font-size:0.78rem;font-weight:900;color:#0f172a">฿${total.toLocaleString()}</div>`:''}
        </div>
      </div>
    </div>`;
  }).join('');

  // update badge
  const badge = document.getElementById('pur-reporter-badge');
  const pendingCount = myTickets.filter(t=>stepOf(t)<3).length;
  if (badge) { badge.textContent = pendingCount||''; badge.style.display = pendingCount?'flex':'none'; }
}

// ════════════════════════════════════════════════
// ADMIN VIEW — redesigned v98
// ════════════════════════════════════════════════
function renderPurchaseAdmin() {
  const hb = document.getElementById('pur-header-bar');
  // Fix: render header เสมอเมื่อ pur-header-bar ว่าง (ไม่มี pur-search)
  // แยก header render ออกจาก list render — ไม่ depend กัน
  if (hb && !document.getElementById('pur-search')) {
    hb.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:2px 0 10px">
        <div>
          <div style="font-size:1rem;font-weight:900;color:#0f172a;display:flex;align-items:center;gap:7px">
            <div style="width:30px;height:30px;background:linear-gradient(135deg,#e65100,#c2410c);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            ติดตามการสั่งซื้อ
          </div>
          <div style="font-size:0.65rem;color:#94a3b8;margin-top:2px;padding-left:37px">จัดการ PR/PO อะไหล่ทั้งหมด</div>
        </div>
        <button onclick="exportPurchaseExcel()" style="display:flex;align-items:center;gap:5px;font-size:0.72rem;padding:7px 12px;background:linear-gradient(135deg,#059669,#047857);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:700;font-family:inherit;box-shadow:0 2px 8px rgba(5,150,105,0.3)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Excel
        </button>
      </div>
      <div id="pur-kpi" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px"></div>
      <div style="display:flex;gap:5px;margin-bottom:10px;background:#f1f5f9;border-radius:12px;padding:3px">
        <button id="pur-filter-all"  onclick="setPurFilter('all')"  style="flex:1;font-size:0.65rem;padding:7px 2px;border-radius:9px;border:none;background:white;cursor:pointer;font-family:inherit;font-weight:800;color:#e65100;box-shadow:0 1px 3px rgba(0,0,0,0.1);transition:all 0.15s">ทั้งหมด</button>
        <button id="pur-filter-wait" onclick="setPurFilter('wait')" style="flex:1;font-size:0.65rem;padding:7px 2px;border-radius:9px;border:none;background:transparent;cursor:pointer;font-family:inherit;font-weight:600;color:#94a3b8;transition:all 0.15s">⏳ รอสั่ง</button>
        <button id="pur-filter-po"   onclick="setPurFilter('po')"   style="flex:1;font-size:0.65rem;padding:7px 2px;border-radius:9px;border:none;background:transparent;cursor:pointer;font-family:inherit;font-weight:600;color:#94a3b8;transition:all 0.15s">🛒 สั่งแล้ว</button>
        <button id="pur-filter-done" onclick="setPurFilter('done')" style="flex:1;font-size:0.65rem;padding:7px 2px;border-radius:9px;border:none;background:transparent;cursor:pointer;font-family:inherit;font-weight:600;color:#94a3b8;transition:all 0.15s">✅ รับแล้ว</button>
      </div>
      <div style="position:relative;margin-bottom:4px">
        <svg style="position:absolute;left:11px;top:50%;transform:translateY(-50%);pointer-events:none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="search" id="pur-search" placeholder="ค้นหา TK / อะไหล่ / MO / PR / PO..." oninput="renderPurchaseAdmin()"
          style="width:100%;box-sizing:border-box;border:1.5px solid #e2e8f0;border-radius:11px;padding:9px 12px 9px 32px;font-size:0.78rem;font-family:inherit;outline:none;background:white;transition:border-color 0.2s"
          onfocus="this.style.borderColor='#e65100'" onblur="this.style.borderColor='#e2e8f0'"/>
      </div>`;
  }
  // Always update filter tab styles inline (ไม่เรียก setPurFilter เพื่อป้องกัน recursive loop)
  ['all','wait','po','done'].forEach(x => {
    const btn = document.getElementById('pur-filter-'+x);
    if (!btn) return;
    const isActive = x === _purFilter;
    const configs = {all:{c:'#e65100'},wait:{c:'#c2410c'},po:{c:'#7c3aed'},done:{c:'#166534'}};
    btn.style.background  = isActive ? 'white' : 'transparent';
    btn.style.color       = isActive ? configs[x].c : '#94a3b8';
    btn.style.fontWeight  = isActive ? '800' : '600';
    btn.style.boxShadow   = isActive ? '0 1px 4px rgba(0,0,0,0.1)' : 'none';
  });

  // ── KPI ──
  // รวม ticket ที่: waiting_part+techRequest, หรือมี purchaseOrder (รวมถึง inprogress ที่รับของแล้ว)
  const allTk = (db.tickets||[]).filter(t =>
    (t.status === 'waiting_part' && t.techRequest?.locked) ||
    t.purchaseOrder
  );
  const nWait = allTk.filter(t => !t.purchaseOrder).length;
  const nPO   = allTk.filter(t => t.purchaseOrder && t.purchaseOrder.receiveStatus !== 'received').length;
  const nRecv = allTk.filter(t => t.purchaseOrder?.receiveStatus === 'received').length;

  const kpiEl = document.getElementById('pur-kpi');
  if (kpiEl) kpiEl.innerHTML = [
    {n:allTk.length, l:'ทั้งหมด',    c:'#1d4ed8', bg:'linear-gradient(135deg,#eff6ff,#dbeafe)', bc:'#bfdbfe', icon:'📋', filter:'all'},
    {n:nWait,        l:'รอสั่งซื้อ', c:'#c2410c', bg:'linear-gradient(135deg,#fff7ed,#ffedd5)', bc:'#fed7aa', icon:'⏳', filter:'wait'},
    {n:nPO,          l:'สั่งแล้ว',   c:'#7c3aed', bg:'linear-gradient(135deg,#faf5ff,#ede9fe)', bc:'#ddd6fe', icon:'🛒', filter:'po'},
    {n:nRecv,        l:'รับแล้ว',    c:'#166534', bg:'linear-gradient(135deg,#f0fdf4,#dcfce7)', bc:'#bbf7d0', icon:'✅', filter:'done'},
  ].map(k=>`
    <div onclick="setPurFilter('${k.filter}')"
      style="background:${k.bg};border:1.5px solid ${k.bc};border-radius:10px;padding:6px 4px;text-align:center;cursor:pointer;transition:transform 0.15s"
      onmousedown="this.style.transform='scale(0.95)'" onmouseup="this.style.transform=''">
      <div style="font-size:1.4rem;font-weight:900;color:${k.c};line-height:1">${k.n}</div>
      <div style="font-size:0.52rem;font-weight:700;color:${k.c};margin-top:2px;opacity:0.85">${k.icon} ${k.l}</div>
    </div>`).join('');

  // ── update tab style ──
  ['all','wait','po','done'].forEach(x => {
    const btn = document.getElementById('pur-filter-'+x);
    if (!btn) return;
    const isActive = x === _purFilter;
    const configs = {all:{c:'#e65100'},wait:{c:'#c2410c'},po:{c:'#7c3aed'},done:{c:'#166534'}};
    btn.style.background  = isActive ? 'white' : 'transparent';
    btn.style.color       = isActive ? configs[x].c : '#94a3b8';
    btn.style.fontWeight  = isActive ? '800' : '600';
    btn.style.boxShadow   = isActive ? '0 1px 4px rgba(0,0,0,0.1)' : 'none';
  });

  // ── Filter + Search ──
  const search = (document.getElementById('pur-search')?.value||'').toLowerCase();
  const allTickets = (db.tickets||[]).filter(t =>
    (t.status === 'waiting_part' && t.techRequest?.locked) ||
    t.purchaseOrder
  );

  const matchSearch = t => {
    if (!search) return true;
    const po = t.purchaseOrder;
    return [t.id, t.problem, t.machine, t.assignee||'',
      po?.mowr||'', po?.pr||'', po?.po||'',
      (po?.rows||[]).map(r=>r.name).join(' '),
      (t.techRequest?.rows||[]).map(r=>r.name).join(' ')
    ].join(' ').toLowerCase().includes(search);
  };

  // แยก section ตาม filter
  let waitTickets = [], poTickets = [], recvTickets = [];
  allTickets.filter(matchSearch).forEach(t => {
    const po = t.purchaseOrder;
    const isRecv = po?.receiveStatus === 'received';
    if (isRecv) recvTickets.push(t);
    else if (po) poTickets.push(t);
    else waitTickets.push(t);
  });
  waitTickets.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
  poTickets.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
  recvTickets.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));

  const listEl = document.getElementById('pur-list'); if (!listEl) return;

  // กรองตาม filter tab
  let showWait = _purFilter === 'all' || _purFilter === 'wait';
  let showPO   = _purFilter === 'all' || _purFilter === 'po';
  let showRecv = _purFilter === 'all' || _purFilter === 'done';

  if (!allTickets.filter(matchSearch).length) {
    listEl.innerHTML = `<div style="text-align:center;padding:48px 20px;color:#94a3b8">
      <div style="width:60px;height:60px;background:#f1f5f9;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;margin:0 auto 12px">🛒</div>
      <div style="font-size:0.88rem;font-weight:700;color:#374151;margin-bottom:4px">ไม่พบรายการ</div>
      <div style="font-size:0.72rem">ลองเปลี่ยน filter หรือคำค้นหา</div>
    </div>`;
    return;
  }

  // ── Card renderer (compact) ──
  const mkCard = t => {
    const po = t.purchaseOrder;
    const isRecv = po?.receiveStatus === 'received';
    const isPurchasing = po?.purchasing && !isRecv;
    const hasReq = (t.techRequest?.rows||[]).filter(r=>r.name).length > 0;
    const hasPO  = !!(po);
    const mac    = getMacMap().get(t.machineId);
    const techUser = db.users.find(u=>u.id===t.assigneeId);
    const techName = techUser?.name || t.assignee || '—';
    const serial = mac?.serial || '';
    const poRows = (po?.rows||[]).filter(r=>r.name);
    const trRows = (t.techRequest?.rows||[]).filter(r=>r.name);

    // ── Status config ──
    const stripe = isRecv?'#22c55e':isPurchasing?'#f59e0b':hasPO?'#a78bfa':hasReq?'#f97316':'#cbd5e1';
    const statusLabel = isRecv?'รับแล้ว':isPurchasing?'กำลังสั่งซื้อ':hasPO?'ออก PO แล้ว':hasReq?'รอออก PO':'รอแจ้งรายการ';
    const statusBg    = isRecv?'#dcfce7':isPurchasing?'#fef3c7':hasPO?'#ede9fe':hasReq?'#ffedd5':'#f1f5f9';
    const statusColor = isRecv?'#166534':isPurchasing?'#92400e':hasPO?'#6d28d9':hasReq?'#c2410c':'#64748b';
    const statusIcon  = isRecv?'📦':isPurchasing?'🛒':hasPO?'📋':hasReq?'⏳':'🆕';

    // ── Doc badges ──
    const docs = [
      po?.mowr?`<span style="background:#fef3c7;color:#92400e;border-radius:5px;padding:1px 7px;font-size:0.6rem;font-weight:700">MO:${po.mowr}</span>`:'',
      po?.pr?`<span style="background:#fff1f2;color:#be123c;border-radius:5px;padding:1px 7px;font-size:0.6rem;font-weight:700">PR:${po.pr}</span>`:'',
      po?.po?`<span style="background:#f5f3ff;color:#6d28d9;border-radius:5px;padding:1px 7px;font-size:0.6rem;font-weight:700">PO:${po.po}</span>`:'',
    ].filter(Boolean).join('');

    // ── Parts preview (max 2 items inline) ──
    const displayRows = poRows.length ? poRows : trRows;
    const isPORows = poRows.length > 0;
    const partPreview = displayRows.slice(0,2).map(r =>
      `<span style="font-size:0.62rem;color:#475569;background:#f8fafc;border-radius:4px;padding:1px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px">${escapeHtml(r.name)}${r.qty>1?` ×${r.qty}`:''}</span>`
    ).join('') + (displayRows.length>2?`<span style="font-size:0.6rem;color:#94a3b8">+${displayRows.length-2}</span>`:'');

    // ── Action buttons ──
    // Admin แก้ PO ได้เสมอตราบที่ยังไม่ received
    const btnPO = !isRecv ? `
      <button onclick="openPOForm('${t.id}')" style="display:flex;align-items:center;gap:4px;padding:7px 13px;background:${hasPO?'white':'linear-gradient(135deg,#e65100,#c2410c)'};color:${hasPO?'#475569':'white'};border:${hasPO?'1.5px solid #e2e8f0':'none'};border-radius:9px;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;${hasPO?'':'box-shadow:0 2px 8px rgba(230,81,0,0.25)'}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        ${hasPO?'แก้ไข PO':'กรอก PO'}
      </button>` : '';

    // "ของมาถึงแล้ว" แสดงเมื่อมี PO และยังไม่ received
    const btnArrived = hasPO && !isRecv ? `
      <button onclick="markPartsArrivedAndNotify('${t.id}')" style="display:flex;align-items:center;gap:4px;padding:7px 13px;background:linear-gradient(135deg,#16a34a,#15803d);color:white;border:none;border-radius:9px;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 2px 8px rgba(22,163,74,0.25);-webkit-tap-highlight-color:transparent" ontouchstart="this.style.opacity=0.8" ontouchend="this.style.opacity=1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        ของมาถึงแล้ว
      </button>` : '';

    const btnDetail = `<button onclick="openDetail('${t.id}')" style="padding:7px 11px;background:#f1f5f9;color:#64748b;border:none;border-radius:9px;font-size:0.68rem;font-weight:700;cursor:pointer;font-family:inherit">ดูงาน</button>`;

    // ── Received date line (แทน banner ใหญ่) ──
    const recvLine = isRecv ? `<span style="font-size:0.6rem;color:#16a34a;font-weight:600">รับแล้ว ${(po.receivedAt||'').slice(0,10)}</span>` : '';

    return `
    <div style="background:white;border-radius:14px;margin-bottom:8px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.07);border:1.5px solid ${stripe}30;position:relative">
      <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${stripe};border-radius:3px 0 0 3px"></div>

      <!-- ── Main row ── -->
      <div style="padding:10px 12px 8px 16px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div style="flex:1;min-width:0">
            <!-- TK + Status -->
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
              <span style="font-family:'JetBrains Mono',monospace;font-size:0.58rem;color:#94a3b8;font-weight:700">${t.id}</span>
              <span style="background:${statusBg};color:${statusColor};border-radius:99px;padding:1px 8px;font-size:0.6rem;font-weight:800;white-space:nowrap">${statusIcon} ${statusLabel}</span>
              ${recvLine}
            </div>
            <!-- Problem -->
            <div style="font-size:0.85rem;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:3px">${escapeHtml(t.problem)}</div>
            <!-- Machine info -->
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
              ${serial?`<span style="font-family:'JetBrains Mono',monospace;background:#e0f2fe;color:#0369a1;padding:0 5px;border-radius:4px;font-size:0.58rem;font-weight:700">${serial}</span>`:''}
              <span style="font-size:0.62rem;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:110px">${t.machine||''}</span>
              <span style="font-size:0.6rem;color:#94a3b8">· ${techName}</span>
            </div>
          </div>
          ${po?.total?`<div style="flex-shrink:0;text-align:right">
            <div style="font-size:0.92rem;font-weight:900;color:#e65100">฿${Number(po.total).toLocaleString()}</div>
          </div>`:''}
        </div>

        <!-- Doc badges -->
        ${docs?`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">${docs}</div>`:''}

        <!-- Parts preview -->
        ${partPreview?`<div style="display:flex;align-items:center;gap:4px;margin-top:5px;flex-wrap:wrap">${partPreview}</div>`:''}
      </div>

      <!-- ── Action bar ── -->
      <div style="padding:6px 12px 8px 16px;display:flex;gap:5px;align-items:center;border-top:1px solid #f1f5f9;background:#fafbff">
        ${btnPO}${btnArrived}
        <div style="flex:1"></div>
        ${btnDetail}
      </div>
    </div>`;
  };

    // ── Render sections ──
  let html = '';

  const mkSection = (title, icon, color, items, emptyMsg) => {
    if (!items.length) return '';
    return `
      <div style="margin-bottom:6px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding:0 2px">
          <div style="display:flex;align-items:center;gap:6px">
            <div style="width:22px;height:22px;border-radius:7px;background:${color};display:flex;align-items:center;justify-content:center;font-size:0.7rem;flex-shrink:0">${icon}</div>
            <span style="font-size:0.75rem;font-weight:800;color:#374151">${title}</span>
          </div>
          <span style="background:#f1f5f9;color:#64748b;border-radius:99px;padding:1px 9px;font-size:0.65rem;font-weight:700">${items.length} รายการ</span>
        </div>
        ${items.map(mkCard).join('')}
      </div>`;
  };

  if (showWait && waitTickets.length) {
    html += mkSection('รอออก PR/PO', '⏳', '#fff7ed', waitTickets, '');
  }
  if (showPO && poTickets.length) {
    html += mkSection('ออก PO แล้ว · รอรับสินค้า', '📋', '#ede9fe', poTickets, '');
  }
  if (showRecv && recvTickets.length) {
    html += mkSection('รับสินค้าแล้ว', '📦', '#dcfce7', recvTickets, '');
  }

  if (!html) {
    html = `<div style="text-align:center;padding:40px 20px;color:#94a3b8">
      <div style="font-size:0.82rem;font-weight:600">ไม่มีรายการในหมวดนี้</div>
    </div>`;
  }

  listEl.innerHTML = html;
}


function renderPurchaseTech() {
  const hb = document.getElementById('pur-header-bar');
  if (hb && !hb.innerHTML.trim()) {  // render header เมื่อว่างเท่านั้น
    hb.innerHTML = `
      <div id="pur-tech-header" style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <div style="flex:1">
          <div style="font-size:1rem;font-weight:800;color:var(--text)">🛒 รายการสั่งซื้ออะไหล่</div>
          <div style="font-size:0.7rem;color:#9ca3af;margin-top:1px">งานที่รอสั่งซื้อของฉัน</div>
        </div>
        <button onclick="exportTechReqExcel()" style="font-size:0.7rem;padding:6px 11px;background:#059669;color:white;border:none;border-radius:9px;cursor:pointer;font-weight:700;font-family:inherit;display:flex;align-items:center;gap:4px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Excel
        </button>
      </div>`;
  }

  const myTickets = (db.tickets||[]).filter(t =>
    t.assigneeId === CU.id && (t.status === 'waiting_part' || t.techRequest)
  );
  const pendingCount = myTickets.filter(t => !t.techRequest && t.status === 'waiting_part').length;
  document.querySelectorAll('#pur-badge, #pur-badge-home').forEach(b => {
    b.textContent = pendingCount||''; b.style.display = pendingCount>0?'flex':'none';
  });

  const listEl = document.getElementById('pur-list'); if (!listEl) return;

  if (!myTickets.length) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:60px 24px 40px">
        <div style="width:72px;height:72px;border-radius:20px;background:#fff7ed;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:2rem;border:2px solid #fed7aa">🔩</div>
        <div style="font-size:0.95rem;font-weight:800;color:#374151;margin-bottom:6px">ไม่มีงานรออะไหล่</div>
        <div style="font-size:0.78rem;color:#9ca3af;line-height:1.7">เมื่อคุณกดปุ่ม "รอสั่งซื้ออะไหล่"<br>ในงานซ่อม งานนั้นจะปรากฏที่นี่</div>
      </div>`;
    return;
  }

  // แยก pending กับ done
  const pending = myTickets.filter(t => t.purchaseOrder?.receiveStatus !== 'received');
  const done    = myTickets.filter(t => t.purchaseOrder?.receiveStatus === 'received');

  const renderCard = t => {
    const req = t.techRequest;
    const po  = t.purchaseOrder;
    const isRecv = po?.receiveStatus === 'received';

    // ── step ปัจจุบัน 0-3 ──
    const hasPO = !!(po?.pr || po?.po || po?.purchasing); // มี PO form แล้ว หรือ Admin กำลังดำเนินการ
    const step = isRecv ? 3 : hasPO ? 2 : req ? 1 : 0;

    const steps = [
      { icon:'📝', label:'แจ้งรายการ' },
      { icon:'⏳', label:'รอ Admin' },
      { icon:'📋', label:'Admin ออก PO' },
      { icon:'📦', label:'รับแล้ว' },
    ];

    // ── FIX v23-fix26: stepper compact ──
    const stepperHtml = `
      <div style="display:flex;align-items:flex-start;gap:0;padding:10px 12px 8px;position:relative">
        ${steps.map((s,i) => {
          const done_s  = i < step;
          const active  = i === step;
          const pending_s = i > step;
          const dotColor  = done_s ? '#e65100' : active ? '#e65100' : '#e5e7eb';
          const dotBg     = done_s ? '#e65100' : active ? '#fff7ed' : '#f9fafb';
          const dotBorder = done_s ? '#e65100' : active ? '#e65100' : '#e5e7eb';
          const textColor = active ? '#e65100' : done_s ? '#e65100' : '#9ca3af';
          const lineColor = i < step ? '#e65100' : '#e5e7eb';
          return `
            <div style="display:flex;flex-direction:column;align-items:center;flex:1;position:relative">
              ${i>0?`<div style="position:absolute;top:14px;right:50%;width:100%;height:2px;background:${i<=step?'#e65100':'#e5e7eb'};z-index:0"></div>`:''}
              <div style="width:24px;height:24px;border-radius:50%;background:${done_s?'#e65100':active?'#fff7ed':'#f9fafb'};border:2px solid ${dotBorder};display:flex;align-items:center;justify-content:center;font-size:${done_s?'0.65rem':'0.78rem'};z-index:1;flex-shrink:0">
                ${done_s ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>` : s.icon}
              </div>
              <div style="font-size:0.55rem;font-weight:${active?'800':'500'};color:${textColor};margin-top:4px;text-align:center;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:56px">${s.label}</div>
            </div>`;
        }).join('')}
      </div>`;

    // ── ticket info ──
    // ── FIX v23-fix26: infoBar compact ──
    const infoBar = `
      <div style="padding:8px 12px 8px;border-bottom:1px solid #f1f5f9">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:3px">
          <div style="font-size:0.62rem;font-weight:700;color:#94a3b8;font-family:monospace">${t.id}</div>
          <div style="font-size:0.6rem;color:#94a3b8">${(t.updatedAt||'').slice(0,10)}</div>
        </div>
        <div style="font-size:0.88rem;font-weight:800;color:#0f172a;line-height:1.3;margin-bottom:4px">${escapeHtml(t.problem)}</div>
        <div style="display:flex;gap:8px;font-size:0.65rem;color:#64748b;flex-wrap:wrap">
          <span>❄️ ${t.machine||'—'}</span>
          ${t.location?`<span>📍 ${t.location}</span>`:''}
        </div>
      </div>`;

    // ── รายการที่แจ้ง ──
    const reqRows = (req?.rows||[]).filter(r=>r.name);
    const reqTotal = reqRows.reduce((s,r)=>s+(Number(r.qty||1)*Number(r.price||0)),0);
    const reqBlock = reqRows.length ? `
      <div style="margin:8px 10px;background:#fafafa;border:1px solid #f0f0f0;border-radius:10px;overflow:hidden">
        <div style="padding:6px 10px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f0f0f0;background:#f8fafc">
          <span style="font-size:0.68rem;font-weight:800;color:#374151">รายการที่แจ้ง</span>
          <span style="font-size:0.65rem;color:#9ca3af">${(req.requestedAt||'').slice(0,10)}</span>
        </div>
        ${reqRows.map((r,i)=>`
          <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid #f4f4f5">
            <div style="width:18px;height:18px;border-radius:5px;background:#e65100;color:white;font-size:0.6rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.8rem;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.name}</div>
              ${r.note?`<div style="font-size:0.65rem;color:#9ca3af">${escapeHtml(r.note)}</div>`:''}
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:0.72rem;color:#6b7280">×${r.qty||1}</div>
              ${r.price?`<div style="font-size:0.72rem;font-weight:700;color:#e65100">฿${Number(r.price).toLocaleString()}</div>`:''}
            </div>
          </div>`).join('')}
        ${reqTotal?`<div style="padding:6px 10px;display:flex;justify-content:space-between;align-items:center;background:#fff7ed">
          <span style="font-size:0.7rem;font-weight:700;color:#92400e">รวมประมาณ</span>
          <span style="font-size:0.85rem;font-weight:900;color:#e65100">฿${reqTotal.toLocaleString()}</span>
        </div>`:''}
        ${req.note?`<div style="padding:7px 12px;background:#fffbeb;font-size:0.7rem;color:#78716c;border-top:1px solid #fde68a">📝 ${escapeHtml(req.note)}</div>`:''}
      </div>` : '';

    // ── เลขเอกสาร (จาก Admin) ──
    const poBlock = po && (po.mowr || po.pr || po.po) ? `
      <div style="margin:0 14px 10px;display:flex;flex-direction:column;gap:6px">
        ${(po.mowr||po.pr) ? `
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:9px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${po.mowr?`<span style="font-size:0.7rem;color:#92400e"><b>MO:</b> ${po.mowr}</span>`:''}
            ${po.pr?`<span style="font-size:0.72rem;font-weight:800;color:#e65100"><b>PR:</b> ${po.pr}</span>`:''}
          </div>` : ''}
        ${po.po ? `
          <div style="background:#f5f3ff;border:1px solid #c4b5fd;border-radius:10px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:0.68rem;font-weight:700;color:#7c3aed">📋 PO No.</span>
            <span style="font-size:0.85rem;font-weight:900;color:#7c3aed">${po.po}</span>
          </div>` : ''}
        ${po.total ? `
          <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;padding:7px 12px;display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:0.68rem;color:#9ca3af">มูลค่ารวม</span>
            <span style="font-size:0.82rem;font-weight:900;color:#e65100">฿${Number(po.total).toLocaleString()}</span>
          </div>` : ''}
      </div>` : '';

    // ── received banner ──
    const recvBanner = isRecv ? `
      <div style="margin:0 14px 12px;background:linear-gradient(135deg,#d1fae5,#a7f3d0);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px">
        <div style="font-size:1.6rem">📦</div>
        <div>
          <div style="font-size:0.82rem;font-weight:800;color:#065f46">อะไหล่มาถึงแล้ว! พร้อมซ่อม</div>
          <div style="font-size:0.68rem;color:#059669;margin-top:2px">รับเมื่อ ${po.receivedAt||''} · โดย ${po.receivedBy||'Admin'}</div>
        </div>
      </div>` : '';

    // ── action button ──
    let actionBtn = '';
    if (!req && !isRecv) {
      actionBtn = `
        <div style="padding:12px 14px 14px">
          <div style="display:flex;align-items:center;gap:8px;background:#fff7ed;border-radius:10px;padding:10px 12px;margin-bottom:10px">
            <div style="font-size:1.2rem">👆</div>
            <div style="font-size:0.74rem;color:#92400e;font-weight:600;line-height:1.5">กรุณาแจ้งรายการอะไหล่<br>เพื่อให้ Admin ดำเนินการออก PO</div>
          </div>
          <button onclick="openTechReqForm('${t.id}')"
            style="width:100%;padding:15px;background:linear-gradient(135deg,#e65100,#c0392b);color:white;border:none;border-radius:13px;font-size:0.92rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 16px rgba(230,81,0,0.35)">
            + แจ้งรายการอะไหล่ที่ต้องสั่ง
          </button>
        </div>`;
    } else if (req && !hasPO && !isRecv) {
      actionBtn = `
        <div style="padding:8px 14px 14px">
          <div style="background:#fffbeb;border:1px dashed #d97706;border-radius:10px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:center;gap:8px">
            <div style="font-size:1.1rem">⏳</div>
            <div style="font-size:0.74rem;color:#92400e;font-weight:600;line-height:1.5">ส่งรายการให้ Admin แล้ว<br>รอ Admin ออกใบสั่งซื้อ (PO)</div>
          </div>
          <button onclick="openTechReqForm('${t.id}')"
            style="width:100%;padding:11px;background:white;color:#374151;border:1.5px solid #e5e7eb;border-radius:11px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit">
            ✏️ แก้ไขรายการ
          </button>
        </div>`;
    } else if (hasPO && !isRecv) {
      const docLine = [po.pr?'PR: '+po.pr:'', po.po?'PO: '+po.po:''].filter(Boolean).join(' · ');
      actionBtn = `
        <div style="padding:8px 14px 14px">
          <div style="background:#f5f3ff;border-radius:10px;padding:10px 12px;font-size:0.74rem;color:#7c3aed;font-weight:600;display:flex;align-items:center;gap:8px">
            <div style="font-size:1.1rem">📋</div>
            <div>Admin ออกใบสั่งซื้อแล้ว — รอรับอะไหล่<br><span style="font-size:0.68rem;font-weight:400;color:#a78bfa">${docLine}</span></div>
          </div>
        </div>`;
    }

    // ── FIX v23-fix26: card wrapper tighter ──
    const borderColor = isRecv?'#6ee7b7':hasPO?'#c4b5fd':req?'#fcd34d':'#fdba74';
    const headerBg    = isRecv?'#ecfdf5':hasPO?'#f5f3ff':req?'#fffbeb':'#fff7ed';

    return `
      <div style="background:white;border:1.5px solid ${borderColor};border-radius:14px;margin-bottom:10px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.05)">
        <div style="background:${headerBg}">
          ${stepperHtml}
        </div>
        ${infoBar}
        ${reqBlock}
        ${poBlock}
        ${recvBanner}
        ${actionBtn}
        <div style="padding:0 10px 10px">
          <button onclick="openDetail('${t.id}')" style="width:100%;padding:8px;background:#f8fafc;color:#64748b;border:1px solid #e5e7eb;border-radius:9px;font-size:0.73rem;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:5px">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            ดูรายละเอียดงาน
          </button>
        </div>
      </div>`;
  };

  let html = '';
  if (pending.length) {
    html += pending.sort((a,b)=>{
      const sa = !a.techRequest ? 0 : !a.purchaseOrder ? 1 : 2;
      const sb = !b.techRequest ? 0 : !b.purchaseOrder ? 1 : 2;
      return sa - sb;
    }).map(renderCard).join('');
  }
  if (done.length) {
    html += `<div style="display:flex;align-items:center;gap:8px;margin:16px 0 10px">
      <div style="flex:1;height:1px;background:#e5e7eb"></div>
      <div style="font-size:0.68rem;font-weight:700;color:#9ca3af">✅ รับอะไหล่แล้ว</div>
      <div style="flex:1;height:1px;background:#e5e7eb"></div>
    </div>` + done.map(renderCard).join('');
  }
  listEl.innerHTML = html;
}

// ── Tech Request Form (bottom sheet) ──
function showLockedTechReq(t) {
  // แสดง popup สำหรับรายการที่ส่ง Admin แล้ว — ช่างแก้ไขได้ถ้างานยังไม่ปิด
  document.querySelectorAll('.tech-req-overlay,.tech-req-sheet').forEach(e=>e.remove());
  const tr = t.techRequest;
  const rows = tr?.rows || [];
  const total = rows.reduce((s,r)=>s+(Number(r.qty||1)*Number(r.price||0)),0);
  // งานปิดแล้ว — แก้ไขไม่ได้
  const isClosed = ['closed','verified','done'].includes(t.status);
  // Admin กรอก PO แล้ว — ช่างไม่ควรแก้ไข
  const hasAdminPO = !!(t.purchaseOrder?.pr || t.purchaseOrder?.po || t.purchaseOrder?.purchasing);

  const ov = document.createElement('div');
  ov.className = 'tech-req-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:9100;backdrop-filter:blur(3px)';
  const closeAll = () => document.querySelectorAll('.tech-req-overlay,.tech-req-sheet').forEach(e=>e.remove());
  ov.onclick = e => { if(e.target===ov) closeAll(); };

  const sh = document.createElement('div');
  sh.className = 'tech-req-sheet';
  sh.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9200;background:#f8fafc;border-radius:22px 22px 0 0;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 -12px 48px rgba(0,0,0,0.18)';

  // ปุ่มแก้ไข — แสดงเฉพาะ: ยังไม่ปิด + Admin ยังไม่ได้กรอก PO
  const canEdit = !isClosed && !hasAdminPO;
  const editBtn = canEdit
    ? `<button onclick="unlockAndEditTechReq('${t.id}')"
        style="background:#e65100;color:white;border:none;border-radius:11px;padding:9px 14px;font-size:0.78rem;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px">
        ✏️ แก้ไขรายการ
       </button>`
    : isClosed
    ? `<span style="font-size:0.62rem;color:#94a3b8;background:#f1f5f9;padding:4px 10px;border-radius:8px">🔒 ปิดงานแล้ว</span>`
    : `<span style="font-size:0.62rem;color:#6d28d9;background:#f5f3ff;padding:4px 10px;border-radius:8px">🛒 Admin ดำเนินการแล้ว</span>`;

  sh.innerHTML = `
    <div style="display:flex;justify-content:center;padding:10px 0 0;flex-shrink:0">
      <div style="width:36px;height:4px;background:#cbd5e1;border-radius:99px"></div>
    </div>
    <div style="padding:12px 18px 14px;flex-shrink:0;border-bottom:1px solid #e2e8f0">
      <div style="display:flex;align-items:center;gap:10px">
        <button onclick="document.querySelectorAll('.tech-req-overlay,.tech-req-sheet').forEach(e=>e.remove())"
          style="width:34px;height:34px;border-radius:50%;background:#e2e8f0;border:none;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center">‹</button>
        <div style="flex:1">
          <div style="font-size:0.92rem;font-weight:800;color:#0f172a">📋 รายการสั่งซื้ออะไหล่</div>
          <div style="font-size:0.68rem;color:#64748b;margin-top:1px">${t.id} · ${escapeHtml(t.problem)}</div>
        </div>
        ${editBtn}
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:14px 16px">
      <div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:11px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:0.6rem;color:#9ca3af;font-weight:600;text-transform:uppercase">ราคาประมาณรวม</div>
          <div style="font-size:1.2rem;font-weight:900;color:#e65100">฿${total.toLocaleString()}</div>
        </div>
        <div style="font-size:0.7rem;color:#64748b;font-weight:600">${rows.length} รายการ</div>
      </div>
      ${rows.map((r,i)=>`
        <div style="background:white;border:1.5px solid #e2e8f0;border-radius:12px;margin-bottom:6px;overflow:hidden">
          <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #f1f5f9">
            <div style="width:24px;height:24px;border-radius:7px;background:#e65100;color:white;font-size:0.68rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
            <div style="flex:1;font-size:0.86rem;font-weight:700;color:#0f172a">${r.name}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #f1f5f9">
            <div style="padding:8px 14px;border-right:1px solid #f1f5f9">
              <div style="font-size:0.6rem;font-weight:700;color:#9ca3af;text-transform:uppercase">จำนวน</div>
              <div style="font-size:0.95rem;font-weight:800;color:#0f172a;margin-top:2px">${r.qty||1} ชิ้น</div>
            </div>
            <div style="padding:8px 14px">
              <div style="font-size:0.6rem;font-weight:700;color:#9ca3af;text-transform:uppercase">ราคา / ชิ้น</div>
              <div style="font-size:0.95rem;font-weight:800;color:#e65100;margin-top:2px">฿${Number(r.price||0).toLocaleString()}</div>
            </div>
          </div>
          ${r.note?`<div style="padding:7px 14px;background:#f8fafc;font-size:0.72rem;color:#64748b">${escapeHtml(r.note)}</div>`:''}
        </div>`).join('')}
      ${tr?.note?`<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px 14px;font-size:0.78rem;color:#92400e;margin-top:4px"><span style="font-weight:700">หมายเหตุ:</span> ${tr.note}</div>`:''}
      <div style="margin-top:10px;font-size:0.65rem;color:#9ca3af;text-align:center">ส่งเมื่อ ${(tr?.requestedAt||'').substring(5,16).replace('T',' ')} โดย ${tr?.requestedBy||'—'}</div>
      ${canEdit?`<div style="margin-top:8px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 12px;font-size:0.7rem;color:#92400e;text-align:center">⚠️ การแก้ไขจะยกเลิกรายการเดิมและส่งใหม่อีกครั้ง</div>`:''}
      <div style="height:20px"></div>
    </div>`;
  document.body.appendChild(ov);
  document.body.appendChild(sh);
}

function unlockAndEditTechReq(tid) {
  // ปลด lock แล้วเปิดฟอร์มแก้ไข
  document.querySelectorAll('.tech-req-overlay,.tech-req-sheet').forEach(e=>e.remove());
  const t = db.tickets.find(x=>x.id===tid); if(!t) return;
  if (t.techRequest) t.techRequest.locked = false;
  openTechReqForm(tid);
}

function openTechReqForm(tid) {
  _techReqTid = tid;
  const t = db.tickets.find(x=>x.id===tid); if (!t) return;
  // ❌ งานปิดแล้ว — ห้ามแก้ไขทุกกรณี
  if (['closed','verified','done'].includes(t.status)) {
    showToast('🔒 งานปิดแล้ว ไม่สามารถแก้ไขรายการได้'); return;
  }
  // Admin ไม่มีสิทธิ์แก้ไขรายการช่าง — ให้ใช้ openPOForm แทน
  if (CU?.role === 'admin') {
    showToast('ℹ️ Admin กรุณาใช้ "กรอก PR/PO" แทน');
    setTimeout(() => openPOForm(tid), 300);
    return;
  }
  const saved = t.techRequest;
  // ถ้า locked (ส่ง Admin แล้ว) — เปิด view พร้อมปุ่มแก้ไข
  if (saved?.locked) {
    showLockedTechReq(t); return;
  }
  _techReqRows = saved?.rows?.length
    ? saved.rows.map(r=>({name:r.name||'',qty:r.qty||1,price:Number(r.price)||0,note:r.note||''}))
    : [{name:'',qty:1,price:0,note:''}];
  document.querySelectorAll('.tech-req-overlay,.tech-req-sheet').forEach(e=>e.remove());

  const ov = document.createElement('div');
  ov.className = 'tech-req-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:9100;backdrop-filter:blur(3px)';
  ov.onclick = e => { if(e.target===ov) closeTechReqForm(); };

  const sh = document.createElement('div');
  sh.className = 'tech-req-sheet';
  sh.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9200;background:#f8fafc;border-radius:22px 22px 0 0;max-height:93vh;display:flex;flex-direction:column;box-shadow:0 -12px 48px rgba(0,0,0,0.18)';
  sh.innerHTML = `
    <!-- handle -->
    <div style="display:flex;justify-content:center;padding:10px 0 0;flex-shrink:0">
      <div style="width:36px;height:4px;background:#cbd5e1;border-radius:99px"></div>
    </div>
    <!-- header -->
    <div style="padding:12px 18px 14px;flex-shrink:0;border-bottom:1px solid #e2e8f0;background:#f8fafc">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <button onclick="closeTechReqForm()" style="width:34px;height:34px;border-radius:50%;background:#e2e8f0;border:none;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;flex-shrink:0">‹</button>
        <div style="flex:1">
          <div style="font-size:0.92rem;font-weight:800;color:#0f172a">แจ้งรายการสั่งซื้ออะไหล่</div>
          <div style="font-size:0.68rem;color:#64748b;margin-top:1px">${tid} · ${escapeHtml(t.problem)}</div>
        </div>
        <button onclick="saveTechReq()" style="background:#e65100;color:white;border:none;border-radius:11px;padding:9px 16px;font-size:0.82rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 3px 10px rgba(230,81,0,0.3)">ส่งให้ Admin</button>
      </div>
      <!-- machine info pill -->
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span style="background:#fff7ed;border:1px solid #fed7aa;border-radius:99px;padding:3px 10px;font-size:0.68rem;font-weight:700;color:#92400e">❄️ ${t.machine||'—'}</span>
        <span style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:99px;padding:3px 10px;font-size:0.68rem;font-weight:600;color:#64748b">📍 ${t.location||'—'}</span>
      </div>
    </div>
    <!-- body -->
    <div style="flex:1;overflow-y:auto;padding:14px 16px">
      <!-- total bar (sticky summary) -->
      <div style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:11px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
        <div>
          <div style="font-size:0.6rem;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">ราคาประมาณรวม</div>
          <div id="tech-req-total-val" style="font-size:1.2rem;font-weight:900;color:#e65100;margin-top:1px">฿0</div>
        </div>
        <div id="tech-req-count" style="font-size:0.7rem;color:#64748b;font-weight:600">0 รายการ</div>
      </div>
      <!-- column header — Bug5 fix -->
      <div style="display:grid;grid-template-columns:1fr 80px 100px;gap:6px;padding:4px 14px 6px;font-size:0.6rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em">
        <div>ชื่ออะไหล่ / ชิ้นส่วน</div>
        <div style="text-align:center">จำนวน</div>
        <div style="text-align:right">ราคา / ชิ้น (฿)</div>
      </div>
      <!-- rows -->
      <div id="tech-req-rows"></div>
      <!-- add button -->
      <button onclick="addTechReqRow()" style="width:100%;padding:13px;background:white;border:2px dashed #cbd5e1;border-radius:13px;color:#64748b;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:14px;display:flex;align-items:center;justify-content:center;gap:6px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        เพิ่มรายการอะไหล่
      </button>
      <!-- note -->
      <div style="background:white;border:1.5px solid #e2e8f0;border-radius:13px;padding:12px;margin-bottom:14px">
        <div style="font-size:0.68rem;font-weight:700;color:#94a3b8;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em">หมายเหตุเพิ่มเติม</div>
        <textarea id="tech-req-note" rows="2" placeholder="เช่น ความเร่งด่วน, spec พิเศษ, ผู้จัดหาที่แนะนำ..."
          style="width:100%;border:none;outline:none;font-size:0.82rem;font-family:inherit;resize:none;color:#374151;background:transparent;box-sizing:border-box">${saved?.note||''}</textarea>
      </div>
      <div style="height:8px"></div>
    </div>
    <!-- sticky footer — Bug7 fix: ปุ่มบันทึกไม่หลุดจอ -->
    <div style="flex-shrink:0;background:white;border-top:1px solid #f1f5f9;padding:12px 16px calc(env(safe-area-inset-bottom,0px) + 12px);display:flex;gap:8px;box-shadow:0 -4px 16px rgba(0,0,0,0.06)">
      <button onclick="closeTechReqForm()" style="flex:1;padding:13px;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit">ยกเลิก</button>
      <button onclick="saveTechReq()"
        style="flex:2;padding:13px;background:linear-gradient(135deg,#e65100,#c0392b);color:white;border:none;border-radius:12px;font-size:0.88rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(230,81,0,0.3);display:flex;align-items:center;justify-content:center;gap:6px">
        💾 บันทึก &amp; ส่งให้ Admin
      </button>
    </div>`;

  document.body.appendChild(ov);
  document.body.appendChild(sh);
  renderTechReqRows();

  // ── FIX v23-fix27: keyboard overlap — ทำให้ footer ไม่ทับ keyboard ──
  if (window.visualViewport) {
    const _footer = sh.querySelector('div[style*="flex-shrink:0;background:white;border-top"]');
    const _kbFix = () => {
      if (!document.body.contains(sh)) {
        window.visualViewport.removeEventListener('resize', _kbFix);
        window.visualViewport.removeEventListener('scroll', _kbFix);
        return;
      }
      const vvh    = window.visualViewport.height;
      const vvTop  = window.visualViewport.offsetTop;
      const winH   = window.innerHeight;
      const kbH    = winH - vvh - vvTop; // ความสูง keyboard
      // ขยับ sheet ทั้งก้อนขึ้นตาม keyboard
      sh.style.maxHeight = (vvh * 0.96) + 'px';
      sh.style.bottom    = Math.max(0, kbH) + 'px';
      sh.style.transform = 'none';
    };
    window.visualViewport.addEventListener('resize', _kbFix);
    window.visualViewport.addEventListener('scroll', _kbFix);
    _kbFix(); // รันทันที
  }
}
function closeTechReqForm() {
  document.querySelectorAll('.tech-req-overlay,.tech-req-sheet').forEach(e=>e.remove());
  _techReqTid = null; _techReqRows = [];
  // กลับไปหน้า purchase tab รออะไหล่ เสมอ
  if (CU?.role === 'tech') {
    setPurFilter('wait');
    goPage('purchase');
  }
}
function renderTechReqRows() {
  const box = document.getElementById('tech-req-rows'); if (!box) return;
  box.innerHTML = _techReqRows.map((r,i) => `
    <div style="background:white;border:1.5px solid #e2e8f0;border-radius:12px;margin-bottom:6px;overflow:hidden">
      <!-- name row -->
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #f1f5f9">
        <div style="width:24px;height:24px;border-radius:7px;background:#e65100;color:white;font-size:0.68rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
        <input type="text" value="${r.name}" placeholder="ชื่ออะไหล่ / ชิ้นส่วน *"
          style="flex:1;border:none;outline:none;font-size:0.86rem;font-weight:700;font-family:inherit;color:#0f172a;background:transparent"
          oninput="_techReqRows[${i}].name=this.value"/>
        ${_techReqRows.length>1?`<button onclick="removeTechReqRow(${i})" title="ลบ"
          style="width:26px;height:26px;border-radius:50%;background:#fee2e2;border:none;cursor:pointer;color:#ef4444;font-size:0.9rem;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>`:''}
      </div>
      <!-- qty + price — FIX v23-fix27: compact single row ──-->
      <div style="display:flex;align-items:center;gap:8px;padding:6px 12px 6px;border-bottom:1px solid #f1f5f9">
        <span style="font-size:0.62rem;font-weight:600;color:#9ca3af;white-space:nowrap">จำนวน</span>
        <button onclick="_techReqRows[${i}].qty=Math.max(1,(_techReqRows[${i}].qty||1)-1);renderTechReqRows()"
          style="width:22px;height:22px;border-radius:6px;background:#f1f5f9;border:1px solid #e2e8f0;cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:700;color:#374151;line-height:1">−</button>
        <input type="number" value="${r.qty||1}" min="1"
          style="width:36px;border:1px solid #e2e8f0;border-radius:6px;outline:none;font-size:0.85rem;font-weight:700;font-family:inherit;text-align:center;color:#0f172a;background:white;padding:2px 4px"
          oninput="_techReqRows[${i}].qty=parseInt(this.value)||1;updateTechReqTotal()"/>
        <button onclick="_techReqRows[${i}].qty=(_techReqRows[${i}].qty||1)+1;renderTechReqRows()"
          style="width:22px;height:22px;border-radius:6px;background:#f1f5f9;border:1px solid #e2e8f0;cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:700;color:#374151;line-height:1">+</button>
        <span style="font-size:0.62rem;font-weight:600;color:#9ca3af;white-space:nowrap;margin-left:8px">ราคา/ชิ้น (฿)</span>
        <input type="number" value="${r.price||''}" placeholder="0"
          style="flex:1;min-width:60px;border:1px solid #e2e8f0;border-radius:6px;outline:none;font-size:0.85rem;font-weight:700;font-family:inherit;color:#e65100;background:white;padding:2px 6px;text-align:right;box-sizing:border-box"
          oninput="_techReqRows[${i}].price=parseFloat(this.value)||0;updateTechReqTotal()"/>
      </div>
      <!-- subtotal + note -->
      <div style="display:flex;align-items:center;gap:6px;padding:5px 12px;background:#f8fafc">
        <input type="text" value="${r.note||''}" placeholder="หมายเหตุ: ยี่ห้อ / รุ่น / spec..."
          style="flex:1;border:none;outline:none;font-size:0.74rem;font-family:inherit;color:#64748b;background:transparent"
          oninput="_techReqRows[${i}].note=this.value"/>
        ${(r.qty||1)*(r.price||0)>0?`<div style="font-size:0.72rem;font-weight:800;color:#e65100;flex-shrink:0;background:#fff7ed;padding:3px 8px;border-radius:6px">฿${((r.qty||1)*(r.price||0)).toLocaleString()}</div>`:''}
      </div>
    </div>`).join('');
  updateTechReqTotal();
}
function addTechReqRow() {
  _techReqRows.push({name:'',qty:1,price:0,note:''});
  renderTechReqRows();
  // scroll to new row
  setTimeout(()=>{ const rows = document.querySelectorAll('#tech-req-rows > div'); if(rows.length) rows[rows.length-1].scrollIntoView({behavior:'smooth'}); },100);
}
function removeTechReqRow(i) {
  _techReqRows.splice(i,1);
  renderTechReqRows();
}
function updateTechReqTotal() {
  const total = _techReqRows.reduce((s,r)=>s+(Number(r.qty||1)*Number(r.price||0)),0);
  const count = _techReqRows.filter(r=>r.name.trim()).length;
  const el = document.getElementById('tech-req-total-val');
  const cnt = document.getElementById('tech-req-count');
  if (el) el.textContent = '฿'+(total?total.toLocaleString():'0');
  if (cnt) cnt.textContent = count+' รายการ';
}
function saveTechReq() {
  const tid = _techReqTid; if (!tid) return;
  const t = db.tickets.find(x=>x.id===tid); if (!t) return;
  // ❌ งานปิดแล้ว — ห้ามแก้ไขทุกกรณี
  if (['closed','verified','done'].includes(t.status)) {
    showToast('🔒 งานปิดแล้ว ไม่สามารถแก้ไขรายการได้');
    closeTechReqForm(); return;
  }
  const rows = _techReqRows.filter(r=>r.name.trim());
  if (!rows.length) { showToast('⚠️ กรุณาระบุชื่ออะไหล่อย่างน้อย 1 รายการ'); return; }
  // validate ชื่อ + จำนวน + ราคา ต้องกรอกให้ครบ
  for (let i=0; i<rows.length; i++) {
    if (!rows[i].name.trim()) { showToast(`⚠️ รายการที่ ${i+1}: กรุณาระบุชื่ออะไหล่`); return; }
    if (!(rows[i].qty >= 1))  { showToast(`⚠️ รายการที่ ${i+1}: จำนวนต้องมากกว่า 0`); return; }
    if (!(rows[i].price > 0)) { showToast(`⚠️ รายการที่ ${i+1}: กรุณาระบุราคา (ต้องมากกว่า 0)`); return; }
  }
  const note = document.getElementById('tech-req-note')?.value.trim()||'';
  const total = rows.reduce((s,r)=>s+(Number(r.qty||1)*Number(r.price||0)),0);
  const now = nowStr();
  // lock หลัง save — ช่างแก้ไขไม่ได้จนกว่าจะ unlock
  t.techRequest = { rows, note, total, requestedAt:now, requestedBy:CU.name, locked:true };
  // เปลี่ยน status เป็น waiting_part พร้อมกัน (ถ้ายังไม่ใช่)
  if (t.status !== 'waiting_part') {
    t.status = 'waiting_part';
    if (!t.waitPart) t.waitPart = { items: rows.map(r=>r.name).join(', '), requestedAt:now, requestedBy:CU.name };
  }
  t.updatedAt = now;
  t.history = t.history||[];
  t.history.push({act:'📋 แจ้งรายการสั่งซื้ออะไหล่',by:CU.name,at:now,detail:rows.map(r=>r.name+(r.qty>1?` ×${r.qty}`:'')).join(', ')});
  // notify admins
  const itemList = rows.map(r=>r.name+(r.qty>1?` ×${r.qty}`:'')).join(', ');
  db.users.filter(u=>u.role==='admin').forEach(u=>{
    notifyUser(u.id,'📋 แจ้งสั่งซื้ออะไหล่ ['+tid+']',
      CU.name+': '+itemList+(total?` รวม ฿${total.toLocaleString()}`:''), tid);
  });
  showAdminCard('📋 สั่งซื้ออะไหล่ ['+tid+']', CU.name+': '+itemList, tid, '📋');
  saveDB(); syncTicket(t);
  // ── LINE Push: แจ้ง Admin ทันทีเมื่อช่างส่งรายการ ──
  if (typeof lineMessagingEvent === 'function') {
    lineMessagingEvent('techreq', t).catch(e => console.warn('[LINE techreq]', e));
  }
  closeTechReqForm();
  showToast('✅ แจ้งรายการสั่งซื้อแล้ว — Admin จะดำเนินการ');
  if (navigator.vibrate) navigator.vibrate([50,30,80]);
  // กลับไปหน้า purchase tab "รออะไหล่" เสมอ
  setPurFilter('wait');
  goPage('purchase');
}
// อัปเดต PR หรือ PO ของแต่ละ row โดยตรงจาก card ติดตาม
// admin กดยืนยัน "ออก PR แล้ว" → แจ้งช่าง + ผู้แจ้ง
// admin กดยืนยัน "อะไหล่มาถึง" → แจ้งช่าง + ผู้แจ้ง
function markPartsArrivedAndNotify(tid) {
  const t = db.tickets.find(x=>x.id===tid); if(!t) return;
  if (!t.purchaseOrder) return showToast('⚠️ ไม่มีข้อมูลใบสั่งซื้อ');
  const now = nowStr();
  t.purchaseOrder.receiveStatus = 'received';
  t.purchaseOrder.receivedAt = now;
  t.purchaseOrder.receivedBy = CU.name;
  t.status = 'inprogress'; // ← เปลี่ยนกลับให้ช่างซ่อมต่อได้
  t.updatedAt = now;
  t.history = t.history||[];
  t.history.push({act:'📦 อะไหล่มาถึงแล้ว — พร้อมซ่อมต่อ รับโดย '+CU.name,by:CU.name,at:now});
  const itemList = (t.purchaseOrder.rows||[]).filter(r=>r.name).map(r=>r.name).join(', ') || 'อะไหล่';
  const msg = '📦 '+itemList+' มาถึงแล้ว! — กรุณาดำเนินการซ่อมต่อ';
  if (t.assigneeId) notifyUser(t.assigneeId, '📦 อะไหล่มาถึงแล้ว! ดำเนินการซ่อมต่อ ['+tid+']', msg, tid);
  if (t.reporterId) notifyUser(t.reporterId, '📦 อะไหล่มาถึงแล้ว ['+tid+']', '📦 '+itemList+' — ช่างกำลังดำเนินการซ่อมต่อ', tid);
  saveDB(); syncTicket(t);
  showToast('✅ บันทึกแล้ว แจ้งช่างและผู้แจ้งแล้ว');
  renderTickets(); renderPurchase();
}


function markPOReceived(tid) {
  const t = db.tickets.find(x=>x.id===tid);
  if (!t || !t.purchaseOrder) return showToast('⚠️ ยังไม่มีใบสั่งซื้อ');
  const po = t.purchaseOrder;
  po.receiveStatus = 'received';
  po.receivedAt    = nowStr();
  po.receivedBy    = CU.name;
  t.status = 'inprogress'; // ← เปลี่ยนกลับให้ช่างซ่อมต่อได้
  t.updatedAt = nowStr();
  t.history = t.history||[];
  t.history.push({act:'📦 อะไหล่มาถึงแล้ว — พร้อมซ่อมต่อ รับโดย '+CU.name, by:CU.name, at:nowStr()});

  // แจ้งช่างที่รับผิดชอบงานนี้
  if (t.assigneeId) {
    const itemList = po.rows?.filter(r=>r.name).map(r=>r.name).join(', ') || 'อะไหล่';
    notifyUser(
      t.assigneeId,
      '📦 อะไหล่มาถึงแล้ว!',
      '['+tid+'] '+itemList+' — พร้อมดำเนินการซ่อม',
      tid
    );
  }
  // แจ้ง admin ทุกคน (ยกเว้นตัวเอง)
  db.users.filter(u=>u.role==='admin' && u.id!==CU.id).forEach(u => {
    notifyUser(u.id, '📦 รับอะไหล่แล้ว ['+tid+']',
      CU.name+' บันทึกรับอะไหล่ '+t.problem, tid);
  });

  saveDB(); syncTicket(t);
  showToast('✅ บันทึกรับอะไหล่แล้ว — แจ้งช่างเรียบร้อย');
  renderPurchase();
  updateOpenBadge();
}

function exportPurchaseExcel() {
  if (typeof XLSX === 'undefined') { waitForXLSX(exportPurchaseExcel); return; }
  const wb = XLSX.utils.book_new();
  const today = new Date().toLocaleDateString('th-TH');

  // ── Sheet 1: สรุปรายการสั่งซื้อ ──
  const sumRows = [['TK','ปัญหา','เครื่อง','ตำแหน่ง','ช่าง','สถานะ','อะไหล่ (แจ้งเบื้องต้น)','MO/WR','PR หลัก','PO','มูลค่า PO (฿)','บันทึกโดย','บันทึกวันที่','สถานะรับ','รับวันที่']];
  (db.tickets||[]).filter(t => t.waitPart || t.purchaseOrder || t.techRequest).forEach(t => {
    const po = t.purchaseOrder||{}; const wp = t.waitPart||{}; const tr = t.techRequest||{};
    const recv = po.receiveStatus==='received';
    sumRows.push([
      t.id, t.problem, t.machine, t.location||'—', t.assignee||'—',
      recv?'รับแล้ว':po.po?'มี PO':tr.rows?.length?'ช่างแจ้งแล้ว':'รอสั่งซื้อ',
      wp.items || (tr.rows||[]).filter(r=>r.name).map(r=>r.name).join(', ') || '—',
      po.mowr||'—', po.pr||'—', po.po||'—',
      Number(po.total||0), po.savedBy||'—', po.savedAt||'—',
      recv?'✅ รับแล้ว':'⏳ รอรับ', po.receivedAt||'—'
    ]);
  });
  const ws1 = XLSX.utils.aoa_to_sheet(sumRows);
  ws1['!cols'] = [8,20,20,14,14,14,22,12,12,12,14,12,16,12,16].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws1, 'สรุปสั่งซื้อ');

  // ── Sheet 2: รายการที่ช่างแจ้ง (techRequest) ──
  const trRows = [['TK','ปัญหา','เครื่อง','ตำแหน่ง','ช่างผู้แจ้ง','วันที่แจ้ง','#','ชื่ออะไหล่','จำนวน','ราคาประมาณ/ชิ้น (฿)','รวม (฿)','หมายเหตุ','สถานะ PO']];
  (db.tickets||[]).filter(t => t.techRequest?.rows?.length).forEach(t => {
    const tr = t.techRequest; const po = t.purchaseOrder;
    const hasPO = !!po?.po;
    tr.rows.filter(r=>r.name).forEach((r,i) => {
      trRows.push([
        t.id, t.problem, t.machine, t.location||'—',
        tr.requestedBy||'—', (tr.requestedAt||'').slice(0,16),
        i+1, r.name, r.qty||1,
        Number(r.price||0), (r.qty||1)*Number(r.price||0),
        r.note||'—', hasPO?`PO: ${po.po}`:'ยังไม่มี PO'
      ]);
    });
  });
  const ws2 = XLSX.utils.aoa_to_sheet(trRows);
  ws2['!cols'] = [8,18,18,14,14,16,4,24,8,14,12,18,14].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws2, 'รายการช่างแจ้ง');

  // ── Sheet 3: รายการ PO (รายละเอียด) ──
  const detRows = [['TK','ปัญหา','เครื่อง','MO/WR','PR หลัก','PO','#','ชื่ออะไหล่','PR รายการ','จำนวน','ราคา/ชิ้น (฿)','รวม (฿)','สถานะรับ']];
  (db.tickets||[]).filter(t => t.purchaseOrder?.rows?.length).forEach(t => {
    const po = t.purchaseOrder; const recv = po.receiveStatus==='received';
    po.rows.filter(r=>r.name).forEach((r,i) => {
      detRows.push([t.id, t.problem, t.machine, po.mowr||'—', po.pr||'—', po.po||'—',
        i+1, r.name, r.pr||'—', r.qty||1, Number(r.price||0),
        (r.qty||1)*Number(r.price||0), recv?'รับแล้ว':'รอรับ']);
    });
  });
  const ws3 = XLSX.utils.aoa_to_sheet(detRows);
  ws3['!cols'] = [8,18,18,12,12,12,4,22,12,8,12,12,10].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws3, 'รายการ PO');

  // ── Sheet 4: รอสั่งซื้อ (ยังไม่มี PO) ──
  const pendRows = [['TK','ปัญหา','เครื่อง','ช่าง','รายการจากช่าง','ราคาประมาณรวม (฿)','แจ้งเมื่อ','สถานะ']];
  (db.tickets||[]).filter(t => (t.techRequest || t.waitPart) && !t.purchaseOrder).forEach(t => {
    const tr = t.techRequest; const wp = t.waitPart;
    const items = tr ? tr.rows.filter(r=>r.name).map(r=>r.name+(r.qty>1?` ×${r.qty}`:'')).join(', ') : wp?.items||'—';
    const total = tr ? Number(tr.total||0) : Number(wp?.price||0);
    pendRows.push([t.id, t.problem, t.machine, t.assignee||'—',
      items, total, (tr?.requestedAt||wp?.requestedAt||'').slice(0,16),
      tr?'ช่างแจ้งแล้ว รอ Admin':'รอแจ้ง']);
  });
  const ws4 = XLSX.utils.aoa_to_sheet(pendRows);
  ws4['!cols'] = [8,18,18,14,28,14,16,14].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws4, 'รอสั่งซื้อ');

  const fname = `PO_Tracking_${today.replace(/\//g,'-')}.xlsx`;
  XLSX.writeFile(wb, fname);
  showToast('📊 Export Excel สำเร็จ: '+fname);
}

// Excel export สำหรับ Tech (เฉพาะงานของตัวเอง)
function exportTechReqExcel() {
  if (typeof XLSX === 'undefined') { waitForXLSX(exportTechReqExcel); return; }
  const wb = XLSX.utils.book_new();
  const today = new Date().toLocaleDateString('th-TH');
  const myTickets = (db.tickets||[]).filter(t =>
    t.assigneeId === CU.id && (t.techRequest || t.waitPart)
  );
  // Sheet 1: สรุป
  const sumRows = [['TK','ปัญหา','เครื่อง','ตำแหน่ง','วันที่แจ้ง','รายการ','ราคาประมาณรวม (฿)','สถานะ']];
  myTickets.forEach(t => {
    const tr = t.techRequest; const po = t.purchaseOrder;
    const items = (tr?.rows||[]).filter(r=>r.name).map(r=>r.name+(r.qty>1?` ×${r.qty}`:'')).join(', ') || t.waitPart?.items||'—';
    const total = Number(tr?.total||t.waitPart?.price||0);
    const status = po?.receiveStatus==='received'?'📦 รับแล้ว':po?.po?'📋 มี PO':tr?'⏳ รอ Admin':'📝 ยังไม่แจ้ง';
    sumRows.push([t.id, t.problem, t.machine, t.location||'—',
      (tr?.requestedAt||'').slice(0,16), items, total, status]);
  });
  const ws1 = XLSX.utils.aoa_to_sheet(sumRows);
  ws1['!cols'] = [8,20,18,14,16,30,14,14].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws1, 'สรุป');
  // Sheet 2: รายการละเอียด
  const detRows = [['TK','ปัญหา','เครื่อง','#','ชื่ออะไหล่','จำนวน','ราคาประมาณ/ชิ้น (฿)','รวม (฿)','หมายเหตุ','สถานะ']];
  myTickets.filter(t=>t.techRequest?.rows?.length).forEach(t => {
    const tr = t.techRequest; const po = t.purchaseOrder;
    const status = po?.receiveStatus==='received'?'รับแล้ว':po?.po?'มี PO':'รอ Admin';
    tr.rows.filter(r=>r.name).forEach((r,i) => {
      detRows.push([t.id, t.problem, t.machine, i+1, r.name,
        r.qty||1, Number(r.price||0), (r.qty||1)*Number(r.price||0), r.note||'—', status]);
    });
  });
  const ws2 = XLSX.utils.aoa_to_sheet(detRows);
  ws2['!cols'] = [8,18,18,4,24,8,14,12,18,12].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws2, 'รายการละเอียด');

  const fname = `MyPurchase_${CU.name}_${today.replace(/\//g,'-')}.xlsx`;
  XLSX.writeFile(wb, fname);
  showToast('📊 Export Excel สำเร็จ: '+fname);
}

// ============================================================

// ── History date filter helpers ─────────────────────────────
function histDateFilter() { _histPage = 0; renderHistory(); }
function histDateClear()  {
  var df = document.getElementById('history-date-from');
  var dt = document.getElementById('history-date-to');
  if(df) df.value = '';
  if(dt) dt.value = '';
  _histPage = 0;
  renderHistory();
}

// ── Export ประวัติงานซ่อมเสร็จ → Excel ─────────────────────
function exportHistoryExcel() {
  if (typeof XLSX === 'undefined') { waitForXLSX(exportHistoryExcel); return; }

  const kw       = (document.getElementById('history-search')?.value||'').toLowerCase().trim();
  const dateFrom = document.getElementById('history-date-from')?.value || '';
  const dateTo   = document.getElementById('history-date-to')?.value   || '';

  let tickets = (db.tickets||[]).filter(t => t.status === 'done');

  // กรองตาม search/date เหมือน renderHistory
  if (kw) {
    tickets = tickets.filter(t =>
      (t.id||'').toLowerCase().includes(kw) ||
      (t.machine||'').toLowerCase().includes(kw) ||
      (t.problem||'').toLowerCase().includes(kw) ||
      (t.reporter||'').toLowerCase().includes(kw) ||
      (t.assignee||'').toLowerCase().includes(kw)
    );
  }
  if (dateFrom) tickets = tickets.filter(t => (t.updatedAt||t.createdAt||'') >= dateFrom);
  if (dateTo)   tickets = tickets.filter(t => (t.updatedAt||t.createdAt||'') <= dateTo + 'T23:59:59');

  tickets.sort((a,b) => (b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));

  if (tickets.length === 0) { showToast('⚠️ ไม่มีข้อมูลที่จะ Export'); return; }

  const rows = tickets.map((t,i) => {
    const repCost  = Number(t.repairCost || 0);
    const partCost = Number(t.partsCost  || 0);
    const poCost   = Number(t.purchaseOrder?.total || 0);
    const fallback = (!repCost && !partCost) ? Number(t.cost||0) : 0;
    const total    = repCost + partCost + poCost + fallback;
    return {
      'ลำดับ':         i + 1,
      'รหัส Ticket':   t.id || '',
      'เครื่องแอร์':   t.machine || '',
      'ปัญหา':         t.problem || '',
      'แผนก':          t.dept || '',
      'ผู้แจ้ง':        t.reporter || '',
      'ช่างผู้ซ่อม':   t.assignee || '',
      'สรุปการซ่อม':   t.summary || '',
      'ค่าแรงซ่อม':    repCost,
      'ค่าอะไหล่/PO':  partCost + poCost,
      'ค่าใช้จ่ายรวม': total || fallback,
      'วันที่แจ้ง':    t.createdAt ? t.createdAt.slice(0,10) : '',
      'วันที่เสร็จ':   t.updatedAt ? t.updatedAt.slice(0,10) : '',
    };
  });

  const today = new Date().toLocaleDateString('th-TH');
  const ws = XLSX.utils.json_to_sheet([]);

  // Header row สวย
  XLSX.utils.sheet_add_aoa(ws, [
    ['📋 ประวัติงานซ่อมเสร็จ — SCG.AIRCON BP'],
    ['วันที่ Export: ' + today + (kw?' | ค้นหา: '+kw:'') + (dateFrom?' | ตั้งแต่: '+dateFrom:'') + (dateTo?' | ถึง: '+dateTo:'')],
    ['จำนวน: ' + tickets.length + ' รายการ'],
    [],
  ], { origin: 'A1' });

  XLSX.utils.sheet_add_json(ws, rows, { origin: 'A5', skipHeader: false });

  // Column widths
  ws['!cols'] = [
    {wch:6},{wch:18},{wch:28},{wch:28},{wch:18},{wch:14},
    {wch:14},{wch:32},{wch:14},{wch:14},{wch:14},{wch:14},{wch:14}
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ประวัติซ่อมเสร็จ');

  const fname = 'history-done-' + new Date().toISOString().slice(0,10) + '.xlsx';
  XLSX.writeFile(wb, fname);
  showToast('📊 Export Excel สำเร็จ: ' + fname);
}

// ── Export Report Summary Excel ─────────────────────────────
function exportSummaryExcel() {
  if (typeof XLSX === 'undefined') { waitForXLSX(exportSummaryExcel); return; }

  const monthLabel = MONTH_TH[rptMonth] + ' ' + (rptYear + 543);
  const today = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // กรองงานตามเดือนและแผนก
  let T = db.tickets || [];
  if (_rptDeptFilter) {
    const machIds = new Set((db.machines||[]).filter(m => (m.dept||m.location||'') === _rptDeptFilter).map(m => m.id));
    T = T.filter(t => machIds.has(t.machineId));
  }
  const monthTickets = T.filter(t => {
    const d = new Date(t.createdAt || t.updatedAt || '');
    return d.getFullYear() === rptYear && d.getMonth() === rptMonth;
  });

  const STATUS_LABEL = {
    new: 'ใหม่', assigned: 'มอบหมาย', accepted: 'รับงาน',
    inprogress: 'กำลังซ่อม', waiting_part: 'รออะไหล่',
    done: 'เสร็จ', verified: 'ตรวจรับ', closed: 'ปิดงาน'
  };
  const PRIORITY_LABEL = { high: 'ด่วน', medium: 'ปกติ', low: 'ต่ำ' };

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: สรุปรายเดือน ──
  const doneList   = monthTickets.filter(t => ['done','verified','closed'].includes(t.status));
  const activeList = monthTickets.filter(t => !['done','verified','closed'].includes(t.status));
  const highList   = monthTickets.filter(t => t.priority === 'high');
  const totalCost  = monthTickets.reduce((s, t) => s + Number(t.repairCost||t.cost||0), 0);
  const totalParts = monthTickets.reduce((s, t) => s + Number(t.partsCost||0), 0);

  const sumRows = [
    ['รายงานสรุปงานซ่อม', monthLabel, (_rptDeptFilter ? 'แผนก: ' + _rptDeptFilter : 'ทุกแผนก'), '', 'วันที่พิมพ์: ' + today],
    [],
    ['รายการ', 'จำนวน', 'หน่วย'],
    ['งานทั้งหมดในเดือน', monthTickets.length, 'งาน'],
    ['งานเสร็จ', doneList.length, 'งาน'],
    ['งานค้าง', activeList.length, 'งาน'],
    ['งานด่วน', highList.length, 'งาน'],
    ['ค่าซ่อม', totalCost, 'บาท'],
    ['ค่าอะไหล่', totalParts, 'บาท'],
    ['รวมค่าใช้จ่าย', totalCost + totalParts, 'บาท'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(sumRows);
  ws1['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'สรุป ' + MONTH_TH[rptMonth].slice(0,3));

  // ── Sheet 2: รายการงานทั้งหมดในเดือน ──
  const detHeader = ['เลขงาน','วันที่แจ้ง','แผนก','เครื่อง Serial','ชื่อเครื่อง','อาการ','ลำดับความสำคัญ','สถานะ','ช่างรับงาน','วันที่เสร็จ','ค่าซ่อม','ค่าอะไหล่','รวม'];
  const detRows = [detHeader, ...monthTickets.map(t => {
    const mach = (db.machines||[]).find(m => m.id === t.machineId) || {};
    const tech = (db.users||[]).find(u => u.id === t.assigneeId);
    const dept = mach.dept || mach.location || '';
    const repCost  = Number(t.repairCost || t.cost || 0);
    const partCost = Number(t.partsCost || 0);
    return [
      t.id || '',
      t.createdAt ? t.createdAt.slice(0, 10) : '',
      dept,
      mach.serial || '',
      mach.name || '',
      t.problem || '',
      PRIORITY_LABEL[t.priority] || t.priority || '',
      STATUS_LABEL[t.status] || t.status || '',
      tech ? tech.name : (t.assigneeId || ''),
      t.updatedAt && ['done','verified','closed'].includes(t.status) ? t.updatedAt.slice(0, 10) : '',
      repCost,
      partCost,
      repCost + partCost,
    ];
  })];
  const ws2 = XLSX.utils.aoa_to_sheet(detRows);
  ws2['!cols'] = [10,12,16,14,20,32,10,12,14,12,10,10,10].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws2, 'รายการงาน');

  // ── Sheet 3: สรุปตามช่าง ──
  const techMap = {};
  monthTickets.forEach(t => {
    const key = t.assigneeId || '__none__';
    if (!techMap[key]) techMap[key] = { name: '', done: 0, active: 0, total: 0 };
    const u = (db.users||[]).find(u => u.id === t.assigneeId);
    techMap[key].name = u ? u.name : (t.assigneeId ? t.assigneeId : 'ยังไม่มอบหมาย');
    techMap[key].total++;
    if (['done','verified','closed'].includes(t.status)) techMap[key].done++;
    else techMap[key].active++;
  });
  const techHeader = ['ช่างซ่อม', 'งานทั้งหมด', 'เสร็จแล้ว', 'ค้างอยู่'];
  const techRows = [techHeader, ...Object.values(techMap).sort((a,b) => b.total - a.total).map(r => [r.name, r.total, r.done, r.active])];
  const ws3 = XLSX.utils.aoa_to_sheet(techRows);
  ws3['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'สรุปตามช่าง');

  const fname = `Report_${MONTH_TH[rptMonth].slice(0,3)}_${rptYear+543}${_rptDeptFilter?'_'+_rptDeptFilter:''}_${today.replace(/\//g,'-')}.xlsx`;
  XLSX.writeFile(wb, fname);
  showToast('📊 Export Excel สำเร็จ: ' + fname);
}

// ============================================================
// ITEM 7: Full-Screen Preview for PDF / reports (ย้ายจาก index.html)
// ============================================================
function openFullScreenPreview(url, title) {
  let ov = document.getElementById('fullscreen-preview-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'fullscreen-preview-overlay';
    ov.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:#0f172a;flex-shrink:0">
        <button onclick="closeFullScreenPreview()" style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.12);border:none;color:white;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
        <div id="fsp-title" style="flex:1;color:white;font-size:0.88rem;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div>
        <button onclick="document.getElementById('fullscreen-preview-iframe').contentWindow?.print()" style="padding:6px 12px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);color:white;border-radius:8px;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit">🖨️ พิมพ์</button>
      </div>
      <iframe id="fullscreen-preview-iframe"></iframe>`;
    document.body.appendChild(ov);
  }
  ov.classList.add('open');
  const iframe = document.getElementById('fullscreen-preview-iframe');
  const titleEl = document.getElementById('fsp-title');
  if (titleEl) titleEl.textContent = title || 'รายงาน';
  if (url) iframe.src = url;
}

function closeFullScreenPreview() {
  const ov = document.getElementById('fullscreen-preview-overlay');
  if (ov) {
    ov.classList.remove('open');
    const iframe = document.getElementById('fullscreen-preview-iframe');
    if (iframe) iframe.src = '';
  }
}

document.addEventListener('click', function(e) {
  const btn = e.target.closest('[data-fsp-url]');
  if (btn) {
    e.preventDefault();
    openFullScreenPreview(btn.dataset.fspUrl, btn.dataset.fspTitle);
  }
});
