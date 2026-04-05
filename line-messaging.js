// ══════════════════════════════════════════════════════════════
//  line-messaging.js — LINE Messaging API Push Notifications
//  ใช้ Flex Message + ปุ่มเปิดแอพ
// ══════════════════════════════════════════════════════════════

const LINE_CHANNEL_TOKEN = '7PUnKKarK4u0k+RsI9UQHQ0FtWOH3SrwZta4D2sXg0C1kCxSnJdZbYRz5ufn2FQEt04zetsmkPXPNDTTFUaMkc4tMuHMKG43FR5Iy3YENhAmjJBqF50JVzvGanSglsiecPOzbN0UMx4XaJKN0VmqtwdB04t89/1O/w1cDnyilFU=';
const LINE_LIFF_URL = 'https://liff.line.me/2009699254-TXIz4KN1';
const LINE_ADMIN_USER_ID = 'U06dd3c0d1756f7497ecf67c6fccf3e52';

async function linePush(lineUserId, messages) {
  if (!lineUserId || !LINE_CHANNEL_TOKEN) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + LINE_CHANNEL_TOKEN
      },
      body: JSON.stringify({ to: lineUserId, messages })
    });
  } catch (e) { console.warn('[LINE Push] error:', e); }
}

async function linePushAdmin(messages) { await linePush(LINE_ADMIN_USER_ID, messages); }

async function linePushRole(role, messages) {
  const users = (db.users || []).filter(u => u.role === role && u.lineUserId);
  for (const u of users) await linePush(u.lineUserId, messages);
}

// ── สีตาม event ──
const EVENT_COLORS = {
  new: '#c8102e', assign: '#1d4ed8', accept: '#d97706',
  start: '#7c3aed', done: '#16a34a', newUser: '#0891b2'
};

function ticketUrl(tid) { return LINE_LIFF_URL + (tid ? '?ticket=' + tid : ''); }

// ── สร้าง Flex Message ──
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

async function lineMessagingEvent(event, t) {
  const time = typeof nowStr === 'function' ? nowStr() : new Date().toLocaleString('th-TH');
  const priority = typeof prTH === 'function' ? prTH(t.priority) : (t.priority || '—');

  if (event === 'new') {
    const flex = buildFlex(EVENT_COLORS.new, '🆕', 'งานใหม่เข้าระบบ!',
      [['เลขงาน', t.id], ['ปัญหา', t.problem], ['เครื่อง', t.machine],
       ['ผู้แจ้ง', t.reporter], ['ความด่วน', priority], ['เวลา', time]],
      '📋 ดูรายละเอียดงาน', ticketUrl(t.id));
    await linePushAdmin([flex]);
    await linePushRole('tech', [flex]);

  } else if (event === 'assign') {
    const tech = (db.users || []).find(u => u.name === t.assignee || u.id === t.assigneeId);
    const flex = buildFlex(EVENT_COLORS.assign, '📌', 'งานถูกมอบหมายให้คุณ!',
      [['เลขงาน', t.id], ['ปัญหา', t.problem], ['เครื่อง', t.machine],
       ['ความด่วน', priority], ['เวลา', time]],
      '✅ ดูงานและรับงาน', ticketUrl(t.id));
    if (tech?.lineUserId) await linePush(tech.lineUserId, [flex]);
    await linePushAdmin([buildFlex(EVENT_COLORS.assign, '📌', 'มอบหมายงานแล้ว',
      [['เลขงาน', t.id], ['มอบให้', t.assignee || '—'], ['เวลา', time]],
      '📋 ดูงาน', ticketUrl(t.id))]);

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
