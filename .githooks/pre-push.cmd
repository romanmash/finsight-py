@echo off
setlocal

for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"

echo [pre-push] running pytest
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%REPO_ROOT%\.codex\hooks\python-pytest-check.ps1"
if errorlevel 1 exit /b %errorlevel%

echo [pre-push] passed
endlocal
exit /b 0
