/* ============================================================
   app.js — toàn bộ hành vi của trang web (Sightline)
   Gồm các phần:
     1. Ngôn ngữ và lưu trữ trên máy người xem
     2. Theo dõi lượt xem (tùy chọn)
     3. Khung chung: thanh trên, thông báo, menu người dùng, hộp thoại, phím tắt
     4. Trang đăng nhập (mẫu: chỉ có lối vào dành cho khách)
     5. Trang chủ: cột trái, tiếp tục xem, lưới báo cáo
     6. Trang xem báo cáo: lật trang, chia sẻ, tải về
   ============================================================ */

/* ---------- 1. Ngôn ngữ và lưu trữ ---------- */

// Đọc/ghi localStorage an toàn (trình duyệt chặn lưu trữ thì bỏ qua)
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      if (v === null) return fallback;
      try { return JSON.parse(v); } catch (_) { return v; }   // giá trị chữ thuần (vd: "vi")
    } catch (_) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  },
};

// Phiên đăng nhập (mẫu): giữ trong tab, đóng tab là hết
const session = {
  active() { try { return !!sessionStorage.getItem("auth"); } catch (_) { return false; } },
  start()  { try { sessionStorage.setItem("auth", "1"); } catch (_) {} },
  end()    { try { sessionStorage.removeItem("auth"); } catch (_) {} },
};

// Thứ tự ưu tiên: người xem đã chọn trước đó > ngôn ngữ hệ thống > tiếng Anh
function detectLang() {
  const saved = store.get("lang", null);
  if (saved === "vi" || saved === "en") return saved;
  const sys = (navigator.language || "").toLowerCase();
  return sys.startsWith("vi") ? "vi" : "en";
}

let LANG = detectLang();

function setLang(lang) {
  LANG = lang;
  store.set("lang", lang);
  document.documentElement.lang = lang;
  render();   // vẽ lại trang bằng ngôn ngữ mới
}

// Lấy chuỗi đúng ngôn ngữ từ một đối tượng dạng { vi: "...", en: "..." }
function t(obj) {
  if (typeof obj === "string") return obj;
  return obj[LANG] ?? obj.en ?? "";
}

// Thay {tên} trong chuỗi bằng giá trị
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

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

const byId = id => DATA.reports.find(r => r.id === id);

function setText(sel, text) {
  const el = document.querySelector(sel);
  if (el) el.textContent = text;
}

// Ghim, xem gần đây: lưu danh sách mã báo cáo trên máy người xem
const getPins   = () => store.get("pins", []);
const getRecent = () => store.get("recent", []);

function togglePin(id) {
  const pins = getPins();
  store.set("pins", pins.includes(id) ? pins.filter(x => x !== id) : [id, ...pins]);
}
function pushRecent(id) {
  store.set("recent", [id, ...getRecent().filter(x => x !== id)].slice(0, 8));
}

// Bộ biểu tượng: Phosphor Icons (kiểu regular, giấy phép MIT), https://phosphoricons.com
// Mỗi biểu tượng là phần ruột của SVG 256×256, tô bằng màu chữ hiện tại.
const ICONS = {
  grid: '<path d="M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48Z"/>',
  pin: '<path d="M235.32,81.37,174.63,20.69a16,16,0,0,0-22.63,0L98.37,74.49c-10.66-3.34-35-7.37-60.4,13.14a16,16,0,0,0-1.29,23.78L85,159.71,42.34,202.34a8,8,0,0,0,11.32,11.32L96.29,171l48.29,48.29A16,16,0,0,0,155.9,224c.38,0,.75,0,1.13,0a15.93,15.93,0,0,0,11.64-6.33c19.64-26.1,17.75-47.32,13.19-60L235.33,104A16,16,0,0,0,235.32,81.37ZM224,92.69h0l-57.27,57.46a8,8,0,0,0-1.49,9.22c9.46,18.93-1.8,38.59-9.34,48.62L48,100.08c12.08-9.74,23.64-12.31,32.48-12.31A40.13,40.13,0,0,1,96.81,91a8,8,0,0,0,9.25-1.51L163.32,32,224,92.68Z"/>',
  pinFill: '<path d="M235.33,104l-53.47,53.65c4.56,12.67,6.45,33.89-13.19,60A15.93,15.93,0,0,1,157,224c-.38,0-.75,0-1.13,0a16,16,0,0,1-11.32-4.69L96.29,171,53.66,213.66a8,8,0,0,1-11.32-11.32L85,159.71l-48.3-48.3A16,16,0,0,1,38,87.63c25.42-20.51,49.75-16.48,60.4-13.14L152,20.7a16,16,0,0,1,22.63,0l60.69,60.68A16,16,0,0,1,235.33,104Z"/>',
  clock: '<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z"/>',
  coins: '<path d="M128,88a40,40,0,1,0,40,40A40,40,0,0,0,128,88Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,152ZM240,56H16a8,8,0,0,0-8,8V192a8,8,0,0,0,8,8H240a8,8,0,0,0,8-8V64A8,8,0,0,0,240,56ZM193.65,184H62.35A56.78,56.78,0,0,0,24,145.65v-35.3A56.78,56.78,0,0,0,62.35,72h131.3A56.78,56.78,0,0,0,232,110.35v35.3A56.78,56.78,0,0,0,193.65,184ZM232,93.37A40.81,40.81,0,0,1,210.63,72H232ZM45.37,72A40.81,40.81,0,0,1,24,93.37V72ZM24,162.63A40.81,40.81,0,0,1,45.37,184H24ZM210.63,184A40.81,40.81,0,0,1,232,162.63V184Z"/>',
  box: '<path d="M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32l80.34,44-29.77,16.3-80.35-44ZM128,120,47.66,76l33.9-18.56,80.34,44ZM40,90l80,43.78v85.79L40,175.82Zm176,85.78h0l-80,43.79V133.82l32-17.51V152a8,8,0,0,0,16,0V107.55L216,90v85.77Z"/>',
  plus: '<path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"/>',
  keyboard: '<path d="M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48Zm0,144H32V64H224V192Zm-16-64a8,8,0,0,1-8,8H56a8,8,0,0,1,0-16H200A8,8,0,0,1,208,128Zm0-32a8,8,0,0,1-8,8H56a8,8,0,0,1,0-16H200A8,8,0,0,1,208,96ZM72,160a8,8,0,0,1-8,8H56a8,8,0,0,1,0-16h8A8,8,0,0,1,72,160Zm96,0a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,160Zm40,0a8,8,0,0,1-8,8h-8a8,8,0,0,1,0-16h8A8,8,0,0,1,208,160Z"/>',
  info: '<path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z"/>',
  globe: '<path d="M128,24h0A104,104,0,1,0,232,128,104.12,104.12,0,0,0,128,24Zm88,104a87.61,87.61,0,0,1-3.33,24H174.16a157.44,157.44,0,0,0,0-48h38.51A87.61,87.61,0,0,1,216,128ZM102,168H154a115.11,115.11,0,0,1-26,45A115.27,115.27,0,0,1,102,168Zm-3.9-16a140.84,140.84,0,0,1,0-48h59.88a140.84,140.84,0,0,1,0,48ZM40,128a87.61,87.61,0,0,1,3.33-24H81.84a157.44,157.44,0,0,0,0,48H43.33A87.61,87.61,0,0,1,40,128ZM154,88H102a115.11,115.11,0,0,1,26-45A115.27,115.27,0,0,1,154,88Zm52.33,0H170.71a135.28,135.28,0,0,0-22.3-45.6A88.29,88.29,0,0,1,206.37,88ZM107.59,42.4A135.28,135.28,0,0,0,85.29,88H49.63A88.29,88.29,0,0,1,107.59,42.4ZM49.63,168H85.29a135.28,135.28,0,0,0,22.3,45.6A88.29,88.29,0,0,1,49.63,168Zm98.78,45.6a135.28,135.28,0,0,0,22.3-45.6h35.66A88.29,88.29,0,0,1,148.41,213.6Z"/>',
  signout: '<path d="M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z"/>',
  user: '<path d="M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z"/>',
  clip: '<path d="M209.66,122.34a8,8,0,0,1,0,11.32l-82.05,82a56,56,0,0,1-79.2-79.21L147.67,35.73a40,40,0,1,1,56.61,56.55L105,193A24,24,0,1,1,71,159L154.3,74.38A8,8,0,1,1,165.7,85.6L82.39,170.31a8,8,0,1,0,11.27,11.36L192.93,81A24,24,0,1,0,159,47L59.76,147.68a40,40,0,1,0,56.53,56.62l82.06-82A8,8,0,0,1,209.66,122.34Z"/>',
  download: '<path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z"/>',
  fs: '<path d="M216,48V96a8,8,0,0,1-16,0V67.31l-42.34,42.35a8,8,0,0,1-11.32-11.32L188.69,56H160a8,8,0,0,1,0-16h48A8,8,0,0,1,216,48ZM98.34,146.34,56,188.69V160a8,8,0,0,0-16,0v48a8,8,0,0,0,8,8H96a8,8,0,0,0,0-16H67.31l42.35-42.34a8,8,0,0,0-11.32-11.32ZM208,152a8,8,0,0,0-8,8v28.69l-42.34-42.35a8,8,0,0,0-11.32,11.32L188.69,200H160a8,8,0,0,0,0,16h48a8,8,0,0,0,8-8V160A8,8,0,0,0,208,152ZM67.31,56H96a8,8,0,0,0,0-16H48a8,8,0,0,0-8,8V96a8,8,0,0,0,16,0V67.31l42.34,42.35a8,8,0,0,0,11.32-11.32Z"/>',
  caret: '<path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z"/>',
  zoomIn: '<path d="M152,112a8,8,0,0,1-8,8H120v24a8,8,0,0,1-16,0V120H80a8,8,0,0,1,0-16h24V80a8,8,0,0,1,16,0v24h24A8,8,0,0,1,152,112Zm77.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88.11,88.11,0,1,1,11.31-11.31l50.07,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"/>',
  zoomOut: '<path d="M152,112a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16h64A8,8,0,0,1,152,112Zm77.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88.11,88.11,0,1,1,11.31-11.31l50.07,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"/>',
};
const ico = (name, cls = "ico") =>
  `<svg class="${cls}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${ICONS[name]}</svg>`;

// Thông báo nhỏ ở cuối màn hình, tự tắt sau 2 giây
let toastTimer;
function toast(msg) {
  const el = document.querySelector(".toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2000);
}

/* ---------- 3. Khung chung ---------- */

// Nút VI | EN. Ở trang đăng nhập nằm góc phải; sau đăng nhập nằm trong menu người dùng.
function renderLangSwitch() {
  document.querySelectorAll(".lang button").forEach(b => {
    b.setAttribute("aria-pressed", b.dataset.lang === LANG);
    b.onclick = () => {
      if (b.dataset.lang === LANG) return;
      setLang(b.dataset.lang);
      if (document.querySelector(".user-menu")) setPop(".user");   // giữ menu mở sau khi đổi ngôn ngữ
    };
  });
}

function renderChrome() {
  const P = DATA.portal;
  const u = P.persona;

  setText(".topbar-tagline", t(DATA.site.tagline));
  setText(".avatar", t(u.initials));
  setText(".user-name", t(u.name));
  setText(".user-role", t(u.role));
  document.querySelector(".user-btn").setAttribute("aria-label", `${t(u.menu)}: ${t(u.name)}`);

  // Menu người dùng: tài khoản, ngôn ngữ, trợ giúp, đăng xuất
  const M = P.menu;
  const menu = document.querySelector(".user-menu");
  menu.innerHTML = `
    <div class="menu-id">
      <span class="avatar">${t(u.initials)}</span>
      <div><b>${t(u.name)}</b><span>${t(u.role)} · ${t(u.access)}</span></div>
    </div>
    <div class="menu-row">
      <span class="menu-lbl">${ico("globe")}${t(M.language)}</span>
      <div class="lang" role="group">
        <button type="button" data-lang="vi">VI</button>
        <button type="button" data-lang="en">EN</button>
      </div>
    </div>
    <div class="menu-sep"></div>
    <button type="button" class="menu-item" data-sec="sec-shortcuts">${ico("keyboard")}${t(M.shortcuts)}</button>
    <button type="button" class="menu-item" data-sec="sec-top">${ico("info")}${t(M.about)}</button>
    <div class="menu-sep"></div>
    <button type="button" class="menu-item menu-out">${ico("signout")}${t(u.signOut)}</button>`;
  menu.querySelectorAll("[data-sec]").forEach(b => {
    b.onclick = () => { setPop(null); openAbout(b.dataset.sec); };
  });
  menu.querySelector(".menu-out").onclick = () => {
    session.end();
    store.remove("notifSeen");
    location.href = "login.html";
  };
  document.querySelector(".user-btn").onclick = e => { e.stopPropagation(); togglePop(".user"); };
  renderLangSwitch();

  renderNotifs();

  const back = document.querySelector(".back");
  if (back) back.setAttribute("aria-label", t(DATA.ui.back));
  const home = document.querySelector(".home-brand");
  if (home) home.setAttribute("aria-label", `${DATA.site.title}: ${t(DATA.ui.back)}`);
}

// Chuông thông báo: số chưa đọc trên nút, danh sách trong menu nổi
function renderNotifs() {
  const P = DATA.portal;
  const items = P.activity.items;
  const seen = store.get("notifSeen", false);
  const btn = document.querySelector(".notif-btn");
  const badge = btn.querySelector(".badge");
  badge.hidden = seen;
  badge.textContent = items.length;
  btn.setAttribute("aria-label", seen ? t(P.notif.label)
    : `${t(P.notif.label)}: ${items.length}`);
  btn.title = t(P.notif.label);

  const menu = document.querySelector(".notif-menu");
  menu.innerHTML = `
    <div class="notif-head">
      <b>${t(P.activity.title)}</b>
      <button type="button" class="notif-read" ${seen ? "disabled" : ""}>${t(P.notif.markRead)}</button>
    </div>
    <ul class="notif-list">
      ${items.map(a => `<li><a href="report.html?id=${a.report}">
        <span class="notif-when">${t(a.when)}</span>
        <span class="notif-text"><b>${t(byId(a.report).title)}</b>: ${t(a.text)}</span>
      </a></li>`).join("")}
    </ul>`;
  menu.querySelector(".notif-read").onclick = () => {
    store.set("notifSeen", true);
    renderNotifs();
  };
  btn.onclick = e => { e.stopPropagation(); togglePop(".notif"); };
}

// Menu nổi: chỉ mở một cái tại một thời điểm
function setPop(which) {
  document.querySelectorAll(".pop").forEach(p => {
    const open = which && p.matches(which);
    const menu = p.querySelector(".pop-menu");
    if (menu) menu.hidden = !open;
    p.querySelector("button[aria-haspopup]")?.setAttribute("aria-expanded", !!open);
  });
}
function togglePop(sel) {
  const menu = document.querySelector(`${sel} .pop-menu`);
  setPop(menu.hidden ? sel : null);
}

// Hộp thoại dùng chung: tạo một lần, nạp nội dung mỗi lần mở
function dialog(cls, html) {
  let dlg = document.querySelector(`dialog.${cls}`);
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.className = `dlg ${cls}`;
    dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });   // bấm ra ngoài để đóng
    document.body.appendChild(dlg);
  }
  dlg.innerHTML = html;
  dlg.querySelectorAll("[data-close]").forEach(b => { b.onclick = () => dlg.close(); });
  if (!dlg.open) dlg.showModal();
  return dlg;
}

// Hộp "Về Sightline": giới thiệu, phím tắt, thuật ngữ. `section` là mục cần cuộn tới.
function openAbout(section = "sec-top") {
  const A = DATA.portal.about;
  const list = items => `<ul>${items.map(i => `<li>${t(i)}</li>`).join("")}</ul>`;
  const dlg = dialog("about", `
    <div class="dlg-head" id="sec-top">
      <h2>${t(A.title)}</h2>
      <button type="button" class="dlg-x" data-close aria-label="${t(A.close)}">×</button>
    </div>
    <p class="dlg-intro">${t(A.intro)}</p>
    <h3>${t(A.demoTitle)}</h3>${list(A.demoItems)}
    <h3>${t(A.realTitle)}</h3>${list(A.realItems)}
    <h3 id="sec-shortcuts">${t(A.shortcutsTitle)}</h3>
    <dl class="keys">
      ${A.shortcuts.map(s => `<dt>${s.k.split(" ").map(k => `<kbd>${k}</kbd>`).join(" ")}</dt><dd>${t(s.d)}</dd>`).join("")}
    </dl>
    `);
  const target = dlg.querySelector(`#${section}`);
  if (target && section !== "sec-top") target.scrollIntoView({ block: "start" });
  else dlg.scrollTop = 0;
}

// Hộp "Yêu cầu báo cáo mới": có kiểm tra ô bắt buộc, báo lỗi ngay tại ô
function openRequest() {
  const R = DATA.portal.request;
  const depts = Object.keys(DATA.domains)
    .map(k => `<option value="${k}">${t(DATA.domains[k].name)}</option>`).join("");
  const dlg = dialog("request", `
    <form novalidate>
      <div class="dlg-head">
        <h2>${t(R.title)}</h2>
        <button type="button" class="dlg-x" data-close aria-label="${t(R.close)}">×</button>
      </div>
      <label class="field">${t(R.name)}
        <input name="name" type="text" autocomplete="off" aria-describedby="err-name">
        <span class="field-err" id="err-name" hidden>${t(R.errName)}</span>
      </label>
      <label class="field">${t(R.dept)}
        <select name="dept">${depts}</select>
      </label>
      <label class="field">${t(R.need)}
        <textarea name="need" rows="3"></textarea>
      </label>
      <div class="dlg-actions">
        <button type="button" class="btn" data-close>${t(R.cancel)}</button>
        <button type="submit" class="btn btn-primary">${t(R.submit)}</button>
      </div>
    </form>`);
  const form = dlg.querySelector("form");
  form.onsubmit = e => {
    e.preventDefault();
    const name = form.name.value.trim();
    const err = form.querySelector(".field-err");
    err.hidden = !!name;
    form.name.setAttribute("aria-invalid", !name);
    if (!name) { form.name.focus(); return; }
    dlg.innerHTML = `
      <div class="dlg-head">
        <h2>${t(R.doneTitle)}</h2>
        <button type="button" class="dlg-x" data-close aria-label="${t(R.close)}">×</button>
      </div>
      <p class="dlg-intro"></p>
      <div class="dlg-actions"><button type="button" class="btn btn-primary" data-close>${t(R.close)}</button></div>`;
    dlg.querySelector(".dlg-intro").textContent = fill(t(R.doneText), { name });
    dlg.querySelectorAll("[data-close]").forEach(b => { b.onclick = () => dlg.close(); });
  };
  form.name.focus();
}

// Phím tắt và đóng menu nổi dùng chung các trang trong cổng
function bindGlobal() {
  document.addEventListener("click", e => {
    // composedPath vẫn đúng khi nút vừa bấm đã bị vẽ lại (vd: đổi ngôn ngữ trong menu)
    if (!e.composedPath().some(n => n.classList?.contains("pop"))) setPop(null);
  });

  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName);
    const page = document.body.dataset.page;

    if (e.key === "Escape") {
      setPop(null);
      const input = document.querySelector(".search input");
      if (page === "home" && input && document.activeElement === input) {
        input.value = ""; QUERY = ""; input.blur(); renderReports();
      }
      return;
    }
    if (typing || document.querySelector("dialog[open]")) return;
    if (e.key === "?") { e.preventDefault(); openAbout("sec-shortcuts"); return; }

    if (page === "home" && e.key === "/") {
      e.preventDefault();
      document.querySelector(".search input").focus();
    }
    if (page === "viewer" && VIEW) {
      if (e.key === "ArrowRight") show(VIEW.page + 1);
      if (e.key === "ArrowLeft")  show(VIEW.page - 1);
      if (e.key === "Home") show(1);
      if (e.key === "End")  show(totalPages(VIEW.report));
      if (e.key === "f" || e.key === "F") toggleFullscreen();
      if (e.key === "+" || e.key === "=") setZoom(ZOOM.z + 0.5);
      if (e.key === "-") setZoom(ZOOM.z - 0.5);
      if (e.key === "0") setZoom(1);
    }
  });
}

/* ---------- 4. Trang đăng nhập ---------- */

function renderLogin() {
  const L = DATA.portal.login;
  document.title = `${DATA.site.title} — ${t(DATA.site.tagline)}`;
  renderLangSwitch();

  setText(".login-title", t(L.title));
  setText(".login-text", t(L.text));
  setText(".form-title", t(L.formTitle));
  setText(".form-sub", t(L.formSub));
  setText(".sso-label", t(L.microsoft));
  setText(".or span", t(L.or));

  const guest = document.querySelector(".guest-btn");
  guest.innerHTML = `${ico("user")}${t(L.guest)}`;
  guest.onclick = () => {
    session.start();
    store.remove("notifSeen");
    location.href = "index.html";
  };
}

/* ---------- 5. Trang chủ ---------- */

let FILTER = store.get("filter", "all");   // "all" | "pinned" | "recent" | khóa phòng ban
let QUERY = "";                            // chuỗi tìm kiếm
let SORT = store.get("sort", "default");   // "default" | "az" | "pages"

function renderHome() {
  const P = DATA.portal;
  document.title = `${DATA.site.title} — ${t(DATA.site.tagline)}`;
  if (!["all", "pinned", "recent"].includes(FILTER) && !DATA.domains[FILTER]) FILTER = "all";
  if (!P.sort[SORT]) SORT = "default";

  const req = document.querySelector(".request-btn");
  req.innerHTML = `${ico("plus")}${t(P.request.button)}`;
  req.onclick = openRequest;

  const input = document.querySelector(".search input");
  input.placeholder = t(P.search);
  input.oninput = () => { QUERY = input.value.trim().toLowerCase(); renderReports(); };

  // Sắp xếp
  setText(".sort-label", t(P.sortLabel));
  const select = document.querySelector(".sort select");
  select.innerHTML = Object.keys(P.sort)
    .map(k => `<option value="${k}">${t(P.sort[k])}</option>`).join("");
  select.value = SORT;
  select.onchange = () => { SORT = select.value; store.set("sort", SORT); renderReports(); };

  renderContinue();
  renderNav();
  renderReports();
}

// Một hàng gọn: trang đang xem dở lần trước (hoặc gợi ý báo cáo đầu tiên)
function renderContinue() {
  const P = DATA.portal;
  const last = store.get("last", null);
  let r = last && byId(last.id);
  const page = r ? Math.min(Math.max(last.page, 1), totalPages(r)) : 1;
  const resumed = !!r;
  if (!r) r = DATA.reports[0];

  document.querySelector(".panel-continue").innerHTML = `
    <a class="resume" href="report.html?id=${r.id}&page=${page}">
      <img src="${pageSrc(r, r.from + page - 1)}" alt="" loading="lazy">
      <span class="resume-text">
        <span class="resume-label">${t(resumed ? P.continue.title : P.continue.suggested)}</span>
        <b>${t(r.title)}</b>
        <span>${t(DATA.domains[r.domain].name)}${resumed
          ? ` · ${fill(t(P.continue.page), { a: page, b: totalPages(r) })}` : ""}</span>
      </span>
      <span class="btn">${t(resumed ? P.continue.resume : P.continue.open)}</span>
    </a>`;
}

// Cột trái: thư viện (tất cả, đã ghim, gần đây) và từng phòng ban kèm danh sách báo cáo để mở thẳng
function renderNav() {
  const P = DATA.portal;
  const known = id => DATA.reports.some(r => r.id === id);
  const lib = [
    ["all",    "grid",  t(P.all),    DATA.reports.length],
    ["pinned", "pin",   t(P.pinned), getPins().filter(known).length],
    ["recent", "clock", t(P.recent), getRecent().filter(known).length],
  ];
  const row = ([k, icon, label, n]) => `<button type="button" class="nav-item" data-key="${k}"
    aria-current="${k === FILTER}">${ico(icon)}<span class="nav-name">${label}</span><span class="n">${n}</span></button>`;

  const depts = Object.keys(DATA.domains).map(k => {
    const reps = DATA.reports.filter(r => r.domain === k);
    return row([k, DATA.domains[k].icon || "grid", t(DATA.domains[k].name), reps.length]) +
      `<div class="nav-reports">${reps.map(r =>
        `<a href="report.html?id=${r.id}" title="${t(r.title)}">${t(r.title)}</a>`).join("")}</div>`;
  }).join("");

  const nav = document.querySelector(".nav-list");
  nav.innerHTML = `<div class="nav-label">${t(P.library)}</div>` + lib.map(row).join("") +
    `<div class="nav-label">${t(P.depts)}</div>` + depts;
  nav.querySelectorAll("button[data-key]").forEach(b => {
    b.onclick = () => {
      FILTER = b.dataset.key;
      store.set("filter", FILTER);
      renderNav();
      renderReports();
    };
  });
}

// Thẻ báo cáo: ảnh, phòng ban và số trang, tên, mô tả đầy đủ
function cardHTML(r, pinned) {
  const P = DATA.portal;
  const n = totalPages(r);
  return `
    <a class="card-link" href="report.html?id=${r.id}">
      <div class="card-frame">
        <img src="${pageSrc(r, r.from)}" alt="" loading="lazy">
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span>${t(DATA.domains[r.domain].name)}</span>
          <span>${n} ${t(DATA.ui.pages)}</span>
        </div>
        <h2>${t(r.title)}</h2>
        <p>${t(r.summary)}</p>
      </div>
    </a>
    <button type="button" class="pin" aria-pressed="${pinned}"
      aria-label="${t(pinned ? P.unpin : P.pin)}" title="${t(pinned ? P.unpin : P.pin)}">${ico(pinned ? "pinFill" : "pin")}</button>`;
}

// Lưới thẻ báo cáo (vẽ lại khi đổi bộ lọc, tìm kiếm, sắp xếp hoặc ngôn ngữ)
function renderReports() {
  const P = DATA.portal;
  const pins = getPins();
  const recent = getRecent();

  let list = DATA.reports.filter(r => {
    if (FILTER === "pinned") return pins.includes(r.id);
    if (FILTER === "recent") return recent.includes(r.id);
    return FILTER === "all" || r.domain === FILTER;
  });
  if (QUERY) {
    // Tìm trong cả hai ngôn ngữ để gõ tiếng Việt hay tiếng Anh đều ra kết quả
    const all = o => Object.values(o).flat().join(" ");
    list = list.filter(r => [all(r.title), all(r.summary), all(DATA.domains[r.domain].name),
      all(r.owner), all(r.tags)].join(" ").toLowerCase().includes(QUERY));
  }

  if (SORT === "az") list.sort((a, b) => t(a.title).localeCompare(t(b.title), LANG));
  if (SORT === "pages") list.sort((a, b) => totalPages(b) - totalPages(a));
  if (FILTER === "recent") list.sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
  // Báo cáo đã ghim luôn đứng đầu (sắp xếp ổn định nên giữ nguyên thứ tự còn lại)
  list.sort((a, b) => pins.includes(b.id) - pins.includes(a.id));

  setText(".count", t(list.length === 1 ? P.countOne : P.count).replace("{n}", list.length));

  const grid = document.querySelector(".grid");
  grid.innerHTML = "";   // xóa thẻ cũ
  for (const r of list) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = cardHTML(r, pins.includes(r.id));
    card.querySelector(".card-link").addEventListener("click", () => { pushRecent(r.id); track(`open/${r.id}`); });
    card.querySelector(".pin").onclick = () => { togglePin(r.id); renderNav(); renderReports(); };
    grid.appendChild(card);
  }

  const empty = document.querySelector(".empty");
  empty.hidden = list.length > 0;
  const emptyMsg = QUERY ? P.empty
    : FILTER === "pinned" ? P.emptyPinned
    : FILTER === "recent" ? P.emptyRecent : P.empty;
  empty.textContent = t(emptyMsg);
}

/* ---------- 6. Trang xem báo cáo ---------- */

let VIEW = null;   // trạng thái: báo cáo đang xem và trang hiện tại

function renderViewer() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const report = byId(id);

  if (!report) {
    setText(".topbar-title", t(DATA.ui.notFound));
    return;
  }

  const total = totalPages(report);
  // Lần đầu vào: lấy số trang từ đường dẫn (nếu có), giữ trong khoảng hợp lệ
  if (!VIEW) {
    const p = parseInt(params.get("page") || "1", 10);
    VIEW = { report, page: Math.min(Math.max(p || 1, 1), total) };
    pushRecent(report.id);
  }

  document.title = `${t(report.title)} — ${DATA.site.title}`;
  setText(".topbar-title", t(report.title));
  setText(".topbar-tagline", t(DATA.domains[report.domain].name));
  setText(".counter-label", t(DATA.portal.page));
  document.querySelector(".nav.prev").setAttribute("aria-label", t(DATA.ui.prev));
  document.querySelector(".nav.next").setAttribute("aria-label", t(DATA.ui.next));
  document.querySelector(".pager").setAttribute("aria-label", t(DATA.portal.pagesNav));

  // Thanh trang: một nút cho mỗi trang
  const strip = document.querySelector(".strip");
  strip.innerHTML = "";
  for (let i = 1; i <= total; i++) {
    const b = document.createElement("button");
    b.innerHTML = `<img src="${pageSrc(report, report.from + i - 1)}" alt=""><span class="thumb-n">${i}</span>`;
    b.setAttribute("aria-label", `${t(DATA.ui.page)} ${i}`);
    b.onclick = () => show(i);
    strip.appendChild(b);
  }

  renderSwitcher();
  renderInfo();
  renderTools();
  show(VIEW.page);
}

// Tên báo cáo trên thanh trên mở danh sách để chuyển nhanh sang báo cáo khác, nhóm theo phòng ban
function renderSwitcher() {
  const P = DATA.portal;
  const cur = VIEW.report;
  const btn = document.querySelector(".title-btn");
  btn.querySelector(".caret").innerHTML = ICONS.caret;
  btn.setAttribute("aria-label", `${t(P.report.switch)}: ${t(cur.title)}`);
  btn.onclick = e => { e.stopPropagation(); togglePop(".switcher"); };

  document.querySelector(".switch-menu").innerHTML = Object.keys(DATA.domains).map(k => {
    const reps = DATA.reports.filter(r => r.domain === k);
    return `<div class="sw-group">${t(DATA.domains[k].name)}</div>` + reps.map(r =>
      `<a class="sw-item" href="report.html?id=${r.id}" aria-current="${r.id === cur.id}">
        <span>${t(r.title)}</span><span class="n">${totalPages(r)} ${t(DATA.ui.pages)}</span></a>`).join("");
  }).join("");
}

// Ô "Về báo cáo này": mô tả đọc được và những câu hỏi báo cáo trả lời, chỉ mở khi cần
function renderInfo() {
  const R = DATA.portal.report;
  const r = VIEW.report;
  const btn = document.querySelector(".info-btn");
  btn.innerHTML = ico("info");
  btn.setAttribute("aria-label", t(R.info));
  btn.title = t(R.info);
  btn.onclick = e => { e.stopPropagation(); togglePop(".info"); };

  document.querySelector(".info-menu").innerHTML = `
    <h2 class="info-title">${t(r.title)}</h2>
    <p class="info-summary">${t(r.summary)}</p>
    <dl class="info-meta">
      <div><dt>${t(R.dept)}</dt><dd>${t(DATA.domains[r.domain].name)}</dd></div>
      <div><dt>${t(R.length)}</dt><dd>${totalPages(r)}</dd></div>
    </dl>
    <h3 class="info-h">${t(R.questions)}</h3>
    <ul class="info-qs">${t(r.questions).map(q => `<li>${q}</li>`).join("")}</ul>`;
}

// Phóng to: nút +/-, phím + - 0, bấm đúp; kéo để dịch chuyển khi đang phóng. Không có thanh cuộn.
const ZOOM = { z: 1, x: 0, y: 0 };

function clampPan() {
  const r = document.querySelector(".stage").getBoundingClientRect();
  const mx = (ZOOM.z - 1) * r.width / 2;
  const my = (ZOOM.z - 1) * r.height / 2;
  ZOOM.x = Math.min(mx, Math.max(-mx, ZOOM.x));
  ZOOM.y = Math.min(my, Math.max(-my, ZOOM.y));
}
function applyZoom() {
  const stage = document.querySelector(".stage");
  stage.querySelector("img").style.transform =
    ZOOM.z === 1 ? "" : `translate(${ZOOM.x}px, ${ZOOM.y}px) scale(${ZOOM.z})`;
  stage.classList.toggle("is-zoomed", ZOOM.z > 1);
  document.querySelector(".zoom-val").textContent = `${Math.round(ZOOM.z * 100)}%`;
  document.querySelector(".zoom-out").disabled = ZOOM.z <= 1;
  document.querySelector(".zoom-in").disabled = ZOOM.z >= 3;
}
function setZoom(z) {
  ZOOM.z = Math.min(3, Math.max(1, z));
  if (ZOOM.z === 1) { ZOOM.x = 0; ZOOM.y = 0; }
  clampPan();
  applyZoom();
}

// Ba nút nhỏ ở góc ảnh: chia sẻ liên kết (kẹp giấy), tải về, toàn màn hình
function renderTools() {
  const P = DATA.portal;
  const defs = [
    [".tool-share",    "clip",     P.share,      sharePage],
    [".tool-download", "download", P.download,   downloadPage],
    [".tool-fs",       "fs",       P.fullscreen, toggleFullscreen],
  ];
  for (const [sel, icon, label, fn] of defs) {
    const b = document.querySelector(sel);
    b.innerHTML = ico(icon);
    b.setAttribute("aria-label", t(label));
    b.title = t(label);
    b.onclick = fn;
  }

  const R = P.report;
  const zi = document.querySelector(".zoom-in"), zo = document.querySelector(".zoom-out"), zv = document.querySelector(".zoom-val");
  zi.innerHTML = ico("zoomIn");  zi.setAttribute("aria-label", t(R.zoomIn));  zi.title = `${t(R.zoomIn)} (+)`;
  zo.innerHTML = ico("zoomOut"); zo.setAttribute("aria-label", t(R.zoomOut)); zo.title = `${t(R.zoomOut)} (-)`;
  zv.setAttribute("aria-label", t(R.zoomReset)); zv.title = `${t(R.zoomReset)} (0)`;
  zi.onclick = () => setZoom(ZOOM.z + 0.5);
  zo.onclick = () => setZoom(ZOOM.z - 0.5);
  zv.onclick = () => setZoom(1);
  applyZoom();
}

async function sharePage() {
  const title = t(VIEW.report.title);
  if (navigator.share) {
    try { await navigator.share({ title, url: location.href }); } catch (_) {}   // người dùng hủy thì bỏ qua
    return;
  }
  try {
    await navigator.clipboard.writeText(location.href);
    toast(t(DATA.portal.linkCopied));
  } catch (_) {}
}

function downloadPage() {
  const { report, page } = VIEW;
  const a = document.createElement("a");
  a.href = pageSrc(report, report.from + page - 1);
  a.download = `${report.folder}-page-${String(page).padStart(2, "0")}.webp`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.querySelector(".stage").requestFullscreen?.();
}

function show(n) {
  const { report } = VIEW;
  const total = totalPages(report);
  n = Math.min(Math.max(n, 1), total);
  VIEW.page = n;
  store.set("last", { id: report.id, page: n });
  setZoom(1);

  // Ảnh chính
  const img = document.querySelector(".stage img");
  img.src = pageSrc(report, report.from + n - 1);
  img.alt = `${t(report.title)} — ${t(DATA.ui.page)} ${n}`;

  // Tải trước trang kế tiếp để lật mượt
  if (n < total) new Image().src = pageSrc(report, report.from + n);

  // Bộ đếm, nút, thanh trang
  document.querySelector(".counter-num").textContent = `${n} / ${total}`;
  document.querySelector(".nav.prev").disabled = n === 1;
  document.querySelector(".nav.next").disabled = n === total;
  document.querySelectorAll(".strip button").forEach((b, i) => {
    b.setAttribute("aria-current", i + 1 === n ? "true" : "false");
  });
  // Cuộn ngang thanh trang để trang hiện tại luôn nằm trong tầm nhìn
  const cur = document.querySelector(".strip button[aria-current='true']");
  const strip = document.querySelector(".strip");
  if (cur) {
    const left = cur.offsetLeft - (strip.clientWidth - cur.offsetWidth) / 2;
    strip.scrollTo({ left, behavior: "smooth" });
  }

  // Ghi số trang vào đường dẫn, để tải lại hoặc gửi link không mất vị trí
  const url = new URL(location);
  url.searchParams.set("page", n);
  history.replaceState(null, "", url);

  track(`view/${report.id}/${n}`);
}

function bindViewerControls() {
  document.querySelector(".nav.prev").onclick = () => show(VIEW.page - 1);
  document.querySelector(".nav.next").onclick = () => show(VIEW.page + 1);

  // Lăn chuột dọc trên thanh trang thì cuộn ngang
  const strip = document.querySelector(".strip");
  strip.addEventListener("wheel", e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      strip.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });

  const stage = document.querySelector(".stage");

  // Kéo để dịch chuyển trang khi đang phóng; bấm đúp để phóng 2 lần hoặc về vừa khung
  let drag = null;
  stage.addEventListener("pointerdown", e => {
    if (ZOOM.z <= 1 || e.target.closest("button")) return;
    drag = { x: e.clientX, y: e.clientY, ox: ZOOM.x, oy: ZOOM.y };
    stage.setPointerCapture(e.pointerId);
    stage.classList.add("is-dragging");
  });
  stage.addEventListener("pointermove", e => {
    if (!drag) return;
    ZOOM.x = drag.ox + e.clientX - drag.x;
    ZOOM.y = drag.oy + e.clientY - drag.y;
    clampPan();
    applyZoom();
  });
  const endDrag = () => { drag = null; stage.classList.remove("is-dragging"); };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  stage.addEventListener("dblclick", e => {
    if (!e.target.closest("button")) setZoom(ZOOM.z > 1 ? 1 : 2);
  });

  // Vuốt trên màn hình cảm ứng (chỉ khi chưa phóng)
  let startX = null;
  stage.addEventListener("touchstart", e => { startX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener("touchend", e => {
    if (startX === null || !VIEW || ZOOM.z > 1) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (dx < -50) show(VIEW.page + 1);
    if (dx >  50) show(VIEW.page - 1);
    startX = null;
  });
}

/* ---------- Khởi động ---------- */

function render() {
  const page = document.body.dataset.page;
  if (page === "login") { renderLogin(); return; }
  renderChrome();
  if (page === "home")   renderHome();
  if (page === "viewer") renderViewer();
}

(async function init() {
  const page = document.body.dataset.page;
  // Đã đăng nhập thì khỏi qua trang đăng nhập; chưa đăng nhập thì không vào được cổng
  if (page === "login" && session.active()) { location.replace("index.html"); return; }
  if (page !== "login" && !session.active()) { location.replace("login.html"); return; }

  document.documentElement.lang = LANG;
  await loadData();
  if (page === "viewer") bindViewerControls();
  if (page !== "login") bindGlobal();
  render();
})();
