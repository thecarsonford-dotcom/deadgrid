[CmdletBinding()]
param(
    [string]$Model,
    [switch]$SkipWarmup
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Project = Get-Content -Raw -LiteralPath (Join-Path $RepoRoot '.deadgrid\project.json') | ConvertFrom-Json
$BaseUrl = if ($env:DEADGRID_QWEN_URL) { $env:DEADGRID_QWEN_URL.TrimEnd('/') } else { [string]$Project.gateway.baseUrl }
if (-not $Model) { $Model = if ($env:DEADGRID_MODEL) { $env:DEADGRID_MODEL } else { [string]$Project.gateway.defaultModel } }
$TimeoutSeconds = [int]$Project.gateway.startupTimeoutSeconds
$RouterScript = if ($env:DEADGRID_ROUTER_SCRIPT) { $env:DEADGRID_ROUTER_SCRIPT } else { [string]$Project.gateway.routerScript }
$Pythonw = if ($env:DEADGRID_PYTHON) { $env:DEADGRID_PYTHON } else { [string]$Project.gateway.pythonw }

function Get-DeadgridGatewayHealth {
    try {
        Invoke-RestMethod -Uri "$BaseUrl/v1/models" -TimeoutSec 2 | Out-Null
        $true
    }
    catch {
        $false
    }
}

if (-not (Get-DeadgridGatewayHealth)) {
    if (-not $RouterScript -or -not $Pythonw) {
        throw "No local model server is reachable at $BaseUrl. Start an OpenAI-compatible local server, or set DEADGRID_ROUTER_SCRIPT and DEADGRID_PYTHON so this launcher can start yours."
    }
    foreach ($Required in @($RouterScript, $Pythonw)) {
        if (-not (Test-Path -LiteralPath $Required -PathType Leaf)) { throw "Required local-model component is missing: $Required" }
    }

    Write-Host "Starting the DEADGRID Qwen gateway..." -ForegroundColor Cyan
    Start-Process -FilePath $Pythonw -ArgumentList @($RouterScript) -WorkingDirectory (Split-Path $RouterScript) -WindowStyle Hidden | Out-Null
    $Deadline = (Get-Date).AddSeconds([Math]::Min($TimeoutSeconds, 90))
    do {
        Start-Sleep -Milliseconds 250
        $Health = Get-DeadgridGatewayHealth
    } while (-not $Health -and (Get-Date) -lt $Deadline)
    if (-not $Health) { throw "The Qwen gateway did not become ready at $BaseUrl." }
}

$Catalog = Invoke-RestMethod -Uri "$BaseUrl/v1/models" -TimeoutSec 5
$Available = @($Catalog.data | ForEach-Object { $_.id })
if ($Model -notin $Available) {
    throw "The required model '$Model' is not advertised by the gateway. Available: $($Available -join ', ')"
}

if (-not $SkipWarmup) {
    Write-Host "Loading $Model for DEADGRID (this can take a few minutes after a cold start)..." -ForegroundColor Cyan
    $Body = @{
        model = $Model
        messages = @(@{ role = 'user'; content = 'Reply with only READY' })
        max_tokens = 2
        temperature = 0
        stream = $false
    } | ConvertTo-Json -Depth 8
    Invoke-RestMethod -Uri "$BaseUrl/v1/chat/completions" -Method Post -ContentType 'application/json' -Body $Body -TimeoutSec $TimeoutSeconds | Out-Null
}

[pscustomobject]@{
    Gateway = 'ready'
    Endpoint = $BaseUrl
    Model = $Model
    Backend = $Model
}
