// EXECUTIVE DASHBOARD
// ============================================================
let _execMonth = new Date().getMonth();
let _execYear  = new Date().getFullYear();
let _execTab   = 'dashboard';

const EXEC_MONTH_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function execPrevMonth() {
  _execMonth--;
  if (_execMonth < 0) { _execMonth = 11; _execYear--; }
  renderExecutiveDashboard();
}
function execNextMonth() {
  const now = new Date();
  if (_execYear > now.getFullYear() || (_execYear === now.getFullYear() && _execMonth >= now.getMonth())) return;
  _execMonth++;
  if (_execMonth > 11) { _execMonth = 0; _execYear++; }
  renderExecutiveDashboard();
}

function switchExecTab(tab) {
  _execTab = tab;
  // Update tab buttons — support both old .exec-tab and new .exec-tab-btn
  document.querySelectorAll('.exec-tab, .exec-tab-btn').forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('active', active);
    // Also reset inline styles from old version
    btn.style.background = '';
    btn.style.color = '';
    btn.style.fontWeight = '';
    btn.style.border = '';
    btn.style.boxShadow = '';
  });
  document.querySelectorAll('.exec-panel').forEach(p => {
    p.style.display = p.id === 'exec-panel-' + tab ? '' : 'none';
  });
  _renderExecTab(tab);
}

function renderExecutiveDashboard() {
  const lbl = document.getElementById('exec-month-label');
  if (lbl) lbl.textContent = EXEC_MONTH_TH[_execMonth] + ' ' + (_execYear + 543);
  _renderExecTab(_execTab);
}

// BUG FIX (Bug 7): memoize _execGetData — ป้องกัน O(n×13) recompute ทุกครั้งที่ switch tab
// cache invalidate เมื่อ tickets.length เปลี่ยน หรือเปลี่ยนเดือนที่เลือก
let _execDataCache = null;
let _execDataCacheKey = '';

function _execGetData() {
  const tickets = db.tickets || [];
  const machines = db.machines || [];

  // cache key: จำนวน tickets + updatedAt ล่าสุด + เดือน/ปีที่เลือก
  const lastUpdated = tickets.length > 0 ? (tickets[tickets.length-1].updatedAt || tickets[tickets.length-1].createdAt || '') : '';
  const cacheKey = tickets.length + '|' + lastUpdated + '|' + _execMonth + '|' + _execYear;
  if (_execDataCache && _execDataCacheKey === cacheKey) {
    return _execDataCache;
  }

  const macMap = new Map(machines.map(m => [m.id, m]));

  // helper: หาวันที่ที่ดีที่สุดของ ticket (รองรับ Firestore Timestamp และ string)
  const _toDateStr = v => {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object' && v.seconds) return new Date(v.seconds * 1000).toISOString();
    if (v instanceof Date) return v.toISOString();
    return String(v);
  };
  const _tDate = t => _toDateStr(t.createdAt) || _toDateStr(t.updatedAt) || _toDateStr(t.doneAt) || _toDateStr(t.closedAt) || _toDateStr(t.verifiedAt) || '';

  // Single-pass: แบ่ง tickets ตามเดือนในรอบเดียว ไม่วน 13 รอบ
  const now = new Date();
  const monthBuckets = {}; // key: "y-m"
  const monthT = [];

  for (const t of tickets) {
    const ds = _tDate(t);
    if (!ds) continue;
    const d = new Date(ds);
    const y = d.getFullYear();
    const m = d.getMonth();
    // เดือนที่เลือก
    if (y === _execYear && m === _execMonth) monthT.push(t);
    // 12 เดือนย้อนหลัง
    const key = y + '-' + m;
    if (!monthBuckets[key]) monthBuckets[key] = { tickets: [], cost: 0, y, m };
    monthBuckets[key].tickets.push(t);
    monthBuckets[key].cost += _tCost(t);
  }

  const monthly = Array.from({length: 12}, (_, i) => {
    let m = now.getMonth() - (11 - i);
    let y = now.getFullYear();
    while (m < 0) { m += 12; y--; }
    const bucket = monthBuckets[y + '-' + m] || { tickets: [], cost: 0 };
    return { label: EXEC_MONTH_TH[m] + "'" + String(y + 543).slice(2), count: bucket.tickets.length, cost: bucket.cost, m, y };
  });

  _execDataCache = { tickets, machines, macMap, monthT, monthly };
  _execDataCacheKey = cacheKey;
  return _execDataCache;
}

function _tCost(t) {
  const rc = Number(t.repairCost || 0);
  const pc = Number(t.partsCost  || 0);
  const po = Number(t.purchaseOrder?.total || 0);
  const tc = Number(t.cost || 0);
  // ถ้ามีการแยก repairCost / partsCost ไว้แล้ว → ใช้นั้นเป็นหลัก
  if (rc > 0 || pc > 0) {
    // partsCost ควรตรงกับ PO total — ถ้า po > pc ให้ใช้ po (เผื่อ PO อัปเดตทีหลัง)
    const parts = Math.max(pc, po);
    return rc + parts;
  }
  // fallback: มีแค่ PO total หรือ cost เก่า
  if (po > 0) return po;
  return tc;
}

// _fmt ย้ายไปอยู่ใน app-core.js แล้ว

function _renderExecTab(tab) {
  const d = _execGetData();
  if (tab === 'dashboard') _renderExecDashboard(d);
  else if (tab === 'cost')   _renderExecCost(d);
  else if (tab === 'repair') _renderExecRepair(d);
  else if (tab === 'vendor') _renderExecVendor(d);
  else if (tab === 'risk')   _renderExecRisk(d);
}

// ── DASHBOARD TAB ──
function _renderExecDashboard(d) {
  const { monthT, monthly } = d;
  const done      = monthT.filter(t => ['done','verified','closed'].includes(t.status));
  const pending   = monthT.filter(t => !['done','verified','closed'].includes(t.status));
  const totalCost = monthT.reduce((s,t) => s + _tCost(t), 0);
  const prevMonth = monthly[monthly.length - 2];
  const prevCost  = prevMonth?.cost || 0;
  const costDiff  = prevCost > 0 ? Math.round((totalCost - prevCost) / prevCost * 100) : 0;
  const doneRate  = monthT.length > 0 ? Math.round(done.length / monthT.length * 100) : 0;

  // ── Quick-strip ──
  const strip = document.getElementById('exec-quick-strip');
  if (strip) {
    const openAll   = (d.tickets||[]).filter(t=>!['done','verified','closed'].includes(t.status)).length;
    const techCount = (db.users||[]).filter(u=>u.role==='tech').length;
    const macCount  = (db.machines||[]).length;
    const strips = [
      {icon:'📋',val:monthT.length, lbl:'งานเดือนนี้', cl:'#1d4ed8'},
      {icon:'✅',val:done.length,   lbl:'สำเร็จ '+doneRate+'%', cl:'#16a34a'},
      {icon:'⏳',val:openAll,       lbl:'ค้างทั้งหมด',  cl:'#d97706'},
      {icon:'👷',val:techCount,     lbl:'ช่างซ่อม',    cl:'#7c3aed'},
    ];
    strip.innerHTML = strips.map(s=>`<div class="exec-stat-cell"><div class="ico">${s.icon}</div><div class="val" style="color:${s.cl}">${s.val}</div><div class="lbl">${s.lbl}</div></div>`).join('');
  }

  // ── KPI Cards — Bright clean white cards ──
  const kpiEl = document.getElementById('exec-kpi-cards');
  if (kpiEl) kpiEl.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div onclick="showKpiModal('all')" style="background:var(--card);border-radius:20px;padding:16px 14px;position:relative;overflow:hidden;box-shadow:0 2px 20px rgba(29,78,216,.1);cursor:pointer;border:2px solid #dbeafe;-webkit-tap-highlight-color:transparent" onmousedown="this.style.transform='scale(.97)'" onmouseup="this.style.transform=''">
      <div class="exec-card-shine"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#1d4ed8,#3b82f6);display:flex;align-items:center;justify-content:center;font-size:1rem;box-shadow:0 4px 10px rgba(29,78,216,.3)">📋</div>
        <span style="font-size:.6rem;font-weight:700;color:#3b82f6;background:#eff6ff;padding:3px 8px;border-radius:99px;border:1px solid #bfdbfe">เดือนนี้</span>
      </div>
      <div style="font-size:2.8rem;font-weight:900;color:#1d4ed8;line-height:1;font-family:'JetBrains Mono',monospace">${monthT.length}</div>
      <div style="font-size:.6rem;color:#94a3b8;margin-top:6px;font-weight:600">งานซ่อมทั้งหมด · แตะดู</div>
    </div>
    <div onclick="showKpiModal('done')" style="background:var(--card);border-radius:20px;padding:16px 14px;position:relative;overflow:hidden;box-shadow:0 2px 20px rgba(22,163,74,.1);cursor:pointer;border:2px solid #bbf7d0;-webkit-tap-highlight-color:transparent" onmousedown="this.style.transform='scale(.97)'" onmouseup="this.style.transform=''">
      <div class="exec-card-shine"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#16a34a,#22c55e);display:flex;align-items:center;justify-content:center;font-size:1rem;box-shadow:0 4px 10px rgba(22,163,74,.3)">✅</div>
        <span style="font-size:.72rem;font-weight:900;color:#16a34a;background:#dcfce7;padding:3px 8px;border-radius:99px;border:1px solid #86efac">${doneRate}%</span>
      </div>
      <div style="font-size:2.8rem;font-weight:900;color:#16a34a;line-height:1;font-family:'JetBrains Mono',monospace">${done.length}</div>
      <div style="background:#f0fdf4;border-radius:8px;height:5px;margin-top:10px;overflow:hidden"><div style="height:100%;width:${doneRate}%;background:linear-gradient(90deg,#22c55e,#16a34a);border-radius:8px;transition:width .8s ease"></div></div>
    </div>
    <div onclick="showKpiModal('pending')" style="background:var(--card);border-radius:20px;padding:16px 14px;position:relative;overflow:hidden;box-shadow:0 2px 20px rgba(217,119,6,.1);cursor:pointer;border:2px solid #fde68a;-webkit-tap-highlight-color:transparent" onmousedown="this.style.transform='scale(.97)'" onmouseup="this.style.transform=''">
      <div class="exec-card-shine"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#d97706,#f59e0b);display:flex;align-items:center;justify-content:center;font-size:1rem;box-shadow:0 4px 10px rgba(217,119,6,.3)">⏳</div>
        <span style="font-size:.6rem;font-weight:700;color:#92400e;background:#fffbeb;padding:3px 8px;border-radius:99px;border:1px solid #fde68a">รอดำเนินการ</span>
      </div>
      <div style="font-size:2.8rem;font-weight:900;color:#d97706;line-height:1;font-family:'JetBrains Mono',monospace">${pending.length}</div>
      <div style="font-size:.6rem;color:#94a3b8;margin-top:6px;font-weight:600">งานที่ยังไม่เสร็จ · แตะดู</div>
    </div>
    <div onclick="showKpiModal('cost')" style="background:var(--card);border-radius:20px;padding:16px 14px;position:relative;overflow:hidden;box-shadow:0 2px 20px rgba(124,58,237,.1);cursor:pointer;border:2px solid #ddd6fe;-webkit-tap-highlight-color:transparent" onmousedown="this.style.transform='scale(.97)'" onmouseup="this.style.transform=''">
      <div class="exec-card-shine"></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#7c3aed,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:1rem;box-shadow:0 4px 10px rgba(124,58,237,.3)">💰</div>
        <span style="font-size:.62rem;font-weight:800;color:${costDiff>0?'#dc2626':costDiff<0?'#16a34a':'#94a3b8'};background:${costDiff>0?'#fef2f2':costDiff<0?'#f0fdf4':'#f8fafc'};padding:3px 8px;border-radius:99px;border:1px solid ${costDiff>0?'#fecaca':costDiff<0?'#bbf7d0':'#e2e8f0'}">${costDiff>0?'↑':costDiff<0?'↓':'–'}${Math.abs(costDiff)}%</span>
      </div>
      <div style="font-size:${totalCost>=100000?'1.5':totalCost>=10000?'1.9':'2.4'}rem;font-weight:900;color:#7c3aed;line-height:1;font-family:'JetBrains Mono',monospace;letter-spacing:-.01em">฿${_fmt(totalCost)}</div>
      <div style="font-size:.6rem;color:#94a3b8;margin-top:6px;font-weight:600">ก่อน VAT · vs ก่อนหน้า ฿${_fmt(prevCost)}</div>
    </div>
  </div>`;

  // ── Status donut ──
  const statusEl = document.getElementById('exec-status-chart');
  if (statusEl) {
    const statuses = [
      {label:'เสร็จแล้ว',   count:monthT.filter(t=>['done','verified','closed'].includes(t.status)).length, color:'#22c55e'},
      {label:'กำลังซ่อม',   count:monthT.filter(t=>t.status==='inprogress').length, color:'#0ea5e9'},
      {label:'รอดำเนินการ', count:monthT.filter(t=>['pending','open','new','assigned','accepted'].includes(t.status)).length, color:'#f59e0b'},
      {label:'รอชิ้นส่วน',  count:monthT.filter(t=>t.status==='waiting_part').length, color:'#a855f7'},
    ].filter(s=>s.count>0);
    const segTot = statuses.reduce((a,s)=>a+s.count,0);
    const tot = segTot > 0 ? segTot : 1; let cum=0;
    const segs = statuses.map(s=>{const pct=isFinite(s.count/tot)?s.count/tot*100:0;const sg={...s,pct,offset:cum};cum+=pct;return sg;});
    const r=38,cx=50,cy=50,circ=2*Math.PI*r;
    statusEl.innerHTML=`<div style="display:flex;align-items:center;gap:7px;margin-bottom:14px">
      <div style="width:28px;height:28px;border-radius:9px;background:#eff6ff;display:flex;align-items:center;justify-content:center;font-size:.85rem">📊</div>
      <span style="font-size:.85rem;font-weight:900;color:var(--text)">สถานะงานประจำเดือน</span>
      <span style="margin-left:auto;font-size:.65rem;font-weight:700;color:#94a3b8;background:var(--bg-2,#f1f5f9);padding:3px 8px;border-radius:8px">${monthT.length} งาน</span>
    </div>
    <div style="display:flex;align-items:center;gap:18px">
      <div style="position:relative;flex-shrink:0">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#f1f5f9" stroke-width="11"/>
          ${monthT.length===0?'':segs.map(s=>`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="11" stroke-dasharray="${s.pct/100*circ} ${circ}" stroke-dashoffset="${-s.offset/100*circ}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"/>`).join('')}
        </svg>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
          <div style="font-size:1.6rem;font-weight:900;color:var(--text);line-height:1;font-family:'JetBrains Mono',monospace">${monthT.length}</div>
          <div style="font-size:.48rem;color:#94a3b8;font-weight:700">งาน</div>
        </div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:10px">
        ${segs.length>0?segs.map(s=>`<div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <div style="display:flex;align-items:center;gap:6px">
              <div style="width:9px;height:9px;border-radius:3px;background:${s.color}"></div>
              <span style="font-size:.7rem;color:var(--text2);font-weight:600">${s.label}</span>
            </div>
            <span style="font-size:.78rem;font-weight:900;color:var(--text);font-family:'JetBrains Mono',monospace">${s.count}<span style="font-size:.6rem;font-weight:500;color:#94a3b8"> (${Math.round(s.pct)}%)</span></span>
          </div>
          <div style="background:var(--bg);border-radius:99px;height:5px;overflow:hidden"><div style="background:${s.color};border-radius:99px;height:5px;width:${s.pct}%;transition:width .7s ease"></div></div>
        </div>`).join(''):`<div style="text-align:center;color:#94a3b8;font-size:.75rem;padding:16px;background:var(--bg);border-radius:12px">ไม่มีข้อมูลเดือนนี้</div>`}
      </div>
    </div>`;
  }

  // ── Mini trend ──
  const trendMini = document.getElementById('exec-trend-mini');
  if (trendMini) {
    const last6=monthly.slice(-6);
    const maxCnt=Math.max(...last6.map(m=>m.count),1);
    const maxCost=Math.max(...last6.map(m=>m.cost),1);
    trendMini.innerHTML=`<div style="display:flex;align-items:center;gap:7px;margin-bottom:14px">
      <div style="width:28px;height:28px;border-radius:9px;background:#f5f3ff;display:flex;align-items:center;justify-content:center;font-size:.85rem">📈</div>
      <span style="font-size:.85rem;font-weight:900;color:var(--text)">แนวโน้ม 6 เดือน</span>
      <div style="margin-left:auto;display:flex;gap:8px;font-size:.58rem;color:#94a3b8">
        <span style="display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:2px;background:#38bdf8;display:inline-block"></span>งาน</span>
        <span style="display:flex;align-items:center;gap:3px"><span style="width:8px;height:8px;border-radius:2px;background:#a78bfa;display:inline-block"></span>ค่าใช้จ่าย</span>
      </div>
    </div>
    <div style="display:flex;align-items:flex-end;gap:7px;height:80px">
      ${last6.map(m=>{
        const h1=m.count>0?Math.max(10,Math.round(m.count/maxCnt*68)):3;
        const h2=m.cost>0?Math.max(5,Math.round(m.cost/maxCost*55)):3;
        const isCur=m.m===_execMonth&&m.y===_execYear;
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
          <div style="width:100%;display:flex;gap:2px;align-items:flex-end;justify-content:center">
            <div style="flex:1;background:${isCur?'#0ea5e9':'#bae6fd'};border-radius:5px 5px 0 0;height:${h1}px;min-height:3px"></div>
            <div style="flex:1;background:${isCur?'#8b5cf6':'#ede9fe'};border-radius:5px 5px 0 0;height:${h2}px;min-height:2px"></div>
          </div>
          <div style="font-size:.48rem;color:${isCur?'#0ea5e9':'#94a3b8'};font-weight:${isCur?900:600};text-align:center;white-space:nowrap">${m.label}</div>
        </div>`;}).join('')}
    </div>`;
  }

  // ── Top dept ──
  const deptEl = document.getElementById('exec-top-dept');
  if (deptEl) {
    const deptMap={};
    monthT.forEach(t=>{const dept=t.dept||d.macMap.get(t.machineId)?.dept||'ไม่ระบุ';deptMap[dept]=(deptMap[dept]||0)+1;});
    const sorted=Object.entries(deptMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const maxVal=sorted[0]?.[1]||1;
    const palettes=[
      {bg:'linear-gradient(135deg,#1d4ed8,#3b82f6)',sh:'rgba(29,78,216,.2)',bar:'#1d4ed8'},
      {bg:'linear-gradient(135deg,#7c3aed,#8b5cf6)',sh:'rgba(124,58,237,.2)',bar:'#7c3aed'},
      {bg:'linear-gradient(135deg,#0891b2,#0ea5e9)',sh:'rgba(8,145,178,.2)', bar:'#0891b2'},
      {bg:'linear-gradient(135deg,#d97706,#f59e0b)',sh:'rgba(217,119,6,.2)', bar:'#d97706'},
      {bg:'linear-gradient(135deg,#16a34a,#22c55e)',sh:'rgba(22,163,74,.2)', bar:'#16a34a'},
    ];
    const sn=dept=>{const m2=dept.match(/\(([^)]+)\)/);if(m2)return m2[1].slice(0,4);return dept.trim().split(/[\s#]+/).slice(0,2).map(w=>w.slice(0,3)).join('');};
    deptEl.innerHTML=`<div style="display:flex;align-items:center;gap:7px;margin-bottom:14px">
      <div style="width:28px;height:28px;border-radius:9px;background:#ecfeff;display:flex;align-items:center;justify-content:center;font-size:.85rem">🏢</div>
      <span style="font-size:.85rem;font-weight:900;color:var(--text)">Top 5 แผนกที่มีงานมากสุด</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:11px">
      ${sorted.map(([dept,cnt],i)=>{const p=palettes[i];return`<div style="display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:11px;background:${p.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 10px ${p.sh}">
          <span style="font-size:.58rem;font-weight:900;color:white;text-align:center;line-height:1.1">${sn(dept)}</span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
            <span style="font-size:.72rem;color:var(--text);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%">${dept}</span>
            <span style="font-size:.88rem;font-weight:900;color:${p.bar};font-family:'JetBrains Mono',monospace;flex-shrink:0;margin-left:4px">${cnt}<span style="font-size:.6rem;font-weight:600;color:#94a3b8"> งาน</span></span>
          </div>
          <div style="background:var(--bg-2,#f1f5f9);border-radius:99px;height:6px;overflow:hidden">
            <div style="background:${p.bar};border-radius:99px;height:6px;width:${cnt/maxVal*100}%;transition:width .7s ease"></div>
          </div>
        </div>
      </div>`;}).join('')}
      ${!sorted.length?`<div style="text-align:center;color:#94a3b8;font-size:.75rem;padding:20px;background:var(--bg);border-radius:12px">ไม่มีข้อมูลเดือนนี้</div>`:''}
    </div>`;
  }

  // ── Cost summary ──
  const costEl = document.getElementById('exec-cost-summary-card');
  if (costEl) {
    const ac=costDiff>0?'#dc2626':costDiff<0?'#16a34a':'#94a3b8';
    const ab=costDiff>0?'#fef2f2':costDiff<0?'#f0fdf4':'#f8fafc';
    const ad=costDiff>0?'#fecaca':costDiff<0?'#bbf7d0':'#e2e8f0';
    costEl.innerHTML=`<div style="display:flex;align-items:center;gap:7px;margin-bottom:14px">
      <div style="width:28px;height:28px;border-radius:9px;background:#f5f3ff;display:flex;align-items:center;justify-content:center;font-size:.85rem">💰</div>
      <span style="font-size:.85rem;font-weight:900;color:var(--text)">สรุปค่าใช้จ่ายเดือนนี้</span>
    </div>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:120px">
        <div style="font-size:.52rem;font-weight:800;color:#94a3b8;letter-spacing:.1em;text-transform:uppercase;margin-bottom:5px">ก่อน VAT</div>
        <div style="font-size:${totalCost>=100000?'1.7':'2.1'}rem;font-weight:900;color:#7c3aed;line-height:1;font-family:'JetBrains Mono',monospace">฿${_fmt(totalCost)}</div>
        <div style="font-size:.62rem;color:#94a3b8;margin-top:8px">รวม VAT 7% ≈ <strong style="color:#6d28d9;font-family:'JetBrains Mono',monospace">฿${_fmt(Math.round(totalCost*1.07))}</strong></div>
      </div>
      <div style="background:${ab};border:1.5px solid ${ad};border-radius:14px;padding:12px 16px;text-align:center;min-width:80px">
        <div style="font-size:1.4rem;font-weight:900;color:${ac};line-height:1">${costDiff>0?'↑':costDiff<0?'↓':'–'}${Math.abs(costDiff)}%</div>
        <div style="font-size:.52rem;color:#94a3b8;margin-top:4px;font-weight:700">VS เดือนก่อน</div>
        <div style="font-size:.62rem;color:#64748b;margin-top:3px;font-family:'JetBrains Mono',monospace">฿${_fmt(prevCost)}</div>
      </div>
    </div>`;
  }
}

// ── COST TAB ──
function _renderExecCost(d) {
  const { tickets, monthly, macMap } = d;

  // Trend 12 months bar chart
  const trendEl = document.getElementById('exec-cost-trend');
  if (trendEl) {
    const maxCost = Math.max(...monthly.map(m => m.cost), 1);
    trendEl.innerHTML = `
      <div style="font-size:0.78rem;font-weight:900;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:6px">
        <span style="display:inline-flex;width:24px;height:24px;border-radius:8px;background:#f5f3ff;align-items:center;justify-content:center;font-size:0.8rem">📈</span>
        ค่าใช้จ่าย 12 เดือนย้อนหลัง
      </div>
      <div style="display:flex;align-items:flex-end;gap:3px;height:80px;overflow-x:auto">
        ${monthly.map((m, i) => {
          const h = Math.max(m.cost / maxCost * 72, m.cost > 0 ? 4 : 0);
          const isCur = m.m === _execMonth && m.y === _execYear;
          return `<div style="flex:1;min-width:20px;display:flex;flex-direction:column;align-items:center;gap:2px">
            <div title="฿${_fmt(m.cost)}" style="width:100%;background:${isCur?'#7c3aed':'#cbd5e1'};border-radius:4px 4px 0 0;height:${h}px;transition:height .4s;cursor:pointer"></div>
            <span style="font-size:0.45rem;color:${isCur?'#7c3aed':'#94a3b8'};white-space:nowrap;font-weight:${isCur?'900':'400'}">${m.label}</span>
          </div>`;
        }).join('')}
      </div>
      <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:0.62rem;color:#94a3b8">รวม 12 เดือน</span>
        <strong style="font-size:0.75rem;color:#7c3aed">฿${_fmt(monthly.reduce((s,m)=>s+m.cost,0))}</strong>
      </div>`;
  }

  // Cost by dept — redesigned, show jobs if no cost data
  const deptEl = document.getElementById('exec-cost-by-dept');
  if (deptEl) {
    const monthT = tickets.filter(t => {
      const dd = new Date(t.createdAt || '');
      return dd.getFullYear() === _execYear && dd.getMonth() === _execMonth;
    });
    const deptMap = {};
    monthT.forEach(t => {
      const dept = t.dept || macMap.get(t.machineId)?.dept || 'ไม่ระบุ';
      if (!deptMap[dept]) deptMap[dept] = { cost:0, count:0 };
      deptMap[dept].cost += _tCost(t);
      deptMap[dept].count++;
    });
    const sorted = Object.entries(deptMap).sort((a,b)=>b[1].cost-a[1].cost || b[1].count-a[1].count);
    const hasCost = sorted.some(([,v])=>v.cost>0);
    const maxV = sorted[0]?.[1]?.[hasCost?'cost':'count'] || 1;
    const deptColors = ['#7c3aed','#0e7490','#059669','#d97706','#dc2626'];
    deptEl.innerHTML = `
      <div style="font-size:0.78rem;font-weight:900;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:6px">
        <span style="display:inline-flex;width:24px;height:24px;border-radius:8px;background:#f5f3ff;align-items:center;justify-content:center;font-size:0.8rem">🏢</span>
        ค่าใช้จ่ายแยกตามแผนก
        ${!hasCost?'<span style="font-size:0.58rem;background:#fef9c3;color:#a16207;padding:2px 7px;border-radius:99px;font-weight:700;margin-left:auto">แสดงจำนวนงาน</span>':''}
      </div>
      ${sorted.length ? `<div style="display:flex;flex-direction:column;gap:10px">
        ${sorted.map(([dept,v], i) => `
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:0.68rem;color:var(--text2);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%">${dept}</span>
              <span style="font-size:0.68rem;font-weight:900;color:${deptColors[i%5]}">${hasCost?'฿'+_fmt(v.cost):v.count+' งาน'}</span>
            </div>
            <div style="background:var(--bg-2,#f1f5f9);border-radius:99px;height:5px">
              <div style="background:${deptColors[i%5]};border-radius:99px;height:5px;width:${(hasCost?v.cost:v.count)/maxV*100}%;transition:width .6s ease"></div>
            </div>
            ${hasCost?`<div style="font-size:0.58rem;color:#94a3b8;margin-top:2px">${v.count} งาน</div>`:''}
          </div>`).join('')}
      </div>` : '<div style="text-align:center;color:#94a3b8;font-size:0.75rem;padding:20px 0">ไม่มีข้อมูลเดือนนี้</div>'}`;
  }

  // Cost by vendor — redesigned, show jobs if no cost data
  const vendorEl = document.getElementById('exec-cost-by-vendor');
  if (vendorEl) {
    const monthT = tickets.filter(t => {
      const dd = new Date(t.createdAt || '');
      return dd.getFullYear() === _execYear && dd.getMonth() === _execMonth;
    });
    const vMap = {};
    monthT.forEach(t => {
      const v = t.vendor || macMap.get(t.machineId)?.vendor || 'ไม่ระบุ';
      if (!vMap[v]) vMap[v] = { cost:0, count:0 };
      vMap[v].cost += _tCost(t);
      vMap[v].count++;
    });
    const sorted = Object.entries(vMap).sort((a,b)=>b[1].cost-a[1].cost || b[1].count-a[1].count);
    const hasCost = sorted.some(([,v])=>v.cost>0);
    const vColors = ['#0e7490','#7c3aed','#059669','#d97706','#dc2626'];
    vendorEl.innerHTML = `
      <div style="font-size:0.78rem;font-weight:900;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:6px">
        <span style="display:inline-flex;width:24px;height:24px;border-radius:8px;background:#ecfeff;align-items:center;justify-content:center;font-size:0.8rem">🏭</span>
        ค่าใช้จ่ายแยกตาม Vendor
        ${!hasCost?'<span style="font-size:0.58rem;background:#fef9c3;color:#a16207;padding:2px 7px;border-radius:99px;font-weight:700;margin-left:auto">แสดงจำนวนงาน</span>':''}
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${sorted.length ? sorted.map(([v, info], i) => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg);border-radius:12px;border:1px solid var(--border)">
            <div style="width:30px;height:30px;border-radius:9px;background:${vColors[i%5]}18;display:flex;align-items:center;justify-content:center;font-size:0.68rem;font-weight:900;color:${vColors[i%5]};flex-shrink:0">${i+1}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.72rem;font-weight:800;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v}</div>
              <div style="font-size:0.6rem;color:#94a3b8;margin-top:1px">${info.count} งาน</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              ${hasCost ? `
                <div style="font-size:0.82rem;font-weight:900;color:${vColors[i%5]}">฿${_fmt(info.cost)}</div>
                <div style="font-size:0.58rem;color:#94a3b8">+VAT ฿${_fmt(info.cost*1.07)}</div>
              ` : `
                <div style="font-size:0.75rem;font-weight:900;color:${vColors[i%5]}">${info.count} งาน</div>
              `}
            </div>
          </div>`).join('') : '<div style="text-align:center;color:#94a3b8;font-size:0.75rem;padding:20px 0">ไม่มีข้อมูลเดือนนี้</div>'}
      </div>`;
  }

  // Cost by repair type — redesigned, show jobs if no cost data
  const typeEl = document.getElementById('exec-cost-by-type');
  if (typeEl) {
    const monthT = tickets.filter(t => {
      const dd = new Date(t.createdAt || '');
      return dd.getFullYear() === _execYear && dd.getMonth() === _execMonth;
    });
    const typeMap = {};
    monthT.forEach(t => {
      const tags = Array.isArray(t.tags) ? t.tags : [];
      const cost = _tCost(t);
      if (tags.length) {
        tags.forEach(tag => {
          if (!typeMap[tag]) typeMap[tag] = { cost:0, count:0 };
          typeMap[tag].cost += cost / tags.length;
          typeMap[tag].count++;
        });
      } else {
        const key = 'ไม่ระบุประเภท';
        if (!typeMap[key]) typeMap[key] = { cost:0, count:0 };
        typeMap[key].cost += cost;
        typeMap[key].count++;
      }
    });
    const sorted = Object.entries(typeMap).sort((a,b)=>b[1].cost-a[1].cost || b[1].count-a[1].count).slice(0,8);
    const hasCost = sorted.some(([,v])=>v.cost>0);
    const tagColors = [
      {bg:'#f0fdf4',border:'#bbf7d0',text:'#059669'},
      {bg:'#eff6ff',border:'#bfdbfe',text:'#2563eb'},
      {bg:'#fdf4ff',border:'#e9d5ff',text:'#7c3aed'},
      {bg:'#fff7ed',border:'#fed7aa',text:'#ea580c'},
      {bg:'#fef2f2',border:'#fecaca',text:'#dc2626'},
      {bg:'#f0f9ff',border:'#bae6fd',text:'#0284c7'},
      {bg:'#fefce8',border:'#fef08a',text:'#ca8a04'},
      {bg:'#f0fdf4',border:'#bbf7d0',text:'#16a34a'},
    ];
    typeEl.innerHTML = `
      <div style="font-size:0.78rem;font-weight:900;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:6px">
        <span style="display:inline-flex;width:24px;height:24px;border-radius:8px;background:#f0fdf4;align-items:center;justify-content:center;font-size:0.8rem">🔩</span>
        ค่าใช้จ่ายแยกตามประเภทงาน
        ${!hasCost?'<span style="font-size:0.58rem;background:#fef9c3;color:#a16207;padding:2px 7px;border-radius:99px;font-weight:700;margin-left:auto">แสดงจำนวนงาน</span>':''}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${sorted.length ? sorted.map(([type, v], i) => {
          const c = tagColors[i%8];
          return `<div style="background:${c.bg};border:1px solid ${c.border};border-radius:10px;padding:8px 12px;min-width:80px">
            <div style="font-size:0.62rem;color:var(--text2);font-weight:700;margin-bottom:3px">${type}</div>
            <div style="font-size:0.78rem;font-weight:900;color:${c.text}">${hasCost?'฿'+_fmt(v.cost):v.count+' งาน'}</div>
          </div>`;
        }).join('') : '<div style="color:#94a3b8;font-size:0.75rem;padding:10px">ไม่มีข้อมูลเดือนนี้</div>'}
      </div>`;
  }
}

// ── REPAIR TAB ──
function _renderExecRepair(d) {
  const { tickets, macMap } = d;
  const monthT = tickets.filter(t => {
    const dd = new Date(t.createdAt || '');
    return dd.getFullYear() === _execYear && dd.getMonth() === _execMonth;
  });
  const done = monthT.filter(t => ['done','verified','closed'].includes(t.status));
  const overdue = monthT.filter(t => {
    if (['done','verified','closed'].includes(t.status)) return false;
    const created = new Date(t.createdAt || '');
    return (Date.now() - created.getTime()) > 3 * 24 * 60 * 60 * 1000;
  });
  const totalCost = monthT.reduce((s,t) => s + _tCost(t), 0);

  // avg resolution time
  let avgDays = 0;
  const resolved = done.filter(t => t.createdAt && t.updatedAt);
  if (resolved.length) {
    const totalMs = resolved.reduce((s,t) => s + (new Date(t.updatedAt) - new Date(t.createdAt)), 0);
    avgDays = (totalMs / resolved.length / 86400000).toFixed(1);
  }

  const kpiEl = document.getElementById('exec-repair-kpi');
  if (kpiEl) kpiEl.innerHTML = [
    { icon:'📋', label:'งานทั้งหมด',      value: monthT.length,   color:'#0e7490', bg:'#ecfeff' },
    { icon:'✅', label:'เสร็จแล้ว',       value: done.length,     color:'#059669', bg:'#f0fdf4' },
    { icon:'🚨', label:'เกินกำหนด 3 วัน', value: overdue.length,  color:'#dc2626', bg:'#fef2f2' },
    { icon:'⏱️', label:'เฉลี่ย (วัน)',    value: avgDays || '-',  color:'#7c3aed', bg:'#f5f3ff' },
  ].map(k => `
    <div style="background:${k.bg};border-radius:14px;padding:12px;border:1px solid ${k.color}22">
      <div style="font-size:1.2rem;margin-bottom:4px">${k.icon}</div>
      <div style="font-size:1.25rem;font-weight:900;color:${k.color};line-height:1">${k.value}</div>
      <div style="font-size:0.58rem;color:#64748b;font-weight:600;margin-top:3px">${k.label}</div>
    </div>`).join('');

  // repair table
  const tableEl = document.getElementById('exec-repair-table');
  if (tableEl) {
    const rows = monthT.slice(0, 20);
    tableEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:0.85rem;font-weight:900;color:var(--text)">📋 รายการงานซ่อมเดือนนี้</div>
        <span style="font-size:0.62rem;color:#94a3b8">${monthT.length} รายการ</span>
      </div>
      ${rows.length ? `
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
        <table style="width:100%;border-collapse:collapse;font-size:0.68rem;min-width:360px">
          <thead>
            <tr style="background:var(--bg);border-bottom:2px solid #e2e8f0">
              <th style="text-align:left;padding:6px 8px;color:#64748b;font-weight:700">TK</th>
              <th style="text-align:left;padding:6px 8px;color:#64748b;font-weight:700">ปัญหา</th>
              <th style="text-align:left;padding:6px 8px;color:#64748b;font-weight:700">สถานะ</th>
              <th style="text-align:right;padding:6px 8px;color:#64748b;font-weight:700">ค่าใช้จ่าย</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(t => {
              const stColor = {'done':'#059669','verified':'#059669','closed':'#059669','inprogress':'#0e7490','pending':'#d97706','open':'#d97706','waiting_part':'#7c3aed'}[t.status] || '#94a3b8';
              const stLabel = {'done':'เสร็จ','verified':'ยืนยัน','closed':'ปิด','inprogress':'ซ่อมอยู่','pending':'รอ','open':'รอ','waiting_part':'รอชิ้นส่วน'}[t.status] || t.status;
              const cost = _tCost(t);
              return `<tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:6px 8px;font-family:monospace;color:#7c3aed;font-weight:700;white-space:nowrap">${t.id}</td>
                <td style="padding:6px 8px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;max-width:120px;white-space:nowrap">${t.problem||t.machine||'-'}</td>
                <td style="padding:6px 8px"><span style="background:${stColor}22;color:${stColor};border-radius:6px;padding:2px 6px;font-weight:700;white-space:nowrap">${stLabel}</span></td>
                <td style="padding:6px 8px;text-align:right;font-weight:800;color:${cost>0?'#7c3aed':'#94a3b8'}">${cost>0?'฿'+_fmt(cost):'-'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${monthT.length > 20 ? `<div style="text-align:center;font-size:0.65rem;color:#94a3b8;margin-top:8px">แสดง 20 / ${monthT.length} รายการ</div>` : ''}
      ` : '<div style="text-align:center;color:#94a3b8;font-size:0.75rem;padding:20px 0">ไม่มีงานซ่อมในเดือนนี้</div>'}`;
  }

  // Top 10 repeat machines (all time)
  const repEl = document.getElementById('exec-repeat-machines');
  if (repEl) {
    const macCount = {};
    (db.tickets || []).forEach(t => {
      if (t.machineId) macCount[t.machineId] = (macCount[t.machineId] || 0) + 1;
    });
    const topMac = Object.entries(macCount).sort((a,b)=>b[1]-a[1]).slice(0,10);
    repEl.innerHTML = `
      <div style="font-size:0.85rem;font-weight:900;color:var(--text);margin-bottom:10px">🔁 Top 10 เครื่องที่ซ่อมบ่อยสุด</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${topMac.length ? topMac.map(([mid, cnt], i) => {
          const mac = macMap.get(mid);
          const name = mac?.name || mid;
          const serial = mac?.serial || '';
          return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--bg);border-radius:10px;border:1px solid var(--border)">
            <div style="width:22px;height:22px;border-radius:6px;background:${i<3?'#fef2f2':'#f1f5f9'};display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:900;color:${i<3?'#dc2626':'#64748b'};flex-shrink:0">${i+1}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.7rem;font-weight:800;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</div>
              ${serial ? `<div style="font-size:0.58rem;color:#94a3b8;font-family:monospace">${serial}</div>` : ''}
            </div>
            <div style="background:${i<3?'#fef2f2':'#ecfeff'};color:${i<3?'#dc2626':'#0e7490'};border-radius:8px;padding:3px 8px;font-size:0.7rem;font-weight:900;flex-shrink:0">${cnt} ครั้ง</div>
          </div>`;
        }).join('') : '<div style="text-align:center;color:#94a3b8;font-size:0.75rem;padding:20px 0">ไม่มีข้อมูล</div>'}
      </div>`;
  }
}

// ── VENDOR TAB ──
function _renderExecVendor(d) {
  const { tickets, macMap } = d;
  const vendors = [...new Set(tickets.map(t => t.vendor || macMap.get(t.machineId)?.vendor || 'ไม่ระบุ'))];

  const vData = vendors.map(v => {
    const vt = tickets.filter(t => (t.vendor || macMap.get(t.machineId)?.vendor || 'ไม่ระบุ') === v);
    const done = vt.filter(t => ['done','verified','closed'].includes(t.status));
    const totalCost = vt.reduce((s,t) => s + _tCost(t), 0);
    let avgDays = 0;
    const resolved = done.filter(t => t.createdAt && t.updatedAt);
    if (resolved.length) {
      avgDays = (resolved.reduce((s,t) => s + (new Date(t.updatedAt)-new Date(t.createdAt)),0) / resolved.length / 86400000).toFixed(1);
    }
    const rate = vt.length ? Math.round(done.length / vt.length * 100) : 0;
    return { v, total: vt.length, done: done.length, totalCost, avgDays, rate };
  }).sort((a,b) => b.total - a.total);

  const cardsEl = document.getElementById('exec-vendor-cards');
  if (cardsEl) {
    cardsEl.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:2px">
      ${vData.slice(0,4).map((v, i) => `
        <div style="background:var(--card);border-radius:14px;padding:12px;border:1px solid var(--border);box-shadow:0 1px 4px rgba(0,0,0,.05)">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
            <div style="width:24px;height:24px;border-radius:7px;background:${['#ecfeff','#f5f3ff','#f0fdf4','#fffbeb'][i%4]};display:flex;align-items:center;justify-content:center;font-size:0.75rem;flex-shrink:0">🏭</div>
            <div style="font-size:0.68rem;font-weight:900;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.v}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
            <div style="text-align:center;background:var(--bg);border-radius:8px;padding:5px">
              <div style="font-size:0.9rem;font-weight:900;color:#0e7490">${v.total}</div>
              <div style="font-size:0.5rem;color:#94a3b8">งานทั้งหมด</div>
            </div>
            <div style="text-align:center;background:var(--bg);border-radius:8px;padding:5px">
              <div style="font-size:0.9rem;font-weight:900;color:#059669">${v.rate}%</div>
              <div style="font-size:0.5rem;color:#94a3b8">อัตราสำเร็จ</div>
            </div>
            <div style="text-align:center;background:var(--bg);border-radius:8px;padding:5px">
              <div style="font-size:0.8rem;font-weight:900;color:#7c3aed">฿${_fmt(v.totalCost)}</div>
              <div style="font-size:0.5rem;color:#94a3b8">ค่าใช้จ่าย</div>
            </div>
            <div style="text-align:center;background:var(--bg);border-radius:8px;padding:5px">
              <div style="font-size:0.9rem;font-weight:900;color:#d97706">${v.avgDays||'-'}</div>
              <div style="font-size:0.5rem;color:#94a3b8">เฉลี่ย(วัน)</div>
            </div>
          </div>
        </div>`).join('')}
    </div>`;
  }

  const tableEl = document.getElementById('exec-vendor-table');
  if (tableEl) {
    tableEl.innerHTML = `
      <div style="font-size:0.85rem;font-weight:900;color:var(--text);margin-bottom:10px">📊 เปรียบเทียบ Vendor ทั้งหมด</div>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
        <table style="width:100%;border-collapse:collapse;font-size:0.68rem;min-width:380px">
          <thead>
            <tr style="background:var(--bg);border-bottom:2px solid #e2e8f0">
              <th style="text-align:left;padding:6px 8px;color:#64748b;font-weight:700">Vendor</th>
              <th style="text-align:center;padding:6px 8px;color:#64748b;font-weight:700">งาน</th>
              <th style="text-align:center;padding:6px 8px;color:#64748b;font-weight:700">สำเร็จ%</th>
              <th style="text-align:right;padding:6px 8px;color:#64748b;font-weight:700">ค่าใช้จ่าย</th>
              <th style="text-align:center;padding:6px 8px;color:#64748b;font-weight:700">เฉลี่ย(วัน)</th>
            </tr>
          </thead>
          <tbody>
            ${vData.map(v => `
              <tr style="border-bottom:1px solid #f1f5f9">
                <td style="padding:6px 8px;font-weight:700;color:var(--text);white-space:nowrap">${v.v}</td>
                <td style="padding:6px 8px;text-align:center;color:#0e7490;font-weight:800">${v.total}</td>
                <td style="padding:6px 8px;text-align:center">
                  <span style="background:${v.rate>=80?'#f0fdf4':v.rate>=50?'#fffbeb':'#fef2f2'};color:${v.rate>=80?'#059669':v.rate>=50?'#d97706':'#dc2626'};border-radius:6px;padding:2px 6px;font-weight:800">${v.rate}%</span>
                </td>
                <td style="padding:6px 8px;text-align:right;font-weight:800;color:#7c3aed">${v.totalCost>0?'฿'+_fmt(v.totalCost):'-'}</td>
                <td style="padding:6px 8px;text-align:center;color:#64748b">${v.avgDays||'-'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }
}

// ── RISK TAB ──
function _renderExecRisk(d) {
  const { tickets, machines, macMap } = d;
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const recentTickets = tickets.filter(t => new Date(t.createdAt || '') >= threeMonthsAgo);
  const macCount = {};
  const macCost = {};
  recentTickets.forEach(t => {
    if (!t.machineId) return;
    macCount[t.machineId] = (macCount[t.machineId] || 0) + 1;
    macCost[t.machineId]  = (macCost[t.machineId]  || 0) + _tCost(t);
  });

  const riskMachines = Object.entries(macCount)
    .filter(([mid, cnt]) => cnt >= 3)
    .map(([mid, cnt]) => ({ mid, cnt, cost: macCost[mid] || 0, mac: macMap.get(mid) }))
    .sort((a,b) => b.cnt - a.cnt || b.cost - a.cost);

  const listEl = document.getElementById('exec-risk-list');
  if (!listEl) return;

  if (!riskMachines.length) {
    listEl.innerHTML = `
      <div style="background:var(--card);border-radius:14px;padding:24px;text-align:center;border:1px solid var(--border)">
        <div style="font-size:2.5rem;margin-bottom:8px">✅</div>
        <div style="font-size:0.85rem;font-weight:800;color:#059669">ไม่มีเครื่องที่น่าเป็นห่วง</div>
        <div style="font-size:0.68rem;color:#94a3b8;margin-top:4px">ไม่พบเครื่องที่ซ่อมซ้ำ ≥3 ครั้งใน 3 เดือนล่าสุด</div>
      </div>`;
    return;
  }

  listEl.innerHTML = riskMachines.map((item, i) => {
    const mac = item.mac;
    const name = mac?.name || item.mid;
    const serial = mac?.serial || '';
    const dept = mac?.dept || mac?.location || '-';
    const btu = mac?.btu ? Number(mac.btu).toLocaleString() + ' BTU' : '';
    const vendor = mac?.vendor || '-';
    const riskLevel = item.cnt >= 6 ? 'สูงมาก' : item.cnt >= 4 ? 'สูง' : 'ปานกลาง';
    const riskColor = item.cnt >= 6 ? '#dc2626' : item.cnt >= 4 ? '#d97706' : '#ca8a04';
    const riskBg    = item.cnt >= 6 ? '#fef2f2' : item.cnt >= 4 ? '#fffbeb' : '#fefce8';
    return `
      <div style="background:var(--card);border-radius:14px;padding:14px;border:2px solid ${riskColor}33;box-shadow:0 1px 4px rgba(0,0,0,.05)">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="width:36px;height:36px;border-radius:10px;background:${riskBg};display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">⚠️</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">
              <span style="font-size:0.75rem;font-weight:900;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span>
              <span style="background:${riskBg};color:${riskColor};border-radius:6px;padding:1px 7px;font-size:0.6rem;font-weight:800;border:1px solid ${riskColor}44;flex-shrink:0">⚠ ${riskLevel}</span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
              ${serial ? `<span style="font-size:0.6rem;color:#7c3aed;background:#f5f3ff;border-radius:5px;padding:1px 6px;font-family:monospace;font-weight:700">${serial}</span>` : ''}
              ${btu ? `<span style="font-size:0.6rem;color:#d97706;background:#fffbeb;border-radius:5px;padding:1px 6px;font-weight:700">${btu}</span>` : ''}
              <span style="font-size:0.6rem;color:#64748b;background:var(--bg-2,#f1f5f9);border-radius:5px;padding:1px 6px">${dept}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
              <div style="background:#fef2f2;border-radius:8px;padding:6px;text-align:center">
                <div style="font-size:1rem;font-weight:900;color:#dc2626">${item.cnt}</div>
                <div style="font-size:0.52rem;color:#94a3b8">ครั้ง/3เดือน</div>
              </div>
              <div style="background:#f5f3ff;border-radius:8px;padding:6px;text-align:center">
                <div style="font-size:0.82rem;font-weight:900;color:#7c3aed">฿${_fmt(item.cost)}</div>
                <div style="font-size:0.52rem;color:#94a3b8">ค่าซ่อมรวม</div>
              </div>
              <div style="background:#f0fdf4;border-radius:8px;padding:6px;text-align:center">
                <div style="font-size:0.7rem;font-weight:900;color:#059669">${vendor}</div>
                <div style="font-size:0.52rem;color:#94a3b8">Vendor</div>
              </div>
            </div>
            <div style="margin-top:8px;background:#fffbeb;border-radius:8px;padding:7px 10px;border-left:3px solid ${riskColor}">
              <div style="font-size:0.65rem;color:#92400e;font-weight:700">💡 คำแนะนำ: ${item.cnt>=6?'ควรพิจารณาเปลี่ยนเครื่องใหม่โดยด่วน ค่าซ่อมสูงกว่าคุ้มค่า':item.cnt>=4?'ควรประเมินความคุ้มค่าระหว่างซ่อมต่อหรือเปลี่ยนใหม่':'ติดตามอาการใกล้ชิด วางแผน PM เพิ่มเติม'}</div>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── EXPORT CSV ──
function exportExecCSV() {
  const d = _execGetData();
  const monthT = d.tickets.filter(t => {
    const dd = new Date(t.createdAt || '');
    return dd.getFullYear() === _execYear && dd.getMonth() === _execMonth;
  });
  const header = ['TK ID','ปัญหา','เครื่อง','แผนก','Vendor','สถานะ','ค่าใช้จ่าย','วันที่สร้าง'];
  const rows = monthT.map(t => [
    t.id,
    '"' + (t.problem || '').replace(/"/g,'""') + '"',
    '"' + (t.machine || d.macMap.get(t.machineId)?.name || '').replace(/"/g,'""') + '"',
    '"' + (t.dept || d.macMap.get(t.machineId)?.dept || '').replace(/"/g,'""') + '"',
    '"' + (t.vendor || d.macMap.get(t.machineId)?.vendor || '').replace(/"/g,'""') + '"',
    t.status || '',
    _tCost(t),
    (t.createdAt || '').slice(0,10)
  ].join(','));
  const csv = '\uFEFF' + [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `exec_report_${EXEC_MONTH_TH[_execMonth]}${_execYear+543}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('⬇ ดาวน์โหลด CSV แล้ว', 'ok');
}

// ── EXPORT PDF ──
function exportExecPDF() {
  const d = _execGetData();
  const monthT = d.tickets.filter(t => {
    const dd = new Date(t.createdAt || '');
    return dd.getFullYear() === _execYear && dd.getMonth() === _execMonth;
  });
  const done    = monthT.filter(t => ['done','verified','closed'].includes(t.status));
  const pending = monthT.filter(t => !['done','verified','closed'].includes(t.status));
  const totalCost = monthT.reduce((s,t) => s + _tCost(t), 0);

  const vendorMap = {};
  monthT.forEach(t => {
    const v = t.vendor || d.macMap.get(t.machineId)?.vendor || 'ไม่ระบุ';
    if (!vendorMap[v]) vendorMap[v] = { count:0, cost:0 };
    vendorMap[v].count++;
    vendorMap[v].cost += _tCost(t);
  });

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Executive Report — ${EXEC_MONTH_TH[_execMonth]} ${_execYear+543}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;700;900&display=swap');
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Noto Sans Thai',Arial,sans-serif; background:var(--card); color:var(--text); }
    .header { background:linear-gradient(135deg,#0a0f1e,#0e7490); color:white; padding:24px 32px; }
    .header h1 { font-size:20px; font-weight:900; }
    .header .sub { font-size:11px; opacity:.65; margin-top:4px; }
    .body { padding:24px 32px; }
    .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
    .kpi { background:var(--bg); border-radius:10px; padding:14px; border:1px solid var(--border); text-align:center; }
    .kpi .val { font-size:22px; font-weight:900; }
    .kpi .lbl { font-size:10px; color:#64748b; margin-top:4px; }
    h2 { font-size:14px; font-weight:900; margin:20px 0 10px; border-left:3px solid #0e7490; padding-left:10px; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    th { background:var(--bg-2,#f1f5f9); padding:6px 10px; text-align:left; font-weight:700; color:#64748b; }
    td { padding:6px 10px; border-bottom:1px solid #f1f5f9; }
    .footer { margin-top:32px; padding-top:12px; border-top:1px solid #e2e8f0; font-size:10px; color:#94a3b8; text-align:right; }
    @media print { @page { size:A4; margin:15mm; } .no-print { display:none; } }
  </style></head><body>
  <div class="header">
    <h1>📊 Executive Report — ${EXEC_MONTH_TH[_execMonth]} ${_execYear+543}</h1>
    <div class="sub">AIRCONDITION BP PROCESS · สร้างเมื่อ ${new Date().toLocaleString('th-TH')}</div>
  </div>
  <div class="body">
    <div class="kpi-grid">
      <div class="kpi"><div class="val" style="color:#0e7490">${monthT.length}</div><div class="lbl">งานทั้งหมด</div></div>
      <div class="kpi"><div class="val" style="color:#059669">${done.length}</div><div class="lbl">เสร็จแล้ว</div></div>
      <div class="kpi"><div class="val" style="color:#d97706">${pending.length}</div><div class="lbl">ยังค้างอยู่</div></div>
      <div class="kpi"><div class="val" style="color:#7c3aed">฿${_fmt(totalCost)}</div><div class="lbl">ค่าใช้จ่าย (ก่อน VAT)</div></div>
    </div>
    <h2>รายการงานซ่อมประจำเดือน</h2>
    <table>
      <thead><tr><th>TK</th><th>ปัญหา</th><th>แผนก</th><th>สถานะ</th><th style="text-align:right">ค่าใช้จ่าย</th></tr></thead>
      <tbody>
        ${monthT.slice(0,50).map(t => `<tr>
          <td style="font-family:monospace;color:#7c3aed">${t.id}</td>
          <td>${(t.problem||t.machine||'-').slice(0,40)}</td>
          <td>${t.dept || d.macMap.get(t.machineId)?.dept || '-'}</td>
          <td>${t.status||'-'}</td>
          <td style="text-align:right">${_tCost(t)>0?'฿'+_fmt(_tCost(t)):'-'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <h2>สรุปค่าใช้จ่ายตาม Vendor</h2>
    <table>
      <thead><tr><th>Vendor</th><th style="text-align:center">จำนวนงาน</th><th style="text-align:right">ค่าใช้จ่าย</th><th style="text-align:right">+VAT 7%</th></tr></thead>
      <tbody>
        ${Object.entries(vendorMap).sort((a,b)=>b[1].cost-a[1].cost).map(([v,info]) => `<tr>
          <td>${v}</td>
          <td style="text-align:center">${info.count}</td>
          <td style="text-align:right">฿${_fmt(info.cost)}</td>
          <td style="text-align:right">฿${_fmt(info.cost*1.07)}</td>
        </tr>`).join('')}
        <tr style="font-weight:900;background:var(--bg)">
          <td>รวมทั้งหมด</td>
          <td style="text-align:center">${monthT.length}</td>
          <td style="text-align:right">฿${_fmt(totalCost)}</td>
          <td style="text-align:right">฿${_fmt(totalCost*1.07)}</td>
        </tr>
      </tbody>
    </table>
    <div class="footer">AIRCONDITION BP PROCESS · Executive Report · พิมพ์โดย ${CU?.name||''} · ${new Date().toLocaleDateString('th-TH')}</div>
  </div>
  <div class="no-print" style="position:fixed;bottom:20px;right:20px">
    <button onclick="window.print()" style="background:#0e7490;color:white;border:none;border-radius:10px;padding:10px 20px;font-size:14px;font-weight:800;cursor:pointer;font-family:'Noto Sans Thai',Arial,sans-serif">🖨️ พิมพ์ / บันทึก PDF</button>
  </div>
  </body></html>`);
  win.document.close();
}

// ══════════════════════════════════════════════
//  KPI DETAIL MODAL
// ══════════════════════════════════════════════
function showKpiModal(type) {
  const d = _execGetData();
  const { monthT, macMap } = d;

  let title = '', content = '';

  if (type === 'all') {
    // งานทั้งหมด → แยกตามสถานะ
    const groups = [
      { label:'✅ เสร็จแล้ว',    filter: t => ['done','verified','closed'].includes(t.status), color:'#059669', bg:'#f0fdf4' },
      { label:'🔧 กำลังซ่อม',    filter: t => t.status === 'inprogress', color:'#0e7490', bg:'#ecfeff' },
      { label:'⏳ รอดำเนินการ',  filter: t => t.status === 'pending' || t.status === 'open', color:'#d97706', bg:'#fffbeb' },
      { label:'🔩 รอชิ้นส่วน',   filter: t => t.status === 'waiting_part', color:'#7c3aed', bg:'#f5f3ff' },
      { label:'📋 อื่นๆ',         filter: t => !['done','verified','closed','inprogress','pending','open','waiting_part'].includes(t.status), color:'#64748b', bg:'#f8fafc' },
    ];
    title = '📋 รายละเอียดงานทั้งหมด';
    content = groups.map(g => {
      const ts = monthT.filter(g.filter);
      if (!ts.length) return '';
      return `<div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:0.78rem;font-weight:900;color:${g.color}">${g.label}</span>
          <span style="font-size:0.75rem;font-weight:900;background:${g.bg};color:${g.color};padding:3px 10px;border-radius:99px;border:1px solid ${g.color}33">${ts.length} งาน</span>
        </div>
        ${ts.map(t => `
          <div style="display:flex;justify-content:space-between;padding:7px 10px;background:var(--bg);border-radius:8px;margin-bottom:4px;border:1px solid #f1f5f9">
            <div>
              <div style="font-size:0.68rem;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px">${t.problem || t.machine || t.id || '-'}</div>
              <div style="font-size:0.6rem;color:#94a3b8;margin-top:1px">${t.dept || macMap.get(t.machineId)?.dept || ''}</div>
            </div>
            <span style="font-size:0.62rem;font-family:monospace;color:${g.color};font-weight:700;flex-shrink:0;margin-left:6px">${t.id||''}</span>
          </div>`).join('')}
      </div>`;
    }).join('');

  } else if (type === 'done') {
    // เสร็จแล้ว → แสดง avg time + รายการ
    const done = monthT.filter(t => ['done','verified','closed'].includes(t.status));
    title = '✅ รายการงานที่เสร็จแล้ว';
    const avgCost = done.length ? Math.round(done.reduce((s,t)=>s+_tCost(t),0) / done.length) : 0;
    content = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        <div style="background:#f0fdf4;border-radius:12px;padding:12px;text-align:center;border:1px solid #bbf7d0">
          <div style="font-size:1.4rem;font-weight:900;color:#059669">${done.length}</div>
          <div style="font-size:0.62rem;color:#64748b;margin-top:2px">งานเสร็จ</div>
        </div>
        <div style="background:#f0fdf4;border-radius:12px;padding:12px;text-align:center;border:1px solid #bbf7d0">
          <div style="font-size:1rem;font-weight:900;color:#059669">฿${_fmt(avgCost)}</div>
          <div style="font-size:0.62rem;color:#64748b;margin-top:2px">ต้นทุน/งาน</div>
        </div>
      </div>
      ${done.map(t => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--bg);border-radius:8px;margin-bottom:4px;border:1px solid #f1f5f9">
          <div style="flex:1;min-width:0">
            <div style="font-size:0.68rem;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.problem || t.machine || '-'}</div>
            <div style="font-size:0.6rem;color:#94a3b8;margin-top:1px">${t.dept || macMap.get(t.machineId)?.dept || ''} · ${t.vendor || macMap.get(t.machineId)?.vendor || 'ไม่ระบุ vendor'}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;margin-left:8px">
            ${_tCost(t)>0?`<div style="font-size:0.72rem;font-weight:900;color:#059669">฿${_fmt(_tCost(t))}</div>`:'<div style="font-size:0.65rem;color:#94a3b8">-</div>'}
          </div>
        </div>`).join('')}`;

  } else if (type === 'pending') {
    // ค้างอยู่ → แสดงรายการแยกตามสถานะ
    const pending = monthT.filter(t => !['done','verified','closed'].includes(t.status));
    title = '⏳ รายการงานที่ยังค้างอยู่';
    content = `
      <div style="background:#fffbeb;border-radius:12px;padding:12px;text-align:center;margin-bottom:16px;border:1px solid #fed7aa">
        <div style="font-size:1.4rem;font-weight:900;color:#d97706">${pending.length}</div>
        <div style="font-size:0.62rem;color:#64748b;margin-top:2px">งานรอดำเนินการ</div>
      </div>
      ${pending.map(t => {
        const statusLabel = {inprogress:'🔧 กำลังซ่อม', pending:'⏳ รอดำเนินการ', open:'📂 เปิดงาน', waiting_part:'🔩 รอชิ้นส่วน'}[t.status] || t.status || '?';
        const statusColor = {inprogress:'#0e7490', pending:'#d97706', open:'#64748b', waiting_part:'#7c3aed'}[t.status] || '#64748b';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--bg);border-radius:8px;margin-bottom:4px;border:1px solid #f1f5f9">
          <div style="flex:1;min-width:0">
            <div style="font-size:0.68rem;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.problem || t.machine || '-'}</div>
            <div style="font-size:0.6rem;color:#94a3b8;margin-top:1px">${t.dept || macMap.get(t.machineId)?.dept || ''}</div>
          </div>
          <span style="font-size:0.6rem;font-weight:700;color:${statusColor};background:${statusColor}15;padding:2px 7px;border-radius:99px;flex-shrink:0;margin-left:6px;white-space:nowrap">${statusLabel}</span>
        </div>`;
      }).join('')}`;

  } else if (type === 'cost') {
    // ค่าใช้จ่าย → แยก ค่าแรง + ค่าอะไหล่ + อื่นๆ
    // ── คำนวณค่าใช้จ่ายแต่ละประเภท (ไม่นับซ้ำ) ──
    const totalCost  = monthT.reduce((s,t) => s + _tCost(t), 0);
    // ค่าแรง: repairCost หรือ (cost - partsCost) ถ้าไม่มี repairCost
    const laborCost  = monthT.reduce((s,t) => {
      const rc = Number(t.repairCost || 0);
      const pc = Number(t.partsCost  || 0);
      const po = Number(t.purchaseOrder?.total || 0);
      const tc = Number(t.cost || 0);
      if (rc > 0) return s + rc;                       // มี repairCost → ใช้เลย
      if (pc > 0 || po > 0) return s;                  // มีแค่อะไหล่ → ค่าแรง = 0
      return s + tc;                                   // cost ล้วน → ถือเป็นค่าแรง
    }, 0);
    // ค่าอะไหล่: ใช้ max(partsCost, PO.total) เพื่อให้ตรงกับ _tCost
    const partsCost  = monthT.reduce((s,t) => {
      const rc = Number(t.repairCost || 0);
      const pc = Number(t.partsCost  || 0);
      const po = Number(t.purchaseOrder?.total || 0);
      if (rc > 0 || pc > 0) return s + Math.max(pc, po);
      if (po > 0) return s + po;
      return s;
    }, 0);
    // ดึงค่าแรงจากใบเสนอราคา (priceList rows)
    const quoteLaborCost = monthT.reduce((s,t) => {
      const rows = t.priceList || t.quoteRows || [];
      return s + rows.filter(r => (r.type||'').toLowerCase().includes('labor') || (r.name||'').includes('ค่าแรง'))
                     .reduce((ss,r) => ss + Number(r.total||r.amount||r.price||0), 0);
    }, 0);
    const effectiveLaborCost = laborCost > 0 ? laborCost : quoteLaborCost;
    const otherCost  = Math.max(0, totalCost - effectiveLaborCost - partsCost);
    const hasCost    = totalCost > 0;
    title = '💰 รายละเอียดค่าใช้จ่าย';

    const pct = (v) => totalCost > 0 ? Math.round(v/totalCost*100) : 0;
    const costGroups = [
      { label:'🔧 ค่าแรง / ค่าซ่อม', value: effectiveLaborCost, color:'#0e7490', bg:'#ecfeff', desc:'จาก Price List' },
      { label:'🔩 ค่าอะไหล่',          value: partsCost,          color:'#7c3aed', bg:'#f5f3ff', desc:'จาก PO/PR' },
      { label:'📦 ค่าใช้จ่ายอื่นๆ',    value: otherCost,           color:'#d97706', bg:'#fffbeb', desc:'อื่นๆ' },
    ];
    content = `
      <!-- รวมทั้งสิ้น -->
      <div style="background:linear-gradient(135deg,#4c1d95,#7c3aed);border-radius:16px;padding:16px;color:white;text-align:center;margin-bottom:16px">
        <div style="font-size:0.6rem;opacity:.7;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px">รวมค่าใช้จ่ายเดือนนี้ (ก่อน VAT)</div>
        <div style="font-size:2rem;font-weight:900;line-height:1">฿${_fmt(totalCost)}</div>
        <div style="font-size:0.65rem;opacity:.65;margin-top:6px">VAT 7% ≈ ฿${_fmt(totalCost * 1.07)}</div>
      </div>

      <!-- แยกประเภท -->
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
        ${costGroups.map(g => `
          <div style="background:${g.bg};border-radius:12px;padding:12px 14px;border:1px solid ${g.color}33">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-size:0.72rem;font-weight:800;color:${g.color}">${g.label}</span>
              <span style="font-size:0.8rem;font-weight:900;color:${g.color}">฿${_fmt(g.value)}</span>
            </div>
            <div style="background:var(--card);border-radius:99px;height:5px;margin-bottom:4px">
              <div style="background:${g.color};border-radius:99px;height:5px;width:${pct(g.value)}%"></div>
            </div>
            <div style="font-size:0.6rem;color:${g.color};opacity:.8">${pct(g.value)}% ของค่าใช้จ่ายทั้งหมด</div>
          </div>`).join('')}
      </div>

      <!-- รายการงานที่มีค่าใช้จ่าย -->
      <div style="font-size:0.72rem;font-weight:900;color:var(--text);margin-bottom:8px">รายการงานที่มีค่าใช้จ่าย</div>
      ${monthT.filter(t=>_tCost(t)>0).length === 0
        ? `<div style="text-align:center;color:#94a3b8;font-size:0.75rem;padding:16px;background:var(--bg);border-radius:10px">ยังไม่มีข้อมูลค่าใช้จ่ายในเดือนนี้</div>`
        : monthT.filter(t=>_tCost(t)>0).map(t => {
            const rc = Number(t.repairCost||0);
            const pc = Number(t.partsCost||0);
            const po = Number(t.purchaseOrder?.total||0);
            const tc = _tCost(t);
            // ค่าแรง
            const labor = rc > 0 ? rc
              : (pc > 0 || po > 0) ? 0
              : tc;  // cost ล้วน = ค่าแรง
            // ค่าอะไหล่
            const parts = pc > 0 ? pc : (po > 0 && !rc ? po : (po > 0 ? po : 0));
            const other = Math.max(0, tc - labor - parts);
            return `<div style="background:var(--bg);border-radius:10px;padding:10px 12px;margin-bottom:6px;border:1px solid #f1f5f9">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <div style="font-size:0.68rem;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%">${t.problem||t.machine||t.id||'-'}</div>
                <div style="font-size:0.72rem;font-weight:900;color:#7c3aed;flex-shrink:0">฿${_fmt(_tCost(t))}</div>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                ${labor>0?`<span style="font-size:0.6rem;background:#ecfeff;color:#0e7490;padding:2px 7px;border-radius:99px;font-weight:700;border:1px solid #cffafe">🔧 แรง ฿${_fmt(labor)}</span>`:''}
                ${parts>0?`<span style="font-size:0.6rem;background:#f5f3ff;color:#7c3aed;padding:2px 7px;border-radius:99px;font-weight:700;border:1px solid #ede9fe">🔩 อะไหล่ ฿${_fmt(parts)}</span>`:''}
                ${other>0?`<span style="font-size:0.6rem;background:#fffbeb;color:#d97706;padding:2px 7px;border-radius:99px;font-weight:700;border:1px solid #fef08a">📦 อื่น ฿${_fmt(other)}</span>`:''}
              </div>
            </div>`;
          }).join('')}`;
  }

  // Build and show modal
  let modal = document.getElementById('_kpi-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = '_kpi-detail-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;font-family:inherit';
    modal.innerHTML = `
      <div id="_kpi-modal-backdrop" onclick="closeKpiModal()" style="position:absolute;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(3px)"></div>
      <div id="_kpi-modal-sheet" style="position:relative;width:100%;max-width:520px;max-height:82vh;background:var(--card);border-radius:24px 24px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -8px 40px rgba(0,0,0,.25);transform:translateY(100%);transition:transform .3s cubic-bezier(.32,0,.67,0)">
        <div style="flex-shrink:0;padding:12px 16px 0;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding-bottom:12px">
          <div id="_kpi-modal-title" style="font-size:0.85rem;font-weight:900;color:var(--text)"></div>
          <button onclick="closeKpiModal()" style="width:28px;height:28px;border-radius:50%;border:none;background:var(--bg-2,#f1f5f9);color:#64748b;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
        </div>
        <div id="_kpi-modal-body" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 16px 32px"></div>
      </div>`;
    document.body.appendChild(modal);
  }

  document.getElementById('_kpi-modal-title').textContent = title;
  document.getElementById('_kpi-modal-body').innerHTML = content;
  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('_kpi-modal-sheet').style.transform = 'translateY(0)';
    });
  });
}

function closeKpiModal() {
  const sheet = document.getElementById('_kpi-modal-sheet');
  if (!sheet) return;
  sheet.style.transition = 'transform .25s cubic-bezier(.32,0,.67,0)';
  sheet.style.transform = 'translateY(100%)';
  setTimeout(() => {
    const m = document.getElementById('_kpi-detail-modal');
    if (m) m.style.display = 'none';
  }, 260);
}

// ══════════════════════════════════════════════════════════════
// AUTO BACKUP — บันทึก JSON อัตโนมัติทุก 24 ชม. + manual export
// ══════════════════════════════════════════════════════════════
(function initAutoBackup() {
  const BACKUP_KEY   = 'aircon_last_backup';
  const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 ชม.

  function _doBackup(silent) {
    try {
      const payload = {
        _backup_at: new Date().toISOString(),
        _version: 'v190',
        machines:  db.machines  || [],
        tickets:   (db.tickets||[]).map(t => { const {signatures:_s,...r}=t; return r; }),
        users:     (db.users||[]).filter(u => !['u2','u3','u4','u5'].includes(u.id)),
        calEvents: db.calEvents || [],
        vendors:   db.vendors   || [],
        repairGroups: db.repairGroups || [],
      };
      const json = JSON.stringify(payload);
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const d    = new Date();
      const ds   = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      a.href     = url;
      a.download = `aircon-backup-${ds}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      localStorage.setItem(BACKUP_KEY, Date.now().toString());
      if (!silent) showToast('💾 Backup สำเร็จ → aircon-backup-'+ds+'.json');
    } catch(e) {
      console.warn('Auto backup error:', e);
    }
  }

  // ── ตรวจสอบและ backup อัตโนมัติ (เฉพาะ admin เท่านั้น) ──
  function checkAutoBackup() {
    if (!CU || CU.role !== 'admin') return; // ไม่ใช่ admin ไม่ backup
    const last = parseInt(localStorage.getItem(BACKUP_KEY) || '0');
    const now  = Date.now();
    if (now - last >= BACKUP_INTERVAL) {
      _doBackup(true); // silent = ไม่โชว์ toast
    }
  }

  // รันหลัง login สำเร็จ (รอ CU ready)
  const _origOnLogin = window._onLoginSuccess;
  window._onLoginSuccess = function() {
    if (_origOnLogin) _origOnLogin();
    if (CU && CU.role === 'admin') {
      setTimeout(checkAutoBackup, 3000);
    }
  };

  // เปิดให้เรียกจากปุ่ม manual (admin เท่านั้น)
  window.manualBackup = function() {
    if (!CU || CU.role !== 'admin') { showToast('⚠️ เฉพาะ Admin เท่านั้น'); return; }
    _doBackup(false);
  };

  // ตรวจทุก 1 ชม. กรณีแอปเปิดค้าง — เก็บ ref ไว้ clear ได้เมื่อ logout
  window._autoBackupInterval = setInterval(checkAutoBackup, 60 * 60 * 1000);
})();



// ══════════════════════════════════════════════════════════════
// NEW TABS: pending / done / dept  (v23-fix45)
// ══════════════════════════════════════════════════════════════

// ── helper: ticket card row ──
function _execTicketRow(t, macMap) {
  const mac = macMap.get(t.machineId);
  const statusLabel = {new:'ใหม่',assigned:'จ่ายแล้ว',accepted:'รับแล้ว',inprogress:'กำลังซ่อม',waiting_part:'รออะไหล่',done:'เสร็จแล้ว',verified:'ตรวจรับ',closed:'ปิดงาน',rejected:'ส่งซ่อมใหม่'}[t.status]||t.status;
  const statusColor = {new:'#1d4ed8',assigned:'#4338ca',accepted:'#7c3aed',inprogress:'#0e7490',waiting_part:'#c2410c',done:'#15803d',verified:'#15803d',closed:'#6b7280',rejected:'#b91c1c'}[t.status]||'#6b7280';
  const cost = _tCost(t);
  const dateStr = t.createdAt ? t.createdAt.slice(0,10) : '';
  return `<div style="background:var(--card);border-radius:14px;padding:14px;border:1px solid #e8ecf0;box-shadow:0 1px 4px rgba(0,0,0,.04);margin-bottom:8px">
    <div style="display:flex;align-items:flex-start;gap:10px">
      <div style="width:34px;height:34px;border-radius:10px;background:${statusColor}18;border:1.5px solid ${statusColor}33;display:flex;align-items:center;justify-content:center;font-size:0.68rem;font-weight:900;color:${statusColor};flex-shrink:0;font-family:'JetBrains Mono',monospace">${(t.id||'').slice(-3)}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
          <span style="font-size:0.78rem;font-weight:800;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${t.problem||'—'}</span>
          <span style="background:${statusColor}15;color:${statusColor};border-radius:6px;padding:2px 8px;font-size:0.6rem;font-weight:800;flex-shrink:0">${statusLabel}</span>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <span style="font-size:0.62rem;color:#64748b">❄️ ${mac?.name||t.machine||'—'}</span>
          <span style="font-size:0.62rem;color:#64748b">👷 ${t.assignee||'ยังไม่จ่ายงาน'}</span>
          ${cost>0?`<span style="font-size:0.62rem;color:#7c3aed;font-weight:700">฿${cost.toLocaleString()}</span>`:''}
          ${dateStr?`<span style="font-size:0.62rem;color:#94a3b8">${dateStr}</span>`:''}
        </div>
      </div>
    </div>
  </div>`;
}

// ── TAB: PENDING ──
function _renderExecPending(d) {
  const { tickets, macMap } = d;
  const el = document.getElementById('exec-pending-list');
  if (!el) return;
  const pending = tickets.filter(t => !['done','verified','closed'].includes(t.status))
    .sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
  const header = `<div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1.5px solid #fde68a;border-radius:16px;padding:14px 16px;margin-bottom:12px;display:flex;align-items:center;gap:10px">
    <span style="font-size:1.4rem">⏳</span>
    <div>
      <div style="font-size:0.88rem;font-weight:900;color:#92400e">รายการงานที่ยังค้างอยู่</div>
      <div style="font-size:0.65rem;color:#b45309;margin-top:2px">${pending.length} รายการ · ยังไม่ปิดงาน</div>
    </div>
  </div>`;
  if (!pending.length) {
    el.innerHTML = header + `<div style="background:var(--card);border-radius:14px;padding:28px;text-align:center;border:1px solid var(--border)"><div style="font-size:2rem;margin-bottom:6px">🎉</div><div style="font-size:0.85rem;font-weight:800;color:#059669">ไม่มีงานค้าง!</div></div>`;
    return;
  }
  el.innerHTML = header + pending.map(t => _execTicketRow(t, macMap)).join('');
}

// ── TAB: DONE ──
function _renderExecDone(d) {
  const { tickets, macMap } = d;
  const el = document.getElementById('exec-done-list');
  if (!el) return;
  const done = tickets.filter(t => ['done','verified','closed'].includes(t.status))
    .sort((a,b) => (b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''))
    .slice(0, 100);
  const header = `<div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #bbf7d0;border-radius:16px;padding:14px 16px;margin-bottom:12px;display:flex;align-items:center;gap:10px">
    <span style="font-size:1.4rem">✅</span>
    <div>
      <div style="font-size:0.88rem;font-weight:900;color:#166534">รายการงานที่เสร็จแล้ว</div>
      <div style="font-size:0.65rem;color:#15803d;margin-top:2px">${done.length} รายการล่าสุด</div>
    </div>
  </div>`;
  if (!done.length) {
    el.innerHTML = header + `<div style="background:var(--card);border-radius:14px;padding:28px;text-align:center;border:1px solid var(--border)"><div style="font-size:0.8rem;color:#94a3b8">ยังไม่มีงานเสร็จ</div></div>`;
    return;
  }
  el.innerHTML = header + done.map(t => _execTicketRow(t, macMap)).join('');
}

// ── TAB: DEPT — Top แผนก + drill-down ห้อง ──
function _renderExecDept(d) {
  const { tickets, macMap } = d;
  const el = document.getElementById('exec-dept-list');
  if (!el) return;

  // Group by dept
  const deptMap = {};
  tickets.forEach(t => {
    const mac = macMap.get(t.machineId);
    const dept = t.dept || mac?.dept || mac?.location || 'ไม่ระบุแผนก';
    const room = mac?.name || t.machine || '—';
    if (!deptMap[dept]) deptMap[dept] = { count:0, rooms:{}, cost:0 };
    deptMap[dept].count++;
    deptMap[dept].cost += _tCost(t);
    deptMap[dept].rooms[room] = (deptMap[dept].rooms[room]||0) + 1;
  });

  const sorted = Object.entries(deptMap).sort((a,b) => b[1].count - a[1].count);
  const maxCnt = sorted[0]?.[1]?.count || 1;
  const palettes = ['#1d4ed8','#7c3aed','#0891b2','#d97706','#16a34a','#dc2626','#0e7490','#9333ea'];

  const header = `<div style="background:linear-gradient(135deg,#eff6ff,#e0f2fe);border:1.5px solid #bfdbfe;border-radius:16px;padding:14px 16px;margin-bottom:12px;display:flex;align-items:center;gap:10px">
    <span style="font-size:1.4rem">🏢</span>
    <div>
      <div style="font-size:0.88rem;font-weight:900;color:#1e3a8a">Top แผนกที่มีงานมากสุด</div>
      <div style="font-size:0.65rem;color:#1d4ed8;margin-top:2px">${sorted.length} แผนก · กดดูห้องได้</div>
    </div>
  </div>`;

  if (!sorted.length) {
    el.innerHTML = header + `<div style="background:var(--card);border-radius:14px;padding:28px;text-align:center;border:1px solid var(--border)"><div style="font-size:0.8rem;color:#94a3b8">ไม่มีข้อมูล</div></div>`;
    return;
  }

  el.innerHTML = header + sorted.map(([dept, info], i) => {
    const color = palettes[i % palettes.length];
    const pct = Math.round(info.count / maxCnt * 100);
    const roomsSorted = Object.entries(info.rooms).sort((a,b) => b[1]-a[1]);
    const roomsHtml = roomsSorted.map(([room, cnt]) =>
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f8fafc">
        <span style="font-size:0.7rem;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">🔹 ${room}</span>
        <span style="font-size:0.7rem;font-weight:800;color:${color};flex-shrink:0;margin-left:8px">${cnt} งาน</span>
      </div>`
    ).join('');
    const uid = 'dept-' + i;
    return `<div style="background:var(--card);border-radius:16px;border:1px solid #e8ecf0;box-shadow:0 1px 4px rgba(0,0,0,.04);margin-bottom:10px;overflow:hidden">
      <div onclick="document.getElementById('${uid}').style.display=document.getElementById('${uid}').style.display==='none'?'block':'none';this.querySelector('.dept-arrow').style.transform=document.getElementById('${uid}').style.display!=='none'?'rotate(90deg)':'rotate(0deg)'"
        style="display:flex;align-items:center;gap:12px;padding:14px;cursor:pointer;-webkit-tap-highlight-color:transparent">
        <div style="width:40px;height:40px;border-radius:12px;background:${color}18;border:2px solid ${color}33;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <span style="font-size:0.78rem;font-weight:900;color:${color}">🏢</span>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.82rem;font-weight:900;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${dept}</div>
          <div style="margin-top:5px;background:var(--bg-2,#f1f5f9);border-radius:99px;height:5px;overflow:hidden">
            <div style="background:${color};border-radius:99px;height:5px;width:${pct}%;transition:width .6s ease"></div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:1rem;font-weight:900;color:${color};font-family:'JetBrains Mono',monospace">${info.count}</div>
          <div style="font-size:0.55rem;color:#94a3b8;font-weight:700">งาน</div>
        </div>
        <svg class="dept-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" style="flex-shrink:0;transition:transform .2s"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div id="${uid}" style="display:none;border-top:1px solid #f1f5f9;padding:12px 14px">
        <div style="font-size:0.65rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">ห้อง / เครื่อง</div>
        ${roomsHtml}
        ${info.cost > 0 ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between"><span style="font-size:0.68rem;color:#94a3b8">รวมค่าใช้จ่าย</span><span style="font-size:0.72rem;font-weight:900;color:#7c3aed">฿${info.cost.toLocaleString()}</span></div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Patch _renderExecTab to include new tabs ──
const _origRenderExecTab = _renderExecTab;
_renderExecTab = function(tab) {
  const d = _execGetData();
  if (tab === 'pending') _renderExecPending(d);
  else if (tab === 'done') _renderExecDone(d);
  else if (tab === 'dept') _renderExecDept(d);
  else _origRenderExecTab(tab);
};
