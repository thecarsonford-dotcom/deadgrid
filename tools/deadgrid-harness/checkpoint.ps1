[CmdletBinding()]
param(
    [ValidateSet('typecheck', 'build', 'final', 'all')]
    [string]$Kind = 'final'
)

$ErrorActionPreference = 'Continue'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$CheckpointFile = Join-Path $RepoRoot '.deadgrid\checkpoints.json'
$Data = Get-Content -Raw -LiteralPath $CheckpointFile | ConvertFrom-Json
$IsFinal = $Kind -in @('final', 'all')
$Kinds = if ($IsFinal) { @('typecheck', 'build') } else { @($Kind) }
$Failed = $false
$Results = @{}

Push-Location $RepoRoot
try {
    foreach ($Check in $Kinds) {
        $Started = (Get-Date).ToUniversalTime().ToString('o')
        $Output = & npm.cmd run $Check 2>&1 | Out-String
        $ExitCode = $LASTEXITCODE
        $Run = [ordered]@{
            sessionId = 'manual'
            editCount = $null
            name = $Check
            command = "npm run $Check"
            startedAt = $Started
            finishedAt = (Get-Date).ToUniversalTime().ToString('o')
            passed = ($ExitCode -eq 0)
            exitCode = $ExitCode
            summary = $Output.Substring([Math]::Max(0, $Output.Length - 4000))
        }
        $Data.runs = @($Data.runs) + @($Run)
        if ($Data.runs.Count -gt 50) { $Data.runs = @($Data.runs | Select-Object -Last 50) }
        $Results[$Check] = $Run
        if ($ExitCode -ne 0) { $Failed = $true }
        $Suffix = if (-not $IsFinal) { ' (component only; final regression not evaluated)' } else { '' }
        Write-Host "$Check`: $(if ($ExitCode -eq 0) { 'PASS' } else { 'FAIL' })$Suffix" -ForegroundColor $(if ($ExitCode -eq 0) { 'Green' } else { 'Red' })
    }

    if ($IsFinal) {
        $TypecheckPassed = [bool]$Results.typecheck.passed
        $BuildPassed = [bool]$Results.build.passed
        $FinalPassed = $TypecheckPassed -and $BuildPassed
        $Regression = [ordered]@{
            evaluatedAt = (Get-Date).ToUniversalTime().ToString('o')
            passed = $FinalPassed
            requiredChecks = @('typecheck', 'build')
            typecheckPassed = $TypecheckPassed
            buildPassed = $BuildPassed
            reason = if ($FinalPassed) {
                'Typecheck and production build both passed.'
            } elseif (-not $TypecheckPassed -and $BuildPassed) {
                'Production build passed, but final regression failed because typecheck failed.'
            } elseif ($TypecheckPassed -and -not $BuildPassed) {
                'Typecheck passed, but final regression failed because the production build failed.'
            } else {
                'Final regression failed because typecheck and production build both failed.'
            }
        }
        $Data | Add-Member -NotePropertyName requirements -NotePropertyValue ([ordered]@{
            finalRegression = @('typecheck', 'build')
            passPolicy = 'all_required_checks_must_pass_for_the_same_edit_state'
            buildOnlyIsClean = $false
        }) -Force
        $Data | Add-Member -NotePropertyName lastRegression -NotePropertyValue $Regression -Force
        $Data.schemaVersion = 2
        $Failed = -not $FinalPassed
        Write-Host "final-regression: $(if ($FinalPassed) { 'PASS' } else { 'FAIL' }) — $($Regression.reason)" -ForegroundColor $(if ($FinalPassed) { 'Green' } else { 'Red' })
    }
}
finally {
    Pop-Location
    $Data | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $CheckpointFile -Encoding utf8
}
if ($Failed) { exit 1 }
