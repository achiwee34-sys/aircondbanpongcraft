(function() {
  let startY = 0, pulling = false, threshold = 70;
  const getInd = () => document.getElementById('ptr-indicator');
  const getText = () => document.getElementById('ptr-text');
  const getSpin = () => document.getElementById('ptr-spinner');

  document.addEventListener('touchstart', e => {
    if (document.querySelector('.sheet.open')) return;
    const el = document.querySelector('.page.active');
    if (el && el.scrollTop === 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, {passive: true});

  document.addEventListener('touchmove', e => {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 10) {
      const ind = getInd();
      if (dy >= threshold) {
        ind.className = 'releasing';
        getText().textContent = 'ปล่อยเพื่อรีเฟรช';
        getSpin().textContent = '↑';
      } else {
        ind.className = 'pulling';
        getText().textContent = 'ดึงเพื่อรีเฟรช';
        getSpin().textContent = '↓';
      }
    }
  }, {passive: true});

  document.addEventListener('touchend', e => {
    if (!pulling) return;
    pulling = false;
    const dy = e.changedTouches[0].clientY - startY;
    const ind = getInd();
    if (dy >= threshold) {
      ind.className = 'refreshing';
      getText().textContent = 'กำลังรีเฟรช...';
      getSpin().textContent = '↻';
      setTimeout(() => {
        if (typeof refreshPage === 'function') refreshPage(); else location.reload();
        setTimeout(() => { ind.className = ''; }, 500);
      }, 600);
    } else {
      ind.className = '';
    }
  }, {passive: true});
})();

// ============================================================
// MACHINE HISTORY
// ============================================================
function openMachineHistory(mid) {
  const m = db.machines.find(x => x.id === mid);
  if (!m) return;
  _mhistCurrentMid = mid; // track สำหรับ Export Excel
  const tickets = (db.tickets||[]).filter(t => t.machineId === mid || t.machine === m.name)
    .sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
  // XSS FIX (audit #6): escape m.serial and m.name before innerHTML
  const _escMH = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  document.getElementById('mhist-title').innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:6px"><rect x="2" y="3" width="20" height="8" rx="2"/><line x1="2" y1="7" x2="22" y2="7"/><path d="M7 11v5"/><path d="M12 11v9"/><path d="M17 11v5"/><circle cx="7" cy="17" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="21" r="1" fill="currentColor" stroke="none"/><circle cx="17" cy="17" r="1" fill="currentColor" stroke="none"/></svg> <span>${_escMH(m.serial||m.id)} — ${_escMH(m.name)}</span>`;
  if (tickets.length === 0) {
    document.getElementById('mhist-body').innerHTML = '<div class="empty"><div class="ei">📭</div><p>ยังไม่มีประวัติการซ่อม</p></div>';
  } else {
    const totalCost    = tickets.reduce((s,t)=>s+(parseFloat(t.cost)||0),0);
    const totalRepair  = tickets.reduce((s,t)=>s+(parseFloat(t.repairCost)||0),0);
    const totalParts   = tickets.reduce((s,t)=>s+(parseFloat(t.partsCost)||0),0);
    const doneCnt      = tickets.filter(t=>['done','verified','closed'].includes(t.status)).length;
    document.getElementById('mhist-body').innerHTML = `
      <!-- Grand Total Banner -->
      <div style="background:linear-gradient(135deg,#7f1d1d,#c8102e);border-radius:16px;padding:16px;margin-bottom:12px;position:relative;overflow:hidden">
        <div style="position:absolute;right:-20px;top:-20px;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,0.06)"></div>
        <div style="position:absolute;left:-15px;bottom:-15px;width:70px;height:70px;border-radius:50%;background:rgba(0,0,0,0.15)"></div>
        <div style="position:relative">
          <div style="font-size:0.62rem;font-weight:800;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">💰 ค่าใช้จ่ายสะสมทั้งหมด (${tickets.length} ครั้ง)</div>
          <div style="font-size:2rem;font-weight:900;color:white;letter-spacing:-0.02em;line-height:1.1">${totalCost>0?'฿'+totalCost.toLocaleString():'฿0'}</div>
          <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
            <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:6px 10px;backdrop-filter:blur(4px)">
              <div style="font-size:0.6rem;color:rgba(255,255,255,0.7);font-weight:600">🔧 ค่าซ่อม</div>
              <div style="font-size:0.9rem;font-weight:900;color:white">${totalRepair>0?'฿'+totalRepair.toLocaleString():'-'}</div>
            </div>
            <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:6px 10px;backdrop-filter:blur(4px)">
              <div style="font-size:0.6rem;color:rgba(255,255,255,0.7);font-weight:600">🛒 ราคาซื้อของ</div>
              <div style="font-size:0.9rem;font-weight:900;color:white">${totalParts>0?'฿'+totalParts.toLocaleString():'-'}</div>
            </div>
          </div>
        </div>
      </div>
      <!-- Summary stats -->
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:12px">
        <div style="background:#fff0f2;border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:1.4rem;font-weight:800;color:var(--accent)">${tickets.length}</div>
          <div style="font-size:0.65rem;color:var(--muted)">ครั้งทั้งหมด</div>
        </div>
        <div style="background:#f0fdf4;border-radius:10px;padding:10px;text-align:center">
          <div style="font-size:1.4rem;font-weight:800;color:#166534">${doneCnt}</div>
          <div style="font-size:0.65rem;color:var(--muted)">เสร็จสิ้น</div>
        </div>
      </div>
      <!-- Ticket list -->
      ${tickets.map(t => {
        const rc = parseFloat(t.repairCost)||0;
        const pc = parseFloat(t.partsCost)||0;
        const tc = parseFloat(t.cost)||0;
        const poRows = (t.purchaseOrder?.rows||[]).filter(r=>r.name);
        const prNum  = t.purchaseOrder?.pr||'';
        const poNum  = t.purchaseOrder?.po||'';
        return `
        <div style="border:1px solid #f0f0f0;border-radius:12px;margin-bottom:8px;overflow:hidden;background:white;box-shadow:0 1px 4px rgba(0,0,0,0.04)">
          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#fafafa;border-bottom:1px solid #f0f0f0">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:0.72rem;font-family:'JetBrains Mono',monospace;font-weight:800;color:#c8102e;background:#fff0f2;border:1px solid #fecaca;border-radius:6px;padding:2px 7px">${t.id}</span>
              <span class="tag ${stc(t.status)}" style="font-size:0.62rem">${sTH(t.status)}</span>
            </div>
            <span style="font-size:0.65rem;color:#94a3b8">${(t.createdAt||'').slice(0,10)}</span>
          </div>
          <!-- Body -->
          <div style="padding:8px 10px">
            <div style="font-weight:700;font-size:0.83rem;color:#0f172a;margin-bottom:4px">${escapeHtml(t.problem||'')}</div>
            ${t.assignee?`<div style="font-size:0.7rem;color:#64748b;margin-bottom:4px">🔧 ${escapeHtml(t.assignee)}</div>`:''}
            ${t.detail?`<div style="font-size:0.72rem;color:#64748b;margin-bottom:4px">${escapeHtml(t.detail)}</div>`:''}
            <!-- ค่าใช้จ่ายแยกรายการ -->
            ${(rc>0||pc>0||tc>0)?`
            <div style="background:#f8fafc;border-radius:8px;padding:8px;margin-top:6px;display:flex;flex-direction:column;gap:4px">
              ${rc>0?`<div style="display:flex;justify-content:space-between;font-size:0.72rem"><span style="color:#475569">🔧 ค่าซ่อม</span><span style="font-weight:800;color:#1d4ed8">฿${rc.toLocaleString()}</span></div>`:''}
              ${pc>0?`<div style="display:flex;justify-content:space-between;font-size:0.72rem"><span style="color:#475569">🛒 ราคาซื้อของ</span><span style="font-weight:800;color:#d97706">฿${pc.toLocaleString()}</span></div>`:''}
              ${(rc>0&&pc>0)?`<div style="height:1px;background:#e2e8f0;margin:2px 0"></div>`:''}
              ${tc>0?`<div style="display:flex;justify-content:space-between;font-size:0.75rem"><span style="font-weight:800;color:#0f172a">รวม</span><span style="font-weight:900;color:#c8102e">฿${tc.toLocaleString()}</span></div>`:''}
            </div>`:''}
            <!-- รายการอะไหล่ที่สั่ง -->
            ${poRows.length>0?`
            <div style="margin-top:7px">
              <div style="font-size:0.62rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">
                🛒 รายการสั่งซื้ออะไหล่${prNum?` · <span style="color:#92400e;background:#fef3c7;border-radius:4px;padding:1px 5px">PR: ${prNum}</span>`:''}${poNum?` · <span style="color:#1d4ed8;background:#dbeafe;border-radius:4px;padding:1px 5px">PO: ${poNum}</span>`:''}
              </div>
              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:6px 8px;display:flex;flex-direction:column;gap:3px">
                ${poRows.map(r=>`
                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.7rem">
                    <span style="color:#0f172a;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:6px">${escapeHtml(r.name)}</span>
                    <span style="color:#78350f;white-space:nowrap">${r.qty||1} × ฿${Number(r.price||0).toLocaleString()} = <b>฿${((r.qty||1)*(r.price||0)).toLocaleString()}</b></span>
                  </div>
                `).join('')}
              </div>
            </div>`:''}
            ${t.parts&&!poRows.length?`<div style="font-size:0.7rem;color:#64748b;margin-top:5px">🔩 อะไหล่: ${escapeHtml(t.parts)}</div>`:''}
            ${t.summary?`<div style="margin-top:6px;font-size:0.73rem;background:#f0fdf4;border:1px solid #d1fae5;border-radius:7px;padding:7px;color:#14532d">${formatSummary(t.summary)}</div>`:''}
          </div>
        </div>`;
      }).join('')}`;
  }
  openSheet('mhist');
}

// ── Export Excel ประวัติการซ่อมของเครื่องนี้ ──────────────────
// ── Export Excel ประวัติการซ่อมของเครื่องที่เปิดอยู่ ─────────
let _mhistCurrentMid = null; // track machine id ที่เปิด mhist ล่าสุด

function exportMachineHistorySheet() {
  if (typeof XLSX === 'undefined') { waitForXLSX(exportMachineHistorySheet); return; }
  const mid = _mhistCurrentMid;
  const m   = mid ? db.machines.find(x => x.id === mid) : null;
  if (!m) { showToast('⚠️ ไม่พบข้อมูลเครื่อง'); return; }

  const tickets = db.tickets
    .filter(t => t.machineId === mid || t.machine === m.name)
    .sort((a, b) => (b.createdAt||'').localeCompare(a.createdAt||''));

  if (!tickets.length) { showToast('⚠️ ไม่มีประวัติการซ่อม'); return; }

  const today = new Date().toLocaleDateString('th-TH',{year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\//g,'-');
  const macLabel = (m.serial||m.id.replace('csv_','')) + '_' + (m.name||'').replace(/[/\\?%*:|"<>]/g,'_').slice(0,20);

  // ── Summary row ──
  const totalCost   = tickets.reduce((s,t)=>s+(parseFloat(t.cost)||0), 0);
  const totalRepair = tickets.reduce((s,t)=>s+(parseFloat(t.repairCost)||0), 0);
  const totalParts  = tickets.reduce((s,t)=>s+(parseFloat(t.partsCost)||0), 0);
  const doneCnt     = tickets.filter(t=>['done','verified','closed'].includes(t.status)).length;

  // ── Header info sheet ──
  const infoRows = [
    ['ข้อมูลเครื่องแอร์', ''],
    ['Serial / Air ID', m.serial || m.id.replace('csv_','')],
    ['ชื่อเครื่อง',       m.name  || '—'],
    ['แผนก',              m.dept  || '—'],
    ['Location',          m.location || '—'],
    ['BTU',               m.btu   || '—'],
    ['ยี่ห้อ CDU',         m.mfrCDU || m.brandCDU || '—'],
    ['Model CDU',         m.modelCDU || '—'],
    ['ยี่ห้อ FCU',         m.mfrFCU || m.brandFCU || '—'],
    ['Model FCU',         m.modelFCU || '—'],
    ['วันติดตั้ง',         m.install || '—'],
    [''],
    ['สรุปประวัติซ่อม', ''],
    ['จำนวนครั้งทั้งหมด',  tickets.length],
    ['เสร็จสิ้น',          doneCnt],
    ['ค่าซ่อมรวม (฿)',     totalRepair],
    ['ค่าอะไหล่รวม (฿)',   totalParts],
    ['ค่าใช้จ่ายรวม (฿)',  totalCost],
    ['Export เมื่อ',       today],
  ];

  // ── Ticket detail rows ──
  const headers = [
    'Ticket ID','วันที่แจ้ง','วันที่อัพเดต','ปัญหา','รายละเอียด',
    'ช่างผู้รับผิดชอบ','สถานะ','ความเร่งด่วน',
    'ค่าซ่อม (฿)','ค่าอะไหล่ (฿)','รวม (฿)',
    'สรุปการซ่อม','อะไหล่','PR No.','PO No.',
    'ผู้แจ้ง','แผนกผู้แจ้ง'
  ];

  const STATUS_TH = {new:'ใหม่',assigned:'จ่ายงาน',working:'กำลังซ่อม',
    waiting_part:'รออะไหล่',done:'เสร็จแล้ว',verified:'ยืนยัน',closed:'ปิดงาน'};
  const PRI_TH = {low:'ต่ำ',normal:'ปกติ',high:'สูง',urgent:'เร่งด่วน'};

  const dataRows = tickets.map(t => {
    const poRows = (t.purchaseOrder?.rows||[]).filter(r=>r.name);
    const partsList = poRows.length
      ? poRows.map(r=>`${r.name} ${r.qty||1}×฿${r.price||0}`).join(', ')
      : (t.parts||'');
    return [
      t.id,
      (t.createdAt||'').slice(0,10),
      (t.updatedAt||'').slice(0,10),
      t.problem||'',
      t.detail||'',
      t.assignee||'—',
      STATUS_TH[t.status]||t.status||'',
      PRI_TH[t.priority]||t.priority||'',
      parseFloat(t.repairCost)||0,
      parseFloat(t.partsCost)||0,
      parseFloat(t.cost)||0,
      t.summary||'',
      partsList,
      t.purchaseOrder?.pr||'',
      t.purchaseOrder?.po||'',
      t.reporter||'',
      t.reporterDept||'',
    ];
  });

  const wb = XLSX.utils.book_new();

  // Sheet 1: ข้อมูลเครื่อง
  const wsInfo = XLSX.utils.aoa_to_sheet(infoRows);
  wsInfo['!cols'] = [{wch:22},{wch:30}];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'ข้อมูลเครื่อง');

  // Sheet 2: ประวัติการซ่อม
  const wsData = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  wsData['!cols'] = [
    {wch:14},{wch:12},{wch:12},{wch:24},{wch:28},
    {wch:16},{wch:12},{wch:10},
    {wch:12},{wch:12},{wch:12},
    {wch:30},{wch:24},{wch:12},{wch:12},
    {wch:16},{wch:14}
  ];
  XLSX.utils.book_append_sheet(wb, wsData, 'ประวัติซ่อม');

  XLSX.writeFile(wb, `History_${macLabel}_${today}.xlsx`);
  showToast('✅ Export เรียบร้อย');
}
function openAirIdSearch() {
  const inp = document.getElementById('airsearch-input');
  if (inp) { inp.value = ''; }
  openSheet('airsearch');
  setTimeout(() => { renderAirSearchResults(); }, 350);
}

function renderAirSearchResults() {
  const q = (document.getElementById('airsearch-input').value||'').trim().toLowerCase();
  const el = document.getElementById('airsearch-results');
  if (!q) {
    // แสดงงานซ่อมล่าสุด 10 รายการ
    const recentTix = (db.tickets||[])
      .slice()
      .sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))
      .slice(0,10);
    if (!recentTix.length) {
      el.innerHTML = '<div style="text-align:center;padding:32px 16px;color:#94a3b8"><div style="font-size:0.8rem">ยังไม่มีงานซ่อม</div></div>';
      return;
    }
    const statusLabel = {new:'ใหม่',assigned:'จ่ายงาน',working:'กำลังซ่อม',done:'เสร็จแล้ว',verified:'ยืนยัน',closed:'ปิดงาน'};
    const statusColor = {new:'#f59e0b',assigned:'#3b82f6',working:'#8b5cf6',done:'#10b981',verified:'#0891b2',closed:'#94a3b8'};
    el.innerHTML = `
      <div style="font-size:0.68rem;font-weight:800;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px;padding:0 2px">งานซ่อมล่าสุด</div>
      ${recentTix.map(t => {
        const m = (db.machines||[]).find(x=>x.id===t.machineId||x.name===t.machine);
        const st = t.status||'new';
        const stColor = statusColor[st]||'#94a3b8';
        const stLabel = statusLabel[st]||st;
        const airId = m ? m.id.replace(/^csv_/,'') : '';
        return `
        <div onclick="closeSheet('airsearch');setTimeout(()=>safeOpenDetail('${t.id}'),220)"
          style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:11px 14px;margin-bottom:8px;cursor:pointer;-webkit-tap-highlight-color:transparent"
          onmousedown="this.style.background='#f8fafc'" onmouseup="this.style.background='white'">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;flex-wrap:wrap">
                <span style="font-size:0.72rem;font-family:'JetBrains Mono',monospace;font-weight:800;color:#c8102e">${t.id}</span>
                ${airId?`<span style="font-size:0.6rem;font-family:'JetBrains Mono',monospace;font-weight:700;color:#0891b2;background:#ecfeff;border-radius:4px;padding:1px 5px">AIR: ${airId}</span>`:''}
              </div>
              <div style="font-size:0.82rem;font-weight:800;color:#0f172a;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml((t.problem||'').slice(0,40))}${(t.problem||'').length>40?'…':''}</div>
              ${m?`<div style="font-size:0.65rem;color:#94a3b8;margin-top:1px">${escapeHtml(m.name||'')}${m.dept?' · '+escapeHtml(m.dept):''}</div>`:''}
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
              <span style="font-size:0.62rem;background:${stColor}18;color:${stColor};border:1px solid ${stColor}40;border-radius:6px;padding:2px 7px;font-weight:800">${stLabel}</span>
              <span style="font-size:0.6rem;color:#94a3b8">${(t.createdAt||'').slice(0,10)}</span>
            </div>
          </div>
        </div>`;
      }).join('')}`;
    return;
  }
  const matched = (db.machines||[]).filter(m =>
    (m.serial||'').toLowerCase().includes(q) ||
    (m.id||'').toLowerCase().includes(q) ||
    (m.name||'').toLowerCase().includes(q) ||
    (m.dept||'').toLowerCase().includes(q)
  );
  if (!matched.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px 16px;color:#94a3b8"><div style="font-size:1.6rem;margin-bottom:6px">📭</div><div style="font-size:0.82rem;font-weight:700">ไม่พบเครื่องแอร์</div></div>';
    return;
  }
  el.innerHTML = matched.slice(0,30).map(m => {
    const tix    = (db.tickets||[]).filter(t => t.machineId===m.id || t.machine===m.name);
    const tixCnt = tix.length;
    const totalCost   = tix.reduce((s,t)=>s+(parseFloat(t.cost)||0),0);
    const totalRepair = tix.reduce((s,t)=>s+(parseFloat(t.repairCost)||0),0);
    const totalParts  = tix.reduce((s,t)=>s+(parseFloat(t.partsCost)||0),0);
    const activeCnt   = tix.filter(t=>!['done','verified','closed'].includes(t.status)).length;
    const lastTk      = tix.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0];
    return `
    <div onclick="closeSheet('airsearch');setTimeout(()=>openMachineHistory('${m.id}'),220)"
      style="background:white;border:1.5px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin-bottom:8px;cursor:pointer;transition:all 0.15s;-webkit-tap-highlight-color:transparent"
      onmousedown="this.style.background='#f8fafc'" onmouseup="this.style.background='white'">
      <!-- Top row: AIR ID + serial + dept -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:6px;margin-bottom:5px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px">
            <span style="font-size:0.7rem;font-family:'JetBrains Mono',monospace;font-weight:900;color:#c8102e;background:#fff0f2;border-radius:4px;padding:1px 6px">AIR: ${m.id.replace(/^csv_/,'')}</span>
            ${m.serial?`<span style="font-size:0.65rem;font-family:'JetBrains Mono',monospace;font-weight:700;color:#0891b2">${escapeHtml(m.serial)}</span>`:''}
          </div>
          <div style="font-size:0.85rem;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px">${escapeHtml(m.name)}</div>
          <div style="font-size:0.65rem;color:#94a3b8;margin-top:1px">${m.dept?escapeHtml(m.dept):''}${m.brand?' · '+escapeHtml(m.brand):''}${m.btu?' · '+Number(m.btu).toLocaleString()+' BTU':''}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
          <span style="font-size:0.65rem;background:#f1f5f9;color:#475569;border-radius:6px;padding:2px 7px;font-weight:700">${tixCnt} งาน</span>
          ${activeCnt>0?`<span style="font-size:0.62rem;background:#fff0f2;color:#c8102e;border:1px solid #fecaca;border-radius:6px;padding:1px 6px;font-weight:800">${activeCnt} ค้าง</span>`:''}
        </div>
      </div>
      <!-- Cost summary row -->
      ${totalCost>0?`
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:5px">
        ${totalRepair>0?`<span style="font-size:0.67rem;background:#eff6ff;color:#1d4ed8;border-radius:6px;padding:2px 7px;font-weight:800">🔧 ฿${totalRepair.toLocaleString()}</span>`:''}
        ${totalParts>0?`<span style="font-size:0.67rem;background:#fffbeb;color:#92400e;border-radius:6px;padding:2px 7px;font-weight:800">🛒 ฿${totalParts.toLocaleString()}</span>`:''}
        <span style="font-size:0.67rem;background:#fff0f2;color:#c8102e;border:1px solid #fecaca;border-radius:6px;padding:2px 7px;font-weight:800">รวม ฿${totalCost.toLocaleString()}</span>
      </div>`:'<div style="font-size:0.67rem;color:#94a3b8;margin-bottom:5px">ยังไม่มีค่าใช้จ่าย</div>'}
      <!-- Last ticket -->
      ${lastTk?`
      <div style="display:flex;align-items:center;justify-content:space-between;padding-top:5px;border-top:1px dashed #f1f5f9">
        <span style="font-size:0.65rem;color:#64748b">งานล่าสุด: <b style="color:#c8102e">${lastTk.id}</b> · ${escapeHtml((lastTk.problem||'').slice(0,30))}${(lastTk.problem||'').length>30?'…':''}</span>
        <span style="font-size:0.62rem;color:#94a3b8">${(lastTk.createdAt||'').slice(0,10)}</span>
      </div>`:''}
      <div style="text-align:right;margin-top:4px;font-size:0.62rem;color:#0891b2;font-weight:700">แตะเพื่อดูประวัติทั้งหมด →</div>
    </div>`;
  }).join('');
}


// ============================================================
// MACHINES
// ============================================================
// ── Pure HTML builder — no DOM reads/writes ──
function _buildMachineRowsHtml(list) {
  if (!window._macPage) window._macPage = 0;
  const PAGE = 15;
  const total = list.length;
  const totalPages = Math.ceil(total / PAGE) || 1;
  const page = Math.min(window._macPage, totalPages-1);
  const slice = list.slice(page*PAGE, page*PAGE+PAGE);

  const qrSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>`;

  const rows = slice.map(m => {
    const serial = m.serial || '';
    const flData = FUNC_LOC[serial] || {};
    const fl     = flData.fl || m.funcLoc || '—';
    const eq     = flData.eq || m.equipment || '—';
    const locDesc= flData.loc || m.location || '—';
    const rid    = 'mrow_' + m.id;
    return `<tr style="cursor:pointer;border-bottom:1px solid #f0f0f0" 
        onmouseover="this.style.background='#fafbff'" onmouseout="this.style.background=''"
        onclick="toggleMachineRow('${m.id}')">
      <td style="padding:6px 10px;white-space:nowrap;font-family:'JetBrains Mono',monospace;font-size:0.7rem;font-weight:700;color:var(--accent)">${serial||m.id.replace('csv_','')}</td>
      <td style="padding:6px 10px;font-weight:600;font-size:0.78rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.name}</td>
      <td style="padding:6px 8px;font-size:0.7rem;color:var(--muted);white-space:nowrap">${m.brand||'—'}</td>
      <td style="padding:6px 8px;font-family:'JetBrains Mono',monospace;font-size:0.68rem;color:#3730a3;white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis">${fl}</td>
      <td style="padding:6px 8px;white-space:nowrap">
        <div style="display:flex;gap:3px;align-items:center">
          <button onclick="event.stopPropagation();showMachineQR('${m.id}')" title="QR Code" style="border:none;background:#f0f4ff;color:#3730a3;border-radius:8px;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">${qrSvg}</button>
          <button onclick="event.stopPropagation();openMachineHistory('${m.id}')" title="ประวัติ" style="border:none;background:#f0fdf4;color:#166534;border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:0.8rem;display:flex;align-items:center;justify-content:center">📋</button>
          <button onclick="event.stopPropagation();openMachineSheet('${m.id}')" title="แก้ไข" style="border:none;background:#fafafa;color:var(--muted);border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:0.8rem;display:flex;align-items:center;justify-content:center">✏️</button>
          <button onclick="event.stopPropagation();delMachine('${m.id}')" title="ลบ" style="border:none;background:#fff0f2;color:var(--accent);border-radius:8px;width:28px;height:28px;cursor:pointer;font-size:0.8rem;display:flex;align-items:center;justify-content:center">🗑️</button>
        </div>
      </td>
    </tr>
    <tr id="${rid}" style="display:none">
      <td colspan="5" style="padding:0;border-bottom:2px solid rgba(200,16,46,0.1)">
        <div>
          <div style="background:#c8102e;padding:7px 14px;display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:0.65rem;font-weight:800;color:white;letter-spacing:0.05em">${m.serial} — ${m.name.length>38?m.name.substring(0,38)+'…':m.name}</span>
            <span style="font-size:0.6rem;color:rgba(255,255,255,0.6)">${m.dept||''}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #f1f5f9">
            <div style="padding:8px 14px;border-right:1px solid #f1f5f9">
              <div style="font-size:0.58rem;font-weight:700;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:3px">📍 สถานที่</div>
              <div style="font-size:0.75rem;font-weight:600;color:#1e293b">${locDesc||m.dept||'—'}</div>
            </div>
            <div style="padding:8px 14px">
              <div style="font-size:0.58rem;font-weight:700;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:3px">🏭 แผนก</div>
              <div style="font-size:0.75rem;font-weight:600;color:#1e293b">${m.dept||'—'}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #dbeafe;background:#eff6ff">
            <div style="padding:8px 14px;border-right:1px solid #dbeafe">
              <div style="font-size:0.58rem;font-weight:800;color:#2563eb;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:3px">🔧 Equipment No.</div>
              <div style="font-size:0.7rem;font-weight:800;color:#1d4ed8;font-family:'JetBrains Mono',monospace">${eq}</div>
            </div>
            <div style="padding:8px 14px">
              <div style="font-size:0.58rem;font-weight:800;color:#4f46e5;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:3px">📌 Function Location</div>
              <div style="font-size:0.7rem;font-weight:800;color:#4338ca;font-family:'JetBrains Mono',monospace">${fl}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #f1f5f9">
            <div style="padding:10px 14px;border-right:1px solid #bae6fd;background:#f0f9ff">
              <div style="display:inline-flex;align-items:center;gap:4px;background:#0ea5e9;border-radius:5px;padding:2px 7px;margin-bottom:5px"><span style="font-size:0.6rem;font-weight:800;color:white;letter-spacing:0.05em">CDU</span></div>
              <div style="font-size:0.82rem;font-weight:800;color:#075985">${m.mfrCDU||'—'}</div>
              <div style="font-size:0.68rem;font-weight:600;color:#0369a1;font-family:'JetBrains Mono',monospace;margin-top:2px">${m.modelCDU||'—'}</div>
            </div>
            <div style="padding:10px 14px;background:#f0fdf4;border-right:1px solid #bbf7d0">
              <div style="display:inline-flex;align-items:center;gap:4px;background:#22c55e;border-radius:5px;padding:2px 7px;margin-bottom:5px"><span style="font-size:0.6rem;font-weight:800;color:white;letter-spacing:0.05em">FCU</span></div>
              <div style="font-size:0.82rem;font-weight:800;color:#14532d">${m.mfrFCU||'—'}</div>
              <div style="font-size:0.68rem;font-weight:600;color:#15803d;font-family:'JetBrains Mono',monospace;margin-top:2px">${m.modelFCU||'—'}</div>
            </div>
          </div>
          <div style="padding:8px 12px;background:#f8fafc;display:flex;flex-wrap:wrap;gap:6px;align-items:center">
            ${m.btu?`<span style="background:#fef9c3;color:#854d0e;border:1px solid #fde047;border-radius:8px;padding:3px 10px;font-size:0.7rem;font-weight:800">🌡️ ${Number(m.btu).toLocaleString()} BTU</span>`:''}
            ${m.refrigerant?`<span style="background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;border-radius:8px;padding:3px 10px;font-size:0.7rem;font-weight:800">❄️ ${m.refrigerant}</span>`:''}
            ${m.interval?`<span style="background:#ede9fe;color:#6d28d9;border:1px solid #c4b5fd;border-radius:8px;padding:3px 10px;font-size:0.7rem;font-weight:800">🗓️ PM ${m.interval} เดือน</span>`:''}
            ${m.install?`<span style="background:#f0fdf4;color:#166534;border:1px solid #86efac;border-radius:8px;padding:3px 10px;font-size:0.7rem;font-weight:700">📅 ${m.install}</span>`:''}
            ${m.vendor?`<span style="background:${vendorStyle(m.vendor).bg};color:${vendorStyle(m.vendor).color};border:1px solid ${vendorStyle(m.vendor).border};border-radius:8px;padding:3px 10px;font-size:0.7rem;font-weight:800">🏢 ${m.vendor}</span>`:''}
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');

  const pager = totalPages > 1 ? `
    <tr><td colspan="5" style="padding:8px 10px;text-align:center;background:#f9fafb;border-top:1px solid #e5e7eb">
      <div style="display:flex;align-items:center;justify-content:center;gap:10px">
        <button onclick="macPageGo(${page-1})" ${page===0?'disabled style="opacity:0.3"':''} style="border:1px solid #e5e7eb;background:white;border-radius:8px;padding:4px 12px;cursor:pointer;font-size:0.78rem">‹</button>
        <span style="font-size:0.75rem;color:var(--muted)">หน้า ${page+1}/${totalPages} · ${total} เครื่อง</span>
        <button onclick="macPageGo(${page+1})" ${page>=totalPages-1?'disabled style="opacity:0.3"':''} style="border:1px solid #e5e7eb;background:white;border-radius:8px;padding:4px 12px;cursor:pointer;font-size:0.78rem">›</button>
      </div>
    </td></tr>` : '';

  return rows + pager;
}

function toggleMachineRow(id) {
  const row = document.getElementById('mrow_' + id);
  if (!row) return;
  const isOpen = row.style.display !== 'none';
  // ปิดทุก row ก่อน
  document.querySelectorAll('[id^="mrow_"]').forEach(r => r.style.display = 'none');
  if (!isOpen) row.style.display = 'table-row';
}

function macPageGo(p) {
  window._macPage = p;
  applyMachineFilter();
}

let _macDeptFilter = '';
let _macZoneFilter = '';

function getMacZone(m) { return m.zone || 'process'; }

// ── Range A/B/C ──
// A = MCC, PLC, DCS (ห้องควบคุม Critical)
// B = ห้องทั่วไป / สำนักงาน (ไม่ใช่ชิลเลอร์)
// C = เครื่องเล็ก
const RANGE_A_KEYWORDS = ['mcc','plc','dcs','control room','e-room','eroom','electrical','e room'];
const RANGE_C_KEYWORDS = ['เล็ก','small','mini','portable'];
function getMachineRange(m) {
  if (m.range) return m.range; // admin override
  const haystack = [m.name, m.dept, m.location].filter(Boolean).join(' ').toLowerCase();
  if (RANGE_A_KEYWORDS.some(k => haystack.includes(k))) return 'A';
  if (RANGE_C_KEYWORDS.some(k => haystack.includes(k))) return 'C';
  return 'B';
}
function getRangeBadgeHtml(range, size) {
  const s = size === 'sm' ? 'font-size:0.58rem;padding:1px 6px' : 'font-size:0.6rem;padding:1px 7px';
  const styles = {
    A: `background:#fff1f2;color:#be123c;border:1px solid #fecdd3;${s};border-radius:5px;font-weight:800`,
    B: `background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd;${s};border-radius:5px;font-weight:800`,
    C: `background:#f7fee7;color:#4d7c0f;border:1px solid #d9f99d;${s};border-radius:5px;font-weight:800`,
  };
  const labels = { A:'🔴 Range A', B:'🔵 Range B', C:'🟢 Range C' };
  return `<span style="${styles[range]||styles.B}">${labels[range]||'Range '+range}</span>`;
}

function setMacZone(zone) {
  _macZoneFilter = zone; _macDeptFilter = '';
  ['all','process','office'].forEach(z => {
    const btn = document.getElementById('mac-zone-'+z);
    if (!btn) return;
    const active = z === (zone||'all');
    btn.style.background = active ? '#0f172a' : 'white';
    btn.style.color = active ? 'white' : '#374151';
    btn.style.borderColor = active ? '#0f172a' : '#e2e8f0';
  });
  renderMachines();
}
let _macVendorFilter = '';
let _macBtuFilter = ''; // '' | 'small' | 'mid' | 'large' | 'xlarge'
const BTU_RANGES = [
  { key: 'small',  label: '< 9,000',       min: 0,     max: 8999  },
  { key: 'mid',    label: '9K–18K',         min: 9000,  max: 18000 },
  { key: 'large',  label: '18K–36K',        min: 18001, max: 36000 },
  { key: 'xlarge', label: '> 36,000',       min: 36001, max: Infinity },
];
function setMacBtu(key) { _macBtuFilter = (_macBtuFilter === key) ? '' : key; applyMachineFilter(); }

function applyMachineFilter() {
  const q = document.getElementById('mac-search')?.value || '';
  const kw = q.toLowerCase().trim();
  let list = db.machines;
  // Zone filter
  if (_macZoneFilter) {
    list = list.filter(m => (m.zone||'process') === _macZoneFilter);
  }
  if (_macZoneFilter) { list = list.filter(m => getMacZone(m) === _macZoneFilter); }
  if (_macDeptFilter) { list = list.filter(m => (m.dept||m.location||'') === _macDeptFilter); }
  if (_macVendorFilter) {
    list = list.filter(m => (m.vendor||'') === _macVendorFilter);
  }
  if (_macBtuFilter) {
    const range = BTU_RANGES.find(r => r.key === _macBtuFilter);
    if (range) list = list.filter(m => { const b = Number(m.btu||0); return b >= range.min && b <= range.max; });
  }
  if (kw) {
    list = list.filter(m =>
      (m.serial||'').toLowerCase().includes(kw) ||
      (m.name||'').toLowerCase().includes(kw) ||
      (m.brand||'').toLowerCase().includes(kw) ||
      (m.vendor||'').toLowerCase().includes(kw) ||
      (m.dept||'').toLowerCase().includes(kw) ||
      (m.location||'').toLowerCase().includes(kw) ||
      (m.refrigerant||'').toLowerCase().includes(kw) ||
      (m.funcLoc||'').toLowerCase().includes(kw) ||
      (FUNC_LOC[m.serial||''] ? FUNC_LOC[m.serial].fl.toLowerCase().includes(kw) : false)
    );
  }
  window._macFilteredList = list;
  const allCount = db.machines.length;
  const hasFilter = !!(_macDeptFilter || _macVendorFilter || _macBtuFilter || kw);

  // ── Build dept tabs ──
  const depts = [...new Set(db.machines.map(m => m.dept||m.location||'').filter(Boolean))].sort();
  let tabsHtml = `<button onclick="setMacDept('')" style="white-space:nowrap;border:none;border-radius:99px;padding:5px 12px;font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;transition:background 0.15s,color 0.15s;background:${!_macDeptFilter?'var(--accent)':'#f3f4f6'};color:${!_macDeptFilter?'white':'var(--muted)'}">ทั้งหมด <span style="opacity:0.8">(${allCount})</span></button>`;
  tabsHtml += depts.map(d => {
    const cnt = db.machines.filter(m=>(m.dept||m.location||'')===d).length;
    const active = _macDeptFilter === d;
    return `<button onclick="setMacDept('${d.replace(/'/g,"\\'")}') " style="white-space:nowrap;border:none;border-radius:99px;padding:5px 12px;font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;transition:background 0.15s,color 0.15s;background:${active?'var(--accent)':'#f3f4f6'};color:${active?'white':'var(--muted)'}">${d} <span style="opacity:0.8">(${cnt})</span></button>`;
  }).join('');

  // ── Build vendor tabs ──
  const vendors = [...new Set(db.machines.map(m=>m.vendor||'').filter(Boolean))].sort();
  let vendorTabsHtml = vendors.map(v=>{
    const cnt = db.machines.filter(m=>(m.vendor||'')===v).length;
    const active = _macVendorFilter === v;
    const vc = {SKIC:'#1d4ed8',TPC:'#16a34a',SNP:'#92400e',SCG:'#ea580c'}[v]||(active?'#475569':'#6b7280');
    return `<button onclick="setMacVendor('${v}')" style="white-space:nowrap;border:none;border-radius:99px;padding:4px 10px;font-size:0.68rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.15s;background:${active?vc+'20':'#f3f4f6'};color:${active?vc:'#6b7280'};border:1.5px solid ${active?vc+'60':'transparent'}">${v} (${cnt})</button>`;
  }).join('');

  // ── Clear button ──
  // ── Build BTU chips ──
  let btuTabsHtml = BTU_RANGES.map(r => {
    const cnt = db.machines.filter(m => { const b = Number(m.btu||0); return b >= r.min && b <= r.max; }).length;
    if (!cnt) return '';
    const active = _macBtuFilter === r.key;
    const colors = { small:'#6d28d9', mid:'#0369a1', large:'#ea580c', xlarge:'#b91c1c' };
    const c = colors[r.key] || '#475569';
    return `<button onclick="setMacBtu('${r.key}')" style="white-space:nowrap;border:none;border-radius:99px;padding:4px 10px;font-size:0.68rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.15s;background:${active?c+'20':'#f3f4f6'};color:${active?c:'#6b7280'};border:1.5px solid ${active?c+'60':'transparent'}">${r.label} BTU (${cnt})</button>`;
  }).join('');

  const clearHtml = hasFilter
    ? `<button onclick="clearMacFilter()" style="white-space:nowrap;border:none;border-radius:99px;padding:5px 12px;font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;background:#fee2e2;color:#b91c1c;display:flex;align-items:center;gap:4px;flex-shrink:0"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>ล้าง</button>`
    : '';

  const rowsHtml = _buildMachineRowsHtml(list);
  const countTxt = list.length < allCount
    ? `แสดง ${list.length} จาก ${allCount} เครื่อง`
    : `ทั้งหมด ${allCount} เครื่อง`;

  requestAnimationFrame(() => {
    const tabsEl = document.getElementById('mac-dept-tabs');
    if (tabsEl) tabsEl.innerHTML = tabsHtml;
    const vendorEl = document.getElementById('mac-vendor-tabs');
    if (vendorEl) vendorEl.innerHTML = vendorTabsHtml;
    const btuEl = document.getElementById('mac-btu-tabs');
    if (btuEl) btuEl.innerHTML = btuTabsHtml;
    const clearEl = document.getElementById('mac-clear-btn');
    if (clearEl) clearEl.innerHTML = clearHtml;
    const tableSheet = document.getElementById('mac-table-sheet');
    if (tableSheet && tableSheet.classList.contains('open')) {
      const tbody = document.getElementById('mac-tbody');
      if (tbody) tbody.innerHTML = rowsHtml;
    }
    const countEl = document.getElementById('mac-count');
    if (countEl) countEl.textContent = countTxt;
    if (window._macView === 'dashboard') renderMachineDashboard();
  });
}

function setMacDept(dept) {
  _macDeptFilter = dept;
  window._macPage = 0;
  applyMachineFilter();
}

function setMacVendor(vendor) {
  _macVendorFilter = (_macVendorFilter === vendor) ? '' : vendor;
  window._macPage = 0;
  applyMachineFilter();
}

function clearMacFilter() {
  _macDeptFilter = '';
  _macVendorFilter = '';
  _macBtuFilter = '';
  window._macPage = 0;
  const searchEl = document.getElementById('mac-search');
  if (searchEl) searchEl.value = '';
  applyMachineFilter();
}
// ── Export Menu ──
function openMachineExportMenu(btn) {
  document.getElementById('mac-export-menu')?.remove();

  const menu = document.createElement('div');
  menu.id = 'mac-export-menu';
  menu.style.cssText = 'position:fixed;background:white;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:99999;min-width:210px;overflow:hidden';

  const items = [
    { icon:'📋', label:'รายการเครื่องแอร์ทั้งหมด', fn:'exportMachineList()', color:'#0f172a' },
    { icon:'🔧', label:'ประวัติการซ่อม + ค่าใช้จ่าย', fn:'exportMachineHistory()', color:'#0f172a' },
    { icon:'✨', label:'เครื่องเพิ่มใหม่ (2 เดือน)', fn:'exportNewMachines()', color:'#15803d' },
  ];

  menu.innerHTML = items.map((it,i) => `
    <button onclick="document.getElementById('mac-export-menu').remove();${it.fn}"
      style="width:100%;padding:10px 14px;border:none;background:white;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:0.82rem;font-weight:600;color:${it.color};font-family:inherit;text-align:left;transition:background 0.1s${i<items.length-1?';border-bottom:1px solid #f1f5f9':''}"
      onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
      <span style="font-size:0.95rem">${it.icon}</span>${it.label}
    </button>`).join('');

  document.body.appendChild(menu);

  // คำนวณตำแหน่งจาก btn
  const rect = btn.getBoundingClientRect();
  menu.style.top  = (rect.bottom + 6) + 'px';
  menu.style.left = rect.left + 'px';

  // ตรวจว่าล้นขวาหรือเปล่า
  const mw = 210;
  if (rect.left + mw > window.innerWidth) {
    menu.style.left = 'auto';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
  }

  setTimeout(() => {
    const close = e => {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.remove();
        document.removeEventListener('click', close);
      }
    };
    document.addEventListener('click', close);
  }, 10);
}

// ── Export: รายการเครื่องแอร์ทั้งหมด ──
function exportMachineList() {
  if (typeof XLSX === 'undefined') { waitForXLSX(exportMachineList); return; }

  const list = window._macFilteredList?.length ? window._macFilteredList : (db.machines || []);
  const today = new Date();

  const getMacTickets = id => (db.tickets||[]).filter(t => t.machineId === id);
  const getLastRepair = id => {
    const done = getMacTickets(id).filter(t => ['done','verified','closed'].includes(t.status));
    return done.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''))[0] || null;
  };
  const getTotalCost = id => getMacTickets(id).reduce((s,t) => s+Number(t.cost||0), 0);
  const getActiveJobs = id => getMacTickets(id).filter(t => !['closed','verified','done'].includes(t.status)).length;
  const getPmDue = m => {
    if (!m.interval) return '';
    const lr = getLastRepair(m.id);
    const base = lr ? (lr.updatedAt||'').substring(0,10) : (m.install||'');
    if (!base) return '';
    const d = new Date(base); if(isNaN(d)) return '';
    d.setMonth(d.getMonth() + Number(m.interval));
    return d.toISOString().substring(0,10);
  };

  // Header row
  const headers = [
    'ลำดับ','Air ID (Serial)','ชื่อเครื่อง/ห้อง','แผนก','Func.Loc','Equipment No.',
    'ยี่ห้อ CDU','รุ่น CDU','ยี่ห้อ FCU','รุ่น FCU',
    'BTU','น้ำยา','Vendor','PM ทุก (เดือน)',
    'วันติดตั้ง','วันที่ PM ครั้งถัดไป',
    'งานซ่อมค้าง','งานซ่อมทั้งหมด','ค่าซ่อมสะสม (บาท)',
    'ซ่อมล่าสุด','วันที่เพิ่มในระบบ','สถานะข้อมูล'
  ];

  const rows = list.map((m, i) => {
    const lr = getLastRepair(m.id);
    const eqs = getMachineEqStatus(m);
    const pmDue = getPmDue(m);
    const pmDueDate = pmDue ? new Date(pmDue) : null;
    const daysLeft = pmDueDate ? Math.round((pmDueDate - today) / 86400000) : null;
    const pmStatus = daysLeft === null ? 'ไม่มีข้อมูล' : daysLeft < 0 ? `เกินกำหนด ${Math.abs(daysLeft)} วัน` : daysLeft <= 30 ? `ใกล้ครบ ${daysLeft} วัน` : `อีก ${daysLeft} วัน`;
    return [
      i + 1,
      m.serial || m.id.replace('csv_',''),
      m.name || '',
      m.dept || m.location || '',
      m.funcLoc || '',
      m.equipment || '',
      m.mfrCDU || m.brandCDU || '',
      m.modelCDU || '',
      m.mfrFCU || m.brandFCU || '',
      m.modelFCU || '',
      m.btu ? Number(m.btu) : '',
      m.refrigerant || '',
      m.vendor || '',
      m.interval ? Number(m.interval) : '',
      m.install || '',
      pmDue,
      getActiveJobs(m.id),
      getMacTickets(m.id).length,
      getTotalCost(m.id),
      lr ? (lr.updatedAt||'').substring(0,10) : '',
      (m.addedAt||'').substring(0,10),
      eqs.isComplete ? 'ครบ' : 'ไม่ครบ'
    ];
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Column widths
  ws['!cols'] = [
    {wch:5},{wch:14},{wch:30},{wch:25},{wch:16},{wch:16},
    {wch:16},{wch:16},{wch:16},{wch:16},
    {wch:10},{wch:8},{wch:8},{wch:12},
    {wch:12},{wch:16},
    {wch:10},{wch:10},{wch:14},
    {wch:12},{wch:14},{wch:10}
  ];

  // Freeze top row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, 'เครื่องแอร์ทั้งหมด');

  // Sheet 2: สรุปรายแผนก
  const deptMap = {};
  list.forEach(m => {
    const dept = m.dept || m.location || 'ไม่ระบุ';
    if (!deptMap[dept]) deptMap[dept] = { count:0, cost:0, active:0, vendors:{} };
    deptMap[dept].count++;
    deptMap[dept].cost += getTotalCost(m.id);
    deptMap[dept].active += getActiveJobs(m.id);
    const v = m.vendor || 'ไม่ระบุ';
    deptMap[dept].vendors[v] = (deptMap[dept].vendors[v]||0) + 1;
  });
  const deptRows = Object.entries(deptMap)
    .sort((a,b) => b[1].count - a[1].count)
    .map(([dept, s], i) => [
      i+1, dept, s.count, s.active,
      s.cost, Object.entries(s.vendors).sort((a,b)=>b[1]-a[1]).map(([v,n])=>`${v}:${n}`).join(', ')
    ]);
  const ws2 = XLSX.utils.aoa_to_sheet([
    ['ลำดับ','แผนก','จำนวนเครื่อง','งานค้าง','ค่าซ่อมสะสม (บาท)','Vendor'],
    ...deptRows
  ]);
  ws2['!cols'] = [{wch:5},{wch:30},{wch:12},{wch:10},{wch:16},{wch:30}];
  XLSX.utils.book_append_sheet(wb, ws2, 'สรุปรายแผนก');

  const fname = `machines_${today.toISOString().substring(0,10)}.xlsx`;
  XLSX.writeFile(wb, fname);
  showToast(`📊 Export สำเร็จ: ${list.length} เครื่อง`);
}

// ── Export: เครื่องเพิ่มใหม่ 2 เดือน ──
function exportNewMachines() {
  if (typeof XLSX === 'undefined') { waitForXLSX(exportNewMachines); return; }
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 2);
  const list = (db.machines||[]).filter(m => m.addedAt && new Date(m.addedAt) >= cutoff)
    .sort((a,b) => (b.addedAt||'').localeCompare(a.addedAt||''));
  if (!list.length) { showToast('ไม่มีเครื่องที่เพิ่มใหม่ใน 2 เดือน'); return; }

  const rows = list.map((m, i) => {
    const adder = db.users.find(u => u.id === m.addedBy);
    return [
      i+1,
      (m.addedAt||'').substring(0,16).replace('T',' '),
      m.serial || m.id.replace('csv_',''),
      m.name || '',
      m.dept || m.location || '',
      m.vendor || '',
      m.btu ? Number(m.btu) : '',
      m.refrigerant || '',
      m.interval ? Number(m.interval) : '',
      adder?.name || (m.addedBy || 'Admin'),
    ];
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['ลำดับ','วันที่เพิ่ม','Air ID','ชื่อเครื่อง','แผนก','Vendor','BTU','น้ำยา','PM ทุก (เดือน)','เพิ่มโดย'],
    ...rows
  ]);
  ws['!cols'] = [{wch:5},{wch:18},{wch:14},{wch:30},{wch:25},{wch:8},{wch:10},{wch:8},{wch:12},{wch:16}];
  XLSX.utils.book_append_sheet(wb, ws, 'เครื่องเพิ่มใหม่');

  const today = new Date().toISOString().substring(0,10);
  XLSX.writeFile(wb, `new_machines_${today}.xlsx`);
  showToast(`📊 Export สำเร็จ: ${list.length} เครื่องใหม่`);
}

function exportMachineHistory() {
  if(typeof XLSX === 'undefined') { waitForXLSX(exportMachineHistory); return; }

  const wb = XLSX.utils.book_new();
  const today = new Date().toLocaleDateString('th-TH');

  // ─── Sheet 1: ประวัติการซ่อมทุกเครื่อง ───
  const histHeaders = ['ลำดับ','รหัส Air','ชื่อเครื่อง','ยี่ห้อ/รุ่น','แผนก/พื้นที่','เลขที่ใบงาน',
    'วันที่แจ้ง','ปัญหา','ผู้แจ้ง','ช่าง','สถานะ','ประเภทงาน','สรุปการซ่อม','อะไหล่ที่ใช้',
    'เวลาที่ใช้ (ชม.)','ค่าใช้จ่าย (บาท)','ผลการซ่อม','ต้องติดตาม'];
  const histRows = [histHeaders];
  const stTH = {new:'ใหม่',assigned:'จ่ายงานแล้ว',accepted:'รับงานแล้ว',inprogress:'กำลังซ่อม',
    waiting_part:'รออะไหล่',done:'เสร็จแล้ว',verified:'ตรวจรับแล้ว',closed:'ปิดงานแล้ว'};
  let seq = 1;
  db.machines.forEach(m => {
    const mTickets = (db.tickets||[]).filter(t => t.machineId === m.id)
      .sort((a,b) => (a.createdAt||'').localeCompare(b.createdAt||''));
    mTickets.forEach(t => {
      histRows.push([
        seq++, m.serial||m.id.replace('csv_',''), m.name, m.brand||'—',
        m.dept||m.location||'—', t.id,
        (t.createdAt||'').substring(0,10), t.problem||'', t.reporter||'', t.assignee||'',
        stTH[t.status]||t.status, t.jobTypes||'', t.summary||'', t.parts||'',
        t.repairHours||'', Number(t.cost||0), t.repairResult||'', t.followup||''
      ]);
    });
    // เว้นบรรทัดระหว่างเครื่อง
    if(mTickets.length > 0) histRows.push(['','','','','','','','','','','','','','','','','','']);
  });

  const ws1 = XLSX.utils.aoa_to_sheet(histRows);
  // ปรับความกว้างคอลัมน์
  ws1['!cols'] = [
    {wch:6},{wch:14},{wch:22},{wch:20},{wch:22},{wch:10},
    {wch:12},{wch:28},{wch:14},{wch:14},{wch:14},{wch:16},{wch:32},{wch:20},
    {wch:14},{wch:16},{wch:14},{wch:24}
  ];
  // freeze header row
  ws1['!freeze'] = {xSplit:0, ySplit:1};
  XLSX.utils.book_append_sheet(wb, ws1, 'ประวัติการซ่อม');

  // ─── Sheet 2: สรุปค่าใช้จ่ายสะสมรายเครื่อง ───
  const costHeaders = ['ลำดับ','รหัส Air','ชื่อเครื่อง','ยี่ห้อ/รุ่น','แผนก/พื้นที่',
    'Serial No.','BTU','สารทำความเย็น','จำนวนครั้งซ่อม','ซ่อมล่าสุด',
    'ค่าใช้จ่ายรวม (บาท)','VAT 7% (บาท)','ยอดสุทธิ (บาท)','PM ทุก (เดือน)','หมายเหตุ'];
  const costRows = [costHeaders];
  let seq2 = 1;
  const macSorted = [...db.machines].sort((a,b)=>(a.dept||'').localeCompare(b.dept||''));
  macSorted.forEach(m => {
    const mTickets = (db.tickets||[]).filter(t => t.machineId === m.id);
    const totalCost = mTickets.reduce((s,t) => s + Number(t.cost||0), 0);
    const doneTickets = mTickets.filter(t => ['done','verified','closed'].includes(t.status))
      .sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''));
    const lastRepairDate = doneTickets.length ? (doneTickets[0].updatedAt||'').substring(0,10) : '—';

    let pmNext = '—';
    if(m.interval) {
      const base = lastRepairDate !== '—' ? lastRepairDate : (m.install||'');
      if(base && base !== '—') {
        const d = new Date(base);
        if(!isNaN(d)) {
          d.setMonth(d.getMonth() + Number(m.interval));
          pmNext = d.toLocaleDateString('th-TH');
        }
      }
    }
    costRows.push([
      seq2++, m.serial||m.id.replace('csv_',''), m.name, m.brand||'—',
      m.dept||m.location||'—', m.serial||'—', m.btu||'—', m.refrigerant||'—',
      mTickets.length, lastRepairDate,
      totalCost, totalCost * 0.07, totalCost * 1.07,
      m.interval||'—'
    ]);
  });
  // แถวรวมทั้งหมด
  const totalRow = costRows.length; // row index (1-based)
  costRows.push(['','','','','','','','','รวมทั้งหมด','',
    `=SUM(K2:K${totalRow})`,`=SUM(L2:L${totalRow})`,`=SUM(M2:M${totalRow})`,'','','']);

  const ws2 = XLSX.utils.aoa_to_sheet(costRows);
  ws2['!cols'] = [
    {wch:6},{wch:14},{wch:22},{wch:20},{wch:22},
    {wch:14},{wch:10},{wch:14},{wch:14},{wch:14},
    {wch:18},{wch:16},{wch:18},{wch:14},{wch:14},{wch:20}
  ];
  ws2['!freeze'] = {xSplit:0, ySplit:1};
  XLSX.utils.book_append_sheet(wb, ws2, 'สรุปค่าใช้จ่ายรายเครื่อง');

  // ─── Sheet 3: Timeline รายละเอียด ───
  const tlHeaders = ['เลขที่ใบงาน','เครื่อง','วันที่-เวลา','การดำเนินการ','โดย','รายละเอียด'];
  const tlRows = [tlHeaders];
  db.tickets
    .filter(t => (t.history||[]).length > 0)
    .sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||''))
    .forEach(t => {
      (t.history||[]).forEach(h => {
        tlRows.push([t.id, t.machine||'', h.at||'', h.act||'', h.by||'', h.detail||'']);
      });
    });

  const ws3 = XLSX.utils.aoa_to_sheet(tlRows);
  ws3['!cols'] = [{wch:10},{wch:28},{wch:18},{wch:16},{wch:16},{wch:40}];
  ws3['!freeze'] = {xSplit:0, ySplit:1};
  XLSX.utils.book_append_sheet(wb, ws3, 'Timeline การดำเนินการ');

  // ─── Export ───
  const fname = `SCG-AIRCON-History-${new Date().toISOString().substring(0,10)}.xlsx`;
  XLSX.writeFile(wb, fname);
  showAlert({
    icon: '📊',
    title: 'Export สำเร็จ!',
    msg: `ส่งออกข้อมูลประวัติการซ่อมและค่าใช้จ่าย<br><b>${db.machines.length} เครื่อง</b> · <b>3 Sheets</b><br><span style="font-size:0.78rem;color:#94a3b8;font-family:'JetBrains Mono',monospace">${fname}</span>`,
    color: '#059669',
    btnOk: '✅ ตกลง'
  });
}

// ── Helper: ดึง FL/EQ จาก FUNC_LOC lookup ก่อน ถ้าไม่มีใช้จาก db ──
// ใช้ฟังก์ชันเดียวกันทุกที่เพื่อให้ข้อมูลตรงกัน
function getMachineEqStatus(m) {
  const serial = m.serial || '';
  const lookup = FUNC_LOC[serial] || {};
  // priority: lookup → db field
  const fl  = lookup.fl  || m.funcLoc   || '';
  const eq  = lookup.eq  || m.equipment || '';
  const loc = lookup.loc || m.location  || '';
  return {
    fl,  hasFL: !!fl,
    eq,  hasEQ: !!eq,
    loc,
    missing: (!fl && !eq) ? 'FL+EQ' : !fl ? 'FL' : !eq ? 'EQ' : '',
    isComplete: !!fl && !!eq
  };
}

function renderMachineDashboard() {
  renderMachineDashboardStats();
  setTimeout(() => renderMachineDashboardCards(), 60);
}

function renderMachineDashboardStats() {
  const filtered = window._macFilteredList || db.machines || [];
  const all = db.machines || []; // ใช้ทั้งหมดสำหรับ vendor stats
  const el = document.getElementById('mac-dashboard-view'); if(!el) return;

  const totalMac = filtered.length;
  const totalAll = all.length;
  const isFiltered = filtered.length < all.length;

  const activeTickets = id => (db.tickets||[]).filter(x=>x.machineId===id&&!['closed','verified'].includes(x.status));
  const allCost = m => (db.tickets||[]).filter(x=>x.machineId===m.id&&x.cost).reduce((s,x)=>s+Number(x.cost||0),0);
  const lastRepair = m => {
    const done = (db.tickets||[]).filter(x=>x.machineId===m.id&&['done','verified','closed'].includes(x.status));
    return done.length ? done.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''))[0] : null;
  };
  const pmDue = m => {
    const lr = lastRepair(m);
    if(!m.interval) return null;
    const base = lr ? (lr.updatedAt||'').substring(0,10) : (m.install||'');
    if(!base) return null;
    const d = new Date(base); if(isNaN(d)) return null;
    d.setMonth(d.getMonth() + Number(m.interval));
    return d;
  };
  const today = new Date();

  const withIssue = filtered.filter(m=>activeTickets(m.id).length>0).length;
  const pmOverdue = filtered.filter(m=>{ const d=pmDue(m); return d&&d<today; }).length;
  const pmSoon    = filtered.filter(m=>{ const d=pmDue(m); if(!d||d<today) return false; return (d-today)/(1000*60*60*24)<=30; }).length;

  const noFuncLoc      = filtered.filter(m => !getMachineEqStatus(m).isComplete);
  const noFuncLocCount = noFuncLoc.length;

  const eqMap = {};
  filtered.forEach(m => {
    const eq = (m.equipment||'').trim(); if(!eq) return;
    const key = eq.toLowerCase();
    if(!eqMap[key]) eqMap[key] = []; eqMap[key].push(m);
  });
  const dupEqGroups      = Object.values(eqMap).filter(g => g.length > 1);
  const dupEqMachineCount = dupEqGroups.reduce((s,g) => s+g.length, 0);

  // ── Vendor stats จาก ALL machines (ไม่ filter) ──
  const vendorMap = {};
  all.forEach(m => {
    const v = (m.vendor||'ไม่ระบุ').trim();
    if(!vendorMap[v]) vendorMap[v] = { count:0, machines:[] };
    vendorMap[v].count++;
    vendorMap[v].machines.push(m);
  });
  const vendorStats = Object.entries(vendorMap).sort((a,b)=>b[1].count-a[1].count);
  // [PATCH audit-L3] ใช้ global vendorStyle() จาก app-tickets.js (key: bg, color, border)

  // ── เครื่องแอร์เพิ่มใหม่ใน 2 เดือนล่าสุด ──
  const cutoff2m = new Date(); cutoff2m.setMonth(cutoff2m.getMonth() - 2); cutoff2m.setHours(0,0,0,0);
  const newMachines = all.filter(m => {
    if (!m.addedAt) return false;
    // รองรับทั้ง ISO (T) และ space format
    const dt = new Date(m.addedAt.replace(' ', 'T'));
    return !isNaN(dt) && dt >= cutoff2m;
  }).sort((a,b) => (b.addedAt||'').localeCompare(a.addedAt||''));
  // แยกตามเดือน
  const newByMonth = {};
  newMachines.forEach(m => {
    const mo = (m.addedAt||'').substring(0,7); // YYYY-MM
    if(!newByMonth[mo]) newByMonth[mo] = [];
    newByMonth[mo].push(m);
  });

  const filteredBanner = isFiltered
    ? '<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;margin-bottom:10px;font-size:0.75rem;color:#92400e;display:flex;align-items:center;gap:8px"><span>🔍</span><span>กำลังแสดง <b>' + filtered.length + '</b> จาก <b>' + all.length + '</b> เครื่อง — Vendor stats แสดงจากทั้งหมด</span></div>'
    : '';

  // ── Pending machine requests (Admin only) ──
  const pendingReqs = (db.machineRequests||[]).filter(r => r.status === 'pending');
  const pendingBanner = (CU.role === 'admin' && pendingReqs.length > 0)
    ? `<div onclick="openMachineRequestsPage()" style="background:linear-gradient(135deg,#1d4ed8,#1e40af);border-radius:14px;padding:12px 14px;margin-bottom:10px;cursor:pointer;display:flex;align-items:center;gap:12px;box-shadow:0 4px 14px rgba(29,78,216,0.3);transition:transform 0.15s" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform=''">
        <div style="position:relative;flex-shrink:0">
          <div style="width:38px;height:38px;background:rgba(255,255,255,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.3rem">📋</div>
          <span style="position:absolute;top:-6px;right:-6px;background:#c8102e;color:white;border-radius:99px;min-width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:900;padding:0 5px">${pendingReqs.length}</span>
        </div>
        <div style="flex:1">
          <div style="color:white;font-size:0.9rem;font-weight:800">คำขอเพิ่มเครื่องแอร์ใหม่</div>
          <div style="color:rgba(255,255,255,0.7);font-size:0.68rem;margin-top:2px">รอการอนุมัติ ${pendingReqs.length} รายการ — กดเพื่อดู</div>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>`
    : '';

  let html = `
  ${pendingBanner}
  ${filteredBanner}

  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:10px">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:8px 6px;text-align:center">
      <div style="font-size:1.3rem;font-weight:800;color:var(--text);line-height:1">${totalMac}</div>
      <div style="font-size:0.58rem;color:var(--muted);font-weight:600;margin-top:2px">${isFiltered?'กรอง':'ทั้งหมด'}</div>
    </div>
    <div style="background:#fff0f2;border:1px solid #fecaca;border-radius:10px;padding:8px 6px;text-align:center">
      <div style="font-size:1.3rem;font-weight:800;color:var(--accent);line-height:1">${withIssue}</div>
      <div style="font-size:0.58rem;color:var(--accent);font-weight:600;margin-top:2px">งานค้าง</div>
    </div>
    <div style="background:${newMachines.length>0?'#f0fdf4':'#f8fafc'};border:1px solid ${newMachines.length>0?'#86efac':'#e5e7eb'};border-radius:10px;padding:8px 6px;text-align:center;cursor:${newMachines.length>0?'pointer':'default'}" ${newMachines.length>0?'onclick="openNewMachinesTable()"':''}>
      <div style="font-size:1.3rem;font-weight:800;color:${newMachines.length>0?'#15803d':'var(--muted)'};line-height:1">${newMachines.length}</div>
      <div style="font-size:0.58rem;color:${newMachines.length>0?'#15803d':'var(--muted)'};font-weight:600;margin-top:2px">แอร์ใหม่</div>
    </div>
    <div style="background:${noFuncLocCount>0?'#f0f4ff':'#f8fafc'};border:1px solid ${noFuncLocCount>0?'#a5b4fc':'#e5e7eb'};border-radius:10px;padding:8px 6px;text-align:center;cursor:${noFuncLocCount>0?'pointer':'default'}" ${noFuncLocCount>0?'onclick="showNoEquipPopup()"':''}>
      <div style="font-size:1.3rem;font-weight:800;color:${noFuncLocCount>0?'#3730a3':'var(--muted)'};line-height:1">${noFuncLocCount}</div>
      <div style="font-size:0.58rem;color:${noFuncLocCount>0?'#3730a3':'var(--muted)'};font-weight:600;margin-top:2px">ไม่มี EQ</div>
    </div>
    <div style="background:${dupEqMachineCount>0?'#fff5f6':'#f8fafc'};border:1px solid ${dupEqMachineCount>0?'#fecaca':'#e5e7eb'};border-radius:10px;padding:8px 6px;text-align:center;cursor:${dupEqMachineCount>0?'pointer':'default'}" ${dupEqMachineCount>0?'onclick="showDupEqPopup()"':''}>
      <div style="font-size:1.3rem;font-weight:800;color:${dupEqMachineCount>0?'#c8102e':'var(--muted)'};line-height:1">${dupEqMachineCount}</div>
      <div style="font-size:0.58rem;color:${dupEqMachineCount>0?'#c8102e':'var(--muted)'};font-weight:600;margin-top:2px">EQ ซ้ำ</div>
    </div>
  </div>
  ${(CU.role==='admin' && pendingReqs.length>0) ? `
  <div onclick="openMachineRequestsPage()" style="background:linear-gradient(135deg,#dbeafe,#eff6ff);border:1.5px solid #bfdbfe;border-radius:12px;padding:10px 14px;margin-bottom:10px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:transform 0.15s" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform=''">
    <div style="font-size:1.6rem;font-weight:900;color:#1d4ed8;min-width:32px;text-align:center">${pendingReqs.length}</div>
    <div style="flex:1">
      <div style="font-size:0.82rem;font-weight:800;color:#1d4ed8">คำขอรออนุมัติ</div>
      <div style="font-size:0.65rem;color:#3b82f6">ช่างขอเพิ่มเครื่องใหม่</div>
    </div>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
  </div>` : ''}



  <!-- ── Vendor Dashboard ── -->
  <div style="background:white;border:1px solid #e5e7eb;border-radius:16px;margin-bottom:12px;overflow:hidden">
    <div style="background:#0f172a;padding:10px 14px;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="font-size:0.78rem;font-weight:800;color:white">🏢 บริษัทผู้รับผิดชอบ</div>
        <div style="background:rgba(255,255,255,.15);color:rgba(255,255,255,.8);border-radius:99px;padding:1px 8px;font-size:0.65rem;font-weight:700">${all.length} เครื่อง</div>
      </div>
      <button onclick="showBulkVendorEdit()" style="display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:white;border-radius:8px;padding:6px 11px;font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.15s" onmousedown="this.style.background='rgba(255,255,255,.25)'" onmouseup="this.style.background='rgba(255,255,255,.15)'">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
        แก้ไขตามแผนก
      </button>
    </div>
    <!-- Vendor rows -->
    <div style="padding:8px 0">
      ${vendorStats.map(([v,stat], i) => {
        const {bg, color: cl, border: bd, color: dot} = vendorStyle(v); // [L3] mapped to global keys
        const pct = Math.round(stat.count/all.length*100);
        const bar = Math.round(stat.count/vendorStats[0][1].count*100);
        const depts = [...new Set(stat.machines.map(m=>m.dept||m.location||'').filter(Boolean))];
        const deptCount = depts.length;
        const deptLabel = depts.length <= 2 ? depts.join(', ') : depts.slice(0,2).join(', ')+' +'+(depts.length-2);
        const isLast = i === vendorStats.length - 1;
        const btuGroups = {};
        stat.machines.forEach(m => {
          const b = Number(m.btu||0);
          const key = b>=400000?'400K+':b>=100000?'100K+':b>=36000?'36K+':b>0?'<36K':'\u2014';
          btuGroups[key]=(btuGroups[key]||0)+1;
        });
        const btuChips = Object.entries(btuGroups).sort((a,b)=>b[1]-a[1]).slice(0,3)
          .map(([k,n])=>`<span style="background:${bg};color:${cl};border:1px solid ${bd};border-radius:4px;padding:1px 5px;font-size:0.57rem;font-weight:700">${k}\xd7${n}</span>`).join('');
        const activeTix = (db.tickets||[]).filter(t=>{const m=getMacMap().get(t.machineId);return m&&m.vendor===v&&!['closed','verified'].includes(t.status);}).length;
        return `<div onclick="filterByVendor('${v}')" style="padding:10px 14px;border-bottom:${isLast?'none':'1px solid #f8fafc'};cursor:pointer;transition:background 0.12s" onmousedown="this.style.background='#f8fafc'" onmouseup="this.style.background='white'">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div style="width:8px;height:8px;border-radius:50%;background:${dot};flex-shrink:0"></div>
            <span style="background:${bg};color:${cl};border:1.5px solid ${bd};border-radius:6px;padding:2px 9px;font-size:0.72rem;font-weight:900;flex-shrink:0">${v}</span>
            <div style="flex:1;min-width:0;font-size:0.62rem;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${deptLabel||'\u2014'}</div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;flex-shrink:0">
              <div style="display:flex;align-items:baseline;gap:4px">
                <span style="font-size:0.88rem;font-weight:900;color:${cl}">${stat.count}</span>
                <span style="font-size:0.57rem;color:#94a3b8">เครื่อง</span>
                ${activeTix>0?`<span style="background:#fef2f2;color:#c8102e;border:1px solid #fecaca;border-radius:99px;padding:1px 6px;font-size:0.57rem;font-weight:800">${activeTix} งาน</span>`:''}
              </div>
              <div style="display:flex;gap:3px;align-items:center">
                <span style="font-size:0.57rem;color:#94a3b8">${deptCount} แผนก</span>
                <span style="color:#cbd5e1;font-size:0.5rem">·</span>
                <span style="font-size:0.6rem;font-weight:700;color:${cl}">${pct}%</span>
              </div>
            </div>
          </div>
          ${btuChips?`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:5px">${btuChips}</div>`:''}
          <div style="background:#f1f5f9;border-radius:99px;height:3px;overflow:hidden">
            <div style="height:100%;width:${bar}%;background:${cl};border-radius:99px;transition:width 0.6s ease"></div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>

  <div style="display:flex;flex-direction:column;gap:8px">`;

  // machine cards จะ render ใน renderMachineDashboardCards()
  html += '</div><div class="mac-cards-container" style="display:flex;flex-direction:column;gap:8px">' + skeletonMachines(3) + '</div>';

  el.innerHTML = html;
}

function renderMachineDashboardCards() {
  const el = document.getElementById('mac-dashboard-view'); if(!el) return;
  const cardsEl = el.querySelector('.mac-cards-container'); if(!cardsEl) return;
  const filtered = window._macFilteredList || db.machines || [];
  const today = new Date();
  const activeTickets = id => (db.tickets||[]).filter(x=>x.machineId===id&&!['closed','verified'].includes(x.status));
  const allCost = m => (db.tickets||[]).filter(x=>x.machineId===m.id&&x.cost).reduce((s,x)=>s+Number(x.cost||0),0);
  const lastRepair = m => {
    const done = (db.tickets||[]).filter(x=>x.machineId===m.id&&['done','verified','closed'].includes(x.status));
    return done.length ? done.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''))[0] : null;
  };
  const vcMap = {
    SKIC:{bg:'#eff6ff',color:'#1d4ed8',border:'#bfdbfe',dot:'#3b82f6'},
    TPC: {bg:'#f0fdf4',color:'#166534',border:'#bbf7d0',dot:'#22c55e'},
    SNP: {bg:'#fefce8',color:'#92400e',border:'#fde68a',dot:'#f59e0b'},
    SCG: {bg:'#fff7ed',color:'#c2410c',border:'#fed7aa',dot:'#f97316'},
    SCL: {bg:'#fdf4ff',color:'#7c3aed',border:'#e9d5ff',dot:'#a855f7'},
  };
  const defaultVc = {bg:'#f8fafc',color:'#475569',border:'#e2e8f0',dot:'#94a3b8'};

  let cardsHtml = '';
  filtered.forEach(m => {
    const tickets = activeTickets(m.id);
    const totalC = allCost(m);
    const lr = lastRepair(m);
    const eqs = getMachineEqStatus(m);
    const vc = vcMap[m.vendor] || defaultVc;
    const hasIssue = tickets.length > 0;

    // ── Status pill ──
    const statusPill = hasIssue
      ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#fff0f2;color:#c8102e;border:1px solid #fecaca;border-radius:99px;padding:2px 8px;font-size:0.65rem;font-weight:700">
           <span style="width:5px;height:5px;border-radius:50%;background:#c8102e;animation:pulse 1.5s infinite"></span>${tickets.length} งานค้าง
         </span>`
      : `<span style="display:inline-flex;align-items:center;gap:4px;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:99px;padding:2px 8px;font-size:0.65rem;font-weight:600">
           <span style="width:5px;height:5px;border-radius:50%;background:#22c55e"></span>ปกติ
         </span>`;

    // ── Vendor badge ──
    const vendorBadge = m.vendor
      ? `<span style="background:${vc.bg};color:${vc.color};border:1px solid ${vc.border};border-radius:5px;padding:1px 7px;font-size:0.62rem;font-weight:800">${m.vendor}</span>`
      : '';
    const mZone = m.zone || 'process';
    const zoneBadge = mZone === 'office'
      ? `<span style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:5px;padding:1px 7px;font-size:0.6rem;font-weight:800">🏢 Office</span>`
      : `<span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:5px;padding:1px 7px;font-size:0.6rem;font-weight:800">⚙️ Process</span>`;
    const rangeBadge = getRangeBadgeHtml(getMachineRange(m), 'sm');



    // ── Incomplete warning bar ──
    const warnBar = !eqs.isComplete
      ? `<div style="padding:6px 14px;background:#eef2ff;border-top:1px solid #c7d2fe;display:flex;align-items:center;gap:6px">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3730a3" stroke-width="2.5" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
           <span style="font-size:0.62rem;color:#3730a3;font-weight:700">ข้อมูลไม่ครบ</span>
           ${!eqs.hasFL?'<span style="background:#fee2e2;color:#991b1b;border-radius:4px;padding:1px 6px;font-size:0.6rem;font-weight:700">FL</span>':''}
           ${!eqs.hasEQ?'<span style="background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 6px;font-size:0.6rem;font-weight:700">EQ</span>':''}
           <button onclick="event.stopPropagation();openMachineSheet('${m.id}')" style="margin-left:auto;border:none;background:#3730a3;color:white;border-radius:6px;padding:2px 9px;font-size:0.62rem;font-weight:700;cursor:pointer;font-family:inherit">เติมข้อมูล</button>
         </div>`
      : `<div style="padding:5px 14px;background:#f8fafc;border-top:1px solid #f1f5f9;display:flex;align-items:center;gap:6px">
           <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
           <span style="font-size:0.6rem;color:#64748b;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${eqs.fl||'—'}</span>
           <span style="color:#e2e8f0;flex-shrink:0">·</span>
           <span style="font-size:0.6rem;color:#0369a1;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${eqs.eq||'—'}</span>
         </div>`;

    // ── Active tickets bar ──
    const ticketsBar = hasIssue
      ? `<div style="padding:8px 14px;background:#fff8f8;border-top:1px solid #fee2e2">
           ${tickets.slice(0,2).map(t=>`
             <div onclick="event.stopPropagation();openDetail('${t.id}')" style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;border-bottom:1px dashed #fee2e2;last-child:border-bottom:none">
               <span class="tag ${stc(t.status)}" style="font-size:0.58rem;padding:1px 6px;flex-shrink:0">${sTH(t.status)}</span>
               <span style="font-size:0.72rem;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#374151">${t.problem}</span>
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" style="flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
             </div>`).join('')}
           ${tickets.length>2?`<div style="font-size:0.65rem;color:#c8102e;font-weight:700;padding-top:4px">+${tickets.length-2} งานอื่น...</div>`:''}
         </div>`
      : '';

    cardsHtml += `
    <div style="background:#fff;border:1px solid ${hasIssue?'#fecaca':'#e5e7eb'};border-radius:16px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,0.05);transition:box-shadow 0.15s;margin-bottom:10px"
         onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='0 1px 6px rgba(0,0,0,0.05)'">

      <!-- ── Header ── -->
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer" onclick="openMachineDetail('${m.id}')">
        <!-- Icon -->
        <div style="width:42px;height:42px;background:${hasIssue?'linear-gradient(135deg,#c8102e,#9b0020)':'linear-gradient(135deg,#0f172a,#1e293b)'};border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.15)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="3" width="20" height="8" rx="2"/><line x1="2" y1="7" x2="22" y2="7"/><path d="M7 11v5"/><path d="M12 11v9"/><path d="M17 11v5"/></svg>
        </div>
        <!-- Info -->
        <div style="flex:1;min-width:0">
          <div style="font-size:0.9rem;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px">${m.name}</div>
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;overflow:hidden">
            ${vendorBadge}
            ${zoneBadge}
            ${rangeBadge}
            <span style="font-size:0.68rem;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.serial||m.id}</span>
          </div>
        </div>
        <!-- Status -->
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">
          ${statusPill}
          <button onclick="event.stopPropagation();openMachineSheet('${m.id}')"
            style="display:flex;align-items:center;gap:3px;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;border-radius:7px;padding:3px 8px;font-size:0.62rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.15s"
            onmouseover="this.style.background='#f1f5f9';this.style.color='#0f172a'" onmouseout="this.style.background='#f8fafc';this.style.color='#64748b'">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
            แก้ไข
          </button>
        </div>
      </div>

      <!-- ── Meta row ── -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-top:1px solid #f1f5f9">
        <div style="padding:7px 12px;border-right:1px solid #f1f5f9">
          <div style="font-size:0.55rem;color:#94a3b8;font-weight:600;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.05em">แผนก</div>
          <div style="font-size:0.72rem;font-weight:700;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.dept||m.location||'—'}</div>
        </div>
        <div style="padding:7px 12px;border-right:1px solid #f1f5f9">
          <div style="font-size:0.55rem;color:#94a3b8;font-weight:600;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.05em">BTU</div>
          <div style="font-size:0.72rem;font-weight:700;color:#374151">${m.btu?Number(m.btu).toLocaleString():'—'}</div>
        </div>
        <div style="padding:7px 12px">
          <div style="font-size:0.55rem;color:#94a3b8;font-weight:600;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.05em">ค่าซ่อมสะสม</div>
          <div style="font-size:0.72rem;font-weight:800;color:${totalC>0?'#c8102e':'#94a3b8'}">${totalC>0?'฿'+totalC.toLocaleString():'—'}</div>
        </div>
      </div>

      ${warnBar}
      ${ticketsBar}
    </div>`;
  });
  cardsEl.innerHTML = cardsHtml;
}

// ── Filter machines by vendor ──
// ── QR Code Scanner — ค้นหาเครื่องแอร์ ──
function qrManualSearch(val) {
  const q = (val||'').trim();
  if (!q) return;
  qrFoundMachine(q, window._qrOv, window._qrStream);
}

function qrFoundMachine(raw, ov, stream) {
  // ค้นหาจาก serial / Air ID / QR value
  const q = raw.trim().toUpperCase();
  // QR อาจมี prefix เช่น "AIRCON:Pm1S001" หรือแค่ "Pm1S001"
  const serial = q.includes(':') ? q.split(':').pop() : q;
  const found = db.machines.find(m =>
    (m.serial||'').toUpperCase() === serial ||
    (m.serial||'').toUpperCase().includes(serial) ||
    serial.includes((m.serial||'').toUpperCase())
  );

  if (window._qrClose) window._qrClose();

  if (found) {
    // ไปที่หน้าเครื่องแอร์ + highlight
    goPage('machines');
    setTimeout(() => {
      const search = document.getElementById('mac-search');
      if (search) { search.value = found.serial; applyMachineFilter(); }
      setTimeout(() => {
        const row = document.querySelector(`[data-mid="${found.id}"]`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.style.background = '#fff5f6';
          row.style.outline = '2px solid var(--accent)';
          setTimeout(() => { row.style.background = ''; row.style.outline = ''; }, 2500);
        }
        showToast('✅ พบ: ' + found.name);
        // เปิด detail sheet
        setTimeout(() => openMachineSheet(found.id), 400);
      }, 400);
    }, 200);
  } else {
    // ไม่พบ — เปิดช่องค้นหาพร้อมค่า
    goPage('machines');
    setTimeout(() => {
      const search = document.getElementById('mac-search');
      if (search) { search.value = serial; applyMachineFilter(); }
      showToast('⚠️ ไม่พบเครื่องที่ตรงกับ: ' + serial);
    }, 200);
  }
}

function filterByVendor(vendor) {
  const sel = document.getElementById('mac-search');
  if (sel) {
    sel.value = vendor === 'ไม่ระบุ' ? '' : vendor;
    applyMachineFilter();
  }
}

// ── Bulk Vendor Edit by Dept ──
function showBulkVendorEdit() {
  const list = db.machines || [];
  const depts = [...new Set(list.map(m=>m.dept||m.location||'ไม่ระบุแผนก').filter(Boolean))].sort();
  const vList = [
    {v:'SKIC',bg:'#eff6ff',cl:'#1d4ed8',bd:'#bfdbfe'},
    {v:'TPC', bg:'#f0fdf4',cl:'#166534',bd:'#86efac'},
    {v:'SNP', bg:'#fefce8',cl:'#92400e',bd:'#fde68a'},
    {v:'SCG', bg:'#fff7ed',cl:'#c2410c',bd:'#fed7aa'},
    {v:'SCL', bg:'#fdf4ff',cl:'#7c3aed',bd:'#e9d5ff'},
    {v:'OTHER',bg:'#f8fafc',cl:'#374151',bd:'#e5e7eb'},
  ];
  const selDepts = new Set();
  let selVendor = null;

  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center';

  const card = document.createElement('div');
  card.style.cssText = 'background:#f8fafc;border-radius:22px 22px 0 0;width:100%;max-width:600px;max-height:90vh;display:flex;flex-direction:column;animation:slideUp 0.28s cubic-bezier(0.32,0.72,0,1)';

  // ── Header ──
  const header = document.createElement('div');
  header.style.cssText = 'flex-shrink:0';
  header.innerHTML = `
    <div style="display:flex;justify-content:center;padding:10px 0 0">
      <div style="width:40px;height:4px;background:#d1d5db;border-radius:99px"></div>
    </div>
    <div style="padding:12px 16px 10px;background:#0f172a">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:34px;height:34px;background:rgba(255,255,255,0.1);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1rem">🏢</div>
        <div style="flex:1">
          <div style="font-size:0.92rem;font-weight:800;color:white">แก้ไข Vendor ทั้งแผนก</div>
          <div style="font-size:0.65rem;color:rgba(255,255,255,0.45);margin-top:1px">เลือกแผนก → เลือก Vendor → บันทึก</div>
        </div>
        <button id="bve-close" style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;cursor:pointer;color:rgba(255,255,255,0.7);font-size:1rem;display:flex;align-items:center;justify-content:center">✕</button>
      </div>
    </div>`;
  card.appendChild(header);

  // ── Body ──
  const body = document.createElement('div');
  body.style.cssText = 'overflow-y:auto;flex:1;min-height:0;padding:0';

  // Step 1: แผนก — search + list
  const step1Html = `
    <div style="padding:12px 16px 8px;border-bottom:1px solid #f1f5f9">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:20px;height:20px;background:#0f172a;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:900;flex-shrink:0">1</div>
          <div style="font-size:0.82rem;font-weight:800;color:#0f172a">เลือกแผนก</div>
        </div>
        <button id="bve-selall" style="font-size:0.7rem;font-weight:700;color:#c8102e;background:none;border:none;cursor:pointer;font-family:inherit;padding:4px 8px;border-radius:6px;background:#fff0f2">เลือกทั้งหมด</button>
      </div>
      <input id="bve-search" type="search" placeholder="🔍 ค้นหาแผนก..."
        style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.82rem;font-family:inherit;outline:none;box-sizing:border-box;background:white;color:#374151"/>
    </div>
    <div id="bve-dept-list" style="max-height:240px;overflow-y:auto"></div>
    <div id="bve-summary" style="display:none;padding:8px 16px;background:#f0fdf4;border-top:1px solid #bbf7d0;font-size:0.75rem;color:#166534;font-weight:700"></div>`;

  const step1Div = document.createElement('div');
  step1Div.innerHTML = step1Html;
  body.appendChild(step1Div);

  // Step 2: Vendor
  const step2 = document.createElement('div');
  step2.style.cssText = 'display:none;padding:12px 16px 8px;border-top:2px solid #e5e7eb';
  step2.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
      <div style="width:20px;height:20px;background:#0f172a;color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:900">2</div>
      <div style="font-size:0.82rem;font-weight:800;color:#0f172a">เลือก Vendor ใหม่</div>
    </div>
    <div id="bve-vendor-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px"></div>
    <input id="bve-other-inp" type="text" placeholder="ระบุชื่อบริษัท..."
      style="display:none;width:100%;padding:9px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:0.88rem;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:4px"/>`;
  body.appendChild(step2);

  // Step 3: Preview
  const step3 = document.createElement('div');
  step3.style.cssText = 'display:none;padding:8px 16px 4px';
  step3.innerHTML = `<div id="bve-preview" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 14px;font-size:0.82rem;color:#1e3a5f;font-weight:600"></div>`;
  body.appendChild(step3);

  card.appendChild(body);

  // ── Footer ──
  const footer = document.createElement('div');
  footer.style.cssText = 'padding:10px 16px calc(env(safe-area-inset-bottom,0px)+16px);flex-shrink:0;border-top:1px solid #e5e7eb;background:white;display:flex;gap:8px';
  footer.innerHTML = `
    <button onclick="this.closest('[style*=inset]').remove()" style="flex:1;padding:13px;background:#f1f5f9;color:#64748b;border:none;border-radius:11px;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit">ยกเลิก</button>
    <button id="bve-save" style="flex:2.5;padding:13px;background:#0f172a;color:white;border:none;border-radius:11px;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:7px">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      บันทึก Vendor
    </button>`;
  card.appendChild(footer);
  ov.appendChild(card);
  document.body.appendChild(ov);

  // ── Render dept list ──
  const deptListEl = card.querySelector('#bve-dept-list');
  const summaryEl  = card.querySelector('#bve-summary');
  const previewEl  = card.querySelector('#bve-preview');
  const otherInp   = card.querySelector('#bve-other-inp');
  const vGrid      = card.querySelector('#bve-vendor-grid');

  function renderDeptList(filter='') {
    const kw = filter.toLowerCase().trim();
    const filtered = kw ? depts.filter(d => d.toLowerCase().includes(kw)) : depts;
    deptListEl.innerHTML = filtered.map(dept => {
      const cnt = list.filter(m=>(m.dept||m.location||'ไม่ระบุแผนก')===dept).length;
      const curV = [...new Set(list.filter(m=>(m.dept||m.location||'ไม่ระบุแผนก')===dept).map(m=>m.vendor||'—'))].join(', ');
      const isSel = selDepts.has(dept);
      return `<div data-dept="${dept}" onclick="bveToggleDept(this,'${dept.replace(/'/g,"\\'")}',${cnt})"
        style="display:flex;align-items:center;gap:12px;padding:10px 16px;cursor:pointer;border-bottom:1px solid #f8fafc;background:${isSel?'#fff0f2':'white'};transition:background 0.1s">
        <div style="width:18px;height:18px;border-radius:5px;border:1.5px solid ${isSel?'#c8102e':'#d1d5db'};background:${isSel?'#c8102e':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s">
          ${isSel?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>':''}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.84rem;font-weight:700;color:${isSel?'#c8102e':'#0f172a'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${dept}</div>
          <div style="font-size:0.68rem;color:#94a3b8;margin-top:1px">Vendor: ${curV} · ${cnt} เครื่อง</div>
        </div>
        ${isSel?'<div style="width:8px;height:8px;border-radius:50%;background:#c8102e;flex-shrink:0"></div>':''}
      </div>`;
    }).join('') || '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:0.82rem">ไม่พบแผนก</div>';
  }
  renderDeptList();

  window.bveToggleDept = (el, dept, cnt) => {
    if (selDepts.has(dept)) selDepts.delete(dept);
    else selDepts.add(dept);
    renderDeptList(card.querySelector('#bve-search').value);
    // summary
    if (selDepts.size > 0) {
      const total = list.filter(m=>selDepts.has(m.dept||m.location||'ไม่ระบุแผนก')).length;
      summaryEl.innerHTML = `✓ เลือก ${selDepts.size} แผนก รวม ${total} เครื่อง`;
      summaryEl.style.display = '';
    } else { summaryEl.style.display = 'none'; }
    step2.style.display = selDepts.size > 0 ? '' : 'none';
    updatePreview();
  };

  // Search filter
  card.querySelector('#bve-search').addEventListener('input', e => renderDeptList(e.target.value));

  // Select all
  card.querySelector('#bve-selall').onclick = () => {
    const allSel = selDepts.size === depts.length;
    depts.forEach(d => allSel ? selDepts.delete(d) : selDepts.add(d));
    renderDeptList(card.querySelector('#bve-search').value);
    const total = list.filter(m=>selDepts.has(m.dept||m.location||'ไม่ระบุแผนก')).length;
    summaryEl.innerHTML = selDepts.size > 0 ? `✓ เลือก ${selDepts.size} แผนก รวม ${total} เครื่อง` : '';
    summaryEl.style.display = selDepts.size > 0 ? '' : 'none';
    step2.style.display = selDepts.size > 0 ? '' : 'none';
    updatePreview();
  };

  // Vendor grid
  vList.forEach(({v,bg,cl,bd}) => {
    const btn = document.createElement('button');
    btn.dataset.v = v;
    btn.style.cssText = `padding:10px 6px;background:white;border:1.5px solid #e2e8f0;border-radius:10px;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;color:#374151;transition:all 0.12s`;
    btn.textContent = v==='OTHER' ? 'อื่นๆ...' : v;
    btn.onclick = () => {
      vGrid.querySelectorAll('button').forEach(b => {
        b.style.background='white'; b.style.borderColor='#e2e8f0'; b.style.color='#374151'; b.style.transform='';
      });
      selVendor = v;
      btn.style.background=bg; btn.style.borderColor=cl; btn.style.color=cl; btn.style.transform='scale(1.04)';
      otherInp.style.display = v==='OTHER' ? '' : 'none';
      updatePreview();
    };
    vGrid.appendChild(btn);
  });
  otherInp.oninput = updatePreview;

  function updatePreview() {
    if (!selDepts.size || !selVendor) { step3.style.display='none'; return; }
    const macs = list.filter(m=>selDepts.has(m.dept||m.location||'ไม่ระบุแผนก'));
    const v = selVendor==='OTHER' ? (otherInp.value.trim()||'อื่นๆ') : selVendor;
    previewEl.innerHTML = `🔄 จะเปลี่ยน <b>${macs.length} เครื่อง</b> จาก <b>${selDepts.size} แผนก</b> → Vendor: <b>${v}</b>`;
    step3.style.display = '';
  }

  // Save
  card.querySelector('#bve-save').onclick = () => {
    if (!selDepts.size) { showToast('⚠️ กรุณาเลือกแผนกก่อน'); return; }
    if (!selVendor) { showToast('⚠️ กรุณาเลือก Vendor'); return; }
    const fv = selVendor==='OTHER' ? (otherInp.value.trim()||'อื่นๆ') : selVendor;
    const macs = list.filter(m=>selDepts.has(m.dept||m.location||'ไม่ระบุแผนก'));
    macs.forEach(m => { m.vendor = fv; syncMachine(m); });
    saveDB(); invalidateMacCache(); ov.remove(); renderMachineDashboard();
    showAlert({icon:'✅',color:'#16a34a',title:'บันทึกแล้ว!',
      msg:`อัพเดต <b>${macs.length} เครื่อง</b> จาก <b>${selDepts.size} แผนก</b><br>Vendor: <b>${fv}</b>`,btnOk:'ตกลง'});
  };

  card.querySelector('#bve-close').onclick = () => ov.remove();
  ov.addEventListener('click', e => { if(e.target===ov) ov.remove(); });
}



// ── Popup: ไม่มี Equipment ──
function showNoEquipPopup() {
  const list = window._macFilteredList || db.machines || [];
  const noEq = list.filter(m => !getMachineEqStatus(m).isComplete);
  if (!noEq.length) { showToast('✅ ข้อมูลครบทุกเครื่อง'); return; }

  // Group by dept
  const grouped = {};
  noEq.forEach(m => {
    const d = m.dept || 'ไม่ระบุแผนก';
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(m);
  });

  const rows = Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b,'th')).map(([dept, list]) => `
    <div style="margin-bottom:14px">
      <div style="font-size:0.65rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;display:flex;align-items:center;gap:6px">
        <span>${dept}</span>
        <span style="background:#eef2ff;color:#3730a3;border-radius:99px;padding:1px 7px;font-size:0.6rem;font-weight:800">${list.length} เครื่อง</span>
      </div>
      ${list.map(m => {
        const eqs = getMachineEqStatus(m);
        return `<div onclick="(function(el){const ov=el.closest('[style*=inset]');if(ov)ov.remove();setTimeout(()=>openMachineSheet('${m.id}'),200);})(this)"
          style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:white;border-radius:12px;margin-bottom:6px;cursor:pointer;border:1.5px solid #e0e7ff;transition:all 0.15s;box-shadow:0 1px 4px rgba(55,48,163,0.06)"
          onmousedown="this.style.background='#f5f3ff';this.style.transform='scale(0.98)'" onmouseup="this.style.background='white';this.style.transform=''">
          <div style="flex:1;min-width:0">
            <div style="font-size:0.82rem;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.name}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap">
              <span style="font-family:'JetBrains Mono',monospace;font-size:0.62rem;color:#0369a1;font-weight:700">${m.serial||m.id.replace('csv_','')}</span>
              ${!eqs.hasEQ?'<span style="background:#fee2e2;color:#991b1b;border-radius:5px;padding:1px 6px;font-size:0.6rem;font-weight:700">❌ EQ</span>':''}
              ${!eqs.hasFL?'<span style="background:#fef3c7;color:#92400e;border-radius:5px;padding:1px 6px;font-size:0.6rem;font-weight:700">❌ FL</span>':''}
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3730a3" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
        </div>`;
      }).join('')}
    </div>`).join('');

  _showCardPopup({
    icon: '📋', iconBg: 'linear-gradient(135deg,#3730a3,#1e1b6e)',
    title: 'ไม่มี Equipment No.',
    subtitle: `${noEq.length} เครื่อง จาก ${db.machines.length} — ยังไม่มีข้อมูล EQ หรือ FL`,
    accentColor: '#3730a3',
    extraBtn: { label: '📥 Export', fn: 'exportNoFuncLocExcel()' },
    body: rows
  });
}

// ── Popup: EQ ซ้ำกัน ──
function showDupEqPopup() {
  const list = window._macFilteredList || db.machines || [];
  const eqMap = {};
  list.forEach(m => {
    const eq = (m.equipment||'').trim();
    if (!eq) return;
    const key = eq.toLowerCase();
    if (!eqMap[key]) eqMap[key] = { eq: m.equipment.trim(), machines: [] };
    eqMap[key].machines.push(m);
  });
  const dupGroups = Object.values(eqMap).filter(g => g.machines.length > 1).sort((a,b) => b.machines.length - a.machines.length);
  if (!dupGroups.length) { showToast('✅ ไม่มี Equipment No. ซ้ำกัน'); return; }
  const totalMachines = dupGroups.reduce((s,g) => s + g.machines.length, 0);

  // ── สร้าง Popup ──
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;padding:0;animation:fadeIn 0.2s ease';

  const card = document.createElement('div');
  card.style.cssText = 'background:#f8fafc;border-radius:24px 24px 0 0;width:100%;max-width:600px;max-height:88vh;display:flex;flex-direction:column;animation:slideUp 0.28s cubic-bezier(0.32,0.72,0,1)';

  // Handle
  const handle = document.createElement('div');
  handle.style.cssText = 'display:flex;justify-content:center;padding:10px 0 0;flex-shrink:0';
  handle.innerHTML = '<div style="width:40px;height:4px;background:#d1d5db;border-radius:99px"></div>';
  card.appendChild(handle);

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'padding:12px 18px 12px;flex-shrink:0;border-bottom:1px solid #e5e7eb';
  hdr.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px">
      <div style="width:40px;height:40px;background:#c8102e;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;box-shadow:0 4px 12px rgba(200,16,46,0.3)">⚠️</div>
      <div style="flex:1">
        <div style="font-size:1rem;font-weight:900;color:#0f172a">Equipment No. ซ้ำกัน</div>
        <div style="font-size:0.7rem;color:#64748b;margin-top:2px">${dupGroups.length} กลุ่ม · ${totalMachines} เครื่อง — แตะเพื่อแก้ไข</div>
      </div>
      <button style="width:32px;height:32px;border-radius:50%;background:#f1f5f9;border:none;cursor:pointer;color:#64748b;font-size:1rem;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
    </div>`;
  hdr.querySelector('button').onclick = () => ov.remove();
  card.appendChild(hdr);

  // Body (scrollable)
  const body = document.createElement('div');
  body.style.cssText = 'overflow-y:auto;flex:1;padding:14px 16px 8px';

  const compareFields = [
    { key:'name',     label:'ชื่อเครื่อง', mono:false },
    { key:'dept',     label:'แผนก',       mono:false },
    { key:'serial',   label:'Air ID',     mono:true },
    { key:'funcLoc',  label:'Func. Loc',  mono:true },
    { key:'mfrCDU',   label:'ยี่ห้อ CDU', mono:false },
    { key:'modelCDU', label:'รุ่น CDU',   mono:true },
    { key:'mfrFCU',   label:'ยี่ห้อ FCU', mono:false },
    { key:'modelFCU', label:'รุ่น FCU',   mono:true },
    { key:'btu',      label:'BTU',        mono:false },
    { key:'vendor',   label:'Vendor',     mono:false },
  ];

  dupGroups.forEach((g, gi) => {
    const groupDiv = document.createElement('div');
    groupDiv.style.cssText = 'margin-bottom:14px;border-radius:14px;overflow:hidden;border:1.5px solid #fecaca;box-shadow:0 2px 8px rgba(200,16,46,0.06)';

    // EQ header bar
    const eqHdr = document.createElement('div');
    eqHdr.style.cssText = 'background:#0f172a;padding:9px 14px;display:flex;align-items:center;gap:10px';
    eqHdr.innerHTML = `
      <div style="flex:1;min-width:0;font-family:'JetBrains Mono',monospace;font-size:0.72rem;font-weight:800;color:white;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${g.eq}</div>
      <div style="background:rgba(255,255,255,0.25);color:white;border-radius:99px;padding:2px 10px;font-size:0.65rem;font-weight:800;flex-shrink:0">${g.machines.length} เครื่อง</div>`;
    groupDiv.appendChild(eqHdr);

    // Machine rows
    g.machines.forEach((m, mi) => {
      const row = document.createElement('div');
      row.style.cssText = `display:flex;align-items:center;gap:10px;padding:10px 14px;background:${mi%2===0?'white':'#fffafa'};${mi<g.machines.length-1?'border-bottom:1px solid #fef2f2':''};cursor:pointer;transition:background 0.12s`;
      row.innerHTML = `
        <div style="flex:1;min-width:0">
          <div style="font-size:0.82rem;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.name}</div>
          <div style="font-size:0.65rem;color:#6b7280;margin-top:2px;display:flex;gap:8px;flex-wrap:wrap">
            <span style="font-family:'JetBrains Mono',monospace;color:#c8102e;font-weight:700">${m.serial||m.id.replace('csv_','')}</span>
            <span>${m.dept||'—'}</span>
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#c8102e" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>`;
      row.onmousedown = () => row.style.background = '#fff0f2';
      row.onmouseup   = () => row.style.background = mi%2===0 ? 'white' : '#fffafa';
      row.onclick = () => { ov.remove(); setTimeout(() => openMachineSheet(m.id), 200); };
      groupDiv.appendChild(row);
    });

    // Compare button bar
    const cmpBar = document.createElement('div');
    cmpBar.style.cssText = 'padding:8px 14px;background:#fff5f6;border-top:1px solid #fecaca';
    const cmpBtn = document.createElement('button');
    cmpBtn.style.cssText = 'width:100%;padding:8px;background:white;border:1.5px solid #fecaca;border-radius:9px;font-size:0.75rem;font-weight:700;color:#c8102e;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.15s';
    cmpBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> เปรียบเทียบข้อมูล';
    cmpBar.appendChild(cmpBtn);
    groupDiv.appendChild(cmpBar);

    // Compare table (hidden)
    const cmpTable = document.createElement('div');
    cmpTable.style.cssText = 'display:none;overflow-x:auto;background:white;border-top:1px solid #fecaca';

    // Build table
    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-size:0.72rem';

    // thead
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headRow.style.background = '#fff5f6';
    const thLabel = document.createElement('th');
    thLabel.style.cssText = 'padding:8px;text-align:left;font-size:0.62rem;color:#94a3b8;font-weight:700;border-bottom:2px solid #fecaca;min-width:80px';
    thLabel.textContent = 'ข้อมูล';
    headRow.appendChild(thLabel);
    g.machines.forEach((m, mi) => {
      const th = document.createElement('th');
      th.style.cssText = 'padding:8px;text-align:left;font-size:0.68rem;color:#c8102e;font-weight:800;border-bottom:2px solid #fecaca;min-width:130px';
      th.textContent = m.serial || `#${mi+1}`;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    // tbody
    const tbody = document.createElement('tbody');
    compareFields.forEach(f => {
      const vals = g.machines.map(m => (String(m[f.key]||'—')).trim());
      const allSame = vals.every(v => v === vals[0]);
      if (allSame && vals[0] === '—') return; // skip empty same rows

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #f8fafc';

      const tdLabel = document.createElement('td');
      tdLabel.style.cssText = 'padding:7px 8px;font-size:0.65rem;color:#94a3b8;font-weight:600;white-space:nowrap;vertical-align:top;background:#fafafa';
      tdLabel.textContent = f.label;
      tr.appendChild(tdLabel);

      vals.forEach((v, vi) => {
        const td = document.createElement('td');
        td.style.cssText = `padding:7px 8px;font-size:0.72rem;font-weight:${allSame?'500':'800'};color:${allSame?'#374151':'#c8102e'};font-family:${f.mono?'monospace':'inherit'};vertical-align:top;word-break:break-all;background:${!allSame?'#fff5f6':'white'}`;
        td.textContent = v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    cmpTable.appendChild(table);
    groupDiv.appendChild(cmpTable);

    // Toggle logic
    let cmpOpen = false;
    cmpBtn.onclick = () => {
      cmpOpen = !cmpOpen;
      cmpTable.style.display = cmpOpen ? '' : 'none';
      cmpBtn.style.background = cmpOpen ? '#fff0f2' : 'white';
      cmpBtn.innerHTML = cmpOpen
        ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> ซ่อนการเปรียบเทียบ'
        : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> เปรียบเทียบข้อมูล';
    };

    body.appendChild(groupDiv);
  });

  card.appendChild(body);

  // Footer: Export (sticky)
  const footer = document.createElement('div');
  footer.style.cssText = 'padding:10px 16px 20px;flex-shrink:0;border-top:1px solid #e5e7eb;background:#f8fafc';
  const exportBtn = document.createElement('button');
  exportBtn.style.cssText = 'width:100%;padding:13px;background:#0f172a;color:white;border:none;border-radius:14px;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 16px rgba(200,16,46,0.25);transition:transform 0.15s';
  exportBtn.textContent = '📥 Export Excel รายการซ้ำ';
  exportBtn.onmousedown = () => exportBtn.style.transform = 'scale(0.97)';
  exportBtn.onmouseup   = () => exportBtn.style.transform = '';
  exportBtn.onclick = () => exportDupEqExcel();
  footer.appendChild(exportBtn);
  card.appendChild(footer);

  ov.appendChild(card);
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
}

// ── Export: Equipment ซ้ำ → Excel ──
function exportDupEqExcel() {
  if (typeof XLSX === 'undefined') { waitForXLSX(exportDupEqExcel); return; }
  const list = window._macFilteredList || db.machines || [];
  const eqMap = {};
  list.forEach(m => {
    const eq = (m.equipment||'').trim();
    if (!eq) return;
    const key = eq.toLowerCase();
    if (!eqMap[key]) eqMap[key] = { eq: m.equipment.trim(), machines: [] };
    eqMap[key].machines.push(m);
  });
  const dupGroups = Object.values(eqMap).filter(g => g.machines.length > 1).sort((a,b) => b.machines.length - a.machines.length);

  if (!dupGroups.length) {
    showAlert({ icon:'✅', title:'ไม่มี Equipment ซ้ำ', msg:'ไม่พบ Equipment No. ที่ซ้ำกันในระบบ', color:'#16a34a', btnOk:'เยี่ยมเลย!' });
    return;
  }

  const headers = ['กลุ่มที่','Equipment No.','จำนวนที่ซ้ำ','รหัส Air','ชื่อเครื่อง','แผนก','ผู้ผลิต CDU','รุ่น CDU','ผู้ผลิต FCU','รุ่น FCU','BTU','Vendor','Function Location'];
  const rows = [headers];

  dupGroups.forEach((g, gi) => {
    g.machines.forEach((m, mi) => {
      rows.push([
        gi + 1,
        mi === 0 ? g.eq : '',          // Equipment No. แสดงแค่แถวแรกของกลุ่ม
        mi === 0 ? g.machines.length : '',
        m.serial || m.id.replace('csv_',''),
        m.name,
        m.dept || '—',
        m.mfrCDU || m.brand || '—',
        m.modelCDU || '—',
        m.mfrFCU || '—',
        m.modelFCU || '—',
        m.btu || '—',
        m.vendor || '—',
        m.funcLoc || '—',
      ]);
    });
    // เว้นบรรทัดระหว่างกลุ่ม
    if (gi < dupGroups.length - 1) rows.push(['','','','','','','','','','','','','']);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    {wch:8},{wch:26},{wch:12},{wch:14},{wch:28},{wch:22},
    {wch:14},{wch:18},{wch:14},{wch:18},{wch:8},{wch:8},{wch:26}
  ];
  ws['!freeze'] = { xSplit:0, ySplit:1 };
  XLSX.utils.book_append_sheet(wb, ws, 'Equipment ซ้ำกัน');
  const fname = `SCG-DupEquipment-${new Date().toISOString().substring(0,10)}.xlsx`;
  XLSX.writeFile(wb, fname);
  showAlert({
    icon: '📥', color: '#c8102e',
    title: 'Export สำเร็จ!',
    msg: `ส่งออก <b>${dupGroups.length} กลุ่ม · ${dupGroups.reduce((s,g)=>s+g.machines.length,0)} เครื่อง</b> ที่ Equipment ซ้ำกัน<br>
      <span style="font-size:0.8rem;color:#94a3b8">${fname}</span>`,
    btnOk: '✅ ตกลง'
  });
}

// ── Generic Card Popup ──
function _showCardPopup({ icon, iconBg, title, subtitle, accentColor, body, extraBtn }) {
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,0.5);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;padding:0;animation:fadeIn 0.2s ease';

  const card = document.createElement('div');
  card.style.cssText = 'background:#f8fafc;border-radius:24px 24px 0 0;width:100%;max-width:600px;max-height:88vh;display:flex;flex-direction:column;animation:slideUp 0.28s cubic-bezier(0.32,0.72,0,1)';

  card.innerHTML = `
    <!-- Handle -->
    <div style="display:flex;justify-content:center;padding:10px 0 0;flex-shrink:0">
      <div style="width:40px;height:4px;background:#d1d5db;border-radius:99px"></div>
    </div>
    <!-- Header -->
    <div style="padding:12px 18px 12px;flex-shrink:0;border-bottom:1px solid #e5e7eb">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:40px;height:40px;background:${iconBg};border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;box-shadow:0 4px 12px rgba(0,0,0,0.2)">${icon}</div>
        <div style="flex:1">
          <div style="font-size:1rem;font-weight:900;color:#0f172a">${title}</div>
          <div style="font-size:0.7rem;color:#64748b;margin-top:2px">${subtitle}</div>
        </div>
        <button onclick="this.closest('[style*=inset]').remove()"
          style="width:32px;height:32px;border-radius:50%;background:#f1f5f9;border:none;cursor:pointer;color:#64748b;font-size:1rem;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
      </div>
    </div>
    <!-- Body (scrollable) -->
    <div style="overflow-y:auto;flex:1;padding:14px 16px 8px">${body}</div>
    <!-- Footer: Export button (sticky) -->
    ${extraBtn ? `
    <div style="padding:10px 16px 20px;flex-shrink:0;border-top:1px solid #e5e7eb;background:#f8fafc">
      <button onclick="${extraBtn.fn}"
        style="width:100%;padding:13px;background:${iconBg};color:white;border:none;border-radius:14px;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 16px rgba(0,0,0,0.18);transition:transform 0.15s"
        onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform=''">${extraBtn.label}</button>
    </div>` : `<div style="height:16px;flex-shrink:0"></div>`}`;

  ov.appendChild(card);
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
}

function exportNoFuncLocExcel() {
  if (typeof XLSX === 'undefined') { waitForXLSX(exportNoFuncLocExcel); return; }
  const list = window._macFilteredList || db.machines || [];
  const noFL = list.filter(m => !getMachineEqStatus(m).isComplete);
  if (!noFL.length) {
    showAlert({ icon:'✅', title:'ข้อมูลครบทุกเครื่อง', msg:'ไม่พบเครื่องที่ขาด Function Location<br>หรือ Equipment No. ในรายการนี้', color:'#16a34a', btnOk:'เยี่ยมเลย!' });
    return;
  }

  const headers = ['ลำดับ','รหัส Air','ชื่อเครื่อง','แผนก/พื้นที่',
    'ผู้ผลิต CDU','รุ่น CDU (Model)','ผู้ผลิต FCU','รุ่น FCU (Model)',
    'BTU','สารทำความเย็น','Vendor',
    'Function Location (ปัจจุบัน)','Equipment No. (ปัจจุบัน)',
    'สิ่งที่ขาด'];
  const rows = [headers];
  noFL.forEach((m, i) => {
    const eqs = getMachineEqStatus(m);
    const missing = [!eqs.hasFL?'Function Location':'', !eqs.hasEQ?'Equipment No.':''].filter(Boolean).join(', ');
    rows.push([
      i+1,
      m.serial||m.id.replace('csv_',''),
      m.name,
      m.dept||m.location||'—',
      m.mfrCDU||m.brand||'—',
      m.modelCDU||'—',
      m.mfrFCU||'—',
      m.modelFCU||'—',
      m.btu||'—',
      m.refrigerant||'—',
      m.vendor||'—',
      eqs.fl||'❌ ว่าง',
      eqs.eq||'❌ ว่าง',
      missing
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    {wch:6},{wch:14},{wch:28},{wch:22},
    {wch:16},{wch:20},{wch:16},{wch:20},
    {wch:10},{wch:14},{wch:10},
    {wch:26},{wch:26},{wch:24}
  ];
  ws['!freeze'] = {xSplit:0, ySplit:1};
  XLSX.utils.book_append_sheet(wb, ws, 'ไม่มี Equipment');
  const fname = `SCG-NoEquipment-${new Date().toISOString().substring(0,10)}.xlsx`;
  XLSX.writeFile(wb, fname);
  showAlert({
    icon: '📥',
    title: 'Export สำเร็จ!',
    msg: `ส่งออกข้อมูล <b>${noFL.length} เครื่อง</b> ที่ขาด Equipment No./FUNC_LOC<br><span style="font-size:0.8rem;color:#94a3b8">${fname}</span>`,
    color: '#3730a3',
    btnOk: '✅ ตกลง'
  });
}

function openMacTableSheet() {
  // render table ก่อน open
  window._macView = 'table';
  const list = window._macFilteredList || db.machines || [];
  const rowsHtml = _buildMachineRowsHtml(list);
  requestAnimationFrame(() => {
    const tbody = document.getElementById('mac-tbody');
    if (tbody) tbody.innerHTML = rowsHtml;
    // update dept tabs & count
    const depts = [...new Set(db.machines.map(m=>m.dept||'').filter(Boolean))].sort();
    let tabsHtml = `<button onclick="setMacDept('')" style="white-space:nowrap;border:none;border-radius:99px;padding:5px 12px;font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;background:${!_macDeptFilter?'var(--accent)':'#f3f4f6'};color:${!_macDeptFilter?'white':'var(--muted)'}">ทั้งหมด <span style="opacity:0.8">(${db.machines.length})</span></button>`;
    tabsHtml += depts.map(d=>{const cnt=db.machines.filter(m=>(m.dept||'')===d).length;const active=_macDeptFilter===d;return `<button onclick="setMacDept('${d}')" style="white-space:nowrap;border:none;border-radius:99px;padding:5px 12px;font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;background:${active?'var(--accent)':'#f3f4f6'};color:${active?'white':'var(--muted)'}">${d} <span style="opacity:0.8">(${cnt})</span></button>`;}).join('');
    const tabsEl = document.getElementById('mac-dept-tabs');
    if (tabsEl) tabsEl.innerHTML = tabsHtml;
    const countEl = document.getElementById('mac-count');
    if (countEl) countEl.textContent = list.length < db.machines.length ? `แสดง ${list.length} จาก ${db.machines.length} เครื่อง` : `ทั้งหมด ${db.machines.length} เครื่อง`;
    openSheet('mac-table');
  });
}

function renderMachines() {
  requestAnimationFrame(() => updateNewMacBadge()); applyMachineFilter(); }
// ── Custom Dept Picker ──────────────────────────────────────
let _deptPickerDepts = [];
let _deptPickerOpen = false;

function renderDeptPickerGrid(depts) {
  const grid = document.getElementById('nt-dept-grid');
  if (!grid) return;
  if (!depts.length) {
    grid.innerHTML = `<div style="padding:30px 20px;text-align:center;color:#94a3b8;font-size:0.85rem">ไม่พบแผนก</div>`;
    return;
  }
  const palette = ['#c8102e','#e65100','#0369a1','#059669','#7c3aed','#d97706'];
  grid.innerHTML = depts.map((d, i) => {
    const col = palette[i % palette.length];
    const cnt = (db.machines||[]).filter(m => (m.dept||m.location||'ไม่ระบุแผนก') === d).length;
    const safeD = d.replace(/'/g, "\\'");
    return `<div class="dept-picker-item" data-dept="${d}" title="${d}"
      onclick="selectDeptPickerItem('${safeD}','${col}')"
      style="display:flex;align-items:center;gap:14px;padding:14px 16px;cursor:pointer;border-bottom:1px solid #f1f5f9;transition:background 0.1s;-webkit-tap-highlight-color:transparent;min-height:60px"
      onmousedown="this.style.background='#fef2f4'" onmouseup="this.style.background=''"
      ontouchstart="this.style.background='#fef2f4'" ontouchend="this.style.background=''">
      <div style="width:40px;height:40px;border-radius:12px;background:${col}18;border:1.5px solid ${col}30;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20V9l6-4v4l6-4v4l6-4v15H2z"/><path d="M6 20v-5h3v5"/><path d="M10 20v-5h3v5"/><line x1="2" y1="20" x2="22" y2="20"/><line x1="14" y1="11" x2="16" y2="11"/><line x1="14" y1="14" x2="16" y2="14"/></svg>
      </div>
      <div style="flex:1;min-width:0;overflow:hidden">
        <div style="font-size:0.95rem;font-weight:700;color:#0f172a;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d}</div>
        <div style="font-size:0.72rem;color:#94a3b8;margin-top:3px">${cnt} เครื่องแอร์</div>
      </div>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
  }).join('');
}

function filterDeptPicker(q) {
  const filtered = q ? _deptPickerDepts.filter(d => d.toLowerCase().includes(q.toLowerCase())) : _deptPickerDepts;
  renderDeptPickerGrid(filtered);
}

function _lockBodyScroll() {
  const y = window.scrollY;
  document.body.style.cssText += ';position:fixed;top:-'+y+'px;left:0;right:0;overflow:hidden';
  document.body.dataset.scrollY = y;
}
function _unlockBodyScroll() {
  const y = parseInt(document.body.dataset.scrollY || '0');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.overflow = '';
  window.scrollTo({ top: y, behavior: 'instant' });
}

function toggleDeptPicker() {
  const picker = document.getElementById('nt-dept-picker');
  const overlay = document.getElementById('nt-dept-bs-overlay');
  const chevron = document.getElementById('nt-dept-chevron');
  const display = document.getElementById('nt-dept-display');
  if (!picker) return;
  _deptPickerOpen = !_deptPickerOpen;
  picker.style.display = _deptPickerOpen ? 'flex' : 'none';
  if (overlay) overlay.style.display = _deptPickerOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _deptPickerOpen ? 'rotate(180deg)' : '';
  if (display) display.style.borderColor = _deptPickerOpen ? '#c8102e' : '#e2e8f0';
  // lock/unlock body scroll
  if (_deptPickerOpen) {
    _lockBodyScroll();
    // ถ้า depts ยังว่าง → แสดง skeleton + trigger Firebase reload
    if (!_deptPickerDepts || _deptPickerDepts.length === 0) {
      const grid = document.getElementById('nt-dept-grid');
      if (grid) {
        grid.innerHTML = [1,2,3,4].map(() =>
          `<div style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid #f1f5f9">
            <div style="width:40px;height:40px;border-radius:12px;background:#f1f5f9;flex-shrink:0;animation:pulse 1.4s ease-in-out infinite"></div>
            <div style="flex:1">
              <div style="height:14px;background:#f1f5f9;border-radius:6px;margin-bottom:6px;width:60%;animation:pulse 1.4s ease-in-out infinite"></div>
              <div style="height:10px;background:#f1f5f9;border-radius:4px;width:35%;animation:pulse 1.4s ease-in-out infinite"></div>
            </div>
          </div>`
        ).join('') + '<style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}</style>';
      }
      // BUG FIX (Bug 3): ลอง load จาก Firestore โดยตรงก่อน แล้วค่อย retry populateMachineSelect
      if (typeof _loadMachinesForAnonymous === 'function') {
        _loadMachinesForAnonymous();
      } else if (typeof populateMachineSelect === 'function') {
        populateMachineSelect._retryCount = 0;
        clearTimeout(populateMachineSelect._retryTimer);
        populateMachineSelect();
      }
    }
  } else { _unlockBodyScroll(); }
}
function closeDeptPickerSheet() {
  _deptPickerOpen = false;
  const picker = document.getElementById('nt-dept-picker');
  const overlay = document.getElementById('nt-dept-bs-overlay');
  const chevron = document.getElementById('nt-dept-chevron');
  const display = document.getElementById('nt-dept-display');
  if (picker) picker.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
  if (chevron) chevron.style.transform = '';
  if (display) display.style.borderColor = '#e2e8f0';
  _unlockBodyScroll();
}

function selectDeptPickerItem(dept, col) {
  // ปิด picker
  _deptPickerOpen = false;
  const picker = document.getElementById('nt-dept-picker');
  const overlay = document.getElementById('nt-dept-bs-overlay');
  const chevron = document.getElementById('nt-dept-chevron');
  if (picker) picker.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
  if (chevron) chevron.style.transform = '';
  _unlockBodyScroll();

  // อัปเดต display
  const display = document.getElementById('nt-dept-display');
  const icon    = document.getElementById('nt-dept-icon');
  const label   = document.getElementById('nt-dept-label');
  if (display) display.style.borderColor = '#c8102e';
  if (display) display.style.background = '#c8102e0d';
  if (icon) {
    icon.style.background = '#c8102e1a';
    icon.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c8102e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20V9l6-4v4l6-4v4l6-4v15H2z"/><path d="M6 20v-5h3v5"/><path d="M10 20v-5h3v5"/><line x1="2" y1="20" x2="22" y2="20"/><line x1="14" y1="11" x2="16" y2="11"/><line x1="14" y1="14" x2="16" y2="14"/></svg>`;
  }
  if (display) { display.style.borderColor = '#c8102e'; display.style.background = '#c8102e0d'; }
  if (label) { label.textContent = dept; label.style.color = '#0f172a'; label.style.fontWeight = '700'; }

  // set hidden select + trigger onDeptChange
  const sel = document.getElementById('nt-dept');
  if (sel) { sel.value = dept; }
  onDeptChange(dept);

  // clear search
  const s = document.getElementById('nt-dept-search');
  if (s) s.value = '';
  renderDeptPickerGrid(_deptPickerDepts);
}

function resetDeptPicker() {
  _deptPickerOpen = false;
  const picker  = document.getElementById('nt-dept-picker');
  const chevron = document.getElementById('nt-dept-chevron');
  const display = document.getElementById('nt-dept-display');
  const icon    = document.getElementById('nt-dept-icon');
  const label   = document.getElementById('nt-dept-label');
  if (picker)  picker.style.display = 'none';
  if (chevron) chevron.style.transform = '';
  if (display) { display.style.borderColor = '#e2e8f0'; display.style.background = 'white'; }
  if (icon)    icon.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20V9l6-4v4l6-4v4l6-4v15H2z"/><path d="M6 20v-5h3v5"/><path d="M10 20v-5h3v5"/><line x1="2" y1="20" x2="22" y2="20"/><line x1="14" y1="11" x2="16" y2="11"/><line x1="14" y1="14" x2="16" y2="14"/></svg>`;
  if (icon)    icon.style.background = '#f1f5f9';
  if (label)   { label.textContent = '— เลือกแผนก —'; label.style.color = '#9ca3af'; label.style.fontWeight = '500'; }
}

// ── Machine Picker (เหมือน dept picker) ──────────────────────
let _macPickerOpen = false;
let _macPickerMachines = [];

function renderMacPickerGrid(machines) {
  const grid = document.getElementById('nt-mac-grid');
  if (!grid) return;
  if (!machines.length) {
    grid.innerHTML = `<div style="padding:30px 20px;text-align:center;color:#94a3b8;font-size:0.85rem">ไม่พบเครื่องแอร์</div>`;
    return;
  }
  grid.innerHTML = machines.map(m => {
    const lbl = `[${m.serial||m.id}] ${m.name}`;
    const sub = [m.btu ? Number(m.btu).toLocaleString()+' BTU' : '', m.refrigerant || ''].filter(Boolean).join(' · ');
    const safeId = m.id.replace(/'/g, "\'");
    const safeLbl = lbl.replace(/'/g, "\'").replace(/`/g, '\`');
    return `<div class="mac-picker-item" data-mid="${m.id}"
      onclick="selectMacPickerItem('${safeId}','${safeLbl}')"
      style="display:flex;align-items:center;gap:14px;padding:14px 16px;cursor:pointer;border-bottom:1px solid #f1f5f9;transition:background 0.1s;-webkit-tap-highlight-color:transparent;min-height:60px"
      onmousedown="this.style.background='#f0f9ff'" onmouseup="this.style.background=''"
      ontouchstart="this.style.background='#f0f9ff'" ontouchend="this.style.background=''">
      <div style="width:40px;height:40px;border-radius:12px;background:#c8102e18;border:1.5px solid #c8102e30;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8102e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="8" rx="2"/><line x1="2" y1="7" x2="22" y2="7"/><path d="M7 11v5"/><path d="M12 11v9"/><path d="M17 11v5"/></svg>
      </div>
      <div style="flex:1;min-width:0;overflow:hidden">
        <div style="font-size:0.92rem;font-weight:700;color:#0f172a;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(lbl)}</div>
        ${sub ? `<div style="font-size:0.72rem;color:#94a3b8;margin-top:3px">${escapeHtml(sub)}</div>` : ''}
      </div>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
  }).join('');
}


function filterMacPicker(q) {
  const filtered = q
    ? _macPickerMachines.filter(m =>
        (m.name||'').toLowerCase().includes(q.toLowerCase()) ||
        (m.serial||'').toLowerCase().includes(q.toLowerCase()) ||
        (m.id||'').toLowerCase().includes(q.toLowerCase()))
    : _macPickerMachines;
  renderMacPickerGrid(filtered);
}

function toggleMacPicker() {
  const picker  = document.getElementById('nt-mac-picker');
  const overlay = document.getElementById('nt-mac-bs-overlay');
  const chevron = document.getElementById('nt-mac-chevron');
  const display = document.getElementById('nt-mac-display');
  if (!picker) return;
  _macPickerOpen = !_macPickerOpen;
  picker.style.display = _macPickerOpen ? 'flex' : 'none';
  if (overlay) overlay.style.display = _macPickerOpen ? 'block' : 'none';
  if (chevron) chevron.style.transform = _macPickerOpen ? 'rotate(180deg)' : '';
  if (display) display.style.borderColor = _macPickerOpen ? '#0369a1' : '#e2e8f0';
  document.body.style.overflow = _macPickerOpen ? 'hidden' : '';
  if (_macPickerOpen) { _lockBodyScroll(); } else { _unlockBodyScroll(); }
  }
function closeMacPickerSheet() {
  _macPickerOpen = false;
  const picker  = document.getElementById('nt-mac-picker');
  const overlay = document.getElementById('nt-mac-bs-overlay');
  const chevron = document.getElementById('nt-mac-chevron');
  const display = document.getElementById('nt-mac-display');
  if (picker)  picker.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
  if (chevron) chevron.style.transform = '';
  if (display) display.style.borderColor = '#e2e8f0';
  _unlockBodyScroll();
}

function selectMacPickerItem(mid, label) {
  _macPickerOpen = false;
  const picker  = document.getElementById('nt-mac-picker');
  const overlay = document.getElementById('nt-mac-bs-overlay');
  const chevron = document.getElementById('nt-mac-chevron');
  const display = document.getElementById('nt-mac-display');
  const icon    = document.getElementById('nt-mac-icon');
  const lbl     = document.getElementById('nt-mac-label');
  if (picker)  picker.style.display = 'none';
  if (overlay) overlay.style.display = 'none';
  if (chevron) chevron.style.transform = '';
  _unlockBodyScroll();
  if (display) { display.style.borderColor = '#c8102e'; display.style.background = '#c8102e0d'; }
  if (icon) {
    icon.style.background = '#c8102e1a';
    icon.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c8102e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5v1M12 14.5v1M8.5 12h1M14.5 12h1"/><line x1="2" y1="7" x2="22" y2="7"/><line x1="5" y1="5" x2="5" y2="5.01"/><line x1="8" y1="5" x2="8" y2="5.01"/></svg>`;
  }
  if (lbl) { lbl.textContent = label; lbl.style.color = '#0f172a'; lbl.style.fontWeight = '700'; }
  const sel = document.getElementById('nt-mac');
  if (sel) sel.value = mid;
  onMachineChange(mid);
  const s = document.getElementById('nt-mac-search');
  if (s) s.value = '';
  renderMacPickerGrid(_macPickerMachines);
}

function resetMacPicker() {
  _macPickerOpen = false;
  _macPickerMachines = [];
  const picker  = document.getElementById('nt-mac-picker');
  const chevron = document.getElementById('nt-mac-chevron');
  const display = document.getElementById('nt-mac-display');
  const icon    = document.getElementById('nt-mac-icon');
  const label   = document.getElementById('nt-mac-label');
  if (picker)  picker.style.display = 'none';
  if (chevron) chevron.style.transform = '';
  if (display) { display.style.borderColor = '#e2e8f0'; display.style.background = 'white'; }
  if (icon) {
    icon.style.background = '#f1f5f9';
    icon.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="2"/><circle cx="12" cy="12" r="3.5"/><path d="M12 8.5v1M12 14.5v1M8.5 12h1M14.5 12h1"/><line x1="2" y1="7" x2="22" y2="7"/><line x1="5" y1="5" x2="5" y2="5.01"/><line x1="8" y1="5" x2="8" y2="5.01"/></svg>`;
  }
  if (label) { label.textContent = '— เลือกห้อง / เครื่องแอร์ —'; label.style.color = '#9ca3af'; label.style.fontWeight = '500'; }
  const s = document.getElementById('nt-mac-search');
  if (s) s.value = '';
}
// ───────────────────────────────────────────────────────────

function populateMachineSelect() {
  // Populate dept dropdown
  const deptSel = document.getElementById('nt-dept'); if(!deptSel) return;
  const depts = [...new Set(db.machines.map(m => m.dept||m.location||'ไม่ระบุแผนก').filter(Boolean))].sort();

  if (depts.length === 0) {
    deptSel.innerHTML = '<option value="">⏳ กำลังโหลดข้อมูลแผนก...</option>';
    // แสดง loading state ใน custom picker grid ด้วย
    const grid = document.getElementById('nt-dept-grid');
    if (grid && !grid.querySelector('.dept-loading-msg')) {
      grid.innerHTML = '<div class="dept-loading-msg" style="padding:24px 16px;text-align:center;color:#64748b;font-size:0.82rem"><div style="font-size:1.6rem;margin-bottom:8px">⏳</div><div style="font-weight:700;margin-bottom:4px">กำลังโหลดข้อมูล...</div><div style="font-size:0.72rem;color:#94a3b8">กรุณารอสักครู่ ระบบกำลังเชื่อมต่อ Firebase</div></div>';
    }
    if (!populateMachineSelect._retryCount) populateMachineSelect._retryCount = 0;
    // BUG FIX (Bug 3): ครั้งแรกที่ machines ว่าง → trigger load จาก Firestore โดยตรง
    // แทนที่จะรอ retry เฉยๆ (สำหรับ user ใหม่ที่ไม่มี localStorage cache)
    if (populateMachineSelect._retryCount === 0) {
      if (typeof _loadMachinesForAnonymous === 'function') {
        console.info('[populateMachineSelect] machines empty — trigger Firestore load');
        _loadMachinesForAnonymous();
      }
    }
    // เพิ่ม retry สูงสุด 20 ครั้ง ครอบคลุม Firebase ช้า > 30 วินาที
    if (populateMachineSelect._retryCount < 20) {
      populateMachineSelect._retryCount++;
      const delay = populateMachineSelect._retryCount <= 3 ? 600
                  : populateMachineSelect._retryCount <= 8 ? 2000 : 4000;
      clearTimeout(populateMachineSelect._retryTimer);
      populateMachineSelect._retryTimer = setTimeout(() => populateMachineSelect(), delay);
    } else {
      deptSel.innerHTML = '<option value="">— เลือกแผนก — (ไม่พบข้อมูล)</option>';
      if (grid) grid.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444;font-size:0.8rem"><div style="font-size:1.4rem;margin-bottom:6px">❌</div><div style="font-weight:700">ไม่พบข้อมูลแผนก</div><div style="font-size:0.72rem;margin-top:4px;color:#94a3b8">ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต<br>แล้วรีเฟรชหน้า</div></div>';
      populateMachineSelect._retryCount = 0;
    }
    return;
  }
  populateMachineSelect._retryCount = 0;

  deptSel.innerHTML = '<option value="">— เลือกแผนก —</option>' +
    depts.map(d => `<option value="${d}">${d}</option>`).join('');
  document.getElementById('nt-mac').innerHTML = '<option value="">— เลือกห้อง —</option>';
  document.getElementById('nt-room-wrap').style.display = 'none';

  // ── Populate custom dept picker grid ──
  _deptPickerDepts = depts;
  renderDeptPickerGrid(depts);

  // ── pre-fill ข้อมูลผู้แจ้ง ──
  const nameEl   = document.getElementById('nt-reporter-name');
  const avatarEl = document.getElementById('nt-reporter-avatar');
  const telEl    = document.getElementById('nt-tel');
  if (nameEl)   nameEl.textContent = CU.name || '';
  if (telEl) telEl.value = CU.tel || CU.phone || CU.contact || '';
  if (avatarEl) {
    if (CU.photo || CU.avatar) {
      avatarEl.innerHTML = `<img src="${CU.photo||CU.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover"/>`;
    } else {
      avatarEl.textContent = getAvatarInitials(CU.name||'?');
      avatarEl.style.background = getAvatarColor(CU.id||'');
    }
  }
}

// ── Repair History Popup ──────────────────────────────
function openRepairHistory() {
  const mid = document.getElementById('nt-mac')?.value;
  const dept = document.getElementById('nt-dept')?.value;
  if (!mid && !dept) { showToast('⚠️ กรุณาเลือกแผนกและห้องก่อน'); return; }

  const mac = db.machines?.find(m => m.id === mid);
  const subtitle = mac
    ? (mac.serial ? mac.serial + ' · ' : '') + mac.name
    : (dept || '');
  document.getElementById('rh-subtitle').textContent = subtitle;

  // กรองประวัติ: เครื่องตรงกัน หรือถ้าไม่มี machineId → ใช้แผนก
  let history = (db.tickets||[]).filter(t =>
    ['done','verified','closed'].includes(t.status) &&
    (mid ? t.machineId === mid : t.machine?.includes(dept||''))
  );

  // เรียงตาม updatedAt ล่าสุด
  history = history
    .sort((a,b) => (b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''))
    .slice(0, 5);

  const listEl = document.getElementById('rh-list');
  if (!history.length) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:32px 20px;color:#94a3b8">
        <div style="font-size:2rem;margin-bottom:8px">🔧</div>
        <div style="font-size:0.8rem;font-weight:600">ยังไม่มีประวัติการซ่อม</div>
        <div style="font-size:0.7rem;margin-top:4px">${mac ? 'สำหรับ '+mac.name : 'ในแผนกนี้'}</div>
      </div>`;
  } else {
    listEl.innerHTML = history.map((t, idx) => {
      const statusColor = {done:'#166534',verified:'#0369a1',closed:'#64748b'}[t.status] || '#64748b';
      const statusBg    = {done:'#f0fdf4',verified:'#eff6ff',closed:'#f8fafc'}[t.status] || '#f8fafc';
      const date = (t.updatedAt||t.createdAt||'').substring(0,10);
      const techName = t.assignee ? t.assignee.split(' ')[0] : '—';
      return `
      <div style="padding:11px 16px;border-bottom:1px solid #f8fafc;cursor:pointer;transition:background 0.12s"
           onmouseenter="this.style.background='#fafafa'" onmouseleave="this.style.background=''"
           onclick="pickHistory('${t.id}')">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
          <span style="width:20px;height:20px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:0.62rem;font-weight:800;color:#64748b;flex-shrink:0">${idx+1}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.8rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.problem}</div>
          </div>
          <span style="background:${statusBg};color:${statusColor};font-size:0.58rem;font-weight:700;padding:2px 7px;border-radius:4px;flex-shrink:0">${sTH(t.status)}</span>
        </div>
        ${t.summary ? `<div style="font-size:0.68rem;color:#475569;margin-left:27px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml((t.summary||"").split("\n")[0].replace(/^[-–]\s*/,""))}</div>` : ''}
        <div style="display:flex;align-items:center;gap:8px;margin-left:27px;margin-top:4px">
          <span style="font-size:0.6rem;color:#94a3b8">${date}</span>
          ${t.assignee ? `<span style="font-size:0.6rem;color:#94a3b8">· 👷 ${techName}</span>` : ''}
          <span style="font-size:0.6rem;color:#c8102e;font-weight:600;margin-left:auto">แตะเพื่อแจ้งอาการเดิม →</span>
        </div>
      </div>`;
    }).join('');
  }

  // แสดง popup
  const overlay = document.getElementById('rh-overlay');
  const popup   = document.getElementById('rh-popup');
  overlay.style.display = 'block';
  popup.style.display   = 'flex';
}

function closeRepairHistory() {
  document.getElementById('rh-overlay').style.display = 'none';
  document.getElementById('rh-popup').style.display   = 'none';
}

function pickHistory(tid) {
  const t = db.tickets.find(x => x.id === tid);
  if (!t) return;
  // ใส่อาการเดิมใน input
  const probEl = document.getElementById('nt-prob');
  if (probEl) probEl.value = t.problem;
  const detailEl = document.getElementById('nt-detail');
  if (detailEl && t.summary) detailEl.value = '(อ้างอิง '+tid+') '+t.summary;
  closeRepairHistory();
  showToast('✅ นำอาการจาก '+tid+' มาใส่แล้ว');
  probEl?.focus();
}
// ─────────────────────────────────────────────────────────────
// ── ค้นหาเครื่องแอร์ตรงจากหน้าแจ้งซ่อม ──
function onNtSearch(q) {
  const resBox = document.getElementById('nt-search-results');
  if (!resBox) return;
  const kw = q.trim().toLowerCase();
  if (!kw) { resBox.style.display = 'none'; return; }

  // ── BUG FIX #3: Firebase อาจยังโหลดไม่เสร็จ — แจ้งผู้ใช้แทนการแสดง "ไม่พบ" ──
  if (!db.machines || db.machines.length === 0) {
    resBox.style.display = '';
    resBox.innerHTML = '<div style="padding:14px 16px;font-size:0.82rem;color:#f97316;text-align:center">⏳ กำลังโหลดข้อมูลเครื่อง กรุณารอสักครู่...</div>';
    return;
  }

  const matches = db.machines.filter(m =>
    (m.name||'').toLowerCase().includes(kw) ||
    (m.serial||'').toLowerCase().includes(kw) ||
    (m.dept||'').toLowerCase().includes(kw) ||
    (m.location||'').toLowerCase().includes(kw)
  ).slice(0, 10);

  if (!matches.length) {
    resBox.style.display = '';
    resBox.innerHTML = '<div style="padding:14px 16px;font-size:0.82rem;color:#9ca3af;text-align:center">ไม่พบเครื่องที่ค้นหา</div>';
    return;
  }

  resBox.style.display = '';
  resBox.innerHTML = matches.map((m, i) => {
    const name = (m.name||'').replace(new RegExp(kw,'gi'), s => `<mark style="background:#fff0f2;color:#c8102e;font-weight:800;border-radius:3px">${s}</mark>`);
    const serial = m.serial || m.id.replace('csv_','');
    return `<div onclick="onNtSearchSelect('${m.id}')"
      style="display:flex;align-items:center;gap:10px;padding:10px 14px;${i>0?'border-top:1px solid #f1f5f9':''};cursor:pointer;transition:background 0.1s"
      onmousedown="this.style.background='#fff0f2'" onmouseup="this.style.background='white'" onmouseleave="this.style.background='white'">
      <div style="width:32px;height:32px;background:#c8102e;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.9rem">❄️</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.82rem;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
        <div style="font-size:0.65rem;color:#6b7280;margin-top:1px;display:flex;gap:6px">
          <span style="font-family:monospace;color:#c8102e;font-weight:700">${serial}</span>
          <span>·</span>
          <span>${m.dept||'—'}</span>
        </div>
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c8102e" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
  }).join('');

  // ปิด dropdown เมื่อคลิกนอก
  setTimeout(() => {
    const close = (e) => {
      if (!resBox.contains(e.target) && e.target.id !== 'nt-search') {
        resBox.style.display = 'none';
        document.removeEventListener('click', close);
      }
    };
    document.addEventListener('click', close);
  }, 100);
}

function onNtSearchSelect(mid) {
  const m = db.machines.find(x => x.id === mid);
  if (!m) return;
  // ปิด dropdown
  const resBox = document.getElementById('nt-search-results');
  if (resBox) resBox.style.display = 'none';
  // ใส่ชื่อใน search box
  const searchEl = document.getElementById('nt-search');
  if (searchEl) searchEl.value = m.name;

  const deptVal = m.dept || m.location || '';
  if (deptVal) {
    // หา palette index เพื่อให้สีตรงกับ dept list
    const palette = ['#c8102e','#e65100','#0369a1','#059669','#7c3aed','#d97706'];
    if (!_deptPickerDepts || !_deptPickerDepts.length) {
      // ถ้า dept list ยังไม่โหลด ให้ init ก่อน
      const allDepts = [...new Set((db.machines||[]).map(x => x.dept||x.location||'ไม่ระบุแผนก'))].sort();
      _deptPickerDepts = allDepts;
    }
    const idx = (_deptPickerDepts||[]).indexOf(deptVal);
    const col = palette[idx >= 0 ? idx % palette.length : 0];
    // อัปเดต hidden select
    const deptEl = document.getElementById('nt-dept');
    if (deptEl) {
      if (![...deptEl.options].find(o => o.value === deptVal)) {
        const opt = document.createElement('option');
        opt.value = deptVal; opt.textContent = deptVal;
        deptEl.appendChild(opt);
      }
      deptEl.value = deptVal;
    }
    // อัปเดต custom dept picker display (icon + label + border)
    if (typeof selectDeptPickerItem === 'function') {
      selectDeptPickerItem(deptVal, col);
      // selectDeptPickerItem เรียก onDeptChange แล้ว แต่ต้อง pass mid ด้วย
      setTimeout(() => { if (typeof onDeptChange === 'function') onDeptChange(deptVal, mid); }, 50);
    } else {
      onDeptChange(deptVal, mid);
    }
    return;
  }
  onMachineChange(mid);
}

function onDeptChange(dept, autoSelectMid) {
  const roomWrap = document.getElementById('nt-room-wrap');
  if (!dept) {
    roomWrap.style.display='none';
    document.getElementById('nt-equip-card').style.display='none';
    resetMacPicker();
    return;
  }
  const rooms = db.machines.filter(m => (m.dept||m.location||'ไม่ระบุแผนก') === dept);
  // อัปเดต hidden select (backward compat)
  const roomSel = document.getElementById('nt-mac');
  if (roomSel) {
    roomSel.innerHTML = '<option value="">— เลือกห้อง —</option>' +
      rooms.map(m => `<option value="${m.id}">[${m.serial||m.id}] ${m.name}</option>`).join('');
  }
  // อัปเดต custom picker
  resetMacPicker();
  _macPickerMachines = rooms;
  renderMacPickerGrid(rooms);
  roomWrap.style.display = 'block';
  // auto-select machine if specified (จากการค้นหา)
  if (autoSelectMid) {
    const m = rooms.find(x => x.id === autoSelectMid);
    if (m) {
      const lbl = `[${m.serial||m.id}] ${m.name}`;
      selectMacPickerItem(autoSelectMid, lbl);
    }
  } else {
    document.getElementById('nt-equip-card').style.display='none';
  }
}
function onMachineChange(mid) {
  const card = document.getElementById('nt-equip-card');
  if (!mid) {
    card.style.display='none';
    const hbw=document.getElementById('nt-history-btn-wrap'); if(hbw) hbw.style.display='none';
    return;
  }
  const m = db.machines.find(x => x.id === mid);
  if (!m) { card.style.display='none'; return; }
  // ดึง Equipment + FuncLoc จาก FUNC_LOC lookup
  const flData = FUNC_LOC[m.serial||''] || {};
  const eq  = flData.eq  || m.equipment || '—';
  const fl  = flData.fl  || m.funcLoc   || '—';
  document.getElementById('ei-serial').textContent = m.serial || '—';
  document.getElementById('ei-brand').textContent  = m.dept || m.location || '—';
  // CDU / FCU model
  const cduEl = document.getElementById('ei-cdu');
  const fcuEl = document.getElementById('ei-fcu');
  if (cduEl) cduEl.textContent = [m.mfrCDU, m.modelCDU].filter(Boolean).join(' ') || m.brandCDU || '—';
  if (fcuEl) fcuEl.textContent = [m.mfrFCU, m.modelFCU].filter(Boolean).join(' ') || m.brandFCU || '—';
  document.getElementById('ei-btu').textContent    = m.btu ? Number(m.btu).toLocaleString() + ' BTU' : '—';
  document.getElementById('ei-ref').textContent    = m.refrigerant || '—';
  document.getElementById('ei-eq').textContent     = eq;
  document.getElementById('ei-loc').textContent    = fl !== '—' ? fl : ([m.location, m.dept].filter(Boolean).join(' › ') || '—');
  const ns=document.getElementById('ei-name-sub'); if(ns) ns.textContent=[m.name,m.dept].filter(Boolean).join(' · ');
  // Install / PM / Location
  const instEl = document.getElementById('ei-install');
  const pmEl   = document.getElementById('ei-pm');
  const deptEl = document.getElementById('ei-dept');
  if (instEl) instEl.textContent = m.install || '—';
  if (pmEl)   pmEl.textContent   = m.interval ? m.interval + ' เดือน' : '—';
  // Zone + Range + Vendor badges — ทั้งหมดอยู่แถวเดียวกัน
  const zoneRangeEl = document.getElementById('ei-zone-range');
  if (zoneRangeEl) {
    const mZone = m.zone || 'process';
    const zoneBadge = mZone === 'office'
      ? `<span style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:6px;padding:2px 8px;font-size:0.65rem;font-weight:800">🏢 Office</span>`
      : `<span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;padding:2px 8px;font-size:0.65rem;font-weight:800">⚙️ Process</span>`;
    const range = getMachineRange(m);
    const rangeBadge = getRangeBadgeHtml(range, 'md');
    const vs = m.vendor ? vendorStyle(m.vendor) : null;
    const vendorBadge = vs
      ? `<span style="background:${vs.bg};color:${vs.color};border:1px solid ${vs.border};border-radius:6px;padding:2px 8px;font-size:0.65rem;font-weight:800">🏭 ${m.vendor}</span>`
      : '';
    zoneRangeEl.innerHTML = zoneBadge + ' ' + rangeBadge + (vendorBadge ? ' ' + vendorBadge : '');
  }
  // ei-dept removed
  card.style.display = 'block';
  // แสดงปุ่มประวัติ
  const hbw = document.getElementById('nt-history-btn-wrap');
  if (hbw) hbw.style.display = 'block';
}
function openMachineDetail(id) {
  openMachineHistory(id);
}

// BUG FIX (Bug 4): async + รอ Firebase auth ก่อนเปิด sheet
// เดิม: เปิดทันที → db.machines อาจยังว่าง (anonymous auth ยังไม่ ready)
async function openMachineSheet(id) {
  // รอ auth max 5 วินาที — ถ้าไม่ ready ก็เปิดต่อด้วย local data
  if (typeof _waitForAuth === 'function') await _waitForAuth(5000).catch(() => {});
  const m = id ? (db.machines||[]).find(x=>x.id===id) : null;
  // ── อัพเดท header อย่างถูกต้อง — ไม่ override innerHTML ทั้งหมด ──
  const titleText = document.getElementById('ms-title-text');
  const titleSub  = document.getElementById('ms-title-sub');
  if (titleText) titleText.textContent = m ? 'แก้ไขเครื่องแอร์' : 'เพิ่มเครื่องแอร์ใหม่';
  if (titleSub)  titleSub.textContent  = m ? ((m.serial||'') + (m.name ? ' · '+m.name : '')) : 'กรอกข้อมูลเครื่องแอร์ให้ครบถ้วน';
  document.getElementById('m-id').value       = m?.id||'';
  // Auto-generate serial for new machine — รันต่อจาก serial ที่มีอยู่
  if (!m) {
    // ดึง serials ทั้งหมด หา pattern ที่ใช้บ่อยที่สุด
    const allSerials = db.machines.map(x=>x.serial||'').filter(Boolean);
    // หา numeric suffix ล่าสุดจาก serial ทั้งหมด
    const nums = allSerials.map(s => {
      const match = s.match(/(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    }).filter(n => n > 0);
    const maxNum = nums.length ? Math.max(...nums) : 0;
    const nextNum = maxNum + 1;
    // หา prefix ที่ใช้บ่อยที่สุด (เช่น csv_, Pm1S, WH, etc.)
    // ใช้รูปแบบ NEW-XXXX โดยนับต่อจากเลขสูงสุดที่มี
    document.getElementById('m-serial').value = 'NEW-' + String(nextNum).padStart(4,'0');
  } else {
    document.getElementById('m-serial').value = m?.serial||'';
  }
  document.getElementById('m-dept').value     = m?.dept||'';
  document.getElementById('m-funcloc').value  = m?.funcLoc||'';
  document.getElementById('m-equipment').value= m?.equipment||'';
  document.getElementById('m-name').value     = m?.name||'';
  document.getElementById('m-loc').value      = m?.location||'';
  document.getElementById('m-mfrcdu').value   = m?.mfrCDU||(m?.brandCDU||m?.brand||'').split(' ')[0]||'';
  document.getElementById('m-modelcdu').value = m?.modelCDU||(m?.brandCDU||m?.brand||'').split(' ').slice(1).join(' ')||'';
  document.getElementById('m-mfrfcu').value   = m?.mfrFCU||(m?.brandFCU||'').split(' ')[0]||'';
  document.getElementById('m-modelfcu').value = m?.modelFCU||(m?.brandFCU||'').split(' ').slice(1).join(' ')||'';
  document.getElementById('m-btu').value      = m?.btu||'';
  document.getElementById('m-ref').value      = m?.refrigerant||'';
  document.getElementById('m-interval').value = m?.interval||6;
  document.getElementById('m-install').value  = m?.install||'';
  setMsZone(m?.zone || 'process');
  // range
  setMsRange(m?.range || '');
  // ── Vendor chips ──
  const vendorVal = m?.vendor||'';
  const knownVendors = ['SKIC','TPC','TPL','SNP','SCG','SCL'];
  if (!vendorVal || knownVendors.includes(vendorVal)) {
    setVendorChip(vendorVal === 'TPL' ? 'TPC' : vendorVal);
  } else {
    setVendorChip('OTHER');
    const vOther = document.getElementById('m-vendor-other');
    if (vOther) { vOther.style.display='block'; vOther.value = vendorVal; }
  }
  // ── Real-time ตรวจ Equipment No. ซ้ำขณะพิมพ์ ──
  const eqInput = document.getElementById('m-equipment');
  if (eqInput) {
    eqInput._dupTimer = null;
    eqInput.oninput = function() {
      clearTimeout(this._dupTimer);
      const hint = document.getElementById('ms-eq-dup-hint');
      if (hint) hint.remove();
      const val = this.value.trim();
      if (!val || val.length < 6) return;
      this._dupTimer = setTimeout(() => {
        const curId = document.getElementById('m-id').value;
        const dups = db.machines.filter(x =>
          x.id !== curId &&
          x.equipment?.trim().toLowerCase() === val.toLowerCase()
        );
        if (dups.length > 0) {
          // แสดง hint ใต้ field
          let h = document.createElement('div');
          h.id = 'ms-eq-dup-hint';
          h.style.cssText = 'margin-top:5px;background:#fff5f6;border:1px solid #fecaca;border-radius:8px;padding:7px 10px';
          h.innerHTML = `<div style="font-size:0.7rem;font-weight:800;color:#c8102e;margin-bottom:4px">⚠️ Equipment No. นี้ถูกใช้แล้ว ${dups.length} เครื่อง:</div>` +
            dups.slice(0,3).map(x =>
              `<div style="font-size:0.72rem;color:#374151;padding:2px 0;display:flex;gap:6px;align-items:center">
                <span style="font-family:monospace;font-weight:700;color:#c8102e;flex-shrink:0">${x.serial||x.id.replace('csv_','')}</span>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.name}</span>
                <span style="color:#9ca3af;flex-shrink:0">${x.dept||''}</span>
              </div>`
            ).join('') +
            (dups.length > 3 ? `<div style="font-size:0.68rem;color:#9ca3af;margin-top:2px">+${dups.length-3} เครื่องอื่นๆ</div>` : '');
          eqInput.parentNode.appendChild(h);
          eqInput.style.borderColor = '#fca5a5';
        } else {
          eqInput.style.borderColor = '#86efac'; // เขียว = ไม่ซ้ำ
          setTimeout(() => { eqInput.style.borderColor = ''; }, 1500);
        }
      }, 500);
    };
  }

  // init lookup dept
  initLookupDept();
  const addDeptBox = document.getElementById('m-add-dept-box');
  if (addDeptBox) addDeptBox.style.display = m ? 'none' : 'block';
  const deptSel = document.getElementById('m-lookup-dept');
  if (deptSel) deptSel.value = m?.dept||'';
  // ── ไฮไลต์ field ที่ขาดด้วย border สีส้ม ──
  setTimeout(() => {
    const highlightFields = [
      { id:'m-funcloc',  val: m?.funcLoc   || (getMachineEqStatus(m||{}).fl) },
      { id:'m-equipment',val: m?.equipment || (getMachineEqStatus(m||{}).eq) },
      { id:'m-mfrcdu',   val: m?.mfrCDU  },
      { id:'m-modelcdu', val: m?.modelCDU },
      { id:'m-mfrfcu',   val: m?.mfrFCU  },
      { id:'m-modelfcu', val: m?.modelFCU },
      { id:'m-btu',      val: m?.btu     },
      { id:'m-ref',      val: m?.refrigerant },
    ];
    highlightFields.forEach(({id, val}) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!val) {
        el.style.borderColor = '#f59e0b';
        el.style.background  = '#fffbeb';
      } else {
        el.style.borderColor = '';
        el.style.background  = '';
      }
      // reset เมื่อผู้ใช้กรอก
      el.addEventListener('input', () => {
        if (el.value.trim()) { el.style.borderColor = ''; el.style.background = ''; }
      }, { once: true });
    });
  }, 300);

  openSheet('machine');
}

function openAddDept() {
  const existing = document.getElementById('_add_dept_modal');
  if (existing) existing.remove();

  const ov = document.createElement('div');
  ov.id = '_add_dept_modal';
  ov.style.cssText = 'position:fixed;inset:0;z-index:19999;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px';

  const box = document.createElement('div');
  box.style.cssText = 'background:white;border-radius:24px;padding:28px 24px;max-width:340px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,0.3)';
  box.innerHTML = `
    <div style="font-size:1rem;font-weight:900;color:#0f172a;margin-bottom:6px">➕ เพิ่มแผนกใหม่</div>
    <div style="font-size:0.78rem;color:#94a3b8;margin-bottom:16px">ชื่อแผนก / โซน จะปรากฏใน dropdown</div>
    <input id="_new_dept_input" type="text" placeholder="เช่น PM#1 Stock, WH Production"
      style="width:100%;padding:13px 14px;border:2px solid #e5e7eb;border-radius:12px;font-size:0.95rem;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:14px;transition:border-color 0.15s"
      onfocus="this.style.borderColor='#c8102e'" onblur="this.style.borderColor='#e5e7eb'"/>
    <div id="_new_dept_err" style="display:none;color:#c8102e;font-size:0.75rem;font-weight:700;margin-bottom:10px"></div>
    <div style="display:flex;gap:8px">
      <button id="_add_dept_cancel" style="flex:1;padding:13px;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit">ยกเลิก</button>
      <button id="_add_dept_ok" style="flex:2;padding:13px;background:linear-gradient(135deg,#c8102e,#e63950);color:white;border:none;border-radius:12px;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(200,16,46,0.35)">✓ เพิ่มแผนก</button>
    </div>`;

  ov.appendChild(box);
  document.body.appendChild(ov);

  const inp = document.getElementById('_new_dept_input');
  const errEl = document.getElementById('_new_dept_err');
  setTimeout(() => inp?.focus(), 80);

  const doAdd = () => {
    const val = inp.value.trim();
    if (!val) { errEl.textContent = 'กรุณาระบุชื่อแผนก'; errEl.style.display = ''; inp.focus(); return; }
    const existingDepts = [...new Set((db.machines||[]).map(m => m.dept||m.location||'').filter(Boolean))];
    if (existingDepts.some(d => d.toLowerCase() === val.toLowerCase())) {
      errEl.textContent = `"${val}" มีอยู่แล้ว`; errEl.style.display = ''; inp.focus(); return;
    }
    ov.remove();
    const sel = document.getElementById('m-lookup-dept');
    if (sel) {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = val;
      sel.appendChild(opt);
      sel.value = val;
      const deptEl = document.getElementById('m-dept');
      if (deptEl) deptEl.value = val;
      const abbr = val.replace(/[^A-Za-z0-9]/g,'').substring(0,4).toUpperCase() || 'AIR';
      const serialEl = document.getElementById('m-serial');
      if (serialEl && !serialEl.value) { serialEl.value = abbr + '001'; }
    }
    showToast('✅ เพิ่มแผนก "' + val + '" แล้ว');
  };

  document.getElementById('_add_dept_ok').onclick = doAdd;
  document.getElementById('_add_dept_cancel').onclick = () => ov.remove();
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); if (e.key === 'Escape') ov.remove(); });
}

function initLookupDept() {
  const sel = document.getElementById('m-lookup-dept');
  if (!sel) return;
  const depts = [...new Set(db.machines.map(m=>m.dept||m.location||'').filter(Boolean))].sort();
  sel.innerHTML = '<option value="">— เลือกแผนก —</option>' + depts.map(d=>`<option value="${d}">${d}</option>`).join('');
}

function onLookupDeptChange() {
  const dept = document.getElementById('m-lookup-dept')?.value;
  if (!dept) return;

  // กรอก field แผนกอัตโนมัติ
  const deptEl = document.getElementById('m-dept');
  if (deptEl) deptEl.value = dept;

  // ── Auto-generate Air ID ตาม pattern ของแผนกนั้น ──
  const serialEl = document.getElementById('m-serial');
  if (!serialEl) return;

  // ดึง serial ของเครื่องในแผนกนี้ทั้งหมด
  const sameDept = db.machines.filter(m => {
    const d = (m.dept||m.location||'').trim();
    return d === dept && (m.serial||'');
  });
  const serials  = sameDept.map(m => (m.serial||'').trim()).filter(Boolean);

  let nextSerial = '';

  if (serials.length > 0) {
    // ── หา prefix ที่ถูกต้อง รองรับทุก pattern: WH004, Pm1S005, PB19NO05, PM16001 ──
    // ใช้ regex จับส่วนที่ไม่ใช่ตัวเลขท้ายสุด เป็น prefix
    const prefixCount = {};
    serials.forEach(s => {
      const m = s.match(/^(.*[^0-9])(\d+)$/);
      if (m) {
        prefixCount[m[1]] = (prefixCount[m[1]]||0) + 1;
      }
    });

    // เลือก prefix ที่ count สูงสุด (ถ้าเท่ากันเอายาวกว่า)
    const topPrefix = Object.entries(prefixCount)
      .sort((a,b) => b[1]!==a[1] ? b[1]-a[1] : b[0].length-a[0].length)[0]?.[0];

    if (topPrefix) {
      const esc = topPrefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const re  = new RegExp('^'+esc+'(\\d+)$','i');
      const matchingSerials = serials.filter(s => re.test(s));
      const nums = matchingSerials.map(s => { const m=s.match(re); return m?parseInt(m[1]):0; }).filter(n=>n>0);
      const maxNum = nums.length ? Math.max(...nums) : 0;
      // ใช้จำนวน digit เดิมจาก sample แรก
      const sampleDigits = (matchingSerials[0]||'').replace(new RegExp('^'+esc,'i'),'').length || 3;
      nextSerial = topPrefix + String(maxNum+1).padStart(sampleDigits,'0');
    } else {
      const allNums = serials.map(s=>{const m=s.match(/(\d+)$/);return m?parseInt(m[1]):0;}).filter(n=>n>0);
      const maxAll = allNums.length ? Math.max(...allNums) : 0;
      nextSerial = 'AIR' + String(maxAll+1).padStart(3,'0');
    }
  } else {
    // แผนกใหม่ — ใช้ prefix ย่อจากชื่อแผนก
    const abbr = dept.replace(/[^A-Za-z0-9]/g,'').substring(0,4).toUpperCase() || 'AIR';
    nextSerial = abbr + '001';
  }

  serialEl.value = nextSerial;
  // highlight ให้รู้ว่า auto-fill
  serialEl.style.borderColor = '#10b981';
  serialEl.style.background  = '#f0fdf4';
  const hint = document.getElementById('m-serial-hint');
  if (hint) hint.style.display = '';
  setTimeout(() => {
    serialEl.style.borderColor = '';
    serialEl.style.background  = '';
  }, 2000);
}

function onLookupMachineChange_byId(mid) {
  if (!mid) return;
  const m = db.machines.find(x=>x.id===mid);
  if (!m) return;
  document.getElementById('m-id').value       = m.id;
  document.getElementById('m-serial').value   = m.serial||'';
  document.getElementById('m-dept').value     = m.dept||m.location||'';
  document.getElementById('m-funcloc').value  = m.funcLoc||'';
  document.getElementById('m-equipment').value= m.equipment||'';
  document.getElementById('m-name').value     = m.name||'';
  document.getElementById('m-loc').value      = m.location||'';
  document.getElementById('m-mfrcdu').value   = m.mfrCDU||(m.brandCDU||m.brand||'').split(' ')[0]||'';
  document.getElementById('m-modelcdu').value = m.modelCDU||(m.brandCDU||m.brand||'').split(' ').slice(1).join(' ')||'';
  document.getElementById('m-mfrfcu').value   = m.mfrFCU||(m.brandFCU||'').split(' ')[0]||'';
  document.getElementById('m-modelfcu').value = m.modelFCU||(m.brandFCU||'').split(' ').slice(1).join(' ')||'';
  document.getElementById('m-btu').value      = m.btu||'';
  document.getElementById('m-ref').value      = m.refrigerant||'';
  document.getElementById('m-interval').value = m.interval||6;
  document.getElementById('m-install').value  = m.install||'';
  const vEl=document.getElementById('m-vendor'); if(vEl) vEl.value=m.vendor||'';
}

function onVendorChange(sel) {
  const otherBox = document.getElementById('m-vendor-other');
  if (!otherBox) return;
  if (sel.value === 'OTHER') {
    otherBox.style.display = 'block';
    otherBox.focus();
  } else {
    otherBox.style.display = 'none';
    otherBox.value = '';
  }
}

function setMsZone(zone) {
  const h = document.getElementById('ms-zone');
  if (h) h.value = zone;
  const pb = document.getElementById('ms-zone-process-btn');
  const ob = document.getElementById('ms-zone-office-btn');
  if (pb) { pb.style.background=zone==='process'?'#0369a1':'white'; pb.style.color=zone==='process'?'white':'#64748b'; pb.style.borderColor=zone==='process'?'#0369a1':'#e2e8f0'; }
  if (ob) { ob.style.background=zone==='office'?'#0369a1':'white'; ob.style.color=zone==='office'?'white':'#64748b'; ob.style.borderColor=zone==='office'?'#0369a1':'#e2e8f0'; }
}
function setMsRange(range) {
  const h = document.getElementById('ms-range');
  if (h) h.value = range;
  ['A','B','C',''].forEach(r => {
    const btn = document.getElementById('ms-range-btn-' + (r||'auto'));
    if (!btn) return;
    const active = r === range;
    const colors = { A:'#be123c', B:'#0369a1', C:'#4d7c0f', '':'#7c3aed' };
    const bgs    = { A:'#fff1f2', B:'#f0f9ff', C:'#f7fee7', '':'#faf5ff' };
    const borders= { A:'#fecdd3', B:'#bae6fd', C:'#d9f99d', '':'#e9d5ff' };
    const col = colors[r]||'#64748b';
    btn.style.background   = active ? col : (bgs[r]||'white');
    btn.style.color        = active ? 'white' : col;
    btn.style.borderColor  = active ? col : (borders[r]||'#e2e8f0');
  });
}

function setVendorChip(val) {
  // sync hidden select
  const sel = document.getElementById('m-vendor');
  if (sel) sel.value = val === 'OTHER' ? 'OTHER' : val;
  // highlight active chip
  document.querySelectorAll('.ms-vc').forEach(btn => {
    const isActive = btn.id === 'ms-vc-' + (val||'');
    btn.style.transform = isActive ? 'scale(1.05)' : '';
    btn.style.boxShadow = isActive ? '0 4px 12px rgba(0,0,0,0.15)' : '';
    btn.style.fontWeight = isActive ? '900' : '700';
    if (isActive && val === 'SKIC') { btn.style.background='#dbeafe'; btn.style.borderColor='#1d4ed8'; btn.style.color='#1e40af'; }
    else if (isActive && val === 'TPC') { btn.style.background='#dcfce7'; btn.style.borderColor='#166534'; btn.style.color='#166534'; }
    else if (isActive && !val) { btn.style.background='#f1f5f9'; btn.style.borderColor='#94a3b8'; btn.style.color='#475569'; }
    else if (isActive) { btn.style.background='#fef3c7'; btn.style.borderColor='#d97706'; btn.style.color='#92400e'; }
    else { btn.style.background=''; btn.style.borderColor=''; btn.style.color=''; }
  });
  // show/hide other input
  const otherBox = document.getElementById('m-vendor-other');
  if (otherBox) {
    if (val === 'OTHER') { otherBox.style.display = 'block'; otherBox.focus(); }
    else { otherBox.style.display = 'none'; otherBox.value = ''; }
  }
}

function regenSerial() {
  const dept = document.getElementById('m-lookup-dept')?.value || document.getElementById('m-dept')?.value;
  if (dept) onLookupDeptChange();
}
function saveMachine() {
  const id = document.getElementById('m-id').value;
  const serial = document.getElementById('m-serial').value.trim();
  const mfrCDU   = document.getElementById('m-mfrcdu').value.trim();
  const modelCDU = document.getElementById('m-modelcdu').value.trim();
  const mfrFCU   = document.getElementById('m-mfrfcu').value.trim();
  const modelFCU = document.getElementById('m-modelfcu').value.trim();
  const brandCDU = [mfrCDU, modelCDU].filter(Boolean).join(' ') || document.getElementById('m-brand').value.trim();
  const brandFCU = [mfrFCU, modelFCU].filter(Boolean).join(' ') || document.getElementById('m-brandfcu').value.trim();
  const d = {
    name:        document.getElementById('m-name').value.trim(),
    serial:      serial,
    dept:        document.getElementById('m-dept').value.trim(),
    funcLoc:     document.getElementById('m-funcloc').value.trim(),
    equipment:   document.getElementById('m-equipment').value.trim(),
    location:    document.getElementById('m-loc').value.trim(),
    mfrCDU, modelCDU, mfrFCU, modelFCU,
    brand:       brandCDU,
    brandCDU:    brandCDU,
    brandFCU:    brandFCU,
    btu:         document.getElementById('m-btu').value.trim(),
    refrigerant: document.getElementById('m-ref').value,
    interval:    parseInt(document.getElementById('m-interval').value)||6,
    install:     document.getElementById('m-install').value,
    vendor:      (()=>{
      const sel = document.getElementById('m-vendor')?.value||'';
      if(sel==='OTHER'){
        const oth = (document.getElementById('m-vendor-other')?.value||'').trim();
        return oth || 'อื่นๆ';
      }
      return sel;
    })(),
    zone: document.getElementById('ms-zone')?.value || 'process',
    range: document.getElementById('ms-range')?.value || '',
  };
  if (!d.name)   { showFormError('m-name',   'กรุณาระบุชื่อห้อง / ชื่อเครื่อง'); return; }
  if (!serial)   { showFormError('m-serial', 'กรุณาระบุรหัส Air ID'); return; }
  if (!mfrCDU && !modelCDU) { showFormError('m-mfrcdu', 'กรุณาระบุยี่ห้อหรือรุ่น CDU'); return; }
  if (!mfrFCU && !modelFCU) { showFormError('m-mfrfcu', 'กรุณาระบุยี่ห้อหรือรุ่น FCU'); return; }
  if (!d.btu)    { showFormError('m-btu',    'กรุณาระบุ BTU'); return; }

  // ── ตรวจ Equipment No. ซ้ำ ──
  if (d.equipment) {
    const dupEq = db.machines.filter(x =>
      x.id !== id &&
      x.equipment?.trim() &&
      x.equipment.trim().toLowerCase() === d.equipment.toLowerCase()
    );
    if (dupEq.length > 0) {
      const dupRows = dupEq.slice(0,3).map(x =>
        `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#fff;border-radius:8px;margin-bottom:5px;border:1px solid #fecaca">
          <div style="width:7px;height:7px;background:#c8102e;border-radius:50%;flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.82rem;font-weight:700;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.name}</div>
            <div style="font-size:0.7rem;color:#6b7280;margin-top:1px">${x.serial||x.id.replace('csv_','')} · ${x.dept||'—'}</div>
          </div>
        </div>`
      ).join('');
      showAlert({
        icon: '⚠️', color: '#c8102e',
        title: 'Equipment No. ซ้ำกัน!',
        msg: `<strong style="font-family:monospace;font-size:0.85rem">${d.equipment}</strong><br>
          <span style="font-size:0.78rem;color:#64748b;display:block;margin:4px 0 10px">ถูกใช้งานในเครื่องเหล่านี้แล้ว:</span>
          ${dupRows}
          ${dupEq.length > 3 ? `<div style="font-size:0.75rem;color:#94a3b8;margin-top:4px">และอีก ${dupEq.length-3} เครื่อง...</div>` : ''}
          <div style="font-size:0.78rem;color:#d97706;margin-top:10px;font-weight:600">⚠️ Equipment No. ควรไม่ซ้ำกัน ต้องการบันทึกต่อหรือไม่?</div>`,
        btnOk: '💾 บันทึกต่อไป',
        btnCancel: '← แก้ไข Equipment No.',
        onOk: () => _checkAndSave(id, d, serial),
        onCancel: () => {
          const el = document.getElementById('m-equipment');
          if (el) { el.focus(); el.select(); el.style.borderColor='#c8102e'; }
        }
      });
      return;
    }
  }

  _checkAndSave(id, d, serial);
}

// ── ตรวจ serial/ชื่อซ้ำ แล้วบันทึก ──
function _checkAndSave(id, d, serial) {
  const newId = 'csv_'+serial;
  if (!id) {
    // เพิ่มใหม่: ตรวจ serial ซ้ำ
    const dupSerial = db.machines.find(x => x.serial?.toLowerCase() === serial.toLowerCase());
    if (dupSerial) {
      showAlert({
        icon: '⚠️', color: '#e65100',
        title: 'รหัส Air ID ซ้ำ!',
        msg: `รหัส <strong style="font-family:monospace">${serial}</strong> มีอยู่แล้วในระบบ<br>
          <span style="font-size:0.82rem;color:#64748b">${dupSerial.name} · ${dupSerial.dept||'—'}</span><br>
          <span style="font-size:0.78rem;color:#94a3b8">กรุณาใช้รหัสที่ไม่ซ้ำ หรือแก้ไขเครื่องเดิม</span>`,
        btnOk: 'แก้ไขรหัส',
        btnCancel: 'แก้ไขเครื่องเดิม',
        onCancel: () => openMachineSheet(dupSerial.id),
      });
      return;
    }
    // ตรวจชื่อซ้ำ (เตือน ไม่บล็อก)
    const dupName = db.machines.find(x => x.name?.toLowerCase() === d.name.toLowerCase() && x.dept?.toLowerCase() === d.dept?.toLowerCase());
    if (dupName) {
      showAlert({
        icon: '🔍', color: '#d97706',
        title: 'ชื่อเครื่องอาจซ้ำ',
        msg: `พบเครื่องชื่อใกล้เคียงอยู่แล้ว:<br>
          <strong style="font-family:monospace">${dupName.serial}</strong> — ${dupName.name}<br>
          <span style="font-size:0.78rem;color:#64748b">${dupName.dept||'—'}</span><br>
          <span style="font-size:0.78rem;color:#94a3b8">ต้องการบันทึกเครื่องใหม่หรือไม่?</span>`,
        btnOk: 'บันทึกเพิ่มเติม',
        btnCancel: 'ยกเลิก',
        onOk: () => _doSaveMachine(id, d, serial),
      });
      return;
    }
  } else {
    // แก้ไข: ตรวจ serial ซ้ำกับเครื่องอื่น (ไม่นับตัวเอง)
    const dupSerial = db.machines.find(x => x.id !== id && x.serial?.toLowerCase() === serial.toLowerCase());
    if (dupSerial) {
      showAlert({
        icon: '⚠️', color: '#e65100',
        title: 'รหัส Air ID ซ้ำ!',
        msg: `รหัส <strong style="font-family:monospace">${serial}</strong> ถูกใช้โดยเครื่องอื่นแล้ว<br>
          <span style="font-size:0.82rem;color:#64748b">${dupSerial.name} · ${dupSerial.dept||'—'}</span>`,
        btnOk: 'แก้ไขรหัส',
      });
      return;
    }
  }
  _doSaveMachine(id, d, serial);
}

function _doSaveMachine(id, d, serial) {
  const isNew = !id;

  // ── ช่างเพิ่มใหม่ → ส่งขออนุมัติ Admin แทนบันทึกทันที ──
  if (isNew && CU && CU.role === 'tech') {
    const req = {
      id: 'macreq_' + Date.now(),
      type: 'new_machine',
      serial, data: d,
      requestedBy: CU.id,
      requestedByName: CU.name,
      requestedAt: nowStr(),
      status: 'pending'
    };
    if (!db.machineRequests) db.machineRequests = [];
    db.machineRequests.push(req);
    saveDB();
    // แจ้ง Admin ทุกคน
    notifyRole('admin',
      '❄️ ขออนุมัติเพิ่มเครื่องแอร์',
      `${CU.name} ขอเพิ่ม [${serial}] ${d.name} · ${d.dept||'—'} — กรุณาตรวจสอบ`
    );
    closeSheet('machine');
    showAlert({
      icon: '📋', color: '#0369a1',
      title: 'ส่งคำขอแล้ว',
      msg: `ส่งคำขอเพิ่มเครื่อง <strong>${d.name}</strong> ให้ Admin ตรวจสอบแล้ว<br>
        <span style="font-size:0.78rem;color:#64748b">จะแสดงในระบบเมื่อ Admin อนุมัติ</span>`,
      btnOk: 'ตกลง'
    });
    return;
  }

  if (id) {
    const updated = Object.assign(db.machines.find(x=>x.id===id), d);
    syncMachine(updated);
  } else {
    const nm = {id:'csv_'+serial, ...d, addedAt: new Date().toISOString(), addedBy: CU?.id||''};
    if (db.machines.find(x=>x.id===nm.id)) { showToast('⚠️ รหัส Air ID นี้มีอยู่แล้ว'); return; }
    db.machines.push(nm); syncMachine(nm);
  }

  // ── แจ้งเตือน Admin เมื่อช่างเพิ่มเครื่องแอร์ใหม่ ──
  if (isNew && CU && CU.role !== 'admin') {
    const fl = FUNC_LOC[serial] ? FUNC_LOC[serial].fl : (d.funcLoc||'');
    const eq = FUNC_LOC[serial] ? FUNC_LOC[serial].eq : (d.equipment||'');
    const missingInfo = (!fl || !eq) ? ' ⚠️ ยังไม่มี FUNC_LOC' : '';
    notifyRole('admin',
      '❄️ เพิ่มเครื่องแอร์ใหม่',
      `${CU.name} เพิ่ม [${serial}] ${d.name} · ${d.dept||'—'}` + missingInfo
    );
  } else if (isNew && CU && CU.role === 'admin') {
    // Admin เพิ่มเอง — ก็แจ้งตัวเองบันทึกสำเร็จ (ไม่ต้องแจ้ง)
  }

  saveDB();
  if (typeof fsSaveNow === 'function') {
    fsSaveNow().then(()=>{
      showToast('✅ บันทึกและ Sync Firebase แล้ว');
    }).catch(()=>{
      showToast('✅ บันทึก local แล้ว (Firebase offline)');
    });
  } else {
    showToast('✅ บันทึกเครื่องแอร์แล้ว');
  }
  closeSheet('machine'); renderMachines(); populateMachineSelect();
}
function openMachineRequestsPage() {
  document.getElementById('_mac-req-page')?.remove();
  const page = document.createElement('div');
  page.id = '_mac-req-page';
  page.style.cssText = 'position:fixed;top:calc(var(--head-h,56px) + var(--safe-top,env(safe-area-inset-top,0px)));bottom:calc(var(--nav-h,56px) + var(--safe-bot,env(safe-area-inset-bottom,0px)));left:0;right:0;z-index:9500;background:#f1f5f9;display:flex;flex-direction:column;animation:slideDown 0.25s cubic-bezier(0.32,0.72,0,1)';

  const renderContent = () => {
    const pending = (db.machineRequests||[]).filter(r => r.status === 'pending');
    const approved = (db.machineRequests||[]).filter(r => r.status === 'approved').slice(-5).reverse();
    const rejected = (db.machineRequests||[]).filter(r => r.status === 'rejected').slice(-3).reverse();
    const vcStyle = {SKIC:'background:#dbeafe;color:#1d4ed8',TPC:'background:#dcfce7;color:#166534',SNP:'background:#fef3c7;color:#92400e',SCG:'background:#ffedd5;color:#c2410c'};

    page.innerHTML = `
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:16px 16px 16px;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:12px">
          <button onclick="document.getElementById('_mac-req-page').remove();if(typeof updateTopbarTitle==='function')updateTopbarTitle(document.querySelector('.page.active')?.dataset.page||'')" style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);color:white;font-size:1.3rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;touch-action:manipulation">‹</button>
          <div style="flex:1">
            <div style="color:white;font-size:1.05rem;font-weight:900;letter-spacing:-0.01em">คำขอเพิ่มเครื่องแอร์</div>
            <div style="color:rgba(255,255,255,0.45);font-size:0.7rem;margin-top:2px">Admin อนุมัติ / ปฏิเสธ</div>
          </div>
          ${pending.length>0?`<div style="background:#c8102e;color:white;border-radius:99px;padding:5px 14px;font-size:0.88rem;font-weight:900;box-shadow:0 2px 8px rgba(200,16,46,0.4)">${pending.length} รอ</div>`:''}
        </div>
        <!-- Tab stats -->
        <div style="display:flex;gap:8px;margin-top:14px">
          <div style="flex:1;background:rgba(255,255,255,0.08);border-radius:10px;padding:6px 8px;text-align:center">
            <div style="font-size:1.1rem;font-weight:900;color:#fbbf24">${pending.length}</div>
            <div style="font-size:0.6rem;color:rgba(255,255,255,0.5);font-weight:700;text-transform:uppercase;letter-spacing:.05em">รอดำเนินการ</div>
          </div>
          <div style="flex:1;background:rgba(255,255,255,0.08);border-radius:10px;padding:6px 8px;text-align:center">
            <div style="font-size:1.1rem;font-weight:900;color:#34d399">${(db.machineRequests||[]).filter(r=>r.status==='approved').length}</div>
            <div style="font-size:0.6rem;color:rgba(255,255,255,0.5);font-weight:700;text-transform:uppercase;letter-spacing:.05em">อนุมัติแล้ว</div>
          </div>
          <div style="flex:1;background:rgba(255,255,255,0.08);border-radius:10px;padding:6px 8px;text-align:center">
            <div style="font-size:1.1rem;font-weight:900;color:#f87171">${(db.machineRequests||[]).filter(r=>r.status==='rejected').length}</div>
            <div style="font-size:0.6rem;color:rgba(255,255,255,0.5);font-weight:700;text-transform:uppercase;letter-spacing:.05em">ปฏิเสธ</div>
          </div>
        </div>
      </div>

      <!-- Body -->
      <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 14px calc(env(safe-area-inset-bottom,0px)+24px)">

        ${pending.length === 0 ? `
          <div style="text-align:center;padding:56px 20px">
            <div style="width:72px;height:72px;background:linear-gradient(135deg,#d1fae5,#a7f3d0);border-radius:22px;display:flex;align-items:center;justify-content:center;font-size:2.2rem;margin:0 auto 16px;box-shadow:0 8px 24px rgba(16,185,129,0.2)">✅</div>
            <div style="font-size:1rem;font-weight:800;color:#374151;margin-bottom:6px">ไม่มีคำขอที่รอดำเนินการ</div>
            <div style="font-size:0.78rem;color:#94a3b8;line-height:1.5">เมื่อช่างส่งคำขอเพิ่มเครื่องแอร์ใหม่<br>จะแสดงรายการที่นี่</div>
          </div>` : `
          <div style="font-size:0.65rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;display:flex;align-items:center;gap:6px">
            <div style="width:4px;height:14px;background:#f59e0b;border-radius:2px"></div>
            รอการอนุมัติ (${pending.length})
          </div>
          ${pending.map(r => {
            const vc = vcStyle[r.data.vendor] || 'background:#f1f5f9;color:#475569';
            const fields = [
              {icon:'🏢',label:'แผนก',val:r.data.dept},
              {icon:'🌡️',label:'BTU',val:r.data.btu?Number(r.data.btu).toLocaleString()+' BTU':null},
              {icon:'💧',label:'สารทำความเย็น',val:r.data.refrigerant},
              {icon:'🔧',label:'CDU',val:[r.data.mfrCDU,r.data.modelCDU].filter(Boolean).join(' ')},
              {icon:'❄️',label:'FCU',val:[r.data.mfrFCU,r.data.modelFCU].filter(Boolean).join(' ')},
              {icon:'📍',label:'Location',val:r.data.funcLoc||r.data.location||r.data.dept},
            ].filter(f=>f.val);
            return `
            <div style="background:white;border-radius:18px;overflow:hidden;margin-bottom:14px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid #f1f5f9">
              <!-- Card top stripe -->
              <div style="height:3px;background:linear-gradient(90deg,#c8102e,#e63950,#ff8c69)"></div>
              <!-- Header -->
              <div style="padding:14px 16px 10px">
                <div style="display:flex;align-items:flex-start;gap:12px">
                  <div style="width:50px;height:50px;background:linear-gradient(135deg,#dbeafe,#bfdbfe);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;flex-shrink:0">❄️</div>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:0.95rem;font-weight:800;color:#0f172a;line-height:1.3;margin-bottom:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.data.name||'ไม่ระบุชื่อ'}</div>
                    <div style="display:flex;gap:5px;flex-wrap:wrap">
                      <span style="font-family:monospace;font-size:0.65rem;background:#f1f5f9;color:#475569;border-radius:6px;padding:2px 8px;font-weight:700">${r.serial||'—'}</span>
                      ${r.data.vendor?`<span style="font-size:0.65rem;border-radius:6px;padding:2px 8px;font-weight:800;${vc}">${r.data.vendor}</span>`:''}
                      <span style="font-size:0.62rem;background:#fef9c3;color:#92400e;border-radius:6px;padding:2px 8px;font-weight:700">⏳ รอ Admin</span>
                    </div>
                  </div>
                </div>
              </div>
              <!-- Fields grid -->
              ${fields.length?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#f1f5f9;border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9">
                ${fields.map(f=>`<div style="background:white;padding:8px 12px;display:flex;align-items:flex-start;gap:7px">
                  <span style="font-size:0.85rem;flex-shrink:0;margin-top:1px">${f.icon}</span>
                  <div style="min-width:0">
                    <div style="font-size:0.55rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:1px">${f.label}</div>
                    <div style="font-size:0.74rem;font-weight:700;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.val}</div>
                  </div>
                </div>`).join('')}
              </div>`:''}
              <!-- Requester -->
              <div style="margin:10px 14px;background:#f8fafc;border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:8px">
                <div style="width:32px;height:32px;background:linear-gradient(135deg,#e0f2fe,#bae6fd);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:0.95rem;flex-shrink:0">👷</div>
                <div style="flex:1;min-width:0">
                  <div style="font-size:0.75rem;font-weight:700;color:#1e293b">${r.requestedByName||'—'}</div>
                  <div style="font-size:0.62rem;color:#94a3b8">${(r.requestedAt||'').substring(0,16).replace('T',' ')}</div>
                </div>
              </div>
              <!-- Action buttons -->
              <div style="padding:0 12px 14px;display:flex;gap:8px">
                <button onclick="approveMachineReq('${r.id}')"
                  style="flex:2;padding:13px;background:linear-gradient(135deg,#16a34a,#15803d);color:white;border:none;border-radius:12px;font-size:0.88rem;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:7px;box-shadow:0 3px 12px rgba(22,163,74,0.3);touch-action:manipulation"
                  onmousedown="this.style.opacity='0.85'" onmouseup="this.style.opacity='1'" ontouchend="this.style.opacity='1'">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ✅ อนุมัติ
                </button>
                <button onclick="rejectMachineReq('${r.id}')"
                  style="flex:1;padding:13px;background:white;color:#c8102e;border:2px solid #fecaca;border-radius:12px;font-size:0.85rem;font-weight:800;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:5px;touch-action:manipulation"
                  onmousedown="this.style.background='#fff0f2'" onmouseup="this.style.background='white'" ontouchend="this.style.background='white'">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  ปฏิเสธ
                </button>
              </div>
            </div>`;}).join('')}`}

        <!-- อนุมัติล่าสุด -->
        ${approved.length > 0 ? `
          <div style="font-size:0.65rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin:16px 0 10px;display:flex;align-items:center;gap:6px">
            <div style="width:4px;height:14px;background:#16a34a;border-radius:2px"></div>
            อนุมัติล่าสุด
          </div>
          ${approved.map(r=>`<div style="background:white;border:1.5px solid #f0fdf4;border-radius:12px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
            <div style="width:38px;height:38px;background:linear-gradient(135deg,#d1fae5,#a7f3d0);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">✅</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.8rem;font-weight:700;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.data.name||'—'}</div>
              <div style="font-size:0.62rem;color:#94a3b8;margin-top:2px">${r.requestedByName||'—'} · ${(r.approvedAt||'').substring(0,10)}</div>
            </div>
            <span style="background:#f0fdf4;color:#16a34a;border:1.5px solid #bbf7d0;border-radius:8px;padding:4px 10px;font-size:0.65rem;font-weight:800;flex-shrink:0">อนุมัติแล้ว</span>
          </div>`).join('')}` : ''}

        <!-- ปฏิเสธล่าสุด -->
        ${rejected.length > 0 ? `
          <div style="font-size:0.65rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin:16px 0 10px;display:flex;align-items:center;gap:6px">
            <div style="width:4px;height:14px;background:#c8102e;border-radius:2px"></div>
            ปฏิเสธล่าสุด
          </div>
          ${rejected.map(r=>`<div style="background:white;border:1.5px solid #fff0f2;border-radius:12px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
            <div style="width:38px;height:38px;background:linear-gradient(135deg,#fee2e2,#fecaca);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">❌</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.8rem;font-weight:700;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.data.name||'—'}</div>
              <div style="font-size:0.62rem;color:#94a3b8;margin-top:2px">${r.requestedByName||'—'} · ${(r.rejectedAt||'').substring(0,10)}</div>
            </div>
            <span style="background:#fff0f2;color:#c8102e;border:1.5px solid #fecaca;border-radius:8px;padding:4px 10px;font-size:0.65rem;font-weight:800;flex-shrink:0">ปฏิเสธ</span>
          </div>`).join('')}` : ''}

      </div>`;
  };


  window.approveMachineReq = (reqId) => {
    const req = (db.machineRequests||[]).find(r => r.id === reqId);
    if (!req) return;
    const nm = {id:'csv_'+req.serial, ...req.data, addedAt: new Date().toISOString(), addedBy: req.requestedBy};
    if (db.machines.find(x=>x.id===nm.id)) { showToast('⚠️ Air ID นี้มีอยู่แล้ว'); return; }
    db.machines.push(nm);
    req.status = 'approved'; req.approvedBy = CU.id; req.approvedAt = nowStr();
    syncMachine(nm); saveDB();
    notifyUser(req.requestedBy, '✅ คำขอได้รับการอนุมัติ', `เครื่อง [${req.serial}] ${req.data.name} เพิ่มในระบบแล้ว`, null);
    showToast('✅ อนุมัติแล้ว');
    invalidateMacCache?.(); invalidateTkCache?.();
    renderContent();
  };
  window.rejectMachineReq = (reqId) => {
    const req = (db.machineRequests||[]).find(r => r.id === reqId);
    if (!req) return;
    showAlert({ icon:'❌', color:'#c8102e', title:'ปฏิเสธคำขอ?',
      msg:`ปฏิเสธการเพิ่ม <strong>${req.data.name}</strong>`,
      btnOk:'❌ ปฏิเสธ', btnCancel:'ยกเลิก',
      onOk:() => {
        req.status='rejected'; req.rejectedBy=CU.id; req.rejectedAt=nowStr();
        saveDB();
        notifyUser(req.requestedBy,'❌ คำขอถูกปฏิเสธ',`คำขอเพิ่มเครื่อง ${req.data.name} ถูกปฏิเสธ`,null);
        showToast('❌ ปฏิเสธแล้ว');
        renderContent();
      }
    });
  };

  renderContent();
  document.body.appendChild(page);
  if (typeof updateTopbarTitle === 'function') updateTopbarTitle('machine-requests');
}

// Keep old name as alias
function toggleMacDropdown() {
  const dd = document.getElementById('mac-dropdown');
  const btn = document.getElementById('mac-action-wrap');
  if (!dd || !btn) return;
  const open = dd.style.display !== 'none';
  if (open) { closeMacDropdown(); return; }

  // อัปเดต badge เครื่องใหม่
  try {
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth()-2);
    const newCount = (db.machines||[]).filter(m => {
      if (!m.addedAt) return false;
      const dt = new Date(m.addedAt.replace(' ','T'));
      return !isNaN(dt) && dt >= cutoff && !m.id.startsWith('csv_');
    }).length;
    const newBadge = document.getElementById('mac-dd-new-badge');
    if (newBadge) { newBadge.textContent = newCount > 0 ? newCount : ''; newBadge.style.display = newCount > 0 ? '' : 'none'; }
  } catch(e) {}

  // อัปเดต badge คำขอรออนุมัติ
  try {
    const reqCount = (db.machineRequests||[]).filter(r => r.status === 'pending').length;
    const reqBadge = document.getElementById('mac-dd-req-badge');
    if (reqBadge) { reqBadge.textContent = reqCount > 0 ? reqCount + ' รอ' : ''; reqBadge.style.display = reqCount > 0 ? '' : 'none'; }
  } catch(e) {}

  // ซ่อน admin-only items ถ้าไม่ใช่ admin
  const isAdmin = CU && CU.role === 'admin';
  ['mac-dd-repair','mac-dd-vendor'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isAdmin ? '' : 'none';
  });

  // คำนวณ position จาก button (fixed positioning ไม่ถูก clip)
  const rect = btn.getBoundingClientRect();
  dd.style.top  = (rect.bottom + 6) + 'px';
  dd.style.left = 'auto';
  dd.style.right = (window.innerWidth - rect.right) + 'px';
  dd.style.display = 'block';
  setTimeout(() => {
    const handler = (e) => {
      if (!dd.contains(e.target) && !btn.contains(e.target)) {
        closeMacDropdown();
        document.removeEventListener('click', handler);
      }
    };
    document.addEventListener('click', handler);
  }, 10);
}
function closeMacDropdown() {
  const dd = document.getElementById('mac-dropdown');
  if (dd) dd.style.display = 'none';
}

function updateNewMacBadge() {
  const all = db.machines || [];
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth()-2);
  const count = all.filter(m => {
    if (!m.addedAt) return false;
    const dt = new Date(m.addedAt.replace(' ','T'));
    return !isNaN(dt) && dt >= cutoff && m.id.startsWith('csv_') === false;
  }).length;
  const badge = document.getElementById('new-mac-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function openNewMachinesTable() {
  const all = db.machines || [];
  const cutoff2m = new Date(); cutoff2m.setMonth(cutoff2m.getMonth() - 2); cutoff2m.setHours(0,0,0,0);
  let list = all.filter(m => {
    if (!m.addedAt) return false;
    const dt = new Date(m.addedAt.replace(' ','T'));
    return !isNaN(dt) && dt >= cutoff2m;
  }).sort((a,b) => (b.addedAt||'').localeCompare(a.addedAt||''));
  if (list.length === 0) {
    list = [...all].sort((a,b) => (b.addedAt||b.id||'').localeCompare(a.addedAt||a.id||'')).slice(0,10);
  }

  const PAGE_SIZE = 10;
  let currentPage = 1;

  const vcMap = {
    SKIC:{bg:'#eff6ff',cl:'#1d4ed8',bd:'#bfdbfe'},
    TPC: {bg:'#f0fdf4',cl:'#166534',bd:'#bbf7d0'},
    SNP: {bg:'#fefce8',cl:'#92400e',bd:'#fde68a'},
    SCG: {bg:'#fff7ed',cl:'#c2410c',bd:'#fed7aa'},
    SCL: {bg:'#fdf4ff',cl:'#7c3aed',bd:'#e9d5ff'},
  };
  const dvc = {bg:'#f8fafc',cl:'#475569',bd:'#e2e8f0'};

  document.getElementById('_nmtable')?.remove();
  const pg = document.createElement('div');
  pg.id = '_nmtable';
  pg.style.cssText = 'position:fixed;top:calc(var(--head-h,56px) + var(--safe-top,env(safe-area-inset-top,0px)));bottom:calc(var(--nav-h,56px) + var(--safe-bot,env(safe-area-inset-bottom,0px)));left:0;right:0;z-index:9600;background:#f1f5f9;display:flex;flex-direction:column;animation:slideDown 0.22s cubic-bezier(0.32,0.72,0,1)';

  const totalPages = () => Math.ceil(list.length / PAGE_SIZE);

  const renderCards = () => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = list.slice(start, start + PAGE_SIZE);
    return pageItems.map((m, idx) => {
      const i = start + idx;
      const vc = vcMap[m.vendor] || dvc;
      const activeT = (db.tickets||[]).filter(x=>x.machineId===m.id&&!['closed','verified'].includes(x.status));
      const hasIssue = activeT.length > 0;
      const addedDate = (m.addedAt||'').substring(0,10);
      const daysAgo = m.addedAt ? Math.floor((Date.now()-new Date(m.addedAt.replace(' ','T')))/(1000*60*60*24)) : null;
      const daysLabel = daysAgo === null ? '' : daysAgo === 0
        ? `<span style="background:#dcfce7;color:#15803d;border-radius:99px;padding:1px 7px;font-size:0.58rem;font-weight:700">วันนี้</span>`
        : daysAgo === 1
        ? `<span style="background:#dbeafe;color:#1d4ed8;border-radius:99px;padding:1px 7px;font-size:0.58rem;font-weight:700">เมื่อวาน</span>`
        : `<span style="color:#94a3b8;font-size:0.6rem">${daysAgo} วันที่แล้ว</span>`;

      const fl = getMachineEqStatus(m).fl;
      const eq = getMachineEqStatus(m).eq;
      const hasFL = getMachineEqStatus(m).hasFL;
      const hasEQ = getMachineEqStatus(m).hasEQ;

      return `
      <div onclick="document.getElementById('_nmtable').remove();setTimeout(()=>openMachineDetail('${m.id}'),120)"
        style="background:white;border-radius:14px;margin-bottom:8px;overflow:hidden;border:1px solid ${hasIssue?'#fecaca':'#e5e7eb'};cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.05);transition:all 0.15s"
        onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)';this.style.transform='translateY(-1px)'"
        onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)';this.style.transform=''">

        <!-- Row 1: Index + Icon + Name + Status -->
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px 8px">
          <div style="width:28px;height:28px;border-radius:8px;background:${hasIssue?'linear-gradient(135deg,#c8102e,#9b0020)':'linear-gradient(135deg,#064e3b,#065f46)'};display:flex;align-items:center;justify-content:center;font-size:0.68rem;font-weight:900;color:white;flex-shrink:0">${i+1}</div>
          <!-- AC icon -->
          <div style="width:34px;height:34px;border-radius:10px;background:${hasIssue?'#fff0f2':'#f0fdf4'};border:1px solid ${hasIssue?'#fecaca':'#bbf7d0'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${hasIssue?'#c8102e':'#15803d'}" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="3" width="20" height="8" rx="2"/><line x1="2" y1="7" x2="22" y2="7"/><path d="M7 11v5"/><path d="M12 11v9"/><path d="M17 11v5"/></svg>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:0.85rem;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.name||'—'}</div>
            <div style="display:flex;align-items:center;gap:4px;margin-top:2px;flex-wrap:nowrap;overflow:hidden">
              ${m.vendor?`<span style="background:${vc.bg};color:${vc.color};border:1px solid ${vc.border};border-radius:4px;padding:0 5px;font-size:0.58rem;font-weight:800;flex-shrink:0">${m.vendor}</span>`:''}
              <span style="font-size:0.62rem;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.serial||m.id}</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0">
            ${hasIssue
              ? `<span style="background:#fff0f2;color:#c8102e;border:1px solid #fecaca;border-radius:99px;padding:1px 7px;font-size:0.6rem;font-weight:700">${activeT.length} ค้าง</span>`
              : `<span style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:99px;padding:1px 7px;font-size:0.6rem;font-weight:600">ปกติ</span>`}
            ${daysLabel}
          </div>
        </div>

        <!-- Row 2: Meta grid 4 cols -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border-top:1px solid #f8fafc">
          <div style="padding:5px 10px;border-right:1px solid #f8fafc">
            <div style="font-size:0.48rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">แผนก</div>
            <div style="font-size:0.65rem;font-weight:700;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.dept||m.location||'—'}</div>
          </div>
          <div style="padding:5px 10px;border-right:1px solid #f8fafc">
            <div style="font-size:0.48rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">BTU</div>
            <div style="font-size:0.65rem;font-weight:700;color:#374151">${m.btu?Number(m.btu).toLocaleString():'—'}</div>
          </div>
          <div style="padding:5px 10px;border-right:1px solid #f8fafc">
            <div style="font-size:0.48rem;color:${hasFL?'#0369a1':'#f59e0b'};font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">FL</div>
            <div style="font-size:0.6rem;font-weight:700;color:${hasFL?'#0369a1':'#d97706'};font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fl||'—'}</div>
          </div>
          <div style="padding:5px 10px">
            <div style="font-size:0.48rem;color:${hasEQ?'#7c3aed':'#f59e0b'};font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">EQ</div>
            <div style="font-size:0.6rem;font-weight:700;color:${hasEQ?'#7c3aed':'#d97706'};font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${eq||'—'}</div>
          </div>
        </div>

        <!-- Row 3: เพิ่มเมื่อ + สถานะ FL/EQ -->
        <div style="padding:5px 12px 7px;background:${(!hasFL||!hasEQ)?'#fffbeb':'#f8fafc'};border-top:1px solid #f1f5f9;display:flex;align-items:center;gap:6px">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span style="font-size:0.6rem;color:#94a3b8">เพิ่มเมื่อ ${addedDate||'—'}</span>
          <div style="flex:1"></div>
          ${!hasFL?`<span style="background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 5px;font-size:0.55rem;font-weight:700">FL ไม่มี</span>`:
            `<span style="background:#e0f2fe;color:#0369a1;border-radius:4px;padding:1px 5px;font-size:0.55rem;font-weight:700">FL ✓</span>`}
          ${!hasEQ?`<span style="background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 5px;font-size:0.55rem;font-weight:700">EQ ไม่มี</span>`:
            `<span style="background:#ede9fe;color:#7c3aed;border-radius:4px;padding:1px 5px;font-size:0.55rem;font-weight:700">EQ ✓</span>`}
        </div>
      </div>`;
    }).join('');
  };

  const renderPagination = () => {
    const total = totalPages();
    if (total <= 1) return '';

    // สร้าง page numbers แบบ ellipsis — แสดงแค่ window 5 หน้ารอบๆ current
    const pages = [];
    const addPage = (p) => pages.push(`<button onclick="window._nmGoPage(${p})"
      style="min-width:32px;height:32px;border-radius:8px;border:1.5px solid ${p===currentPage?'#064e3b':'#e2e8f0'};background:${p===currentPage?'#064e3b':'white'};color:${p===currentPage?'white':'#374151'};font-size:0.78rem;font-weight:${p===currentPage?'900':'600'};cursor:pointer;font-family:inherit;padding:0 4px">${p}</button>`);
    const addDot = () => pages.push(`<span style="color:#94a3b8;font-size:0.82rem;padding:0 2px">…</span>`);

    if (total <= 7) {
      for (let p = 1; p <= total; p++) addPage(p);
    } else {
      addPage(1);
      if (currentPage > 3) addDot();
      const lo = Math.max(2, currentPage - 1);
      const hi = Math.min(total - 1, currentPage + 1);
      for (let p = lo; p <= hi; p++) addPage(p);
      if (currentPage < total - 2) addDot();
      addPage(total);
    }

    const start = (currentPage-1)*PAGE_SIZE+1;
    const end   = Math.min(currentPage*PAGE_SIZE, list.length);
    return `
    <div style="padding:8px 12px;display:flex;align-items:center;justify-content:center;gap:4px;flex-wrap:wrap">
      <button onclick="window._nmGoPage(${currentPage-1})" ${currentPage<=1?'disabled':''} style="min-width:32px;height:32px;border-radius:8px;border:1.5px solid #e2e8f0;background:white;color:${currentPage<=1?'#d1d5db':'#374151'};font-size:1rem;cursor:${currentPage<=1?'default':'pointer'};display:flex;align-items:center;justify-content:center">‹</button>
      ${pages.join('')}
      <button onclick="window._nmGoPage(${currentPage+1})" ${currentPage>=total?'disabled':''} style="min-width:32px;height:32px;border-radius:8px;border:1.5px solid #e2e8f0;background:white;color:${currentPage>=total?'#d1d5db':'#374151'};font-size:1rem;cursor:${currentPage>=total?'default':'pointer'};display:flex;align-items:center;justify-content:center">›</button>
      <span style="font-size:0.65rem;color:#94a3b8;width:100%;text-align:center;margin-top:2px">${start}–${end} จาก ${list.length} รายการ</span>
    </div>`;
  };

  window._nmGoPage = (p) => {
    const total = totalPages();
    if (p < 1 || p > total) return;
    currentPage = p;
    const body = document.getElementById('_nmtable_body');
    const pagi = document.getElementById('_nmtable_pagi');
    if (body) body.innerHTML = renderCards();
    if (pagi) pagi.innerHTML = renderPagination();
    body?.scrollIntoView({behavior:'smooth'});
  };

  // stats bar
  const withIssue = list.filter(m => (db.tickets||[]).some(t=>t.machineId===m.id&&!['closed','verified'].includes(t.status))).length;
  const noFL = list.filter(m => !getMachineEqStatus(m).hasFL).length;
  const noEQ = list.filter(m => !getMachineEqStatus(m).hasEQ).length;

  pg.innerHTML = `
    <!-- ── Header ── -->
    <div style="background:linear-gradient(135deg,#064e3b 0%,#065f46 60%,#047857 100%);padding:16px 14px 0;flex-shrink:0">
      <!-- top bar -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <button onclick="document.getElementById('_nmtable').remove();if(typeof updateTopbarTitle==='function')updateTopbarTitle(document.querySelector('.page.active')?.dataset.page||'')"
          style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);color:white;font-size:1.2rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background 0.15s"
          onmouseover="this.style.background='rgba(255,255,255,0.22)'" onmouseout="this.style.background='rgba(255,255,255,0.12)'">‹</button>
        <div style="flex:1;min-width:0">
          <div style="color:white;font-size:1rem;font-weight:900;letter-spacing:-0.01em">เครื่องแอร์เพิ่มใหม่</div>
          <div style="color:rgba(255,255,255,0.55);font-size:0.65rem;margin-top:1px">2 เดือนล่าสุด</div>
        </div>
        <div style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);color:white;border-radius:10px;padding:4px 12px;font-size:0.9rem;font-weight:900;flex-shrink:0">${list.length}</div>
      </div>

      <!-- ── stat pills ── -->
      <div style="display:flex;gap:6px;padding-bottom:12px;overflow-x:auto;scrollbar-width:none;justify-content:center">
        <div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);border-radius:10px;padding:7px 14px;flex-shrink:0;text-align:center">
          <div style="font-size:1.15rem;font-weight:900;color:white;line-height:1">${list.length}</div>
          <div style="font-size:0.56rem;color:rgba(255,255,255,0.65);margin-top:2px;font-weight:600">ทั้งหมด</div>
        </div>
        <div style="background:${withIssue>0?'rgba(220,38,38,0.3)':'rgba(255,255,255,0.08)'};border:1px solid ${withIssue>0?'rgba(252,165,165,0.4)':'rgba(255,255,255,0.15)'};border-radius:10px;padding:7px 14px;flex-shrink:0;text-align:center">
          <div style="font-size:1.15rem;font-weight:900;color:${withIssue>0?'#fca5a5':'rgba(255,255,255,0.4)'};line-height:1">${withIssue}</div>
          <div style="font-size:0.56rem;color:rgba(255,255,255,0.55);margin-top:2px;font-weight:600">งานค้าง</div>
        </div>
        <div style="background:${noFL>0?'rgba(245,158,11,0.25)':'rgba(255,255,255,0.08)'};border:1px solid ${noFL>0?'rgba(253,230,138,0.4)':'rgba(255,255,255,0.15)'};border-radius:10px;padding:7px 14px;flex-shrink:0;text-align:center">
          <div style="font-size:1.15rem;font-weight:900;color:${noFL>0?'#fde68a':'rgba(255,255,255,0.4)'};line-height:1">${noFL}</div>
          <div style="font-size:0.56rem;color:rgba(255,255,255,0.55);margin-top:2px;font-weight:600">ไม่มี FL</div>
        </div>
        <div style="background:${noEQ>0?'rgba(245,158,11,0.25)':'rgba(255,255,255,0.08)'};border:1px solid ${noEQ>0?'rgba(253,230,138,0.4)':'rgba(255,255,255,0.15)'};border-radius:10px;padding:7px 14px;flex-shrink:0;text-align:center">
          <div style="font-size:1.15rem;font-weight:900;color:${noEQ>0?'#fde68a':'rgba(255,255,255,0.4)'};line-height:1">${noEQ}</div>
          <div style="font-size:0.56rem;color:rgba(255,255,255,0.55);margin-top:2px;font-weight:600">ไม่มี EQ</div>
        </div>
        <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:7px 14px;flex-shrink:0;text-align:center">
          <div style="font-size:1.15rem;font-weight:900;color:rgba(255,255,255,0.75);line-height:1">${list.length - withIssue}</div>
          <div style="font-size:0.56rem;color:rgba(255,255,255,0.55);margin-top:2px;font-weight:600">ปกติ</div>
        </div>
      </div>
    </div>

    <!-- ── Pagination top ── -->
    <div id="_nmtable_pagi_top" style="background:white;border-bottom:1px solid #f1f5f9;padding:0 12px;flex-shrink:0">
    </div>

    <!-- ── Cards body ── -->
    <div style="flex:1;overflow-y:auto;background:#f1f5f9">
      <div id="_nmtable_pagi" style="background:white;border-bottom:1px solid #f1f5f9"></div>
      <div id="_nmtable_body" style="padding:10px 12px calc(env(safe-area-inset-bottom,0px)+12px)">
        ${list.length === 0
          ? `<div style="text-align:center;padding:60px 20px">
               <div style="width:56px;height:56px;background:#e2e8f0;border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
                 <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
               </div>
               <div style="font-weight:700;color:#64748b">ยังไม่มีเครื่องแอร์ที่เพิ่มใน 2 เดือนนี้</div>
             </div>`
          : renderCards()
        }
      </div>
    </div>`;

  document.body.appendChild(pg);
  if (typeof updateTopbarTitle === 'function') updateTopbarTitle('new-machines');

  // render pagination
  const pagiEl = document.getElementById('_nmtable_pagi');
  if (pagiEl) pagiEl.innerHTML = renderPagination();
}

function delMachine(id) {
  const m = db.machines.find(x=>x.id===id);
  if (!m) { showToast('ไม่พบเครื่อง'); return; }
  showAlert({
    icon: '🗑️', color: '#c8102e',
    title: 'ลบเครื่องแอร์?',
    msg: `<strong>${escapeHtml(m.name)}</strong><br><span style="font-family:monospace;font-size:0.82rem;color:#64748b">${m.serial}</span><br><span style="font-size:0.78rem;color:#94a3b8">ไม่สามารถย้อนกลับได้</span>`,
    btnOk: '🗑️ ลบ', btnCancel: 'ยกเลิก',
    onOk: () => {
      db.machines = db.machines.filter(x => x.id !== id);
      saveDB();
      if (typeof fsSave === 'function') fsSave(); // FIX v23-fix22: debounce
      window._macPage = 0;
      renderMachines(); populateMachineSelect();
      showToast('🗑️ ลบเครื่องแล้ว');
    }
  });
}

// ── แสดงรายการแอร์ที่ข้อมูลไม่ครบ ──

// Alias: refreshMachineList → renderMachines (called from app-core and liff-auth with typeof guard)
window.refreshMachineList = function() { if (typeof renderMachines === 'function') renderMachines(); };
