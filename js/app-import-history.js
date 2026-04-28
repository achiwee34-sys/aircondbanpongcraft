// ── Import ประวัติการซ่อม จาก Excel ──────────────────────────────────────────
// js/app-import-history.js
// เขียน imported tickets ตรงไป Firestore archive (appdata/tickets_archive/items)
// เพื่อไม่ให้ติด 1MB limit ของ appdata/main

(function () {
  'use strict';

  let _xlData    = [];
  let _xlHeaders = [];
  let _preview   = [];

  // ── helpers ────────────────────────────────────────────────────────────────

  function parseThaiDate(raw) {
    if (!raw) return '';
    const s = String(raw).trim();
    if (/^\d{5,}$/.test(s)) {
      try {
        const d = XLSX.SSF.parse_date_code(Number(s));
        if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
      } catch(e) {}
    }
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      let y = parseInt(m[3]);
      if (y > 2400) y -= 543;
      return `${y}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    return s;
  }

  function mapStatus(raw) {
    const s = String(raw || '').trim();
    if (['เสร็จ','done','closed','verified'].includes(s)) return 'done';
    if (['ไม่เสร็จ','inprogress'].includes(s)) return 'inprogress';
    if (['รออะไหล่','waiting_part'].includes(s)) return 'waiting_part';
    return 'done';
  }

  function findMachineId(airCode, machineName) {
    if (!window.db || !window.db.machines) return null;
    const code = String(airCode || '').trim().toLowerCase();
    const name  = String(machineName || '').trim().toLowerCase();
    if (code) {
      const m = window.db.machines.find(m =>
        String(m.serial||'').trim().toLowerCase() === code ||
        String(m.id||'').trim().toLowerCase() === code
      );
      if (m) return m.id;
    }
    if (name) {
      const m = window.db.machines.find(m =>
        String(m.name||'').trim().toLowerCase() === name
      );
      if (m) return m.id;
    }
    return null;
  }

  // ── sheet open/close ───────────────────────────────────────────────────────

  window.openImportHistorySheet  = () => { resetState(); if (typeof openSheet  === 'function') openSheet('import-history'); };
  window.closeImportHistorySheet = () => { if (typeof closeSheet === 'function') closeSheet('import-history'); resetState(); };

  function resetState() {
    _xlData = []; _xlHeaders = []; _preview = [];
    const f = document.getElementById('ih-file'); if (f) f.value = '';
    const s = document.getElementById('ih-map-section'); if (s) s.style.display = 'none';
    const p = document.getElementById('ih-preview'); if (p) p.innerHTML = '';
    const c = document.getElementById('ih-count'); if (c) c.textContent = '';
    const b = document.getElementById('ih-import-btn'); if (b) b.style.display = 'none';
    setProgress('');
  }

  function setProgress(msg) {
    const el = document.getElementById('ih-progress');
    if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
  }

  // ── read excel ─────────────────────────────────────────────────────────────

  window.readHistoryExcel = function (input) {
    const file = input.files[0]; if (!file) return;
    const wait = () => {
      if (typeof XLSX === 'undefined') { setTimeout(wait, 200); return; }
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: false });
          const sheetName = wb.SheetNames.find(n => n.includes('ประวัติ')) || wb.SheetNames[0];
          const ws = wb.Sheets[sheetName];
          _xlData    = XLSX.utils.sheet_to_json(ws, { defval: '' });
          _xlHeaders = _xlData.length > 0 ? Object.keys(_xlData[0]) : [];
          _preview   = _xlData.slice(0, 5);

          const s = document.getElementById('ih-map-section'); if (s) s.style.display = 'block';
          const c = document.getElementById('ih-count');
          if (c) c.textContent = `พบ ${_xlData.length.toLocaleString()} แถว (Sheet: ${sheetName})`;

          renderColMap();
          renderPreview();

          const b = document.getElementById('ih-import-btn'); if (b) b.style.display = '';
        } catch (err) {
          if (typeof showToast === 'function') showToast('❌ อ่านไฟล์ไม่ได้: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    };
    wait();
  };

  // ── column mapping ─────────────────────────────────────────────────────────

  const FIELDS = [
    { key:'ticketId',    label:'เลขที่ใบงาน'        },
    { key:'airCode',     label:'รหัส Air'            },
    { key:'machineName', label:'ชื่อเครื่อง'         },
    { key:'dept',        label:'แผนก/พื้นที่'        },
    { key:'reportDate',  label:'วันที่แจ้ง ★'        },
    { key:'problem',     label:'ปัญหา ★'             },
    { key:'reporter',    label:'ผู้แจ้ง'             },
    { key:'assignee',    label:'ช่าง'                },
    { key:'status',      label:'สถานะ'               },
    { key:'summary',     label:'สรุปการซ่อม'         },
    { key:'parts',       label:'อะไหล่ที่ใช้'        },
    { key:'repairHours', label:'เวลาที่ใช้ (ชม.)'    },
    { key:'repairCost',  label:'ค่าใช้จ่าย (บาท)'   },
    { key:'repairResult',label:'ผลการซ่อม'           },
    { key:'followup',    label:'ต้องติดตาม'          },
  ];

  const HINTS = {
    ticketId:    ['ใบงาน','ticket','เลขที่'],
    airCode:     ['รหัส','air','serial','code'],
    machineName: ['ชื่อเครื่อง','machine','name'],
    dept:        ['แผนก','dept','พื้นที่'],
    reportDate:  ['วันที่','date','แจ้ง'],
    problem:     ['ปัญหา','problem','อาการ'],
    reporter:    ['ผู้แจ้ง','reporter'],
    assignee:    ['ช่าง','assignee','tech'],
    status:      ['สถานะ','status'],
    summary:     ['สรุป','summary'],
    parts:       ['อะไหล่','part','spare'],
    repairHours: ['เวลา','hour','ชม'],
    repairCost:  ['ค่าใช้จ่าย','cost','บาท'],
    repairResult:['ผล','result'],
    followup:    ['ติดตาม','follow'],
  };

  function autoMatch(key) {
    return _xlHeaders.find(h => (HINTS[key]||[]).some(hint => h.toLowerCase().includes(hint))) || '';
  }

  function renderColMap() {
    const el = document.getElementById('ih-col-map'); if (!el) return;
    el.innerHTML = FIELDS.map(f => {
      const auto = autoMatch(f.key);
      const opts = _xlHeaders.map(h =>
        `<option value="${h}"${h===auto?' selected':''}>${h}</option>`
      ).join('');
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
        <label style="width:130px;font-size:0.71rem;font-weight:700;flex-shrink:0">${f.label}</label>
        <select id="ihmap-${f.key}" style="flex:1;padding:5px 7px;border:1.5px solid var(--border,#e2e8f0);border-radius:8px;font-size:0.71rem;font-family:inherit">
          <option value="">(ไม่นำเข้า)</option>${opts}
        </select></div>`;
    }).join('');
  }

  function renderPreview() {
    const el = document.getElementById('ih-preview'); if (!el||!_preview.length) return;
    const cols = _xlHeaders.slice(0, 6);
    el.innerHTML = `<div style="font-size:0.68rem;font-weight:700;color:var(--muted,#64748b);margin-bottom:4px">ตัวอย่าง 5 แถวแรก</div>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.63rem">
        <thead><tr>${cols.map(c=>`<th style="padding:3px 5px;background:#f8fafc;border:1px solid #e2e8f0;white-space:nowrap">${c}</th>`).join('')}</tr></thead>
        <tbody>${_preview.map(r=>`<tr>${cols.map(c=>`<td style="padding:2px 5px;border:1px solid #e2e8f0;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${String(r[c]||'').substring(0,35)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
  }

  // ── IMPORT (เขียนตรง Firestore archive ทีละ batch) ────────────────────────

  window.executeImportHistory = async function () {
    if (!_xlData.length) return;
    if (!window.db) { showToast && showToast('❌ ไม่พบ db'); return; }

    const FSdb = window.FSdb;
    const useFirestore = !!(FSdb);

    const gc = k => { const el = document.getElementById('ihmap-'+k); return el ? el.value : ''; };
    const nowISO = typeof nowStr === 'function' ? nowStr() : new Date().toISOString();

    // ── build ticket objects ──
    const tickets = [];
    const existingIds = new Set((db.tickets||[]).map(t=>t.id));

    _xlData.forEach((row, idx) => {
      const ticketIdRaw  = gc('ticketId')    ? String(row[gc('ticketId')]    ||'').trim() : '';
      const airCode      = gc('airCode')     ? String(row[gc('airCode')]     ||'').trim() : '';
      const machineName  = gc('machineName') ? String(row[gc('machineName')] ||'').trim() : '';
      const dept         = gc('dept')        ? String(row[gc('dept')]        ||'').trim() : '';
      const reportDateRaw= gc('reportDate')  ? row[gc('reportDate')] : '';
      const problem      = gc('problem')     ? String(row[gc('problem')]     ||'').trim() : 'ประวัติการซ่อม';
      const reporter     = gc('reporter')    ? String(row[gc('reporter')]    ||'').trim() : '';
      const assignee     = gc('assignee')    ? String(row[gc('assignee')]    ||'').trim() : '';
      const statusRaw    = gc('status')      ? String(row[gc('status')]      ||'').trim() : 'เสร็จ';
      const summary      = gc('summary')     ? String(row[gc('summary')]     ||'').trim() : '';
      const parts        = gc('parts')       ? String(row[gc('parts')]       ||'').trim() : '';
      const repairHours  = gc('repairHours') ? String(row[gc('repairHours')] ||'').trim() : '';
      const repairCost   = gc('repairCost')  ? parseFloat(row[gc('repairCost')]||0)||0 : 0;
      const repairResult = gc('repairResult')? String(row[gc('repairResult')]||'').trim() : '';
      const followup     = gc('followup')    ? String(row[gc('followup')]    ||'').trim() : '';

      if (!problem && !machineName && !airCode) return;

      const tid = ticketIdRaw || ('IMP' + String(Date.now()).slice(-8) + String(idx).padStart(4,'0'));
      if (existingIds.has(tid)) return;
      existingIds.add(tid);

      const machineId = findMachineId(airCode, machineName);
      const macObj    = machineId ? (db.machines||[]).find(m=>m.id===machineId) : null;
      const reportDate = parseThaiDate(reportDateRaw);
      const createdAt  = reportDate ? reportDate + 'T00:00:00.000Z' : nowISO;

      tickets.push({
        id: tid,
        machineId:    machineId || null,
        machine:      machineName || (macObj ? macObj.name : ''),
        problem:      problem || 'ประวัติการซ่อม',
        detail:       summary,
        summary,
        parts,
        repairItems:  parts ? parts.split(/[,|،\n]/).map(s=>s.trim()).filter(Boolean) : [],
        repairHours,
        repairCost,
        cost:         repairCost,
        repairResult,
        followup,
        priority:     'mid',
        status:       mapStatus(statusRaw),
        reporter:     reporter || 'นำเข้าข้อมูล',
        reporterId:   null,
        reporterDept: dept,
        assignee:     assignee || null,
        assigneeId:   null,
        createdAt,
        updatedAt:    createdAt,
        note:         '',
        contact:      '',
        photosBefore: [],
        photosAfter:  [],
        _imported:    true,
        history: [
          { act:'📥 นำเข้าข้อมูลจาก Excel', by:'ระบบ', at: nowISO },
        ],
      });
    });

    if (!tickets.length) {
      showToast && showToast('⚠️ ไม่มีข้อมูลใหม่ (อาจซ้ำทั้งหมด)');
      return;
    }

    // ── disable btn ──
    const btn = document.getElementById('ih-import-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังนำเข้า...'; }

    let added = 0, failed = 0;
    const noMachine = tickets.filter(t=>!t.machineId).length;

    if (useFirestore) {
      // ── เขียนตรง Firestore archive ทีละ batch (max 500/batch) ──
      const BATCH_SIZE = 400;
      const archRef = FSdb.collection('appdata').doc('tickets_archive').collection('items');
      const total = tickets.length;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const chunk = tickets.slice(i, i + BATCH_SIZE);
        setProgress(`⏳ กำลังบันทึก ${Math.min(i+BATCH_SIZE, total).toLocaleString()} / ${total.toLocaleString()} รายการ...`);
        try {
          const batch = FSdb.batch();
          chunk.forEach(t => batch.set(archRef.doc(t.id), t));
          await batch.commit();
          added += chunk.length;
        } catch (e) {
          console.warn('[ImportHistory] batch error:', e);
          failed += chunk.length;
        }
      }

      // ── ตั้ง flag _hasArchive ใน main doc ──
      if (added > 0) {
        try {
          await FSdb.collection('appdata').doc('main').update({ _hasArchive: true });
          db._hasArchive = true;
          db._archiveLoaded = false; // force reload เมื่อ user กด filter done
        } catch(e) { console.warn('[ImportHistory] update _hasArchive failed:', e); }
      }

      // ── เพิ่ม tickets เข้า local db.tickets ด้วย (สำหรับหน้าปัจจุบัน) ──
      const localIds = new Set((db.tickets||[]).map(t=>t.id));
      tickets.forEach(t => { if (!localIds.has(t.id)) { db.tickets.push(t); localIds.add(t.id); } });

    } else {
      // ── fallback: ถ้า Firestore ยังไม่พร้อม → เพิ่มใน local + saveDB ──
      const localIds = new Set((db.tickets||[]).map(t=>t.id));
      tickets.forEach(t => { if (!localIds.has(t.id)) { db.tickets.push(t); localIds.add(t.id); } });
      if (typeof saveDB === 'function') saveDB();
      added = tickets.length;
      showToast && showToast('⚠️ Firestore ยังไม่พร้อม — บันทึกใน local เท่านั้น');
    }

    setProgress('');
    if (btn) { btn.disabled = false; btn.textContent = '✅ นำเข้าประวัติการซ่อม'; }

    if (typeof renderTickets  === 'function') renderTickets();
    if (typeof renderMachines === 'function') renderMachines();

    window.closeImportHistorySheet();

    const lines = [
      `✅ นำเข้าสำเร็จ ${added.toLocaleString()} รายการ (บันทึกใน Firestore Archive)`,
      noMachine > 0 ? `⚠️ จับคู่เครื่องไม่ได้ ${noMachine} รายการ (บันทึกไว้แต่ไม่ผูกเครื่อง)` : '',
      failed > 0    ? `❌ บันทึกไม่สำเร็จ ${failed} รายการ` : '',
      added > 0 ? 'ข้อมูลจะปรากฏเมื่อกด "งานปิดแล้ว" ในหน้า Tickets' : '',
    ].filter(Boolean);

    showToast && showToast(lines[0]);
    setTimeout(() => alert(lines.join('\n')), 400);
  };

})();
// ── ลบเฉพาะ tickets ที่ Import มา (_imported: true) ──────────────────────────

window.deleteAllArchiveTickets = async function () {
  const confirmed = confirm(
    '⚠️ ยืนยันลบประวัติการซ่อมที่ Import มาทั้งหมด?\n\n' +
    'จะลบเฉพาะรายการที่มี _imported: true เท่านั้น\n' +
    'งานที่สร้างในระบบปกติจะไม่ถูกลบ\n\n' +
    'กด OK เพื่อยืนยัน'
  );
  if (!confirmed) return;

  const FSdb = window.FSdb;
  if (!FSdb) { alert('❌ ไม่สามารถเชื่อมต่อ Firestore ได้'); return; }

  const btn = document.getElementById('del-archive-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังลบ...'; }

  try {
    let totalDeleted = 0;
    const archRef = FSdb.collection('appdata').doc('tickets_archive').collection('items');

    // ── 1. ลบใน tickets_archive ที่มี _imported: true ──
    let snap;
    do {
      snap = await archRef.where('_imported', '==', true).limit(400).get();
      if (snap.empty) break;

      const batch = FSdb.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      totalDeleted += snap.docs.length;

      if (btn) btn.textContent = `⏳ ลบแล้ว ${totalDeleted.toLocaleString()} รายการ...`;
    } while (!snap.empty);

    // ── 2. ตรวจว่า archive ยังมีของเหลืออยู่ไหม ──
    const remaining = await archRef.limit(1).get();
    const hasArchiveLeft = !remaining.empty;

    // ── 3. อัปเดต flag _hasArchive ──
    try {
      await FSdb.collection('appdata').doc('main').update({ _hasArchive: hasArchiveLeft });
      if (window.db) {
        window.db._hasArchive = hasArchiveLeft;
        window.db._archiveLoaded = false;
        if (window.db.tickets) {
          window.db.tickets = window.db.tickets.filter(t => !t._imported);
        }
      }
    } catch(e) { console.warn('[DeleteImported] update flag failed:', e); }

    // ── 4. ลบใน main tickets ด้วย (fallback case) ──
    if (window.db && window.db.tickets) {
      const before = window.db.tickets.length;
      window.db.tickets = window.db.tickets.filter(t => !t._imported);
      if (window.db.tickets.length < before && typeof saveDB === 'function') saveDB();
    }

    if (typeof renderTickets  === 'function') renderTickets();
    if (typeof renderMachines === 'function') renderMachines();

    alert(`✅ ลบสำเร็จ ${totalDeleted.toLocaleString()} รายการที่ Import มาแล้ว`);

  } catch (e) {
    console.error('[DeleteImported] error:', e);
    alert('❌ ลบไม่สำเร็จ: ' + (e.message || e));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🗑️ ลบที่ Import มา'; }
  }
};
