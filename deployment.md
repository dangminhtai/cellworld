# Production CELLWORLD

## Hiện tại: không còn quản trị ứng dụng

Theo yêu cầu mới nhất, tất cả điều khiển công khai; không token, vai trò hoặc nút đăng nhập. Các mô tả hạn chế quyền ở các lần triển khai bên dưới là lịch sử.

Source daf8c18; Worker f6183144-f437-4a43-aa65-6e94c104940a; Pages https://62cd394a.cellworld.pages.dev ; production alias https://cellworld.pages.dev/ . Workflow preflight/typecheck/27 tests/build/deploy thành công, giữ nguyên SQLite/canonical ID/migrations. Live hai browser kiểm tra toàn bộ nút mở, pause đồng bộ, speed/rate + F5 PASS; reset chỉ kiểm thử local. Đã trả lại trạng thái chạy và các settings trước smoke; không reset thế giới production.

## Cho mọi người chỉnh tốc độ và thức ăn

Theo yêu cầu mới của người dùng: public speed 1×/5×/10× và food rate 0–200%, áp dụng cho world chung. Pause/step/reset/manual food vẫn admin-only. Backend và frontend source `44d8884` được deploy bằng workflow PowerShell đã xác minh identity; 28/28 tests PASS, typecheck/build PASS.

- Frontend: https://5bd1f4bf.cellworld.pages.dev ; production alias giữ nguyên.
- Worker version: 7d31ef80-c41c-4062-86e2-30d61cdf069e; giữ nguyên class, migrations và canonical ID.
- Probe đầu phát hiện DO active giữ code cũ, /api/controls trả 405. Áp dụng lại cùng version 100% bằng `wrangler versions deploy ... --durable-objects-code-update-mode immediate --yes`; không xóa storage. Cấu hình lần sau dùng immediate, xem [Cloudflare docs](https://developers.cloudflare.com/durable-objects/deployments/durable-objects-code-updates/).
- Sau đó live Chromium desktop/mobile PASS: khách không token chỉnh 10× và 200%, đồng bộ sang trang thứ hai, F5 giữ settings; pause/reset vẫn khóa. Settings test được khôi phục nếu chưa bị người khác đổi. Không reset world hoặc tạo food thủ công để thử.
- World generation vẫn 0, giữ 100 IDs, clock/counters không giảm qua cập nhật backend. Rate và speed vẫn được server validate và persist.

## Sửa chuyển động giật (frontend)

Frontend-only deployment: https://312a7b27.cellworld.pages.dev ; production alias vẫn https://cellworld.pages.dev/ . Source commit `2954363`. Đã chạy `npm.cmd run deploy:frontend -- -ApproveProduction` để khắc phục lỗi của đợt triển khai được người dùng phê duyệt; 26/26 tests, typecheck, build và preflight đều PASS. Không deploy lại backend, không sửa state hoặc schema.

Nguyên nhân được đo: bản trước Canvas chỉ vẽ khi nhận snapshot (~2Hz), nên giật dù snapshot đến đều khoảng 500ms. Bản mới nội suy vị trí đã nhận bằng requestAnimationFrame, không tự chạy simulation và không tăng nhịp ghi/broadcast server. Production probe sau sửa: ~55,27 draw/s (443 draw trong 8,015s), 15 snapshot, không long task/browser error. F5 và hai trang cùng world PASS lại. Xem QA.md cho số đo trước/sau và giới hạn.

## Triển khai đầu tiên

Người dùng đã phê duyệt deploy trong hội thoại. Kiểm tra Cloudflare trước deployment: đúng account đã đăng nhập, Pages chỉ có choicungnhau; Pages cellworld và Worker cellworld-backend đều chưa tồn tại. Project cellworld trong ảnh là Firebase, không phải Cloudflare Pages. Không thay đổi Firebase hoặc choicungnhau.

## Kết quả thực tế

- Production: https://cellworld.pages.dev/
- Pages deployment: https://21bb1541.cellworld.pages.dev
- Pages deployment ID: 21bb1541-ee56-4709-b00c-fe5d92487bff, environment Production, branch main.
- Backend: https://cellworld-backend.dmt826321.workers.dev
- Worker version: 7b917688-3c94-410e-b4e8-114feb6f7c8b.
- Source commit đã deploy: 75859bb trên feat/persistent-realtime-world. PR #1 vẫn chưa merge; branch main trong metadata Pages chọn production environment, không có thao tác merge Git.
- Pages ID và Worker tag đã ghi trong deployment.local.json (gitignored), dùng để chặn overwrite nhầm ở lần sau. Không commit credential.

Lệnh PowerShell thực tế:

```powershell
npm.cmd run deploy -- -ApproveProduction -CreateProject
```

Exit 0: preflight account/identity, typecheck, 21/21 automated tests và build PASS; tạo Pages đúng tên, deploy Worker + SQLite Durable Object trước, kiểm tra state schema, rồi deploy frontend. Không chọn tên thay thế. Wrangler cảnh báo bỏ qua wrangler.jsonc cho Pages vì đó là cấu hình riêng của Worker; Pages deploy dùng dist và project-name tường minh, đã hoàn thành.

## Kiểm chứng production

`npm run verify:production`: PASS trên URL production thật qua Chromium. F5 giữ generation/IDs, clock và food counters không giảm, dead cells không hồi sinh; trang thứ hai cùng generation/IDs; khách ở cả hai trang không thể reset.

Probe API thực tế: state HTTP 200, schema 1, 100 cell IDs, generation 0; public config đúng backend URL. Access-Control-Allow-Origin đúng https://cellworld.pages.dev; origin không liên quan trả 403. Admin không token trả 401. Không thực hiện reset/pause/thêm food trên production để thử.

Chưa cấu hình ADMIN_TOKEN: production mặc định chỉ xem, đúng chế độ an toàn. Nếu cần điều khiển thế giới, chủ sở hữu đặt secret bằng `npx wrangler secret put ADMIN_TOKEN`, rồi nhập token ở nút Mở quản trị. Không đặt token vào frontend. Chưa bật billing hoặc thay đổi gói Cloudflare.

SQLite restart và deterministic catch-up đã PASS trên workerd local; production chưa chủ động restart chỉ để thử và chưa benchmark quota/tải dài hạn. Xem README và QA.md để biết chính sách recovery, hạn mức và rollback.

Lần cập nhật sau không cần -CreateProject:

```powershell
npm.cmd run deploy -- -ApproveProduction
```

Mỗi đợt production mới vẫn cần phê duyệt của chủ sở hữu. Giữ nguyên Worker/class/canonical ID/migrations để bảo toàn state.
