@echo off
setlocal

for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"

echo [pre-commit] running python quality checks
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\.codex\hooks\python-quality-check.ps1"
if errorlevel 1 exit /b %errorlevel%

echo [pre-commit] passed
endlocal
exit /b 0
