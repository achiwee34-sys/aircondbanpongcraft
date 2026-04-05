// ══════════════════════════════════════════════════════════════
//  Code.gs — Google Apps Script Backend
//  SCG AIRCON BP | ระบบแจ้งซ่อมแอร์
//  
//  วิธี deploy:
//  1. ไปที่ script.google.com → สร้าง project ใหม่
//  2. วางโค้ดนี้ทับ Code.gs
//  3. Deploy → New deployment → Web app
//     - Execute as: Me
//     - Who has access: Anyone
//  4. Copy URL ไปใส่ใน Settings → gsUrl ในแอพ
// ══════════════════════════════════════════════════════════════

var LINE_CHANNEL_TOKEN = '7PUnKKarK4u0k+RsI9UQHQ0FtWOH3SrwZta4D2sXg0C1kCxSnJdZbYRz5ufn2FQEt04zetsmkPXPNDTTFUaMkc4tMuHMKG43FR5Iy3YENhAmjJBqF50JVzvGanSglsiecPOzbN0UMx4XaJKN0VmqtwdB04t89/1O/w1cDnyilFU=';

// ── Sheet names ────────────────────────────────────────────────
var SHEET_TICKET  = 'Tickets';
var SHEET_USER    = 'Users';
var SHEET_MACHINE = 'Machines';

// ══════════════════════════════════════════════════════════════
//  doPost — รับ request จากแอพ
// ══════════════════════════════════════════════════════════════
function doPost(e) {
  var result = { ok: false };

  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    if (action === 'ticket')  { syncToSheet(SHEET_TICKET,  body.d, 'id');       result.ok = true; }
    if (action === 'user')    { syncToSheet(SHEET_USER,    body.d, 'id');       result.ok = true; }
    if (action === 'machine') { syncToSheet(SHEET_MACHINE, body.d, 'id');       result.ok = true; }

    // ── LINE Push Proxy (แก้ CORS) ────────────────────────────
    if (action === 'linePush') {
      var pushResult = linePush(body.to, body.messages);
      result.ok     = pushResult.ok;
      result.detail = pushResult.detail;
    }

  } catch (err) {
    result.error = err.message;
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════
//  doGet — health check
// ══════════════════════════════════════════════════════════════
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'SCG AIRCON BP GAS', ts: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════
//  linePush — ส่ง LINE message จาก server (ไม่มี CORS)
// ══════════════════════════════════════════════════════════════
function linePush(to, messages) {
  if (!to || !messages) return { ok: false, detail: 'missing to or messages' };

  try {
    var response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + LINE_CHANNEL_TOKEN },
      payload: JSON.stringify({ to: to, messages: messages }),
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    var body = response.getContentText();

    if (code === 200) {
      return { ok: true, detail: 'sent' };
    } else {
      Logger.log('[LINE Push] Error ' + code + ': ' + body);
      return { ok: false, detail: body };
    }
  } catch (err) {
    Logger.log('[LINE Push] Exception: ' + err.message);
    return { ok: false, detail: err.message };
  }
}

// ══════════════════════════════════════════════════════════════
//  syncToSheet — บันทึกข้อมูลลง Google Sheet
// ══════════════════════════════════════════════════════════════
function syncToSheet(sheetName, data, keyField) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  // สร้าง sheet ถ้ายังไม่มี
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  var keyVal  = data[keyField];
  var jsonStr = JSON.stringify(data);
  var now     = new Date().toISOString();

  var lastRow = sheet.getLastRow();

  // หา row ที่มี key นี้แล้ว
  if (lastRow > 1) {
    var keyCol = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < keyCol.length; i++) {
      if (keyCol[i][0] === keyVal) {
        // อัพเดต row นั้น
        sheet.getRange(i + 2, 1, 1, 3).setValues([[keyVal, now, jsonStr]]);
        return;
      }
    }
  }

  // ถ้าไม่มี header ให้ใส่ก่อน
  if (lastRow === 0) {
    sheet.appendRow(['ID', 'UpdatedAt', 'JSON']);
  }

  // เพิ่ม row ใหม่
  sheet.appendRow([keyVal, now, jsonStr]);
}
