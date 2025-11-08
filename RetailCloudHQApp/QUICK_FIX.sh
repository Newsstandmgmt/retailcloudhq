#!/bin/bash

# Quick fix script for native module issues

echo "🔧 Fixing Native Module Issues..."
echo ""

# Navigate to app directory
cd "$(dirname "$0")"

# Step 1: Clean Metro cache
echo "1. Cleaning Metro cache..."
rm -rf node_modules/.cache
echo "✅ Metro cache cleared"
echo ""

# Step 2: Clean Android build
echo "2. Cleaning Android build..."
cd android
./gradlew clean
cd ..
echo "✅ Android build cleaned"
echo ""

# Step 3: Check if Metro is running
echo "3. Checking Metro bundler..."
if lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Metro bundler is running. Please stop it (Ctrl+C) and run this script again."
    echo "   Or run: npx react-native start --reset-cache"
else
    echo "✅ Metro bundler is not running"
    echo ""
    echo "4. Starting Metro bundler with reset cache..."
    echo "   (This will start in the background)"
    npx react-native start --reset-cache > /dev/null 2>&1 &
    METRO_PID=$!
    echo "✅ Metro bundler started (PID: $METRO_PID)"
    echo ""
    echo "5. Waiting for Metro to be ready..."
    sleep 5
fi

echo ""
echo "✅ Fix complete!"
echo ""
echo "Next steps:"
echo "1. If Metro is not running, start it: npx react-native start --reset-cache"
echo "2. In another terminal, build and run: npx react-native run-android"
echo ""
echo "The native modules should now work properly!"

