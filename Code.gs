// ============================================================
// SCG.AIRCON — Google Apps Script
// Version: v20260406 — แก้ LINE Push ไม่ส่งถึง Admin
// ============================================================
const SS = SpreadsheetApp.getActiveSpreadsheet();

var LINE_CHANNEL_TOKEN = '7PUnKKarK4u0k+RsI9UQHQ0FtWOH3SrwZta4D2sXg0C1kCxSnJdZbYRz5ufn2FQEt04zetsmkPXPNDTTFUaMkc4tMuHMKG43FR5Iy3YENhAmjJBqF50JVzvGanSglsiecPOzbN0UMx4XaJKN0VmqtwdB04t89/1O/w1cDnyilFU=';

const COLS = {
  Tickets: ['ID','เครื่อง','ปัญหา','รายละเอียด','ผู้แจ้ง','ผู้แจ้ง_ID',
            'ช่าง','ช่าง_ID','สถานะ','ความเร่งด่วน','ค่าใช้จ่าย',
            'สรุปการซ่อม','อะไหล่','เวลาซ่อม_ชม','ต้องติดตาม',
            'วันแจ้ง','วันอัปเดต','หมายเหตุ'],
  Machines: ['ID','ชื่อ','ยี่ห้อ','Serial','ตำแหน่ง','แผนก','BTU',
             'สารทำความเย็น','รอบบำรุง_เดือน','วันติดตั้ง','สถานะ'],
  Users:    ['ID','ชื่อ','Username','บทบาท','แผนก','เบอร์โทร','อีเมล_Line','LINE_UserID','อัปเดตล่าสุด']
};

function corsOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);

    if (p.action === 'ticket') {
      upsertTicket(p.d);
    }
    else if (p.action === 'machine') {
      upsertMachine(p.d);
    }
    else if (p.action === 'user') {
      upsertUser(p.d);
    }
    else if (p.action === 'linePush') {
      // รองรับทั้งส่งหา userId เดียว และ array
      if (Array.isArray(p.to)) {
        var results = p.to.map(uid => linePush(uid, p.messages));
        return corsOutput({synced: true, results: results});
      }
      var r = linePush(p.to, p.messages);
      return corsOutput(r);
    }
    else if (p.action === 'linePushRole') {
      // ส่งหา role ทั้งหมดที่มี LINE_UserID ใน sheet Users
      var pushed = linePushByRole(p.role, p.messages);
      return corsOutput({synced: true, pushed: pushed});
    }
    else if (p.action === 'all') {
      if (p.tickets && p.tickets.length > 0) {
        ensureSheet('Tickets', COLS.Tickets);
        p.tickets.forEach(t => upsertTicket(t));
      }
      if (p.machines && p.machines.length > 0) {
        ensureSheet('Machines', COLS.Machines);
        p.machines.forEach(m => upsertMachine(m));
      }
      if (p.users && p.users.length > 0) {
        ensureSheet('Users', COLS.Users);
        p.users.forEach(u => upsertUser(u));
      }
    }

    return corsOutput({synced: true});
  } catch(err) {
    Logger.log('[doPost ERROR] ' + err.toString());
    return corsOutput({synced: false, err: err.toString()});
  }
}

function doGet(e) {
  const sheet = (e && e.parameter && e.parameter.sheet) || '';
  if (sheet) {
    const s = SS.getSheetByName(sheet);
    if (!s) return corsOutput({ok: false, msg: 'Sheet not found: ' + sheet});
    const [headers, ...rows] = s.getDataRange().getValues();
    const data = rows.map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i]);
      return obj;
    });
    return corsOutput({ok: true, sheet, data});
  }
  return corsOutput({ok: true, msg: 'SCG.AIRCON API ready v20260406', sheets: Object.keys(COLS)});
}

// ── LINE Push หา userId เดียว ──────────────────────────────
function linePush(to, messages) {
  if (!to || !messages) return {ok: false, detail: 'missing params'};
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    contentType: 'application/json',
    headers: {'Authorization': 'Bearer ' + LINE_CHANNEL_TOKEN},
    payload: JSON.stringify({to: to, messages: messages}),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  Logger.log('[LINE Push] to=' + to + ' | ' + code + ': ' + body);
  return code === 200 ? {ok: true, to: to} : {ok: false, to: to, detail: body};
}

// ── LINE Push หา role ทั้งหมด (ดึงจาก sheet Users) ─────────
function linePushByRole(role, messages) {
  if (!role || !messages) return 0;
  var s = SS.getSheetByName('Users');
  if (!s) { Logger.log('[linePushByRole] ไม่พบ sheet Users'); return 0; }
  var data = s.getDataRange().getValues();
  var headers = data[0];
  var roleIdx = headers.indexOf('บทบาท');
  var lineIdx = headers.indexOf('LINE_UserID');
  if (roleIdx < 0 || lineIdx < 0) {
    Logger.log('[linePushByRole] ไม่พบ column บทบาท หรือ LINE_UserID — ตรวจสอบ header sheet Users');
    return 0;
  }
  var pushed = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][roleIdx]) === role && data[i][lineIdx]) {
      linePush(String(data[i][lineIdx]), messages);
      pushed++;
    }
  }
  Logger.log('[linePushByRole] role=' + role + ' pushed=' + pushed);
  return pushed;
}

function upsertTicket(t) {
  upsert('Tickets', COLS.Tickets, [
    t.id, t.machine||'', t.problem||'', t.detail||'',
    t.reporter||'', t.reporterId||'',
    t.assignee||'', t.assigneeId||'',
    t.status||'', t.priority||'', t.cost||0,
    t.summary||'', t.parts||'', t.repairHours||'', t.followup||'',
    t.createdAt||'', t.updatedAt||'', t.note||''
  ]);
}

function upsertMachine(m) {
  upsert('Machines', COLS.Machines, [
    m.id, m.name||'', m.brand||'', m.serial||'',
    m.location||'', m.dept||'', m.btu||'',
    m.refrigerant||'', m.interval||6, m.install||'', m.status||'active'
  ]);
}

function upsertUser(u) {
  // เพิ่ม lineUserId ลง sheet Users ด้วย
  upsert('Users', COLS.Users, [
    u.id, u.name||'', u.username||'', u.role||'',
    u.dept||'', u.tel||'', u.contact||'', u.lineUserId||'',
    new Date().toLocaleString('th-TH')
  ]);
}

function ensureSheet(name, headers) {
  let s = SS.getSheetByName(name);
  if (!s) {
    s = SS.insertSheet(name);
    s.appendRow(headers);
    s.setFrozenRows(1);
    const hRange = s.getRange(1, 1, 1, headers.length);
    hRange.setBackground('#c8102e');
    hRange.setFontColor('#ffffff');
    hRange.setFontWeight('bold');
    headers.forEach((_, i) => s.setColumnWidth(i + 1, i < 2 ? 90 : 140));
  }
  return s;
}

function upsert(name, headers, row) {
  const s = ensureSheet(name, headers);
  const data = s.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(row[0])) {
      s.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return;
    }
  }
  s.appendRow(row);
}

function ok(obj) { return corsOutput(obj); }

function autoFormatSheets() {
  Object.keys(COLS).forEach(name => {
    const s = SS.getSheetByName(name);
    if (!s) return;
    const lastRow = s.getLastRow();
    if (lastRow < 2) return;
    for (let i = 2; i <= lastRow; i++) {
      const range = s.getRange(i, 1, 1, s.getLastColumn());
      range.setBackground(i % 2 === 0 ? '#fff8f8' : '#ffffff');
    }
  });
}

// ── ทดสอบส่งหา admin ทุกคนจาก sheet Users ──────────────────
function testLinePushAllAdmins() {
  var pushed = linePushByRole('admin', [{type: 'text', text: '🔔 ทดสอบแจ้งเตือน Admin จาก GAS'}]);
  Logger.log('pushed to ' + pushed + ' admin(s)');
}

// ── ทดสอบส่ง hardcode userId ────────────────────────────────
function testLinePush() {
  var result = linePush(
    'U06dd3c0d1756f7497ecf67c6fccf3e52',
    [{type: 'text', text: 'ทดสอบจาก GAS ตรงๆ'}]
  );
  Logger.log(JSON.stringify(result));
}
