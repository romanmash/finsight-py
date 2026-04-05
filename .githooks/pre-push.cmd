@echo off
setlocal

for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"

echo [pre-push] running pytest
bash "%REPO_ROOT%\.codex\hooks\python-pytest-check.sh"
if errorlevel 1 exit /b %errorlevel%

echo [pre-push] passed
endlocal
exit /b 0
