#!/bin/bash
set -e

# Android Release Bundle Build Script
# Usage: ./scripts/build-android-bundle.sh

echo "🏗️  Starting Android Release Bundle Build..."

# Navigate to the app directory
cd "$(dirname "$0")/.."

# Ensure assets directory exists
mkdir -p android/app/src/main/assets

# Clean previous bundle to ensure fresh build
rm -f android/app/src/main/assets/index.android.bundle
rm -f android/app/src/main/assets/index.android.bundle.meta

# Aggressive Cache Cleaning
echo "🧹 Cleaning Metro and Watchman caches..."
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-map-*
rm -rf node_modules/.cache
watchman watch-del-all 2>/dev/null || true

# Set memory limit to avoid OOM during bundling
export NODE_OPTIONS="--max_old_space_size=4096"

# Disable Watchman to prevent file watching hangs in CI/Release builds
export USE_WATCHMAN=false

echo "📦 Bundling React Native JS..."
echo "   - Node Options: $NODE_OPTIONS"
echo "   - Watchman: Disabled"

# Run the bundle command
DEBUG=Metro:Activity,Metro:Server npx react-native bundle \
    --platform android \
    --dev false \
    --entry-file index.js \
    --bundle-output android/app/src/main/assets/index.android.bundle \
    --assets-dest android/app/src/main/res/ \
    --reset-cache \
    --verbose

if [ -f "android/app/src/main/assets/index.android.bundle" ]; then
    echo "✅ Bundle generated successfully!"
    ls -lh android/app/src/main/assets/index.android.bundle
else
    echo "❌ Bundle generation failed!"
    exit 1
fi
