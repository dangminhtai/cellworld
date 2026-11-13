# Kết quả kiểm chứng CELLWORLD

Phạm vi: local Windows PowerShell, Node 22.16, Wrangler 4.161.0, workerd/Miniflare SQLite và Chromium. Không deploy production. Baseline: `d0d6f8e`.

Lượt kiểm tra cuối: `npm test` **21/21 PASS**, `npm run typecheck` PASS, `npm run build` PASS; Wrangler dry-run PASS. Implementation commit `3bcab2a`; PR: https://github.com/dangminhtai/cellworld/pull/1 (chưa merge).

| Hạng mục | Expected | Actual / bằng chứng | Kết quả |
|---|---|---|---|
| Luật sinh học | Giữ thuật toán và thứ tự random gốc | So toàn bộ engine sau 1.800 ticks với fixture gốc: cells/food/seed/clock/counters khớp | PASS |
| Ăn và chết | Một food chỉ ăn một lần; sống ở 100, chết ở 101; dead không di chuyển/ăn | Unit tests có cạnh tranh food giữa 2 cells, starvation/collision/aging | PASS |
| Persistence | Không reset qua F5/reconnect/restart | Chromium F5 và 2 page; tắt/tạo mới workerd cùng SQLite directory, đối chiếu cells/food/seed/time | PASS |
| Khôi phục | Giữ thứ tự sự kiện và không giấu backlog | Catch-up 180 giây qua JSON restore mỗi batch giống chạy liền; runtime seed offline một ngày, resume qua restart | PASS |
| Read-only và admin | Khách không reset, origin lạ bị chặn | Thực tế 401/403, CORS preflight, invalid action 400, rate limit 429, recovery chặn mutation 409 | PASS |
| UI | Hai trình duyệt quan sát cùng world, responsive và chọn cell | Chromium desktop + 390px; pause qua admin, F5 mất quyền admin nhưng giữ state, reconnect và pointer selection; không pageerror | PASS |
| Account Cloudflare | Xác minh đúng tài khoản và project | `wrangler whoami --json`: một account; `pages project list --json`: chỉ choicungnhau, chưa có cellworld | PASS (read-only) |
| Quyền backend | Có quyền đọc subdomain và quyền Workers trong OAuth | Ban đầu subdomain 403/code 10000; sau user cấp quyền qua wrangler login, OAuth có Workers scopes và subdomain lookup 200. Chưa thực hiện deploy để kiểm chứng quyền ghi | PASS (read-only/scopes); deployment NOT TESTED |
| Chống overwrite | Từ chối tên/identity/URL sai; cần approval; backend trước frontend | Tests pure target validator và static thứ tự script. Chạy `npm run deploy` không có file cấu hình: exit lỗi trước ghi tài nguyên | PASS trong phạm vi này |
| Typecheck/build | Không có lỗi | `npm run typecheck`, `npm run build`, `wrangler deploy --dry-run --outdir test-results/worker`, `node --check` | PASS |
| Production deployment | Chỉ sau phê duyệt; đúng cellworld | Không thực hiện. Chưa xác nhận tên Pages khả dụng toàn cục | NOT TESTED |
| Production F5 | Website thật không reset canonical state | Có script `npm run verify:production`, chưa chạy do chưa deploy/phê duyệt | NOT TESTED |
| Tải/quota dài hạn | Đáp ứng mức tải thực tế và gói Cloudflare | Chưa benchmark CPU/bandwidth trên cloud, chưa đo catch-up nhiều tháng | NOT TESTED |

Không còn lỗi chức năng đã biết sau các kiểm thử local. Những dòng PASS không mở rộng thành cam kết production. Guard PowerShell chưa thực hiện đường deploy có quyền thật; `--dry-run` chỉ chứng minh bundling/config hợp lệ.

Blocker quyền trước đó đã được xử lý bằng `npx wrangler login` theo yêu cầu người dùng. Account giữ nguyên; OAuth có Workers/Pages scopes và GET workers/subdomain trả 200. File deployment.local.json được tạo từ account/subdomain xác minh thật, không có secret và không commit. Vẫn cần phê duyệt production riêng trước khi tạo Pages/Worker; chưa chứng minh tên cellworld khả dụng toàn cục.

Phát hiện và sửa hướng dẫn PowerShell: `npm run deploy -- -Check` qua npm.ps1 đã làm mất switch; script vẫn chặn production do không có approval. Dùng `npm.cmd run deploy -- -Check` truyền switch đúng, hoặc gọi trực tiếp scripts/deploy.ps1. Không phát sinh ghi tài nguyên cloud trong quá trình kiểm tra.
