/* ============================================================
   app.js — toàn bộ hành vi của trang web (Sightline)
   Gồm các phần:
     1. Ngôn ngữ, phiên đăng nhập, lưu trữ trên máy người xem
     2. Theo dõi lượt xem (tùy chọn)
     3. Khung chung: thanh trên, thông báo, menu người dùng, hộp thoại, tìm nhanh, phím tắt
     4. Trang đăng nhập (mẫu: chỉ có lối vào dành cho khách)
     5. Trang chủ: cột trái, báo cáo gần nhất, lưới báo cáo
     6. Trang xem báo cáo: lật trang, phóng to, lưu trang, ghi chú
   ============================================================ */

/* ---------- 1. Ngôn ngữ, phiên, lưu trữ ---------- */

// Điện thoại cầm dọc: trang xem báo cáo xoay 90° để bố cục luôn nằm ngang (khớp với CSS cuối style.css)
const ROTATED_Q = "(max-width: 720px) and (orientation: portrait)";

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

// Phiên đăng nhập (mẫu): lưu thời điểm hết hạn, 8 tiếng như một ngày làm việc.
// Dùng localStorage để mở báo cáo ở tab mới (Ctrl+bấm) vẫn còn đăng nhập.
const SESSION_MS = 8 * 60 * 60 * 1000;
const session = {
  active() { try { return +localStorage.getItem("auth") > Date.now(); } catch (_) { return false; } },
  start()  { try { localStorage.setItem("auth", String(Date.now() + SESSION_MS)); } catch (_) {} },
  end()    { try { localStorage.removeItem("auth"); } catch (_) {} },
};

function signOut() {
  track("sign_out");
  window.Tracker?.endSession();
  session.end();
  store.remove("notifSeen");
  location.href = "login";
}

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
  track("language", { lang });
  store.set("lang", lang);
  document.documentElement.lang = lang;
  render();   // vẽ lại trang bằng ngôn ngữ mới
}

// Lấy chuỗi đúng ngôn ngữ từ một đối tượng dạng { vi: "...", en: "..." }
function t(obj) {
  if (typeof obj === "string") return obj;
  return obj[LANG] ?? obj.en ?? "";
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Thay {tên} trong chuỗi bằng giá trị
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

// Gom mọi chuỗi của cả hai ngôn ngữ để tìm kiếm
const allText = o => Object.values(o).flat().join(" ").toLowerCase();

/* ---------- 2. Theo dõi lượt xem ---------- */

// Ghi một sự kiện hoạt động (ai, khi nào, làm gì) qua js/tracker.js; GoatCounter là tùy chọn.
function track(name, props) {
  if (window.Tracker) Tracker.event(name, props);
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

// Đường dẫn ảnh của một trang trong báo cáo.
// Mỗi trang chỉ có một bản lớn (3200px), dùng cho mọi nơi.
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

// Ghim, xem gần đây, trang đã lưu, ghi chú: lưu trên máy người xem
const getPins   = () => store.get("pins", []);
const getRecent = () => store.get("recent", []);
const getNotes  = () => store.get("notes", {});

function togglePin(id) {
  const pins = getPins();
  store.set("pins", pins.includes(id) ? pins.filter(x => x !== id) : [id, ...pins]);
}
function pushRecent(id) {
  store.set("recent", [id, ...getRecent().filter(x => x !== id)].slice(0, 8));
}
// Yêu cầu và ghi nhận chỉ được lưu trong trình duyệt này; mã tham chiếu tăng dần theo từng loại (REQ-001, ISS-001)
function saveEntry(kind, prefix, entry) {
  const seq = store.get("seq", {});
  seq[prefix] = (seq[prefix] || 0) + 1;
  store.set("seq", seq);
  const ref = `${prefix}-${String(seq[prefix]).padStart(3, "0")}`;
  store.set(kind, [{ ref, ...entry, at: new Date().toISOString() }, ...store.get(kind, [])].slice(0, 50));
  return ref;
}

// Bộ biểu tượng: Phosphor Icons (kiểu regular, giấy phép MIT), https://phosphoricons.com
// Mỗi biểu tượng là phần ruột của SVG 256×256, tô bằng màu chữ hiện tại.
const ICONS = {
  grid: '<path d="M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48Z"/>',
  star: '<path d="M239.18,97.26A16.38,16.38,0,0,0,224.92,86l-59-4.76L143.14,26.15a16.36,16.36,0,0,0-30.27,0L90.11,81.23,31.08,86a16.46,16.46,0,0,0-9.37,28.86l45,38.83L53,211.75a16.38,16.38,0,0,0,24.5,17.82L128,198.49l50.53,31.08A16.4,16.4,0,0,0,203,211.75l-13.76-58.07,45-38.83A16.46,16.46,0,0,0,239.18,97.26Zm-15.34,5.47-48.7,42a8,8,0,0,0-2.56,7.91l14.88,62.8a.37.37,0,0,1-.17.48c-.18.14-.23.11-.38,0l-54.72-33.65a8,8,0,0,0-8.38,0L69.09,215.94c-.15.09-.19.12-.38,0a.37.37,0,0,1-.17-.48l14.88-62.8a8,8,0,0,0-2.56-7.91l-48.7-42c-.12-.1-.23-.19-.13-.5s.18-.27.33-.29l63.92-5.16A8,8,0,0,0,103,91.86l24.62-59.61c.08-.17.11-.25.35-.25s.27.08.35.25L153,91.86a8,8,0,0,0,6.75,4.92l63.92,5.16c.15,0,.24,0,.33.29S224,102.63,223.84,102.73Z"/>',
  starFill: '<path d="M234.29,114.85l-45,38.83L203,211.75a16.4,16.4,0,0,1-24.5,17.82L128,198.49,77.47,229.57A16.4,16.4,0,0,1,53,211.75l13.76-58.07-45-38.83A16.46,16.46,0,0,1,31.08,86l59-4.76,22.76-55.08a16.36,16.36,0,0,1,30.27,0l22.75,55.08,59,4.76a16.46,16.46,0,0,1,9.37,28.86Z"/>',
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
  zoomIn: '<path d="M152,112a8,8,0,0,1-8,8H120v24a8,8,0,0,1-16,0V120H80a8,8,0,0,1,0-16h24V80a8,8,0,0,1,16,0v24h24A8,8,0,0,1,152,112Zm77.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88.11,88.11,0,1,1,11.31-11.31l50.07,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"/>',
  zoomOut: '<path d="M152,112a8,8,0,0,1-8,8H80a8,8,0,0,1,0-16h64A8,8,0,0,1,152,112Zm77.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88.11,88.11,0,1,1,11.31-11.31l50.07,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"/>',
  search: '<path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/>',
  note: '<path d="M229.66,58.34l-32-32a8,8,0,0,0-11.32,0l-96,96A8,8,0,0,0,88,128v32a8,8,0,0,0,8,8h32a8,8,0,0,0,5.66-2.34l96-96A8,8,0,0,0,229.66,58.34ZM124.69,152H104V131.31l64-64L188.69,88ZM200,76.69,179.31,56,192,43.31,212.69,64ZM224,128v80a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32h80a8,8,0,0,1,0,16H48V208H208V128a8,8,0,0,1,16,0Z"/>',
  dots: '<path d="M140,128a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm56-12a12,12,0,1,0,12,12A12,12,0,0,0,196,116ZM60,116a12,12,0,1,0,12,12A12,12,0,0,0,60,116Z"/>',
  flag: '<path d="M42.76,50A8,8,0,0,0,40,56V224a8,8,0,0,0,16,0V179.77c26.79-21.16,49.87-9.75,76.45,3.41,16.4,8.11,34.06,16.85,53,16.85,13.93,0,28.54-4.75,43.82-18a8,8,0,0,0,2.76-6V56A8,8,0,0,0,218.76,50c-28,24.23-51.72,12.49-79.21-1.12C111.07,34.76,78.78,18.79,42.76,50ZM216,172.25c-26.79,21.16-49.87,9.74-76.45-3.41-25-12.35-52.81-26.13-83.55-8.4V59.79c26.79-21.16,49.87-9.75,76.45,3.4,25,12.35,52.82,26.13,83.55,8.4Z"/>',
  mail: '<path fill-rule="evenodd" d="M32 48h192a16 16 0 0 1 16 16v128a16 16 0 0 1-16 16H32a16 16 0 0 1-16-16V64a16 16 0 0 1 16-16ZM36 68l92 66 92-66v22l-92 66-92-66Z"/>',
  linkedin: '<path transform="scale(10.6667)" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>',
  left: '<path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"/>',
  right: '<path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"/>',
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

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || "");
const MOD = isMac ? "⌘" : "Ctrl";

// Chữ viết tắt cho ảnh đại diện: chữ đầu của từ đầu và từ cuối ("Khanh Lê" thành "KL"); một từ thì một chữ
function initialsOf(name) {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : "";
  return (first + last).toLocaleUpperCase();
}

function renderChrome() {
  const P = DATA.portal;
  const u = P.persona;

  setText(".skip", t(DATA.ui.skipMain));
  setText(".topbar-tagline", t(DATA.site.tagline));
  const who = window.Tracker?.visitor().name || t(u.name);
  const initials = initialsOf(who) || t(u.initials);
  setText(".avatar", initials);
  document.querySelector(".user-btn").setAttribute("aria-label", `${t(u.menu)}: ${who}`);

  // Nút tìm nhanh
  const pal = document.querySelector(".palette-btn");
  pal.innerHTML = ico("search");
  pal.setAttribute("aria-label", t(P.palette.button));
  pal.title = `${t(P.palette.button)} (${MOD} K)`;
  pal.onclick = openPalette;

  // Menu người dùng: tài khoản, ngôn ngữ, trợ giúp, đăng xuất
  const menu = document.querySelector(".user-menu");
  menu.innerHTML = `
    <div class="menu-id">
      <span class="avatar">${initials}</span>
      <div><b>${esc(who)}</b><span>${t(u.role)} · ${t(u.access)}</span></div>
    </div>
    <div class="menu-row">
      <span class="menu-lbl">${ico("globe")}${t(P.menu.language)}</span>
      <div class="lang" role="group">
        <button type="button" data-lang="vi">VI</button>
        <button type="button" data-lang="en">EN</button>
      </div>
    </div>
    <div class="menu-sep"></div>
    <button type="button" class="menu-item" data-sec="sec-shortcuts">${ico("keyboard")}${t(P.menu.shortcuts)}</button>
    <button type="button" class="menu-item" data-sec="sec-top">${ico("info")}${t(P.menu.about)}</button>
    <button type="button" class="menu-item" data-sec="sec-contact">${ico("mail")}${t(P.menu.contact)}</button>
    <div class="menu-sep"></div>
    <button type="button" class="menu-item menu-out">${ico("signout")}${t(u.signOut)}</button>`;
  menu.querySelectorAll("[data-sec]").forEach(b => {
    b.onclick = () => { setPop(null); openAbout(b.dataset.sec); };
  });
  menu.querySelector(".menu-out").onclick = signOut;
  document.querySelector(".user-btn").onclick = e => { e.stopPropagation(); togglePop(".user"); };
  renderLangSwitch();

  renderNotifs();

  const back = document.querySelector(".back");
  if (back) { back.setAttribute("aria-label", t(DATA.ui.allReports)); back.title = t(DATA.ui.allReports); }
  const home = document.querySelector(".home-brand");
  if (home) home.setAttribute("aria-label", `${DATA.site.title}: ${t(DATA.ui.back)}`);
}

// Chuông thông báo: số chưa đọc trên nút, danh sách trong menu nổi
// "25 phút trước", "hôm qua": thời điểm tính lùi từ lúc xem, theo ngôn ngữ đang chọn
function timeAgo(min) {
  const f = new Intl.RelativeTimeFormat(LANG, { numeric: "auto" });
  if (min < 60) return f.format(-min, "minute");
  if (min < 1440) return f.format(-Math.round(min / 60), "hour");
  return f.format(-Math.round(min / 1440), "day");
}

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
      ${items.map(a => `<li><a href="report?id=${a.report}">
        <span class="notif-when">${t(P.notifTypes[a.type])} · <time title="${new Date(Date.now() - a.ago * 60000).toLocaleString(LANG)}">${timeAgo(a.ago)}</time></span>
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
  const open = menu.hidden;
  setPop(open ? sel : null);
  return open;
}

// Hộp thoại dùng chung: tạo một lần, nạp nội dung mỗi lần mở
function dialog(cls, html, locked = false) {
  let dlg = document.querySelector(`dialog.${cls}`);
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.className = `dlg ${cls}`;
    // Bấm ra ngoài để đóng: chỉ khi cả lúc nhấn và lúc thả chuột đều nằm ngoài hộp.
    // Bôi đen chữ rồi thả chuột ra ngoài hộp thì không tính là bấm ra ngoài.
    const outside = e => {
      const r = dlg.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let downOutside = false;
    dlg.addEventListener("mousedown", e => { downOutside = outside(e); });
    dlg.addEventListener("click", e => { if (downOutside && outside(e) && !dlg.dataset.locked) dlg.close(); downOutside = false; });
    // Hộp khóa (lời chào): bấm ra ngoài không đóng; Esc và nút trong hộp vẫn đóng được
    document.body.appendChild(dlg);
  }
  if (locked) dlg.dataset.locked = "1"; else delete dlg.dataset.locked;
  dlg.innerHTML = html;
  const heading = dlg.querySelector("h2");
  if (heading) { heading.id = heading.id || `${cls}-title`; dlg.setAttribute("aria-labelledby", heading.id); }
  else dlg.removeAttribute("aria-labelledby");
  dlg.querySelectorAll("[data-close]").forEach(b => { b.onclick = () => dlg.close(); });
  if (!dlg.open) dlg.showModal();
  return dlg;
}

const closeBtn = label => `<button type="button" class="dlg-x" data-close aria-label="${label}">×</button>`;

// Hai đường liên hệ: gmail và LinkedIn. Bấm vào được ghi lại để biết người xem muốn liên hệ qua đâu.
function contactLinks() {
  const C = DATA.portal.contact;
  return `<ul class="contact">
    <li><a href="mailto:${C.email}" data-contact="email">${ico("mail")}<span>${C.email}</span></a></li>
    <li><a href="${C.linkedinUrl}" target="_blank" rel="noopener" data-contact="linkedin">${ico("linkedin")}<span>${C.linkedinLabel}</span></a></li>
  </ul>`;
}
document.addEventListener("click", e => {
  const link = e.target.closest("[data-contact]");
  if (link) track("contact_click", { via: link.dataset.contact });
});

// Hộp "Về Sightline": sản phẩm là gì, khám phá được gì, phím tắt.
// `section` là mục cần cuộn tới.
function openAbout(section = "sec-top") {
  const A = DATA.portal.about;
  const list = items => `<ul>${items.map(i => `<li><b>${t(i.h)}:</b> ${t(i.t)}</li>`).join("")}</ul>`;
  const dlg = dialog("about", `
    <div class="dlg-head" id="sec-top">
      <h2>${t(A.title)}</h2>${closeBtn(t(A.close))}
    </div>
    <h3>${t(A.whatTitle)}</h3>
    <p class="dlg-body">${t(A.whatText)}</p>
    <h3>${t(A.demoTitle)}</h3>${list(A.demoItems)}
    <h3>${t(A.prodTitle)}</h3>${list(A.prodItems)}
    <h3 id="sec-contact">${t(DATA.portal.contact.title)}</h3>
    <p class="dlg-body">${t(DATA.portal.contact.text)}</p>${contactLinks()}
    <h3 id="sec-shortcuts">${t(A.shortcutsTitle)}</h3>
    <dl class="keys">
      ${A.shortcuts.map(s => `<dt>${s.k.split(" ").map(k => `<kbd>${k === "Ctrl" ? MOD : k}</kbd>`).join(" ")}</dt><dd>${t(s.d)}</dd>`).join("")}
    </dl>`);
  const target = dlg.querySelector(`#${section}`);
  if (target && section !== "sec-top") target.scrollIntoView({ block: "start" });
  else dlg.scrollTop = 0;
}

// Hộp "Yêu cầu báo cáo": kiểm tra ô bắt buộc, báo lỗi ngay tại ô.
// Yêu cầu chỉ được lưu trong trình duyệt này, không gửi đi đâu, và thông báo nói đúng như vậy.
function openRequest() {
  const R = DATA.portal.request;
  const depts = Object.keys(DATA.domains)
    .map(k => `<option value="${k}">${t(DATA.domains[k].name)}</option>`).join("");
  const dlg = dialog("request", `
    <form novalidate>
      <div class="dlg-head"><h2>${t(R.title)}</h2>${closeBtn(t(R.close))}</div>
      <label class="field">${t(R.name)}
        <input name="name" type="text" autocomplete="off" spellcheck="false" aria-describedby="err-name">
        <span class="field-err" id="err-name" hidden>${t(R.errName)}</span>
      </label>
      <label class="field">${t(R.dept)}
        <select name="dept">${depts}</select>
      </label>
      <label class="field">${t(R.need)}
        <textarea name="need" rows="3" placeholder="${t(R.needPlaceholder)}…"></textarea>
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
    const ref = saveEntry("requests", "REQ", { name, dept: form.dept.value, need: form.need.value.trim() });
    track("request_saved", { ref });
    dlg.innerHTML = `
      <div class="dlg-head"><h2>${t(R.doneTitle)}</h2>${closeBtn(t(R.close))}</div>
      <p class="dlg-intro"></p>
      <div class="dlg-actions"><button type="button" class="btn btn-primary" data-close>${t(R.close)}</button></div>`;
    dlg.querySelector(".dlg-intro").textContent = fill(t(R.doneText), { name, ref });
    dlg.querySelectorAll("[data-close]").forEach(b => { b.onclick = () => dlg.close(); });
  };
  form.name.focus();
}

// Tìm nhanh (Ctrl K): gõ để tới báo cáo, trang đã lưu hoặc chạy lệnh. Phím mũi tên chọn, Enter chạy.
function openPalette() {
  track("palette_open");
  const PL = DATA.portal.palette;
  const dlg = dialog("palette", `
    <div class="pal-head">
      ${ico("search")}
      <input class="pal-input" type="text" role="combobox" aria-expanded="true" aria-controls="pal-list"
        autocomplete="off" placeholder="${t(PL.placeholder)}…" aria-label="${t(PL.placeholder)}" spellcheck="false">
      <kbd>Esc</kbd>
    </div>
    <div class="pal-list" id="pal-list" role="listbox"></div>`);
  dlg.setAttribute("aria-label", t(PL.button));
  const input = dlg.querySelector(".pal-input");
  const listEl = dlg.querySelector(".pal-list");

  const go = url => () => { location.href = url; };
  const items = [
    ...DATA.reports.map(r => ({
      group: "reports", icon: DATA.domains[r.domain].icon || "grid", label: t(r.title),
      hint: t(DATA.domains[r.domain].name),
      hay: `${allText(r.title)} ${allText(r.summary)} ${allText(r.tags)}`,
      run: go(`report?id=${r.id}`),
    })),
    { group: "actions", icon: "plus", label: t(PL.request), hay: "request yêu cầu báo cáo mới", run: () => { dlg.close(); openRequest(); } },
    { group: "actions", icon: "globe", label: t(LANG === "vi" ? PL.toEn : PL.toVi), hay: "language ngôn ngữ english tiếng việt",
      run: () => { dlg.close(); setLang(LANG === "vi" ? "en" : "vi"); } },
    { group: "actions", icon: "keyboard", label: t(PL.shortcuts), hay: "keyboard shortcuts phím tắt", run: () => { dlg.close(); openAbout("sec-shortcuts"); } },
    { group: "actions", icon: "info", label: t(PL.about), hay: "about sightline giới thiệu", run: () => { dlg.close(); openAbout(); } },
    { group: "actions", icon: "signout", label: t(PL.signOut), hay: "sign out đăng xuất logout", run: signOut },
  ];

  let shown = [];
  let active = 0;
  const mark = () => listEl.querySelectorAll(".pal-item").forEach(b => {
    const on = +b.dataset.i === active;
    b.setAttribute("aria-selected", on);
    if (on) { b.scrollIntoView({ block: "nearest" }); input.setAttribute("aria-activedescendant", b.id); }
  });
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    shown = items.filter(i => !q || i.hay.includes(q) || i.label.toLowerCase().includes(q));
    active = Math.min(active, Math.max(shown.length - 1, 0));
    let html = "", last = "";
    shown.forEach((i, idx) => {
      if (i.group !== last) { html += `<div class="pal-group">${t(PL[i.group])}</div>`; last = i.group; }
      html += `<button type="button" role="option" id="pal-opt-${idx}" class="pal-item" data-i="${idx}" aria-selected="${idx === active}">
        ${ico(i.icon)}<span class="pal-label">${i.label}</span><span class="pal-hint">${i.hint}</span></button>`;
    });
    listEl.innerHTML = html || `<p class="pal-none">${t(PL.none)}</p>`;
    listEl.querySelectorAll(".pal-item").forEach(b => {
      b.onclick = () => shown[+b.dataset.i].run();
      b.onmousemove = () => { if (active !== +b.dataset.i) { active = +b.dataset.i; mark(); } };
    });
    mark();
  };
  input.oninput = () => { active = 0; draw(); };
  input.onkeydown = e => {
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, shown.length - 1); mark(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); mark(); }
    else if (e.key === "Enter") { e.preventDefault(); shown[active]?.run(); }
  };
  draw();
  input.focus();
}

// Phím tắt và đóng menu nổi dùng chung các trang trong cổng
function bindGlobal() {
  document.addEventListener("click", e => {
    // composedPath vẫn đúng khi nút vừa bấm đã bị vẽ lại (vd: đổi ngôn ngữ trong menu)
    if (!e.composedPath().some(n => n.classList?.contains("pop"))) setPop(null);
  });

  document.addEventListener("keydown", e => {
    // Ctrl K / ⌘ K: mở hoặc đóng tìm nhanh ở mọi nơi
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const open = document.querySelector("dialog.palette[open]");
      if (open) open.close(); else openPalette();
      return;
    }
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

  setText(".skip", t(DATA.ui.skipSignin));
  setText(".login-title", t(L.title));
  setText(".login-text", t(L.text));
  setText(".form-title", t(L.formTitle));
  setText(".form-sub", t(L.formSub));
  setText(".sso-label", t(L.microsoft));
  setText(".or span", t(L.or));


  const guest = document.querySelector(".guest-btn");
  guest.title = t(L.guestHint);
  guest.innerHTML = `${ico("user")}<span>${t(L.guest)}</span>`;
  guest.onclick = openGuestDialog;
  renderLoginArt();
  showWelcome();
}

// Hỏi tên khách trước khi vào: chỉ một ô, và nói rõ hoạt động được ghi lại
function openGuestDialog() {
  const L = DATA.portal.login;
  const dlg = dialog("guest", `
    <form novalidate>
      <div class="dlg-head"><h2>${t(L.nameTitle)}</h2>${closeBtn(t(DATA.portal.request.close))}</div>
      <label class="field">${t(L.nameLabel)}
        <input name="name" type="text" maxlength="60" autocomplete="name" spellcheck="false" placeholder="${t(L.namePlaceholder)}…" aria-describedby="err-gname hint-gname">
        <span class="field-err" id="err-gname" hidden>${t(L.nameErr)}</span>
      </label>
      <p class="dlg-note" id="hint-gname">${t(L.nameHint)}</p>
      <div class="dlg-actions">
        <button type="button" class="btn" data-close>${t(L.nameCancel)}</button>
        <button type="submit" class="btn btn-primary">${t(L.nameSubmit)}</button>
      </div>
    </form>`);
  const form = dlg.querySelector("form");
  form.name.value = window.Tracker?.visitor().name || "";
  form.onsubmit = e => {
    e.preventDefault();
    const name = form.name.value.trim().replace(/\s+/g, " ");
    dlg.querySelector(".field-err").hidden = !!name;
    form.name.setAttribute("aria-invalid", !name);
    if (!name) { form.name.focus(); return; }
    window.Tracker?.identify(name);
    session.start();
    store.remove("notifSeen");
    track("login", { method: "guest" });
    window.Tracker?.flush();
    location.href = "./";
  };
  form.name.focus();
}

// Lời chào ở trang đăng nhập: hiện mỗi lần mở hoặc tải lại trang, và chỉ tắt khi bấm nút trải nghiệm.
// Đổi ngôn ngữ (ngay trong hộp này hoặc ở nút VI | EN) thì chỉ dựng lại chữ, không mở thêm hộp mới.
let welcomeStarted = false;
function drawWelcome() {
  const W = DATA.portal.welcome;
  const dlg = dialog("welcome", `
    <div class="wc-top">
      <h2 class="wc-title">${t(W.title)}</h2>
      <div class="lang" role="group" aria-label="${t(DATA.portal.menu.language)}">
        <button type="button" data-lang="vi">VI</button>
        <button type="button" data-lang="en">EN</button>
      </div>
    </div>
    <p class="wc-greet">${t(W.greet)}</p>
    <p class="wc-body">${t(W.body)}</p>
    <p class="wc-body">${t(W.invite)}</p>
    <div class="dlg-actions"><button type="button" class="btn btn-primary" data-start>${t(W.cta)}</button></div>
    <div class="wc-contact"><span>${t(DATA.portal.contact.title)}</span>${contactLinks()}</div>`, true);
  renderLangSwitch();
  const start = dlg.querySelector("[data-start]");
  start.onclick = () => { delete dlg.dataset.locked; dlg.close(); };
  return dlg;
}
function showWelcome() {
  const open = document.querySelector("dialog.welcome[open]");
  if (open) { drawWelcome(); return; }      // đang mở: chỉ làm mới chữ theo ngôn ngữ mới
  if (welcomeStarted) return;               // đã đóng rồi thì không mở lại khi đổi ngôn ngữ
  welcomeStarted = true;
  setTimeout(() => drawWelcome().querySelector("[data-start]").focus(), 350);
}

// Hình trừu tượng cho nửa trái: cột biểu đồ "thở" nhẹ, một đường xu hướng vẽ dần và một chấm chạy theo đường.
// Dựng bằng SVG và CSS, không dùng ảnh. Chuyển động tắt khi người dùng chọn giảm chuyển động.
function renderLoginArt() {
  const host = document.querySelector(".login-art");
  if (!host || host.firstChild) return;
  const W = 760, H = 320, n = 32, slot = W / n, bw = slot * 0.56;
  const hs = Array.from({ length: n }, (_, i) => {
    const wave = 0.5 + 0.5 * Math.sin(i * 0.52 + 0.8);
    const wobble = 0.62 + 0.38 * Math.sin(i * 0.23 + 2);
    return Math.min(250, 46 + 150 * wave * wobble + i * 2.4);
  });
  const bars = hs.map((h, i) => {
    const x = (i * slot + (slot - bw) / 2).toFixed(1);
    const hot = i % 9 === 4;
    return `<rect class="bar${hot ? " bar-hot" : ""}" style="--i:${i}" x="${x}" y="${(H - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3"/>`;
  }).join("");
  const pts = hs.map((h, i) => [i * slot + slot / 2, H - (h * 0.72 + 56 + 18 * Math.sin(i * 0.4))]);
  // đường cong mượt: nối các điểm giữa bằng đường bậc hai
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
  }
  const last = pts[pts.length - 1];
  d += ` T${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
  host.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" role="presentation" focusable="false">
      <g class="grid-lines">
        <line x1="0" x2="${W}" y1="${H * 0.25}" y2="${H * 0.25}"/><line x1="0" x2="${W}" y1="${H * 0.5}" y2="${H * 0.5}"/>
        <line x1="0" x2="${W}" y1="${H * 0.75}" y2="${H * 0.75}"/>
      </g>
      ${bars}
      <path class="trend" d="${d}" pathLength="1"/>
      <g class="runner" style="offset-path: path('${d}')"><circle class="halo" r="11"/><circle class="dot" r="4.5"/></g>
      <line class="base" x1="0" x2="${W}" y1="${H - 0.5}" y2="${H - 0.5}"/>
    </svg>`;
}

/* ---------- 5. Trang chủ ---------- */

let FILTER = store.get("filter", "all");   // "all" | "pinned" | "recent" | khóa phòng ban
let QUERY = "";                            // chuỗi tìm kiếm
let SORT = store.get("sort", "default");   // "default" | "az" | "pages"

// Bộ lọc, sắp xếp và từ khóa nằm trên địa chỉ trang (?f=&s=&q=) để gửi link là thấy đúng danh sách
let urlRead = false;
function readUrlState() {
  if (urlRead) return;
  urlRead = true;
  const q = new URLSearchParams(location.search);
  if (q.has("f")) FILTER = q.get("f");
  if (q.has("s")) SORT = q.get("s");
  if (q.has("q")) QUERY = q.get("q").trim().toLowerCase();
}
function syncUrl() {
  const q = new URLSearchParams();
  if (FILTER !== "all") q.set("f", FILTER);
  if (SORT !== "default") q.set("s", SORT);
  if (QUERY) q.set("q", QUERY);
  const s = q.toString();
  history.replaceState(null, "", location.pathname + (s ? `?${s}` : ""));
}

function renderHome() {
  readUrlState();
  const P = DATA.portal;
  document.title = `${DATA.site.title} — ${t(DATA.site.tagline)}`;
  if (!["all", "pinned", "recent"].includes(FILTER) && !DATA.domains[FILTER]) FILTER = "all";
  if (!P.sort[SORT]) SORT = "default";

  const req = document.querySelector(".request-btn");
  req.innerHTML = `${ico("plus")}${t(P.request.button)}`;
  req.onclick = openRequest;

  const input = document.querySelector(".search input");
  input.placeholder = `${t(P.search)}…`;
  input.value = QUERY;
  input.setAttribute("aria-label", t(P.search));
  let searchTimer;
  input.oninput = () => {
    QUERY = input.value.trim().toLowerCase();
    renderReports();
    clearTimeout(searchTimer);
    if (QUERY) searchTimer = setTimeout(() => track("search", { q: QUERY }), 1200);
  };

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

// Một hàng gọn: trang xem gần nhất; nếu chưa xem gì thì giới thiệu báo cáo đầu tiên trong danh sách (không phải gợi ý cá nhân hóa)
function renderContinue() {
  const P = DATA.portal;
  const last = store.get("last", null);
  let r = last && byId(last.id);
  const page = r ? Math.min(Math.max(last.page, 1), totalPages(r)) : 1;
  const seen = !!r;
  if (!r) r = DATA.reports[0];

  document.querySelector(".panel-continue").innerHTML = `
    <a class="resume" href="report?id=${r.id}&page=${page}">
      <img src="${pageSrc(r, r.from + page - 1)}" alt="" width="160" height="100" loading="lazy" decoding="async">
      <span class="resume-text">
        <span class="resume-label">${t(seen ? P.continue.title : P.continue.featured)}</span>
        <b>${t(r.title)}</b>
        <span>${t(DATA.domains[r.domain].name)}${seen
          ? ` · ${fill(t(P.continue.page), { a: page, b: totalPages(r) })}` : ""}</span>
      </span>
      <span class="btn">${seen ? fill(t(P.continue.openPage), { n: page }) : t(P.continue.open)}</span>
    </a>`;
}

// Cột trái: thư viện (tất cả, đã ghim, gần đây), trang đã lưu, rồi từng phòng ban kèm danh sách báo cáo để mở thẳng
function renderNav() {
  const P = DATA.portal;
  const known = id => DATA.reports.some(r => r.id === id);
  const lib = [
    ["all",    "grid",  t(P.all),    DATA.reports.length],
    ["pinned", "star",  t(P.pinned), getPins().filter(known).length],
    ["recent", "clock", t(P.recent), getRecent().filter(known).length],
  ];
  const row = ([k, icon, label, n]) => `<button type="button" class="nav-item" data-key="${k}"
    aria-current="${k === FILTER}">${ico(icon)}<span class="nav-name">${label}</span><span class="n">${n}</span></button>`;

  const depts = Object.keys(DATA.domains).map(k => {
    const reps = DATA.reports.filter(r => r.domain === k);
    return row([k, DATA.domains[k].icon || "grid", t(DATA.domains[k].name), reps.length]) +
      `<div class="nav-reports">${reps.map(r =>
        `<a href="report?id=${r.id}" title="${t(r.title)}">${t(r.title)}</a>`).join("")}</div>`;
  }).join("");

  const nav = document.querySelector(".nav-list");
  nav.innerHTML = `<div class="nav-label">${t(P.library)}</div>` + lib.map(row).join("") +
    `<div class="nav-label">${t(P.depts)}</div>` + depts;
  nav.querySelectorAll("button[data-key]").forEach(b => {
    b.onclick = () => {
      FILTER = b.dataset.key;
      track("filter", { key: FILTER });
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
    <a class="card-link" href="report?id=${r.id}">
      <div class="card-frame">
        <img src="${pageSrc(r, r.from)}" alt="" width="640" height="400" loading="lazy" decoding="async">
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span>${t(DATA.domains[r.domain].name)}</span>
          <span>${n} ${t(n === 1 ? DATA.ui.pageOne : DATA.ui.pages)}</span>
        </div>
        <h2>${t(r.title)}</h2>
        <p>${t(r.summary)}</p>
        <ul class="tags">${t(r.tags).map(g => `<li>${esc(g)}</li>`).join("")}</ul>
      </div>
    </a>
    <button type="button" class="pin" aria-pressed="${pinned}"
      aria-label="${t(pinned ? P.unpin : P.pin)}: ${t(r.title)}" title="${t(pinned ? P.unpin : P.pin)}">${ico(pinned ? "starFill" : "star")}</button>`;
}

// Lưới thẻ báo cáo (vẽ lại khi đổi bộ lọc, tìm kiếm, sắp xếp hoặc ngôn ngữ)
function renderReports() {
  const P = DATA.portal;
  syncUrl();
  const pins = getPins();
  const recent = getRecent();

  let list = DATA.reports.filter(r => {
    if (FILTER === "pinned") return pins.includes(r.id);
    if (FILTER === "recent") return recent.includes(r.id);
    return FILTER === "all" || r.domain === FILTER;
  });
  if (QUERY) {
    // Tìm trong cả hai ngôn ngữ để gõ tiếng Việt hay tiếng Anh đều ra kết quả
    list = list.filter(r => [allText(r.title), allText(r.summary), allText(DATA.domains[r.domain].name),
      allText(r.tags), allText(r.questions)].join(" ").includes(QUERY));
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
    card.querySelector(".card-link").addEventListener("click", () => { pushRecent(r.id); track("open_report", { report: r.id }); });
    card.querySelector(".pin").onclick = () => { togglePin(r.id); track("star", { report: r.id, on: getPins().includes(r.id) }); renderNav(); renderReports(); };
    grid.appendChild(card);
  }

  const empty = document.querySelector(".empty");
  empty.hidden = list.length > 0;
  if (!list.length) {
    const E = P.empties;
    const e = QUERY ? E.search : FILTER === "pinned" ? E.pinned : FILTER === "recent" ? E.recent : E.all;
    const input = document.querySelector(".search input");
    setText(".empty-title", fill(t(e.title), { q: input.value.trim() }));
    setText(".empty-text", t(e.text));
    const btn = document.querySelector(".empty-btn");
    btn.hidden = !e.action;
    if (e.action) {
      btn.textContent = t(e.action);
      btn.onclick = () => { input.value = ""; QUERY = ""; renderReports(); input.focus(); };
    }
  }
}

/* ---------- 6. Trang xem báo cáo ---------- */

let VIEW = null;   // trạng thái: báo cáo đang xem và trang hiện tại

function renderViewer() {
  const params = new URLSearchParams(location.search);
  const report = byId(params.get("id"));

  if (!report) {
    document.title = `${t(DATA.ui.notFound)} — ${DATA.site.title}`;
    setText(".topbar-title", t(DATA.ui.notFound));
    document.querySelector(".stage").classList.add("is-missing");
    showStageMsg(t(DATA.ui.notFound), t(DATA.ui.notFoundHelp), true);
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
  const dom = DATA.domains[report.domain];
  const deptEl = document.querySelector(".topbar-dept");
  if (deptEl) deptEl.innerHTML = `${ico(dom.icon || "grid")}${esc(t(dom.name))}`;
  setText(".counter-label", t(DATA.portal.page));
  document.querySelector(".nav.prev").setAttribute("aria-label", t(DATA.ui.prev));
  document.querySelector(".nav.next").setAttribute("aria-label", t(DATA.ui.next));
  document.querySelector(".pager").setAttribute("aria-label", t(DATA.portal.pagesNav));

  // Thanh ảnh nhỏ (đang ẩn trong HTML): một nút cho mỗi trang
  const strip = document.querySelector(".strip");
  strip.innerHTML = "";
  for (let i = 1; i <= total; i++) {
    const b = document.createElement("button");
    b.innerHTML = `<img src="${pageSrc(report, report.from + i - 1)}" alt=""><span class="thumb-n">${i}</span>`;
    b.setAttribute("aria-label", `${t(DATA.ui.page)} ${i}`);
    b.onclick = () => show(i);
    strip.appendChild(b);
  }

  renderPager();
  renderZoomControls();
  renderMenus();
  show(VIEW.page);
}

// Điều khiển trang ở giữa thanh trên: lùi, ô số trang (gõ để nhảy), tiến
function renderPager() {
  const R = DATA.portal.report;
  const prev = document.querySelector(".pg-prev"), next = document.querySelector(".pg-next");
  prev.innerHTML = ico("left");  prev.setAttribute("aria-label", t(DATA.ui.prev)); prev.title = `${t(DATA.ui.prev)} (←)`;
  next.innerHTML = ico("right"); next.setAttribute("aria-label", t(DATA.ui.next)); next.title = `${t(DATA.ui.next)} (→)`;
  prev.onclick = () => show(VIEW.page - 1);
  next.onclick = () => show(VIEW.page + 1);

  const input = document.querySelector(".pg-input");
  input.setAttribute("aria-label", t(R.goto));
  input.onfocus = () => input.select();
  input.onkeydown = e => {
    if (e.key === "Enter") { show(parseInt(input.value, 10) || VIEW.page); input.blur(); }
    if (e.key === "Escape") { input.value = VIEW.page; input.blur(); e.stopPropagation(); }
  };
  input.onblur = () => { input.value = VIEW.page; sizePageInput(); };
  input.oninput = sizePageInput;
  setText(".pg-total", `/ ${totalPages(VIEW.report)}`);
}

// Ô số trang rộng đúng bằng số chữ số, để "1 / 5" nằm giữa khung thay vì lệch trái
function sizePageInput() {
  const input = document.querySelector(".pg-input");
  if (input) input.style.width = `${Math.max(1, input.value.length)}ch`;
}

// Nút phóng to trên thanh trên
function renderZoomControls() {
  const R = DATA.portal.report;
  const zi = document.querySelector(".zoom-in"), zo = document.querySelector(".zoom-out"), zv = document.querySelector(".zoom-val");
  zi.innerHTML = ico("zoomIn");  zi.setAttribute("aria-label", t(R.zoomIn));  zi.title = `${t(R.zoomIn)} (+)`;
  zo.innerHTML = ico("zoomOut"); zo.setAttribute("aria-label", t(R.zoomOut)); zo.title = `${t(R.zoomOut)} (-)`;
  zv.setAttribute("aria-label", t(R.zoomReset)); zv.title = `${t(R.zoomReset)} (0)`;
  zi.onclick = () => setZoom(ZOOM.z + 0.5);
  zo.onclick = () => setZoom(ZOOM.z - 0.5);
  zv.onclick = () => setZoom(1);
  applyZoom();
}

// Lưu trang, ghi chú và menu "Thêm" (chia sẻ, tải về, toàn màn hình, về báo cáo, báo vấn đề)
function renderMenus() {
  const R = DATA.portal.report;
  const more = document.querySelector(".more-btn");
  more.innerHTML = `${ico("dots")}<span class="dot" hidden></span>`;

  // Nút "Xem toàn màn hình ngang": chỉ hiện trên máy cảm ứng đang để dọc (CSS) và khi trình duyệt có toàn màn hình
  const land = document.querySelector(".land-btn");
  if (land && document.fullscreenEnabled) {
    land.innerHTML = `${ico("fs")}${t(R.landscape)}`;
    land.hidden = false;
    land.onclick = toggleFullscreen;
  }
  more.setAttribute("aria-label", t(R.more));
  more.title = t(R.more);
  more.onclick = e => { e.stopPropagation(); togglePop(".more"); };

  // Chia sẻ, tải về, toàn màn hình: ba nút hiện sẵn ở thanh trên
  const actions = {
    share:    { icon: "clip",     label: t(DATA.portal.share), key: "" },
    download: { icon: "download", label: t(R.download),        key: "" },
    fs:       { icon: "fs",       label: t(R.fullscreen),      key: "F" },
  };
  document.querySelectorAll(".act-btn").forEach(b => {
    const a = actions[b.dataset.act];
    b.innerHTML = ico(a.icon);
    b.setAttribute("aria-label", a.label);
    b.title = a.key ? `${a.label} (${a.key})` : a.label;
  });
  const menu = document.querySelector(".more-menu");
  // Khi thanh trên hẹp, nút phóng to và ba nút chia sẻ/tải về/toàn màn hình thu vào menu này (CSS ẩn hiện theo độ rộng)
  menu.innerHTML = `
    <button type="button" class="menu-item mi-zoom" data-act="zin">${ico("zoomIn")}${t(R.zoomIn)}<kbd>+</kbd></button>
    <button type="button" class="menu-item mi-zoom" data-act="zout">${ico("zoomOut")}${t(R.zoomOut)}<kbd>-</kbd></button>
    <button type="button" class="menu-item mi-zoom" data-act="zreset">${ico("search")}${t(R.zoomReset)}<kbd class="mi-zoom-val">100%</kbd></button>
    <div class="menu-sep mi-zoom"></div>
    <button type="button" class="menu-item mi-acts" data-act="share">${ico(actions.share.icon)}${actions.share.label}</button>
    <button type="button" class="menu-item mi-acts" data-act="download">${ico(actions.download.icon)}${actions.download.label}</button>
    <button type="button" class="menu-item mi-acts mi-fs" data-act="fs">${ico(actions.fs.icon)}${actions.fs.label}<kbd>F</kbd></button>
    <div class="menu-sep mi-acts"></div>
    <button type="button" class="menu-item" data-act="note">${ico("note")}${t(R.note)}<span class="mi-dot" hidden></span></button>
    <button type="button" class="menu-item" data-act="about">${ico("info")}${t(R.aboutReport)}</button>
    <button type="button" class="menu-item" data-act="issue">${ico("flag")}${t(R.issue)}</button>`;
  const acts = { share: sharePage, download: downloadPage, fs: toggleFullscreen, about: openReportInfo, issue: openIssue,
    note: () => { setPop(".note"); setTimeout(() => document.querySelector(".note-text")?.focus(), 0); },
    zin: () => setZoom(ZOOM.z + 0.5), zout: () => setZoom(ZOOM.z - 0.5), zreset: () => setZoom(1) };
  document.querySelectorAll("[data-act]").forEach(b => { b.onclick = () => { setPop(null); acts[b.dataset.act](); }; });
}

// Ghi chú riêng cho từng trang, tự lưu khi gõ
function renderNote() {
  const R = DATA.portal.report;
  const key = `${VIEW.report.id}:${VIEW.page}`;
  const notes = getNotes();
  // Chấm báo "trang này có ghi chú" hiện ở nút ba chấm và ở mục Ghi chú trong menu
  const markNote = has => document.querySelectorAll(".more-btn .dot, .mi-dot").forEach(d => { d.hidden = !has; });
  markNote(!!notes[key]);

  const menu = document.querySelector(".note-menu");
  menu.innerHTML = `
    <label class="note-label" for="note-text">${t(R.noteTitle)} <span>(${VIEW.page} / ${totalPages(VIEW.report)})</span></label>
    <textarea id="note-text" class="note-text" rows="6" placeholder="${t(R.notePlaceholder)}…"></textarea>
    <div class="note-foot"><span>${t(R.noteHint)}</span><span class="note-status" role="status"></span></div>`;
  const ta = menu.querySelector("textarea");
  ta.value = notes[key] || "";
  let timer;
  ta.oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const all = getNotes();
      const v = ta.value.trim();
      if (v) all[key] = ta.value; else delete all[key];
      store.set("notes", all);
      markNote(!!v);
      menu.querySelector(".note-status").textContent = t(R.noteSaved);
    }, 400);
  };
}

// Hộp "Về báo cáo này": mục đích, câu hỏi kinh doanh và chi tiết.
// Chủ sở hữu, tần suất làm mới, lần làm mới cuối và kỳ báo cáo chỉ hiện khi dữ liệu báo cáo có giá trị thật.
function openReportInfo() {
  const R = DATA.portal.report;
  const r = VIEW.report;
  const rows = [[R.dept, t(DATA.domains[r.domain].name)], [R.length, totalPages(r)]];
  for (const [key, label] of [["owner", R.owner], ["refresh", R.refresh], ["lastRefreshed", R.lastRefreshed], ["period", R.period]]) {
    if (r[key]) rows.push([label, t(r[key])]);
  }
  dialog("rinfo", `
    <div class="dlg-head"><h2>${t(r.title)}</h2>${closeBtn(t(DATA.portal.about.close))}</div>
    <p class="dlg-body">${t(r.summary)}</p>
    <h3>${t(R.questions)}</h3>
    <ul>${t(r.questions).map(q => `<li>${q}</li>`).join("")}</ul>
    <h3>${t(R.details)}</h3>
    <dl class="info-meta">${rows.map(([k, v]) => `<div><dt>${t(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>`);
}

// Hộp "Báo lỗi số liệu": kèm số trang đang xem. Chỉ lưu trong trình duyệt này và nói rõ như vậy.
function openIssue() {
  const R = DATA.portal.report;
  const r = VIEW.report;
  const dlg = dialog("issue", `
    <form novalidate>
      <div class="dlg-head"><h2>${t(R.issueTitle)}</h2>${closeBtn(t(DATA.portal.about.close))}</div>
      <label class="field">${fill(t(R.issueLabel), { n: VIEW.page })}
        <textarea name="what" rows="4" aria-describedby="err-issue"></textarea>
        <span class="field-err" id="err-issue" hidden>${t(R.issueErr)}</span>
      </label>
      <div class="dlg-actions">
        <button type="button" class="btn" data-close>${t(DATA.portal.request.cancel)}</button>
        <button type="submit" class="btn btn-primary">${t(R.issueSubmit)}</button>
      </div>
    </form>`);
  const form = dlg.querySelector("form");
  form.onsubmit = e => {
    e.preventDefault();
    const text = form.what.value.trim();
    form.querySelector(".field-err").hidden = !!text;
    form.what.setAttribute("aria-invalid", !text);
    if (!text) { form.what.focus(); return; }
    const page = VIEW.page;
    const ref = saveEntry("issues", "ISS", { report: r.id, page, text });
    track("issue_saved", { ref, report: r.id, page });
    dlg.innerHTML = `
      <div class="dlg-head"><h2>${t(R.issueDoneTitle)}</h2>${closeBtn(t(DATA.portal.about.close))}</div>
      <p class="dlg-intro"></p>
      <div class="dlg-actions"><button type="button" class="btn btn-primary" data-close>${t(DATA.portal.about.close)}</button></div>`;
    dlg.querySelector(".dlg-intro").textContent = fill(t(R.issueDone), { report: t(r.title), n: page, ref });
    dlg.querySelectorAll("[data-close]").forEach(b => { b.onclick = () => dlg.close(); });
  };
  form.what.focus();
}

// Sao chép liên kết tới trang đang xem; báo rõ khi không sao chép được
async function sharePage() {
  try {
    track("share", { report: VIEW.report.id, page: VIEW.page });
    await navigator.clipboard.writeText(location.href);
    toast(t(DATA.portal.linkCopied));
  } catch (_) {
    toast(t(DATA.portal.report.linkFail));
  }
}

function downloadPage() {
  const { report, page } = VIEW;
  track("download", { report: report.id, page });
  const a = document.createElement("a");
  a.href = pageSrc(report, report.from + page - 1);
  a.download = `${report.folder}-page-${String(page).padStart(2, "0")}.webp`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function showStageMsg(title, text, withLink) {
  const m = document.querySelector(".stage-msg");
  m.hidden = false;
  setText(".stage-msg .empty-title", title);
  setText(".stage-msg .empty-text", text);
  const a = m.querySelector("a");
  a.hidden = !withLink;
  a.textContent = t(DATA.ui.backToAll);
}

function toggleFullscreen() {
  if (document.fullscreenElement) { screen.orientation?.unlock?.(); document.exitFullscreen(); return; }
  const req = document.querySelector(".stage").requestFullscreen?.();
  // Điện thoại: báo cáo nằm ngang nên xoay màn hình ngang khi vào toàn màn hình (Android Chrome; iOS không hỗ trợ)
  if (req && matchMedia("(pointer: coarse)").matches && screen.orientation?.lock) {
    req.then(() => screen.orientation.lock("landscape")).catch(() => {});
  }
}

// Phóng to: nút +/-, phím + - 0, bấm đúp; kéo để dịch chuyển khi đang phóng. Không có thanh cuộn.
const ZOOM = { z: 1, x: 0, y: 0 };

function applyImage() {
  const { report, page } = VIEW;
  const img = document.querySelector(".stage img");
  img.parentElement.classList.remove("is-empty");
  document.querySelector(".stage-msg").hidden = true;
  img.src = pageSrc(report, report.from + page - 1);
}

function clampPan() {
  const stage = document.querySelector(".stage");
  const mx = (ZOOM.z - 1) * stage.offsetWidth / 2;
  const my = (ZOOM.z - 1) * stage.offsetHeight / 2;
  ZOOM.x = Math.min(mx, Math.max(-mx, ZOOM.x));
  ZOOM.y = Math.min(my, Math.max(-my, ZOOM.y));
}
function applyZoom() {
  const stage = document.querySelector(".stage");
  stage.querySelector("img").style.transform =
    ZOOM.z === 1 ? "" : `translate(${ZOOM.x}px, ${ZOOM.y}px) scale(${ZOOM.z})`;
  stage.classList.toggle("is-zoomed", ZOOM.z > 1);
  setText(".zoom-val", `${Math.round(ZOOM.z * 100)}%`);
  setText(".mi-zoom-val", `${Math.round(ZOOM.z * 100)}%`);
  const zo = document.querySelector(".zoom-out"), zi = document.querySelector(".zoom-in");
  if (zo) zo.disabled = ZOOM.z <= 1;
  if (zi) zi.disabled = ZOOM.z >= 3;
}
function setZoom(z) {
  ZOOM.z = Math.min(3, Math.max(1, z));
  if (ZOOM.z === 1) { ZOOM.x = 0; ZOOM.y = 0; }
  clampPan();
  applyZoom();
}

function show(n) {
  const { report } = VIEW;
  const total = totalPages(report);
  n = Math.min(Math.max(n, 1), total);
  VIEW.page = n;
  store.set("last", { id: report.id, page: n });
  ZOOM.z = 1; ZOOM.x = 0; ZOOM.y = 0;
  applyZoom();

  // Ảnh chính
  applyImage();
  document.querySelector(".stage img").alt = `${t(report.title)} — ${t(DATA.ui.page)} ${n}`;

  // Tải trước trang kế tiếp để lật mượt
  if (n < total) new Image().src = pageSrc(report, report.from + n);

  // Điều khiển trang, nút lưu, ghi chú, thanh ảnh nhỏ
  document.querySelector(".pg-input").value = n;
  sizePageInput();
  document.querySelector(".pg-prev").disabled = n === 1;
  document.querySelector(".pg-next").disabled = n === total;
  document.querySelector(".counter-num").textContent = `${n} / ${total}`;
  document.querySelector(".nav.prev").disabled = n === 1;
  document.querySelector(".nav.next").disabled = n === total;
  renderNote();
  document.querySelectorAll(".strip button").forEach((b, i) => {
    b.setAttribute("aria-current", i + 1 === n ? "true" : "false");
  });
  const cur = document.querySelector(".strip button[aria-current='true']");
  const strip = document.querySelector(".strip");
  if (cur && strip.clientWidth) {
    strip.scrollTo({ left: cur.offsetLeft - (strip.clientWidth - cur.offsetWidth) / 2, behavior: "smooth" });
  }

  // Ghi số trang vào đường dẫn, để tải lại hoặc gửi link không mất vị trí
  const url = new URL(location);
  url.searchParams.set("page", n);
  history.replaceState(null, "", url);

  track("view_page", { report: report.id, page: n });
}

function bindViewerControls() {
  document.querySelector(".nav.prev").onclick = () => show(VIEW.page - 1);
  document.querySelector(".nav.next").onclick = () => show(VIEW.page + 1);

  // Lăn chuột dọc trên thanh ảnh nhỏ thì cuộn ngang
  const strip = document.querySelector(".strip");
  strip.addEventListener("wheel", e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      strip.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });

  const stage = document.querySelector(".stage");

  // Ảnh không tải được: nói rõ thay vì để khung trống
  stage.querySelector("img").addEventListener("error", () => {
    stage.classList.add("is-empty");
    showStageMsg(t(DATA.portal.report.imgFail), t(DATA.portal.report.imgFailHelp), false);
  });

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
    // Trang xoay 90° trên điện thoại dọc: trục ngang của báo cáo là trục dọc của màn hình
    const rot = matchMedia(ROTATED_Q).matches;
    ZOOM.x = drag.ox + (rot ? e.clientY - drag.y : e.clientX - drag.x);
    ZOOM.y = drag.oy + (rot ? drag.x - e.clientX : e.clientY - drag.y);
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
  const swipeAxis = t => matchMedia(ROTATED_Q).matches ? t.clientY : t.clientX;
  stage.addEventListener("touchstart", e => { startX = swipeAxis(e.touches[0]); }, { passive: true });
  stage.addEventListener("touchend", e => {
    if (startX === null || !VIEW || ZOOM.z > 1) return;
    const dx = swipeAxis(e.changedTouches[0]) - startX;
    if (dx < -50) show(VIEW.page + 1);
    if (dx >  50) show(VIEW.page - 1);
    startX = null;
  });
}

/* ---------- Khởi động ---------- */

function render() {
  const page = document.body.dataset.page;
  setText(".watermark b", t(DATA.site.author));
  if (page === "login") { renderLogin(); return; }
  renderChrome();
  if (page === "home")   renderHome();
  if (page === "viewer") renderViewer();
}

(async function init() {
  const page = document.body.dataset.page;
  // Đã đăng nhập thì khỏi qua trang đăng nhập; chưa đăng nhập thì không vào được cổng
  if (page === "login" && session.active()) { location.replace("./"); return; }
  if (page !== "login" && !session.active()) { location.replace("login"); return; }

  document.documentElement.lang = LANG;
  await loadData();
  if (page === "viewer") bindViewerControls();
  if (page !== "login") bindGlobal();
  render();
})();
