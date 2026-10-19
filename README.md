# SPOFY — Khoa học và hành trình của trí tò mò

**Bản nâng cấp 19/10/2026:** đọc **[README_DEPLOY.md](README_DEPLOY.md)** để đưa nhánh lên bản xem thử của project Netlify `spofysofia` hiện tại. Đọc [báo cáo kiểm thử](docs/TEST_REPORT.md) trước khi triển khai. Chưa xuất bản production; cần cấu hình email và xác nhận database preview riêng.

Ứng dụng gồm giao diện React SPOFY, chuyên mục Khoa học, tài khoản, bình luận và quản trị. Có hai backend dùng chung giao diện: **Netlify Functions + PostgreSQL + Blobs** để đưa lên Internet, hoặc **Node.js + SQLite** khi chạy trên máy/hosting có đĩa bền vững. Không có bài viết mẫu, tài khoản mặc định hay mật khẩu admin trong gói bàn giao.

## Đưa lên Netlify, không cần CMD

Làm theo **[README_DEPLOY.md](README_DEPLOY.md)** bằng GitHub Desktop: dùng repository và project hiện có, đưa nhánh sửa lên GitHub, xác nhận dữ liệu preview riêng rồi tạo PR để xem thử. Không kéo riêng HTML hoặc `dist` vào Netlify Drop. Giữ tài khoản admin hiện hữu; không tạo lại dữ liệu production.

`netlify.toml` có cấu hình build, Functions, SPA routes và nhận diện môi trường cloud. Schema PostgreSQL ở `netlify/database/migrations/`; Netlify quản lý kết nối cơ sở dữ liệu và kho ảnh, không cần chèn khóa bí mật vào frontend. Chi tiết cấu trúc và cấu hình ở **[NETLIFY-ARCHITECTURE.md](NETLIFY-ARCHITECTURE.md)**.

Website local và Netlify dùng cơ sở dữ liệu riêng: admin, bài viết và ảnh local không tự chuyển lên online. Bản source Netlify không chứa `dist`, `node_modules`, `.env` hoặc dữ liệu thật; Netlify cài dependency và build từ source. Các hướng dẫn tiếp theo dành cho việc chạy trên máy.

## Chạy trên máy tính

Yêu cầu **Node.js 24.15 trở lên trong nhánh 24 LTS**. Không cần cài hệ quản trị cơ sở dữ liệu riêng. SQLite dùng module `node:sqlite` có sẵn trong Node; một số phiên bản Node hiện thông báo ExperimentalWarning khi khởi động.

```sh
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
```

Sao chép `.env.example` thành `.env`, giữ cấu hình mặc định khi thử tại máy. Tất cả giá trị mẫu là cấu hình công khai, không chứa bí mật.

```sh
pnpm build
pnpm start
```

Mở **http://127.0.0.1:3000**. Dùng cùng địa chỉ này cho đăng nhập; `localhost` là origin khác `127.0.0.1`. Không mở trực tiếp `dist/index.html` bằng `file://` cho phiên bản có backend.

Nếu dùng gói local cũ có sẵn thư mục `dist/`, cài Node.js rồi chạy `node --env-file-if-exists=.env server/index.mjs` mà không cần tải dependencies giao diện trước. Với gói source Netlify mới, phải cài dependencies và build theo các lệnh trên trước khi chạy local.

Trên Windows có thể mở **CHAY-SPOFY.cmd** sau khi cài Node.js 24. Script tạo `.env` từ mẫu nếu chưa có rồi chạy máy chủ; giữ cửa sổ terminal mở trong lúc dùng website.

## Tạo admin đầu tiên

**Cách dễ trên Windows:** nhấp đúp `TAO-ADMIN-SPOFY.cmd` trong cùng thư mục với `CHAY-SPOFY.cmd`. Công cụ mở biểu mẫu riêng; giữ nguyên cửa sổ đang chạy website. Nếu chưa chọn đúng thư mục, bấm `Chọn CHAY-SPOFY.cmd` và chọn file đã dùng để mở website.

Nếu bạn đã đăng ký tài khoản trên website, đánh dấu **Tôi đã đăng ký SPOFY**, nhập email và mật khẩu SPOFY hiện tại, rồi bấm **Cấp quyền admin đầu tiên cho tài khoản này**. Công cụ kiểm tra mật khẩu, giữ nguyên tên/mật khẩu và thu hồi các phiên cũ; hãy tải lại trang đăng nhập để vào quản trị. Nếu chưa có tài khoản, để ô đó trống và điền tên, email, mật khẩu mới, nhập lại mật khẩu rồi bấm **Tạo tài khoản admin**. Có lựa chọn hiện mật khẩu để kiểm tra khi gõ.

Biểu mẫu là công cụ tin cậy chạy cục bộ trên máy chủ, không có API cấp quyền qua website và không dùng mật khẩu mặc định. Công cụ từ chối khi đã có admin. Nó không reset mật khẩu hoặc cấp thêm admin. Mật khẩu đi qua stdin tới Node, không nằm trong tham số dòng lệnh hoặc file tạm. Chỉ thao tác sau khi người dùng tự điền và bấm nút xác nhận. File tự chứa toàn bộ biểu mẫu và dùng được với bản ZIP SPOFY trước đó.

Mã biểu mẫu ở `scripts/windows-admin-form.ps1` và `scripts/admin-form-bootstrap.mjs`; chạy `pnpm build:admin` sau khi chỉnh sửa để tạo lại file CMD. Khi dùng Windows, file PS1 được lưu UTF-8 có BOM để tương thích PowerShell 5.1.

**Cách dùng lệnh:**

Thực hiện trên máy chủ, bằng tài khoản có quyền truy cập thư mục ứng dụng:

```sh
pnpm admin:create --email admin@example.com --name "Quản trị SPOFY"
```

Thay email và tên bằng thông tin của bạn. CLI hỏi mật khẩu và xác nhận, che ký tự khi nhập trong terminal; mật khẩu từ **12–128 ký tự**. Không truyền mật khẩu trong tham số dòng lệnh. Sau đó mở **/dang-nhap?next=/admin** để đăng nhập. Không có API công khai để cấp hoặc đổi vai trò. CLI mặc định từ chối tạo thêm khi đã có admin; người quản trị máy chủ có thể dùng `--allow-additional` để tạo một admin mới khi cần. CLI không nâng quyền một tài khoản độc giả đã tồn tại.

Nếu chạy trực tiếp bản đã build và chưa cài pnpm, dùng lệnh tương đương: `node server/create-admin.mjs --email admin@example.com --name "Quản trị SPOFY"`.

Đăng ký trên website luôn tạo **độc giả**. Độc giả đọc bài đã xuất bản và gửi bình luận; chỉ admin được tạo, sửa, xóa, xuất bản bài, tải ảnh và quản lý bình luận. Không cung cấp thao tác sửa/xóa bình luận cho độc giả, kể cả bình luận của chính họ.

## Sử dụng

- `/`: trang 3D cũ, menu Khoa học, nút khám phá và tối đa ba bài nổi bật; nếu chưa có bài nổi bật thì hiển thị bài mới nhất đã xuất bản.
- `/khoa-hoc`: tìm kiếm, sáu chuyên mục và phân trang.
- `/khoa-hoc/<slug>`: đường dẫn bài riêng, mở trực tiếp/tải lại được; nội dung, chú thích ảnh, công thức LaTeX, tham khảo, bài liên quan và bình luận.
- `/dang-ky`, `/dang-nhap`: tài khoản độc giả và đăng nhập.
- `/admin`: danh sách bài, trạng thái nháp/xuất bản, sửa và xóa có xác nhận.
- `/admin/bai-viet/moi`, `/admin/bai-viet/<id>`: trình soạn thảo theo khối, lưu nháp, xem trước, xuất bản/gỡ xuất bản. Bài xuất bản cần tiêu đề, slug, tác giả, tóm tắt, ảnh bìa có mô tả và ít nhất một khối nội dung.
- `/admin/binh-luan`: ẩn, hiện lại hoặc xóa bình luận.
- `/admin/tai-khoan`: admin xem tài khoản, ngày tạo, lần xác thực gần nhất, số lần ghi nhận và phiên chưa hết hạn; tìm kiếm/lọc vai trò/phân trang.
- `/admin/dang-nhap`: lịch sử đăng nhập hoặc đăng ký thành công; giữ tối đa 10.000 sự kiện gần nhất, không hồi dựng lịch sử trước khi nâng cấp. Phiên chưa hết hạn không đồng nghĩa đang online.

Trình soạn thảo hỗ trợ tiêu đề phụ, đoạn văn, danh sách, liên kết HTTPS, ảnh PNG/JPEG tải lên hoặc ảnh HTTPS, chú thích và công thức LaTeX. Nội dung không nhận HTML tùy ý. Công thức được KaTeX dựng tại máy người đọc, tắt `trust` và giới hạn kích thước/mở rộng macro.

## Dữ liệu và cấu hình

Mặc định máy chủ tự tạo `data/spofy.sqlite` và `data/media/`. Bài viết, tài khoản, phiên đăng nhập, bình luận và giới hạn tần suất cùng lưu trên đĩa, tồn tại sau khi khởi động lại. Không đưa thư mục `data/` vào Git hoặc phục vụ công khai. Sao lưu **cả SQLite và media**, dùng SQLite backup hoặc dừng máy chủ trước khi sao chép để tránh mất phần WAL chưa checkpoint.

Có thể sao lưu SQLite khi ứng dụng đang chạy bằng `node server/backup.mjs /duong-dan-moi/spofy-backup.sqlite`; sao lưu thư mục media riêng cùng thời điểm.

| Biến | Ý nghĩa |
| --- | --- |
| `NODE_ENV` | `development` khi chạy tại máy; `production` khi triển khai HTTPS |
| `HOST`, `PORT` | Địa chỉ lắng nghe; mặc định `127.0.0.1:3000` |
| `APP_ORIGIN` | Origin chính xác của website, không có đường dẫn; production bắt buộc HTTPS |
| `DATA_DIR` | Thư mục dữ liệu bền vững; mặc định `./data` |
| `DB_PATH`, `MEDIA_DIR` | Tùy chọn ghi đè vị trí SQLite và ảnh tải lên |
| `DIST_DIR` | Tùy chọn thư mục build giao diện; mặc định `./dist` |
| `VITE_ARCHIVE_ASSET_BASE` | Nguồn ảnh kho tư liệu cũ; giá trị mẫu giữ host ảnh hiện có |
| `VITE_ARCHIVE_CATALOG_URL` | Catalog tư liệu; mặc định `/archive-data.json` |

Các biến `VITE_*` là công khai và được chèn lúc build. Không đặt mật khẩu/khóa bí mật vào đó. Backend dùng phiên ngẫu nhiên lưu server và cookie `HttpOnly; SameSite=Lax`; HTTPS thêm `Secure`. Không cần khóa admin phía trình duyệt và không dùng localStorage để xác thực/phân quyền.

Kho ảnh gốc được bảo toàn theo SHA-256 và vẫn dùng host ảnh hiện có. Hai ảnh nền hero có trong `public/archive/photos/`; các ảnh album còn lại cần truy cập host công khai ghi trong `.env.example`. Muốn tự lưu toàn bộ, đặt ảnh/thumbnails đúng đường dẫn trên kho riêng rồi đổi biến asset base và build lại.

## Phát triển và kiểm thử

```sh
pnpm dev
# Giao diện http://127.0.0.1:4173; API tại cổng 3000 được Vite proxy cùng origin.
pnpm test
pnpm check:data
pnpm build
```

`pnpm dev` dành riêng cho phát triển tại máy và tự đặt origin `http://127.0.0.1:4173`. Không chạy đồng thời một máy chủ khác dùng cổng 3000. Bộ test tạo cơ sở dữ liệu và media tạm, kiểm tra bằng HTTP thật; không cài tài khoản hoặc bài thử vào dữ liệu sử dụng thực tế.

## Triển khai

Dùng một máy chủ/container chạy Node 24 với **đĩa bền vững**, không dùng static hosting hoặc filesystem tạm. Đặt reverse proxy HTTPS phía trước. Cấu hình ví dụ:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
APP_ORIGIN=https://TEN-MIEN-CUA-BAN
DATA_DIR=/var/lib/spofy
```

Thay origin bằng tên miền thật, mount đĩa vào DATA_DIR và tạo admin qua CLI trên chính volume này. Chạy một instance ghi SQLite; không nhân bản nhiều container với cơ sở dữ liệu riêng. Proxy phải giữ đường dẫn `/api`, `/media` và các route giao diện cùng origin; không cache API, HTML hoặc ảnh `/media`. Cấu hình máy chủ không tin các header proxy để bỏ qua kiểm tra origin hay quyền người dùng.

Có Dockerfile và `compose.example.yml`; đặt `APP_ORIGIN` và cấu hình HTTPS của hệ thống triển khai trước khi dùng. Tạo admin trong container đang chạy bằng lệnh sau (image runtime không cần pnpm):

```sh
docker compose -f compose.example.yml exec spofy node server/create-admin.mjs --email admin@example.com --name "Quản trị SPOFY"
```

Không có dịch vụ ngoài cần API key. Phần còn cần từ bạn để đưa lên Internet là host chạy Node, tên miền/HTTPS và vị trí volume bền vững. Gói này chưa tự xuất bản lên tên miền nào.

## Cấu trúc mã nguồn

```text
src/                  React, hero 3D, menu, timeline và kho ảnh hiện có
src/RootApp.tsx       Điều hướng giữa trang chủ và chuyên mục mới
src/science/          Phiên đăng nhập, danh sách, đọc bài, editor và quản trị
server/app.mjs        HTTP API, kiểm tra quyền, static/SPA và ảnh có kiểm soát
server/auth.mjs       Scrypt, cookie phiên, CSRF và CLI provisioning
server/schema.sql     Cấu trúc dữ liệu, ràng buộc và index
server/validation.mjs Danh sách loại nội dung và kiểm tra dữ liệu đầu vào
server/image.mjs      Kiểm tra PNG/JPEG và kích thước tải lên
server/create-admin.mjs  CLI tin cậy tạo admin
server-tests/         Kiểm thử phân quyền, dữ liệu, bình luận và upload
scripts/              Kiểm chứng tư liệu và máy chủ phát triển
public/               Catalog, font và ảnh nền cũ
dist/                 Giao diện đã build để chạy cùng backend
```

Xem `DATA-MODEL.md` và `VERIFICATION.md` để biết cấu trúc dữ liệu và phạm vi kiểm chứng của bản bàn giao.
