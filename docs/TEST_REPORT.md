# Báo cáo kiểm thử bản nâng cấp SPOFY

Ngày hoàn tất: **19/10/2026, giờ Việt Nam**. Source gốc `9869d95`, nhánh cục bộ `codex/spofy-quality-20261018`. Production chỉ được đọc trang/API công khai để đối chiếu. Không sửa tài khoản, bài viết, bình luận hoặc database thật; không gửi email thật.

## Kết quả chạy thực tế

| Kiểm tra | Kết quả | Phạm vi |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Đạt | Lockfile đầy đủ; kiểm tra cài lại offline sau khi tải dependencies |
| `pnpm typecheck` | Đạt | TypeScript trên dependency graph ứng dụng từ `src/main.tsx`; các demo shader cũ không được ứng dụng import không nằm trong graph này |
| `pnpm lint` | Đạt | Source frontend/backend/Functions/scripts/tests; kiểm tra cú pháp và các lỗi an toàn JS đã cấu hình, không phải kiểm toán bảo mật độc lập |
| `pnpm build` | Đạt | Kiểm tra context, catalog, hash ảnh, dữ liệu câu hỏi; Vite; tạo HTML metadata và context riêng của Functions |
| `pnpm test` | **65/65 đạt**, 0 bỏ qua | Khoảng 14,1 giây trên lần chạy cuối backend, Node 24.22.0/Windows |
| Bundle hai Netlify Functions bằng esbuild | Đạt | `spofy.mjs` và `page.mjs`, target Node 24; chưa phải lần deploy lên Netlify |
| HTTP local 9 đường dẫn | Đạt | HTML có title/canonical trước JavaScript, bài không tồn tại 404, trang tài khoản noindex, API không trả HTML, source server không công khai |
| `git diff --check` | Đạt | Không có lỗi whitespace; Git có cảnh báo chuẩn hóa LF/CRLF trên Windows |

65 test gồm: tài khoản/audit 7; helper admin 10; ảnh 1; auth lifecycle 15; context triển khai/biên tập 2; HTTP security 9; cloud adapter 7; metadata 8; câu hỏi đã xác minh 6. SQLite dùng database tạm. PostgreSQL dùng **PGlite, engine PostgreSQL trong môi trường kiểm thử**; các lời gọi kho Blobs và email được kiểm thử bằng adapter/transport cô lập. Chưa kiểm chứng tài khoản dịch vụ Netlify/Resend thật.

Các trường hợp backend đã kiểm tra: khách/reader/admin, API quản trị gọi trực tiếp, nháp không lộ, xuất bản/gỡ/xóa, bình luận và chống trùng/rate limit, CSRF/Origin, cookie Secure/HttpOnly/SameSite, phiên hết hạn/logout/reset/đổi quyền, rollback giao dịch không gửi cookie sai, hash mật khẩu và policy, HIBP theo prefix với HTTP test, upload ảnh/quyền/loại tệp và giới hạn, token hash/hết hạn/một lần, phản hồi email trung tính, thiếu cấu hình email và preview mặc định chặn. Không suy rộng kết quả này thành “production đã được kiểm toán”.

## Kiểm tra trong trình duyệt

Bản build chạy tại `127.0.0.1:4300` bằng SQLite tạm, hai tài khoản kiểm thử riêng và bản sao **một bài đã công khai** để so trước/sau. Không sao chép tài khoản hay bình luận thật. Mail transport chỉ ghi vào hộp thư tạm trên máy; đã nhận một yêu cầu khôi phục trong transport này, không gửi ra Internet.

- Trang chủ, đăng ký, danh sách khoa học, bài chi tiết và Tham gia được kiểm tra ở **360 / 390 / 768 / 1024 / 1440 px**: 25 trường hợp không thấy tràn ngang theo DOM. Đây là viewport trình duyệt, chưa phải thiết bị Android/iOS thật.
- Lexend được tải, kiểm tra `document.fonts.check`, dấu tiếng Việt và bố cục bài/đăng ký qua ảnh chụp. Các cỡ viewport được kiểm tra reflow; phím zoom của trình duyệt nhúng không đổi mức zoom, nên **chưa xác nhận zoom thực 200%**.
- Hiện/ẩn mật khẩu đổi đúng input text/password; lỗi tên/email/mật khẩu xuất hiện theo trường. Nhãn Email/Tên hiển thị giữ tên truy cập ổn định sau lỗi. Trạng thái đang gửi khóa thao tác gửi lặp.
- Reader đăng nhập từ bài quay về đúng bài và `#binh-luan` **sau khi nội dung đã tải**, focus nằm ở vùng bình luận. Gửi bình luận kiểm thử, reload vẫn còn; reader vào `/admin` nhận thông báo không có quyền. Admin kiểm thử vào được quản trị và màn tài khoản; logout hoạt động.
- Tìm bài không có kết quả, lọc Vật lí rỗng, xóa bộ lọc trở lại bài công khai. Phân trang bài có nhiều bản ghi được kiểm tra ở backend; fixture trình duyệt chỉ có một bài công khai.
- Menu desktop mở/chuyển mục nhanh/Escape; resize sang mobile; hamburger mở, liên kết khoa học nhìn thấy và Escape trả focus về nút menu. Đã quan sát panel mở hoàn tất; ảnh bàn giao không lấy trạng thái chuyển tiếp.
- Mở dấu mốc bằng Enter, thấy các nhóm thật, Escape đóng. Wordmark WebGL hiển thị và các nút hoạt động. Không thay dữ liệu timeline.
- Kho ảnh: tìm kiếm rỗng, xóa lọc, trang 2 hiển thị ảnh 37–72; lọc năm 2024 có 126 ảnh theo catalog. Lightbox mở được ảnh lớn **cùng origin** 1600 px; album Giảng Võ có đúng 47 ảnh. Escape đóng rồi trả focus về nút ảnh ban đầu.
- Không có error/warn trong log của tab kiểm thử tại thời điểm kiểm tra cuối. Đây không phải cam kết không có lỗi trong mọi trình duyệt hoặc mọi điều kiện mạng.

Các nhánh `prefers-reduced-motion`, media pointer, IntersectionObserver/visibility pause và WebGL catch/fallback HTML được giữ và rà soát source. **Chưa cưỡng bức lỗi GPU hoặc bật reduced-motion ở hệ điều hành trong lượt browser QA này; chưa đo frame time/60fps.** Cần xác nhận các mục này trên thiết bị thật trước production.

## Kích thước JavaScript

Production khảo sát có entry JavaScript **1.039.390 byte**, gzip **295.875 byte**. Build mới tách chunk:

| Chunk | Chưa nén, gần đúng | gzip, gần đúng |
| --- | ---: | ---: |
| Entry dùng chung/React/provider | 206,22 kB | 66,17 kB |
| App kho tư liệu | 116,88 kB | 34,22 kB |
| Router khoa học | 3,42 kB | 1,10 kB |
| Trang công khai khoa học | 19,33 kB | 6,60 kB |
| Auth | 12,75 kB | 4,28 kB |
| Admin | 25,16 kB | 7,25 kB |
| Three.js/wordmark 3D | 453,18 kB | 119,94 kB |
| KaTeX/formula | 262,07 kB | 78,10 kB |

Đây là **kích thước từng chunk**, không phải toàn bộ tải mạng của trang chủ. Trang chủ vẫn cần phần kho tư liệu và 3D; trang đọc không cần tải editor/3D, KaTeX chỉ tải khi có công thức. Số chính xác ở `qa-evidence/bundle-metrics.json`. Không có điểm Lighthouse hay phép đo mạng di động chuẩn hóa.

## Bảo toàn ảnh và nội dung

Catalog vẫn có **51 nhóm / 1.471 ảnh**, SHA-256 `2de8da536787622f28574b4379e13b889bd3685d6551c041ddbec1838391b291`. Đủ **2.942 WebP** thumbnail/full thật, tổng **241.112.868 byte**; giải mã ảnh, hash và kích thước đã kiểm tra. Srcset dùng chiều rộng thực, loại ứng viên trùng chiều rộng. Ngày đăng ảnh và ngày diễn ra vẫn phân biệt.

Không tự phục hồi phần khoa học bài hot drink. Sửa hiển thị tiêu đề, tóm tắt và lỗi “cùng nhau dạo bước”; giữ dữ liệu gốc/admin, tên gốc, tag và category lưu trữ để chờ nguồn. Chuyên mục hiển thị rõ “Chờ đối chiếu”. Câu hỏi hàng tuần chưa có nội dung xác minh nên hiện trạng thái trống. Không tạo lịch tuyển hoặc bài khoa học giả.

## Ảnh trước/sau và bằng chứng

- [Trang chủ trước](screenshots/SPOFY-upgrade-before-home.png) / [sau](screenshots/SPOFY-upgrade-after-home.png).
- [Phần Bắt đầu từ đây](screenshots/SPOFY-upgrade-after-start.png), có focus ring khi dùng bàn phím.
- [Bài viết trước](screenshots/SPOFY-upgrade-before-article.png) / [sau](screenshots/SPOFY-upgrade-after-article.png) / [mobile](screenshots/SPOFY-upgrade-after-article-mobile.png).
- [Đăng ký trước](screenshots/SPOFY-upgrade-before-register.png) / [sau](screenshots/SPOFY-upgrade-after-register.png) / [mobile](screenshots/SPOFY-upgrade-after-register-mobile.png).
- [Menu mobile](screenshots/SPOFY-upgrade-after-menu-mobile.png).
- Bằng chứng HTTP, viewport và bundle: `docs/qa-evidence/` (không có token/email/mật khẩu thật).

## Còn cần cấu hình hoặc xác minh

1. Chủ dự án đăng nhập GitHub Desktop để push nhánh. Lệnh kiểm tra quyền push không ghi dữ liệu đã thất bại vì không có phiên xác thực GitHub; **chưa push, tạo PR, Deploy Preview hay publish production**.
2. Xác nhận database preview riêng, không có dữ liệu người dùng thật chưa ẩn danh, rồi đặt `PREVIEW_DATA_ISOLATED=true` đúng context và rebuild. Cờ là xác nhận quản trị, không tự chứng minh cách ly DB. Backup trước migration; rollback deploy không tự rollback DB/Blobs/biến môi trường.
3. Cấu hình server `RESEND_API_KEY`, `MAIL_FROM`, `APP_ORIGIN`; preview dùng `MAIL_MODE=test` và `MAIL_TEST_RECIPIENT` do chủ dự án kiểm soát. Chưa xác nhận nhận email thật. HIBP thật cũng chưa chạy qua provider trong QA này.
4. Cung cấp bản gốc bài đồ uống để khôi phục phần thiếu/chốt chuyên mục. MFA và hàng đợi báo cáo bình luận mới được đề xuất, chưa triển khai.
5. Kiểm tra thiết bị thật, zoom 200%, reduced-motion, GPU fallback và frame time. Làm theo `README_DEPLOY.md`; không kéo riêng `dist` lên Netlify.
