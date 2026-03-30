// ============================================================
// AUTO BACKUP (localStorage → JSON download)
// ============================================================
function restoreFromBackup(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data._backup_at) { showToast('⚠️ ไฟล์ไม่ใช่ backup ที่ถูกต้อง'); return; }
      showAlert({
        icon: '📂',
        title: 'Restore ข้อมูล',
        msg: `Backup จาก <b>${data._backup_at.slice(0,10)}</b><br>มี ${data.machines?.length||0} เครื่อง · ${data.tickets?.length||0} งาน<br><br>⚠️ จะ <b>แทนที่ข้อมูลปัจจุบัน</b> ทั้งหมด`,
        confirmText: '📂 Restore เลย',
        cancelText: 'ยกเลิก',
        onConfirm: () => {
          if (data.machines)    db.machines    = data.machines;
          if (data.tickets)     db.tickets     = data.tickets;
          if (data.users)       db.users       = data.users;
          if (data.calEvents)   db.calEvents   = data.calEvents;
          if (data.vendors)     db.vendors     = data.vendors;
          if (data.repairGroups) db.repairGroups = data.repairGroups;
          saveDB();
          fsSave();
          invalidateMacCache();
          refreshPage();
          showToast('✅ Restore สำเร็จแล้ว');
        },
      });
    } catch(e) {
      showToast('⚠️ อ่านไฟล์ไม่ได้: ' + e.message);
    }
  };
  reader.readAsText(file);
}

