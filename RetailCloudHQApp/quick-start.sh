#!/bin/bash

# Load environment variables explicitly
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/emulator"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export PATH="$PATH:$ANDROID_HOME/tools"
export PATH="$PATH:$ANDROID_HOME/tools/bin"

# Set Java Home
export JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || echo "/opt/homebrew/opt/openjdk@17")
export PATH="$JAVA_HOME/bin:$PATH"

# Increase file watcher limit (fixes EMFILE error)
ulimit -n 4096 2>/dev/null || ulimit -n 10240

echo "🚀 Starting RetailCloudHQ Android App..."
echo ""

# Check if backend is already running
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "⚠️  Backend already running on port 3000"
    echo "   Skipping backend start..."
    BACKEND_PID=""
else
    echo "Step 1: Starting backend..."
    cd ../backend && npm start > /dev/null 2>&1 &
    BACKEND_PID=$!
    echo "Backend started (PID: $BACKEND_PID)"
    cd - > /dev/null
fi

echo ""
echo "Step 2: Starting Metro bundler..."
cd "$(dirname "$0")" || exit
npm start > /dev/null 2>&1 &
METRO_PID=$!
echo "Metro bundler started (PID: $METRO_PID)"
echo ""
echo "Waiting 5 seconds for services to start..."
sleep 5
echo ""
echo "Step 3: Building and running Android app..."
echo ""

# Verify environment (should already be set above, but double-check)
if ! command -v adb &> /dev/null; then
    echo "❌ ADB still not found after setting environment"
    echo "   ANDROID_HOME: $ANDROID_HOME"
    echo "   Please check Android SDK installation"
    exit 1
fi

if ! command -v java &> /dev/null; then
    echo "❌ Java still not found after setting environment"
    echo "   JAVA_HOME: $JAVA_HOME"
    echo "   Please check Java installation"
    exit 1
fi

echo "✅ Environment verified:"
echo "   ADB: $(adb version 2>&1 | head -1)"
echo "   Java: $(java -version 2>&1 | head -1)"
echo ""

# Check for devices
echo "Checking for Android devices..."
if adb devices | grep -q "device$"; then
    echo "✅ Device found"
elif adb devices | grep -q "emulator"; then
    echo "✅ Emulator found"
else
    echo "⚠️  No devices found. Please:"
    echo "   1. Connect a physical device (with USB debugging enabled), OR"
    echo "   2. Start an emulator from Android Studio"
    echo ""
    read -p "Press Enter to continue anyway (will fail if no device)..."
fi

npm run android

echo ""
if [ -n "$BACKEND_PID" ]; then
    echo "To stop backend, run: kill $BACKEND_PID"
fi
echo "To stop Metro, run: kill $METRO_PID"
