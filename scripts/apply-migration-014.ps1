# Apply migration 014 (atomic daily usage limits) to Supabase
#
# Usage:
#   .\scripts\apply-migration-014.ps1
#
# Requires one of:
#   - Supabase CLI linked to your project (supabase db push)
#   - DATABASE_URL in .env.local (direct Postgres connection string)
#
# If neither is available, the script prints SQL Editor steps.

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Migration = Join-Path $Root "supabase\migrations\014_atomic_daily_usage.sql"

if (-not (Test-Path $Migration)) {
  Write-Error "Migration file not found: $Migration"
}

Write-Host "PDF Doctor - apply migration 014" -ForegroundColor Cyan
Write-Host ""

# 1) Supabase CLI
if (Get-Command supabase -ErrorAction SilentlyContinue) {
  Write-Host "Supabase CLI found. Running: supabase db push" -ForegroundColor Yellow
  Push-Location $Root
  try {
    supabase db push
    Write-Host "Migration applied via Supabase CLI." -ForegroundColor Green
    exit 0
  } catch {
    Write-Host "Supabase CLI push failed: $_" -ForegroundColor Red
  } finally {
    Pop-Location
  }
}

# 2) DATABASE_URL + psql
$EnvFile = Join-Path $Root ".env.local"
$DatabaseUrl = $env:DATABASE_URL
if (-not $DatabaseUrl -and (Test-Path $EnvFile)) {
  $line = Get-Content $EnvFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
  if ($line) {
    $DatabaseUrl = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
  }
}

if ($DatabaseUrl -and (Get-Command psql -ErrorAction SilentlyContinue)) {
  Write-Host "Applying via psql and DATABASE_URL ..." -ForegroundColor Yellow
  & psql $DatabaseUrl -f $Migration
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Migration applied via psql." -ForegroundColor Green
    exit 0
  }
  Write-Host "psql failed with exit code $LASTEXITCODE" -ForegroundColor Red
}

# 3) Manual fallback
Write-Host ""
Write-Host "Automatic apply not available. Do this manually:" -ForegroundColor Yellow
Write-Host ""
Write-Host '1. Open Supabase Dashboard, your project, SQL Editor'
Write-Host '2. New query, paste contents of:'
Write-Host "   $Migration"
Write-Host '3. Run the query'
Write-Host ""
Write-Host 'Optional setup for automatic runs later:'
Write-Host '  - Install Supabase CLI: https://supabase.com/docs/guides/cli'
Write-Host '  - Or add DATABASE_URL to .env.local from Project Settings, Database'
Write-Host ""
