# Local PowerShell workflow; no deployment without explicit -ApproveProduction.
param(
  [ValidateSet('all','backend','frontend')][string]$Component='all',
  [switch]$ApproveProduction,
  [switch]$CreateProject,
  [switch]$Check
)
$ErrorActionPreference='Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  if (-not (Test-Path -LiteralPath 'deployment.local.json')) { throw 'Copy deployment.example.json to deployment.local.json and configure the verified account and Worker URL.' }
  $config=Get-Content -Raw -LiteralPath 'deployment.local.json' | ConvertFrom-Json
  $env:CLOUDFLARE_ACCOUNT_ID=$config.accountId
  $preflight=node scripts/cloudflare-check.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Cloudflare preflight failed; no resources changed.' }
  $target=$preflight | ConvertFrom-Json
  Write-Host "Verified account $($target.accountId); Pages cellworld; Worker cellworld-backend"
  $workerConfig=Get-Content -Raw -LiteralPath 'wrangler.jsonc' | ConvertFrom-Json
  if ($workerConfig.name -ne 'cellworld-backend') { throw 'Unexpected Worker name' }
  if (-not ($workerConfig.vars.ALLOWED_ORIGINS.Split(',') -contains 'https://cellworld.pages.dev')) { throw 'Missing production origin in CORS' }
  npm run typecheck
  if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed' }
  npm test
  if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
  $env:CELLWORLD_API=$target.backendUrl
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
  if ($Check) { Write-Host 'Checks complete; no deployment.'; return }
  if (-not $ApproveProduction) { throw 'Production not approved. Review the target, then pass -ApproveProduction explicitly (npm run deploy -- -ApproveProduction).' }
  if (-not $target.pagesExists) {
    if (-not $CreateProject) { throw 'cellworld does not exist. Pass -CreateProject explicitly after review.' }
    npx wrangler pages project create cellworld --production-branch main --force
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create cellworld (name unavailable or insufficient permissions). No alternative project chosen.' }
    node scripts/cloudflare-check.mjs --record
    if ($LASTEXITCODE -ne 0) { throw 'Unable to record newly created project identity' }
  }
  if ($Component -in @('all','backend')) {
    npx wrangler deploy --config wrangler.jsonc
    if ($LASTEXITCODE -ne 0) { throw 'Backend deployment failed; frontend not deployed.' }
    node scripts/cloudflare-check.mjs --record
    if ($LASTEXITCODE -ne 0) { throw 'Unable to record Worker identity' }
  }
  if ($Component -in @('all','frontend')) {
    $health=Invoke-RestMethod -Uri "$($target.backendUrl)/api/state"
    if ($health.world.schema -ne 1) { throw 'Backend not ready; frontend not deployed.' }
    npx wrangler pages deploy dist --project-name cellworld --branch main
    if ($LASTEXITCODE -ne 0) { throw 'Frontend deployment failed' }
  }
} finally { Pop-Location }
