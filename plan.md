# CELLWORLD implementation log

## Public speed and food-rate controls

- [x] User requested anyone may use up to 10x speed and the food-spawn slider. These change the shared world; pause/step/reset/manual food stay admin-only.
- [x] Add an allowlisted public endpoint with existing server validation, independent mutation rate limit and shared persistence/broadcast. Unlock only speed and rate controls in the frontend.
- [x] Verify public changes across browsers/reload/restart, forbidden actions, invalid values and rate limits. Found transient 409 at 10x: mutation rechecked a newer timestamp after storage I/O. Compare against the fixed cycle-entry timestamp; retain bounded client retries for genuine 409/429, superseded by newer intent. Keep bounded catch-up and deterministic quanta unchanged.
- [x] Deploy source 44d8884 backend then frontend to verified existing targets: Worker 7d31ef80-c41c-4062-86e2-30d61cdf069e, Pages https://5bd1f4bf.cellworld.pages.dev .
- [x] Production probe initially returned 405 because the active DO retained old code under Cloudflare's deferred update default. Reapplied the same version at 100% with immediate mode; configured immediate strategy for future deploys, without changing storage identity.
- [x] Live Chromium desktop/mobile: public 10x and 200% controls synced to both pages, persisted through F5; pause/reset stayed locked. Restored prior speed/rate after the live check; no reset or manual food action sent.

## Rendering performance follow-up

- [x] Profile production read-only for 8 seconds: 16 draws / 16 snapshots (1.995 draws/s), median snapshot gap 500.1ms, maximum 505.9ms, ~39.6KB/s, no long tasks, 100 alive cells. Canvas only drew on WebSocket messages.
- [x] Implement client-only interpolation + requestAnimationFrame; preserve all authoritative rules/state. Pause/reset/recovery snap; stop frame loop when settled or hidden.
- [x] Verify rendering, immutable authoritative state, F5/shared state, typecheck and build: 26/26 tests PASS. Local frontend + the same production backend produced 452 draws / 16 snapshots in 8.01s (~56.4 draws/s), no long tasks or browser errors.
- [x] Commit/push 2954363 and deploy frontend-only remediation within the user-approved CELLWORLD deployment scope: https://312a7b27.cellworld.pages.dev . Worker/database/canonical world unchanged.
- [x] Production follow-up: 443 draws / 15 snapshots in 8.015s (~55.27 draws/s), median snapshot gap 501.4ms, no long tasks/browser errors. Production F5/shared-world verification PASS again.

## Initial implementation

- [x] Inspect clean main, original simulation and adjacent choicungnhau workflow.
- [x] Create feat/persistent-realtime-world.
- [x] Extract deterministic rules; implement canonical durable state and authenticated actions.
- [x] Connect existing canvas UI; implement local dev and guarded PowerShell deployment.
- [x] Run rules, persistence, realtime, security, typecheck and build checks (see QA.md).
- [x] Document Windows deployment, recovery, limits and evidence.
- [x] Commit implementation (3bcab2a), push feature branch and open https://github.com/dangminhtai/cellworld/pull/1 against main. Not merged.
- Final local validation: 21/21 automated checks PASS; typecheck, frontend build and Wrangler dry-run PASS. npm run dev served frontend + backend successfully.
- [x] User explicitly approved production deployment. Rechecked the account: cellworld existed in Firebase only; Cloudflare target names were absent, then created exactly cellworld on Pages.
- [x] Deploy Worker + SQLite DO, then frontend using npm.cmd run deploy -- -ApproveProduction -CreateProject. Script exited 0.
- [x] Verify production F5 and two-browser read-only shared state with npm run verify:production (PASS); verify CORS, denied origin and unauthorized admin.
- Production: https://cellworld.pages.dev/ ; deployment https://21bb1541.cellworld.pages.dev ; backend https://cellworld-backend.dmt826321.workers.dev . Source commit 75859bb. See deployment.md.
- HISTORICAL blocker: OAuth missing Workers scopes; workers/subdomain returned 403, code 10000. Resolved after user-authorized wrangler login; new OAuth has Workers + Pages scopes, subdomain lookup returned 200.
- Prepared gitignored deployment.local.json using verified account/subdomain; recorded created Pages ID and Worker tag after successful deployment. No changes made to choicungnhau or Firebase.
- Corrected PowerShell argument forwarding documentation: use npm.cmd for deploy switches because npm.ps1 dropped -Check in this environment.
