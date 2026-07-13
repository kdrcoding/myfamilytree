@echo off
setlocal
title Family Tree - One-click deploy
cd /d "%~dp0.."

echo ============================================
echo   Hartley Family Tree - one-click deploy
echo ============================================
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

echo Where do you want to deploy?
echo.
echo   [1] Vercel  (recommended - free, automatic URL)
echo   [2] GitHub  (push to GitHub - triggers the GitHub Pages workflow)
echo   [3] Build only  (creates the dist folder, deploy it yourself)
echo.
set "choice=1"
set /p choice="Type 1, 2 or 3 and press Enter [1]: "
rem Tolerate stray spaces around the typed answer.
set "choice=%choice: =%"

echo.
echo Checking code and building...
call npm run lint
if errorlevel 1 goto :fail
call npm run build
if errorlevel 1 goto :fail
echo Build OK.
echo.

if "%choice%"=="3" goto :buildonly
if "%choice%"=="2" goto :github

:vercel
echo Deploying to Vercel...
echo (First time: it will ask you to log in and confirm the project - accept the defaults.)
call npx vercel --prod
if errorlevel 1 goto :fail
echo.
echo [DONE] Deployed to Vercel! The live URL is printed above.
goto :end

:github
where git >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Git is not installed. Install it from https://git-scm.com first.
    goto :end
)
if not exist .git (
    echo Initializing the git repository...
    git init
    git branch -M main
)
git remote get-url origin >nul 2>nul
if errorlevel 1 (
    echo.
    echo [ACTION NEEDED] No GitHub remote is set up yet. Create an empty repository
    echo on https://github.com/new then run these two commands here once:
    echo.
    echo     git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
    echo     git push -u origin main
    echo.
    echo After that, double-click this script again.
    goto :end
)
git add -A
git commit -m "Update family tree" >nul 2>nul
git push origin main
if errorlevel 1 goto :fail
echo.
echo [DONE] Pushed to GitHub. The Pages workflow is building your site now -
echo check the repository's Actions tab; the site updates in a minute or two.
goto :end

:buildonly
echo [DONE] Production build created in the "dist" folder.
echo Upload that folder to any static host to publish the site.
goto :end

:fail
echo.
echo [FAILED] Something went wrong - read the messages above.

:end
echo.
pause
