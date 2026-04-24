// ══════════════════════════════════════════════════════
//  SPARE PARTS CATALOG — spares_fixed.json
//  300 รายการ | 8 หมวด
//  สร้างอัตโนมัติ — ห้ามแก้มือ
// ══════════════════════════════════════════════════════

// ── Catalog version: เพิ่มตัวเลขนี้ทุกครั้งที่อัปเดต SPARE_PARTS ──
const SPARE_CATALOG_VERSION = 2; // v2: 300 items, 8 categories

const SPARE_PARTS = [{"id":"SP001","n":"คอมเพรสเซอร์ 9,000 BTU (R32)","c":"compressor","p":3500,"u":"ตัว","k":["compressor","คอมเพรสเซอร์","9000","R32","ปั๊ม"]},{"id":"SP002","n":"คอมเพรสเซอร์ 12,000 BTU (R32)","c":"compressor","p":4500,"u":"ตัว","k":["compressor","คอมเพรสเซอร์","12000","R32","ปั๊ม"]},{"id":"SP003","n":"คอมเพรสเซอร์ 18,000 BTU (R410A)","c":"compressor","p":6800,"u":"ตัว","k":["compressor","คอมเพรสเซอร์","18000","R410A","ปั๊ม"]},{"id":"SP004","n":"คอมเพรสเซอร์ 24,000 BTU (R410A)","c":"compressor","p":9500,"u":"ตัว","k":["compressor","คอมเพรสเซอร์","24000","R410A","ปั๊ม"]},{"id":"SP005","n":"คอมเพรสเซอร์ 36,000 BTU (R410A)","c":"compressor","p":14000,"u":"ตัว","k":["compressor","คอมเพรสเซอร์","36000","R410A","ปั๊ม"]},{"id":"SP006","n":"คอมเพรสเซอร์ 48,000 BTU (R410A)","c":"compressor","p":18500,"u":"ตัว","k":["compressor","คอมเพรสเซอร์","48000","R410A","ปั๊ม"]},{"id":"SP007","n":"คอมเพรสเซอร์ Inverter 9,000 BTU","c":"compressor","p":5200,"u":"ตัว","k":["compressor","คอมเพรสเซอร์","inverter","9000","ประหยัดไฟ"]},{"id":"SP008","n":"คอมเพรสเซอร์ Inverter 12,000 BTU","c":"compressor","p":6800,"u":"ตัว","k":["compressor","คอมเพรสเซอร์","inverter","12000","ประหยัดไฟ"]},{"id":"SP009","n":"คอมเพรสเซอร์ Inverter 18,000 BTU","c":"compressor","p":9800,"u":"ตัว","k":["compressor","คอมเพรสเซอร์","inverter","18000","ประหยัดไฟ"]},{"id":"SP010","n":"คอมเพรสเซอร์ Inverter 24,000 BTU","c":"compressor","p":13500,"u":"ตัว","k":["compressor","คอมเพรสเซอร์","inverter","24000","ประหยัดไฟ"]},{"id":"SP011","n":"โอริง ชุดคอมเพรสเซอร์ (ชุด)","c":"compressor","p":180,"u":"ชุด","k":["โอริง","oring","คอมเพรสเซอร์","ซีล","seal"]},{"id":"SP012","n":"วาล์วกันกลับคอมเพรสเซอร์","c":"compressor","p":350,"u":"ตัว","k":["วาล์ว","valve","กันกลับ","คอมเพรสเซอร์"]},{"id":"SP013","n":"น้ำมันคอมเพรสเซอร์ POE 68 (1L)","c":"compressor","p":480,"u":"ขวด","k":["น้ำมัน","oil","POE","คอมเพรสเซอร์","68"]},{"id":"SP014","n":"น้ำยาแอร์ R32 (ถัง 10 kg)","c":"refrigerant","p":2800,"u":"ถัง","k":["R32","น้ำยา","refrigerant","สารทำความเย็น","แก๊ส"]},{"id":"SP015","n":"น้ำยาแอร์ R410A (ถัง 11.3 kg)","c":"refrigerant","p":3200,"u":"ถัง","k":["R410A","น้ำยา","refrigerant","สารทำความเย็น","แก๊ส"]},{"id":"SP016","n":"น้ำยาแอร์ R22 (ถัง 13.6 kg)","c":"refrigerant","p":2200,"u":"ถัง","k":["R22","น้ำยา","refrigerant","สารทำความเย็น","แก๊ส"]},{"id":"SP017","n":"น้ำยาแอร์ R134A (ถัง 12 kg)","c":"refrigerant","p":2600,"u":"ถัง","k":["R134A","น้ำยา","refrigerant","สารทำความเย็น"]},{"id":"SP018","n":"น้ำยาแอร์ R32 (กระป๋อง 400g ชาร์จเอง)","c":"refrigerant","p":320,"u":"กระป๋อง","k":["R32","น้ำยา","กระป๋อง","ชาร์จ","ตรวจเช็ค"]},{"id":"SP019","n":"สาร UV Leak Detector (60ml)","c":"refrigerant","p":280,"u":"ขวด","k":["UV","leak","รั่ว","ตรวจ","fluorescent"]},{"id":"SP020","n":"น้ำยาล้างระบบ Flush (1L)","c":"refrigerant","p":650,"u":"ขวด","k":["flush","ล้างระบบ","ท่อ","refrigerant"]},{"id":"SP021","n":"พัดลม Indoor (Scroll Fan) 9,000-12,000 BTU","c":"fan","p":850,"u":"ตัว","k":["พัดลม","fan","indoor","scroll","ใบพัด","คอยล์เย็น"]},{"id":"SP022","n":"พัดลม Indoor (Scroll Fan) 18,000-24,000 BTU","c":"fan","p":1200,"u":"ตัว","k":["พัดลม","fan","indoor","scroll","ใบพัด","คอยล์เย็น"]},{"id":"SP023","n":"พัดลม Outdoor (Axial Fan) 9,000-12,000 BTU","c":"fan","p":680,"u":"ตัว","k":["พัดลม","fan","outdoor","axial","คอยล์ร้อน","คอนเดนเซอร์"]},{"id":"SP024","n":"พัดลม Outdoor (Axial Fan) 18,000-24,000 BTU","c":"fan","p":980,"u":"ตัว","k":["พัดลม","fan","outdoor","axial","คอยล์ร้อน","คอนเดนเซอร์"]},{"id":"SP025","n":"มอเตอร์พัดลม Indoor 9,000-12,000 BTU","c":"fan","p":1200,"u":"ตัว","k":["มอเตอร์","motor","indoor","fan","พัดลม","คอยล์เย็น"]},{"id":"SP026","n":"มอเตอร์พัดลม Indoor 18,000-24,000 BTU","c":"fan","p":1800,"u":"ตัว","k":["มอเตอร์","motor","indoor","fan","พัดลม","คอยล์เย็น"]},{"id":"SP027","n":"มอเตอร์พัดลม Outdoor 9,000-12,000 BTU","c":"fan","p":1100,"u":"ตัว","k":["มอเตอร์","motor","outdoor","fan","พัดลม","คอนเดนเซอร์"]},{"id":"SP028","n":"มอเตอร์พัดลม Outdoor 18,000-24,000 BTU","c":"fan","p":1600,"u":"ตัว","k":["มอเตอร์","motor","outdoor","fan","พัดลม","คอนเดนเซอร์"]},{"id":"SP029","n":"มอเตอร์พัดลม Outdoor 36,000-48,000 BTU","c":"fan","p":2400,"u":"ตัว","k":["มอเตอร์","motor","outdoor","fan","พัดลม","คอนเดนเซอร์"]},{"id":"SP030","n":"ตลับลูกปืนมอเตอร์พัดลม (ชุด)","c":"fan","p":280,"u":"ชุด","k":["ลูกปืน","bearing","มอเตอร์","พัดลม","fan"]},{"id":"SP031","n":"แผงวงจรหลัก Indoor (Main PCB) 9,000-12,000","c":"electrical","p":2800,"u":"แผ่น","k":["PCB","แผงวงจร","board","indoor","main","circuit"]},{"id":"SP032","n":"แผงวงจรหลัก Indoor (Main PCB) 18,000-24,000","c":"electrical","p":3600,"u":"แผ่น","k":["PCB","แผงวงจร","board","indoor","main","circuit"]},{"id":"SP033","n":"แผงวงจร Outdoor (Inverter PCB)","c":"electrical","p":4500,"u":"แผ่น","k":["PCB","แผงวงจร","board","outdoor","inverter","circuit"]},{"id":"SP034","n":"แผงควบคุมรีโมต (Display PCB)","c":"electrical","p":1200,"u":"แผ่น","k":["PCB","display","รีโมต","หน้าจอ","LED","panel"]},{"id":"SP035","n":"คาปาซิเตอร์ Start 35+5 µF","c":"electrical","p":180,"u":"ตัว","k":["capacitor","คาปาซิเตอร์","start","35µF","5µF","ตัวเก็บประจุ"]},{"id":"SP036","n":"คาปาซิเตอร์ Run 25 µF","c":"electrical","p":150,"u":"ตัว","k":["capacitor","คาปาซิเตอร์","run","25µF","มอเตอร์"]},{"id":"SP037","n":"คาปาซิเตอร์ Run 40+5 µF","c":"electrical","p":200,"u":"ตัว","k":["capacitor","คาปาซิเตอร์","run","40µF","5µF","มอเตอร์"]},{"id":"SP038","n":"เซ็นเซอร์อุณหภูมิ Thermistor (ห้อง)","c":"electrical","p":320,"u":"ตัว","k":["sensor","เซ็นเซอร์","thermistor","อุณหภูมิ","ห้อง","NTC"]},{"id":"SP039","n":"เซ็นเซอร์อุณหภูมิ Thermistor (คอยล์เย็น)","c":"electrical","p":320,"u":"ตัว","k":["sensor","เซ็นเซอร์","thermistor","อุณหภูมิ","คอยล์","evaporator"]},{"id":"SP040","n":"เซ็นเซอร์อุณหภูมิ Thermistor (discharge)","c":"electrical","p":380,"u":"ตัว","k":["sensor","เซ็นเซอร์","thermistor","discharge","ท่อทางออก"]},{"id":"SP041","n":"ไฮเพรสเชอร์สวิตช์ (High Pressure Switch)","c":"electrical","p":650,"u":"ตัว","k":["pressure","switch","ไฮเพรส","ความดัน","high","สวิตช์"]},{"id":"SP042","n":"โลเพรสเชอร์สวิตช์ (Low Pressure Switch)","c":"electrical","p":580,"u":"ตัว","k":["pressure","switch","โลเพรส","ความดัน","low","สวิตช์"]},{"id":"SP043","n":"รีเลย์ 8 ขา 24V","c":"electrical","p":120,"u":"ตัว","k":["relay","รีเลย์","24V","8ขา","kontaktor"]},{"id":"SP044","n":"รีเลย์ 14 ขา 220V","c":"electrical","p":150,"u":"ตัว","k":["relay","รีเลย์","220V","14ขา","kontaktor"]},{"id":"SP045","n":"คอนแทคเตอร์ 25A (Contactor)","c":"electrical","p":480,"u":"ตัว","k":["contactor","คอนแทคเตอร์","25A","magnetic"]},{"id":"SP046","n":"คอนแทคเตอร์ 40A (Contactor)","c":"electrical","p":680,"u":"ตัว","k":["contactor","คอนแทคเตอร์","40A","magnetic"]},{"id":"SP047","n":"ไดโอดบริดจ์ (Bridge Rectifier) 25A","c":"electrical","p":220,"u":"ตัว","k":["diode","bridge","rectifier","ไดโอด","25A"]},{"id":"SP048","n":"IGBT Module Inverter","c":"electrical","p":1800,"u":"ตัว","k":["IGBT","module","inverter","transistor","power"]},{"id":"SP049","n":"ฟิวส์ 15A 250V (10 ตัว)","c":"electrical","p":80,"u":"แพ็ค","k":["fuse","ฟิวส์","15A","250V","ขาด"]},{"id":"SP050","n":"ฟิวส์ 30A 250V (5 ตัว)","c":"electrical","p":95,"u":"แพ็ค","k":["fuse","ฟิวส์","30A","250V","ขาด"]},{"id":"SP051","n":"เทอร์มัลโปรเทคเตอร์ (Thermal Protector)","c":"electrical","p":280,"u":"ตัว","k":["thermal","protector","เทอร์มัล","ป้องกัน","ร้อน","overload"]},{"id":"SP052","n":"สายไฟแอร์ 3x2.5mm² (เมตร)","c":"electrical","p":65,"u":"เมตร","k":["สายไฟ","wire","cable","2.5mm","แอร์","power"]},{"id":"SP053","n":"สายไฟแอร์ 3x4mm² (เมตร)","c":"electrical","p":95,"u":"เมตร","k":["สายไฟ","wire","cable","4mm","แอร์","power"]},{"id":"SP054","n":"สายสัญญาณ 4 คอร์ (เมตร)","c":"electrical","p":28,"u":"เมตร","k":["สายสัญญาณ","signal","4core","indoor","outdoor","control"]},{"id":"SP055","n":"ท่อทองแดง 1/4 นิ้ว (เมตร)","c":"pipe","p":85,"u":"เมตร","k":["ท่อทองแดง","copper","pipe","1/4","liquid","ท่อน้ำยา"]},{"id":"SP056","n":"ท่อทองแดง 3/8 นิ้ว (เมตร)","c":"pipe","p":120,"u":"เมตร","k":["ท่อทองแดง","copper","pipe","3/8","suction","ท่อน้ำยา"]},{"id":"SP057","n":"ท่อทองแดง 1/2 นิ้ว (เมตร)","c":"pipe","p":165,"u":"เมตร","k":["ท่อทองแดง","copper","pipe","1/2","suction","ท่อน้ำยา"]},{"id":"SP058","n":"ท่อทองแดง 5/8 นิ้ว (เมตร)","c":"pipe","p":210,"u":"เมตร","k":["ท่อทองแดง","copper","pipe","5/8","suction","ท่อน้ำยา"]},{"id":"SP059","n":"ท่อทองแดง 3/4 นิ้ว (เมตร)","c":"pipe","p":265,"u":"เมตร","k":["ท่อทองแดง","copper","pipe","3/4","suction","ท่อน้ำยา"]},{"id":"SP060","n":"อินซูเลชั่นหุ้มท่อ 1/2 นิ้ว (เมตร)","c":"pipe","p":35,"u":"เมตร","k":["insulation","ฉนวน","หุ้มท่อ","1/2","foam","rubber"]},{"id":"SP061","n":"อินซูเลชั่นหุ้มท่อ 3/4 นิ้ว (เมตร)","c":"pipe","p":48,"u":"เมตร","k":["insulation","ฉนวน","หุ้มท่อ","3/4","foam","rubber"]},{"id":"SP062","n":"ข้อต่อฟแลร์ (Flare Fitting) 1/4 นิ้ว","c":"pipe","p":45,"u":"ชุด","k":["flare","fitting","ข้อต่อ","1/4","union","น้ำยา"]},{"id":"SP063","n":"ข้อต่อฟแลร์ (Flare Fitting) 3/8 นิ้ว","c":"pipe","p":58,"u":"ชุด","k":["flare","fitting","ข้อต่อ","3/8","union","น้ำยา"]},{"id":"SP064","n":"ข้อต่อฟแลร์ (Flare Fitting) 1/2 นิ้ว","c":"pipe","p":72,"u":"ชุด","k":["flare","fitting","ข้อต่อ","1/2","union","น้ำยา"]},{"id":"SP065","n":"วาล์วบอล 2 ทาง 1/4 นิ้ว","c":"pipe","p":280,"u":"ตัว","k":["valve","วาล์ว","ball","2ทาง","1/4","shut-off"]},{"id":"SP066","n":"วาล์วบอล 2 ทาง 3/8 นิ้ว","c":"pipe","p":320,"u":"ตัว","k":["valve","วาล์ว","ball","2ทาง","3/8","shut-off"]},{"id":"SP067","n":"วาล์วชาร์จ Schrader (ชุด 2 ตัว)","c":"pipe","p":180,"u":"ชุด","k":["schrader","valve","วาล์วชาร์จ","charging","น้ำยา"]},{"id":"SP068","n":"สายชาร์จน้ำยาแอร์ R32/R410A (ชุด 3 เส้น)","c":"pipe","p":950,"u":"ชุด","k":["charging","hose","สายชาร์จ","manifold","gauge"]},{"id":"SP069","n":"ท่อระบายน้ำ PVC 1/2 นิ้ว (เมตร)","c":"pipe","p":22,"u":"เมตร","k":["drain","ท่อระบายน้ำ","PVC","1/2","condensate"]},{"id":"SP070","n":"กล่องป้องกันท่อ Trunking 60x40 (เมตร)","c":"pipe","p":68,"u":"เมตร","k":["trunking","กล่องท่อ","60x40","ครอบท่อ","เคเบิ้ล"]},{"id":"SP071","n":"กล่องป้องกันท่อ Trunking 80x60 (เมตร)","c":"pipe","p":95,"u":"เมตร","k":["trunking","กล่องท่อ","80x60","ครอบท่อ","เคเบิ้ล"]},{"id":"SP072","n":"สก็อตช์โลค (สายรัดท่อ) 3/4 นิ้ว (แพ็ค 50)","c":"pipe","p":120,"u":"แพ็ค","k":["scotch-lok","สายรัด","clamp","3/4","ท่อ"]},{"id":"SP073","n":"น้ำยาล้างแอร์ (Coil Cleaner) 500ml","c":"cleaning","p":180,"u":"ขวด","k":["coil cleaner","น้ำยาล้าง","cleaning","ล้างแอร์","คอยล์"]},{"id":"SP074","n":"น้ำยาล้างแอร์เข้มข้น (1L)","c":"cleaning","p":320,"u":"ขวด","k":["coil cleaner","น้ำยาล้าง","เข้มข้น","concentrate","ล้างแอร์"]},{"id":"SP075","n":"น้ำยาล้างแอร์ Outdoor (Alkaline) 1L","c":"cleaning","p":280,"u":"ขวด","k":["alkaline","outdoor","คอนเดนเซอร์","ล้างคอยล์ร้อน","cleaning"]},{"id":"SP076","n":"ถุงพลาสติกคลุมแอร์ล้าง Indoor (ชุด)","c":"cleaning","p":85,"u":"ชุด","k":["ถุงล้างแอร์","plastic","cover","indoor","ล้าง"]},{"id":"SP077","n":"แปรงทำความสะอาดคอยล์ (Fin Comb)","c":"cleaning","p":220,"u":"อัน","k":["fin comb","แปรง","ครีบ","คอยล์","straighten"]},{"id":"SP078","n":"น้ำยาฆ่าเชื้อ/ดับกลิ่น (400ml)","c":"cleaning","p":250,"u":"กระป๋อง","k":["deodorant","ดับกลิ่น","ฆ่าเชื้อ","antibacterial","spray"]},{"id":"SP079","n":"ไส้กรองอากาศ (Filter) HEPA 9,000-12,000","c":"cleaning","p":380,"u":"แผ่น","k":["filter","ไส้กรอง","HEPA","air filter","ฝุ่น"]},{"id":"SP080","n":"ไส้กรองอากาศ (Filter) HEPA 18,000-24,000","c":"cleaning","p":520,"u":"แผ่น","k":["filter","ไส้กรอง","HEPA","air filter","ฝุ่น"]},{"id":"SP081","n":"กรองอากาศถ่านแอคทิเวต (Carbon Filter)","c":"cleaning","p":280,"u":"แผ่น","k":["carbon","filter","ถ่าน","กรอง","กลิ่น","activated"]},{"id":"SP082","n":"ถาดน้ำทิ้ง Indoor (Drain Pan)","c":"cleaning","p":650,"u":"ชิ้น","k":["drain pan","ถาด","น้ำทิ้ง","indoor","ล้น"]},{"id":"SP083","n":"ปั๊มน้ำทิ้ง Condensate Pump 7L/hr","c":"cleaning","p":1200,"u":"ตัว","k":["condensate pump","ปั๊มน้ำ","ระบายน้ำ","drain","pump"]},{"id":"SP084","n":"สเปรย์หล่อลื่น สำหรับมอเตอร์ (200ml)","c":"cleaning","p":160,"u":"กระป๋อง","k":["lubricant","หล่อลื่น","สเปรย์","มอเตอร์","ลูกปืน"]},{"id":"SP085","n":"ชุดล้างแอร์ความดัน (Mini Washer Kit)","c":"cleaning","p":980,"u":"ชุด","k":["pressure washer","ล้างแรงดัน","mini","cleaning","kit"]},{"id":"SP086","n":"คอยล์เย็น (Evaporator Coil) 9,000 BTU","c":"unit","p":2800,"u":"ชิ้น","k":["evaporator","คอยล์เย็น","coil","indoor","9000"]},{"id":"SP087","n":"คอยล์เย็น (Evaporator Coil) 12,000 BTU","c":"unit","p":3400,"u":"ชิ้น","k":["evaporator","คอยล์เย็น","coil","indoor","12000"]},{"id":"SP088","n":"คอยล์เย็น (Evaporator Coil) 18,000 BTU","c":"unit","p":4800,"u":"ชิ้น","k":["evaporator","คอยล์เย็น","coil","indoor","18000"]},{"id":"SP089","n":"คอยล์ร้อน (Condenser Coil) 9,000 BTU","c":"unit","p":3200,"u":"ชิ้น","k":["condenser","คอยล์ร้อน","coil","outdoor","9000"]},{"id":"SP090","n":"คอยล์ร้อน (Condenser Coil) 12,000 BTU","c":"unit","p":3900,"u":"ชิ้น","k":["condenser","คอยล์ร้อน","coil","outdoor","12000"]},{"id":"SP091","n":"คอยล์ร้อน (Condenser Coil) 18,000 BTU","c":"unit","p":5500,"u":"ชิ้น","k":["condenser","คอยล์ร้อน","coil","outdoor","18000"]},{"id":"SP092","n":"คอยล์ร้อน (Condenser Coil) 24,000 BTU","c":"unit","p":7200,"u":"ชิ้น","k":["condenser","คอยล์ร้อน","coil","outdoor","24000"]},{"id":"SP093","n":"ตัวเครื่อง Indoor 9,000 BTU (ยูนิตเปล่า)","c":"unit","p":5500,"u":"ชุด","k":["indoor unit","ตัวเครื่อง","9000","BTU","ยูนิต"]},{"id":"SP094","n":"ตัวเครื่อง Indoor 12,000 BTU (ยูนิตเปล่า)","c":"unit","p":6800,"u":"ชุด","k":["indoor unit","ตัวเครื่อง","12000","BTU","ยูนิต"]},{"id":"SP095","n":"ตัวเครื่อง Outdoor 9,000 BTU (ยูนิตเปล่า)","c":"unit","p":7500,"u":"ชุด","k":["outdoor unit","ตัวเครื่อง","9000","BTU","คอยล์ร้อน"]},{"id":"SP096","n":"ตัวเครื่อง Outdoor 12,000 BTU (ยูนิตเปล่า)","c":"unit","p":9200,"u":"ชุด","k":["outdoor unit","ตัวเครื่อง","12000","BTU","คอยล์ร้อน"]},{"id":"SP097","n":"รีโมทคอนโทรล Universal แอร์","c":"unit","p":380,"u":"อัน","k":["remote","รีโมต","universal","controller","สำรอง"]},{"id":"SP098","n":"แผงหน้า Indoor (Front Panel) 9,000-12,000","c":"unit","p":850,"u":"ชิ้น","k":["front panel","แผงหน้า","cover","indoor","เปลือก"]},{"id":"SP099","n":"ฝาครอบ Outdoor (Cabinet) 9,000-12,000","c":"unit","p":1200,"u":"ชิ้น","k":["cabinet","ฝาครอบ","outdoor","เปลือก","cover"]},{"id":"SP100","n":"ราวแขวน Indoor (Mounting Bracket)","c":"hardware","p":280,"u":"ชุด","k":["bracket","ราวแขวน","mounting","indoor","ยึด"]},{"id":"SP101","n":"ขาตั้ง Outdoor (Floor Stand) ปรับได้","c":"hardware","p":650,"u":"ชุด","k":["stand","ขาตั้ง","outdoor","floor","adjustable"]},{"id":"SP102","n":"สกรูยึด M6x20 (แพ็ค 20)","c":"hardware","p":55,"u":"แพ็ค","k":["screw","สกรู","M6","20mm","ยึด"]},{"id":"SP103","n":"สกรูยึด M8x30 (แพ็ค 20)","c":"hardware","p":70,"u":"แพ็ค","k":["screw","สกรู","M8","30mm","ยึด"]},{"id":"SP104","n":"ปลั๊กและซ็อกเก็ต 3P 15A","c":"hardware","p":220,"u":"ชุด","k":["plug","socket","ปลั๊ก","15A","3P","power"]},{"id":"SP105","n":"ปลั๊กและซ็อกเก็ต 3P 30A","c":"hardware","p":380,"u":"ชุด","k":["plug","socket","ปลั๊ก","30A","3P","power"]},{"id":"SP106","n":"เทปพันท่อ PVC ขาว (แพ็ค 3 ม้วน)","c":"hardware","p":90,"u":"แพ็ค","k":["tape","เทป","PVC","พันท่อ","ขาว"]},{"id":"SP107","n":"เทปโฟมกันน้ำ (Butyl Tape) 50mm","c":"hardware","p":180,"u":"ม้วน","k":["butyl","foam tape","กันน้ำ","กันรั่ว","seal"]},{"id":"SP108","n":"ซิลิโคนกาแนกซีล (Silicone Sealant) 300ml","c":"hardware","p":145,"u":"หลอด","k":["silicone","ซิลิโคน","sealant","กาแนก","กันน้ำ"]},{"id":"SP109","n":"กาวร้อน อีพ็อกซี่ (2 หลอด)","c":"hardware","p":125,"u":"ชุด","k":["epoxy","กาวร้อน","กาว","สองส่วน","ยึด"]},{"id":"SP110","n":"เคเบิ้ลไทร์ 20cm (แพ็ค 100)","c":"hardware","p":68,"u":"แพ็ค","k":["cable tie","เคเบิ้ลไทร์","รัดสาย","nylon","20cm"]},{"id":"SP111","n":"เคเบิ้ลไทร์ 30cm (แพ็ค 100)","c":"hardware","p":85,"u":"แพ็ค","k":["cable tie","เคเบิ้ลไทร์","รัดสาย","nylon","30cm"]},{"id":"SP112","n":"น็อตและสปริงวอชเชอร์ M8 (แพ็ค 10)","c":"hardware","p":65,"u":"แพ็ค","k":["nut","washer","น็อต","M8","spring","ยึด"]},{"id":"SP113","n":"ตะขอแขวนท่อ Pipe Hanger 1/2 นิ้ว (แพ็ค 10)","c":"hardware","p":120,"u":"แพ็ค","k":["hanger","ตะขอ","pipe","1/2","แขวน","ท่อ"]},{"id":"SP114","n":"ตะขอแขวนท่อ Pipe Hanger 3/4 นิ้ว (แพ็ค 10)","c":"hardware","p":145,"u":"แพ็ค","k":["hanger","ตะขอ","pipe","3/4","แขวน","ท่อ"]},{"id":"SP115","n":"แผ่นยางกันสั่น Vibration Pad (ชุด 4 แผ่น)","c":"hardware","p":280,"u":"ชุด","k":["vibration pad","ยางกันสั่น","anti-vibration","outdoor","ลดเสียง"]},{"id":"SP116","n":"กาวเชื่อมท่อ PVC (กระป๋อง 100ml)","c":"hardware","p":85,"u":"กระป๋อง","k":["PVC glue","กาวท่อ","cement","drain","ระบาย"]},{"id":"SP117","n":"แผ่นยางหนวดกันรั่ว (Gasket Set)","c":"hardware","p":220,"u":"ชุด","k":["gasket","ยางซีล","กันรั่ว","seal","ท่อน้ำยา"]},{"id":"SP118","n":"Drier Filter (ไดรเออร์) 1/4 นิ้ว","c":"hardware","p":380,"u":"ตัว","k":["drier","filter","ไดรเออร์","moisture","ดูดน้ำ"]},{"id":"SP119","n":"สายวัดแรงดันน้ำยา (Manifold Gauge Set) R32","c":"hardware","p":2200,"u":"ชุด","k":["manifold","gauge","วัดแรงดัน","R32","น้ำยา"]},{"id":"SP120","n":"ถังสูญญากาศ (Vacuum Pump) 2CFM","c":"hardware","p":3500,"u":"ตัว","k":["vacuum pump","ปั๊มสูญญากาศ","2CFM","evacuate","ไล่ความชื้น"]}];

const SPARE_CAT_META = {
  "electrical": {
    "label": "ไฟฟ้า",
    "icon": "⚡"
  },
  "compressor": {
    "label": "คอมเพรสเซอร์",
    "icon": "⚙️"
  },
  "fan": {
    "label": "พัดลม / มอเตอร์",
    "icon": "🌀"
  },
  "cleaning": {
    "label": "ล้างทำความสะอาด",
    "icon": "🧹"
  },
  "refrigerant": {
    "label": "น้ำยา / สารทำความเย็น",
    "icon": "❄️"
  },
  "pipe": {
    "label": "ท่อ / ข้อต่อ",
    "icon": "🔩"
  },
  "hardware": {
    "label": "อุปกรณ์ทั่วไป",
    "icon": "🔧"
  },
  "unit": {
    "label": "ชุดแอร์ / ยูนิต",
    "icon": "🏠"
  }
};

// ── ค้นหา spare parts ──────────────────────────────
function searchSpareParts(q, cat) {
  const kw = (q||'').toLowerCase().trim();
  return SPARE_PARTS.filter(s => {
    if (cat && s.c !== cat) return false;
    if (!kw) return true;
    return s.n.toLowerCase().includes(kw) ||
           s.id.toLowerCase().includes(kw) ||
           (s.k||[]).some(k => k.toLowerCase().includes(kw));
  });
}

// ── เปิด spare parts picker (เรียกจาก TechReq) ──────
function openSparePicker(rowIdx) {
  // ลบ picker เดิมถ้ามี
  document.querySelectorAll('.spare-picker-ov,.spare-picker-sh').forEach(e=>e.remove());

  let _pickerCat = '';
  let _pickerQ   = '';

  const ov = document.createElement('div');
  ov.className = 'spare-picker-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9500;backdrop-filter:blur(4px)';
  ov.onclick = e => { if(e.target===ov) _closeSparePicker(); };

  // คำนวณ left เพื่อให้ sheet อยู่ใน main-col area (ไม่ทับ sidebar)
  const _shLeft = (() => {
    const mainCol = document.getElementById('main-col');
    if (mainCol) return mainCol.getBoundingClientRect().left + 'px';
    const navEl = document.querySelector('.bottom-nav');
    const navW  = navEl ? navEl.offsetWidth : 0;
    return navW > 60 ? navW + 'px' : '0px';
  })();

  const sh = document.createElement('div');
  sh.className = 'spare-picker-sh';
  sh.style.cssText = `position:fixed;bottom:0;left:${_shLeft};right:0;z-index:9600;background:var(--bg);border-radius:22px 22px 0 0;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -12px 48px rgba(0,0,0,0.2)`;

  sh.innerHTML = `
    <div style="display:flex;justify-content:center;padding:10px 0 0;flex-shrink:0">
      <div style="width:36px;height:4px;background:#cbd5e1;border-radius:99px"></div>
    </div>
    <!-- header -->
    <div style="padding:10px 16px 12px;flex-shrink:0;background:var(--bg);border-bottom:1px solid #e2e8f0">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <button onclick="_closeSparePicker()" style="width:34px;height:34px;border-radius:50%;background:#e2e8f0;border:none;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center">‹</button>
        <div style="flex:1">
          <div style="font-size:0.92rem;font-weight:800;color:var(--text)">เลือกอะไหล่</div>
          <div style="font-size:0.65rem;color:#64748b">กดเลือกเพื่อเพิ่มในรายการสั่งซื้อ</div>
        </div>
        <div style="font-size:0.68rem;font-weight:700;color:#64748b;background:#e2e8f0;border-radius:99px;padding:3px 10px" id="spare-count-badge">300 รายการ</div>
      </div>
      <!-- search bar -->
      <div style="position:relative;margin-bottom:8px">
        <svg style="position:absolute;left:11px;top:50%;transform:translateY(-50%);pointer-events:none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="spare-search-q" type="text" placeholder="ค้นหาอะไหล่... (ชื่อ, รหัส)"
          style="width:100%;padding:10px 12px 10px 34px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:0.85rem;font-family:inherit;outline:none;background:var(--card);box-sizing:border-box"
          oninput="_renderSpareList()"
          onfocus="this.style.borderColor='#e65100'" onblur="this.style.borderColor='#e2e8f0'"/>
      </div>
      <!-- category tabs -->
      <div style="display:flex;gap:5px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none" id="spare-cat-tabs">
        <button onclick="_setSparecat('')" id="spare-cat-all"
          style="flex-shrink:0;padding:5px 12px;border-radius:99px;border:1.5px solid #e65100;background:#e65100;color:white;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit">
          ทั้งหมด
        </button>
        ${Object.entries(SPARE_CAT_META).map(([k,v])=>`
        <button onclick="_setSparecat('${k}')" id="spare-cat-${k}"
          style="flex-shrink:0;padding:5px 12px;border-radius:99px;border:1.5px solid #e2e8f0;background:var(--card);color:#64748b;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit">
          ${v.icon} ${v.label}
        </button>`).join('')}
      </div>
    </div>
    <!-- list -->
    <div id="spare-list-body" style="flex:1;overflow-y:auto;padding:10px 12px"></div>
  `;

  document.body.appendChild(ov);
  document.body.appendChild(sh);

  window._sparePickerRowIdx = rowIdx;
  window._sparePickerCat    = '';

  // ── inner functions ──
  window._closeSparePicker = () => {
    document.querySelectorAll('.spare-picker-ov,.spare-picker-sh').forEach(e=>e.remove());
    delete window._sparePickerRowIdx;
    delete window._sparePickerCat;
    delete window._renderSpareList;
    delete window._setSparecat;
    delete window._closeSparePicker;
  };

  window._setSparecat = (cat) => {
    window._sparePickerCat = cat;
    // update tab styles
    document.querySelectorAll('[id^="spare-cat-"]').forEach(b => {
      const isActive = (cat === '' && b.id==='spare-cat-all') || b.id==='spare-cat-'+cat;
      b.style.background   = isActive ? '#e65100' : 'white';
      b.style.color        = isActive ? 'white'   : '#64748b';
      b.style.borderColor  = isActive ? '#e65100' : '#e2e8f0';
    });
    window._renderSpareList();
  };

  window._renderSpareList = () => {
    const q   = document.getElementById('spare-search-q')?.value || '';
    const cat = window._sparePickerCat || '';
    const results = searchSpareParts(q, cat);
    const body = document.getElementById('spare-list-body');
    const badge = document.getElementById('spare-count-badge');
    if (badge) badge.textContent = results.length + ' รายการ';
    if (!results.length) {
      body.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#94a3b8"><div style="font-size:2rem;margin-bottom:8px">🔍</div><div style="font-size:0.82rem;font-weight:600">ไม่พบรายการที่ค้นหา</div></div>';
      return;
    }
    body.innerHTML = results.map(s => {
      const meta = SPARE_CAT_META[s.c] || {icon:'📦',label:s.c};
      return `<div onclick="_selectSpare('${s.id}')" data-spare-id="${s.id}"
        style="background:var(--card);border:1.5px solid #e2e8f0;border-radius:13px;padding:11px 14px;margin-bottom:6px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:border-color 0.15s"
        onmouseover="this.style.borderColor='#e65100';this.style.background='#fff7ed'"
        onmouseout="this.style.borderColor='#e2e8f0';this.style.background='white'">
        <div style="width:38px;height:38px;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">${meta.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:0.82rem;font-weight:700;color:var(--text);line-height:1.3">${escapeHtml(s.n)}</div>
          <div style="display:flex;align-items:center;gap:5px;margin-top:3px;flex-wrap:wrap">
            <span style="font-size:0.6rem;color:#94a3b8;font-weight:600;font-family:monospace">${s.id}</span>
            <span style="font-size:0.6rem;background:var(--bg-2,#f1f5f9);color:#64748b;border-radius:4px;padding:1px 6px;font-weight:600">${meta.icon} ${meta.label}</span>
            <span style="font-size:0.6rem;color:#64748b">/${s.u}</span>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:0.92rem;font-weight:900;color:#e65100">฿${s.p.toLocaleString()}</div>
          <div style="font-size:0.6rem;color:#94a3b8">/ ${s.u}</div>
        </div>
      </div>`;
    }).join('');
  };

  window._selectSpare = (spareId) => {
    const s = SPARE_PARTS.find(x=>x.id===spareId); if (!s) return;
    const idx = window._sparePickerRowIdx;
    if (typeof idx === 'number' && Array.isArray(_techReqRows)) {
      // ถ้า row ว่างอยู่ → fill, ไม่งั้น → เพิ่ม row ใหม่
      if (idx < _techReqRows.length && !_techReqRows[idx].name) {
        _techReqRows[idx].name  = s.n;
        _techReqRows[idx].price = s.p;
        _techReqRows[idx].note  = s.id + ' / ' + (SPARE_CAT_META[s.c]?.label||s.c);
      } else {
        _techReqRows.push({name:s.n, qty:1, price:s.p, note:s.id+' / '+(SPARE_CAT_META[s.c]?.label||s.c)});
      }
      renderTechReqRows();
    }
    _closeSparePicker();
    showToast('✅ เพิ่ม "'+s.n+'" แล้ว');
  };

  window._renderSpareList();

  // keyboard safe
  if (window.visualViewport) {
    const _kbFix = () => {
      if (!document.body.contains(sh)) { window.visualViewport.removeEventListener('resize',_kbFix); return; }
      const kbH = window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop;
      sh.style.maxHeight = (window.visualViewport.height * 0.94) + 'px';
      sh.style.bottom    = Math.max(0, kbH) + 'px';
    };
    window.visualViewport.addEventListener('resize', _kbFix);
    _kbFix();
  }
}


// ══════════════════════════════════════════════════════
//  SPARE PARTS ADMIN MANAGER
//  Admin จัดการ catalog: เพิ่ม / แก้ไข / ลบ / นำเข้า
// ══════════════════════════════════════════════════════

function openSpareManager() {
  document.getElementById('_sm_page')?.remove();
  const page = document.createElement('div');
  page.id = '_sm_page';
  page.style.cssText = _overlayStyle(9600, '#f1f5f9', '0.25s');

  // ── Catalog version check: seed ถ้าว่างเปล่า หรือ version เก่ากว่า SPARE_CATALOG_VERSION ──
  // โหลดจาก localStorage ก่อน (กรณี fsSave ยังไม่ sync กลับมา)
  if (!Array.isArray(db.spareParts) || db.spareParts.length === 0) {
    try {
      const raw = localStorage.getItem(typeof DB_KEY !== 'undefined' ? DB_KEY : 'aircon_db');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.spareParts) && parsed.spareParts.length > 0) {
          db.spareParts = parsed.spareParts;
          if (typeof parsed.spareCatalogVersion === 'number') {
            db.spareCatalogVersion = parsed.spareCatalogVersion;
          }
        }
      }
    } catch(e) {}
  }

  // ตรวจ version: ถ้า catalog เก่ากว่า หรือยังไม่มีข้อมูล → seed ใหม่ (merge: รักษา qty เดิม)
  const storedVersion = db.spareCatalogVersion || 0;
  const needsSeed = !Array.isArray(db.spareParts) || db.spareParts.length === 0;
  const needsUpdate = !needsSeed && storedVersion < SPARE_CATALOG_VERSION;

  if (needsSeed) {
    // seed ครั้งแรก
    db.spareParts = SPARE_PARTS.map(s => ({
      id: s.id, name: s.n, category: s.c,
      price: s.p, unit: s.u,
      keywords: s.k || [],
      isActive: true
    }));
    db.spareCatalogVersion = SPARE_CATALOG_VERSION;
  } else if (needsUpdate) {
    // merge: เพิ่ม/อัปเดต items จาก SPARE_PARTS ใหม่ แต่รักษา custom items และ qty ของเดิม
    const existingMap = {};
    (db.spareParts || []).forEach(s => { existingMap[s.id] = s; });
    SPARE_PARTS.forEach(s => {
      if (!existingMap[s.id]) {
        // item ใหม่ที่ยังไม่มีใน db → เพิ่ม
        db.spareParts.push({ id: s.id, name: s.n, category: s.c,
          price: s.p, unit: s.u, keywords: s.k || [], isActive: true });
      } else {
        // อัปเดตเฉพาะ name/category/price/unit จาก catalog ใหม่ (รักษา isActive และ qty)
        const existing = existingMap[s.id];
        existing.name = s.n;
        existing.category = s.c;
        existing.price = s.p;
        existing.unit = s.u;
        existing.keywords = s.k || [];
      }
    });
    db.spareCatalogVersion = SPARE_CATALOG_VERSION;
    console.log(`[SpareParts] Catalog updated v${storedVersion} → v${SPARE_CATALOG_VERSION}`);
  }

  const CAT_COLORS = {
    electrical:  {bg:'#fef9c3',accent:'#ca8a04',border:'#fde68a',icon:'⚡'},
    compressor:  {bg:'#f0f9ff',accent:'#0369a1',border:'#bae6fd',icon:'⚙️'},
    fan:         {bg:'#f0fdf4',accent:'#15803d',border:'#bbf7d0',icon:'🌀'},
    cleaning:    {bg:'#ecfdf5',accent:'#059669',border:'#a7f3d0',icon:'🧹'},
    refrigerant: {bg:'#eff6ff',accent:'#1d4ed8',border:'#bfdbfe',icon:'❄️'},
    pipe:        {bg:'#fff7ed',accent:'#c2410c',border:'#fed7aa',icon:'🔩'},
    hardware:    {bg:'#f5f3ff',accent:'#7c3aed',border:'#ddd6fe',icon:'🔧'},
    unit:        {bg:'#fdf2f8',accent:'#be185d',border:'#fbcfe8',icon:'🏠'},
  };

  let _smCat = '';
  let _smQ   = '';
  let _smEditId = null; // null = list, string = editing item id

  const _smClose = () => {
    page.remove();
    if (typeof updateTopbarTitle === 'function')
      updateTopbarTitle(document.querySelector('.page.active')?.dataset.page || '');
  };

  const _smFiltered = () => {
    const kw = _smQ.toLowerCase();
    return (db.spareParts || []).filter(s => {
      if (_smCat && s.category !== _smCat) return false;
      if (!kw) return true;
      return s.name.toLowerCase().includes(kw) ||
             (s.id||'').toLowerCase().includes(kw) ||
             (s.keywords||[]).some(k => k.toLowerCase().includes(kw));
    });
  };

  const render = () => {
    if (_smEditId !== null) renderEdit();
    else renderList();
  };

  const renderList = () => {
    const items = _smFiltered();
    const total = (db.spareParts||[]).length;
    const active = (db.spareParts||[]).filter(s=>s.isActive!==false).length;

    // group counts for tabs
    const catCounts = {};
    (db.spareParts||[]).forEach(s => {
      catCounts[s.category] = (catCounts[s.category]||0) + 1;
    });

    page.innerHTML = `
      <!-- HEADER -->
      <div style="background:linear-gradient(160deg,#0c1a0e 0%,#14532d 50%,#16a34a 100%);padding:14px 16px 16px;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <button onclick="document.getElementById('_sm_page').remove()" style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);color:white;font-size:1.3rem;cursor:pointer;display:flex;align-items:center;justify-content:center">‹</button>
          <div style="flex:1">
            <div style="color:white;font-size:1rem;font-weight:900">📦 จัดการรายการอะไหล่</div>
            <div style="color:rgba(255,255,255,.55);font-size:0.62rem;margin-top:2px">${total} รายการ · ${active} รายการ active</div>
          </div>
          <button onclick="window._smNew()" style="background:var(--card);color:#15803d;border:none;border-radius:12px;padding:9px 14px;font-size:0.78rem;font-weight:900;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px;box-shadow:0 3px 12px rgba(0,0,0,0.2)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>เพิ่ม
          </button>
        </div>
        <!-- search -->
        <div style="position:relative;margin-bottom:8px">
          <svg style="position:absolute;left:11px;top:50%;transform:translateY(-50%);pointer-events:none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="sm-search" type="text" placeholder="ค้นหา..."
            value="${escapeHtml(_smQ)}"
            style="width:100%;padding:9px 12px 9px 32px;border:1.5px solid rgba(255,255,255,.3);border-radius:11px;font-size:0.84rem;font-family:inherit;outline:none;background:rgba(255,255,255,.15);color:white;box-sizing:border-box"
            oninput="window._smSetQ(this.value)"
            onfocus="this.style.borderColor='white'" onblur="this.style.borderColor='rgba(255,255,255,.3)'"/>
        </div>
        <!-- category tabs -->
        <div style="display:flex;gap:5px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none">
          <button onclick="window._smSetCat('')"
            style="flex-shrink:0;padding:4px 12px;border-radius:99px;border:1.5px solid ${_smCat===''?'white':'rgba(255,255,255,.35)'};background:${_smCat===''?'white':'transparent'};color:${_smCat===''?'#15803d':'white'};font-size:0.68rem;font-weight:700;cursor:pointer;font-family:inherit">
            ทั้งหมด (${total})
          </button>
          ${Object.entries(CAT_COLORS).map(([k,v])=>`
          <button onclick="window._smSetCat('${k}')"
            style="flex-shrink:0;padding:4px 12px;border-radius:99px;border:1.5px solid ${_smCat===k?'white':'rgba(255,255,255,.35)'};background:${_smCat===k?'white':'transparent'};color:${_smCat===k?'#15803d':'white'};font-size:0.68rem;font-weight:700;cursor:pointer;font-family:inherit">
            ${v.icon} ${SPARE_CAT_META[k]?.label||k} (${catCounts[k]||0})
          </button>`).join('')}
        </div>
      </div>

      <!-- LIST BODY -->
      <div style="flex:1;overflow-y:auto;padding:10px 12px 20px;background:var(--bg)">
        ${items.length === 0 ? `
          <div style="text-align:center;padding:48px 20px;color:#94a3b8">
            <div style="font-size:2.5rem;margin-bottom:8px">🔍</div>
            <div style="font-size:0.85rem;font-weight:600">ไม่พบรายการ</div>
            <div style="font-size:0.72rem;margin-top:4px">ลองค้นหาด้วยคำอื่น หรือเปลี่ยนหมวด</div>
          </div>
        ` : items.map(s => {
          const cc = CAT_COLORS[s.category] || {bg:'#f1f5f9',accent:'#64748b',border:'#e2e8f0',icon:'📦'};
          const inactive = s.isActive === false;
          return `
          <div style="background:${inactive?'#f8fafc':'white'};border:1.5px solid ${inactive?'#e2e8f0':cc.border};border-radius:13px;margin-bottom:6px;padding:11px 12px;display:flex;align-items:center;gap:10px;${inactive?'opacity:0.55':''}">
            <div style="width:36px;height:36px;border-radius:10px;background:${cc.bg};border:1px solid ${cc.border};display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">${cc.icon}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.82rem;font-weight:700;color:var(--text);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(s.name)}</div>
              <div style="display:flex;align-items:center;gap:5px;margin-top:3px">
                <span style="font-size:0.58rem;color:#94a3b8;font-family:monospace">${s.id||''}</span>
                <span style="font-size:0.6rem;background:${cc.bg};color:${cc.accent};border-radius:4px;padding:1px 6px;font-weight:700">${SPARE_CAT_META[s.category]?.label||s.category}</span>
                ${inactive?'<span style="font-size:0.6rem;background:#fee2e2;color:#dc2626;border-radius:4px;padding:1px 6px;font-weight:700">ปิดใช้งาน</span>':''}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0;margin-right:4px">
              <div style="font-size:0.88rem;font-weight:900;color:${cc.accent}">฿${(s.price||0).toLocaleString()}</div>
              <div style="font-size:0.6rem;color:#94a3b8">/${s.unit||'ชิ้น'}</div>
            </div>
            <button onclick="window._smEdit('${s.id}')"
              style="width:34px;height:34px;border-radius:10px;background:${cc.bg};border:1.5px solid ${cc.border};cursor:pointer;color:${cc.accent};font-size:0.8rem;display:flex;align-items:center;justify-content:center;flex-shrink:0">✏️</button>
          </div>`;
        }).join('')}
      </div>
    `;
  };

  const renderEdit = () => {
    const isNew = _smEditId === '__new__';
    let s = isNew
      ? { id:'SP'+(Date.now()%100000).toString().padStart(5,'0'), name:'', category:'hardware', price:0, unit:'ชิ้น', keywords:[], isActive:true }
      : (db.spareParts||[]).find(x=>x.id===_smEditId) || {};

    const cc = CAT_COLORS[s.category] || CAT_COLORS.hardware;

    page.innerHTML = `
      <div style="background:linear-gradient(160deg,#0c1a0e 0%,#14532d 50%,#16a34a 100%);padding:12px 16px 16px;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:12px">
          <button onclick="window._smBackToList()" style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);color:white;font-size:1.3rem;cursor:pointer;display:flex;align-items:center;justify-content:center">‹</button>
          <div style="flex:1">
            <div style="color:white;font-size:1rem;font-weight:900">${isNew?'เพิ่มอะไหล่ใหม่':'แก้ไขอะไหล่'}</div>
            <div style="color:rgba(255,255,255,.5);font-size:0.62rem;margin-top:2px">${s.id||''}</div>
          </div>
          <button onclick="window._smSave()" style="background:var(--card);color:#15803d;border:none;border-radius:12px;padding:9px 16px;font-size:0.78rem;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,0.15)">💾 บันทึก</button>
        </div>
      </div>

      <div style="flex:1;overflow-y:auto;padding:14px 14px 32px;background:var(--bg)">

        <!-- basic info card -->
        <div style="background:var(--card);border-radius:16px;padding:16px;margin-bottom:12px;border:1.5px solid #e2e8f0">
          <div style="font-size:0.62rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">ข้อมูลอะไหล่</div>

          <div style="margin-bottom:10px">
            <div style="font-size:0.68rem;font-weight:700;color:#64748b;margin-bottom:5px">รหัสอะไหล่</div>
            <input id="sm-id" value="${escapeHtml(s.id||'')}" placeholder="SP001"
              style="width:100%;border:1.5px solid var(--border);border-radius:10px;padding:10px 13px;font-size:0.85rem;font-family:monospace;outline:none;box-sizing:border-box;color:var(--text2)"
              onfocus="this.style.borderColor='#16a34a'" onblur="this.style.borderColor='#e5e7eb'"/>
          </div>

          <div style="margin-bottom:10px">
            <div style="font-size:0.68rem;font-weight:700;color:#64748b;margin-bottom:5px">ชื่ออะไหล่ *</div>
            <input id="sm-name" value="${escapeHtml(s.name||'')}" placeholder="เช่น คอยล์เย็น, มอเตอร์พัดลม"
              style="width:100%;border:1.5px solid var(--border);border-radius:10px;padding:10px 13px;font-size:0.88rem;font-family:inherit;font-weight:700;outline:none;box-sizing:border-box;color:var(--text)"
              onfocus="this.style.borderColor='#16a34a'" onblur="this.style.borderColor='#e5e7eb'"/>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
            <div>
              <div style="font-size:0.68rem;font-weight:700;color:#64748b;margin-bottom:5px">ราคา (฿) *</div>
              <input id="sm-price" type="number" value="${s.price||0}" min="0"
                style="width:100%;border:1.5px solid var(--border);border-radius:10px;padding:10px 13px;font-size:0.88rem;font-family:inherit;font-weight:800;outline:none;box-sizing:border-box;color:#15803d"
                onfocus="this.style.borderColor='#16a34a'" onblur="this.style.borderColor='#e5e7eb'"/>
            </div>
            <div>
              <div style="font-size:0.68rem;font-weight:700;color:#64748b;margin-bottom:5px">หน่วย</div>
              <select id="sm-unit" style="width:100%;border:1.5px solid var(--border);border-radius:10px;padding:10px 13px;font-size:0.84rem;font-family:inherit;outline:none;background:var(--card);box-sizing:border-box;color:var(--text2)">
                ${['ชิ้น','อัน','ชุด','ม.','กก.','ลิตร','ฟุต','EA','JOB','KG','M'].map(u=>`<option value="${u}" ${(s.unit||'ชิ้น')===u?'selected':''}>${u}</option>`).join('')}
              </select>
            </div>
          </div>

          <div style="margin-bottom:10px">
            <div style="font-size:0.68rem;font-weight:700;color:#64748b;margin-bottom:5px">หมวดหมู่</div>
            <div id="sm-cat-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
              ${Object.entries(CAT_COLORS).map(([k,v])=>`
              <button onclick="window._smPickCat('${k}')" id="sm-cat-${k}"
                style="padding:8px 4px;border-radius:10px;border:2px solid ${s.category===k?v.accent:'#e2e8f0'};background:${s.category===k?v.bg:'white'};cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:3px">
                <span style="font-size:1rem">${v.icon}</span>
                <span style="font-size:0.55rem;font-weight:700;color:${s.category===k?v.accent:'#64748b'};text-align:center;line-height:1.2">${SPARE_CAT_META[k]?.label||k}</span>
              </button>`).join('')}
            </div>
          </div>
        </div>

        <!-- keywords card -->
        <div style="background:var(--card);border-radius:16px;padding:16px;margin-bottom:12px;border:1.5px solid #e2e8f0">
          <div style="font-size:0.62rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Keywords (ช่วยค้นหา)</div>
          <input id="sm-keywords" value="${(s.keywords||[]).join(', ')}" placeholder="เช่น คอยล์, โคลด์, evaporator"
            style="width:100%;border:1.5px solid var(--border);border-radius:10px;padding:10px 13px;font-size:0.82rem;font-family:inherit;outline:none;box-sizing:border-box;color:var(--text2)"
            onfocus="this.style.borderColor='#16a34a'" onblur="this.style.borderColor='#e5e7eb'"/>
          <div style="font-size:0.62rem;color:#94a3b8;margin-top:5px">คั่นด้วย comma เช่น "แอร์, air, cooling"</div>
        </div>

        <!-- status + delete -->
        <div style="background:var(--card);border-radius:16px;padding:16px;border:1.5px solid #e2e8f0">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-size:0.82rem;font-weight:700;color:var(--text)">เปิดใช้งาน</div>
              <div style="font-size:0.68rem;color:#64748b;margin-top:2px">ปิดเพื่อซ่อนจากช่าง แต่ไม่ลบข้อมูล</div>
            </div>
            <label style="position:relative;display:inline-block;width:48px;height:26px;flex-shrink:0">
              <input type="checkbox" id="sm-active" ${s.isActive!==false?'checked':''}
                style="opacity:0;width:0;height:0;position:absolute"
                onchange="document.getElementById('sm-active-track').style.background=this.checked?'#16a34a':'#d1d5db';document.getElementById('sm-active-knob').style.transform=this.checked?'translateX(22px)':'translateX(0)'"/>
              <span id="sm-active-track" style="position:absolute;inset:0;border-radius:13px;background:${s.isActive!==false?'#16a34a':'#d1d5db'};transition:background 0.2s;cursor:pointer"
                onclick="const cb=document.getElementById('sm-active');cb.checked=!cb.checked;this.style.background=cb.checked?'#16a34a':'#d1d5db';document.getElementById('sm-active-knob').style.transform=cb.checked?'translateX(22px)':'translateX(0)'"></span>
              <span id="sm-active-knob" style="position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:var(--card);box-shadow:0 1px 4px rgba(0,0,0,0.2);transition:transform 0.2s;pointer-events:none;transform:${s.isActive!==false?'translateX(22px)':'translateX(0)'}"></span>
            </label>
          </div>
          ${!isNew?`
          <div style="border-top:1px solid #f1f5f9;margin-top:14px;padding-top:14px">
            <button onclick="window._smDelete('${s.id}')"
              style="width:100%;padding:11px;border:1.5px solid #fecaca;border-radius:11px;background:#fff0f2;color:#dc2626;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit">
              🗑 ลบรายการนี้
            </button>
          </div>`:''
        }
        </div>
      </div>
    `;

    // store temp category
    window._smCurrentCat = s.category || 'hardware';
  };

  // ── Expose render + state setters to window (needed by inline onclick/oninput) ──
  window._smRender    = () => render();
  window._smSetQ      = (v) => { _smQ = v; renderList(); };
  window._smSetCat    = (v) => { _smCat = v; renderList(); };
  window._smBackToList = () => { _smEditId = null; renderList(); };

  // ── Handlers ──
  window._smNew   = () => { _smEditId = '__new__'; render(); };
  window._smEdit  = (id) => { _smEditId = id; render(); };

  window._smPickCat = (cat) => {
    window._smCurrentCat = cat;
    Object.entries(CAT_COLORS).forEach(([k,v]) => {
      const btn = document.getElementById('sm-cat-'+k);
      if (!btn) return;
      btn.style.borderColor = k===cat ? v.accent : '#e2e8f0';
      btn.style.background  = k===cat ? v.bg     : 'white';
      const lbl = btn.querySelector('span:last-child');
      if (lbl) lbl.style.color = k===cat ? v.accent : '#64748b';
    });
  };

  window._smSave = () => {
    const id    = document.getElementById('sm-id')?.value.trim();
    const name  = document.getElementById('sm-name')?.value.trim();
    const price = parseFloat(document.getElementById('sm-price')?.value) || 0;
    const unit  = document.getElementById('sm-unit')?.value || 'ชิ้น';
    const kwRaw = document.getElementById('sm-keywords')?.value || '';
    const kws   = kwRaw.split(',').map(k=>k.trim()).filter(Boolean);
    const active= document.getElementById('sm-active')?.checked !== false;
    const cat   = window._smCurrentCat || 'hardware';

    if (!name) { showToast('⚠️ กรุณาระบุชื่ออะไหล่'); return; }
    if (!id)   { showToast('⚠️ กรุณาระบุรหัสอะไหล่'); return; }

    if (!db.spareParts) db.spareParts = [];

    const isNew = _smEditId === '__new__';
    if (isNew) {
      // ตรวจ ID ซ้ำ
      if (db.spareParts.find(s=>s.id===id)) {
        showToast('⚠️ รหัส '+id+' ซ้ำกับรายการที่มีอยู่แล้ว'); return;
      }
      db.spareParts.push({ id, name, category:cat, price, unit, keywords:kws, isActive:active });
      showToast('✅ เพิ่ม "'+name+'" แล้ว');
    } else {
      const idx = db.spareParts.findIndex(s=>s.id===_smEditId);
      if (idx >= 0) {
        db.spareParts[idx] = { id, name, category:cat, price, unit, keywords:kws, isActive:active };
      }
      showToast('💾 บันทึก "'+name+'" แล้ว');
    }

    // sync กลับ SPARE_PARTS runtime (ให้ picker เห็นข้อมูลใหม่ทันที)
    _smSyncRuntime();
    saveDB();
    if (typeof fsSave === 'function') fsSave();
    _smEditId = null;
    renderList();
  };

  window._smDelete = (id) => {
    if (!confirm('ลบ "' + ((db.spareParts||[]).find(s=>s.id===id)?.name||id) + '"?')) return;
    db.spareParts = (db.spareParts||[]).filter(s=>s.id!==id);
    _smSyncRuntime();
    saveDB();
    if (typeof fsSave === 'function') fsSave();
    showToast('🗑 ลบแล้ว');
    _smEditId = null;
    renderList();
  };

  render();
  document.body.appendChild(page);
  if (typeof updateTopbarTitle === 'function') updateTopbarTitle('spare-manager');
}

// ── sync db.spareParts → SPARE_PARTS runtime array ──────────
function _smSyncRuntime() {
  if (!db.spareParts) return;
  // อัพเดท global SPARE_PARTS ให้ picker ใช้ข้อมูลล่าสุด
  SPARE_PARTS.length = 0;
  db.spareParts.filter(s=>s.isActive!==false).forEach(s => {
    SPARE_PARTS.push({ id:s.id, n:s.name, c:s.category, p:s.price, u:s.unit||'ชิ้น', k:s.keywords||[] });
  });
}

// ── เรียกตอน app init เพื่อ sync db.spareParts → runtime ──
window.addEventListener('appReady', () => {
  if (db.spareParts && db.spareParts.length > 0) {
    _smSyncRuntime();
  }
});


// ══════════════════════════════════════════════════════
//  SPARE PARTS INVENTORY (แยกจาก Catalog)
//  db.spareStock       = { [partId]: { qty, minQty, location, updatedAt } }
//  db.stockMovements   = [ { id, partId, type, qty, ref, note, by, at } ]
//    type: 'in' | 'out' | 'adjust'
//    ref:  ticket id หรือ PO ref (optional)
// ══════════════════════════════════════════════════════

// ── helpers ──────────────────────────────────────────
function _invGetStock(partId) {
  return (db.spareStock || {})[partId] || { qty: 0, minQty: 0, location: '', updatedAt: null };
}

function _invGetCatalogItem(partId) {
  // ค้นจาก db.spareParts ก่อน (editable catalog), fallback → SPARE_PARTS static
  const fromDb = (db.spareParts || []).find(s => s.id === partId);
  if (fromDb) return { id: fromDb.id, name: fromDb.name, category: fromDb.category, unit: fromDb.unit || 'ชิ้น', price: fromDb.price };
  const fromStatic = SPARE_PARTS.find(s => s.id === partId);
  if (fromStatic) return { id: fromStatic.id, name: fromStatic.n, category: fromStatic.c, unit: fromStatic.u, price: fromStatic.p };
  return null;
}

function _invAddMovement({ partId, type, qty, ref = '', note = '', by = '' }) {
  if (!db.stockMovements) db.stockMovements = [];
  if (!db.spareStock) db.spareStock = {};

  const mv = {
    id: 'MV' + Date.now(),
    partId,
    type,     // 'in' | 'out' | 'adjust'
    qty: parseFloat(qty) || 0,
    ref,
    note,
    by: by || (typeof getCurrentUser === 'function' ? (getCurrentUser()?.name || '') : ''),
    at: new Date().toISOString()
  };
  db.stockMovements.push(mv);

  // อัพเดท stock
  const cur = db.spareStock[partId] || { qty: 0, minQty: 0, location: '', updatedAt: null };
  if (type === 'in')     cur.qty = (cur.qty || 0) + mv.qty;
  else if (type === 'out')  cur.qty = Math.max(0, (cur.qty || 0) - mv.qty);
  else if (type === 'adjust') cur.qty = mv.qty; // set absolute
  cur.updatedAt = mv.at;
  db.spareStock[partId] = cur;

  saveDB();
  if (typeof fsSave === 'function') fsSave();
  return mv;
}

// ── ตัวเลขสรุป ──────────────────────────────────────
function _invSummary() {
  const stock = db.spareStock || {};
  const allIds = Object.keys(stock);
  const lowStock = allIds.filter(id => {
    const s = stock[id];
    return s.minQty > 0 && s.qty <= s.minQty;
  });
  const zeroStock = allIds.filter(id => stock[id].qty <= 0);
  return { total: allIds.length, lowStock: lowStock.length, zeroStock: zeroStock.length };
}

// ══════════════════════════════════════════════════════
//  openInventoryManager()  — หน้าจัดการคลังอะไหล่
// ══════════════════════════════════════════════════════
function openInventoryManager() {
  document.getElementById('_inv_page')?.remove();
  const page = document.createElement('div');
  page.id = '_inv_page';
  page.style.cssText = _overlayStyle(9700, '#f1f5f9', '0.25s');

  let _invTab    = 'stock';   // 'stock' | 'movements'
  let _invQ      = '';
  let _invFilter = 'all';     // 'all' | 'low' | 'zero'
  let _invDetailId = null;    // partId กำลัง view/edit

  const CAT_COLORS = {
    electrical:  { bg:'#fef9c3', accent:'#ca8a04', border:'#fde68a', icon:'⚡' },
    compressor:  { bg:'#f0f9ff', accent:'#0369a1', border:'#bae6fd', icon:'⚙️' },
    fan:         { bg:'#f0fdf4', accent:'#15803d', border:'#bbf7d0', icon:'🌀' },
    cleaning:    { bg:'#ecfdf5', accent:'#059669', border:'#a7f3d0', icon:'🧹' },
    refrigerant: { bg:'#eff6ff', accent:'#1d4ed8', border:'#bfdbfe', icon:'❄️' },
    pipe:        { bg:'#fff7ed', accent:'#c2410c', border:'#fed7aa', icon:'🔩' },
    hardware:    { bg:'#f5f3ff', accent:'#7c3aed', border:'#ddd6fe', icon:'🔧' },
    unit:        { bg:'#fdf2f8', accent:'#be185d', border:'#fbcfe8', icon:'🏠' },
  };

  const render = () => {
    if (_invDetailId) renderDetail();
    else if (_invTab === 'movements') renderMovements();
    else renderStock();
  };

  // ── TAB: STOCK ───────────────────────────────────
  const renderStock = () => {
    const stock  = db.spareStock || {};
    const kw     = _invQ.toLowerCase();
    const summary = _invSummary();

    // สร้าง list จาก catalog + stock ที่มีอยู่
    const catalogItems = db.spareParts && db.spareParts.length > 0
      ? db.spareParts.filter(s => s.isActive !== false)
      : SPARE_PARTS.map(s => ({ id:s.id, name:s.n, category:s.c, unit:s.u, price:s.p, isActive:true }));

    let items = catalogItems.map(ci => {
      const s = stock[ci.id] || { qty: 0, minQty: 0, location: '' };
      return { ...ci, ...s };
    });

    // filter
    if (_invFilter === 'low')  items = items.filter(i => i.minQty > 0 && i.qty <= i.minQty);
    if (_invFilter === 'zero') items = items.filter(i => i.qty <= 0);
    if (kw) items = items.filter(i =>
      i.name.toLowerCase().includes(kw) ||
      (i.id||'').toLowerCase().includes(kw) ||
      (i.location||'').toLowerCase().includes(kw)
    );

    page.innerHTML = `
      <!-- HEADER -->
      <div style="background:linear-gradient(160deg,#0c1a2e 0%,#1e3a5f 50%,#1d4ed8 100%);padding:14px 16px 14px;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <button onclick="document.getElementById('_inv_page').remove()" style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);color:white;font-size:1.3rem;cursor:pointer;display:flex;align-items:center;justify-content:center">‹</button>
          <div style="flex:1">
            <div style="color:white;font-size:1rem;font-weight:900">📦 คลังอะไหล่</div>
            <div style="color:rgba(255,255,255,.5);font-size:0.62rem;margin-top:1px">แยกจาก Catalog · track จำนวนจริง</div>
          </div>
          <button onclick="window._invOpenAdjust(null)" style="background:var(--card);color:#1d4ed8;border:none;border-radius:12px;padding:8px 13px;font-size:0.75rem;font-weight:900;cursor:pointer;font-family:inherit">+ รับเข้า</button>
        </div>

        <!-- summary pills -->
        <div style="display:flex;gap:6px;margin-bottom:10px">
          <div onclick="window._invSetFilter('all')" style="flex:1;text-align:center;background:${_invFilter==='all'?'white':'rgba(255,255,255,.12)'};border-radius:10px;padding:7px 4px;cursor:pointer">
            <div style="font-size:1rem;font-weight:900;color:${_invFilter==='all'?'#1d4ed8':'white'}">${summary.total}</div>
            <div style="font-size:0.58rem;font-weight:700;color:${_invFilter==='all'?'#64748b':'rgba(255,255,255,.6)'}">ทั้งหมด</div>
          </div>
          <div onclick="window._invSetFilter('low')" style="flex:1;text-align:center;background:${_invFilter==='low'?'white':'rgba(255,255,255,.12)'};border-radius:10px;padding:7px 4px;cursor:pointer">
            <div style="font-size:1rem;font-weight:900;color:${_invFilter==='low'?'#d97706':'white'}">${summary.lowStock}</div>
            <div style="font-size:0.58rem;font-weight:700;color:${_invFilter==='low'?'#92400e':'rgba(255,255,255,.6)'}">ใกล้หมด</div>
          </div>
          <div onclick="window._invSetFilter('zero')" style="flex:1;text-align:center;background:${_invFilter==='zero'?'white':'rgba(255,255,255,.12)'};border-radius:10px;padding:7px 4px;cursor:pointer">
            <div style="font-size:1rem;font-weight:900;color:${_invFilter==='zero'?'#dc2626':'white'}">${summary.zeroStock}</div>
            <div style="font-size:0.58rem;font-weight:700;color:${_invFilter==='zero'?'#991b1b':'rgba(255,255,255,.6)'}">หมดสต็อก</div>
          </div>
        </div>

        <!-- tabs -->
        <div style="display:flex;gap:4px;margin-bottom:10px">
          <button onclick="window._invTab_('stock')" style="flex:1;padding:7px;border-radius:9px;border:none;background:${_invTab==='stock'?'white':'rgba(255,255,255,.15)'};color:${_invTab==='stock'?'#1d4ed8':'white'};font-size:0.73rem;font-weight:700;cursor:pointer;font-family:inherit">📦 Stock</button>
          <button onclick="window._invTab_('movements')" style="flex:1;padding:7px;border-radius:9px;border:none;background:${_invTab==='movements'?'white':'rgba(255,255,255,.15)'};color:${_invTab==='movements'?'#1d4ed8':'white'};font-size:0.73rem;font-weight:700;cursor:pointer;font-family:inherit">📋 ความเคลื่อนไหว</button>
        </div>

        <!-- search -->
        <div style="position:relative">
          <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="ค้นหาอะไหล่..." value="${escapeHtml(_invQ)}"
            style="width:100%;padding:9px 12px 9px 30px;border:1.5px solid rgba(255,255,255,.3);border-radius:11px;font-size:0.83rem;font-family:inherit;outline:none;background:rgba(255,255,255,.15);color:white;box-sizing:border-box"
            oninput="window._invSetQ(this.value)"
            onfocus="this.style.borderColor='white'" onblur="this.style.borderColor='rgba(255,255,255,.3)'"/>
        </div>
      </div>

      <!-- STOCK LIST -->
      <div style="flex:1;overflow-y:auto;padding:10px 12px 20px;background:var(--bg)">
        ${items.length === 0 ? `
          <div style="text-align:center;padding:48px 20px;color:#94a3b8">
            <div style="font-size:2.5rem;margin-bottom:8px">📦</div>
            <div style="font-size:0.85rem;font-weight:600">ไม่พบรายการ</div>
            <div style="font-size:0.72rem;margin-top:4px">ลองเปลี่ยน filter หรือค้นหาด้วยคำอื่น</div>
          </div>
        ` : items.map(item => {
          const cc = CAT_COLORS[item.category] || { bg:'#f1f5f9', accent:'#64748b', border:'#e2e8f0', icon:'📦' };
          const isLow  = item.minQty > 0 && item.qty > 0 && item.qty <= item.minQty;
          const isZero = item.qty <= 0;
          const qtyColor = isZero ? '#dc2626' : isLow ? '#d97706' : '#16a34a';
          const qtyBg    = isZero ? '#fee2e2' : isLow ? '#fef3c7' : '#dcfce7';
          return `
          <div onclick="window._invOpenDetail('${item.id}')"
            style="background:var(--card);border:1.5px solid ${isZero?'#fecaca':isLow?'#fde68a':cc.border};border-radius:13px;margin-bottom:6px;padding:11px 12px;display:flex;align-items:center;gap:10px;cursor:pointer"
            onmouseover="this.style.borderColor='#1d4ed8';this.style.background='#eff6ff'"
            onmouseout="this.style.borderColor='${isZero?'#fecaca':isLow?'#fde68a':cc.border}';this.style.background='white'">
            <div style="width:36px;height:36px;border-radius:10px;background:${cc.bg};border:1px solid ${cc.border};display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">${cc.icon}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.82rem;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(item.name)}</div>
              <div style="display:flex;align-items:center;gap:5px;margin-top:3px;flex-wrap:wrap">
                <span style="font-size:0.58rem;color:#94a3b8;font-family:monospace">${item.id}</span>
                ${item.location ? `<span style="font-size:0.6rem;background:var(--bg-2,#f1f5f9);color:#475569;border-radius:4px;padding:1px 6px">📍${escapeHtml(item.location)}</span>` : ''}
                ${isZero ? '<span style="font-size:0.6rem;background:#fee2e2;color:#dc2626;border-radius:4px;padding:1px 5px;font-weight:700">หมด</span>' : ''}
                ${isLow  ? '<span style="font-size:0.6rem;background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 5px;font-weight:700">ใกล้หมด</span>' : ''}
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:1.05rem;font-weight:900;color:${qtyColor};background:${qtyBg};border-radius:8px;padding:3px 9px;min-width:38px;text-align:center">${item.qty}</div>
              <div style="font-size:0.58rem;color:#94a3b8;margin-top:2px">${item.unit||'ชิ้น'}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;

    // bind inner vars to closured scope
    window._invTab_    = _invTab;
    window._invQ_      = _invQ;
    window._invTab_    = (v) => { _invTab = v; render(); };
    window._invQ_      = (v) => { _invQ = v; };
    window._invSetFilter = (f) => { _invFilter = f; render(); };
    window._invOpenDetail = (id) => { _invDetailId = id; render(); };
  };

  // ── TAB: MOVEMENTS ──────────────────────────────
  const renderMovements = () => {
    const mvs = (db.stockMovements || []).slice().reverse().slice(0, 100);
    const kw = _invQ.toLowerCase();
    const filtered = kw ? mvs.filter(m => {
      const item = _invGetCatalogItem(m.partId);
      return (item?.name||'').toLowerCase().includes(kw) ||
             m.partId.toLowerCase().includes(kw) ||
             (m.ref||'').toLowerCase().includes(kw) ||
             (m.note||'').toLowerCase().includes(kw);
    }) : mvs;

    const typeLabel = { in:'รับเข้า', out:'เบิกออก', adjust:'ปรับ' };
    const typeColor = { in:'#16a34a', out:'#dc2626', adjust:'#7c3aed' };
    const typeBg    = { in:'#dcfce7', out:'#fee2e2', adjust:'#f3e8ff' };

    page.innerHTML = `
      <!-- HEADER -->
      <div style="background:linear-gradient(160deg,#0c1a2e 0%,#1e3a5f 50%,#1d4ed8 100%);padding:14px 16px 14px;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <button onclick="document.getElementById('_inv_page').remove()" style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);color:white;font-size:1.3rem;cursor:pointer;display:flex;align-items:center;justify-content:center">‹</button>
          <div style="flex:1">
            <div style="color:white;font-size:1rem;font-weight:900">📋 ความเคลื่อนไหว Stock</div>
            <div style="color:rgba(255,255,255,.5);font-size:0.62rem;margin-top:1px">${(db.stockMovements||[]).length} รายการ ล่าสุด 100 รายการ</div>
          </div>
          <button onclick="window._invOpenAdjust(null)" style="background:var(--card);color:#1d4ed8;border:none;border-radius:12px;padding:8px 13px;font-size:0.75rem;font-weight:900;cursor:pointer;font-family:inherit">+ บันทึก</button>
        </div>
        <!-- tabs -->
        <div style="display:flex;gap:4px;margin-bottom:10px">
          <button onclick="window._invTab_('stock')" style="flex:1;padding:7px;border-radius:9px;border:none;background:rgba(255,255,255,.15);color:white;font-size:0.73rem;font-weight:700;cursor:pointer;font-family:inherit">📦 Stock</button>
          <button onclick="window._invTab_('movements')" style="flex:1;padding:7px;border-radius:9px;border:none;background:var(--card);color:#1d4ed8;font-size:0.73rem;font-weight:700;cursor:pointer;font-family:inherit">📋 ความเคลื่อนไหว</button>
        </div>
        <!-- search -->
        <div style="position:relative">
          <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="ค้นหา..." value="${escapeHtml(_invQ)}"
            style="width:100%;padding:9px 12px 9px 30px;border:1.5px solid rgba(255,255,255,.3);border-radius:11px;font-size:0.83rem;font-family:inherit;outline:none;background:rgba(255,255,255,.15);color:white;box-sizing:border-box"
            oninput="window._invSetQ(this.value)"
            onfocus="this.style.borderColor='white'" onblur="this.style.borderColor='rgba(255,255,255,.3)'"/>
        </div>
      </div>

      <div style="flex:1;overflow-y:auto;padding:10px 12px 20px;background:var(--bg)">
        ${filtered.length === 0 ? `
          <div style="text-align:center;padding:48px 20px;color:#94a3b8">
            <div style="font-size:2.5rem;margin-bottom:8px">📋</div>
            <div style="font-size:0.85rem;font-weight:600">ยังไม่มีรายการ</div>
            <div style="font-size:0.72rem;margin-top:4px">กด "+ บันทึก" เพื่อเพิ่มรับเข้า / เบิกออก</div>
          </div>
        ` : filtered.map(m => {
          const item = _invGetCatalogItem(m.partId);
          const cc   = CAT_COLORS[item?.category] || { bg:'#f1f5f9', border:'#e2e8f0', icon:'📦' };
          const d    = new Date(m.at);
          const dateStr = `${d.getDate()}/${d.getMonth()+1} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
          const sign  = m.type === 'in' ? '+' : m.type === 'out' ? '−' : '=';
          const qc    = typeColor[m.type] || '#64748b';
          const qbg   = typeBg[m.type]   || '#f1f5f9';
          return `
          <div style="background:var(--card);border:1.5px solid #e2e8f0;border-radius:13px;margin-bottom:6px;padding:10px 12px;display:flex;align-items:center;gap:10px">
            <div style="width:34px;height:34px;border-radius:10px;background:${qbg};display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;font-weight:900;color:${qc}">${sign}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:0.82rem;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(item?.name || m.partId)}</div>
              <div style="display:flex;align-items:center;gap:5px;margin-top:3px;flex-wrap:wrap">
                <span style="font-size:0.6rem;background:${qbg};color:${qc};border-radius:4px;padding:1px 6px;font-weight:700">${typeLabel[m.type]||m.type}</span>
                ${m.ref ? `<span style="font-size:0.6rem;color:#94a3b8">#${escapeHtml(m.ref)}</span>` : ''}
                ${m.note ? `<span style="font-size:0.6rem;color:#64748b;overflow:hidden;text-overflow:ellipsis;max-width:120px">${escapeHtml(m.note)}</span>` : ''}
              </div>
              <div style="font-size:0.58rem;color:#94a3b8;margin-top:2px">${dateStr}${m.by ? ' · '+escapeHtml(m.by) : ''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:1rem;font-weight:900;color:${qc}">${sign}${m.qty}</div>
              <div style="font-size:0.58rem;color:#94a3b8">${item?.unit||'ชิ้น'}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;

    window._invTab_ = (v) => { _invTab = v; render(); };
  };

  // ── DETAIL / Adjust panel ──────────────────────
  const renderDetail = () => {
    const id   = _invDetailId;
    const item = _invGetCatalogItem(id);
    const s    = db.spareStock?.[id] || { qty: 0, minQty: 0, location: '' };
    const cc   = CAT_COLORS[item?.category] || { bg:'#f1f5f9', accent:'#64748b', border:'#e2e8f0', icon:'📦' };

    // recent movements for this part
    const partMvs = (db.stockMovements || []).filter(m => m.partId === id).slice(-8).reverse();
    const typeLabel = { in:'รับเข้า', out:'เบิกออก', adjust:'ปรับ' };
    const typeColor = { in:'#16a34a', out:'#dc2626', adjust:'#7c3aed' };
    const typeBg    = { in:'#dcfce7', out:'#fee2e2', adjust:'#f3e8ff' };

    page.innerHTML = `
      <div style="background:linear-gradient(160deg,#0c1a2e 0%,#1e3a5f 50%,#1d4ed8 100%);padding:14px 16px 16px;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:10px">
          <button onclick="window._invBackToList()" style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.2);color:white;font-size:1.3rem;cursor:pointer;display:flex;align-items:center;justify-content:center">‹</button>
          <div style="flex:1">
            <div style="color:white;font-size:0.9rem;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(item?.name||id)}</div>
            <div style="color:rgba(255,255,255,.5);font-size:0.62rem;margin-top:1px">${id}</div>
          </div>
          <div style="background:rgba(255,255,255,.15);border-radius:12px;padding:6px 14px;text-align:center">
            <div style="color:white;font-size:1.3rem;font-weight:900">${s.qty}</div>
            <div style="color:rgba(255,255,255,.5);font-size:0.6rem">${item?.unit||'ชิ้น'}</div>
          </div>
        </div>
      </div>

      <div style="flex:1;overflow-y:auto;padding:12px 12px 24px;background:var(--bg)">

        <!-- ── Quick Actions ── -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-bottom:12px">
          <button onclick="window._invQuick('in')" style="padding:12px 6px;border-radius:13px;border:1.5px solid #bbf7d0;background:#f0fdf4;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:4px">
            <span style="font-size:1.4rem">📥</span>
            <span style="font-size:0.68rem;font-weight:700;color:#15803d">รับเข้า</span>
          </button>
          <button onclick="window._invQuick('out')" style="padding:12px 6px;border-radius:13px;border:1.5px solid #fecaca;background:#fff0f2;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:4px">
            <span style="font-size:1.4rem">📤</span>
            <span style="font-size:0.68rem;font-weight:700;color:#dc2626">เบิกออก</span>
          </button>
          <button onclick="window._invQuick('adjust')" style="padding:12px 6px;border-radius:13px;border:1.5px solid #ddd6fe;background:#f5f3ff;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:4px">
            <span style="font-size:1.4rem">🔧</span>
            <span style="font-size:0.68rem;font-weight:700;color:#7c3aed">ปรับ Stock</span>
          </button>
        </div>

        <!-- ── Settings card ── -->
        <div style="background:var(--card);border-radius:16px;padding:14px;margin-bottom:12px;border:1.5px solid #e2e8f0">
          <div style="font-size:0.62rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">ตั้งค่า Stock</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div>
              <div style="font-size:0.68rem;font-weight:700;color:#64748b;margin-bottom:4px">Stock ต่ำสุด (alert)</div>
              <input id="inv-minqty" type="number" min="0" value="${s.minQty||0}"
                style="width:100%;border:1.5px solid var(--border);border-radius:9px;padding:8px 11px;font-size:0.85rem;font-family:inherit;outline:none;box-sizing:border-box"
                onfocus="this.style.borderColor='#1d4ed8'" onblur="this.style.borderColor='#e5e7eb'"/>
            </div>
            <div>
              <div style="font-size:0.68rem;font-weight:700;color:#64748b;margin-bottom:4px">ตำแหน่งจัดเก็บ</div>
              <input id="inv-location" type="text" value="${escapeHtml(s.location||'')}" placeholder="เช่น ชั้น A3"
                style="width:100%;border:1.5px solid var(--border);border-radius:9px;padding:8px 11px;font-size:0.85rem;font-family:inherit;outline:none;box-sizing:border-box"
                onfocus="this.style.borderColor='#1d4ed8'" onblur="this.style.borderColor='#e5e7eb'"/>
            </div>
          </div>
          <button onclick="window._invSaveSettings('${id}')"
            style="width:100%;padding:9px;border:1.5px solid #bfdbfe;border-radius:10px;background:#eff6ff;color:#1d4ed8;font-size:0.78rem;font-weight:700;cursor:pointer;font-family:inherit">💾 บันทึกการตั้งค่า</button>
        </div>

        <!-- ── Movement history ── -->
        <div style="background:var(--card);border-radius:16px;padding:14px;border:1.5px solid #e2e8f0">
          <div style="font-size:0.62rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">ประวัติล่าสุด (${partMvs.length} รายการ)</div>
          ${partMvs.length === 0 ? `<div style="text-align:center;padding:16px;color:#cbd5e1;font-size:0.8rem">ยังไม่มีประวัติ</div>` :
          partMvs.map(m => {
            const d = new Date(m.at);
            const ds = `${d.getDate()}/${d.getMonth()+1} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
            const sign = m.type==='in' ? '+' : m.type==='out' ? '−' : '=';
            return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #f1f5f9">
              <div style="width:28px;height:28px;border-radius:8px;background:${typeBg[m.type]||'#f1f5f9'};display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:900;color:${typeColor[m.type]||'#64748b'};flex-shrink:0">${sign}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:0.75rem;font-weight:700;color:var(--text)">${typeLabel[m.type]||m.type} ${sign}${m.qty} ${item?.unit||'ชิ้น'}</div>
                <div style="font-size:0.62rem;color:#94a3b8">${ds}${m.note?' · '+escapeHtml(m.note):''}</div>
              </div>
              ${m.ref ? `<span style="font-size:0.6rem;color:#94a3b8;font-style:italic">#${escapeHtml(m.ref)}</span>` : ''}
            </div>`;
          }).join('')}
        </div>
      </div>
    `;

    window._invDetailId = null; // will be set by back btn
    window._invDetailId = id;   // keep reference

    window._invSaveSettings = (pid) => {
      if (!db.spareStock) db.spareStock = {};
      const cur = db.spareStock[pid] || { qty: 0, minQty: 0, location: '' };
      cur.minQty   = Math.max(0, parseFloat(document.getElementById('inv-minqty')?.value) || 0);
      cur.location = document.getElementById('inv-location')?.value.trim() || '';
      db.spareStock[pid] = cur;
      saveDB();
      if (typeof fsSave === 'function') fsSave();
      showToast('💾 บันทึกแล้ว');
    };

    window._invQuick = (type) => {
      window._invOpenAdjust(id, type);
    };
  };

  // ── Adjust Sheet (bottom sheet: รับเข้า / เบิกออก / ปรับ) ──
  window._invOpenAdjust = (partId, forceType) => {
    document.getElementById('_inv_adj')?.remove();
    const ov = document.createElement('div');
    ov.id = '_inv_adj_ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:9800;backdrop-filter:blur(3px)';
    ov.onclick = e => { if (e.target===ov) { ov.remove(); sh.remove(); } };

    // คำนวณ left เพื่อให้ sheet อยู่ใน main-col area
    const _adjLeft = (() => {
      const mainCol = document.getElementById('main-col');
      if (mainCol) return mainCol.getBoundingClientRect().left + 'px';
      const navEl = document.querySelector('.bottom-nav');
      const navW  = navEl ? navEl.offsetWidth : 0;
      return navW > 60 ? navW + 'px' : '0px';
    })();

    const sh = document.createElement('div');
    sh.id = '_inv_adj';
    sh.style.cssText = `position:fixed;bottom:0;left:${_adjLeft};right:0;z-index:9810;background:var(--card);border-radius:22px 22px 0 0;padding:16px 16px 32px;max-height:85vh;overflow-y:auto;box-shadow:0 -8px 40px rgba(0,0,0,0.15)`;

    const catalog = db.spareParts && db.spareParts.length > 0
      ? db.spareParts.filter(s => s.isActive !== false)
      : SPARE_PARTS.map(s => ({ id:s.id, name:s.n, category:s.c, unit:s.u }));

    const initType = forceType || 'in';
    const initPart = partId || (catalog[0]?.id || '');

    sh.innerHTML = `
      <div style="display:flex;justify-content:center;padding-bottom:12px">
        <div style="width:36px;height:4px;background:#e2e8f0;border-radius:99px"></div>
      </div>
      <div style="font-size:0.95rem;font-weight:900;color:var(--text);margin-bottom:14px">📝 บันทึก Stock</div>

      <!-- type selector -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:14px" id="adj-type-row">
        ${[['in','📥 รับเข้า','#15803d','#dcfce7','#bbf7d0'],['out','📤 เบิกออก','#dc2626','#fee2e2','#fecaca'],['adjust','🔧 ปรับ Stock','#7c3aed','#f3e8ff','#ddd6fe']].map(([t,l,c,bg,bo])=>`
        <button onclick="window._adjType='${t}';document.querySelectorAll('.adj-type-btn').forEach(b=>{b.style.background=b.dataset.t==='${t}'?'${bg}':'white';b.style.borderColor=b.dataset.t==='${t}'?'${bo}':'#e2e8f0';b.style.color=b.dataset.t==='${t}'?'${c}':'#64748b'})"
          class="adj-type-btn" data-t="${t}"
          style="padding:9px 4px;border-radius:11px;border:2px solid ${initType===t?bo:'#e2e8f0'};background:${initType===t?bg:'white'};cursor:pointer;font-family:inherit;font-size:0.7rem;font-weight:700;color:${initType===t?c:'#64748b'}">${l}</button>
        `).join('')}
      </div>

      <!-- part selector -->
      <div style="margin-bottom:10px">
        <div style="font-size:0.68rem;font-weight:700;color:#64748b;margin-bottom:5px">อะไหล่ *</div>
        <select id="adj-part" style="width:100%;border:1.5px solid var(--border);border-radius:10px;padding:10px 12px;font-size:0.83rem;font-family:inherit;outline:none;background:var(--card);color:var(--text);box-sizing:border-box"
          onfocus="this.style.borderColor='#1d4ed8'" onblur="this.style.borderColor='#e5e7eb'">
          ${catalog.map(ci => `<option value="${ci.id}" ${ci.id===initPart?'selected':''}>${ci.id} · ${escapeHtml(ci.name)}</option>`).join('')}
        </select>
      </div>

      <!-- qty -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div>
          <div style="font-size:0.68rem;font-weight:700;color:#64748b;margin-bottom:5px">จำนวน *</div>
          <input id="adj-qty" type="number" min="0" value="1" placeholder="0"
            style="width:100%;border:1.5px solid var(--border);border-radius:10px;padding:10px 12px;font-size:0.88rem;font-family:inherit;font-weight:800;outline:none;box-sizing:border-box"
            onfocus="this.style.borderColor='#1d4ed8'" onblur="this.style.borderColor='#e5e7eb'"/>
        </div>
        <div>
          <div style="font-size:0.68rem;font-weight:700;color:#64748b;margin-bottom:5px">อ้างอิง (Ticket/PO)</div>
          <input id="adj-ref" type="text" placeholder="เช่น TK-001"
            style="width:100%;border:1.5px solid var(--border);border-radius:10px;padding:10px 12px;font-size:0.83rem;font-family:inherit;outline:none;box-sizing:border-box"
            onfocus="this.style.borderColor='#1d4ed8'" onblur="this.style.borderColor='#e5e7eb'"/>
        </div>
      </div>

      <!-- note -->
      <div style="margin-bottom:14px">
        <div style="font-size:0.68rem;font-weight:700;color:#64748b;margin-bottom:5px">หมายเหตุ</div>
        <input id="adj-note" type="text" placeholder="หมายเหตุ (ถ้ามี)"
          style="width:100%;border:1.5px solid var(--border);border-radius:10px;padding:10px 12px;font-size:0.83rem;font-family:inherit;outline:none;box-sizing:border-box"
          onfocus="this.style.borderColor='#1d4ed8'" onblur="this.style.borderColor='#e5e7eb'"/>
      </div>

      <button onclick="window._adjSave()"
        style="width:100%;padding:13px;border:none;border-radius:13px;background:#1d4ed8;color:white;font-size:0.9rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(29,78,216,0.3)">
        💾 บันทึก
      </button>
    `;

    window._adjType = initType;

    window._adjSave = () => {
      const pid  = document.getElementById('adj-part')?.value;
      const qty  = parseFloat(document.getElementById('adj-qty')?.value);
      const ref  = document.getElementById('adj-ref')?.value.trim() || '';
      const note = document.getElementById('adj-note')?.value.trim() || '';
      const type = window._adjType || 'in';

      if (!pid)      { showToast('⚠️ เลือกอะไหล่'); return; }
      if (isNaN(qty) || qty < 0) { showToast('⚠️ ระบุจำนวน'); return; }

      _invAddMovement({ partId: pid, type, qty, ref, note });

      const item = _invGetCatalogItem(pid);
      showToast(`✅ ${type==='in'?'รับเข้า':type==='out'?'เบิกออก':'ปรับ'} "${item?.name||pid}" ${qty} ${item?.unit||'ชิ้น'}`);

      ov.remove(); sh.remove();
      delete window._adjType;
      delete window._adjSave;

      // refresh ถ้าอยู่ที่หน้า detail ของ part นั้น
      if (_invDetailId === pid) renderDetail();
      else render();
    };

    document.body.appendChild(ov);
    document.body.appendChild(sh);

    if (window.visualViewport) {
      const fix = () => {
        if (!document.body.contains(sh)) { window.visualViewport.removeEventListener('resize',fix); return; }
        const kbH = window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop;
        sh.style.maxHeight = (window.visualViewport.height * 0.9) + 'px';
        sh.style.bottom = Math.max(0, kbH) + 'px';
        sh.style.paddingBottom = Math.max(32, kbH + 16) + 'px';
      };
      window.visualViewport.addEventListener('resize', fix);
      fix();
    }
  };

  // bind closure vars accessible from inner render fns
  window._invDetailId  = null;
  window._invTab_      = (v) => { _invTab = v; render(); };
  window._invSetQ      = (v) => { _invQ = v; if (_invTab === 'movements') renderMovements(); else renderStock(); };
  window._invSetFilter = (f) => { _invFilter = f; render(); };
  window._invOpenDetail = (id) => { _invDetailId = id; render(); };
  window._invRender    = () => render();
  window._invBackToList = () => { _invDetailId = null; render(); };

  render();
  document.body.appendChild(page);
  if (typeof updateTopbarTitle === 'function') updateTopbarTitle('inventory');
}
