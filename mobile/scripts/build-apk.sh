#!/usr/bin/env bash
# ProjectTRACK Mobile -- One-Click APK Builder (macOS / Linux)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "========================================================"
echo "   ProjectTRACK Mobile -- One-Click APK Builder"
echo "========================================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed or not in PATH."
    exit 1
fi

node scripts/build-apk.js "$@"
