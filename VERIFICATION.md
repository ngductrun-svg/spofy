# Kiểm chứng bản bàn giao

Kiểm tra ngày 17/10/2026, Node.js v24.19.0 trên Windows. Dữ liệu kiểm thử nằm trong thư mục/cơ sở dữ liệu tạm, tách biệt ứng dụng và không được đưa vào ZIP. Bản bàn giao không có tài khoản mặc định hoặc bài khoa học được tạo sẵn.

## Đã chạy và đạt

- **9/9 test HTTP backend thật**, bằng `node --test --test-concurrency=1 server-tests/http-security.test.mjs`.
- Khách đọc bài đã xuất bản; danh sách, tìm kiếm, chuyên mục, featured và phân trang không lộ bản nháp. Đoán slug bài nháp hoặc URL ảnh nháp vẫn bị chặn.
- Khách gọi API admin trả 401; độc giả gọi trực tiếp mọi API quản trị trả 403, bao gồm chỉnh sửa/xóa bình luận của chính họ và tải ảnh. Trường role trong đăng ký bị từ chối.
- Admin tạo/sửa/lưu nháp/xuất bản/gỡ xuất bản/xóa bài và quản lý bình luận đúng quyền. Ảnh trở lại riêng tư khi không còn gắn bài xuất bản.
- CSRF, Origin, HttpOnly/SameSite, Secure trong cấu hình HTTPS, hết hạn phiên và thu hồi phiên sau đăng xuất được kiểm tra phía máy chủ.
- Bình luận: độ dài, giãn cách gửi, giới hạn tần suất, chống gửi trùng và ẩn/hiện/xóa. Bài và bình luận vẫn tồn tại sau khi khởi động lại backend.
- Tải PNG thật được chấp nhận; SVG, MIME giả và file quá lớn bị từ chối. URL thực thi/raw HTML block bị từ chối; đoạn văn chứa ký hiệu HTML được hiển thị như văn bản thuần.
- CLI tạo admin bằng mật khẩu truyền qua stdin trong môi trường tạm, chặn tạo thêm khi thiếu cờ tin cậy, sao lưu SQLite online và đọc lại bản sao thành công.
- Production build thành công. Smoke test HTTP gồm 7 route SPA và 7 đường dẫn JS/CSS/font/ảnh; config, source, database và README không được phục vụ công khai.
- Lệnh phát triển `node scripts/dev.mjs` khởi động cả Vite và API; trang, ảnh, phiên và POST có CSRF qua proxy 4173 đều trả 200.
- Catalog tư liệu giữ **nguyên byte**, SHA-256 `2de8da536787622f28574b4379e13b889bd3685d6551c041ddbec1838391b291`: **51 nhóm, 1.471 ảnh**, tên, ngày, nguồn Facebook và quan hệ nhóm không đổi.

## Đã kiểm tra bằng trình duyệt

Trình duyệt trong ứng dụng, viewport desktop 1280px và mobile 390px:

- Trang chủ giữ wordmark 3D, thêm menu Khoa học và CTA; cụm giới thiệu hiển thị bài đã xuất bản và trạng thái trống khi database mới.
- Admin đăng nhập, tạo bài, tải ảnh bìa, nhập đoạn văn/công thức, xem trước, lưu nháp, gỡ xuất bản và xuất bản. Bài xuất hiện trong danh sách và cụm giới thiệu.
- Tìm kiếm tiếng Việt và đổi chuyên mục trả kết quả/trạng thái trống đúng.
- Đăng ký độc giả, đọc bài bằng URL riêng và tải lại trang; gửi bình luận thành công, bình luận còn sau reload, không có nút sửa/xóa. Chuỗi `<script>` trong đoạn văn và `<img onerror>` trong bình luận không tạo phần tử thực thi.
- Độc giả mở `/admin` thấy thông báo không có quyền; kiểm thử API phía trên xác nhận đây không chỉ là việc ẩn giao diện.
- Admin ẩn bình luận qua giao diện; hộp xác nhận xóa và phím Escape hoạt động.
- Mobile: menu có Khoa học, CTA dẫn đúng trang, danh sách/trang đọc/editor/quản lý bình luận không cuộn ngang ở 390px; editor mới trống độc lập sau khi đã biên tập bài khác.
- Chức năng cũ: mở/đóng dấu mốc bằng bàn phím, mở album Giảng Võ, ảnh từ host tư liệu tải được và đóng album bằng Escape.

## Cần cấu hình/kiểm tra khi triển khai thật

- Chưa xuất bản lên Internet hoặc gắn tên miền mới. Bản local cần máy chủ Node 24, origin HTTPS thật và volume bền vững. Bản Netlify mới dùng Functions/Database/Blobs; xem phần bổ sung bên dưới và NETLIFY-HUONG-DAN.md.
- Dockerfile/Compose đã đối chiếu source và cấu hình, **chưa chạy Docker** trên thiết bị này.
- Chưa kiểm tra tải lớn, nhiều instance, trình duyệt Safari hay thiết bị điện thoại thật. Mobile ở trên là viewport mô phỏng. Không tuyên bố đo FPS hoặc kiểm toán bảo mật toàn diện.
- Ảnh album cũ tiếp tục phụ thuộc host ảnh công khai hiện có. Nên tự lưu kho ảnh nếu cần chủ động hạ tầng lâu dài.

Xem README để chạy, tạo admin, sao lưu và triển khai.

## Bổ sung công cụ tạo admin Windows

- **11/11 test riêng đạt**: `node --test --test-concurrency=1 server-tests/admin-form-helper.test.mjs`.
- Tạo admin đầu tiên, lựa chọn rõ ràng để cấp quyền admin đầu tiên cho độc giả có mật khẩu đúng, từ chối sai mật khẩu/admin đã tồn tại, giữ nguyên hash/tên và thu hồi phiên cũ khi nâng quyền.
- Kiểm tra Unicode, đường dẫn có dấu và dấu nháy, `.env` tùy chỉnh, dữ liệu sai/thừa trường quyền, giới hạn kích thước đầu vào, hai helper chạy cùng lúc và không lộ mật khẩu/hash trong output.
- Chạy chính file CMD với chế độ kiểm tra không mở cửa sổ qua Windows PowerShell 5.1: form khởi tạo, tự nhận thư mục, ô mật khẩu được che, nút hiện mật khẩu và chuyển hai chế độ đều đạt. Chưa thao tác tạo tài khoản thật qua giao diện; người dùng tự điền và xác nhận trên máy của mình.
- Kiểm tra đường truyền thật Windows PowerShell 5.1 -> tiến trình Node ẩn -> SQLite tạm: tên và mật khẩu tiếng Việt được giữ đúng khi truyền qua stdin. Xác minh lại hash rồi dọn fixture.
- Công cụ được đặt thêm cạnh CHAY-SPOFY.cmd trong bản người dùng đã giải nén. Không thay đổi tài khoản thật, cơ sở dữ liệu, cấu hình hay tiến trình website đang chạy.

## Bổ sung Netlify và trang tài khoản — 17/10/2026

- Chạy `node --test --test-concurrency=1 server-tests/*.test.mjs`: **33/33 test đạt**, gồm 9 test HTTP nghiệp vụ, 11 helper admin, 6 tài khoản/lịch sử SQLite, 5 nhóm cloud và 2 adapter. Mọi fixture tách khỏi dữ liệu thật.
- Migration SQLite v2 giữ nguyên tài khoản, mật khẩu và phiên cũ. Không tự tạo lịch sử đăng nhập trước lúc nâng cấp. Tìm kiếm tên/email không dấu, ký tự wildcard dạng literal, vai trò, phân trang, ngày xác thực, tổng lượt và phiên hết hạn/đăng xuất đều được kiểm tra. Chỉ admin đọc được hai endpoint mới; không trả hash/token.
- **Cloud handler được chạy với PostgreSQL thật trong PGlite 0.5.10**, nạp chính SQL migration sẽ đưa lên Netlify. Kiểm tra khách 401/độc giả 403, cookie HTTPS Secure/HttpOnly/SameSite, CSRF/Origin, session rotation, thay đổi quyền qua trusted DB owner và kiểm tra lại quyền ngay trên backend.
- Bài nháp, URL đoán được, ảnh tải lên riêng tư, xuất bản/gỡ xuất bản, CRUD, tìm kiếm/chuyên mục/phân trang/featured, validation nội dung và rollback khi ảnh tham chiếu sai đều đạt. Tải PNG/JPEG cloud bị giới hạn 4 MiB.
- Bình luận cloud: độ dài, 15 giây, 8 lần/10 phút, gửi trùng đồng thời, ẩn/hiện/xóa chỉ admin; độc giả không sửa/xóa được bình luận của mình. Audit giữ 10.000 sự kiện, bộ đếm tổng không mất khi cắt lịch sử.
- Tái tạo handler và phục hồi snapshot PGDATA vào engine PostgreSQL mới giữ bài viết, bình luận, tài khoản và phiên. Thử ép lỗi transaction đăng nhập xác nhận không cấp cookie mới hoặc làm mất phiên/counter/audit cũ. Dòng log mã `23514` trong test này là lỗi ràng buộc được cố ý tạo, không phải test thất bại.
- Adapter PostgreSQL được kiểm tra BEGIN/COMMIT/ROLLBACK thật và chuẩn hóa BIGINT. Adapter Blob được kiểm tra bytes/metadata, đọc strong consistency, không tìm thấy và xóa với SDK transport giả lập. **Kho Blob trong test là bộ nhớ tạm, chưa gọi Netlify Blobs thật.**
- Production Vite build thành công (56 modules); Function bundle thử bằng esbuild Node 24 thành công. Vite vẫn cảnh báo bundle giao diện lớn do stack 3D hiện có. Cấu hình pnpm/Node/Database/Blobs/routing đối chiếu tài liệu chính thức và API SDK đã cài.
- Browser QA trên backend SQLite fixture riêng: khách thấy yêu cầu đăng nhập; admin đăng nhập, xem tài khoản và lịch sử, tìm tiếng Việt không dấu bằng Enter và chuyển trang 1/2 → 2/2; thông tin xác thực đúng sau đăng nhập. Desktop 1265px và mobile 390px không cuộn ngang ở hai trang mới.
- Mobile trang chủ: hero, trạng thái Khoa học trống, số 51 nhóm/1.471 ảnh, menu hamburger → panel Khoa học → trang danh sách hoạt động; không cuộn ngang ở viewport 390px. Không thay dữ liệu/ảnh/hiệu ứng hero gốc. Catalog giữ nguyên SHA-256 nêu ở trên.
- Ảnh minh chứng `SPOFY-Netlify-admin-preview.png` dùng **tài khoản kiểm thử**, không phải dữ liệu người dùng; fixture và mật khẩu thử không được đưa vào ZIP. Website thật đang chạy cổng 3000 và thư mục đã giải nén của người dùng được giữ nguyên.

### Còn phải kiểm tra trên tài khoản Netlify thật

Chưa import GitHub hoặc deploy vào tài khoản của người dùng, nên chưa xác nhận URL công khai, tự cấp database/áp dụng migration trên nền tảng, Netlify Function routing, HTTPS cookie, Blob upload/read hoặc hạn mức của chính tài khoản. Cần chủ tài khoản thực hiện NETLIFY-HUONG-DAN.md rồi kiểm tra đăng ký, cấp admin, đăng/xuất bản bài, ảnh và bình luận trên URL thật. Source không có secret cần người dùng điền tay; Netlify phải cấp Database và Function context thành công.

Gói Netlify chỉ gồm source đã làm sạch; không chứa dữ liệu SQLite, tài khoản hoặc ảnh bài viết local. **Không tự di chuyển dữ liệu local lên cloud.**
