# Writes Supabase credentials into .env.local.
#
# A script rather than a pasted block: pasting multiple lines into PowerShell lets
# a later line get consumed as the answer to an earlier Read-Host prompt.
#
# Run with:
#   powershell -ExecutionPolicy Bypass -File scripts\set-supabase-env.ps1
#
# Both keys are read masked and never echoed. Nothing is printed but a confirmation.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local"

if (-not (Test-Path $envFile)) {
    Write-Host "No .env.local found at $envFile" -ForegroundColor Red
    exit 1
}

function Read-Secret([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

Write-Host ""
Write-Host "Supabase credentials -> .env.local" -ForegroundColor Cyan
Write-Host "Find these in your project under Settings -> API" -ForegroundColor DarkGray
Write-Host ""

$defaultUrl = "https://dlbxommlhwdrilrauvcn.supabase.co"
$url = Read-Host "Project URL [$defaultUrl]"
if ([string]::IsNullOrWhiteSpace($url)) { $url = $defaultUrl }
$url = $url.Trim().TrimEnd("/")

if ($url -notmatch '^https://[a-z0-9]+\.supabase\.co$') {
    Write-Host "That does not look like a Supabase project URL: $url" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "The next two are masked - you will see nothing as you paste. That is expected." -ForegroundColor DarkGray
$anon = Read-Secret "anon public key"
$service = Read-Secret "service_role key"

# Supabase issues two key formats depending on project age: legacy JWTs starting
# 'eyJ', and the newer 'sb_publishable_' / 'sb_secret_' style. Accept both.
foreach ($pair in @(@("anon/publishable", $anon), @("service_role/secret", $service))) {
    if ($pair[1] -notmatch '^(eyJ|sb_publishable_|sb_secret_)') {
        Write-Host "The $($pair[0]) key has an unexpected format." -ForegroundColor Red
        Write-Host "Expected it to start with 'eyJ', 'sb_publishable_' or 'sb_secret_'." -ForegroundColor Red
        exit 1
    }
}

# Guard against pasting them the wrong way round: the secret key must never end up
# in the client-side variable.
if ($anon -match '^sb_secret_' -or $service -match '^sb_publishable_') {
    Write-Host "These look swapped - the publishable key goes first, the secret key second." -ForegroundColor Red
    exit 1
}

if ($anon -eq $service) {
    Write-Host "The two keys are identical - you probably pasted the same one twice." -ForegroundColor Red
    exit 1
}

$content = Get-Content $envFile
$content = $content -replace '^NEXT_PUBLIC_SUPABASE_URL=.*', "NEXT_PUBLIC_SUPABASE_URL=$url"
$content = $content -replace '^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*', "NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon"
$content = $content -replace '^SUPABASE_SERVICE_ROLE_KEY=.*', "SUPABASE_SERVICE_ROLE_KEY=$service"
$content | Set-Content $envFile -Encoding utf8

Write-Host ""
Write-Host "Written to .env.local:" -ForegroundColor Green
Write-Host "  NEXT_PUBLIC_SUPABASE_URL      $url"
Write-Host "  NEXT_PUBLIC_SUPABASE_ANON_KEY  set ($($anon.Length) chars)"
Write-Host "  SUPABASE_SERVICE_ROLE_KEY      set ($($service.Length) chars)"
Write-Host ""
