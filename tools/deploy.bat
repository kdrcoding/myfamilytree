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
echo   [1] Both - Vercel AND GitHub  (recommended, one click publishes everywhere)
echo   [2] Vercel only
echo   [3] GitHub only  (push - triggers the GitHub Pages workflow)
echo   [4] Build only  (creates the dist folder, deploy it yourself)
echo.
set "choice=1"
set /p choice="Type 1, 2, 3 or 4 and press Enter [1]: "
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

set "also_github="
if "%choice%"=="4" goto :buildonly
if "%choice%"=="3" goto :github
if "%choice%"=="1" set "also_github=1"

:vercel
echo Deploying to Vercel...
echo (First time: it will ask you to log in and confirm the project - accept the defaults.)
call npx vercel --prod
if errorlevel 1 goto :fail
echo.
echo [DONE] Deployed to Vercel!
echo.
echo Your permanent link is:  https://myfamilytree-kdr6.vercel.app
echo (It NEVER changes when you deploy. Ignore the random-looking
echo myfamilytree-xxxxx URLs above - those are internal build addresses;
echo the permanent link always shows the newest version automatically.)
if "%also_github%"=="1" goto :github
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
rem Every commit is authored by the site owner - nothing else, ever.
git config user.name "Kadir Ravshanov"
git config user.email "m.qodir99@gmail.com"
git add -A
git commit -m "Update family tree" >nul 2>nul
git push origin main
if errorlevel 1 (
    echo.
    echo [HINT] If the push was rejected because the histories differ,
    echo open a terminal in this folder, run this ONCE, then deploy again:
    echo.
    echo     git push --force-with-lease origin main
    goto :fail
)
echo.
echo [DONE] Pushed to GitHub. The Pages workflow is building your site now -
echo check the repository's Actions tab; the site updates in a minute or two.
echo.
echo Your permanent links (these NEVER change when you deploy):
echo     https://myfamilytree-kdr6.vercel.app
echo     https://kdrcoding.github.io/myfamilytree/
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
