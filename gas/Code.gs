// ============================================================
// SCG.AIRCON — Google Apps Script
// Version: v20260411 — fix LINE Push Admin + debug log
// ============================================================
const SS = SpreadsheetApp.getActiveSpreadsheet();

// ── Security fix: ย้าย LINE token ออกจาก source code ──
// วิธีตั้งค่า: Apps Script → Project Settings → Script Properties
//   Key: LINE_CHANNEL_TOKEN  Value: <your token>
var LINE_CHANNEL_TOKEN = (function() {
  try {
    var t = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_TOKEN');
    if (t) return t;
  } catch(e) {}
  // fallback: ถ้ายังไม่ได้ตั้ง Script Properties (แจ้งเตือนใน log)
  Logger.log('[WARN] LINE_CHANNEL_TOKEN not set in Script Properties — push notifications disabled');
  return '';
})();

const COLS = {
  Tickets: ['ID','เครื่อง','ปัญหา','รายละเอียด','ผู้แจ้ง','ผู้แจ้ง_ID',
            'ช่าง','ช่าง_ID','สถานะ','ความเร่งด่วน','ค่าใช้จ่าย',
            'สรุปการซ่อม','อะไหล่','เวลาซ่อม_ชม','ต้องติดตาม',
            'วันแจ้ง','วันอัปเดต','หมายเหตุ'],
  Machines: ['ID','ชื่อ','ยี่ห้อ','Serial','ตำแหน่ง','แผนก','BTU',
             'สารทำความเย็น','รอบบำรุง_เดือน','วันติดตั้ง','สถานะ'],
  // FIX 1: เพิ่ม LINE_UserID ให้ตรงกับที่ upsertUser ใส่ (index 7)
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
      // FIX 2: รองรับทั้ง string และ array to
      if (Array.isArray(p.to)) {
        var validIds = p.to.filter(function(id) { return id && String(id).startsWith('U'); });
        if (validIds.length === 0) {
          Logger.log('[linePush batch] ERROR: ไม่มี userId ที่ valid (ต้องขึ้นต้นด้วย U)');
          return corsOutput({synced: false, err: 'no valid userIds'});
        }
        var results = validIds.map(function(uid) {
          return linePush(uid, p.messages);
        });
        Logger.log('[linePush batch] sent to ' + validIds.length + '/' + p.to.length + ' users');
        return corsOutput({synced: true, results: results});
      }
      if (!p.to) {
        Logger.log('[linePush] ERROR: missing to field');
        return corsOutput({synced: false, err: 'missing to'});
      }
      // FIX 2: validate format userId (LINE userId ขึ้นต้นด้วย U เสมอ)
      if (!String(p.to).startsWith('U')) {
        Logger.log('[linePush] ERROR: userId ไม่ถูกต้อง — ต้องขึ้นต้นด้วย U, got: ' + p.to);
        return corsOutput({synced: false, err: 'invalid userId format: ' + p.to});
      }
      var r = linePush(p.to, p.messages);
      return corsOutput(r);
    }
    else if (p.action === 'linePushRole') {
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
    // FIX 3: action ใหม่ — ดึง admin LINE_UserID จาก sheet กลับมาให้ client ตรวจสอบได้
    else if (p.action === 'getAdminIds') {
      var ids = getAdminLineIds();
      Logger.log('[getAdminIds] found: ' + JSON.stringify(ids));
      return corsOutput({synced: true, adminIds: ids});
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
  return corsOutput({ok: true, msg: 'SCG.AIRCON API ready v20260411', sheets: Object.keys(COLS)});
}

// ── LINE Push หา userId เดียว ──────────────────────────────
function linePush(to, messages) {
  if (!to || !messages) {
    Logger.log('[LINE Push] ERROR: missing params — to=' + to);
    return {ok: false, detail: 'missing params'};
  }
  if (!LINE_CHANNEL_TOKEN || LINE_CHANNEL_TOKEN.length < 10) {
    Logger.log('[LINE Push] ERROR: LINE_CHANNEL_TOKEN ไม่ได้ตั้งค่า');
    return {ok: false, detail: 'missing token'};
  }
  try {
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: {'Authorization': 'Bearer ' + LINE_CHANNEL_TOKEN},
      payload: JSON.stringify({to: to, messages: messages}),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    var body = res.getContentText();
    Logger.log('[LINE Push] to=' + to + ' | HTTP ' + code + ' | ' + body);
    if (code !== 200) {
      // FIX 2: log ชัดเจนขึ้นว่า error คืออะไร
      var errBody = {};
      try { errBody = JSON.parse(body); } catch(e) {}
      Logger.log('[LINE Push] FAIL — message: ' + (errBody.message || body));
      Logger.log('[LINE Push] hint: ตรวจสอบว่า userId "' + to + '" เคย add LINE OA แล้วหรือยัง');
    }
    return code === 200
      ? {ok: true, to: to}
      : {ok: false, to: to, code: code, detail: body};
  } catch(fetchErr) {
    Logger.log('[LINE Push] EXCEPTION: ' + fetchErr.toString());
    return {ok: false, to: to, detail: fetchErr.toString()};
  }
}

// ── ดึง LINE_UserID ของ admin ทั้งหมดจาก sheet ──────────────
// FIX 3: แยก function นี้ออกมา เพื่อ reuse และทดสอบง่าย
function getAdminLineIds() {
  var s = SS.getSheetByName('Users');
  if (!s) {
    Logger.log('[getAdminLineIds] ไม่พบ sheet Users');
    return [];
  }
  var data = s.getDataRange().getValues();
  if (data.length < 2) {
    Logger.log('[getAdminLineIds] sheet Users ว่าง (ไม่มีข้อมูล)');
    return [];
  }
  var headers = data[0];
  var roleIdx = headers.indexOf('บทบาท');
  var lineIdx = headers.indexOf('LINE_UserID');

  // FIX 1: log ชัดเจนถ้า column หาย
  if (roleIdx < 0) {
    Logger.log('[getAdminLineIds] ERROR: ไม่พบ column "บทบาท" ใน sheet Users — headers: ' + JSON.stringify(headers));
    return [];
  }
  if (lineIdx < 0) {
    Logger.log('[getAdminLineIds] ERROR: ไม่พบ column "LINE_UserID" ใน sheet Users — headers: ' + JSON.stringify(headers));
    return [];
  }

  var ids = [];
  for (var i = 1; i < data.length; i++) {
    var rowRole = String(data[i][roleIdx]).trim();
    var rowLineId = String(data[i][lineIdx]).trim();
    if (rowRole === 'admin' && rowLineId && rowLineId !== '' && rowLineId !== 'undefined') {
      ids.push(rowLineId);
      Logger.log('[getAdminLineIds] found admin LINE_UserID: ' + rowLineId + ' (row ' + (i+1) + ')');
    }
  }
  if (ids.length === 0) {
    Logger.log('[getAdminLineIds] WARNING: ไม่มี admin ที่มี LINE_UserID — ตรวจสอบ sheet Users ว่า column LINE_UserID ถูก sync มาจาก app หรือยัง');
  }
  return ids;
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
    Logger.log('[linePushByRole] ไม่พบ column บทบาท หรือ LINE_UserID — headers: ' + JSON.stringify(headers));
    return 0;
  }
  var pushed = 0;
  for (var i = 1; i < data.length; i++) {
    var rowRole   = String(data[i][roleIdx]).trim();
    var rowLineId = String(data[i][lineIdx]).trim();
    if (rowRole === role && rowLineId && rowLineId.startsWith('U')) {
      linePush(rowLineId, messages);
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
  upsert('Users', COLS.Users, [
    u.id, u.name||'', u.username||'', u.role||'',
    u.dept||'', u.tel||'', u.contact||'',
    // FIX 1: ตรวจให้แน่ว่า lineUserId ส่งมาถึง GAS จริง
    u.lineUserId || u.LINE_UserID || u.lineID || '',
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

// ── ทดสอบ: ดู admin ids ที่จะ push ──────────────────────────
function testGetAdminIds() {
  var ids = getAdminLineIds();
  Logger.log('Admin LINE IDs: ' + JSON.stringify(ids));
}

// ── ทดสอบส่งหา admin ทุกคนจาก sheet Users ──────────────────
function testLinePushAllAdmins() {
  var ids = getAdminLineIds();
  if (ids.length === 0) {
    Logger.log('❌ ไม่พบ admin ที่มี LINE_UserID ใน sheet — sync users จาก app ก่อน');
    return;
  }
  Logger.log('🔔 จะส่งหา ' + ids.length + ' admin(s): ' + JSON.stringify(ids));
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
