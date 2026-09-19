[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$OpenCodeArgs
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Project = Get-Content -Raw -LiteralPath (Join-Path $RepoRoot '.deadgrid\project.json') | ConvertFrom-Json

& (Join-Path $PSScriptRoot 'validate-state.ps1') | Out-Null
$RequestedModel = if ($env:DEADGRID_MODEL) { $env:DEADGRID_MODEL } else { [string]$Project.gateway.defaultModel }
$Ready = & (Join-Path $PSScriptRoot 'ensure-qwen.ps1') -Model $RequestedModel
Write-Host "DEADGRID harness ready: $($Ready.Model) at $($Ready.Endpoint)" -ForegroundColor Green

$RealOpenCode = $env:DEADGRID_REAL_OPENCODE
if (-not $RealOpenCode) {
    $OpenCodeCommand = Get-Command opencode -ErrorAction SilentlyContinue
    if ($OpenCodeCommand) { $RealOpenCode = $OpenCodeCommand.Source }
}
if (-not $RealOpenCode -or -not (Test-Path -LiteralPath $RealOpenCode -PathType Leaf)) {
    throw 'OpenCode was not found. Install it or set DEADGRID_REAL_OPENCODE to the executable path.'
}

$ProjectConfigHome = Join-Path $RepoRoot '.deadgrid\xdg-config'
$ProjectDataHome = Join-Path $RepoRoot '.deadgrid\xdg-data'
$ProjectCacheHome = Join-Path $RepoRoot '.deadgrid\xdg-cache'
$ProjectStateHome = Join-Path $RepoRoot '.deadgrid\xdg-state'
foreach ($Directory in @($ProjectConfigHome, $ProjectDataHome, $ProjectCacheHome, $ProjectStateHome)) {
    New-Item -ItemType Directory -Force -Path $Directory | Out-Null
}
$env:XDG_CONFIG_HOME = $ProjectConfigHome
$env:XDG_DATA_HOME = $ProjectDataHome
$env:XDG_CACHE_HOME = $ProjectCacheHome
$env:XDG_STATE_HOME = $ProjectStateHome
$ProjectTuiConfig = Join-Path $RepoRoot 'tui.json'
if (-not (Test-Path -LiteralPath $ProjectTuiConfig -PathType Leaf)) {
    throw "The DEADGRID TUI config is missing: $ProjectTuiConfig"
}
$env:OPENCODE_TUI_CONFIG = $ProjectTuiConfig
$env:DEADGRID_HARNESS = '1'
$env:DEADGRID_ROOT = $RepoRoot
Push-Location $RepoRoot
try {
    & $RealOpenCode @OpenCodeArgs
    $ExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}
exit $ExitCode
