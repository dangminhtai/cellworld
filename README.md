# CELLWORLD

Thế giới chung 100 tế bào: frontend HTML/CSS/Canvas trên **Cloudflare Pages**, backend Worker `cellworld-backend` chứa một **SQLite-backed Durable Object**. Giữ giao diện và luật cũ; GitHub Pages vẫn có thể phục vụ frontend với cùng backend.

## Luật gốc

Thế giới cố định 900 × 585, ban đầu 100 tế bào và 180 hạt. Không sinh sản. Không thấy thức ăn thì đi thẳng, đổi hướng sau 1,5–5,5 giây mô phỏng; cảm nhận trong 90px. Tìm mục tiêu mới dùng `< 90²`, giữ mục tiêu cũ dùng `<= 90²`, đúng code gốc. Vận tốc 18–33px/s, tốc độ quay 3,3rad/s, phản xạ ở biên. Ăn khi khoảng cách `< 7px`, mỗi hạt chỉ ăn một lần. Sống qua lần ăn 100, chết ở lần 101; không có nguyên nhân chết khác. Thức ăn tự sinh 5 hạt/giây × hệ số 0–2, tối đa 700 hạt; thao tác thủ công thêm tối đa 8 hạt.

`tests/fixtures/original-engine.js` giữ thuật toán gốc để so sánh toàn bộ kết quả sau 60 giây. Target chuyển từ object reference sang food ID để lưu/khôi phục chính xác.

## Windows PowerShell: cài đặt và chạy

Cần Node.js 22.16+ hoặc LTS mới tương thích Wrangler, npm và PowerShell:

```powershell
npm ci
npx playwright install chromium
npm run dev
```

Mở http://127.0.0.1:5173/ ; backend tại http://127.0.0.1:8787/ . Một lệnh khởi chạy cả hai. `Ctrl+C` kết thúc dev. SQLite local lưu trong `.wrangler/state`, giữ qua lần chạy sau; không xóa thư mục này nếu muốn giữ thế giới local.

Không có secret thì khách vẫn xem được, các điều khiển thế giới bị khóa. Để thử quản trị local, tạo `.dev.vars` (gitignored) rồi restart dev:

```text
ADMIN_TOKEN="YOUR_LONG_RANDOM_LOCAL_TOKEN"
```

Chọn **Mở quản trị**, nhập token. Token chỉ nằm trong bộ nhớ tab và Authorization header; không ghi localStorage, URL hay bundle. F5 khóa quyền quản trị lại, không reset thế giới. Production dùng secret Wrangler riêng; `.dev.vars` không cấu hình production.

```powershell
npm run typecheck
npm test
npm run build
```

Test gồm engine, workerd/SQLite integration và Chromium thật (desktop + 390px); không gọi production. Miniflare 5 dùng adapter chính thức `convertV4MiniflareOptions`. Dùng `npm ci` để cài đúng lockfile.

## Trạng thái, realtime và khôi phục

Mọi người được route đến `WORLD.idFromName('canonical-world-v1')`; không tạo world theo tab/session. Server sở hữu cells, food IDs, counters, death states, PRNG seed, simulation clock, revision, generation, pause/speed/rate và durable wall timestamp. Client chỉ vẽ snapshot, không tự tick hay thay đổi world.

Engine bước cố định 1/30 giây. Đồng hồ thực tiến theo quantum nguyên 100ms, mỗi quantum chạy đúng `3 × speed` bước, hoặc chỉ tiến timestamp khi pause. Phần dư dưới 100ms được giữ lại. Thao tác quản trị áp dụng tại ranh giới quantum hiện tại. Đồng hồ hệ thống đi lùi thì chờ timestamp đã lưu, không tua ngược/tick trùng.

Mỗi batch tối đa 100 quantum (10 giây thực), dừng sau quantum nếu ngân sách đo được đạt 8ms. Đây là giới hạn mềm, không ngắt quantum đang chạy. Snapshot và timestamp được ghi cùng record sau batch. `blockConcurrencyWhile` tuần tự hóa cả request, mutation và alarm qua await; alarm lặp lại/request đồng thời không tiến cùng khoảng thời gian hai lần. Revision tăng qua từng batch/điều khiển; generation chỉ tăng khi quản trị reset. Schema không hỗ trợ gây lỗi, không tự khởi tạo lại dữ liệu.

WebSocket dùng Hibernation API. Khi có người xem, alarm mỗi 500ms phát snapshot (~2Hz), tránh ghi 30 lần/giây. Không còn người xem và backlog đã hết thì dừng alarm. Kết nối lại sẽ chạy bù từng bước theo timestamp, không bỏ sự kiện hoặc cắt bỏ offline dài. Đây là **khôi phục logic**, không phải CPU thực thi từng giây khi object ngủ. Nghỉ nhiều ngày có thể cần nhiều batch; UI báo số giây thực còn phải khôi phục và quản trị nhận 409 cho đến khi bắt kịp. Restart tiếp tục từ batch đã commit, giữ thứ tự random transition. Persisted record tồn tại thì không tạo lại 100 tế bào.

Client nhận state ban đầu, bỏ revision cũ, reconnect backoff 0,5–30 giây kèm jitter và resync. Watchdog đóng socket không nhận snapshot trong 15 giây. Tối đa 100 socket/world. Socket chỉ nhận dữ liệu; gửi message sẽ bị đóng. Admin qua REST có token, payload <= 2KiB, validation và tối đa 1 mutation/250ms toàn world. Đây là giới hạn ứng dụng, không phải hệ thống chống DDoS.

## Cloudflare, endpoints và secrets

`wrangler.jsonc` khai báo Worker, binding WORLD và migration `v1/new_sqlite_classes`. Giữ nguyên Worker name, class, migration cũ và canonical ID khi cập nhật để giữ namespace/dữ liệu.

Frontend đọc public `window.CELLWORLD_API` từ `config.js`; build tạo file này từ biến môi trường `CELLWORLD_API` (HTTP/HTTPS origin, không secret). Nếu hosting chưa cấu hình thì trang báo thiếu backend, không âm thầm tạo mô phỏng local. Localhost mặc định cổng 8787. WebSocket đổi `https → wss`, path `/ws`; REST dùng `/api/state`, `/api/admin`.

`ALLOWED_ORIGINS` là danh sách origin chính xác phân cách dấu phẩy: mặc định `https://cellworld.pages.dev`, `http://127.0.0.1:5173`, `http://localhost:5173`. Không wildcard. Preview deployment URL phải được thêm chính xác nếu muốn sử dụng. Có thể bỏ localhost khỏi production. CORS hỗ trợ Authorization/Content-Type, `Vary: Origin`; state không cache. CLI không có Origin vẫn phải có token cho admin.

Sau khi đủ quyền và được phê duyệt thay đổi production, cấu hình secret:

```powershell
npx wrangler secret put ADMIN_TOKEN
```

Nhập token ngẫu nhiên dài ít nhất 32 byte. Không commit token, không đặt trong frontend, `deployment.local.json` hay `CELLWORLD_API`. Lệnh secret cũng thay đổi production, chỉ chạy trong đợt được phê duyệt.

## Deploy bằng PowerShell

Cùng kiểu workflow local như project `choicungnhau`, nhưng chỉ nhắm **Pages `cellworld`** và **Worker `cellworld-backend`**. Test/build/dev không deploy. Các npm deploy yêu cầu flag phê duyệt, thiếu flag sẽ dừng trước bước ghi tài nguyên.

1. `npx wrangler login` để đăng nhập/refresh quyền. Kiểm tra `npx wrangler whoami --json`, `npx wrangler pages project list --json`. Cần account read, Pages và Workers Scripts, bao gồm DO; không tự bật billing.
2. Copy `deployment.example.json` thành `deployment.local.json` (gitignored). Điền account ID đã xác minh và URL `https://cellworld-backend.<workers-subdomain-của-account>.workers.dev`. Xem subdomain tại Dashboard > Workers & Pages. Để `pagesId`/`backendTag` null cho tài nguyên mới.
3. Preflight đọc account, Pages projects, Workers scripts và account subdomain bằng API. Credential Wrangler chỉ ở bộ nhớ, không in/ghi file. Backend URL phải khớp subdomain account. Tài nguyên trùng tên nhưng không có ID/tag trùng file local sẽ bị chặn để tránh overwrite.

Chạy kiểm tra, không deploy:

```powershell
npm run deploy -- -Check
```

Sau khi người sở hữu phê duyệt đợt production, lần đầu:

```powershell
npm run deploy -- -ApproveProduction -CreateProject
```

Script kiểm tra account/identity, chạy typecheck/tests/build, tạo Pages project nếu được cho phép, deploy Worker + DO trước, xác nhận backend schema, rồi deploy frontend bằng `--project-name cellworld --branch main`. `--force` khi tạo Pages là opt-out của Wrangler khỏi chuyển sang Workers; lỗi quyền hoặc tên không khả dụng sẽ dừng, không chọn project khác. Danh sách project trong account không đủ chứng minh tên toàn cục còn trống, phải chờ tạo project thành công.

Những lần sau, hoặc deploy từng phần:

```powershell
npm run deploy -- -ApproveProduction
npm run deploy:backend -- -ApproveProduction
npm run deploy:frontend -- -ApproveProduction
```

Frontend-only vẫn preflight và kiểm tra backend. Script tự ghi project ID/Worker tag vào file local sau tạo/deploy thành công. Nếu bị ngắt trước khi ghi identity, kiểm tra Dashboard, source repository và lịch sử deployment trước khi điền đúng IDs; không nhận bừa một project trùng tên. Tài nguyên có từ trước cũng cần người sở hữu đối chiếu thủ công như vậy trước lần deploy đầu.

URL dự kiến **https://cellworld.pages.dev/** chỉ được xác nhận sau tạo/deploy thành công. Không sửa project `choicungnhau`, không thay tên nếu `cellworld` không dùng được.

## GitHub Pages

Có thể host `index.html`, `frontend.js`, `config.js` trực tiếp, hoặc phát hành `dist/` bằng GitHub Pages workflow. Với host trực tiếp, đặt Worker origin trong `config.js`; với build:

```powershell
$env:CELLWORLD_API='https://cellworld-backend.<subdomain>.workers.dev'
npm run build
```

Thêm origin `https://dangminhtai.github.io` vào ALLOWED_ORIGINS và deploy Worker sau phê duyệt. Asset dùng đường dẫn tương đối nên chạy dưới `/cellworld/`. Cloudflare Pages vẫn là hosting chính.

## Kiểm chứng F5 và nhiều trình duyệt

`npm test` mở hai Chromium page, quản trị test pause thế giới, so sánh cells/time, F5, reconnect và chọn tế bào ở viewport 390px. Integration tắt/tạo mới workerd cùng SQLite directory và so sánh state; seed timestamp offline một ngày qua RPC **chỉ có trong bundle test**, kiểm tra backlog và resume sau restart. RPC seed không có trong production.

Sau production deployment mới chạy kiểm tra chỉ đọc:

```powershell
npm run verify:production
```

Script mở đúng production URL, F5, kiểm tra generation/IDs giữ nguyên, simulation time/food counters không giảm, tế bào chết không hồi sinh; browser thứ hai có cùng generation/IDs và khách không thể reset. Recovery quá lâu hoặc admin reset đồng thời có thể khiến kiểm tra dừng. Khi cần so sánh state tuyệt đối, quản trị chủ động pause, thử hai browser/F5 rồi resume. Không reset production để thử persistence. Production F5 chưa được kiểm chứng trong lần triển khai code ban đầu vì chưa phê duyệt deploy.

## Quota, chi phí, phục hồi và rollback

SQLite DO hỗ trợ Free nhưng vẫn có quota request/CPU/storage. Alarm 2Hz liên tục tương đương khoảng 172.800 alarm/ngày, chưa tính HTTP/kết nối; không mặc định chạy 24/7 sẽ nằm trong Free quota. Paid có thể tính request, duration và SQLite; không tự đăng ký Paid. Đối chiếu [pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) và [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) trước production. Ngân sách 8ms là giới hạn mềm, không bảo đảm CPU Free. Snapshot JSON một record có chi phí ghi/băng thông; chưa có nội suy hình ảnh giữa snapshot. Chưa benchmark tải production hoặc catch-up nhiều tháng.

Nếu backend lỗi: giữ nguyên SQLite/namespace, xem `npx wrangler tail`, sửa và deploy cùng Worker identity. Không xóa DO, `storage.deleteAll` hoặc đổi canonical name để né lỗi. Batch đã commit giữ timestamp/PRNG; lần sau chỉ chạy phần còn lại. Nếu quota Free hết, đợi quota hoặc chủ sở hữu quyết định cấu hình/gói; không cắt bỏ backlog.

Rollback frontend trong Cloudflare Pages Dashboard về deployment đã xác nhận. Backend dùng Wrangler deployments list / rollback về version tương thích schema 1, sau phê duyệt. Rollback code không tua ngược state; code cũ phải đọc được schema hiện tại. Trước migration tương lai cần backup/restore/PITR phù hợp gói Cloudflare và thử riêng. Không sửa migration v1 hay xóa binding chứa dữ liệu. Mất file local thì đối chiếu/lấy lại đúng identity, không tạo project thay thế.
