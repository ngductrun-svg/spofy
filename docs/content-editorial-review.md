# Đối chiếu nội dung và metadata SPOFY

Ngày ghi nhận: 18/10/2026, theo giờ Việt Nam. Bản sửa làm việc trên nhánh `codex/spofy-quality-20261018`. Không có lệnh nào trong công việc này sửa bài, tài khoản hoặc bình luận trên production.

## Bài “Calling for a hot drink”

Nguồn đã đọc là phản hồi công khai của [API bài viết đang chạy](https://spofysofia.netlify.app/api/articles/calling-for-a-hot-drink), được lưu để đối chiếu trong `qa/production-hot-drink.json` của workspace kiểm tra. Tệp bằng chứng này không phải bản sao lưu toàn bộ cơ sở dữ liệu. Đường dẫn công khai của bài là [bài viết SPOFY](https://spofysofia.netlify.app/khoa-hoc/calling-for-a-hot-drink).

| Vấn đề | Bằng chứng trong dữ liệu đã ghi nhận | Cách xử lý |
| --- | --- | --- |
| Chuyên mục không khớp nhãn | `category` là `toan-hoc`, nhưng `tags` có `Hóa Học` | Đưa vào hàng chờ biên tập. Chưa đổi sang Hóa học chỉ dựa vào tag: phần khoa học và nguồn gốc đang thiếu. Admin cần đối chiếu bài gốc trước khi sửa chuyên mục và nhãn trong trình soạn thảo. |
| Có lỗi “cùng nhậu dạo bước” | Cụm này nằm trong đoạn gợi ý hoạt động mùa đông | Sửa bản hiển thị thành “cùng nhau dạo bước”. Bản văn bản gốc trong database vẫn được giữ để so sánh. |
| Phần giải thích khoa học có dấu hiệu thiếu | `blocks` chỉ có một đoạn văn; đoạn mở bằng “Đọc đến những thông tin trên…” nhưng trước đó không có phần giải thích tương ứng; `references` rỗng | Gắn cờ cần nguồn, không tự bổ sung kiến thức, nghiên cứu, lợi ích sức khỏe hoặc tài liệu tham khảo. |
| Tiêu đề dùng ngoặc và viết hoa toàn bộ | `title` là `[CALLING FOR A HOT DRINK]` | Giữ `originalTitle`; dùng `displayTitle` là “Chocolate nóng trong những ngày lạnh”. Metadata và giao diện dùng cùng một phép chiếu hiển thị. |
| Mô tả đang lặp đoạn mở đầu dài | `summary` hiện dùng toàn bộ đoạn dẫn nhập | Dùng mô tả biên tập riêng: “Một gợi ý đồ uống cho những ngày lạnh từ SPOFY, cùng những cách tận hưởng mùa đông bên người thân.” Đây là tóm tắt nội dung hiện có, không xác nhận giá trị khoa học đang thiếu. |
| Chưa có liên kết nguồn gốc | Không có `sourceUrl`; `references` rỗng | Giữ `sourceUrl: null`, không thay bằng một URL bài Facebook phỏng đoán. |
| Tên tác giả dài | Trường tác giả là `Science Propagandized Organization For Youth - SPOFY` | Giữ nguyên trường nguồn; giao diện dùng tên nhận diện `SPOFY`, kèm tên đầy đủ trong tooltip. Không thay bằng tên cá nhân hay tự xác nhận vai trò tác giả khác. |
| Alt ảnh quá chung | `coverAlt` là `chocolate` | Gợi ý admin kiểm tra lại ảnh rồi đặt mô tả ngắn đúng vật thể/bối cảnh thực tế. Không suy đoán danh tính người trong ảnh. |

Các phép chiếu trên nằm ở `server/article-display.mjs`; không chạy migration để thay nội dung đã xuất bản. Cờ `editorialReview` giúp nhận diện vấn đề cần xử lý, không mang ý nghĩa bài đã được thẩm định khoa học.

### Chưa thể phục hồi nội dung bài gốc

Đã thử tìm trên các kết quả công khai với tiêu đề tiếng Anh và các cụm “chocolate”, “cacao”, “Vincom Bà Triệu” gắn với SPOFY. Công cụ tìm kiếm không trả về bài Facebook gốc có thể xác minh. Truy cập trực tiếp [Facebook SPOFY](https://www.facebook.com/spofy.sofia) qua công cụ đọc web cũng không trả về nội dung bài.

Cần chủ dự án cung cấp **URL chính xác của bài Facebook gốc**, hoặc bản xuất bài gốc có phần giải thích bị thiếu và tài liệu tham khảo. Sau khi có nguồn, người biên tập phải so sánh từng phần, kiểm tra trích dẫn và cập nhật bằng tài khoản admin. Không dùng nội dung do AI tự viết để trình bày như bài nguyên gốc.

## Tư liệu hoạt động

Danh mục hiện có 51 nhóm và 1.471 ảnh. Không thay ID, ngày, tên lịch sử, liên kết Facebook hoặc đường dẫn kho ảnh trong đợt chỉnh metadata này. Ngày diễn ra và ngày đăng ảnh là hai trường riêng; trường ngày diễn ra trống không được biến thành một ngày suy đoán.

Các phần giới thiệu hoạt động dùng tư liệu đã có trong `src/content.ts` và danh mục. Khi chuẩn hóa cách viết `Club Fair`, `Hà Nội` hoặc tên môn, chỉ sửa lớp hiển thị và giữ tên nguồn ở thông tin đối chiếu. Không coi lời mô tả ngắn là bằng chứng về số người tham gia, danh tính hoặc kết quả sự kiện.

Kiểm tra bổ sung tìm được đủ 1.471 ảnh và 1.471 thumbnail thật tại thư mục nguồn có sẵn trong workspace. Toàn bộ 2.942 tệp đã giải mã bằng Pillow, đối chiếu kích thước, sao chép và kiểm tra SHA-256. Bản nâng cấp dùng `/archive/` cùng origin, không còn cần domain hosting ảnh bên ngoài khi được triển khai đầy đủ. Đây là thay đổi chuẩn bị cho bản mới; không thay hosting hoặc cấu hình production đang chạy. Chi tiết ở `docs/archive-asset-migration.md`.

## Metadata có trong phản hồi HTML

- `index.html` và bản build trang chủ dùng canonical/`og:url` của `https://spofysofia.netlify.app/`, không dùng domain kho ảnh làm địa chỉ website.
- `server/page-meta.mjs` tạo title, description, canonical, Open Graph và nội dung `noscript` theo đường dẫn. Mọi giá trị từ bài viết đều được escape HTML. Nội dung fallback chỉ lấy bài đã xuất bản.
- Netlify `page` Function trả HTML theo route, truy vấn PostgreSQL với điều kiện `status='published'`. Trang bài có ảnh chia sẻ tuyệt đối, ngày xuất bản/cập nhật và tiêu đề riêng trong phản hồi đầu tiên. Không gọi vòng qua HTTP API của chính production.
- Bài nháp, slug không tồn tại hoặc không khớp trả 404 với nội dung chung và `noindex`. Khi database/shell chưa sẵn sàng, trả 503, `Retry-After`, `noindex`, không đưa lỗi kết nối hoặc nội dung nháp vào HTML.
- Trang đăng nhập, đăng ký, admin, khôi phục và xác minh email có `noindex`. Query chứa token không xuất hiện trong canonical. Canonical của Deploy Preview trỏ về site chính; `SITE_ORIGIN` chỉ là cấu hình công khai của site, độc lập với `APP_ORIGIN` dành cho bảo vệ xác thực.
- `scripts/prepare-page-shell.mjs` chạy sau build, sao chép HTML đã có tên bundle chính xác vào `netlify/generated/page-shell.html`; `included_files` đóng gói shell vào Function. Tệp này không chứa bí mật hay bài viết.
- Rule `/api/*` và `/media/*` đứng trước rule trang. Tệp tĩnh tồn tại vẫn do CDN phục vụ, còn URL trang nhận HTML phù hợp qua Function. Source Functions ở ngoài `dist`.

## CSP và các giới hạn đã biết

Đã kiểm kê fetch phía trình duyệt và đóng gói đủ kho ảnh cùng site: API và danh mục đều dùng cùng origin. `connect-src` được thu hẹp thành `'self'`. `img-src` vẫn cho ảnh HTTPS vì trình soạn thảo hiện cho admin chọn ảnh bên ngoài qua URL HTTPS; bỏ toàn bộ HTTPS sẽ làm hỏng bài hiện hữu hoặc chức năng này. Script không được thêm `unsafe-inline` hay `unsafe-eval` để tránh lỗi console. Font hiện có được phục vụ cùng origin. Muốn dùng cấu hình catalog từ origin ngoài, người triển khai phải bổ sung chính xác origin tin cậy vào CSP sau khi kiểm tra, không mở lại toàn bộ HTTPS cho kết nối.

Các header động được Function tự trả, không giả định rằng header tĩnh trong `netlify.toml` sẽ áp dụng cho Function. HTML động đặt `Cache-Control` và `Netlify-CDN-Cache-Control` là `no-store` để bài gỡ xuất bản không còn bản metadata cache công khai từ lớp này.

## Xác minh

`node --test server-tests/page-meta.test.mjs`: **8/8 đạt**. Bao gồm metadata từng route, escape dữ liệu bài và fallback, ảnh an toàn, riêng tư bài nháp, SQL PostgreSQL thực bằng PGlite, canonical ở preview, GET/HEAD/405, không cần DB cho trang tĩnh, lỗi 503 không lộ dữ liệu, đồng bộ tiêu đề biên tập và thứ tự redirect.

Các kiểm thử chạy trên máy/bộ PostgreSQL tách biệt, không truy cập database production. Chưa xác nhận bản nâng cấp hoạt động tại Netlify thật: cần Deploy Preview của repository, database/email kiểm thử phù hợp và kiểm tra phản hồi HTML của URL preview trước khi chủ dự án duyệt production. Việc rollback deploy không tự khôi phục nội dung đã sửa trong database hay cấu hình dịch vụ bên ngoài.

Tài liệu nền tảng: [đóng gói và cấu hình Netlify Functions](https://docs.netlify.com/build/functions/configuration/), [Functions API](https://docs.netlify.com/build/functions/api/).
