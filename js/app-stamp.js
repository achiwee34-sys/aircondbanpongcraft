// ============================================================
// STAMP TOOLBAR — ตราประทับสำหรับใบเสนอราคา / PDF
// แยกออกจาก app-backend.js
// ============================================================
// ============================================================
(function initStampToolbar() {
  const tb = document.createElement('div');
  tb.id = 'stamp-toolbar';
  tb.innerHTML = `
    <div id="stamp-preview-ring" style="display:none;width:52px;height:52px;border-radius:50%;background:#1a5276;border:3px solid white;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.35);cursor:pointer" onclick="document.getElementById('stamp-file-input').click()">
      <div id="stamp-preview-inner" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.2rem">🔖</div>
    </div>
    <button class="stamp-fab" onclick="document.getElementById('stamp-file-input').click()">
      🔖 อัปโหลดตราประทับ
    </button>
    <button class="stamp-fab" id="stamp-apply-btn" style="display:none;background:linear-gradient(135deg,#15803d,#16a34a)" onclick="applyStampToQuotation()">
      💾 บันทึก + ประทับตรา
    </button>
    <input type="file" id="stamp-file-input" accept="image/*" style="display:none" onchange="onStampUpload(this)">`;
  document.body.appendChild(tb);

  const savedStamp = localStorage.getItem('_aircon_stamp_img');
  if (savedStamp) {
    window._stampImg = savedStamp;
    updateStampPreview(savedStamp);
  }
})();

window.onStampUpload = function(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    window._stampImg = e.target.result;
    localStorage.setItem('_aircon_stamp_img', window._stampImg);
    updateStampPreview(window._stampImg);
    const applyBtn = document.getElementById('stamp-apply-btn');
    if (applyBtn) applyBtn.style.display = 'flex';
    if (typeof showToast === 'function') showToast('✅ อัปโหลดตราประทับแล้ว');
  };
  reader.readAsDataURL(file);
};

function updateStampPreview(src) {
  const ring = document.getElementById('stamp-preview-ring');
  const inner = document.getElementById('stamp-preview-inner');
  if (ring && inner) {
    ring.style.display = 'block';
    inner.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:contain">`;
  }
  const applyBtn = document.getElementById('stamp-apply-btn');
  if (applyBtn && src) applyBtn.style.display = 'flex';
}

window.applyStampToQuotation = function() {
  if (!window._stampImg) {
    if (typeof showToast === 'function') showToast('⚠️ กรุณาอัปโหลดตราประทับก่อน');
    return;
  }
  if (typeof getPDFConfig === 'function' && typeof savePDFConfig === 'function') {
    const cfg = getPDFConfig();
    cfg.stampImg = window._stampImg;
    savePDFConfig(cfg);
    if (typeof showToast === 'function') showToast('✅ บันทึกตราประทับแล้ว');
    if (typeof renderPreview === 'function') renderPreview();
  } else {
    if (typeof showToast === 'function') showToast('✅ บันทึกตราประทับแล้ว (เปิด PDF designer เพื่อใช้งาน)');
  }
};

const _origGoPageStamp = window.goPage;
if (typeof _origGoPageStamp === 'function') {
  window.goPage = function(page) {
    _origGoPageStamp(page);
    const tb = document.getElementById('stamp-toolbar');
    if (tb) tb.classList.toggle('visible', page === 'report' || page === 'settings');
  };
}
