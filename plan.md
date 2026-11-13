# CELLWORLD implementation log

- [x] Inspect clean main, original simulation and adjacent choicungnhau workflow.
- [x] Create feat/persistent-realtime-world.
- [x] Extract deterministic rules; implement canonical durable state and authenticated actions.
- [x] Connect existing canvas UI; implement local dev and guarded PowerShell deployment.
- [x] Run rules, persistence, realtime, security, typecheck and build checks (see QA.md).
- [x] Document Windows deployment, recovery, limits and evidence.
- [x] Commit implementation (3bcab2a), push feature branch and open https://github.com/dangminhtai/cellworld/pull/1 against main. Not merged.
- Final local validation: 21/21 automated checks PASS; typecheck, frontend build and Wrangler dry-run PASS. npm run dev served frontend + backend successfully.
- Production deployment and production F5 verification: NOT TESTED; explicit approval required.
- Cloudflare read-only check: account verified; Pages list contains choicungnhau, not cellworld. Global name availability not verified by creation.
- HISTORICAL blocker: OAuth missing Workers scopes; workers/subdomain returned 403, code 10000. Resolved after user-authorized wrangler login; new OAuth has Workers + Pages scopes, subdomain lookup returned 200.
- Prepared gitignored deployment.local.json using verified account/subdomain. Read-only preflight confirms target names are absent in this account. No production resources changed; production approval remains pending.
- Corrected PowerShell argument forwarding documentation: use npm.cmd for deploy switches because npm.ps1 dropped -Check in this environment.
