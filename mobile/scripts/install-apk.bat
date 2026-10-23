@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0\.."

echo ========================================================
echo    ProjectTRACK Mobile -- One-Click APK Installer
echo ========================================================
echo.

:: 1. Locate ADB
set "ADB_CMD=adb"
where adb >nul 2>nul
if %ERRORLEVEL% neq 0 (
    if exist "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" (
        set "ADB_CMD=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"
    ) else (
        echo [ERROR] Android Debug Bridge (adb) was not found in PATH or standard Android SDK location.
        echo To install directly over USB:
        echo   1. Connect your Android phone with USB Debugging enabled.
        echo   2. Ensure Android SDK platform-tools is installed.
        echo Alternatively, simply download and install the .apk directly on your phone using the QR code from:
        echo   npm run build:apk
        echo.
        pause
        exit /b 1
    )
)

:: 2. Locate APK
set "APK_PATH="
if exist "dist\projecttrack.apk" (
    set "APK_PATH=dist\projecttrack.apk"
) else if exist "android\app\build\outputs\apk\release\app-release.apk" (
    set "APK_PATH=android\app\build\outputs\apk\release\app-release.apk"
) else (
    for %%F in (dist\*.apk) do (
        set "APK_PATH=%%F"
    )
)

if "%APK_PATH%"=="" (
    echo [ERROR] No compiled APK found.
    echo Please build the APK first by double-clicking scripts\build-apk.bat or running:
    echo   npm run build:apk
    echo.
    pause
    exit /b 1
)

echo [INFO] Found APK: %APK_PATH%
echo [INFO] Checking for connected Android devices/emulators...
echo.

"%ADB_CMD%" devices
echo.

echo [INFO] Installing %APK_PATH% onto target device...
"%ADB_CMD%" install -r "%APK_PATH%"

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================================
    echo    SUCCESS! ProjectTRACK has been installed on device.
    echo ========================================================
    echo Launching ProjectTRACK on device...
    "%ADB_CMD%" shell monkey -p com.projecttrack.mobile -c android.intent.category.LAUNCHER 1 >nul 2>nul
) else (
    echo.
    echo [ERROR] Installation failed. Ensure your phone screen is unlocked and "Allow USB Debugging" is accepted.
)

echo.
pause
