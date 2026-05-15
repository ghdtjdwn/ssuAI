# spike-ssotoken-ttl.ps1
#
# Measures how long an oasis.ssu.ac.kr ssotoken cookie stays valid by polling
# /pyxis-api/api/smuf/reading-rooms at a fixed interval until it returns the
# `needLogin` auth error.
#
# Usage (PowerShell):
#   $env:OASIS_SSOTOKEN = "<paste captured ssotoken value here>"
#   .\scripts\spike-ssotoken-ttl.ps1
#
# Optional:
#   $env:OASIS_TTL_INTERVAL_SEC = "300"   # default 300s (5 min)
#   $env:OASIS_TTL_LOG = "scripts/ssotoken-ttl.log"  # default same
#
# Output: per-poll line to console + log file. On expiry, prints duration and exits.
# The log file matches *.log so it is gitignored.

if (-not $env:OASIS_SSOTOKEN) {
    Write-Error "OASIS_SSOTOKEN env var is required. Capture it from devtools on oasis.ssu.ac.kr after logging in."
    exit 1
}

$intervalSec = if ($env:OASIS_TTL_INTERVAL_SEC) { [int]$env:OASIS_TTL_INTERVAL_SEC } else { 300 }
$logPath = if ($env:OASIS_TTL_LOG) { $env:OASIS_TTL_LOG } else { "scripts/ssotoken-ttl.log" }
$url = "https://oasis.ssu.ac.kr/pyxis-api/api/smuf/reading-rooms"

# Don't echo the token; only its fingerprint.
$tokenBytes = [System.Text.Encoding]::UTF8.GetBytes($env:OASIS_SSOTOKEN)
$sha = [System.Security.Cryptography.SHA256]::Create()
$fingerprint = ([System.BitConverter]::ToString($sha.ComputeHash($tokenBytes)) -replace '-','').Substring(0,8).ToLower()

$startedAt = Get-Date
$startedLine = "started=$($startedAt.ToString('o')) fingerprint=$fingerprint interval=${intervalSec}s url=$url"
Write-Host $startedLine
Add-Content -Path $logPath -Value $startedLine

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$cookie = New-Object System.Net.Cookie
$cookie.Name = "ssotoken"
$cookie.Value = $env:OASIS_SSOTOKEN
$cookie.Domain = "oasis.ssu.ac.kr"
$cookie.Path = "/"
$session.Cookies.Add($cookie)

$pollCount = 0
while ($true) {
    $pollCount++
    $now = Get-Date
    $ts = $now.ToString('o')
    try {
        $resp = Invoke-WebRequest -Uri $url -WebSession $session -UseBasicParsing -ErrorAction Stop
        $body = $resp.Content
        if ($body -match 'needLogin') {
            $elapsed = [int]($now - $startedAt).TotalSeconds
            $line = "$ts poll=$pollCount status=expired elapsed=${elapsed}s"
            Write-Host $line -ForegroundColor Red
            Add-Content -Path $logPath -Value $line
            Write-Host ""
            Write-Host "===== TTL measurement complete ====="
            Write-Host "Token died after $elapsed seconds ($([math]::Round($elapsed/3600, 2)) hours)."
            Write-Host "Log: $logPath"
            break
        }
        $line = "$ts poll=$pollCount status=ok bodylen=$($body.Length)"
        Write-Host $line
        Add-Content -Path $logPath -Value $line
    }
    catch {
        $line = "$ts poll=$pollCount status=error msg=$($_.Exception.Message)"
        Write-Host $line -ForegroundColor Yellow
        Add-Content -Path $logPath -Value $line
    }
    Start-Sleep -Seconds $intervalSec
}
