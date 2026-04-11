// ============================================================
// BACKEND MONITOR — admin only
// ============================================================

const BK_LOG_KEY   = 'aircon_bk_log';
const BK_AUDIT_KEY = 'aircon_bk_audit';
const BK_RULES_KEY = 'aircon_bk_rules';
const BK_STATS_KEY = 'aircon_bk_stats';

const DEFAULT_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /aircon_data/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}`;

// ── Counters (in-memory, session only) ──────────────────────
window._bkReads  = 0;
window._bkWrites = 0;

// ── Log helpers ─────────────────────────────────────────────
function _bkGetLog()   { try { return JSON.parse(localStorage.getItem(BK_LOG_KEY)   || '[]'); } catch(e){ return []; } }
function _bkGetAudit() { try { return JSON.parse(localStorage.getItem(BK_AUDIT_KEY) || '[]'); } catch(e){ return []; } }

function bkLog(type, msg, detail) {
  const log = _bkGetLog();
  log.unshift({ ts: new Date().toISOString(), type, msg, detail: detail||'', user: window.CU?.name||'—' });
  if (log.length > 300) log.length = 300;
  localStorage.setItem(BK_LOG_KEY, JSON.stringify(log));
}

function bkAudit(action, target, before, after) {
  const audit = _bkGetAudit();
  audit.unshift({
    ts: new Date().toISOString(),
    user: window.CU?.name || '—',
    role: window.CU?.role || '—',
    action, target,
    before: before ? JSON.stringify(before).slice(0, 200) : '—',
    after:  after  ? JSON.stringify(after).slice(0, 200)  : '—',
  });
  if (audit.length > 500) audit.length = 500;
  localStorage.setItem(BK_AUDIT_KEY, JSON.stringify(audit));
}

// expose globally for other modules
window.bkLog   = bkLog;
window.bkAudit = bkAudit;

// ── Error capture ────────────────────────────────────────────
const _bkErrors = [];
const _origError = window.onerror;
window.onerror = function(msg, src, line, col, err) {
  _bkErrors.unshift({ ts: new Date().toISOString(), msg: String(msg), src: (src||'').split('/').pop()+':'+line });
  if (_bkErrors.length > 50) _bkErrors.length = 50;
  bkLog('error', String(msg).slice(0, 120), (src||'').split('/').pop()+':'+line);
  if (_origError) return _origError(msg, src, line, col, err);
};
const _origUnhandled = window.onunhandledrejection;
window.onunhandledrejection = function(e) {
  const msg = e?.reason?.message || String(e?.reason) || 'Unhandled rejection';
  _bkErrors.unshift({ ts: new Date().toISOString(), msg: msg.slice(0,120), src: 'promise' });
  if (_bkErrors.length > 50) _bkErrors.length = 50;
  bkLog('error', msg.slice(0,120), 'promise');
  if (_origUnhandled) return _origUnhandled(e);
};

// ── Panel show/hide (called from settings render) ────────────
function showBackendPanel() {
  const el = document.getElementById('sp-backend-panel');
  if (el) { el.style.display = 'block'; refreshBackendPanel(); }
}

// ── Tab switching ────────────────────────────────────────────
let _bkCurrentTab = 'status';
let _bkLogFilter  = 'all';

function switchBkTab(tab) {
  _bkCurrentTab = tab;
  ['status','stats','log','audit','rules'].forEach(t => {
    const pane = document.getElementById('bk-pane-'+t);
    const btn  = document.getElementById('bk-tab-'+t);
    if (pane) pane.style.display = t === tab ? 'block' : 'none';
    if (btn) {
      btn.style.color       = t === tab ? '#1d4ed8' : '#94a3b8';
      btn.style.fontWeight  = t === tab ? '800' : '700';
      btn.style.borderBottom = t === tab ? '2px solid #1d4ed8' : '2px solid transparent';
    }
  });
  if (tab === 'status') renderBkStatus();
  if (tab === 'stats')  renderBkStats();
  if (tab === 'log')    renderBkLog();
  if (tab === 'audit')  renderBkAudit();
  if (tab === 'rules')  renderBkRules();
}

// ── Main refresh ─────────────────────────────────────────────
function refreshBackendPanel() {
  checkBkConnection();
  switchBkTab(_bkCurrentTab);
}

// ── STATUS tab ───────────────────────────────────────────────
function checkBkConnection() {
  const dot  = document.getElementById('bk-dot-fs');
  const ping = document.getElementById('bk-fs-ping');
  const badge = document.getElementById('bk-conn-badge');
  const dotAuth = document.getElementById('bk-dot-auth');
  const authUser = document.getElementById('bk-auth-user');

  // Auth status
  if (window.firebaseAuth?.currentUser) {
    if (dotAuth) dotAuth.style.background = '#22c55e';
    if (authUser) authUser.textContent = window.firebaseAuth.currentUser.email || 'Signed in';
  } else {
    if (dotAuth) dotAuth.style.background = '#f59e0b';
    if (authUser) authUser.textContent = 'Anonymous / Guest';
  }

  // Firestore ping — try a quick read
  if (window.db_fs && window.firebase) {
    const t0 = Date.now();
    try {
      // ping by reading the main doc
      const colRef = window.db_fs;
      if (dot) dot.style.background = '#f59e0b'; // pending
      if (ping) ping.textContent = 'กำลังตรวจสอบ...';
      // Ping appdata/main (collection จริงที่ใช้งาน)
      firebase.firestore().collection('appdata').doc('main').get().then(() => {
        const ms = Date.now() - t0;
        if (dot)  dot.style.background = '#22c55e';
        if (ping) ping.textContent = ms + ' ms';
        if (badge) { badge.textContent = '🟢 เชื่อมต่อแล้ว · ' + ms + 'ms'; badge.style.color = '#4ade80'; }
        window._bkReads++;
      }).catch(e => {
        if (dot)  dot.style.background = '#ef4444';
        if (ping) ping.textContent = 'Error';
        if (badge) { badge.textContent = '🔴 เชื่อมต่อไม่ได้'; badge.style.color = '#f87171'; }
      });
    } catch(e) {
      if (dot)  dot.style.background = '#ef4444';
      if (ping) ping.textContent = 'ไม่พร้อม';
    }
  } else {
    if (dot)  dot.style.background = '#f59e0b';
    if (ping) ping.textContent = 'Offline / LocalDB';
    if (badge) { badge.textContent = '🟡 ทำงานแบบ Local'; badge.style.color = 'rgba(255,255,255,0.6)'; }
  }
}

function renderBkStatus() {
  checkBkConnection();

  // listeners
  const listEl = document.getElementById('bk-listeners');
  if (listEl) {
    const listeners = [
      { name: 'appdata/main (onSnapshot)',  active: !!(window._fsListener) },
      { name: 'Auth state',                 active: !!(window.firebaseAuth) },
      { name: 'Auto backup interval',       active: !!(window._autoBackupInterval) },
    ];
    listEl.innerHTML = listeners.map(l =>
      `<div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:0.65rem">${l.active ? '🟢' : '⚪'}</span>
        <span style="font-size:0.75rem;color:${l.active?'#1e293b':'#94a3b8'}">${l.name}</span>
        <span style="margin-left:auto;font-size:0.62rem;font-weight:700;color:${l.active?'#22c55e':'#94a3b8'}">${l.active?'Active':'Inactive'}</span>
      </div>`
    ).join('');
  }

  // errors
  const errEl = document.getElementById('bk-errors');
  if (errEl) {
    if (_bkErrors.length === 0) {
      errEl.textContent = 'ไม่มี error ✅';
      errEl.style.color = '#22c55e';
    } else {
      errEl.style.color = '#64748b';
      errEl.innerHTML = _bkErrors.map(e =>
        `<div style="border-bottom:1px solid #fee2e2;padding:3px 0">
          <span style="color:#ef4444;font-weight:700">${_fmtTime(e.ts)}</span>
          <span style="color:#64748b"> · ${e.src}</span><br>
          <span style="color:#1e293b">${e.msg}</span>
        </div>`
      ).join('');
    }
  }
}

function clearBkErrors() {
  _bkErrors.length = 0;
  renderBkStatus();
}

// ── STATS tab ────────────────────────────────────────────────
function renderBkStats() {
  // Session counters
  const reads  = document.getElementById('bk-stat-reads');
  const writes = document.getElementById('bk-stat-writes');
  if (reads)  reads.textContent  = window._bkReads  || 0;
  if (writes) writes.textContent = window._bkWrites || 0;

  // Firestore cost estimate (ราคา free tier: 50k reads/day, 20k writes/day)
  const costEl = document.getElementById('bk-stat-cost');
  if (costEl) {
    const rCost = Math.max(0, ((window._bkReads  || 0) - 50000)) * 0.00000006;
    const wCost = Math.max(0, ((window._bkWrites || 0) - 20000)) * 0.00000018;
    const total = (rCost + wCost).toFixed(6);
    costEl.textContent = '$' + total;
    costEl.style.color = parseFloat(total) > 0 ? '#ef4444' : '#22c55e';
  }

  const dbRef = window.db;
  if (!dbRef) return;

  const collections = [
    { name: 'machines',     icon: '❄️', count: (dbRef.machines||[]).length },
    { name: 'tickets',      icon: '🔧', count: (dbRef.tickets||[]).length },
    { name: 'users',        icon: '👤', count: (dbRef.users||[]).length },
    { name: 'vendors',      icon: '🏢', count: (dbRef.vendors||[]).length },
    { name: 'repairGroups', icon: '🛠️', count: (dbRef.repairGroups||[]).length },
    { name: 'calEvents',    icon: '📅', count: (dbRef.calEvents||[]).length },
  ];

  const totalDocs = collections.reduce((s, c) => s + c.count, 0);
  const docsEl = document.getElementById('bk-stat-docs');
  if (docsEl) docsEl.textContent = totalDocs;

  // Estimate size
  const json = JSON.stringify(dbRef);
  const sizeKB = Math.round(json.length / 1024);
  const sizeEl = document.getElementById('bk-stat-size');
  if (sizeEl) sizeEl.textContent = sizeKB >= 1024 ? (sizeKB/1024).toFixed(1)+'MB' : sizeKB+'KB';

  const colEl = document.getElementById('bk-collections');
  if (colEl) {
    colEl.innerHTML = collections.map(c =>
      `<div style="display:flex;align-items:center;gap:8px;padding:2px 0">
        <span>${c.icon}</span>
        <span style="flex:1;font-size:0.75rem;color:#1e293b">${c.name}</span>
        <span style="font-size:0.75rem;font-weight:800;color:#1d4ed8">${c.count}</span>
        <span style="font-size:0.65rem;color:#94a3b8">docs</span>
      </div>`
    ).join('');
  }

  // Tickets by status
  const tickets = dbRef.tickets || [];
  const STATUS_MAP = {
    pending:    { label: 'รอดำเนินการ', color: '#f59e0b' },
    inprogress: { label: 'กำลังซ่อม',   color: '#3b82f6' },
    done:       { label: 'เสร็จแล้ว',   color: '#22c55e' },
    cancelled:  { label: 'ยกเลิก',      color: '#94a3b8' },
  };
  const statusCounts = {};
  tickets.forEach(t => {
    const s = t.status || 'pending';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  const ticketEl = document.getElementById('bk-tickets-status');
  if (ticketEl) {
    if (tickets.length === 0) {
      ticketEl.innerHTML = '<span style="color:#94a3b8;font-size:0.72rem">ไม่มี ticket</span>';
    } else {
      ticketEl.innerHTML = Object.entries(STATUS_MAP).map(([key, {label, color}]) => {
        const cnt = statusCounts[key] || 0;
        const pct = tickets.length ? Math.round(cnt / tickets.length * 100) : 0;
        return `<div style="margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-bottom:2px">
            <span style="color:#1e293b;font-weight:700">${label}</span>
            <span style="color:${color};font-weight:800">${cnt} (${pct}%)</span>
          </div>
          <div style="height:5px;background:#f1f5f9;border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.4s"></div>
          </div>
        </div>`;
      }).join('');
    }
  }
}

// ── LOG tab ──────────────────────────────────────────────────
function filterBkLog(f) {
  _bkLogFilter = f;
  ['all','login','logout','error','sync','photo','assign'].forEach(t => {
    const btn = document.getElementById('bk-log-f-'+t);
    if (btn) {
      btn.style.background = t === f ? '#1d4ed8' : '#f1f5f9';
      btn.style.color      = t === f ? 'white'   : '#475569';
    }
  });
  renderBkLog();
}

function renderBkLog() {
  const el = document.getElementById('bk-log-list');
  if (!el) return;
  let logs = _bkGetLog();
  if (_bkLogFilter !== 'all') logs = logs.filter(l => l.type === _bkLogFilter);
  if (logs.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:0.75rem">ไม่มี log</div>';
    return;
  }
  el.innerHTML = logs.map(l => {
    const typeColor = {
      login:'#22c55e', logout:'#f59e0b', error:'#ef4444',
      info:'#3b82f6', sync:'#7c3aed', photo:'#0891b2', assign:'#ea580c'
    }[l.type] || '#94a3b8';
    const typeIcon  = {
      login:'🔑', logout:'🚪', error:'❌', info:'ℹ️',
      sync:'🔄', photo:'📷', assign:'📌'
    }[l.type] || '•';
    return `<div style="background:#f8fafc;border-radius:8px;padding:8px 10px;border-left:3px solid ${typeColor}">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
        <span style="font-size:0.7rem">${typeIcon}</span>
        <span style="font-size:0.7rem;font-weight:800;color:${typeColor}">${l.type.toUpperCase()}</span>
        <span style="font-size:0.62rem;color:#94a3b8;margin-left:auto">${_fmtTime(l.ts)}</span>
      </div>
      <div style="font-size:0.72rem;color:#1e293b;font-weight:600">${l.msg}</div>
      ${l.user ? `<div style="font-size:0.62rem;color:#64748b">👤 ${l.user}${l.detail?' · '+l.detail:''}</div>` : ''}
    </div>`;
  }).join('');
}

// ── AUDIT tab ────────────────────────────────────────────────
function renderBkAudit() {
  const el = document.getElementById('bk-audit-list');
  if (!el) return;
  const audit = _bkGetAudit();
  if (audit.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;font-size:0.75rem">ไม่มี audit log</div>';
    return;
  }
  el.innerHTML = audit.map(a =>
    `<div style="background:#f8fafc;border-radius:8px;padding:8px 10px;border-left:3px solid #7c3aed">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
        <span style="font-size:0.7rem;font-weight:800;color:#7c3aed">${a.action}</span>
        <span style="font-size:0.62rem;color:#94a3b8;margin-left:auto">${_fmtTime(a.ts)}</span>
      </div>
      <div style="font-size:0.72rem;color:#1e293b;font-weight:600">${a.target}</div>
      <div style="font-size:0.62rem;color:#64748b">👤 ${a.user} (${a.role})</div>
      ${a.before !== '—' ? `<div style="font-size:0.6rem;color:#94a3b8;margin-top:3px;word-break:break-all">Before: ${a.before}</div>` : ''}
    </div>`
  ).join('');
}

function clearBkAudit() {
  localStorage.removeItem(BK_AUDIT_KEY);
  renderBkAudit();
  showToast('🗑️ ล้าง Audit Log แล้ว');
}

// ── RULES tab ────────────────────────────────────────────────
// Rules ที่ deploy จริงใน firestore.rules (embed ตอน build)
const _DEPLOYED_RULES = window._deployedFirestoreRules || DEFAULT_RULES;

function renderBkRules() {
  const ta = document.getElementById('bk-rules-editor');
  if (!ta) return;
  const saved = localStorage.getItem(BK_RULES_KEY);
  ta.value = saved || _DEPLOYED_RULES;
  _renderRulesDiff(ta.value);
}

function _renderRulesDiff(current) {
  const diffEl = document.getElementById('bk-rules-diff');
  if (!diffEl) return;
  const deployed = _DEPLOYED_RULES;
  if (current.trim() === deployed.trim()) {
    diffEl.innerHTML = '<span style="color:#22c55e;font-size:0.7rem;font-weight:700">✅ ตรงกับ Rules ที่ deploy แล้ว</span>';
  } else {
    // แสดง diff แบบ line-by-line
    const aLines = deployed.split('\n');
    const bLines = current.split('\n');
    const maxLen = Math.max(aLines.length, bLines.length);
    let diffHtml = '<div style="font-family:monospace;font-size:0.62rem;line-height:1.6">';
    let changed = 0;
    for (let i = 0; i < maxLen; i++) {
      const a = aLines[i] ?? '';
      const b = bLines[i] ?? '';
      if (a !== b) {
        changed++;
        if (a) diffHtml += `<div style="background:#fee2e2;color:#b91c1c;padding:0 4px">- ${_esc(a)}</div>`;
        if (b) diffHtml += `<div style="background:#dcfce7;color:#15803d;padding:0 4px">+ ${_esc(b)}</div>`;
      }
    }
    diffHtml += '</div>';
    diffEl.innerHTML = `<span style="color:#f59e0b;font-size:0.7rem;font-weight:700">⚠️ มี ${changed} บรรทัดที่เปลี่ยน (ยังไม่ได้ deploy)</span>` + diffHtml;
  }
}

function _esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function saveBkRules() {
  const ta = document.getElementById('bk-rules-editor');
  if (!ta) return;
  localStorage.setItem(BK_RULES_KEY, ta.value);
  _renderRulesDiff(ta.value);
  bkAudit('แก้ไข Firestore Rules', 'firestore.rules', null, { length: ta.value.length });
  showToast('💾 บันทึก Rules แล้ว (กรุณา deploy ใน Firebase Console)');
}

function copyBkRules() {
  const ta = document.getElementById('bk-rules-editor');
  if (!ta) return;
  navigator.clipboard?.writeText(ta.value).then(() => showToast('📋 Copy แล้ว'));
}

function resetBkRules() {
  const ta = document.getElementById('bk-rules-editor');
  if (!ta) return;
  ta.value = _DEPLOYED_RULES;
  localStorage.setItem(BK_RULES_KEY, _DEPLOYED_RULES);
  _renderRulesDiff(_DEPLOYED_RULES);
  showToast('🔄 Reset กลับเป็น Rules ที่ deploy แล้ว');
}

// ── Cache & Sync ─────────────────────────────────────────────
function bkForceSync() {
  if (typeof manualSync === 'function') {
    manualSync();
    window._bkWrites++;
    bkLog('info', 'Force Sync ขึ้น Firestore');
    showToast('⬆️ Force Sync แล้ว');
  }
}

function bkClearCache() {
  // Clear non-essential localStorage keys
  const keep = ['aircon_db', 'aircon_last_backup', BK_LOG_KEY, BK_AUDIT_KEY, BK_RULES_KEY, 'aircon_user'];
  let cleared = 0;
  Object.keys(localStorage).forEach(k => {
    if (!keep.includes(k) && k.startsWith('aircon_')) {
      localStorage.removeItem(k);
      cleared++;
    }
  });
  if (typeof invalidateMacCache === 'function') invalidateMacCache();
  bkLog('info', 'Clear Cache: ' + cleared + ' keys');
  showToast('🗑️ Clear Cache ' + cleared + ' keys แล้ว');
}

// ── Export ───────────────────────────────────────────────────
function exportBkLog(format) {
  const isAudit = format.startsWith('audit');
  const data    = isAudit ? _bkGetAudit() : _bkGetLog();
  const fname   = (isAudit ? 'audit' : 'log') + '-' + new Date().toISOString().slice(0,10);

  if (format.endsWith('json')) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    _bkDownload(blob, fname + '.json');
    return;
  }

  // Excel via SheetJS
  if (typeof XLSX === 'undefined') { waitForXLSX(() => exportBkLog(format)); return; }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isAudit ? 'Audit' : 'Log');
  XLSX.writeFile(wb, fname + '.xlsx');
  showToast('⬇️ Export Excel: ' + fname + '.xlsx');
}

function _bkDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Time formatter ───────────────────────────────────────────
function _fmtTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('th-TH', { day:'2-digit', month:'2-digit' }) + ' ' +
           d.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  } catch(e) { return iso.slice(0,16); }
}

// ── Hook into login/logout for automatic log ─────────────────
(function hookLoginLogout() {
  const _origLogin = window._onLoginSuccess;
  window._onLoginSuccess = function() {
    if (_origLogin) _origLogin();
    setTimeout(() => {
      bkLog('login', 'เข้าสู่ระบบ', window.CU?.username || '');
    }, 500);
  };

  // Hook doLogout
  const _origLogout = window.doLogout;
  window.doLogout = function() {
    bkLog('logout', 'ออกจากระบบ', window.CU?.username || '');
    if (_origLogout) _origLogout();
  };
})();

// ── Backend panel is shown via renderSettingsPage() in app-core.js ──
// (patchGoPageForBackend removed — handled in renderSettingsPage)

// ── Increment read/write counters (call from firebase-init) ──
window.bkCountRead  = function(n) { window._bkReads  = (window._bkReads  || 0) + (n||1); };
window.bkCountWrite = function(n) { window._bkWrites = (window._bkWrites || 0) + (n||1); };

// ============================================================
// ITEM 8: Mobile Keyboard Fix — visualViewport API (ย้ายจาก index.html)
// ============================================================
(function initKeyboardFix() {
  if (!window.visualViewport) return;
  let _kbActive = false;

  function applyKbShift() {
    const vv = window.visualViewport;
    const winH = window.innerHeight;
    const vvH = vv.height + vv.offsetTop;
    const kbH = Math.max(0, winH - vvH);
    const app = document.getElementById('app');
    if (!app) return;
    if (kbH > 80) {
      _kbActive = true;
      app.style.transform = `translateY(-${kbH * 0.5}px)`;
      app.style.transition = 'transform 0.2s ease';
    } else if (_kbActive) {
      _kbActive = false;
      app.style.transform = '';
    }
  }

  window.visualViewport.addEventListener('resize', applyKbShift);
  window.visualViewport.addEventListener('scroll', applyKbShift);
})();

// ============================================================
// Stamp toolbar ย้ายไปอยู่ใน app-stamp.js แล้ว
// ============================================================
