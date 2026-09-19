[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Goal,
    [ValidateSet('AUTO', 'LEVEL_DESIGN', 'GAMEPLAY', 'VIEWMODEL', 'NAVIGATION', 'VISUAL_POLISH', 'AUDIO', 'ASSETS', 'BUGFIX', 'RELEASE_QA', 'GENERAL')]
    [string]$Mode = 'AUTO'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$StateRoot = Join-Path $RepoRoot '.deadgrid'
$Policy = Get-Content -Raw -LiteralPath (Join-Path $StateRoot 'policy.json') | ConvertFrom-Json

if ($Mode -eq 'AUTO') {
    $LowerGoal = $Goal.ToLowerInvariant()
    $BestMode = 'GENERAL'
    $BestScore = 0
    foreach ($Property in $Policy.modes.PSObject.Properties) {
        $Score = 0
        foreach ($Keyword in @($Property.Value.keywords)) {
            if ($LowerGoal.Contains(([string]$Keyword).ToLowerInvariant())) { $Score++ }
        }
        if ($Score -gt $BestScore) {
            $BestMode = $Property.Name
            $BestScore = $Score
        }
    }
    $Mode = $BestMode
}

$ModePolicy = $Policy.modes.$Mode
$Task = [ordered]@{
    schemaVersion = 1
    status = 'active'
    mode = $Mode
    goal = $Goal
    allowedRead = @($ModePolicy.allowedRead)
    allowedEdit = @($ModePolicy.allowedEdit)
    budgets = $Policy.defaults
    humanQaRequired = [bool]$ModePolicy.humanQaRequired
    checkpoints = @('typecheck', 'build')
    sessionId = $null
    updatedAt = (Get-Date).ToUniversalTime().ToString('o')
}
$Task | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $StateRoot 'task.json') -Encoding utf8
$Task
