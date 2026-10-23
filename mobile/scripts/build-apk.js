#!/usr/bin/env node
/**
 * ProjectTRACK Mobile — One-Click Turnkey APK Builder
 * ====================================================
 * Compiles a standalone, installable Android .apk for ProjectTRACK.
 *
 * Modes:
 *   1. Cloud Build (Default / Recommended):
 *      Zero local SDK setup required. Builds via Expo Application Services (EAS),
 *      generates a permanent public download URL and terminal QR code to download
 *      the .apk directly to your phone.
 *      Usage: node scripts/build-apk.js --cloud
 *
 *   2. Local Build (Offline / Self-Hosted):
 *      Requires local Android Studio, Android SDK (API 34+), and JDK 17.
 *      Prebuilds the Android native project and runs Gradle assembleRelease.
 *      Usage: node scripts/build-apk.js --local
 */
'use strict';

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const mobileDir = path.resolve(__dirname, '..');

function printHeader() {
  console.log('\n======================================================');
  console.log('   🚀 ProjectTRACK Mobile — One-Click APK Builder');
  console.log('======================================================\n');
}

function ensureAssets() {
  console.log('📦 Step 1: Verifying branded application assets...');
  try {
    require('./setup-assets.js');
  } catch (err) {
    console.warn('⚠️ setup-assets encountered a warning:', err.message);
  }
}

function verifyConfig() {
  console.log('⚙️  Step 2: Checking app.json & eas.json configuration...');
  const appJsonPath = path.join(mobileDir, 'app.json');
  const easJsonPath = path.join(mobileDir, 'eas.json');

  if (!fs.existsSync(appJsonPath)) {
    console.error('❌ Missing app.json in mobile directory!');
    process.exit(1);
  }
  if (!fs.existsSync(easJsonPath)) {
    console.error('❌ Missing eas.json in mobile directory!');
    process.exit(1);
  }

  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const pkg = appJson.expo?.android?.package;
  const versionCode = appJson.expo?.android?.versionCode;
  console.log(`   - Package Identifier : ${pkg || 'com.projecttrack.mobile'}`);
  console.log(`   - Version Code       : ${versionCode || 1}`);
  console.log('   - Standalone APK Profile: preview (buildType: apk)');
}

function verifyEnvironment() {
  console.log('🌐 Step 3: Checking API Endpoint Configuration...');
  const envPath = path.join(mobileDir, '.env');
  let apiUrl = process.env.EXPO_PUBLIC_API_URL;

  if (!apiUrl && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^EXPO_PUBLIC_API_URL=(.+)$/m);
    if (match) {
      apiUrl = match[1].trim();
    }
  }

  if (apiUrl) {
    console.log(`   - Active API Endpoint : ${apiUrl}`);
    if (apiUrl.includes('10.0.2.2') || apiUrl.includes('localhost')) {
      console.log('   ⚠️  NOTE: 10.0.2.2/localhost only reaches emulators.');
      console.log('      To connect from a physical Android phone, set EXPO_PUBLIC_API_URL');
      console.log('      in mobile/.env to your Wi-Fi IP (e.g. http://192.168.1.50:8000/api)');
      console.log('      or your deployed production domain.');
    }
  } else {
    console.log('   ℹ️  No EXPO_PUBLIC_API_URL found; defaulting to http://10.0.2.2:8000/api');
  }
}

function runCommand(command, args, cwd = mobileDir) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶️ Executing: ${command} ${args.join(' ')}\n`);
    const proc = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}`));
    });

    proc.on('error', (err) => reject(err));
  });
}

async function buildCloud() {
  console.log('\n☁️  Starting Cloud EAS Build (Zero Local Setup Required)...');
  console.log('   EAS will compile the standalone APK in the cloud and generate');
  console.log('   a direct download URL & QR code for your Android phone.\n');

  try {
    await runCommand('npx', ['eas-cli', 'build', '--platform', 'android', '--profile', 'preview']);
    console.log('\n✅ Cloud APK Build Finished!');
    console.log('📱 Scan the QR code above or open the download URL in your phone browser to install the APK.');
  } catch (err) {
    console.error('\n❌ Cloud build encountered an error:', err.message);
    process.exit(1);
  }
}

async function buildLocal() {
  console.log('\n💻 Starting Local Native Build (Offline Mode)...');
  console.log('   Prerequisites: Android Studio, Android SDK (API 34+), Java JDK 17.\n');

  try {
    console.log('▶️ Generating native Android folder via expo prebuild...');
    await runCommand('npx', ['expo', 'prebuild', '--platform', 'android']);

    const androidDir = path.join(mobileDir, 'android');
    if (!fs.existsSync(androidDir)) {
      throw new Error('Android native directory was not generated.');
    }

    const isWindows = process.platform === 'win32';
    const gradlew = isWindows ? 'gradlew.bat' : './gradlew';

    console.log('▶️ Compiling APK via Gradle assembleRelease...');
    await runCommand(gradlew, ['assembleRelease'], androidDir);

    const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
    const outDist = path.join(mobileDir, 'dist');
    if (!fs.existsSync(outDist)) fs.mkdirSync(outDist, { recursive: true });
    const targetApk = path.join(outDist, 'projecttrack.apk');

    if (fs.existsSync(apkPath)) {
      fs.copyFileSync(apkPath, targetApk);
      console.log(`\n🎉 SUCCESS! Local APK built and copied to: ${targetApk}`);
      console.log('📱 You can install it immediately by running: npm run install:apk');
    } else {
      console.log(`\n✅ Build completed. Check android/app/build/outputs/apk/ for outputs.`);
    }
  } catch (err) {
    console.error('\n❌ Local build encountered an error:', err.message);
    console.log('\n💡 Tip: If you do not have Android SDK or JDK 17 installed, use Cloud Build instead:');
    console.log('   node scripts/build-apk.js --cloud\n');
    process.exit(1);
  }
}

async function main() {
  printHeader();

  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/build-apk.js [options]\n');
    console.log('Options:');
    console.log('  --cloud       Build APK via Expo Application Services Cloud (Default, zero setup)');
    console.log('  --local       Build APK locally using Android SDK / Gradle');
    console.log('  --help, -h    Display this help message\n');
    process.exit(0);
  }

  ensureAssets();
  verifyConfig();
  verifyEnvironment();

  if (args.includes('--local')) {
    await buildLocal();
  } else if (args.includes('--cloud')) {
    await buildCloud();
  } else {
    // Default interactive selection
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('\nChoose build method:');
    console.log('  1) Cloud Build (Recommended: Zero setup, generates QR code & download link)');
    console.log('  2) Local Build (Requires Android Studio / JDK 17 on this PC)');

    rl.question('\nEnter choice [1 or 2, default: 1]: ', async (answer) => {
      rl.close();
      const choice = answer.trim();
      if (choice === '2') {
        await buildLocal();
      } else {
        await buildCloud();
      }
    });
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
