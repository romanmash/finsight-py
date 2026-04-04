#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

git config core.hooksPath .githooks

$cacheRoot = Join-Path $repoRoot ".cache"
$uvCache = Join-Path $cacheRoot "uv"
$pycache = Join-Path $cacheRoot "pycache"

New-Item -ItemType Directory -Path $uvCache -Force | Out-Null
New-Item -ItemType Directory -Path $pycache -Force | Out-Null

try {
    [Environment]::SetEnvironmentVariable("UV_CACHE_DIR", $uvCache, "User")
    [Environment]::SetEnvironmentVariable("PYTHONPYCACHEPREFIX", $pycache, "User")
    Write-Host "Configured user env: UV_CACHE_DIR=$uvCache"
    Write-Host "Configured user env: PYTHONPYCACHEPREFIX=$pycache"
    Write-Host "Restart shell sessions to pick up user environment changes."
}
catch {
    Write-Warning "Could not set user-level cache environment variables on this system."
    Write-Host "Set manually if desired:"
    Write-Host "  UV_CACHE_DIR=$uvCache"
    Write-Host "  PYTHONPYCACHEPREFIX=$pycache"
}

Write-Host "Configured git hooksPath=.githooks"
Write-Host "Windows-native hooks: .githooks/pre-commit.cmd and .githooks/pre-push.cmd"
