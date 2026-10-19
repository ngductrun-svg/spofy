# Xác thực SPOFY: thay đổi và phần cần cấu hình

## Backend đang dùng

Cloud vẫn dùng Netlify Functions (`netlify/server/app.mjs`), PostgreSQL của Netlify Database và kho ảnh Netlify Blobs. Bản chạy trên máy vẫn dùng HTTP Node.js + SQLite (`server/app.mjs`). Không đổi nhà cung cấp xác thực, không chuyển dữ liệu và không tạo tài khoản thật trong lần sửa này.

## Vòng đời tài khoản

- Khách đọc bài không cần tài khoản. Đăng ký mới luôn được server tạo với quyền `reader`; gửi thêm `role` bị từ chối 422.
- Đăng ký trả **202**, thông báo có điều kiện giống nhau cho email mới/đã có; không tự đăng nhập và không thay đổi tài khoản đã tồn tại. Mật khẩu được băm scrypt (N=32768, r=8, p=1), salt ngẫu nhiên 16 byte.
- Email xác minh có token ngẫu nhiên 32 byte, hạn 24 giờ, dùng một lần. Chỉ hash SHA-256 của token được lưu. Token nằm trong fragment `#token=…` của liên kết để không lọt vào đường dẫn access log; giao diện đọc, xóa fragment rồi gửi POST cùng CSRF.
- Người mới có thể đăng nhập nhưng cần xác minh email trước khi gửi bình luận. Tài khoản có trước migration được giữ `email_verified_at=NULL`, `email_verification_required=0`, hiển thị tình trạng chưa có dữ liệu; không tự coi họ đã xác minh và không khóa quyền đang có.
- Quên mật khẩu trả 202 với cùng thông báo cho email có/không có tài khoản. Email đặt lại hạn 30 phút. Đặt lại thành công thay hash, tăng `auth_version`, vô hiệu tất cả phiên và các token còn lại của tài khoản; người dùng phải đăng nhập lại. Nhiều lần dùng cùng token chỉ có một lần thành công, bằng transaction thật trong database.
- Gửi lại chỉ vô hiệu liên kết cũ **sau khi** dịch vụ đã nhận email mới. Nếu gửi thất bại, token đang chờ bị xóa và liên kết đã gửi trước vẫn dùng được. Nếu email đầu tiên thất bại, tài khoản chưa từng đăng nhập/xác minh/đổi quyền được dọn để có thể đăng ký lại.
- Đổi quyền qua database/CLI tin cậy kích hoạt trigger hủy tất cả phiên và token. Trình duyệt phải đăng nhập lại. Không có API công khai cấp quyền.

Đăng ký/quên mật khẩu phản hồi 202 với thông báo **tiếp nhận yêu cầu có điều kiện**, giống nhau dù email đã có/chưa có hoặc nhà cung cấp từ chối thư. Không có `emailSent: true`, delivery ID hoặc tuyên bố đã xếp hàng/đã gửi thành công. Lỗi theo người nhận chỉ ghi mã `MAIL_DELIVERY_FAILED` trong log server, không kèm email/token; chủ website kiểm tra dashboard delivery/bounce của dịch vụ. Thông báo nói rõ website không xác nhận địa chỉ có tài khoản hay thư đã đến hộp thư. Dịch vụ **thiếu cấu hình** vẫn trả 503 cho mọi email trước khi tra tài khoản. Với thao tác gửi lại của người đã đăng nhập, lỗi gửi trả 503 rõ ràng vì người đó đã biết tài khoản của chính mình. Đây không phải cam kết chống mọi suy luận thời gian; có thể thêm hàng đợi mail/worker nếu cần cô lập thời gian dịch vụ khỏi HTTP tốt hơn.

## Cấu hình gửi email thật

Trong **Netlify → Environment variables**, đặt biến server với phạm vi Functions, không dùng tiền tố `VITE_`:

| Biến | Giá trị / nơi lấy |
|---|---|
| `APP_ORIGIN` | Origin HTTPS chính xác, ví dụ `https://spofysofia.netlify.app`, không có đường dẫn. |
| `RESEND_API_KEY` | API key lấy trong tài khoản Resend do chủ website quản lý. Không đưa key vào GitHub/chat. |
| `MAIL_FROM` | Địa chỉ gửi đã xác minh trong Resend, ví dụ `SPOFY <noreply@ten-mien-ban-quan-ly>`. Phải cấu hình domain/DNS theo Resend. |
| `PASSWORD_BREACH_CHECK` | `hibp` cho kiểm tra mật khẩu rò rỉ; `local-blocklist` chỉ kiểm tra danh sách phổ biến và không thể kết luận chưa rò rỉ. |

Không đặt biến kiểm tra `MAIL_MODE=test`/`MAIL_TEST_RECIPIENT` vào production. Production mặc định kiểm tra HIBP nếu không ghi đè `PASSWORD_BREACH_CHECK`. Bản local mặc định dùng blocklist để hoạt động khi không có mạng. HIBP chỉ nhận 5 ký tự đầu SHA-1, có yêu cầu padding; không nhận mật khẩu hoặc hash đầy đủ. Dịch vụ lỗi/timeout trả 503, không tự bỏ qua rồi nói đã kiểm tra.

Resend được gọi từ server qua REST và timeout 10 giây; không thêm SDK hay gửi mail thật trong kiểm thử. Chưa có key/sender xác minh của chủ website nên **chưa kiểm chứng gửi/nhận email qua Resend trên Netlify**. Thiếu cấu hình: đăng ký, quên mật khẩu, gửi lại báo `MAIL_NOT_CONFIGURED`; đăng nhập tài khoản hiện có và đọc bài vẫn hoạt động. Phản hồi 2xx của nhà cung cấp chỉ xác nhận họ tiếp nhận, không đảm bảo thư đã vào hộp thư. HTTP 202 công khai của SPOFY cũng chỉ xác nhận tiếp nhận yêu cầu, không xác nhận thư đã được gửi; cần xem delivery/bounce và log mã lỗi trong dashboard.

Tài liệu API chính thức: [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email), [HIBP Pwned Passwords](https://haveibeenpwned.com/API/v3#PwnedPasswords).

## Deploy Preview an toàn

Trước khi bật API preview, xác nhận database là nhánh/bản sao **tách khỏi production**, đã ẩn danh dữ liệu cần thiết; không dùng connection string production. Sao chép database production cũng sao chép email/hash/phiên thật, nên không mặc định coi bản sao là dữ liệu kiểm thử an toàn.

API trong context `deploy-preview`/`branch-deploy` mặc định trả 503 `PREVIEW_DATA_NOT_CONFIRMED` **trước mọi truy vấn database**. Chỉ đặt `PREVIEW_DATA_ISOLATED=true` đúng context sau khi kiểm tra connection thực sự tới database test. Đây là xác nhận của người quản trị, không phải phép tự chứng minh rằng một URL database an toàn.

Trong context Deploy Preview, mail mặc định **tắt**. Muốn thử với database riêng, đặt:

```
APP_ORIGIN=https://dia-chi-preview-chinh-xac.netlify.app
MAIL_MODE=test
MAIL_TEST_RECIPIENT=hop-thu-kiem-thu-do-ban-kiem-soat
PREVIEW_DATA_ISOLATED=true
```

Đồng thời cấu hình key/sender của môi trường test. Mọi email preview bị chuyển đến đúng `MAIL_TEST_RECIPIENT`, không gửi đến địa chỉ người dùng trong dữ liệu. Không dùng mailbox của người khác. URL preview thay đổi thì cập nhật `APP_ORIGIN` đúng context trước khi thử. Không tự gửi thư hàng loạt hay thử phân quyền/rate limit vào production.

## API mới

Các POST đều cần cookie phiên, `Origin` khớp và `X-CSRF-Token` lấy từ GET `/api/auth/session`.

| Endpoint | Body | Thành công |
|---|---|---|
| `POST /api/auth/register` | `{email,name,password}` | 202 thông báo có điều kiện; chưa đăng nhập |
| `POST /api/auth/forgot-password` | `{email}` | 202 thông báo chung |
| `POST /api/auth/resend-verification` | `{}`; cần đăng nhập | 202 thông báo chung |
| `POST /api/auth/verify-email` | `{token}` | 200 user + cookie mới + CSRF mới |
| `POST /api/auth/reset-password` | `{token,password}` | 200, hủy tất cả phiên, cookie khách + CSRF mới |

GET `/api/auth/session` bổ sung `capabilities: {emailConfigured,verificationRequired,passwordBreachCheck}`. User bổ sung `emailVerified: true|false|null`; không trả hash, token phiên, token email. Không dùng localStorage để phân quyền/xác thực.

Các giới hạn theo database dùng chung: đăng nhập 10/15 phút/IP; đăng ký 5/giờ/IP; quên mật khẩu 5/giờ/IP và hash email; xác minh/reset-token 12/giờ/IP; gửi lại 3/giờ/tài khoản. Netlify thêm cặp IP+email khi đăng nhập, tránh khóa email toàn cục do người khác cố tình gửi sai. Không khóa vĩnh viễn tài khoản. Lỗi 429 có `Retry-After: 60`; khoảng đợi thực tế phụ thuộc cửa sổ giới hạn.

## Dữ liệu, migrations và khả năng quay lại

- SQLite: migration nội bộ phiên bản 3, additive; PostgreSQL: `netlify/database/migrations/0002_auth_lifecycle.sql` (ghi phiên bản 3 trong `schema_migrations`). Có kiểm thử giữ hash, tài khoản, session cũ và không tự tạo lịch sử xác minh/đăng nhập.
- Thêm `users.email_verified_at`, `email_verification_required`, `auth_version`; `sessions.auth_version`, `user_role`; bảng `auth_tokens` và trigger đổi quyền.
- Phiên đăng nhập 7 ngày, khách 1 ngày; hết hạn không còn quyền dù chưa dọn. Token hết hạn/đã dùng được dọn sau 48 giờ khi có request và tới kỳ dọn mỗi giờ. Token không được lưu dạng rõ.
- Khóa rate limit chứa hash IP/email; dọn sau 2 ngày. Không ghi IP/User-Agent vào lịch sử đăng nhập. Lịch sử chỉ giữ 10.000 bản ghi gần nhất; tổng lần đăng nhập vẫn cộng dồn.
- Bài, tài khoản, bình luận không có lịch xóa tự động. Admin quản lý bình luận; quyền riêng tư cần nói đúng điều này, không tự cam kết thời hạn pháp lý.
- Backup database trước migration. **Rollback deploy không tự rollback database, biến môi trường, email đã gửi hoặc token đã dùng.** Không gỡ cột/drop bảng trong rollback vội. Bản cũ không hiểu session-role/version mới; quay lại bản cũ có thể làm mất cơ chế hủy phiên khi đổi quyền, nên cần khôi phục code an toàn hoặc vô hiệu phiên theo quy trình quản trị.

MFA cho admin là bước tiếp theo được đề xuất (TOTP/WebAuthn với enrollment và recovery được kiểm thử); **chưa triển khai MFA** và không coi việc ẩn menu admin là một biện pháp phân quyền.

## Bằng chứng kiểm thử

`server-tests/auth-lifecycle.test.mjs` chạy SQLite thật và PostgreSQL thật trong PGlite: hạn token, dùng một lần và race, lỗi theo người nhận phản hồi công khai giống email chưa có, config thiếu trả 503, chống ghi đè email cũ, thay hash/revoke mọi session, role trigger, giữ legacy access, HIBP k-anonymity/fail-closed, preview chỉ gửi mailbox test, comment gate, CSRF/Origin và rate limit. Email chỉ đi vào transport giả cô lập; không có email/tài khoản/bài kiểm thử nào gửi tới production.

Các bộ kiểm thử cũ tiếp tục thử API bài/nháp/bình luận/upload/account audit; fixture được cập nhật đi qua endpoint xác minh thật bằng token từ transport test. Đăng ký 202 và xác minh 200 là thay đổi có chủ đích, không đổi thành công giả trong production.
