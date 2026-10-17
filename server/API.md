# Hợp đồng backend SPOFY Khoa học

Node.js 24.15+ chạy HTTP cùng origin với frontend. SQLite lưu tài khoản, phiên, bài viết, bình luận, metadata ảnh và giới hạn tần suất. Thư mục `DATA_DIR` là dữ liệu bền vững, không nằm trong `dist`. Không seed bài viết hoặc tài khoản thật.

## Xác thực và quyền

`GET /api/auth/session` trả `{user, csrfToken}` và tạo phiên khách nếu cần. `user` là `null` hoặc `{id,email,name,role}`. Cookie `spofy_session` chứa token ngẫu nhiên 256 bit, `HttpOnly; SameSite=Lax; Path=/`; thêm `Secure` khi dùng HTTPS/production. SQLite chỉ lưu SHA-256 của token, CSRF token riêng và hạn dùng; không trả token đăng nhập cho JavaScript. Mỗi yêu cầu đọc lại vai trò từ bảng users.

Mọi POST/PATCH/DELETE API cần `Origin` trùng `APP_ORIGIN`, `X-CSRF-Token` của phiên và cookie. JSON cần `Content-Type: application/json`.

| API | Quyền / dữ liệu |
| --- | --- |
| POST `/api/auth/register` | Khách: `{email,name,password}`. Luôn tạo reader; trường lạ, kể cả role, bị từ chối. Trả 201 `{user,csrfToken}`. |
| POST `/api/auth/login` | `{email,password}` → 200 `{user,csrfToken}`. Mật khẩu 12–128 ký tự. |
| POST `/api/auth/logout` | `{}` → 200 `{user:null,csrfToken}`. Phiên cũ bị xóa ở máy chủ. |
| GET `/api/categories` | Công khai: `{categories:[{slug,label}]}`. |
| GET `/api/articles` | Công khai: chỉ bài published. Query `q`, `category`, `page` (1+), `pageSize` (1–24, mặc định 9), `featured=1`. |
| GET `/api/articles/:slug` | Công khai: `{article,related}`; nháp và URL không tồn tại đều 404. |
| GET `/api/articles/:id/comments` | Công khai: `{items}`, chỉ bình luận visible của bài published; tối đa 500. |
| POST `/api/articles/:id/comments` | Đã đăng nhập: `{body}` → 201 `{comment}`. Không có API sửa/xóa bình luận cho độc giả. |
| GET/POST `/api/admin/articles` | Admin: `{items}` / body bài → 201 `{article}`. |
| GET/PATCH/DELETE `/api/admin/articles/:id` | Admin: đọc nháp/xem trước, cập nhật một phần hoặc xóa. PATCH → `{article}`; DELETE → `{ok:true}`. |
| GET `/api/admin/comments` | Admin: `{items}`, cả visible/hidden, tối đa 1000 bản ghi mới nhất. |
| PATCH `/api/admin/comments/:id` | Admin: `{status:'visible'|'hidden'}` → `{comment}`. |
| DELETE `/api/admin/comments/:id` | Admin: `{ok:true}`. |
| POST `/api/admin/uploads` | Admin: raw binary, Content-Type `image/png` hoặc `image/jpeg`, tối đa 5 MiB. Không dùng multipart. |
| GET `/api/admin/users` | Chỉ admin: tìm tên/email bằng `q` (0–100 ký tự, không phân biệt dấu/hoa thường), lọc `role=reader\|admin`, phân trang `page`, `pageSize` (1–100, mặc định 20). |
| GET `/api/admin/login-events` | Chỉ admin: tìm tên/email bằng `q`, phân trang `page`, `pageSize` như danh sách tài khoản. |

Danh sách bài trả `{items,total,page,pageSize,totalPages,categories}`; items không chứa blocks/references. Chuyên mục cố định: `toan-hoc`, `vat-li`, `hoa-hoc`, `sinh-hoc`, `cong-nghe`, `stem`.

## Tài khoản và lịch sử xác thực

Hai API tài khoản trả `{items,total,page,pageSize,totalPages,trackingStartedAt,historyRetentionLimit}`. `trackingStartedAt` là thời điểm nâng cơ sở dữ liệu lên migration v2, `historyRetentionLimit` hiện là 10000. Tìm kiếm xử lý `%`, `_` và nội dung giống SQL như văn bản bình thường.

Mỗi mục `/api/admin/users` chỉ có `{id,email,name,role,createdAt,lastLoginAt,loginCount,activeSessions}`. `lastLoginAt` là thời điểm xác thực thành công gần nhất đã ghi nhận; `loginCount` là số lượt đã ghi nhận từ khi tính năng được bật. Đăng ký tạo ngay phiên đăng nhập nên tính một lượt. Tạo tài khoản bằng CLI chưa tạo phiên và chưa tính lượt. Người dùng có sẵn trước bản nâng cấp giữ `lastLoginAt:null`, `loginCount:0` tới lần đăng nhập thành công tiếp theo; điều này **không** chứng minh họ chưa từng đăng nhập trước đây. `activeSessions` đếm các phiên xác thực chưa hết hạn, không phải số người đang online.

Mỗi mục `/api/admin/login-events` chỉ có `{id,userId,email,name,role,eventType,occurredAt}`. `eventType` là `login` hoặc `register`; thời gian ISO 8601. Tên/email/vai trò phản ánh tài khoản hiện tại. Chỉ ghi khi xác thực thành công và tạo phiên thành công, cùng transaction với thay đổi số lượt. Không ghi thất bại, IP, user-agent, mật khẩu, token phiên hoặc CSRF vào lịch sử. Giữ tối đa 10000 sự kiện gần nhất trên toàn hệ thống; số lượt cộng dồn của tài khoản vẫn được giữ khi sự kiện cũ bị loại bỏ.

Chỉ có thao tác GET cho hai API này. Không có HTTP API thay đổi vai trò/tài khoản. Khách nhận 401, độc giả nhận 403, kể cả khi gọi API trực tiếp.

## Bài viết

Trường ghi hợp lệ: `title`, `slug`, `summary`, `coverImage`, `coverAlt`, `category`, `tags`, `author`, `blocks`, `references`, `status`, `featured`. Trường đọc thêm `id`, `publishedAt`, `createdAt`, `updatedAt`; thời gian ISO 8601.

Slug gồm chữ thường không dấu/số/gạch nối, dài 3–160; title 1–180; author 1–120; tags tối đa 15, mỗi thẻ 1–40; summary tối đa 500; status draft/published; featured boolean. Nháp cho phép để trống summary, ảnh và nội dung. Xuất bản cần summary ít nhất 10 ký tự, ảnh bìa + alt và ít nhất một block. Hệ thống không nhận HTML tùy ý.

Các block:

```text
{type:'heading', level:2|3, text}
{type:'paragraph', text}
{type:'list', ordered:boolean, items:string[]}
{type:'image', src, alt, caption}
{type:'formula', latex, caption}
{type:'link', label, url}
```

Tối đa 120 block/bài; references tối đa 40 `{label,url}`. Liên kết cần HTTPS. Ảnh dùng HTTPS hoặc `/media/<uuid>.png|jpg`; đường dẫn local phải thực sự có trong metadata upload. Frontend phải render text bằng React text node và công thức với KaTeX `trust:false`, không bật HTML tùy ý.

Upload trả 201 `{image:{id,src,width,height,mime,size}}`. MIME, magic bytes, cấu trúc cơ bản và kích thước được kiểm tra; tên tệp do server sinh, không nhận SVG. `/media/...` chỉ công khai khi ảnh được tham chiếu trong bài published. Ảnh nháp/chưa gắn bài chỉ admin xem được; gỡ xuất bản thì khách nhận 404, kể cả biết URL. Response ảnh dùng `no-store` để không giữ nội dung nháp trong cache HTTP. Ảnh HTTPS ngoài hệ thống chịu chính sách của host ảnh tương ứng.

## Giới hạn và lỗi

Bình luận 3–2000 ký tự, ít nhất 15 giây giữa hai lần gửi, tối đa 8/10 phút/tài khoản và 24/10 phút/IP. Nội dung trùng trong cùng bài/tài khoản bị chặn 24 giờ, kể cả sau khi ẩn. Đăng nhập tối đa 10 lần/15 phút/IP, đăng ký 5 lần/giờ/IP. Bộ đếm lưu SQLite, tồn tại khi restart. Server dùng địa chỉ socket, không tin `X-Forwarded-For`; cấu hình proxy/số lượng truy cập cần tính việc nhiều người dùng chia sẻ cùng địa chỉ proxy.

Lỗi `{error:{code,message,fields?}}`; 401 chưa đăng nhập, 403 sai quyền/CSRF/origin, 404 không tồn tại hoặc không công khai, 409 trùng, 413 quá lớn, 415 sai định dạng, 422 dữ liệu không hợp lệ, 429 giới hạn tần suất. Lỗi nội bộ không lộ stack trace hoặc đường dẫn máy chủ cho người dùng.

## Quản trị tin cậy và lưu trữ

`npm run admin:create -- --email admin@example.com --name "Tên admin"` nhập mật khẩu ẩn hai lần. Không có API cấp role. Admin đầu tiên chỉ tạo khi chưa có admin; thêm admin khác cần cờ CLI `--allow-additional` trên máy chủ tin cậy. CLI chỉ tạo tài khoản mới, không âm thầm nâng quyền email đã đăng ký.

`node server/backup.mjs <tệp-đích.sqlite>` dùng SQLite online backup gồm dữ liệu đã commit trong WAL. Sao lưu cả thư mục media, bảo vệ bản sao như cơ sở dữ liệu gốc và kiểm tra phục hồi. Production cần `APP_ORIGIN=https://...`, reverse proxy TLS, ổ đĩa bền vững và một instance ghi cho SQLite. Không triển khai thư mục data lên hosting tĩnh hoặc môi trường serverless mất đĩa sau mỗi lần chạy.
