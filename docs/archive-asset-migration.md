# Đóng gói kho ảnh cùng website

Ngày kiểm tra: 18/10/2026, giờ Việt Nam. Chỉ sửa bản sao làm việc `spofy-upgrade-20261018`; chưa triển khai hoặc đổi cấu hình production.

## Bằng chứng đủ tệp trước khi đổi origin

Nguồn cục bộ có sẵn: thư mục `../spofy-web-assets/photos` và `../spofy-web-assets/thumbs` cạnh project. Đã đối chiếu toàn bộ đường dẫn với `public/archive-data.json`, không dựa vào việc tạo URL phỏng đoán.

| Nội dung kiểm tra | Kết quả |
| --- | --- |
| Nhóm tư liệu | 51, không thay đổi |
| Ảnh | 1.471, đủ đường dẫn `photos/{id}.webp` |
| Thumbnail | 1.471, đủ đường dẫn `thumbs/{id}.webp` |
| Tổng tệp ảnh thật | 2.942; không thiếu hoặc thừa so với danh mục |
| Tổng dung lượng | 241.112.868 byte, khoảng 229,94 MiB |
| Giải mã ảnh | Pillow `Image.open(...).load()` thành công với cả 2.942 tệp WebP |
| Kích thước ảnh lớn | 1.471/1.471 khớp chính xác `full_width`/`full_height` trong danh mục |
| SHA-256 danh mục trước và sau | `2de8da536787622f28574b4379e13b889bd3685d6551c041ddbec1838391b291` |

Hai ảnh hero có sẵn được so sánh trước khi sao chép, giữ nguyên từng byte:

- `photos/1190515168964915.webp`: `9d96f0b0ebe4eb0109ae3ead1e98291e1613c28e66768071c3796691c2905e6d`.
- `photos/1903481897668235.webp`: `3c16fd3c59b22cc0c2107fc1a5e1cfb3ea6f4a5b35d3f7b7f48b96bf65aeea5d`.

Script từ chối ghi đè nếu tệp đích sẵn có khác SHA-256. Không có thao tác xóa tư liệu, tải lại ảnh từ mạng, thay liên kết Facebook, sửa ngày hay tên sự kiện.

## Thay đổi trong mã nguồn

- `public/archive/photos` và `public/archive/thumbs`: chứa đủ tệp để Vite sao chép vào `dist/archive`.
- `netlify.toml`: `VITE_ARCHIVE_ASSET_BASE="/archive/"`; catalog vẫn `/archive-data.json`.
- `src/archiveVariants.json`: ánh xạ `{id: [chiều_rộng_thumbnail, chiều_rộng_ảnh_lớn]}` lấy từ ảnh thực đã giải mã. Giao diện dùng các chiều rộng này cho `srcset`; không gán biến thể kích thước chưa tồn tại.
- `scripts/archive-assets-manifest.json`: đường dẫn, số byte, SHA-256 và kích thước thực của từng tệp.
- `scripts/verify-archive-assets.mjs`: kiểm tra đủ tệp, WebP, byte, SHA-256, biến thể và tính bất biến danh mục khi build. Chỉ cần Node.js, không cần Python ở Netlify.
- `scripts/audit-copy-archive.py`: công cụ tái tạo bằng chứng/manifest từ nguồn gốc, dùng Python với Pillow khi thực sự cần kiểm tra lại kho ảnh. Không phải bước bắt buộc để người dùng chạy website.
- CSP: request API/catalog đều cùng origin nên `connect-src 'self'`. Vẫn giữ `img-src https:` cho các ảnh bài viết bên ngoài mà admin nhập hợp lệ.

Build thông thường phải chạy `node scripts/verify-archive-assets.mjs` trước `vite build`. Nếu thiếu ảnh khi sao chép repository, build sẽ dừng và nêu đúng tệp thiếu thay vì triển khai một kho ảnh hỏng.

## Xác minh và phạm vi kết luận

Đã hoàn tất giải mã, sao chép và kiểm tra hash toàn bộ kho ảnh trong workspace. Kiểm thử `server-tests/archive-assets.test.mjs` dùng ảnh WebP thật và xác nhận kiểm tra build từ chối tệp bị thay byte, tệp giả dạng và tệp bị thiếu.

Không kết luận rằng kho ảnh production trước đây bị hỏng: browser probe sau khi tải xong hiển thị được các thumbnail được kiểm tra. Phản hồi khác nhau giữa HTTP client và trình duyệt không chứng minh lỗi ảnh của người dùng. Mục đích chuyển sang cùng origin là đóng gói đủ tài sản để bản triển khai mới tự phục vụ kho ảnh, giảm phụ thuộc hosting ảnh bên ngoài.

Chưa kiểm tra deployment Netlify mới trên tài khoản của chủ dự án. Sau khi tạo Deploy Preview từ repository đầy đủ, kiểm tra response của vài ảnh/thumbnail đại diện, mở album, đổi phân trang/lọc và kiểm tra không còn request ảnh kho tư liệu tới domain hosting cũ. Không kéo riêng một tệp HTML hoặc `dist` thiếu backend để thay thế toàn bộ deployment.

Kho ảnh có 2.942 tệp; dùng Git/GitHub Desktop để commit toàn bộ cây thư mục. Không tải từng tệp qua giao diện web của GitHub và không đặt file ZIP vào repository thay cho ảnh đã giải nén.
