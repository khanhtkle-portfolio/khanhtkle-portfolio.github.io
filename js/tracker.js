/* ============================================================
   tracker.js — ghi lại ai vào, khi nào, làm gì (hoạt động trong cổng).
   - Mỗi người xem có một mã ẩn danh cố định (v) và một mã phiên (s) đổi mỗi lần đăng nhập.
   - Tên chỉ có sau khi khách nhập ở bước đăng nhập.
   - Sự kiện xếp hàng trong localStorage rồi gửi theo lô tới trackUrl; chưa cấu hình thì giữ lại, không mất.
   - Không lưu địa chỉ IP; chỉ ghi trình duyệt, ngôn ngữ, múi giờ, cỡ màn hình và trang giới thiệu.
   ============================================================ */
(function () {
  const CFG = window.SIGHTLINE || {};
  const MAX_QUEUE = 500;

  const ls = {
    get(k, f) { try { const v = localStorage.getItem(k); return v === null ? f : JSON.parse(v); } catch (_) { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

  // Địa chỉ không có đuôi .html; số liệu vẫn ghi tên trang kiểu cũ (login.html, index.html) để khớp dữ liệu trước đó.
  const pageName = () => {
    const n = location.pathname.split("/").pop() || "index";
    return /\.html$/.test(n) ? n : n + ".html";
  };
  if (/\.html$/.test(location.pathname)) {
    try {
      const clean = location.pathname.replace(/index\.html$/, "").replace(/\.html$/, "");
      history.replaceState(null, "", (clean || "/") + location.search + location.hash);
    } catch (_) {}
  }

  let visitor = ls.get("visitor", null);
  if (!visitor || !visitor.id) { visitor = { id: uid(), name: "" }; ls.set("visitor", visitor); }
  let sid = ls.get("sid", null);
  const newSession = () => { sid = uid(); ls.set("sid", sid); };
  if (!sid) newSession();

  let queue = ls.get("trackQueue", []);
  let timer;

  const context = () => {
    let ref = "";
    try { ref = document.referrer ? new URL(document.referrer).hostname : ""; } catch (_) {}
    return {
      ref,
      lang: navigator.language,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: `${screen.width}x${screen.height}`,
      vp: `${innerWidth}x${innerHeight}`,
      ua: navigator.userAgent.slice(0, 160),
    };
  };

  function event(type, props) {
    const p = Object.assign({}, props);
    if (type === "login" || type === "page_view") Object.assign(p, context());
    queue.push({
      t: new Date().toISOString(), type, v: visitor.id, name: visitor.name, s: sid,
      path: pageName(), p,
    });
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    ls.set("trackQueue", queue);
    clearTimeout(timer);
    timer = setTimeout(flush, 4000);
  }

  // Gửi cả lô bằng sendBeacon (sống sót khi đóng tab); dùng text/plain để không phải xin phép CORS
  function flush() {
    clearTimeout(timer);
    if (!CFG.trackUrl || !queue.length) return;
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;   // chạy thử trên máy: không gửi
    const batch = queue.slice();
    const body = JSON.stringify({ key: CFG.trackKey || "", events: batch });
    let ok = false;
    try { ok = navigator.sendBeacon(CFG.trackUrl, new Blob([body], { type: "text/plain" })); } catch (_) {}
    if (!ok) {
      try { fetch(CFG.trackUrl, { method: "POST", mode: "no-cors", keepalive: true, body }); ok = true; } catch (_) {}
    }
    if (ok) { queue = queue.slice(batch.length); ls.set("trackQueue", queue); }
  }

  // Thời gian thực sự nhìn trang: chỉ tính lúc tab đang hiện
  let shownAt = Date.now();
  function leave() {
    if (shownAt === null) return;
    event("page_leave", { sec: Math.round((Date.now() - shownAt) / 1000) });
    shownAt = null;
    flush();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") leave(); else shownAt = Date.now();
  });
  addEventListener("pagehide", leave);

  window.Tracker = {
    event,
    flush,
    visitor: () => ({ id: visitor.id, name: visitor.name }),
    identify(name) { visitor.name = name; ls.set("visitor", visitor); newSession(); },
    endSession() { flush(); newSession(); },
  };

  event("page_view", { title: document.title });
})();
