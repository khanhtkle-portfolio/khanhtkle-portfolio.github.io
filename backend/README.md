# Ghi nhận hoạt động (Google Sheet)

GitHub Pages chỉ phục vụ file tĩnh, không có máy chủ. Để lưu lại ai đã vào, khi nào và đã xem gì, trang gửi sự kiện tới một Google Apps Script, và script ghi chúng vào Google Sheet của bạn. Miễn phí, không cần thẻ.

## Cài đặt (khoảng 5 phút)

1. Tạo một Google Sheet mới, đặt tên `Sightline activity`.
2. Chọn **Extensions → Apps Script**, xóa mã mẫu và dán toàn bộ nội dung `apps-script.gs`.
3. Đặt `KEY` thành một chuỗi ngẫu nhiên (ví dụ `k7f2-91xq`).
4. Chọn **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Bấm Deploy, cấp quyền, rồi chép địa chỉ `.../exec`.
5. Mở `js/config.js`, điền `trackUrl` bằng địa chỉ vừa chép và `trackKey` bằng chuỗi `KEY`.
6. Đẩy lên GitHub. Mở trang, đăng nhập thử, và sheet `events` sẽ có dòng mới.

Sửa mã script về sau thì phải **Deploy → Manage deployments → Edit → New version**, nếu không địa chỉ cũ vẫn chạy bản cũ.

## Dữ liệu ghi lại

| Cột | Ý nghĩa |
| --- | --- |
| time | Thời điểm sự kiện xảy ra (UTC) |
| event | `page_view`, `login`, `open_report`, `view_page`, `star`, `search`, `filter`, `download`, `share`, `palette_open`, `language`, `request_saved`, `issue_saved`, `page_leave` (kèm số giây xem), `sign_out` |
| name | Tên khách nhập lúc đăng nhập (trống nếu chưa đăng nhập) |
| visitor | Mã ẩn danh cố định của trình duyệt, nối các lần ghé khác nhau của cùng một người |
| session | Mã phiên, đổi mỗi lần đăng nhập |
| page | Trang đang xem (`index.html`, `report.html`, `login.html`) |
| details | JSON: báo cáo nào, trang số mấy, từ khóa tìm; với `login` và `page_view` có thêm trình duyệt, ngôn ngữ, múi giờ, cỡ màn hình, nguồn giới thiệu |

Không lưu địa chỉ IP, và không lưu nội dung ghi chú hay yêu cầu mà khách gõ.

## Giới hạn cần biết

- `trackKey` nằm trong mã phía trình duyệt nên ai cũng đọc được. Nó chỉ chặn ghi rác ngẫu nhiên, không phải bảo mật.
- Sự kiện chưa gửi được (chưa cấu hình, mất mạng) vẫn nằm trong localStorage của người xem, tối đa 500 sự kiện, và gửi lại ở lần sau.
- Người dùng chặn script hoặc bật chế độ chống theo dõi có thể không bị ghi nhận.
- Khách được báo trước ở bước nhập tên rằng hoạt động được ghi lại. Giữ câu đó nếu bạn đổi giao diện.
