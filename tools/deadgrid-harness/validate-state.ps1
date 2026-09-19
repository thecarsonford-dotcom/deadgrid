[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$StateRoot = Join-Path $RepoRoot '.deadgrid'
$Required = @(
    'project.json',
    'architecture.json',
    'locks.json',
    'campaign.json',
    'known-issues.json',
    'policy.json'
)

foreach ($Name in $Required) {
    $Path = Join-Path $StateRoot $Name
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing DEADGRID state file: $Path" }
    try { Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json | Out-Null }
    catch { throw "Invalid JSON in $Path`: $($_.Exception.Message)" }
}

$DynamicDefaults = @{
    'checkpoints.json' = [ordered]@{ schemaVersion = 2; runs = @() }
    'last-session.json' = [ordered]@{ schemaVersion = 1; status = 'new'; changedFiles = @() }
    'qa-state.json' = [ordered]@{ schemaVersion = 1; pendingHumanQa = @(); completedHumanQa = @() }
    'task.json' = [ordered]@{ schemaVersion = 1; status = 'idle'; mode = 'GENERAL'; goal = ''; allowedRead = @(); allowedEdit = @(); budgets = @{}; humanQaRequired = $false; checkpoints = @('typecheck', 'build'); sessionId = $null }
}
foreach ($Entry in $DynamicDefaults.GetEnumerator()) {
    $Path = Join-Path $StateRoot $Entry.Key
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        $Entry.Value | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $Path -Encoding utf8
    }
}

$Policy = Get-Content -Raw -LiteralPath (Join-Path $StateRoot 'policy.json') | ConvertFrom-Json
foreach ($Mode in $Policy.modes.PSObject.Properties) {
    if (-not $Mode.Value.allowedRead -or -not $Mode.Value.allowedEdit) {
        throw "Mode $($Mode.Name) must define non-empty read and edit allowlists."
    }
}

[pscustomobject]@{
    Valid = $true
    Project = 'DEADGRID'
    Modes = @($Policy.modes.PSObject.Properties.Name)
}
