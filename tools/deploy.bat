@echo off
setlocal EnableExtensions
title Oq-Ariq OILASI - One-click deploy
cd /d "%~dp0.."

echo ============================================
echo   Oq-Ariq OILASI - one-click deploy
echo ============================================
echo.
echo   Site:  https://myfamilytree-kdr6.vercel.app
echo   Repo:  kdrcoding/myfamilytree
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Install it from https://nodejs.org first.
    goto :end
)

if not exist node_modules (
    echo Installing dependencies - first run only, takes a minute...
    call npm install
    if errorlevel 1 goto :fail
)

echo What do you want to deploy?
echo.
echo   [1] Everything  - GitHub + Vercel + Telegram bot functions  ^(recommended^)
echo   [2] Website only - GitHub + Vercel
echo   [3] Vercel only
echo   [4] GitHub only
echo   [5] Telegram bot only  ^(Supabase Edge Functions^)
echo   [6] Build only  ^(creates dist\, no upload^)
echo.
set "choice=1"
set /p choice="Type 1-6 and press Enter [1]: "
set "choice=%choice: =%"

echo.

if "%choice%"=="6" goto :buildonly
if "%choice%"=="5" goto :supabase
if "%choice%"=="4" goto :github
if "%choice%"=="3" goto :buildthenvercel
if "%choice%"=="2" goto :fullsite
if "%choice%"=="1" goto :everything

echo [ERROR] Unknown choice "%choice%". Use 1-6.
goto :fail

:everything
call :dobuild
if errorlevel 1 goto :fail
call :dogithub
if errorlevel 1 goto :fail
call :dovercel
if errorlevel 1 goto :fail
call :dosupabase
if errorlevel 1 goto :fail
goto :alldone

:fullsite
call :dobuild
if errorlevel 1 goto :fail
call :dogithub
if errorlevel 1 goto :fail
call :dovercel
if errorlevel 1 goto :fail
goto :siteonlydone

:buildthenvercel
call :dobuild
if errorlevel 1 goto :fail
call :dovercel
if errorlevel 1 goto :fail
goto :end

:github
call :dobuild
if errorlevel 1 goto :fail
call :dogithub
if errorlevel 1 goto :fail
goto :end

:supabase
call :dosupabase
if errorlevel 1 goto :fail
goto :end

:buildonly
call :dobuild
if errorlevel 1 goto :fail
echo [DONE] Production build is in the "dist" folder.
goto :end

:alldone
echo.
echo ============================================
echo   ALL DONE
echo ============================================
echo   Website:  https://myfamilytree-kdr6.vercel.app
echo   Birthday pages:  /bday/^<personId^>  ^(no password^)
echo   Telegram functions: telegram-webhook, birthday-telegram, birthday-public
echo.
echo   Reminder: run the cheers SQL migration once in Supabase if you have not:
echo     supabase\migrations\20260811000001_telegram_birthday_cheers.sql
echo.
goto :end

:siteonlydone
echo.
echo [DONE] Website deployed.
echo   https://myfamilytree-kdr6.vercel.app
goto :end

rem ---------- helpers ----------

:dobuild
echo Checking code and building...
call npm run lint
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 exit /b 1
echo Build OK.
echo.
exit /b 0

:dovercel
echo Deploying to Vercel...
echo ^(First time: log in and accept the project defaults.^)
call npx vercel --prod
if errorlevel 1 exit /b 1
echo.
echo [DONE] Vercel: https://myfamilytree-kdr6.vercel.app
echo.
exit /b 0

:dogithub
where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git is not installed. Install it from https://git-scm.com first.
    exit /b 1
)
if not exist .git (
    echo Initializing the git repository...
    git init
    git branch -M main
)
git remote get-url origin >nul 2>nul
if errorlevel 1 (
    echo.
    echo [ACTION NEEDED] No GitHub remote yet. Create a repo on GitHub, then once:
    echo     git remote add origin https://github.com/kdrcoding/myfamilytree.git
    echo     git push -u origin main
    echo Then run this script again.
    exit /b 1
)

git add -A
git status --porcelain >nul
git diff --cached --quiet
if errorlevel 1 (
    git commit -m "Deploy: update Oq-Ariq family tree and Telegram birthdays."
    if errorlevel 1 (
        echo [ERROR] Commit failed.
        exit /b 1
    )
    echo Committed local changes.
) else (
    echo No new file changes to commit.
)

echo Pulling latest from GitHub...
git pull origin main --rebase
if errorlevel 1 (
    echo.
    echo [HINT] Rebase conflict. Fix files, then:
    echo     git add -A ^&^& git rebase --continue
    echo Or ask for help. Not force-pushing from this script.
    exit /b 1
)

echo Pushing to GitHub...
git push origin main
if errorlevel 1 (
    echo.
    echo [HINT] Push rejected. Pull/rebase first, or resolve remote changes, then retry.
    exit /b 1
)
echo.
echo [DONE] Pushed to GitHub.
echo.
exit /b 0

:dosupabase
echo Deploying Telegram Edge Functions to Supabase...
echo Project: kasvrgqbmydypwvkqzju
echo.

where npx >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npx not found.
    exit /b 1
)

rem Ensure we are linked to the Oq-Ariq project (safe to re-run).
call npx supabase link --project-ref kasvrgqbmydypwvkqzju
if errorlevel 1 (
    echo.
    echo [ACTION NEEDED] Supabase CLI is not logged in.
    echo Run this once in PowerShell, then double-click deploy again:
    echo.
    echo     npx supabase login
    echo.
    exit /b 1
)

call npx supabase functions deploy telegram-webhook --no-verify-jwt
if errorlevel 1 exit /b 1
call npx supabase functions deploy birthday-telegram --no-verify-jwt
if errorlevel 1 exit /b 1
call npx supabase functions deploy birthday-public --no-verify-jwt
if errorlevel 1 exit /b 1

echo.
echo [DONE] Telegram bot functions deployed.
echo   - telegram-webhook
echo   - birthday-telegram
echo   - birthday-public
echo.
exit /b 0

:fail
echo.
echo [FAILED] Something went wrong - read the messages above.

:end
echo.
pause
endlocal
