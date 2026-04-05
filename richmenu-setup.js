// ══════════════════════════════════════════════════════════════
//  richmenu-setup.js — LINE Rich Menu Setup Script
//  SCG AIRCON BP | ระบบแจ้งซ่อมแอร์
//  รัน script นี้ครั้งเดียวเพื่อลงทะเบียน Rich Menu กับ LINE
// ══════════════════════════════════════════════════════════════
//
//  วิธีใช้:
//  1. ติดตั้ง Node.js
//  2. node richmenu-setup.js
//  (ต้องมีไฟล์ richmenu.png อยู่ใน folder เดียวกัน)
// ══════════════════════════════════════════════════════════════

const fs   = require('fs');
const path = require('path');
const https = require('https');

// ── ใส่ค่า Token ──────────────────────────────────────────────
const CHANNEL_ACCESS_TOKEN = '7PUnKKarK4u0k+RsI9UQHQ0FtWOH3SrwZta4D2sXg0C1kCxSnJdZbYRz5ufn2FQEt04zetsmkPXPNDTTFUaMkc4tMuHMKG43FR5Iy3YENhAmjJBqF50JVzvGanSglsiecPOzbN0UMx4XaJKN0VmqtwdB04t89/1O/w1cDnyilFU=';
const LIFF_URL = 'https://liff.line.me/2009699254-TXIz4KN1';

// ── Rich Menu Definition ───────────────────────────────────────
const richMenuBody = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: 'SCG AIRCON BP Menu',
  chatBarText: '🔧 เมนูระบบแจ้งซ่อม',
  areas: [
    // 📋 แจ้งซ่อม (บนซ้าย)
    {
      bounds: { x: 0, y: 0, width: 1250, height: 421 },
      action: {
        type: 'uri',
        label: 'แจ้งซ่อม',
        uri: LIFF_URL + '?page=new'
      }
    },
    // 📊 รายงาน (บนขวา)
    {
      bounds: { x: 1250, y: 0, width: 1250, height: 421 },
      action: {
        type: 'uri',
        label: 'รายงาน',
        uri: LIFF_URL + '?page=reports'
      }
    },
    // 🔧 งานของฉัน (ล่างซ้าย)
    {
      bounds: { x: 0, y: 421, width: 1250, height: 422 },
      action: {
        type: 'uri',
        label: 'งานของฉัน',
        uri: LIFF_URL + '?page=tickets'
      }
    },
    // 👥 จัดการผู้ใช้ (ล่างขวา)
    {
      bounds: { x: 1250, y: 421, width: 1250, height: 422 },
      action: {
        type: 'uri',
        label: 'จัดการผู้ใช้',
        uri: LIFF_URL + '?page=users'
      }
    }
  ]
};

// ── Helper: LINE API request ───────────────────────────────────
function lineRequest(method, path, body, isBuffer) {
  return new Promise((resolve, reject) => {
    const isJson = !isBuffer;
    const bodyData = isJson ? Buffer.from(JSON.stringify(body)) : body;

    const options = {
      hostname: 'api.line.me',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': isJson ? 'application/json' : 'image/png',
        'Content-Length': bodyData.length
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(bodyData);
    req.end();
  });
}

// ── Main ────────────────────────────────────────────────────────
async function setup() {
  console.log('🚀 เริ่ม setup Rich Menu...\n');

  // Step 1: Create Rich Menu
  console.log('📋 Step 1: สร้าง Rich Menu...');
  const createRes = await lineRequest('POST', '/v2/bot/richmenu', richMenuBody);
  if (createRes.status !== 200) {
    console.error('❌ สร้าง Rich Menu ไม่สำเร็จ:', createRes.body);
    process.exit(1);
  }
  const richMenuId = createRes.body.richMenuId;
  console.log('✅ Rich Menu ID:', richMenuId);

  // Step 2: Upload image
  console.log('\n🖼️  Step 2: อัพโหลดรูป Rich Menu...');
  const imgPath = path.join(__dirname, 'richmenu.png');
  if (!fs.existsSync(imgPath)) {
    console.error('❌ ไม่พบไฟล์ richmenu.png — ต้องอยู่ใน folder เดียวกัน');
    process.exit(1);
  }
  const imgBuffer = fs.readFileSync(imgPath);
  const uploadRes = await lineRequest(
    'POST',
    `/v2/bot/richmenu/${richMenuId}/content`,
    imgBuffer,
    true
  );
  if (uploadRes.status !== 200) {
    console.error('❌ อัพโหลดรูปไม่สำเร็จ:', uploadRes.body);
    process.exit(1);
  }
  console.log('✅ อัพโหลดรูปสำเร็จ');

  // Step 3: Set as default Rich Menu
  console.log('\n🔗 Step 3: ตั้งเป็น default Rich Menu...');
  const setRes = await lineRequest(
    'POST',
    `/v2/bot/user/all/richmenu/${richMenuId}`,
    {}
  );
  if (setRes.status !== 200) {
    console.error('❌ ตั้ง default ไม่สำเร็จ:', setRes.body);
    process.exit(1);
  }
  console.log('✅ ตั้ง default สำเร็จ');

  console.log('\n🎉 Rich Menu พร้อมใช้งานแล้ว!');
  console.log(`   Rich Menu ID: ${richMenuId}`);
  console.log('   ผู้ใช้ทุกคนจะเห็นเมนูนี้ใน LINE ทันที');
}

setup().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
