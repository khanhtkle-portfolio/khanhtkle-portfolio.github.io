/* ============================================================
   app.js — toàn bộ hành vi của trang web
   Gồm 4 phần:
     1. Ngôn ngữ (phát hiện, lưu, chuyển)
     2. Theo dõi lượt xem (tùy chọn)
     3. Trang chủ: vẽ lưới thẻ
     4. Trang xem báo cáo: lật trang
   ============================================================ */

/* ---------- 1. Ngôn ngữ ---------- */

// Thứ tự ưu tiên: người xem đã chọn trước đó > ngôn ngữ hệ thống > tiếng Anh
function detectLang() {
  try {
    const saved = localStorage.getItem("lang");
    if (saved === "vi" || saved === "en") return saved;
  } catch (_) { /* trình duyệt chặn lưu trữ thì bỏ qua */ }
  const sys = (navigator.language || "").toLowerCase();
  return sys.startsWith("vi") ? "vi" : "en";
}

let LANG = detectLang();

function setLang(lang) {
  LANG = lang;
  try { localStorage.setItem("lang", lang); } catch (_) {}
  document.documentElement.lang = lang;
  render();   // vẽ lại trang bằng ngôn ngữ mới
}

// Lấy chuỗi đúng ngôn ngữ từ một đối tượng dạng { vi: "...", en: "..." }
function t(obj) {
  if (typeof obj === "string") return obj;
  return obj[LANG] ?? obj.en ?? "";
}

/* ---------- 2. Theo dõi lượt xem ---------- */

// Gửi một sự kiện tới GoatCounter nếu đã cài; chưa cài thì không làm gì.
function track(name) {
  if (window.goatcounter && window.goatcounter.count) {
    window.goatcounter.count({ path: name, event: true });
  }
}

/* ---------- Dữ liệu dùng chung ---------- */

let DATA = null;

async function loadData() {
  const res = await fetch("data/reports.json");
  DATA = await res.json();
}

// Đường dẫn ảnh của một trang trong báo cáo, vd: reports/bao-hiem/page-02.webp
function pageSrc(report, n) {
  return `reports/${report.folder}/page-${String(n).padStart(2, "0")}.webp`;
}

function totalPages(report) {
  return report.to - report.from + 1;
}

function renderTopbar() {
  const toggle = document.querySelector(".lang-toggle");
  if (toggle) {
    toggle.textContent = t(DATA.ui.switchTo);
    toggle.onclick = () => setLang(LANG === "vi" ? "en" : "vi");
  }
  const brand = document.querySelector(".brand");
  if (brand) brand.textContent = DATA.site.author;
}

/* ---------- 3. Trang chủ ---------- */

function renderHome() {
  document.title = `${t(DATA.site.title)} — ${DATA.site.author}`;
  document.querySelector(".hero h1").textContent = t(DATA.site.title);
  document.querySelector(".hero p").textContent = t(DATA.site.subtitle);

  const grid = document.querySelector(".grid");
  grid.innerHTML = "";   // xóa thẻ cũ (khi đổi ngôn ngữ)

  for (const r of DATA.reports) {
    const n = totalPages(r);
    const card = document.createElement("a");
    card.className = "card";
    card.href = `report.html?id=${r.id}`;
    card.innerHTML = `
      <div class="card-frame">
        <img src="${pageSrc(r, r.from)}" alt="" loading="lazy">
      </div>
      <div class="card-meta">
        <span>${t(DATA.domains[r.domain])}</span>
        <span>${n} ${t(DATA.ui.pages)}</span>
      </div>
      <h2>${t(r.title)}</h2>
      <p>${t(r.summary)}</p>`;
    card.addEventListener("click", () => track(`open/${r.id}`));
    grid.appendChild(card);
  }
}

/* ---------- 4. Trang xem báo cáo ---------- */

let VIEW = null;   // trạng thái: báo cáo đang xem và trang hiện tại

function renderViewer() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const report = DATA.reports.find(r => r.id === id);

  document.querySelector(".back").textContent = "← " + t(DATA.ui.back);

  if (!report) {
    document.querySelector(".viewer-head h1").textContent = t(DATA.ui.notFound);
    return;
  }

  const total = totalPages(report);
  // Lần đầu vào: lấy số trang từ đường dẫn (nếu có), giữ trong khoảng hợp lệ
  if (!VIEW) {
    const p = parseInt(params.get("page") || "1", 10);
    VIEW = { report, page: Math.min(Math.max(p, 1), total) };
  }

  document.title = `${t(report.title)} — ${DATA.site.author}`;
  document.querySelector(".viewer-head h1").textContent = t(report.title);
  document.querySelector(".viewer-summary").textContent = t(report.summary);
  document.querySelector(".nav.prev").setAttribute("aria-label", t(DATA.ui.prev));
  document.querySelector(".nav.next").setAttribute("aria-label", t(DATA.ui.next));

  // Dải ảnh nhỏ: một nút cho mỗi trang
  const strip = document.querySelector(".strip");
  strip.innerHTML = "";
  for (let i = 1; i <= total; i++) {
    const b = document.createElement("button");
    b.innerHTML = `<img src="${pageSrc(report, report.from + i - 1)}" alt="" loading="lazy">`;
    b.setAttribute("aria-label", `${t(DATA.ui.page)} ${i}`);
    b.onclick = () => show(i);
    strip.appendChild(b);
  }

  show(VIEW.page);
}

function show(n) {
  const { report } = VIEW;
  const total = totalPages(report);
  n = Math.min(Math.max(n, 1), total);
  VIEW.page = n;

  // Ảnh chính
  const img = document.querySelector(".stage img");
  img.src = pageSrc(report, report.from + n - 1);
  img.alt = `${t(report.title)} — ${t(DATA.ui.page)} ${n}`;

  // Tải trước trang kế tiếp để lật mượt
  if (n < total) new Image().src = pageSrc(report, report.from + n);

  // Bộ đếm, nút, dải ảnh nhỏ
  document.querySelector(".counter").textContent = `${n} / ${total}`;
  document.querySelector(".nav.prev").disabled = n === 1;
  document.querySelector(".nav.next").disabled = n === total;
  document.querySelectorAll(".strip button").forEach((b, i) => {
    b.setAttribute("aria-current", i + 1 === n ? "true" : "false");
  });

  // Ghi số trang vào đường dẫn, để tải lại hoặc gửi link không mất vị trí
  const url = new URL(location);
  url.searchParams.set("page", n);
  history.replaceState(null, "", url);

  track(`view/${report.id}/${n}`);
}

function bindViewerControls() {
  document.querySelector(".nav.prev").onclick = () => show(VIEW.page - 1);
  document.querySelector(".nav.next").onclick = () => show(VIEW.page + 1);

  // Phím mũi tên
  document.addEventListener("keydown", e => {
    if (!VIEW) return;
    if (e.key === "ArrowRight") show(VIEW.page + 1);
    if (e.key === "ArrowLeft")  show(VIEW.page - 1);
  });

  // Vuốt trên màn hình cảm ứng
  let startX = null;
  const stage = document.querySelector(".stage");
  stage.addEventListener("touchstart", e => { startX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener("touchend", e => {
    if (startX === null || !VIEW) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (dx < -50) show(VIEW.page + 1);
    if (dx >  50) show(VIEW.page - 1);
    startX = null;
  });
}

/* ---------- Khởi động ---------- */

function render() {
  renderTopbar();
  if (document.body.dataset.page === "home")   renderHome();
  if (document.body.dataset.page === "viewer") renderViewer();
}

(async function init() {
  document.documentElement.lang = LANG;
  await loadData();
  if (document.body.dataset.page === "viewer") bindViewerControls();
  render();
})();
