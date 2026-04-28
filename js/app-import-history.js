// ── Import ประวัติการซ่อม จาก Excel ──────────────────────────────────────────
// ไฟล์: js/app-import-history.js
// ต้อง include หลัง SheetJS (XLSX) และ app-core.js

(function () {
  'use strict';

  // ────────────────────────────────────────────────────────────────────────────
  // State
  // ────────────────────────────────────────────────────────────────────────────
  let _xlData    = [];   // [{...row}]
  let _xlHeaders = [];   // ['col1','col2',...]
  let _preview   = [];   // ตัวอย่าง 5 แถวแรก

  // ────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────────────

  /** แปลงวันที่ภาษาไทย (dd/mm/พ.ศ.) หรือ ISO → ISO string */
  function parseThaiDate(raw) {
    if (!raw) return '';
    const s = String(raw).trim();
    // Excel serial number
    if (/^\d{5,}$/.test(s)) {
      const d = XLSX.SSF.parse_date_code(Number(s));
      if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    }
    // dd/mm/yyyy (พ.ศ.)
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      let y = parseInt(m[3]);
      if (y > 2400) y -= 543; // แปลง พ.ศ. → ค.ศ.
      return `${y}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    }
    // yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    return s;
  }

  /** แมปสถานะไทย → status key ของแอป */
  function mapStatus(raw) {
    const s = String(raw || '').trim();
    if (s === 'เสร็จ' || s === 'done' || s === 'closed' || s === 'verified') return 'done';
    if (s === 'ไม่เสร็จ' || s === 'inprogress') return 'inprogress';
    if (s === 'รออะไหล่' || s === 'waiting_part') return 'waiting_part';
    return 'done'; // default
  }

  /** สร้าง unique ID สำหรับ ticket */
  function genTicketId(seq) {
    return 'IMP' + Date.now() + String(seq).padStart(4, '0');
  }

  /** หา machineId จาก db.machines โดยใช้ รหัส Air หรือ ชื่อเครื่อง */
  function findMachineId(airCode, machineName) {
    if (!window.db || !window.db.machines) return null;
    const code = String(airCode || '').trim().toLowerCase();
    const name = String(machineName || '').trim().toLowerCase();

    // match by serial (รหัส Air = serial)
    if (code) {
      const bySerial = window.db.machines.find(m =>
        String(m.serial || '').trim().toLowerCase() === code ||
        String(m.id || '').trim().toLowerCase() === code
      );
      if (bySerial) return bySerial.id;
    }
    // match by name
    if (name) {
      const byName = window.db.machines.find(m =>
        String(m.name || '').trim().toLowerCase() === name
      );
      if (byName) return byName.id;
    }
    return null;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Open / Close Sheet
  // ────────────────────────────────────────────────────────────────────────────

  window.openImportHistorySheet = function () {
    resetImportHistory();
    if (typeof openSheet === 'function') openSheet('import-history');
  };

  window.closeImportHistorySheet = function () {
    if (typeof closeSheet === 'function') closeSheet('import-history');
    resetImportHistory();
  };

  function resetImportHistory() {
    _xlData = []; _xlHeaders = []; _preview = [];
    const fileEl = document.getElementById('ih-file');
    if (fileEl) fileEl.value = '';
    const mapEl = document.getElementById('ih-map-section');
    if (mapEl) mapEl.style.display = 'none';
    const previewEl = document.getElementById('ih-preview');
    if (previewEl) previewEl.innerHTML = '';
    const countEl = document.getElementById('ih-count');
    if (countEl) countEl.textContent = '';
    const btnEl = document.getElementById('ih-import-btn');
    if (btnEl) btnEl.style.display = 'none';
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Read Excel
  // ────────────────────────────────────────────────────────────────────────────

  window.readHistoryExcel = function (input) {
    const file = input.files[0];
    if (!file) return;

    const waitXLSX = () => {
      if (typeof XLSX === 'undefined') {
        setTimeout(() => waitXLSX(), 200);
        return;
      }
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: false });
          // พยายามหา sheet ชื่อ "ประวัติการซ่อม" ก่อน ถ้าไม่มีใช้ sheet แรก
          let sheetName = wb.SheetNames.find(n => n.includes('ประวัติ')) || wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          _xlData = XLSX.utils.sheet_to_json(ws, { defval: '' });
          _xlHeaders = _xlData.length > 0 ? Object.keys(_xlData[0]) : [];
          _preview = _xlData.slice(0, 5);

          const mapEl = document.getElementById('ih-map-section');
          if (mapEl) mapEl.style.display = 'block';
          const countEl = document.getElementById('ih-count');
          if (countEl) countEl.textContent = `พบ ${_xlData.length.toLocaleString()} แถว (Sheet: ${sheetName})`;

          renderHistoryColMap();
          renderHistoryPreview();

          const btnEl = document.getElementById('ih-import-btn');
          if (btnEl) btnEl.style.display = '';
        } catch (err) {
          if (typeof showToast === 'function') showToast('❌ อ่านไฟล์ไม่ได้: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    };
    waitXLSX();
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Column Mapping UI
  // ────────────────────────────────────────────────────────────────────────────

  const FIELDS = [
    { key: 'ticketId',     label: 'เลขที่ใบงาน',         hint: 'id ของ ticket (เว้นว่างได้)',  required: false },
    { key: 'airCode',      label: 'รหัส Air',             hint: 'ใช้จับคู่เครื่อง (serial)',    required: false },
    { key: 'machineName',  label: 'ชื่อเครื่อง',          hint: 'ถ้าไม่มีรหัส ใช้ชื่อแทน',    required: false },
    { key: 'dept',         label: 'แผนก/พื้นที่',         hint: '',                              required: false },
    { key: 'reportDate',   label: 'วันที่แจ้ง *',         hint: 'dd/mm/พ.ศ. หรือ yyyy-mm-dd',  required: true  },
    { key: 'problem',      label: 'ปัญหา *',              hint: '',                              required: true  },
    { key: 'reporter',     label: 'ผู้แจ้ง',              hint: '',                              required: false },
    { key: 'assignee',     label: 'ช่าง',                 hint: '',                              required: false },
    { key: 'status',       label: 'สถานะ',                hint: 'เสร็จ / ไม่เสร็จ / รออะไหล่', required: false },
    { key: 'summary',      label: 'สรุปการซ่อม',          hint: '',                              required: false },
    { key: 'parts',        label: 'อะไหล่ที่ใช้',         hint: '',                              required: false },
    { key: 'repairHours',  label: 'เวลาที่ใช้ (ชม.)',     hint: '',                              required: false },
    { key: 'repairCost',   label: 'ค่าใช้จ่าย (บาท)',     hint: '',                              required: false },
    { key: 'repairResult', label: 'ผลการซ่อม',            hint: '',                              required: false },
    { key: 'followup',     label: 'ต้องติดตาม',           hint: '',                              required: false },
  ];

  // keyword hints เพื่อ auto-select
  const AUTO_HINTS = {
    ticketId:     ['ใบงาน','ticket','เลขที่','id'],
    airCode:      ['รหัส','air','serial','code'],
    machineName:  ['ชื่อเครื่อง','machine','name','เครื่อง'],
    dept:         ['แผนก','dept','area','พื้นที่'],
    reportDate:   ['วันที่','date','แจ้ง'],
    problem:      ['ปัญหา','problem','อาการ'],
    reporter:     ['ผู้แจ้ง','reporter','แจ้ง'],
    assignee:     ['ช่าง','assignee','tech'],
    status:       ['สถานะ','status'],
    summary:      ['สรุป','summary','repair'],
    parts:        ['อะไหล่','part','spare'],
    repairHours:  ['เวลา','hour','ชม'],
    repairCost:   ['ค่าใช้จ่าย','cost','บาท'],
    repairResult: ['ผล','result'],
    followup:     ['ติดตาม','follow'],
  };

  function autoMatch(fieldKey) {
    const hints = AUTO_HINTS[fieldKey] || [];
    return _xlHeaders.find(h => hints.some(hint => h.toLowerCase().includes(hint))) || '';
  }

  function renderHistoryColMap() {
    const el = document.getElementById('ih-col-map');
    if (!el) return;
    el.innerHTML = FIELDS.map(f => {
      const auto = autoMatch(f.key);
      const opts = _xlHeaders.map(h =>
        `<option value="${h}"${h === auto ? ' selected' : ''}>${h}</option>`
      ).join('');
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <label style="width:130px;font-size:0.72rem;font-weight:700;flex-shrink:0">
          ${f.label}${f.required ? '' : ''}
        </label>
        <select id="ihmap-${f.key}" style="flex:1;padding:5px 8px;border:1.5px solid var(--border,#e2e8f0);border-radius:8px;font-size:0.72rem;font-family:inherit">
          <option value="">(ไม่นำเข้า)</option>
          ${opts}
        </select>
      </div>`;
    }).join('');
  }

  function renderHistoryPreview() {
    const el = document.getElementById('ih-preview');
    if (!el || !_preview.length) return;
    const cols = _xlHeaders.slice(0, 6);
    el.innerHTML = `
      <div style="font-size:0.7rem;font-weight:700;color:var(--muted,#64748b);margin-bottom:4px">ตัวอย่างข้อมูล (5 แถวแรก)</div>
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
        <table style="width:100%;border-collapse:collapse;font-size:0.65rem">
          <thead>
            <tr>${cols.map(c => `<th style="padding:4px 6px;background:#f8fafc;border:1px solid #e2e8f0;text-align:left;white-space:nowrap">${c}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${_preview.map(r => `<tr>${cols.map(c => `<td style="padding:3px 6px;border:1px solid #e2e8f0;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r[c] !== undefined ? String(r[c]).substring(0,40) : ''}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Execute Import
  // ────────────────────────────────────────────────────────────────────────────

  window.executeImportHistory = function () {
    if (!_xlData.length) return;
    if (!window.db) { if (typeof showToast === 'function') showToast('❌ ไม่พบ db'); return; }

    const gc = k => {
      const el = document.getElementById('ihmap-' + k);
      return el ? el.value : '';
    };

    let added = 0, skipped = 0, noMachine = 0;
    const nowISO = typeof nowStr === 'function' ? nowStr() : new Date().toISOString();

    _xlData.forEach((row, idx) => {
      // ── field values ──
      const ticketIdRaw  = gc('ticketId')  ? String(row[gc('ticketId')]  || '').trim() : '';
      const airCode      = gc('airCode')   ? String(row[gc('airCode')]   || '').trim() : '';
      const machineName  = gc('machineName')? String(row[gc('machineName')]|| '').trim() : '';
      const dept         = gc('dept')      ? String(row[gc('dept')]      || '').trim() : '';
      const reportDateRaw= gc('reportDate')? row[gc('reportDate')] : '';
      const problem      = gc('problem')   ? String(row[gc('problem')]   || '').trim() : 'ประวัติการซ่อม';
      const reporter     = gc('reporter')  ? String(row[gc('reporter')]  || '').trim() : '';
      const assignee     = gc('assignee')  ? String(row[gc('assignee')]  || '').trim() : '';
      const statusRaw    = gc('status')    ? String(row[gc('status')]    || '').trim() : 'เสร็จ';
      const summary      = gc('summary')   ? String(row[gc('summary')]   || '').trim() : '';
      const parts        = gc('parts')     ? String(row[gc('parts')]     || '').trim() : '';
      const repairHours  = gc('repairHours')? String(row[gc('repairHours')]|| '').trim() : '';
      const repairCost   = gc('repairCost') ? parseFloat(row[gc('repairCost')] || 0) || 0 : 0;
      const repairResult = gc('repairResult')? String(row[gc('repairResult')]|| '').trim() : '';
      const followup     = gc('followup')  ? String(row[gc('followup')]  || '').trim() : '';

      // ── skip ถ้าไม่มีข้อมูล ──
      if (!problem && !machineName && !airCode) { skipped++; return; }

      // ── หา machineId ──
      const machineId = findMachineId(airCode, machineName);
      if (!machineId) noMachine++;

      // ── parse date ──
      const reportDate = parseThaiDate(reportDateRaw);
      const createdAt  = reportDate ? reportDate + 'T00:00:00.000Z' : nowISO;

      // ── ตรวจ duplicate: เลขที่ใบงานซ้ำ ──
      if (ticketIdRaw && (db.tickets || []).find(t => t.id === ticketIdRaw)) {
        skipped++;
        return;
      }

      const tid = ticketIdRaw || genTicketId(idx);
      const status = mapStatus(statusRaw);

      const ticket = {
        id:           tid,
        machineId:    machineId || null,
        machine:      machineName || (machineId ? (db.machines.find(m=>m.id===machineId)||{}).name||'' : ''),
        problem:      problem || 'ประวัติการซ่อม',
        detail:       summary,
        summary:      summary,
        parts:        parts,
        repairItems:  parts ? parts.split(/[,|,\n]/).map(s=>s.trim()).filter(Boolean) : [],
        repairHours:  repairHours,
        repairCost:   repairCost,
        cost:         repairCost,
        repairResult: repairResult,
        followup:     followup,
        priority:     'mid',
        status:       status,
        reporter:     reporter || 'นำเข้าข้อมูล',
        reporterId:   null,
        reporterDept: dept,
        assignee:     assignee || null,
        assigneeId:   null,
        createdAt:    createdAt,
        updatedAt:    createdAt,
        note:         '',
        contact:      '',
        photosBefore: [],
        photosAfter:  [],
        _imported:    true,
        history: [
          { act: '📥 นำเข้าข้อมูลจาก Excel', by: 'ระบบ', at: nowISO },
          ...(status === 'done' ? [{ act: '✅ เสร็จสิ้น', by: assignee || 'ระบบ', at: createdAt }] : []),
        ],
      };

      if (!db.tickets) db.tickets = [];
      db.tickets.push(ticket);
      added++;
    });

    if (added > 0) {
      if (typeof saveDB === 'function') saveDB();
      if (typeof renderTickets === 'function') renderTickets();
      if (typeof renderMachines === 'function') renderMachines();
    }

    window.closeImportHistorySheet();

    const msg = [
      `✅ นำเข้าสำเร็จ ${added.toLocaleString()} รายการ`,
      noMachine > 0 ? `⚠️ จับคู่เครื่องไม่ได้ ${noMachine} รายการ (บันทึกไว้แต่ไม่มี machineId)` : '',
      skipped > 0 ? `ข้ามซ้ำ/ว่าง ${skipped} แถว` : '',
    ].filter(Boolean).join('\n');

    if (typeof showToast === 'function') showToast(msg.split('\n')[0]);
    if (added > 0 || noMachine > 0) {
      setTimeout(() => alert(msg), 400);
    }
  };

})();
