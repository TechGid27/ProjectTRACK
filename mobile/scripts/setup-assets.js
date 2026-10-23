#!/usr/bin/env node
/**
 * Setup and verify mobile branding assets (icon, adaptive-icon, splash).
 * Copies high-resolution assets from Website/public/favicon_io/ into mobile/assets/
 * or generates valid fallback PNGs if running standalone.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const mobileRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(mobileRoot, 'assets');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Candidate sources in repository
const repoRoot = path.resolve(mobileRoot, '..');
const candidateSources = [
  path.join(repoRoot, 'Website', 'public', 'favicon_io', 'android-chrome-512x512.png'),
  path.join(repoRoot, 'Website', 'public', 'favicon_io', 'apple-touch-icon.png'),
];

let sourceImage = null;
for (const cand of candidateSources) {
  if (fs.existsSync(cand)) {
    sourceImage = cand;
    break;
  }
}

const targets = [
  path.join(assetsDir, 'icon.png'),
  path.join(assetsDir, 'adaptive-icon.png'),
  path.join(assetsDir, 'splash.png'),
];

if (sourceImage) {
  for (const target of targets) {
    fs.copyFileSync(sourceImage, target);
  }
  console.log(`[setup-assets] Successfully copied branded assets from ${sourceImage} to mobile/assets/`);
} else {
  // 1x1 pixel valid PNG buffer as fallback if source is absent
  const fallbackPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const buffer = Buffer.from(fallbackPngBase64, 'base64');
  for (const target of targets) {
    if (!fs.existsSync(target)) {
      fs.writeFileSync(target, buffer);
    }
  }
  console.log('[setup-assets] Generated fallback assets in mobile/assets/');
}
