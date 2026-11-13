# Production CELLWORLD

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
