param(
  [string]$KitRoot = "."
)

$ErrorActionPreference = "Stop"

$requiredFiles = @(
  (Join-Path $KitRoot 'src\SKILL.md'),
  (Join-Path $KitRoot 'src\implementation-guide.md'),
  (Join-Path $KitRoot 'src\distinct-positioning.md'),
  (Join-Path $KitRoot 'src\HEARTBEAT.md'),
  (Join-Path $KitRoot 'src\MEMORY.md'),
  (Join-Path $KitRoot 'src\heartbeat-state.json'),
  (Join-Path $KitRoot 'src\clove-profile.md')
)

foreach ($file in $requiredFiles) {
  if (-not (Test-Path $file)) {
    Write-Output "MISSING_FILE: $file"
    exit 1
  }
}

$kitPath = Join-Path $KitRoot 'kit.md'
if (-not (Test-Path $kitPath)) {
  Write-Output 'MISSING_FILE: kit.md'
  exit 1
}

$content = Get-Content $kitPath -Raw
$sections = @(
  '## Goal',
  '## When to Use',
  '## Setup',
  '## Steps',
  '## Constraints',
  '## Safety Notes'
)
foreach ($section in $sections) {
  if ($content -notmatch [regex]::Escape($section)) {
    Write-Output "MISSING_SECTION: $section"
    exit 1
  }
}

if ($content -notmatch 'schema:\s*kit/1\.0') {
  Write-Output 'MISSING_OR_INVALID_SCHEMA'
  exit 1
}

Write-Output 'VALID'
