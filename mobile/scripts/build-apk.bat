@echo off
setlocal
cd /d "%~dp0\.."

echo ========================================================
echo    ProjectTRACK Mobile -- One-Click APK Builder
echo ========================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in your PATH. Please install Node.js 18+ to proceed.
    echo.
    pause
    exit /b 1
)

node scripts/build-apk.js %*

echo.
echo ========================================================
echo Finished! Press any key to exit.
echo ========================================================
pause
