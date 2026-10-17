# Cấu trúc bản Netlify

## Source và luồng dữ liệu

- `src/`: giao diện React hiện có, gồm hero 3D, tư liệu, Khoa học và quản trị. Gọi API cùng origin; không có khóa quản trị hay token xác thực trong localStorage.
- `netlify.toml`: Node 24, `pnpm build`, publish `dist`; rewrite `/api/*` và `/media/*` tới Function, cuối cùng mới tới SPA. CSP áp dụng cho tài nguyên tĩnh.
- `netlify/functions/spofy.mjs`: entrypoint Fetch của Netlify Function; chỉ khởi tạo adapter khi có request.
- `netlify/server/app.mjs`: API bất đồng bộ, SQL có tham số, giao dịch và kiểm tra quyền. Không mở HTTP server hay ghi dữ liệu vào filesystem Function.
- `netlify/server/database.mjs`: `@netlify/database` cung cấp pool PostgreSQL; adapter quản lý BEGIN/COMMIT/ROLLBACK và chuyển timestamp BIGINT về số an toàn.
- `netlify/server/storage.mjs`: Netlify Blobs, site-wide store `spofy-article-media`, consistency strong; ảnh tồn tại qua các deploy. Không trả URL Blob công khai. `/media` kiểm tra quyền dựa trên trạng thái xuất bản trong DB trước khi đọc file.
- `netlify/database/migrations/0001_initial.sql`: schema PostgreSQL, index, ràng buộc và hàm tìm kiếm tiếng Việt `spofy_fold`. Netlify áp dụng migration trong quy trình deploy.
- `server/`: backend SQLite cho local/hosting có đĩa; validation, kiểm tra ảnh và crypto thuần được dùng lại trong Function.

Các endpoint và JSON giữ tương thích với `server/API.md`. Ảnh tải lên ở cloud giới hạn **4 MiB** để chừa khoảng cho request envelope của Functions; local vẫn 5 MiB. Hai ảnh nền hero nằm trong source; ảnh album tiếp tục dùng host tư liệu công khai hiện có.

## Cấu hình

Không cần tự điền secret cho lần triển khai đầu qua Git. Cần tài khoản Netlify có Database và quyền import repository GitHub. Netlify cấp kết nối database theo nhánh deploy; `getDatabase()` đọc cấu hình server do nền tảng cung cấp, không đưa connection string vào JS trình duyệt. Netlify Blobs dùng context Function của project.

Các giá trị công khai đã có trong `netlify.toml`:

| Biến build | Giá trị/mục đích |
| --- | --- |
| `NODE_VERSION` | `24` |
| `VITE_CLOUD_HOST` | `netlify`, đồng bộ giới hạn ảnh trên giao diện |
| `VITE_ARCHIVE_ASSET_BASE` | Host tư liệu đang có |
| `VITE_ARCHIVE_CATALOG_URL` | `/archive-data.json` |

Cloud mặc định lấy origin của request HTTPS cùng site để kiểm tra CSRF; cookie luôn Secure/HttpOnly/SameSite=Lax. Có thể đặt `APP_ORIGIN=https://ten-mien-chinh` **chỉ ở môi trường Function** nếu muốn khóa cứng một origin; khi đó preview/alias khác sẽ không ghi được. Không sao chép `.env` local có origin `127.0.0.1` lên Netlify. Không đưa biến kết nối DB, khóa API hoặc mật khẩu vào bất kỳ biến `VITE_*` nào.

## Admin và dữ liệu

Đăng ký HTTP chỉ tạo `reader`; không có API cấp quyền. Chủ project đăng ký tài khoản online rồi đổi đúng `users.role` thành `admin` trong dashboard Netlify Database nhánh production, sau đó đăng xuất/đăng nhập lại. Đây là thao tác quản trị tin cậy có sẵn quyền sửa DB, tách khỏi quyền của độc giả.

Admin xem tài khoản và lịch sử xác thực thành công qua hai endpoint được bảo vệ trên backend. Không lộ password hash, cookie token, CSRF token của người khác, địa chỉ IP hay user agent. Số phiên còn hạn chỉ là thống kê phiên, không phải trạng thái online thời gian thực. Giữ tối đa 10.000 sự kiện gần nhất; số lần xác thực của từng tài khoản vẫn cộng dồn.

Không tự chuyển dữ liệu SQLite từ máy lên cloud. Giữ bản local làm bản sao và đăng bài online theo nhu cầu; không upload `data/` hoặc file SQLite vào Git. Các trang preview có database riêng; Blob store thuộc site dùng chung giữa deploy, nhưng API chỉ cho phép ảnh có bản ghi DB phù hợp. Không đưa dữ liệu nhạy cảm vào kho tư liệu công khai.

## Kiểm thử và vận hành

`pnpm test` chạy test SQLite qua HTTP thật, công cụ tạo admin local và cloud handler với PostgreSQL thật chạy trong PGlite. Cloud tests dùng storage bộ nhớ để kiểm tra ranh giới truy cập; chưa thay thế việc kết nối dịch vụ Netlify Blobs thực tế. Không cần secret để chạy test, không chạm dữ liệu thật.

`pnpm build` kiểm tra SHA catalog tư liệu rồi build giao diện. Xem `VERIFICATION.md` để biết kết quả đã chạy và phần online còn thiếu. Sau khi deploy, cần kiểm tra đăng ký/đăng nhập, cấp quyền admin, xuất bản, tải ảnh và bình luận trên URL HTTPS thật trước khi chia sẻ.

Gói Free có hạn mức credit; theo dõi usage của Netlify. Sao lưu PostgreSQL và ảnh bằng công cụ nền tảng; không trông chờ ZIP source chứa dữ liệu đang chạy. Nên dùng domain chính ổn định, giữ production và kiểm tra migration trước khi cập nhật source. Không xóa hoặc sửa migration đã áp dụng; thêm file migration mới khi cần thay đổi schema.
