@echo off
setlocal
title Family Tree - Local preview
cd /d "%~dp0.."

echo Starting the family tree website on your computer...
echo The browser will open by itself once the site is ready.
echo Keep this window open while you use the site; close it to stop.
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Install it from https://nodejs.org first.
    pause
    exit /b 1
)

if not exist node_modules (
    echo Installing dependencies - first run only, takes a minute...
    call npm install
    if errorlevel 1 (
        echo [FAILED] npm install did not finish - read the messages above.
        pause
        exit /b 1
    )
)

rem Open the browser only AFTER the dev server answers, so nobody lands on a
rem blank "can't connect" page. This helper waits in the background (max 60s).
start "" /min powershell -NoProfile -Command "for($i=0;$i -lt 60;$i++){try{Invoke-WebRequest -UseBasicParsing http://localhost:5173 -TimeoutSec 2 | Out-Null; break}catch{Start-Sleep -Seconds 1}}; Start-Process 'http://localhost:5173'"

call npm run dev
pause
