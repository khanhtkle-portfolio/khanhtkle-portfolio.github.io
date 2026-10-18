/* ============================================================
   guard.js — rào cản nhẹ chống sao chép tình cờ: phím mở công cụ nhà phát triển, xem mã nguồn,
   chuột phải và kéo thả trên ảnh báo cáo.
   Đây chỉ là rào cản. Mã chạy trên trình duyệt thì người xem luôn đọc được qua cách khác.
   ============================================================ */
(function () {
  const stop = e => { e.preventDefault(); e.stopPropagation(); };

  addEventListener("keydown", e => {
    const mod = e.ctrlKey || e.metaKey;
    const devtools = e.key === "F12"
      || (mod && e.shiftKey && ["KeyI", "KeyJ", "KeyC"].includes(e.code))
      || (e.metaKey && e.altKey && ["KeyI", "KeyJ", "KeyU", "KeyC"].includes(e.code));
    const source = mod && !e.shiftKey && e.code === "KeyU";
    if (devtools || source) stop(e);
  }, true);

  addEventListener("contextmenu", e => { if (e.target.closest("img, .stage")) stop(e); }, true);
  addEventListener("dragstart", e => { if (e.target.tagName === "IMG") stop(e); }, true);
})();
