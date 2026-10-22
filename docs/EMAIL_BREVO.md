# Thiết lập gửi email khi chưa có tên miền riêng

SPOFY hỗ trợ Brevo qua API HTTPS, không cần cài thêm thư viện. Chưa có khóa và sender xác minh nên **chưa bật hoặc thử gửi email thật**. Tên miền website `spofysofia.netlify.app` vẫn dùng được; chưa cần đổi địa chỉ website để chuẩn bị mail.

## 1. Tự tạo tài khoản miễn phí

Mở [Brevo](https://www.brevo.com/) → **Sign up free**. Dùng email bạn kiểm soát, ưu tiên email của câu lạc bộ. Tự đặt mật khẩu, chấp nhận điều khoản nếu đồng ý và xác minh email trong hộp thư. Chọn gói **Free**, không chọn nâng cấp hoặc mua thêm.

Theo [gói chính thức](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans), Free có 300 lượt gửi/ngày và transactional email, không cần thẻ. Việc kích hoạt khả năng gửi còn phụ thuộc phê duyệt của Brevo; website không tự vượt qua được bước này.

## 2. Xác minh người gửi

Trong Brevo, vào **Settings → Senders, Domains, IPs → Senders**, thêm sender với tên **SPOFY** và email bạn quản lý. Tự nhập mã xác minh được gửi vào hộp thư trên trang Brevo. Không gửi mã, mật khẩu hoặc API key qua chat.

Nếu dùng Gmail khi chưa có tên miền riêng, Brevo có thể thay địa chỉ gửi bằng miền của Brevo. Đây là cách bắt đầu tạm thời; việc mua/xác minh tên miền riêng là lựa chọn về sau, không tự động mua. Đọc [cách tạo sender](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email) và [quy tắc miền thay thế](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders).

## 3. Nhập cấu hình riêng tư vào Netlify

Tạo API key thường dùng cho website trong **Settings → SMTP & API → API Keys & MCP** của tài khoản Brevo, đặt tên dễ nhận ra như **SPOFY website**; không cần tạo MCP key hoặc SMTP key. Giữ key riêng tư. Trong project Netlify **spofysofia → Project configuration → Environment variables**, tự nhập key trực tiếp vào trường giá trị trên Netlify. Không đưa key lên GitHub, file HTML hoặc biến có tiền tố `VITE_`. [Hướng dẫn tạo API key chính thức](https://help.brevo.com/hc/en-us/articles/209467485-Create-and-manage-your-API-keys).

Chỉ chọn ngữ cảnh nhánh **`codex/spofy-quality-20261018`** để kiểm thử PR #1:

| Tên biến | Giá trị |
| --- | --- |
| `MAIL_PROVIDER` | `brevo` |
| `BREVO_API_KEY` | API key thật của bạn; nhập riêng tư trên Netlify |
| `MAIL_FROM` | Địa chỉ sender đã xác minh ở bước 2; chỉ email hoặc `SPOFY <email>` |
| `MAIL_MODE` | `test` |
| `MAIL_TEST_RECIPIENT` | Hộp thư thử nghiệm do bạn kiểm soát và đồng ý nhận thư |
| `APP_ORIGIN` | `https://deploy-preview-1--spofysofia.netlify.app` |

Không cần đặt `RESEND_API_KEY` khi dùng Brevo. Đừng đổi ngữ cảnh sang mọi branch hoặc production. `PREVIEW_DATA_ISOLATED=true` đã có riêng cho nhánh được kiểm chứng, không bật cho nhánh khác. Sau khi lưu, chạy lại Deploy Preview để Functions nhận cấu hình.

## 4. Kiểm tra một luồng trước khi xuất bản

Chỉ dùng tài khoản kiểm thử trong Preview. Đăng ký, kiểm tra hộp thư test (kể cả thư rác), bấm xác minh một lần rồi thử đăng nhập; tiếp đó thử quên mật khẩu và đặt lại. Mọi thư Preview đều bị chuyển về `MAIL_TEST_RECIPIENT`, kể cả khi người đăng ký nhập một địa chỉ khác. Không dùng dữ liệu người dùng thật và không thử gửi hàng loạt.

API trả mã tiếp nhận không đảm bảo thư đã vào hộp thư. Cần đối chiếu trạng thái trong dashboard Brevo và nhận thư thực tế. Nếu tài khoản chưa kích hoạt, quota hết hoặc sender bị từ chối, SPOFY báo lỗi chung và không chuyển sang nhà cung cấp khác.

Sau khi chủ site duyệt production mới đặt khóa/sender và `APP_ORIGIN=https://spofysofia.netlify.app` trong production; bỏ `MAIL_MODE=test` và không đặt hộp thư redirect ở production. Chưa thực hiện bước này tự động.
