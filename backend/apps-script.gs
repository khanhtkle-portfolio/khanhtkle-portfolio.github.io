/**
 * Sightline — nhận sự kiện hoạt động và ghi vào Google Sheet.
 * Cách cài: xem backend/README.md.
 */
const KEY = "";            // đặt chuỗi bất kỳ, rồi điền cùng chuỗi vào trackKey trong js/config.js
const SHEET_NAME = "events";
const MAX_BATCH = 100;

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (KEY && body.key !== KEY) return reply("forbidden");

    const rows = (body.events || []).slice(0, MAX_BATCH).map(ev => [
      new Date(),
      safe(ev.t), safe(ev.type), safe(ev.name), safe(ev.v), safe(ev.s), safe(ev.path),
      safe(JSON.stringify(ev.p || {})),
    ]);
    if (rows.length) {
      const sh = sheet();
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
    return reply("ok");
  } catch (err) {
    return reply("error");
  }
}

function doGet() { return reply("ok"); }

function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["received", "time", "event", "name", "visitor", "session", "page", "details"]);
    sh.setFrozenRows(1);
  }
  return sh;
}

// Chặn công thức bị chèn qua tên hoặc nội dung (ô bắt đầu bằng = + - @ sẽ bị Sheets chạy như công thức)
function safe(v) {
  const s = String(v == null ? "" : v).slice(0, 1000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function reply(text) { return ContentService.createTextOutput(text); }
