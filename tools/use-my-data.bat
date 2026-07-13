@echo off
setlocal
title Family Tree - Publish MY family to the website
cd /d "%~dp0.."

echo =========================================================
echo   Publish YOUR family data to the website
echo =========================================================
echo.
echo Step 1: on the website, open Family Tree and click EXPORT
echo         (do this in the browser where your family is saved).
echo Step 2: run this script - it finds the newest export in your
echo         Downloads folder automatically. You can also drag the
echo         exported .json file onto this script.
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Install it from https://nodejs.org first.
    goto :end
)

node tools\use-my-data.mjs %1
if errorlevel 1 goto :end

echo.
set "dep=Y"
set /p dep="Deploy the website with your family now? [Y/n]: "
set "dep=%dep: =%"
if /i "%dep%"=="n" (
    echo Skipped. Run tools\deploy.bat whenever you are ready.
    goto :end
)
call tools\deploy.bat
exit /b 0

:end
echo.
pause
