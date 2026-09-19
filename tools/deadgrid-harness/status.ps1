[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$StateRoot = Join-Path $RepoRoot '.deadgrid'
$Project = Get-Content -Raw -LiteralPath (Join-Path $StateRoot 'project.json') | ConvertFrom-Json
$Task = Get-Content -Raw -LiteralPath (Join-Path $StateRoot 'task.json') | ConvertFrom-Json
$Last = Get-Content -Raw -LiteralPath (Join-Path $StateRoot 'last-session.json') | ConvertFrom-Json
$Qa = Get-Content -Raw -LiteralPath (Join-Path $StateRoot 'qa-state.json') | ConvertFrom-Json
try { $Gateway = Invoke-RestMethod -Uri "$($Project.gateway.baseUrl)/status" -TimeoutSec 3 }
catch { $Gateway = [pscustomobject]@{ status = 'offline'; backend_model = $null } }

[pscustomobject]@{
    Harness = 'DEADGRID'
    Gateway = $Gateway.status
    BackendModel = $Gateway.backend_model
    TaskStatus = $Task.status
    TaskMode = $Task.mode
    TaskGoal = $Task.goal
    LastSessionStatus = $Last.status
    LastChangedFiles = @($Last.changedFiles)
    PendingHumanQa = @($Qa.pendingHumanQa).Count
}
