[CmdletBinding()]
param(
    [string]$Summary = 'Manual handoff requested.'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$StateRoot = Join-Path $RepoRoot '.deadgrid'
$Task = Get-Content -Raw -LiteralPath (Join-Path $StateRoot 'task.json') | ConvertFrom-Json
$Last = Get-Content -Raw -LiteralPath (Join-Path $StateRoot 'last-session.json') | ConvertFrom-Json
$Last.status = 'manual_handoff'
$Last.updatedAt = (Get-Date).ToUniversalTime().ToString('o')
$Last.mode = $Task.mode
$Last.goal = $Task.goal
$Last | Add-Member -NotePropertyName summary -NotePropertyValue $Summary -Force
$Last | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $StateRoot 'last-session.json') -Encoding utf8
$Last
