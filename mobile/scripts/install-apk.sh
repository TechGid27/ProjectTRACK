#!/usr/bin/env bash
# ProjectTRACK Mobile -- One-Click APK Installer (macOS / Linux)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "========================================================"
echo "   ProjectTRACK Mobile -- One-Click APK Installer"
echo "========================================================"
echo ""

ADB_CMD="adb"
if ! command -v adb &> /dev/null; then
    if [ -f "$HOME/Library/Android/sdk/platform-tools/adb" ]; then
        ADB_CMD="$HOME/Library/Android/sdk/platform-tools/adb"
    elif [ -f "$HOME/Android/Sdk/platform-tools/adb" ]; then
        ADB_CMD="$HOME/Android/Sdk/platform-tools/adb"
    else
        echo "[ERROR] adb command not found. Please install Android platform-tools or add to PATH."
        exit 1
    fi
fi

APK_PATH=""
if [ -f "dist/projecttrack.apk" ]; then
    APK_PATH="dist/projecttrack.apk"
elif [ -f "android/app/build/outputs/apk/release/app-release.apk" ]; then
    APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
else
    APK_PATH=$(ls dist/*.apk 2>/dev/null | head -n 1 || true)
fi

if [ -z "$APK_PATH" ]; then
    echo "[ERROR] No APK file found in dist/ or android/app/build/outputs/apk/."
    echo "Please build the APK first by running: npm run build:apk"
    exit 1
fi

echo "[INFO] Found APK: $APK_PATH"
echo "[INFO] Connected devices:"
"$ADB_CMD" devices
echo ""

echo "[INFO] Installing APK..."
"$ADB_CMD" install -r "$APK_PATH"

echo "[INFO] Launching app..."
"$ADB_CMD" shell monkey -p com.projecttrack.mobile -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1 || true

echo "SUCCESS! App installed on device."
