#!/usr/bin/env bash
# Verify the Expo mobile app compiles by producing a real Metro bundle.
# No device/emulator needed — `expo export` runs the full bundler.
#
#   scripts/verify-mobile.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/mobile"

echo "→ install mobile deps"
npm install --no-audit --no-fund

echo "→ expo export (Metro bundle, android)"
npx expo export --platform android --output-dir /tmp/expo-out

echo "✓ mobile Expo bundle built at /tmp/expo-out"
