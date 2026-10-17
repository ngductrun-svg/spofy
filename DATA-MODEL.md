# Dữ liệu và ranh giới quyền

Nguồn cấu trúc local: `server/schema.sql`; bản Netlify dùng PostgreSQL tại `netlify/database/migrations/0001_initial.sql`. Migrations phiên bản được ghi trong `schema_migrations`. Local tự tạo/nâng cấp khi khởi động; Netlify áp dụng migration trong quy trình deploy. Hai backend có cùng dữ liệu nghiệp vụ và endpoint, dùng cơ sở dữ liệu riêng.

| Bảng | Nội dung và ràng buộc chính |
| --- | --- |
| `users` | UUID, email duy nhất, tên, mật khẩu scrypt có salt, role chỉ `reader`/`admin`; đăng ký API luôn reader; last_login_at nullable và login_count từ khi ghi nhận |
| `login_events` | UUID, user_id FK, occurred_at, event_type login/register; tối đa 10.000 lần xác thực thành công gần nhất, không lưu IP/user agent |
| `sessions` | SHA-256 token phiên, CSRF token, user, hạn dùng; token gốc chỉ trong cookie HttpOnly |
| `articles` | UUID, slug duy nhất, tiêu đề/tóm tắt/ảnh/chuyên mục/tác giả, JSON khối nội dung/thẻ/tham khảo, trạng thái, featured, ngày và người tạo |
| `media` | UUID/tên file ngẫu nhiên, MIME, bytes, kích thước, người tải lên |
| `article_media` | Liên kết ảnh với bài; khách chỉ tải được ảnh đã gắn ít nhất một bài xuất bản |
| `comments` | Bài, tác giả, văn bản thuần, fingerprint chống trùng, visible/hidden, ngày gửi |
| `rate_limits` | Bộ đếm và cửa sổ thời gian lưu trên đĩa, tồn tại khi restart |

Sáu slug chuyên mục: `toan-hoc`, `vat-li`, `hoa-hoc`, `sinh-hoc`, `cong-nghe`, `stem`.

Khối nội dung JSON cho phép: `heading {level,text}`, `paragraph {text}`, `list {ordered,items}`, `image {src,alt,caption}`, `formula {latex,caption}`, `link {label,url}`. Tài liệu tham khảo là `{label,url}`. Backend chỉ nhận trường được hỗ trợ và URL HTTPS hoặc ảnh `/media/<uuid>.png|jpg`; không lưu raw HTML để thực thi. React hiển thị văn bản/bình luận bằng escaping mặc định.

## API

| API | Quyền |
| --- | --- |
| `GET /api/auth/session` | Khách/độc giả/admin; trả user công khai và CSRF cho phiên hiện tại |
| `POST /api/auth/register`, `/login`, `/logout` | Có phiên CSRF + origin hợp lệ; đăng ký không nhận trường role |
| `GET /api/categories`, `/api/articles` | Công khai; chỉ bài đã xuất bản, tìm kiếm `q`, lọc `category`, phân trang `page/pageSize`, `featured=1` |
| `GET /api/articles/:slug` | Công khai; nháp trả 404 kể cả đoán đúng slug |
| `GET /api/articles/:id/comments` | Công khai; chỉ bài đã xuất bản và bình luận visible |
| `POST /api/articles/:id/comments` | Đã đăng nhập; 3–2000 ký tự, giới hạn tần suất và trùng trong 24h |
| `GET/POST /api/admin/articles` | Chỉ admin |
| `GET/PATCH/DELETE /api/admin/articles/:id` | Chỉ admin |
| `GET /api/admin/comments` | Chỉ admin |
| `GET /api/admin/users`, `/api/admin/login-events` | Chỉ admin; thông tin công khai tài khoản, thống kê phiên và sự kiện, không trả hash/token; tìm kiếm và phân trang |
| `PATCH/DELETE /api/admin/comments/:id` | Chỉ admin, kể cả với bình luận thuộc tài khoản độc giả đang gọi |
| `POST /api/admin/uploads` | Chỉ admin; binary PNG/JPEG tối đa 5 MiB local hoặc 4 MiB Netlify, kiểm tra header/kích thước |
| `GET /media/:filename` | Công khai nếu ảnh gắn bài xuất bản; nếu không chỉ admin, còn lại 404 |

Mọi thao tác ghi yêu cầu `Origin` cùng website (local theo APP_ORIGIN; cloud theo URL request hoặc APP_ORIGIN nếu được chỉ định) và `X-CSRF-Token` đúng phiên. API admin kiểm tra user và role đọc từ cơ sở dữ liệu cho mỗi request, trả 401 với khách, 403 với độc giả. Sửa JavaScript hoặc dữ liệu trình duyệt không cấp được quyền. Token phiên được thay khi đăng nhập/đăng ký/đăng xuất; phiên đã thu hồi không dùng lại được.

Bình luận cách nhau ít nhất 15 giây, tối đa 8 lần/10 phút cho một tài khoản và 24 lần/10 phút cho một IP; fingerprint chuẩn hóa chặn gửi lại cùng nội dung trên cùng bài trong 24 giờ. Đăng nhập/đăng ký và tải ảnh cũng có giới hạn. Khi có reverse proxy, IP socket có thể là IP proxy; các giới hạn theo IP sẽ dùng chung, cần đánh giá tải thực tế trước khi mở đăng ký lớn.
