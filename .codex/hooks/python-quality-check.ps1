#!/usr/bin/env pwsh
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\.." )).Path
$tmpRoot = Join-Path $repoRoot ".cache"
$runId = [guid]::NewGuid().ToString("N")
$baseTemp = Join-Path $tmpRoot (Join-Path "pytest-runs" $runId)
$cacheDir = Join-Path $tmpRoot "pytest-cache"

New-Item -ItemType Directory -Path (Join-Path $tmpRoot "uv") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmpRoot "pycache") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmpRoot "mypy") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tmpRoot "ruff") -Force | Out-Null
New-Item -ItemType Directory -Path $baseTemp -Force | Out-Null
New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null

$env:UV_CACHE_DIR = (Join-Path $tmpRoot "uv")
$env:PYTHONPYCACHEPREFIX = (Join-Path $tmpRoot "pycache")

Write-Host "[codex-hook] ruff"
uv run ruff check --cache-dir (Join-Path $tmpRoot "ruff")

Write-Host "[codex-hook] mypy"
uv run mypy --strict --cache-dir (Join-Path $tmpRoot "mypy")

Write-Host "[codex-hook] pytest"
Set-Location $repoRoot
uv run pytest --basetemp=$baseTemp -o ("cache_dir=" + $cacheDir)

Write-Host "[codex-hook] ok"
