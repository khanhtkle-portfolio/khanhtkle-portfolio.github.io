/* config.js — cấu hình ghi nhận hoạt động. Để trống trackUrl thì sự kiện chỉ được giữ trên máy người xem. */
window.SIGHTLINE = {
  trackUrl: "https://script.google.com/macros/s/AKfycbxsAfWoTveofnHt_g8TmroSAO0ldUTw6lWmD4PnjKxz62uh6TZHiNO-0gJmzm98e8U23g/exec",   // địa chỉ Web App của Google Apps Script (xem backend/README.md)
  // khóa chống ghi rác theo từng site, phải trùng với bảng SITES trong backend/apps-script.gs
  trackKey: location.hostname === "khanhtkle-portfolio.github.io" ? "68686869" : "68686868"
};
