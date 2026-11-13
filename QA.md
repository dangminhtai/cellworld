# Kết quả kiểm chứng CELLWORLD

## Sửa giật chuyển động

P1: người dùng thấy tế bào giật. Tái hiện: mở production khi world chạy; Canvas chỉ vẽ lúc WebSocket gửi snapshot. Expected: chuyển động theo nhịp màn hình, server vẫn ~2 snapshot/s. Actual trước sửa: 16 lần vẽ / 16 snapshot trong 8,02 giây (~1,995 draw/s); khoảng cách snapshot median 500,1ms/max 505,9ms; ~39,6KB/s; không long task hoặc browser error trong probe.

Fix: render-state.js giữ bản sao trình bày, nội suy các vị trí đã nhận, requestAnimationFrame vẽ độc lập mạng. Không extrapolate/tự tick; giữ nguyên backend, database và luật. Pause/reset/recovery snap ngay, dead không hồi sinh, revision cũ bị bỏ, chọn theo vị trí đang vẽ, tab ẩn hoặc vị trí không đổi không duy trì loop.

PASS local: 26/26 automated tests, typecheck và build. Browser test xác nhận >20 lần vẽ trong 1,2 giây khi vẫn nhận snapshot ~2Hz; F5/shared-world/reconnect/admin vẫn PASS. Cùng backend production, frontend local sau sửa đo 452 draw / 16 snapshot trong 8,01 giây (~56,4 draw/s), median gap 501,1ms/max 506,6ms, không long task/browser error. Đây là draw cadence trên Chromium headless, không phải benchmark mọi thiết bị/GPU hoặc database. Probe chỉ đọc, không gửi admin actions. Script tái lập: node scripts/profile-render.mjs; PROFILE_URL chọn frontend, PROFILE_BACKEND tùy chọn cấu hình Worker cho frontend local.

PASS production sau frontend-only deployment `312a7b27` (source `2954363`): 443 draw / 15 snapshot trong 8,015 giây (~55,27 draw/s), median snapshot gap 501,4ms/max 669,2ms, ~37,5KB/s, 0 long tasks và 0 browser errors. `npm run verify:production` PASS lại: F5/shared canonical world/read-only controls. Không thay đổi/deploy lại Worker hoặc database. Lượt đo 8 giây xác nhận xử lý nguyên nhân vẽ 2Hz, không phải cam kết FPS trên mọi thiết bị hoặc mạng.

## Triển khai ban đầu

Phạm vi: Windows PowerShell, Node 22.16, Wrangler 4.161.0, workerd/Miniflare SQLite và Chromium; bổ sung deployment và smoke production sau khi người dùng phê duyệt. Baseline: `d0d6f8e`.

Lượt kiểm tra cuối: `npm test` **21/21 PASS**, `npm run typecheck` PASS, `npm run build` PASS; Wrangler dry-run PASS. Implementation commit `3bcab2a`; PR: https://github.com/dangminhtai/cellworld/pull/1 (chưa merge).

| Hạng mục | Expected | Actual / bằng chứng | Kết quả |
|---|---|---|---|
| Luật sinh học | Giữ thuật toán và thứ tự random gốc | So toàn bộ engine sau 1.800 ticks với fixture gốc: cells/food/seed/clock/counters khớp | PASS |
| Ăn và chết | Một food chỉ ăn một lần; sống ở 100, chết ở 101; dead không di chuyển/ăn | Unit tests có cạnh tranh food giữa 2 cells, starvation/collision/aging | PASS |
| Persistence | Không reset qua F5/reconnect/restart | Chromium F5 và 2 page; tắt/tạo mới workerd cùng SQLite directory, đối chiếu cells/food/seed/time | PASS |
| Khôi phục | Giữ thứ tự sự kiện và không giấu backlog | Catch-up 180 giây qua JSON restore mỗi batch giống chạy liền; runtime seed offline một ngày, resume qua restart | PASS |
| Read-only và admin | Khách không reset, origin lạ bị chặn | Thực tế 401/403, CORS preflight, invalid action 400, rate limit 429, recovery chặn mutation 409 | PASS |
| UI | Hai trình duyệt quan sát cùng world, responsive và chọn cell | Chromium desktop + 390px; pause qua admin, F5 mất quyền admin nhưng giữ state, reconnect và pointer selection; không pageerror | PASS |
| Account Cloudflare | Xác minh đúng tài khoản và project | Account giữ nguyên sau login; trước deploy chỉ có choicungnhau, chưa có cellworld. Preflight xác nhận cả hai đích chưa tồn tại; tạo đúng cellworld sau phê duyệt | PASS |
| Quyền backend | Có quyền đọc subdomain và deploy Worker | Ban đầu subdomain 403/code 10000; sau login có Workers scopes, lookup 200 và deploy Worker + SQLite DO thành công | PASS |
| Chống overwrite | Từ chối tên/identity/URL sai; cần approval; backend trước frontend | Tests pure target validator và static thứ tự script. Chạy `npm run deploy` không có file cấu hình: exit lỗi trước ghi tài nguyên | PASS trong phạm vi này |
| Typecheck/build | Không có lỗi | `npm run typecheck`, `npm run build`, `wrangler deploy --dry-run --outdir test-results/worker`, `node --check` | PASS |
| Production deployment | Chỉ sau phê duyệt; đúng cellworld | npm.cmd run deploy -- -ApproveProduction -CreateProject: exit 0; Pages Production/main deployment 21bb1541, Worker version 7b917688-3c94-410e-b4e8-114feb6f7c8b | PASS |
| Production F5 | Website thật không reset canonical state | npm run verify:production: PASS trên cellworld.pages.dev; giữ generation/IDs, time/counters không giảm, dead không hồi sinh; trang thứ hai cùng generation/IDs, cả hai khóa reset | PASS |
| Production API/CORS | Endpoint đúng, khách không quản trị, chặn origin khác | config.js đúng Worker origin; GET state 200/schema 1/100 cells/generation 0; CORS đúng origin Pages; origin lạ 403; GET admin không token 401 | PASS |
| Tải/quota dài hạn | Đáp ứng mức tải thực tế và gói Cloudflare | Chưa benchmark CPU/bandwidth trên cloud, chưa đo catch-up nhiều tháng | NOT TESTED |

Không còn lỗi chức năng đã biết trong phạm vi đã kiểm tra. Production F5 không đồng nghĩa đã benchmark tải hoặc kiểm tra mọi failure mode cloud. SQLite restart/recovery đã kiểm thử trên workerd local; chưa chủ động restart/redeploy production chỉ để thử.

Blocker quyền trước đó đã được xử lý bằng `npx wrangler login` theo yêu cầu người dùng. File deployment.local.json chứa identity và public URL đã xác minh, gitignored, không có secret. Sau đó người dùng phê duyệt production rõ ràng, tạo Pages cellworld và Worker thành công. Project trong ảnh người dùng là Firebase cellworld; deployment này không dùng hoặc sửa Firebase.

Phát hiện và sửa hướng dẫn PowerShell: `npm run deploy -- -Check` qua npm.ps1 đã làm mất switch; script vẫn chặn production do không có approval. Dùng `npm.cmd run deploy -- -Check` truyền switch đúng, hoặc gọi trực tiếp scripts/deploy.ps1. Không phát sinh ghi tài nguyên cloud trong quá trình kiểm tra.
