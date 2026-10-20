# Các phát hiện và phạm vi xác minh

Khảo sát ban đầu ngày 18/10/2026; tiếp tục rà soát source và hoàn thiện tài liệu ngày 19/10/2026, giờ Việt Nam. Đối tượng: source repository `ngductrun-svg/spofy`, bắt đầu từ commit `9869d95`; nhánh làm việc `codex/spofy-quality-20261018`. Commit cục bộ đầu tiên về giao diện là `83c43e6`; không đồng nghĩa đã push hoặc deploy. Production chỉ được đọc công khai, không tạo tài khoản/dữ liệu test, sửa database hoặc gửi email thật.

Ngày **20/10/2026**, rà soát trước khi đưa nhánh lên GitHub phát hiện store upload bài viết dùng chung mọi deploy context. Đã sửa cách ly Preview và kiểm tra lại backend 69/69 đạt. GitHub đã được cho phép đăng nhập và dry-run kiểm tra push thành công; tại thời điểm cập nhật tài liệu này chưa có thao tác push/PR/deploy thật.

## 1. Lỗi/nội dung có bằng chứng

| Vị trí | Bằng chứng và nguyên nhân | File/cách xử lý | Cách xác minh và giới hạn |
| --- | --- | --- | --- |
| `/khoa-hoc/calling-for-a-hot-drink` | Snapshot API có category `toan-hoc`, tag `Hóa Học`; chỉ một block kết luận nhắc “thông tin trên”, không có phần giải thích tương ứng; references rỗng | `server/article-display.mjs`, `docs/content-editorial-review.md`: tiêu đề/tóm tắt hiển thị riêng, giữ originalTitle, cờ cần nguồn | Chưa có URL bài Facebook gốc để phục hồi hoặc chốt chuyên mục. Không tự tạo phần khoa học, nguồn hoặc sửa category production. |
| Cùng bài, đoạn kết | Có cụm “cùng nhậu dạo bước” | Phép chiếu block sửa chính tả thành “cùng nhau dạo bước”, không đổi văn bản lưu gốc | Đối chiếu chuỗi nguồn; không mở rộng thành phát biểu khoa học mới. |
| Metadata | `index.html` dùng `og:url` của hosting kho ảnh, mọi route ban đầu nhận cùng shell | `server/page-meta.mjs`, `netlify/functions/page.mjs`, `scripts/prepare-page-shell.mjs`, `index.html`, `netlify.toml` | Kiểm thử HTML đầu tiên, escape, canonical, ảnh/ngày bài và SQL chỉ bài xuất bản. Draft/không tồn tại 404 noindex; thiếu dịch vụ 503. Netlify thực cần Preview xác nhận. |
| Luồng tài khoản ban đầu | Source chỉ có đăng ký/đăng nhập, chưa có token xác minh/khôi phục thật | `server/auth-lifecycle.mjs`, hai backend, migration `0002_auth_lifecycle.sql`, `src/science/AuthPages.tsx` | Có lifecycle server, token hash/hạn/một lần, giao diện và mail transport Resend. Chỉ transport test cô lập đã kiểm thử; key/sender thật chưa được cung cấp/cấu hình. |
| Kho ảnh phụ thuộc origin ngoài | Source ban đầu chỉ kèm hai hero, cấu hình trỏ hosting ngoài; tìm được đủ tệp gốc trong workspace | `public/archive`, manifest/checker, `src/archiveVariants.json`; bản mới dùng cùng origin | Giải mã đủ 2.942 WebP, 241.112.868 byte; hash catalog giữ nguyên; 1.471 kích thước ảnh lớn đều khớp. Không kết luận ảnh production hỏng: browser probe có ảnh tải được. |
| Storage ảnh bài viết trên Preview, rà soát 20/10 | `netlifyStorage()` trước đó luôn gọi `getStore('spofy-article-media')`; Netlify xác định đây là store site-wide, dùng được ở mọi context, nên DB riêng chưa đủ cách ly media | `netlify/server/storage.mjs`, `netlify/functions/spofy.mjs`, `server-tests/storage-isolation.test.mjs`: giữ nguyên store production; Preview dùng `getDeployStore`, xác nhận context trước khởi tạo DB/storage | 4 test cách ly và toàn bộ 69 test đạt. SDK thật xác minh namespace/deploy ID trong subprocess không mạng; chưa thử upload trên Netlify thật. Ảnh upload Preview không tự mang sang lần deploy tiếp theo; kho ảnh tĩnh không đổi. |

## 2. Thiết kế/khả năng đọc, không phải khẳng định lỗi bảo mật

Giao diện mới giữ Lexend, nền tối, cam đào và nội dung/ảnh thật. Phần đầu có ba hướng “Bắt đầu từ đây”; bài ít được trình bày rõ hơn thay vì lấp bằng bài giả. Thêm thời gian đọc từ số từ thực, ngày cập nhật, nguồn/bài liên quan khi có dữ liệu; tên truy cập cho thumbnail và trạng thái ảnh lỗi. Khoa học/admin/công thức/3D được tách tải theo nhu cầu thay vì bắt mọi route nhận toàn bộ thư viện.

Các file chính: `src/App.tsx`, `src/HeroWord.tsx`, `src/RootApp.tsx`, `src/science/{Public,Content,AuthPages,Engagement,Formula}.tsx` và CSS tương ứng. Kết quả đo bundle, ảnh trước/sau, viewport và accessibility được ghi ở báo cáo kiểm thử bàn giao riêng; không suy diễn điểm Lighthouse hoặc thiết bị thật từ ảnh giả lập.

“Một câu hỏi mỗi tuần” có schema/kiểm tra nguồn và chỉ xuất bản mục `verified`; dữ liệu hiện rỗng nên hiển thị trạng thái chưa có nội dung. Không hẹn đã có câu hỏi hàng tuần khi chưa có biên tập viên cập nhật. Mục tham gia/FAQ chỉ dùng thông tin có sẵn và Facebook chính thức; không tạo lịch tuyển, điều kiện, người liên hệ hoặc số liệu mới.

## 3. Bảo mật đã đọc và kiểm thử trong môi trường cô lập

Backend cloud được xác định bằng source: `netlify/functions/spofy.mjs` → `netlify/server/app.mjs` → PostgreSQL của Netlify Database, media qua Netlify Blobs; local là `server/app.mjs` với SQLite. Phiên lưu phía server, cookie HttpOnly/Secure/SameSite theo môi trường. Không phải hệ thống xác thực Supabase/Firebase, không dùng localStorage làm phân quyền.

Các kiểm thử backend dùng SQLite và PostgreSQL/PGlite thật, reader/admin/guest và transport email test: kiểm tra quyền server, nháp, CSRF/Origin, phiên/hủy phiên, token một lần, rate limit, bình luận, upload và dữ liệu mã độc. Không khẳng định “đã bảo mật production” chỉ từ việc ẩn nút hoặc trả 403 trên mock.

Thay đổi có chủ đích: đăng ký 202, chưa tự đăng nhập; tài khoản mới luôn reader, cần xác minh trước bình luận. Tài khoản cũ không bị gắn lịch sử email giả hoặc buộc xác minh để giữ quyền trước đây. Đổi quyền/reset hủy phiên. HIBP được gọi theo k-anonymity, không gửi mật khẩu/hash đầy đủ; thiếu kết nối không giả vờ kiểm tra thành công. Chi tiết chính xác về giới hạn/tồn trữ ở `docs/AUTH_SECURITY.md`.

CSP `connect-src` thu hẹp còn self khi kho ảnh đã đóng gói đủ. `img-src https:` được giữ vì admin có thể dùng ảnh bài từ HTTPS; đây là quyết định tương thích có căn cứ, không tuyên bố mọi nguồn ảnh đều do SPOFY quản lý. Không thêm `unsafe-eval`/script inline để dẹp lỗi console. Bài/comment được render thành dữ liệu an toàn và KaTeX không tin cậy.

Storage cloud hiện mặc định từ chối context thiếu/không hợp lệ và artifact có context `local`/`dev`. Với Preview còn cần cờ xác nhận DB và deploy ID do nền tảng cung cấp; không fallback sang store production khi thiếu cấu hình. Dùng build PR Deploy Preview gốc của Netlify, không upload artifact build local bằng CLI draft. Backend local Node/SQLite không dùng adapter cloud này và không bị thay đổi. Production vẫn giữ store bền vững cũ; handler/DB pool tiếp tục được tái sử dụng trong mỗi deployment.

## 4. Chưa đủ bằng chứng hoặc cần chủ dự án cấu hình

| Phần còn thiếu | Cần gì để xác nhận | Trạng thái trung thực |
| --- | --- | --- |
| Email ngoài đời thực | Resend key server, sender/domain đã xác minh, mailbox test do chủ dự án kiểm soát | Chưa gửi/nhận mail thật. Thiếu cấu hình trả lỗi rõ; không dựng thành công giả. |
| Preview dùng dữ liệu riêng | Chủ Netlify kiểm tra nhánh DB, phạm vi biến, ẩn danh dữ liệu và mailbox test trước build | Build preview chưa xác nhận dừng sớm; API runtime cũng mặc định chặn trước truy vấn DB. Cờ `PREVIEW_DATA_ISOLATED` là xác nhận quản trị, không tự chứng minh an toàn của connection string hay migration. |
| Phần khoa học bài hot drink | URL/bản xuất bài gốc và tài liệu đã dẫn | Chưa phục hồi, chưa thay chuyên mục theo suy đoán. |
| Danh tính tác giả và alt sâu hơn | Thông tin biên tập/nhận diện do chủ câu lạc bộ xác nhận | Giữ tên tác giả hiện hữu; không đoán người trong ảnh. |
| MFA admin | Enrollment, recovery và kiểm thử riêng | Mới là đề xuất, chưa triển khai. |
| Báo cáo bình luận tự động | Quy trình/queue quản trị và chính sách xử lý được duyệt | Hiện hướng dẫn gửi URL qua Facebook để admin xem xét; không có nút report giả hoặc xóa bình luận thật. |
| Production Netlify | Preview đã kiểm tra, cấu hình dịch vụ và chủ dự án duyệt | Ngày 20/10 đã được duyệt đăng nhập GitHub và dry-run push thành công; tại thời điểm cập nhật chưa push/deploy/merge hoặc thay dữ liệu production. |
| Thiết bị thật và độ ổn định dài hạn | Windows/Android/iOS thật, giám sát host/delivery và backup | Browser viewport/kiểm thử local không thay thế xác nhận thiết bị hay cam kết uptime. |

## 5. Bảo toàn và triển khai

Danh mục tư liệu giữ nguyên SHA-256 `2de8da536787622f28574b4379e13b889bd3685d6551c041ddbec1838391b291`, gồm 51 nhóm/1.471 ảnh với tên gốc, thời gian và nguồn. Không chuyển ngày đăng ảnh thành ngày diễn ra khi thiếu bằng chứng. SQLite đang dùng trên máy không bị ghi đè hoặc upload. Migration xác thực bổ sung cột/bảng/trigger, không reset dữ liệu.

Hướng dẫn thao tác mới ở `README_DEPLOY.md`; tài liệu chuyên sâu ở `docs/AUTH_SECURITY.md`, `docs/content-editorial-review.md`, `docs/archive-asset-migration.md`. Báo cáo kiểm thử cuối ghi riêng kết quả chạy thực, số đo bundle và phần chưa kiểm chứng; không gộp kế hoạch với kết quả đã đạt.

Rollback website không tự phục hồi database, biến môi trường, Blobs hoặc email/token bên ngoài. Bản cũ có thể không hiểu session version mới; cần backup/phục hồi có kiểm tra và đánh giá tương thích trước khi quay lại, không tự drop dữ liệu mới để “hết lỗi”.
