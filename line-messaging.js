// ══════════════════════════════════════════════════════════════
//  line-messaging.js — LINE Messaging API Push Notifications
//  v3.1 | แก้ reporter ส่งไม่ได้ + gsUrl race condition fix
// ══════════════════════════════════════════════════════════════

const LINE_LIFF_URL      = 'https://liff.line.me/2009699254-TXIz4KN1';
const LINE_ADMIN_USER_ID = 'U06dd3c0d1756f7497ecf67c6fccf3e52';

// ── ส่งผ่าน GAS proxy (ไม่ถูก CORS block) ────────────────────
async function linePush(lineUserId, messages) {
  if (!lineUserId) return;
  const gsUrl = (typeof db !== 'undefined' && db.gsUrl) ? db.gsUrl : '';
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
  const gsUrl = (typeof db !== 'undefined' && db.gsUrl) ? db.gsUrl : '';
  if (!gsUrl) {
    console.warn('[LINE Push Admin] ❌ ยังไม่ได้ตั้งค่า GAS URL — ไปที่ Settings > Firebase Sync > GAS URL');
    return;
  }

  // รวบ lineUserId ของ admin ทั้งหมดจาก db
  const adminIds = (typeof db !== 'undefined' ? db.users || [] : [])
    .filter(u => u.role === 'admin' && u.lineUserId)
    .map(u => u.lineUserId);

  // รวม hardcode fallback เสมอ — ป้องกัน race condition ที่ db.users ยังโหลดไม่ครบ
  const targets = [...new Set([...adminIds, LINE_ADMIN_USER_ID])];

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
  const gsUrl = (typeof db !== 'undefined' && db.gsUrl) ? db.gsUrl : '';
  if (!gsUrl) return;

  // รวบ lineUserId จาก db ฝั่ง client ก่อน (เร็วกว่าให้ GAS query เอง)
  const userIds = (typeof db !== 'undefined' ? db.users || [] : [])
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
  new:     '#c8102e',
  assign:  '#1d4ed8',
  accept:  '#d97706',
  start:   '#7c3aed',
  done:    '#16a34a',
  newUser: '#0891b2'
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
  const gsUrl = (typeof db !== 'undefined' && db.gsUrl) ? db.gsUrl : '';
  if (!gsUrl) {
    console.warn('[lineMessagingEvent] ยังไม่ได้ตั้งค่า GAS URL — ข้ามการส่ง LINE');
    return;
  }

  const time     = typeof nowStr === 'function' ? nowStr() : new Date().toLocaleString('th-TH');
  const priority = typeof prTH === 'function' ? prTH(t.priority) : (t.priority || '—');

  if (event === 'new') {
    const flex = buildFlex(EVENT_COLORS.new, '🆕', 'งานใหม่เข้าระบบ!',
      [['เลขงาน', t.id], ['ปัญหา', t.problem], ['เครื่อง', t.machine],
       ['ผู้แจ้ง', t.reporter], ['ความด่วน', priority], ['เวลา', time]],
      '📋 ดูรายละเอียดงาน', ticketUrl(t.id));
    // ส่ง admin + ช่าง พร้อมกันใน request เดียว (batch)
    await linePushAdmin([flex]);
    await linePushRole('tech', [flex]);

  } else if (event === 'assign') {
    const tech = (db.users || []).find(u => u.name === t.assignee || u.id === t.assigneeId);
    const flexTech = buildFlex(EVENT_COLORS.assign, '📌', 'งานถูกมอบหมายให้คุณ!',
      [['เลขงาน', t.id], ['ปัญหา', t.problem], ['เครื่อง', t.machine],
       ['ความด่วน', priority], ['เวลา', time]],
      '✅ ดูงานและรับงาน', ticketUrl(t.id));
    const flexAdmin = buildFlex(EVENT_COLORS.assign, '📌', 'มอบหมายงานแล้ว',
      [['เลขงาน', t.id], ['มอบให้', t.assignee || '—'], ['เวลา', time]],
      '📋 ดูงาน', ticketUrl(t.id));
    if (tech?.lineUserId) await linePush(tech.lineUserId, [flexTech]);
    await linePushAdmin([flexAdmin]);

  } else if (event === 'accept') {
    const reporter = (db.users || []).find(u => u.name === t.reporter || u.id === t.reporterId);
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
    const reporter = (db.users || []).find(u => u.name === t.reporter || u.id === t.reporterId);
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
  }
}
