<#
  Copy the install files into the public release repo checkout (KisaesDevLab/vibe-tb-releases).

  The source repo is private; users and the Windows installer docs fetch the compose file and env
  template from the public repo instead. Only the allowlist below is ever copied, and the target's
  own .gitignore (release-repo/.gitignore) refuses anything else.

    pwsh scripts/publish-release-files.ps1 -DryRun            # show what would change
    pwsh scripts/publish-release-files.ps1                    # copy + commit in the target
    pwsh scripts/publish-release-files.ps1 -Push              # ...and push it

  -Target defaults to C:\Projects\vibe-tb-releases. The script never creates a GitHub repo or
  changes visibility (owner steps, docs/PRIVATE-REPO-CUTOVER.md).
#>
param(
  [string]$Target = 'C:\Projects\vibe-tb-releases',
  [switch]$DryRun,
  [switch]$Push
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# published name => source path in this repo
$files = [ordered]@{
  '.gitignore'                 = 'release-repo/.gitignore'
  'README.md'                  = 'release-repo/README.md'
  'LICENSE'                    = 'LICENSE'
  'NOTICE'                     = 'NOTICE'
  'docker-compose.prod.yml'    = 'docker-compose.prod.yml'
  'docker-compose.grouped.yml' = 'docker-compose.grouped.yml'
  '.env.example'               = '.env.example'
}

function Stop-WithMessage([string]$msg) { Write-Host "[x] $msg" -ForegroundColor Red; exit 1 }

foreach ($src in $files.Values) {
  if (-not (Test-Path (Join-Path $root $src))) { Stop-WithMessage "missing source file: $src" }
}

$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$commit = (git -C $root rev-parse --short HEAD).Trim()

$isRepo = Test-Path (Join-Path $Target '.git')
if (-not $DryRun) {
  if (-not (Test-Path $Target)) { New-Item -ItemType Directory -Path $Target | Out-Null }
  if (-not $isRepo) { git -C $Target init -b main | Out-Null; $isRepo = $true }
  if ((git -C $Target status --porcelain)) { Stop-WithMessage "$Target has uncommitted changes; commit or discard them first" }
} elseif ($isRepo -and (git -C $Target status --porcelain)) {
  Write-Host "[!] $Target has uncommitted changes; a real run would stop here" -ForegroundColor Yellow
}

$changed = @()
foreach ($name in $files.Keys) {
  $src = Join-Path $root $files[$name]
  $dst = Join-Path $Target $name
  $same = (Test-Path $dst) -and ((Get-FileHash $src).Hash -eq (Get-FileHash $dst).Hash)
  if ($same) { Write-Host "    unchanged  $name"; continue }
  Write-Host "    update     $name  <=  $($files[$name])"
  $changed += $name
  if (-not $DryRun) { Copy-Item $src $dst -Force }
}

# Nothing outside the allowlist may be tracked there.
if ($isRepo -and (Test-Path $Target)) {
  $tracked = @(git -C $Target ls-files)
  $extra = $tracked | Where-Object { -not $files.Contains($_) }
  if ($extra) { Stop-WithMessage "target tracks files outside the allowlist: $($extra -join ', ')" }
}

if (-not $changed) { Write-Host '[ok] release repo already up to date'; exit 0 }

$msg = "Install files from Vibe Trial Balance $version ($commit)"
$cmds = @(
  "git -C `"$Target`" add -- $($changed -join ' ')",
  "git -C `"$Target`" commit -m `"$msg`""
)
if ($Push) { $cmds += "git -C `"$Target`" push origin main" }

if ($DryRun) {
  Write-Host "`n[dry run] would run:"; $cmds | ForEach-Object { Write-Host "    $_" }
  exit 0
}
git -C $Target add -- @changed
git -C $Target commit -m $msg | Out-Null
Write-Host "[ok] committed in $Target : $msg"
if ($Push) {
  if (-not (git -C $Target remote)) { Stop-WithMessage "no remote in $Target; add origin (https://github.com/KisaesDevLab/vibe-tb-releases.git) first" }
  git -C $Target push origin main
  Write-Host '[ok] pushed'
} else {
  Write-Host "    push with: git -C `"$Target`" push origin main"
}
