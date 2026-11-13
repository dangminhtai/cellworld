# CELLWORLD implementation log

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
