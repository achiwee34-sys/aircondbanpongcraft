// ══════════════════════════════════════════════════════════════
//  line-messaging.js — LINE Messaging API Push Notifications
//  v3.1 | แก้ reporter ส่งไม่ได้ + gsUrl race condition fix
// ══════════════════════════════════════════════════════════════

const LINE_LIFF_URL      = 'https://liff.line.me/2009699254-TXIz4KN1';
// F-13: ลบ hardcode LINE_ADMIN_USER_ID ออก — ใช้ admin list จาก db.users เท่านั้น

// ── helper: ดึง gsUrl จาก db หรือ localStorage ──
function _getGsUrl() {
  // อ่านจาก localStorage ก่อน — มีค่าเสมอแม้ db.gsUrl จะยังไม่โหลด
  try {
    const local = JSON.parse(localStorage.getItem('airtrack_pwa') || '{}');
    if (local.gsUrl) return local.gsUrl;
  } catch(e) {}
  if (typeof db !== 'undefined' && db && db.gsUrl) return db.gsUrl;
  if (window.db && window.db.gsUrl) return window.db.gsUrl;
  return '';
}

// ── ส่งผ่าน GAS proxy (ไม่ถูก CORS block) ────────────────────
async function linePush(lineUserId, messages) {
  if (!lineUserId) return;
  const gsUrl = _getGsUrl();
  if (!gsUrl) {
    console.warn('[LINE Push] ยังไม่ได้ตั้งค่า Google Apps Script URL ใน Settings');
    return;
  }
  try {
    await fetch(gsUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'linePush', to: lineUserId, messages })
    });
    console.info('[LINE Push] sent to', lineUserId);
  } catch (e) {
    console.warn('[LINE Push] error:', e);
  }
}

// ── ส่งหา Admin ทุกคน — ใช้ GAS linePushRole (batch, เร็วกว่า) ──
async function linePushAdmin(messages) {
  const gsUrl = _getGsUrl();
  if (!gsUrl) {
    console.warn('[LINE Push Admin] ❌ ยังไม่ได้ตั้งค่า GAS URL — ไปที่ Settings > Firebase Sync > GAS URL');
    return;
  }

  // รวบ lineUserId ของ admin ทั้งหมดจาก db
  const adminIds = (typeof db !== 'undefined' ? db.users || [] : (window.db ? window.db.users || [] : []))
    .filter(u => u.role === 'admin' && u.lineUserId)
    .map(u => u.lineUserId);

  // F-13: ลบ hardcode fallback userId ออก — ใช้ adminIds จาก db.users เท่านั้น
  // หาก adminIds ว่าง แจ้งเตือนใน console แทนการ fallback หา hardcode id
  if (adminIds.length === 0) {
    console.warn('[LINE Push Admin] ไม่พบ admin ที่มี lineUserId ใน db.users — ไม่ส่ง notification');
    return;
  }
  const targets = [...new Set(adminIds)];

  console.info('[LINE Push Admin] targets:', targets, '| gsUrl:', gsUrl.slice(0,40)+'...');

  try {
    await fetch(gsUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'linePush', to: targets, messages })
    });
    console.info('[LINE Push Admin] ✅ sent to', targets.length, 'admin(s):', targets);
  } catch (e) {
    console.warn('[LINE Push Admin] ❌ error:', e);
  }
}

// ── ส่งหา role ทั้งหมด — ใช้ GAS linePushRole (batch) ────────
async function linePushRole(role, messages) {
  const gsUrl = _getGsUrl();
  if (!gsUrl) return;

  // รวบ lineUserId จาก db ฝั่ง client ก่อน (เร็วกว่าให้ GAS query เอง)
  const userIds = (typeof db !== 'undefined' ? db.users || [] : (window.db ? window.db.users || [] : []))
    .filter(u => u.role === role && u.lineUserId)
    .map(u => u.lineUserId);

  if (userIds.length === 0) {
    // fallback → ให้ GAS ดึงจาก sheet Users เอง (ป้องกัน race condition db.users ยังโหลดไม่ครบ)
    console.info('[LINE Push Role] db.users ว่าง — GAS fallback for role:', role);
    try {
      await fetch(gsUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'linePushRole', role, messages })
      });
      console.info('[LINE Push Role] ✅ GAS fallback sent for role:', role);
    } catch (e) {
      console.warn('[LINE Push Role] GAS fallback error:', e);
    }
    return;
  }

  try {
    await fetch(gsUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'linePush', to: userIds, messages })
    });
    console.info('[LINE Push Role]', role, '— sent to', userIds.length, 'user(s)');
  } catch (e) {
    console.warn('[LINE Push Role] error:', e);
  }
}

// ── สีตาม event ──────────────────────────────────────────────
const EVENT_COLORS = {
  new:      '#c8102e',
  assign:   '#1d4ed8',
  accept:   '#d97706',
  start:    '#7c3aed',
  done:     '#16a34a',
  newUser:  '#0891b2',
  purchase: '#b45309',  // Bug 6: สีสำหรับ event สั่งซื้อ
  record:   '#0f766e'   // Bug 6: สีสำหรับ event บันทึกผล
};

function ticketUrl(tid) {
  return LINE_LIFF_URL + (tid ? '?ticket=' + tid : '');
}

// ── สร้าง Flex Message ─────────────────────────────────────────
function buildFlex(headerColor, headerIcon, headerText, rows, btnLabel, btnUrl) {
  return {
    type: 'flex',
    altText: headerText,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box', layout: 'vertical',
        backgroundColor: headerColor, paddingAll: '14px',
        contents: [{ type: 'text', text: headerIcon + '  ' + headerText,
          color: '#ffffff', weight: 'bold', size: 'md', wrap: true }]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px',
        contents: rows.map(([label, value]) => ({
          type: 'box', layout: 'horizontal', spacing: 'sm',
          contents: [
            { type: 'text', text: label, color: '#888888', size: 'sm', flex: 2 },
            { type: 'text', text: value || '—', color: '#111111', size: 'sm', flex: 5, wrap: true, weight: 'bold' }
          ]
        }))
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px',
        contents: [{
          type: 'button', style: 'primary', color: headerColor, height: 'sm',
          action: { type: 'uri', label: btnLabel, uri: btnUrl }
        }]
      }
    }
  };
}

// ── Main event handler ────────────────────────────────────────
async function lineMessagingEvent(event, t) {
  // ตรวจ GAS URL ก่อนส่งทุกครั้ง
  const gsUrl = _getGsUrl();
  if (!gsUrl) {
    console.warn('[lineMessagingEvent] ยังไม่ได้ตั้งค่า GAS URL — ข้ามการส่ง LINE');
    return;
  }

  const time     = typeof nowStr === 'function' ? nowStr() : new Date().toLocaleString('th-TH');
  const priority = typeof prTH === 'function' ? prTH(t.priority) : (t.priority || '—');

  if (event === 'new') {
    const flex = buildFlex(EVENT_COLORS.new, '🆕', 'งานใหม่เข้าระบบ!',
      [['เลขงาน', t.id], ['ปัญหา', t.problem], ['เครื่อง', t.machine],
       ['ผู้แจ้ง', t.reporter], ['แผนก', t.reporterDept||'—'], ['ความด่วน', priority], ['เวลา', time]],
      '📋 ดูรายละเอียดงาน', ticketUrl(t.id));
    // ส่ง admin + ช่าง พร้อมกันใน request เดียว (batch)
    await linePushAdmin([flex]);
    await linePushRole('tech', [flex]);

  } else if (event === 'assign') {
    const tech = ((typeof db !== 'undefined' ? db.users : window.db?.users) || []).find(u => u.name === t.assignee || u.id === t.assigneeId);
    const flexTech = buildFlex(EVENT_COLORS.assign, '📌', 'งานถูกมอบหมายให้คุณ!',
      [['เลขงาน', t.id], ['ปัญหา', t.problem], ['เครื่อง', t.machine],
       ['ความด่วน', priority], ['เวลา', time]],
      '✅ ดูงานและรับงาน', ticketUrl(t.id));
    const flexAdmin = buildFlex(EVENT_COLORS.assign, '📌', 'มอบหมายงานแล้ว',
      [['เลขงาน', t.id], ['มอบให้', t.assignee || '—'], ['เวลา', time]],
      '📋 ดูงาน', ticketUrl(t.id));
    if (tech?.lineUserId) await linePush(tech.lineUserId, [flexTech]);
    else if (tech) {
      // ช่างไม่มี lineUserId → แจ้ง admin ด้วย Flex พิเศษ
      const warnFlex = buildFlex('#f59e0b', '⚠️', 'ช่างยังไม่ได้ Link LINE',
        [['ช่าง', tech.name || '—'], ['เลขงาน', t.id], ['หมายเหตุ', 'ช่างจะไม่ได้รับ LINE แจ้งเตือน']],
        '👥 จัดการผู้ใช้', ticketUrl(t.id));
      await linePushAdmin([warnFlex]);
      console.warn('[LINE assign] tech has no lineUserId:', tech.name);
    }
    await linePushAdmin([flexAdmin]);

  } else if (event === 'accept') {
    const reporter = ((typeof db !== 'undefined' ? db.users : window.db?.users) || []).find(u => u.name === t.reporter || u.id === t.reporterId);
    const flex = buildFlex(EVENT_COLORS.accept, '✋', 'ช่างรับงานแล้ว',
      [['เลขงาน', t.id], ['ปัญหา', t.problem], ['ช่าง', t.assignee || '—'], ['เวลา', time]],
      '📋 ติดตามงาน', ticketUrl(t.id));
    await linePushAdmin([flex]);
    if (reporter?.lineUserId) await linePush(reporter.lineUserId, [flex]);

  } else if (event === 'start') {
    const flex = buildFlex(EVENT_COLORS.start, '⚙️', 'เริ่มซ่อมแล้ว',
      [['เลขงาน', t.id], ['ปัญหา', t.problem], ['ช่าง', t.assignee || '—'], ['เวลา', time]],
      '📋 ดูความคืบหน้า', ticketUrl(t.id));
    await linePushAdmin([flex]);

  } else if (event === 'done') {
    const reporter = ((typeof db !== 'undefined' ? db.users : window.db?.users) || []).find(u => u.name === t.reporter || u.id === t.reporterId);
    const flex = buildFlex(EVENT_COLORS.done, '✅', 'ซ่อมเสร็จแล้ว!',
      [['เลขงาน', t.id], ['ปัญหา', t.problem], ['เครื่อง', t.machine],
       ['ช่าง', t.assignee || '—'], ['สรุป', t.summary || '—'], ['เวลา', time]],
      '📋 ดูสรุปงาน', ticketUrl(t.id));
    await linePushAdmin([flex]);
    if (reporter?.lineUserId) await linePush(reporter.lineUserId, [flex]);

  } else if (event === 'newUser') {
    const flex = buildFlex(EVENT_COLORS.newUser, '👤', 'ผู้ใช้ใหม่สมัครแล้ว',
      [['ชื่อ', t.name || '—'], ['แผนก', t.dept || '—'],
       ['เบอร์', t.tel || '—'], ['เวลา', time]],
      '👥 จัดการผู้ใช้', LINE_LIFF_URL + '?page=users');
    await linePushAdmin([flex]);

  // ── Bug 6 fix: event สั่งซื้อ (purchase) ────────────────────
  } else if (event === 'purchase') {
    const flex = buildFlex(EVENT_COLORS.purchase, '🛒', 'สั่งซื้ออะไหล่แล้ว (PO)',
      [['เลข PO',   t.poNumber  || '—'],
       ['เลขงาน',   t.ticketId  || '—'],
       ['รายการ',   t.itemName  || '—'],
       ['จำนวน',    t.qty       || '—'],
       ['ผู้สั่ง',  t.orderedBy || '—'],
       ['เวลา',     time]],
      '📋 ดูรายละเอียด PO', ticketUrl(t.ticketId));
    await linePushAdmin([flex]);
    await linePushRole('tech', [flex]);
    await linePushRole('reporter', [flex]);

  // ── Bug 6 fix: event บันทึกผล (record) แจ้ง reporter ────────
  } else if (event === 'record') {
    const reporter = ((typeof db !== 'undefined' ? db.users : window.db?.users) || [])
      .find(u => u.name === t.reporter || u.id === t.reporterId);
    const flex = buildFlex(EVENT_COLORS.record, '📝', 'บันทึกผลการซ่อมแล้ว',
      [['เลขงาน',  t.id          || '—'],
       ['ปัญหา',   t.problem     || '—'],
       ['เครื่อง', t.machine     || '—'],
       ['ช่าง',    t.assignee    || '—'],
       ['ผลการซ่อม', t.result    || '—'],
       ['เวลา',    time]],
      '📋 ดูสรุปงาน', ticketUrl(t.id));
    await linePushAdmin([flex]);
    await linePushRole('tech', [flex]);
    if (reporter?.lineUserId) await linePush(reporter.lineUserId, [flex]);
  }
}
