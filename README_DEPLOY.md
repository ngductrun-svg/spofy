# Đưa bản nâng cấp SPOFY lên bản xem thử Netlify

Website chính: **https://spofysofia.netlify.app/**. Repository đang dùng: **https://github.com/ngductrun-svg/spofy**. Làm việc tiếp trong project Netlify hiện tại; không cần tạo website hoặc tài khoản admin production mới.

Bản nâng cấp nằm trên nhánh `codex/spofy-quality-20261018`, đã đẩy lên [PR #1](https://github.com/ngductrun-svg/spofy/pull/1). Netlify đã triển khai thành công [bản xem thử riêng tư](https://deploy-preview-1--spofysofia.netlify.app/) ngày 21/10/2026; database nhánh riêng đã được làm sạch trước khi bật, sau migration vẫn không có tài khoản sao chép dùng được. Production vẫn ở commit `9869d95`; **chưa Merge/Publish production**. Phần gửi email thật còn cần chủ site xác minh sender và cấu hình khóa dịch vụ. Nếu chưa có Resend/tên miền, xem [hướng dẫn Brevo](docs/EMAIL_BREVO.md).

## 1. Chuẩn bị bằng GitHub Desktop, không cần gõ CMD

1. Cài [GitHub Desktop](https://desktop.github.com/download/) và đăng nhập tài khoản có quyền ghi repository `ngductrun-svg/spofy`.
2. Chọn **File → Add Local Repository → Choose**; mở thư mục làm việc:

   `C:\Users\trung\Documents\Codex\2026-10-14\file-c-users-trung-appdata-local\work\spofy-upgrade-20261018`

3. Kiểm tra **Current branch** là `codex/spofy-quality-20261018`, không phải `main`. Những thay đổi được bàn giao phải được commit vào nhánh này.
4. Nếu còn mục **Changes**, xem danh sách, nhập mô tả và chọn **Commit to codex/spofy-quality-20261018**. Không chọn tệp `.env`, `data/`, `*.sqlite`, `node_modules/`, `.netlify/` hoặc khóa email/database; chúng đã được bỏ qua bằng `.gitignore`.
5. Bấm **Publish branch** hoặc **Push origin** để đưa nhánh lên GitHub. Không cần tải hàng nghìn ảnh bằng trình duyệt. Nếu project bật tự build các nhánh, thao tác này có thể khởi chạy branch deploy; khi chưa xác nhận dữ liệu preview, để nguyên chốt dừng mặc định và hoàn thành mục 2, 4 trước khi chạy lại build.

Nếu dùng bản source giải nén trên máy khác: clone repository bằng **File → Clone Repository → URL**, tạo nhánh cùng tên, rồi chép **nội dung** source vào thư mục clone, giữ `package.json`, `netlify.toml`, `src`, `server`, `netlify`, `public`, `scripts` ở ngay cấp ngoài cùng. Không chép thư mục `.git` hoặc database local sang. [Hướng dẫn clone chính thức](https://docs.github.com/en/desktop/adding-and-cloning-repositories/cloning-and-forking-repositories-from-github-desktop).

Kho ảnh mới có 2.942 tệp thật, khoảng 230 MiB. Commit đủ `public/archive`, không đặt ZIP ảnh thay cho các tệp đã giải nén. Build sẽ báo lỗi nếu thiếu ảnh.

## 2. Kiểm tra project và dữ liệu trước khi tạo Preview

Trong Netlify mở đúng project **spofysofia** → cấu hình Git/build. Repository phải là `ngductrun-svg/spofy`; production branch giữ `main`.

| Thiết lập | Giá trị |
| --- | --- |
| Base directory | Để trống nếu `package.json` ở gốc repository |
| Build command | `pnpm build` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |
| Node | 24, tối thiểu 24.15; `netlify.toml` chọn 24 |
| pnpm | 11.25.0, theo `packageManager` và lockfile |

Backend là Netlify Functions + Netlify Database PostgreSQL + Netlify Blobs. Bản local Node/SQLite được giữ riêng. Không tải database SQLite trên máy lên GitHub, không thay database production hoặc cấp lại quyền admin đang có.

**Trước khi mở PR để kích hoạt build:** chủ website kiểm tra Netlify Database cấp nhánh/database riêng cho Deploy Preview, không có connection string production bị ghi đè cho mọi context. Database preview không được chứa thông tin người dùng thật chưa ẩn danh. Sao lưu database và media Blobs production bằng công cụ quản trị/backup của dịch vụ, ghi lại thời điểm và kiểm tra khả năng phục hồi. Nếu chưa xác nhận được các bước này, chưa kích hoạt build có migration; có thể tiếp tục xem/test local.

Build có bước `scripts/check-deploy-context.mjs` dừng sớm khi preview chưa được xác nhận; runtime cũng chặn API trước truy vấn DB. Hai chốt này **không tự kiểm tra được connection string hay tính riêng biệt của dữ liệu**. Chủ website vẫn cần xác nhận đúng cấu hình trước khi bật cờ. Migration native của Netlify được áp dụng ngay trước khi deploy có hiệu lực; việc mở PR với migration có thể làm thay đổi database preview khi deploy thành công. Không dán URL/khoá database vào chat. [Tài liệu migrations](https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/).

## 3. Tạo Pull Request và xem Deploy Preview

Sau khi dữ liệu preview đã được chuẩn bị, trong GitHub Desktop chọn **Create Pull Request**, base `main`, compare `codex/spofy-quality-20261018`. Viết mô tả ngắn, tạo PR và **chưa Merge**.

Netlify có thể tạo Deploy Preview cho PR của repository đã liên kết. Mở liên kết ở phần kiểm tra của PR hoặc Netlify → **Deploys → Deploy Preview**. Nếu không có, xem mục **Continuous deployment → Branches and deploy contexts** để bật Deploy Previews. [Hướng dẫn chính thức](https://docs.netlify.com/deploy/deploy-types/deploy-previews/).

Mã nguồn tạo shell HTML và bản ghi context riêng sau build để Function biết đây là preview. Khi chưa có xác nhận dữ liệu, build dừng với `PREVIEW_DATA_NOT_CONFIRMED`; hãy xem giao diện bằng bản local trước. Nếu một preview chạy tới runtime khi chưa được xác nhận, API vẫn trả 503 trước kết nối DB. Không chữa lỗi này bằng cách trỏ preview vào database production.

**Dùng build Deploy Preview gốc của Netlify từ PR.** Không upload thư mục `dist` hoặc Functions đã build local bằng CLI draft để thay bước này: bản ghi context của build local là `local`, không chứng minh được môi trường cloud. Cloud API hiện từ chối context thiếu/không hợp lệ hoặc `local`/`dev` trước khi khởi tạo storage và database. Backend Node/SQLite chạy trên máy vẫn hoạt động độc lập.

Ảnh bài viết do admin upload được cách ly riêng: production vẫn dùng site-wide store **`spofy-article-media`** như trước; Deploy Preview/branch deploy dùng **`getDeployStore`**, được Netlify gắn với deploy ID hiện tại. Thiếu context/deploy ID sẽ báo dịch vụ chưa sẵn sàng, không chuyển sang store production. Không cần tự chép deploy ID hay token vào frontend. Ảnh upload của một Preview **không tự chuyển sang lần deploy Preview tiếp theo**; hãy dùng lại fixture/ảnh kiểm thử phù hợp hoặc tải lại ảnh trong môi trường thử. Cách ly này không thay đổi 1.471 ảnh tư liệu tĩnh trong `public/archive`. [Phạm vi store theo tài liệu Netlify](https://docs.netlify.com/build/data-and-storage/netlify-blobs/#getstore).

## 4. Cấu hình email và biến môi trường

Mở **Project configuration → Environment variables**. Với PR #1, dùng ngữ cảnh **nhánh cụ thể** `codex/spofy-quality-20261018`, không bật cờ dữ liệu cho mọi Deploy Preview. Production chỉ cấu hình sau khi được duyệt. Key bí mật chỉ dùng phía server/Functions, không thêm tiền tố `VITE_`.

| Biến | Preview kiểm thử | Production sau khi được duyệt |
| --- | --- | --- |
| `APP_ORIGIN` | Origin HTTPS chính xác của preview, không có đường dẫn | `https://spofysofia.netlify.app` |
| `SITE_ORIGIN` | `https://spofysofia.netlify.app` | Giống preview; đây là canonical công khai |
| `PREVIEW_DATA_ISOLATED` | `true` **sau khi** kiểm tra DB riêng; cung cấp cho build và Functions | Không cần bật cho production |
| `MAIL_PROVIDER` | `brevo` hoặc `resend`; mặc định `resend` nếu bỏ trống | Nhà cung cấp đã kiểm thử |
| `RESEND_API_KEY` | Chỉ đặt khi chọn `resend` | Key server của Resend nếu chọn |
| `BREVO_API_KEY` | Chỉ đặt khi chọn `brevo` | Key server của Brevo nếu chọn |
| `MAIL_FROM` | Email/sender đã xác minh trong dịch vụ đã chọn | Sender đã xác minh |
| `MAIL_MODE` | `test` | Để trống/không đặt chế độ test |
| `MAIL_TEST_RECIPIENT` | Một hộp thư kiểm thử do chính bạn kiểm soát | Không đặt |
| `PASSWORD_BREACH_CHECK` | `hibp` khi có kết nối; `local-blocklist` chỉ kiểm tra danh sách phổ biến | `hibp` |

Không dùng biến `MAIL_TEST_MODE`: tên mã nguồn sử dụng là **`MAIL_MODE=test`**. Mọi email preview được chuyển tới `MAIL_TEST_RECIPIENT`. Đổi URL preview thì cập nhật `APP_ORIGIN` và redeploy. Sau khi đổi `PREVIEW_DATA_ISOLATED`, cũng cần chạy lại build vì Function đọc bản xác nhận context đã đóng gói khi build, không chỉ biến vừa sửa trên dashboard. Link email được server tạo từ origin này, không có callback OAuth cần đăng ký. Token xác minh dùng `/xac-minh-email#token=…`; token khôi phục dùng `/dat-lai-mat-khau#token=…`.

Resend cần key và tên miền/sender hợp lệ; tên miền con `spofysofia.netlify.app` không cấp quyền cấu hình DNS tên miền gửi email. Brevo là lựa chọn khởi đầu khi chưa có tên miền: xác minh địa chỉ người gửi và chờ dịch vụ cho phép gửi transactional; Brevo có thể thay địa chỉ gửi Gmail bằng miền tạm của họ. Không hứa thư sẽ được phát hoặc tài khoản chắc chắn được duyệt. [Thiết lập Brevo từng bước](docs/EMAIL_BREVO.md), [giới hạn gửi/miền thay thế chính thức](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders).

Nếu chưa có cấu hình hợp lệ, giữ email tắt: đăng ký/quên mật khẩu/gửi lại trả 503 rõ ràng; đọc bài và đăng nhập tài khoản hiện có vẫn dùng luồng cũ. Không tự đổi nhà cung cấp sau lỗi gửi, tránh gửi trùng hoặc chuyển dữ liệu sang dịch vụ khác. Đăng ký mới thành công trả **202**, chưa tự đăng nhập; cần nhận/xác minh email để bình luận. [Chi tiết xác thực](docs/AUTH_SECURITY.md), [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email), [Brevo Send Email](https://developers.brevo.com/reference/send-transac-email).

Ảnh tư liệu dùng `VITE_ARCHIVE_ASSET_BASE=/archive/`, catalog `/archive-data.json`. Các giá trị công khai này đã có trong `netlify.toml`. Không chép secret vào `VITE_*` vì chúng có thể đi vào bundle trình duyệt.

## 5. Kiểm tra trước khi duyệt production

Thử trên preview với dữ liệu test: đọc không đăng nhập; đăng ký reader; email xác minh một lần; login/logout; quên và đặt lại mật khẩu; quay về đúng bài/vùng bình luận; quyền reader/admin; bài nháp; upload ảnh; lọc/tìm kiếm/phân trang; album/lightbox; menu, bàn phím, reduced motion và điện thoại giả lập.

Thử tải lại trực tiếp `/khoa-hoc/{slug}` và xem source HTML để có metadata riêng. `/api/auth/session` phải trả JSON, không phải `index.html`. Kiểm tra vài ảnh và thumbnail ở `/archive/` tải từ preview. Không thử rate limit, phân quyền hoặc upload vào production.

Người chạy kỹ thuật dùng Node/pnpm đúng phiên bản, tại thư mục có `package.json`:

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm build` kiểm tra danh mục/ảnh, lọc câu hỏi đã xác minh, build Vite và tạo shell Function. `pnpm dev` chạy cả backend local ở cổng 3000 và giao diện phát triển ở `http://127.0.0.1:4173`; mở địa chỉ cổng 4173 khi dùng chế độ này. `pnpm start` chạy website và backend local tại `http://127.0.0.1:3000` sau build. Giữ cửa sổ đang chạy mở; nếu muốn nhập lệnh khác, mở cửa sổ terminal thứ hai tại cùng thư mục. Không dùng `pnpm preview` để kết luận đã thử backend vì đó chỉ là máy chủ giao diện Vite.

Migration `0002_auth_lifecycle.sql` chỉ bổ sung dữ liệu xác thực, không tạo lại bài/tài khoản. Tài khoản cũ giữ quyền và mật khẩu; không giả lập lịch sử xác minh. Người chủ dự án duyệt PR, kiểm tra backup và cấu hình production rồi mới quyết định Merge. Không kéo riêng `dist` vào Netlify Drop để thay deployment có Functions/database.

Rollback deploy không khôi phục database, biến môi trường, email đã gửi hoặc token đã dùng. Giữ backup; không tự drop bảng/cột mới. MFA admin và tự động báo cáo bình luận chưa được triển khai: hiện báo cáo qua Facebook chính thức để admin xem xét. Phần khoa học còn thiếu của bài hot drink vẫn cần URL bài gốc trước khi biên tập tiếp.
