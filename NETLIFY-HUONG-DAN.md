# Đưa SPOFY lên Netlify — làm bằng trình duyệt

> **Hướng dẫn cũ được giữ để tham khảo.** Với bản nâng cấp 19/10/2026, dùng **[README_DEPLOY.md](README_DEPLOY.md)** cho project `spofysofia` hiện tại, email xác minh và dữ liệu preview riêng. Không làm lại production theo quy trình cũ dưới đây.

Bạn cần tài khoản **GitHub**, **Netlify** và file **SPOFY-Netlify-source.zip** được bàn giao cùng hướng dẫn này. Không cần nhập lệnh CMD. Tài khoản Netlify quản lý máy chủ; tài khoản SPOFY dùng để đọc, bình luận và quản trị website.

Website trên máy bạn ở `127.0.0.1:3000` và website Netlify có dữ liệu riêng. Admin, bài viết và ảnh đã tải lên máy bạn **không tự chuyển sang website online**. Giữ nguyên thư mục dữ liệu cũ để bảo toàn nội dung.

## 1. Giải nén đúng gói

1. Nhấp phải file ZIP dành cho Netlify → **Extract All / Giải nén tất cả**.
2. Mở thư mục bên trong đến khi thấy `package.json`, `netlify.toml`, `src`, `public`, `netlify`.
3. Đây là thư mục mã nguồn sẽ đưa lên GitHub. Dùng gói đã làm sạch được bàn giao, không đưa thư mục `data`, `node_modules`, file `.env` hoặc file `.sqlite` lên mạng. `.env.example` là file cấu hình mẫu, có thể đưa lên.

**Không kéo riêng `dist` hoặc file HTML vào Netlify Drop.** Chúng chỉ có giao diện đã build, không chứa đủ mã Functions để triển khai đăng nhập và lưu dữ liệu của bản này.

## 2. Tạo nơi lưu mã nguồn trên GitHub

1. Vào [github.com](https://github.com/), đăng nhập.
2. Bấm dấu **+** phía trên → **New repository**.
3. Đặt tên, chẳng hạn `spofy-website`. Chọn **Private**.
4. Đánh dấu **Add a README file**, rồi bấm **Create repository**.
5. Trong repository mới: **Add file → Upload files**.
6. Mở thư mục ở bước 1, kéo **các file và thư mục bên trong** vào trang GitHub. Không kéo cả thư mục cha để tránh lồng thêm một tầng.
7. Chờ tải xong → bấm **Commit changes**. Nếu có quá nhiều file, tải từng thư mục qua nhiều lần.

Kiểm tra trang đầu repository có `package.json`, `netlify.toml` và thư mục `netlify`. Có thể tải thư mục bằng giao diện web theo [hướng dẫn GitHub](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository).

## 3. Kết nối Netlify với GitHub

1. Vào [app.netlify.com](https://app.netlify.com/) → đăng ký hoặc đăng nhập.
2. Chọn gói **Free** nếu được hỏi.
3. Ở **Projects**, chọn **Add new project → Import an existing project**.
4. Chọn **GitHub**. Khi GitHub hỏi cấp quyền, cho Netlify truy cập repository `spofy-website` vừa tạo.
5. Chọn repository đó, nhánh `main`.
6. Đối chiếu các ô:

| Ô trên Netlify | Giá trị |
| --- | --- |
| Base directory | Để trống nếu `package.json` nằm ngay ngoài cùng repository |
| Build command | `pnpm build` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |
| Node.js | `24` — cấu hình dự án đã chỉ định |

Các thiết lập có trong `netlify.toml`. Nếu cấu hình Netlify khác bảng trên, kiểm tra lại thư mục gốc. Bấm **Deploy site** hoặc **Deploy project**, rồi đợi triển khai xong. Quy trình tương ứng [hướng dẫn import Git của Netlify](https://docs.netlify.com/manage/projects/add-new-project/).

Lần đầu không cần thêm `APP_ORIGIN`, mật khẩu admin hoặc khóa bí mật vào Netlify.

## 4. Kiểm tra cơ sở dữ liệu và website

Bản Netlify sử dụng **Netlify Database** cho tài khoản, bài viết, bình luận; **Netlify Blobs** cho ảnh tải lên. Dependency và migration đã nằm trong mã nguồn. Netlify có cơ chế [tự tạo Database và áp dụng migration khi deploy](https://docs.netlify.com/build/data-and-storage/netlify-database/getting-started/).

1. Mở project → **Data & Storage → Database**.
2. Kiểm tra có database và nhánh **production**, có bảng `users`.
3. Nếu chưa có database, chọn **Create a database manually**, rồi triển khai lại ở **Deploys → Trigger deploy → Deploy project**. Nếu Netlify báo gói tài khoản không hỗ trợ Database, kiểm tra gói Free theo mô hình credit hiện hành.
4. Mở đường dẫn Netlify cấp, dạng `https://ten-ban-chon.netlify.app`.
5. Vào **Đăng ký**, tự đặt tài khoản SPOFY online bằng email của bạn. Đăng ký mới luôn nhận quyền độc giả.

## 5. Cấp quyền admin đầu tiên, không dùng CMD

Thao tác này thực hiện trong dashboard Netlify của **chính chủ project**:

1. Quay về **Netlify → project SPOFY → Data & Storage → Database**.
2. Tại nhánh **production**, bấm **View/edit**.
3. Bên trái chọn bảng **users**.
4. Tìm dòng có đúng **email vừa đăng ký trên website online**.
5. Trong dòng đó, bấm ô cột **role**, đổi `reader` thành `admin`, rồi xác nhận/lưu theo giao diện.
6. Chỉ sửa ô `role` của đúng tài khoản bạn; giữ nguyên các cột còn lại.
7. Quay lại website SPOFY → **Đăng xuất** → **Đăng nhập** lại bằng email và mật khẩu vừa đăng ký.
8. Mở `https://ten-ban-chon.netlify.app/admin`. Bạn sẽ thấy trang quản trị.

Chọn đúng **production**: sửa nhánh preview sẽ không cấp quyền cho website chính. Netlify mô tả thao tác sửa ô tại [View and edit data](https://docs.netlify.com/build/data-and-storage/netlify-database/edit-data/).

## 6. Xem tài khoản và người đã đăng nhập

Sau khi đăng nhập admin, chọn:

- **Tài khoản**: tên, email, vai trò, ngày tạo, lần xác thực gần nhất và số phiên chưa hết hạn; có tìm kiếm, lọc và phân trang.
- **Lịch sử đăng nhập**: các lần đăng nhập/đăng ký thành công được ghi nhận từ khi bật tính năng.

**Phiên chưa hết hạn không có nghĩa là người đó đang online.** Admin không xem được mật khẩu; giao diện này không cho thay đổi vai trò.

## 7. Kiểm tra trước khi chia sẻ link

1. Tạo một bài thật ở **Quản trị → Tạo bài viết**, lưu nháp. Mở cửa sổ ẩn danh và kiểm tra bài nháp không xuất hiện.
2. Xuất bản bài, kiểm tra chuyên mục Khoa học và đường dẫn bài khi tải lại trang.
3. Đăng ký tài khoản độc giả khác, thử gửi bình luận; tài khoản này không được vào `/admin`.
4. Dùng admin kiểm tra tài khoản và lịch sử đăng nhập mới.
5. Mở website trên điện thoại bằng mạng khác. Nếu đăng nhập, đọc bài và ảnh hoạt động, bạn có thể gửi link Netlify cho mọi người. Máy tính của bạn có thể tắt.

Đây là quy trình triển khai; chưa có xác nhận đã triển khai vào tài khoản Netlify của bạn. Xem báo cáo kiểm thử đi kèm để phân biệt kiểm thử cục bộ với kiểm tra dịch vụ online còn phải thực hiện.

## Khi gặp lỗi

- **404 khi tải lại `/admin`**: kiểm tra `netlify.toml` có ở gốc repository và đã deploy đầy đủ mã nguồn.
- **Giao diện có nhưng đăng nhập lỗi**: kiểm tra deploy có Functions, Database và migration thành công. Mở **Deploys**, chọn lần deploy lỗi để đọc log.
- **Email/mật khẩu không đúng**: tài khoản admin trên máy chưa tồn tại trên Netlify; làm lại bước 4–5 bằng tài khoản đăng ký online.
- **Chưa thấy bài cũ**: dữ liệu SQLite trên máy chưa được chuyển; đừng xóa bản cũ.

Theo [bảng giá Netlify](https://www.netlify.com/pricing/) được kiểm tra ngày **17/10/2026**, gói Free có **300 credit/tháng**, giới hạn cứng; dịch vụ có thể tạm dừng khi hết hạn mức. Theo dõi mục sử dụng trong dashboard trước khi tăng lưu lượng.
