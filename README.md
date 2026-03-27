# SCG AIRCON BP Plant — Project Structure

```
scg_aircon/
├── html/
│   └── index.html          # หน้าหลัก HTML shell
├── css/
│   └── main.css            # ทุก styles รวมกัน
├── js/
│   ├── app.js              # logic หลักทั้งหมด (~1.3MB)
│   └── firebase-init.js    # Firebase config & init
├── data/
│   ├── func_loc.js         # ตาราง FUNC_LOC (equipment mapping)
│   └── repair_price.js     # ราคามาตรฐานงานซ่อม
└── assets/
    └── (รูปภาพ / icons)
```

## External Dependencies (CDN)
- Firebase 10.12.2 (App + Firestore)
- SheetJS xlsx 0.18.5
- jsQR 1.4.0
- Google Fonts: Noto Sans Thai, JetBrains Mono

## Version: v194
