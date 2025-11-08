#!/bin/bash

# Properly configured script to run Android app
# This script sets all environment variables and runs the app

# Set Android environment
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/emulator"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export PATH="$PATH:$ANDROID_HOME/tools"
export PATH="$PATH:$ANDROID_HOME/tools/bin"

# Set Java environment
export JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || echo "/opt/homebrew/opt/openjdk@17")
export PATH="$JAVA_HOME/bin:$PATH"

# Increase file watcher limit
ulimit -n 4096 2>/dev/null || ulimit -n 10240

echo "🔍 Checking environment..."
echo "ANDROID_HOME: $ANDROID_HOME"
echo "JAVA_HOME: $JAVA_HOME"
echo ""

# Verify ADB
if ! command -v adb &> /dev/null; then
    echo "❌ ADB not found. Please check Android SDK installation."
    exit 1
fi

# Verify Java
if ! command -v java &> /dev/null; then
    echo "❌ Java not found. Please install Java 17+."
    exit 1
fi

echo "✅ ADB: $(adb version | head -1)"
echo "✅ Java: $(java -version 2>&1 | head -1)"
echo ""

# Check for devices
echo "🔍 Checking for devices..."
DEVICES=$(adb devices | grep -E "device$|emulator" | wc -l | tr -d ' ')

if [ "$DEVICES" -eq "0" ]; then
    echo "❌ No devices or emulators found!"
    echo ""
    echo "Please do ONE of the following:"
    echo ""
    echo "Option 1: Connect Physical Device"
    echo "  1. Enable USB Debugging on your Android device"
    echo "  2. Connect via USB"
    echo "  3. Run: adb devices"
    echo ""
    echo "Option 2: Start Emulator"
    echo "  1. Open Android Studio"
    echo "  2. Tools → Device Manager"
    echo "  3. Click ▶️ Play button on an emulator"
    echo "  4. Wait for emulator to boot"
    echo ""
    echo "Option 3: Create Emulator (if none exists)"
    echo "  1. Open Android Studio"
    echo "  2. Tools → Device Manager"
    echo "  3. Create Device → Choose device (Pixel 5)"
    echo "  4. Download System Image (API 34)"
    echo "  5. Finish → Start emulator"
    echo ""
    read -p "Press Enter to check again, or Ctrl+C to exit..."
    DEVICES=$(adb devices | grep -E "device$|emulator" | wc -l | tr -d ' ')
    if [ "$DEVICES" -eq "0" ]; then
        echo "❌ Still no devices found. Please set up a device or emulator first."
        exit 1
    fi
fi

echo "✅ Device/Emulator found!"
echo ""

# Check if backend is running
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "✅ Backend already running on port 3000"
else
    echo "⚠️  Backend not running on port 3000"
    echo "   Please start backend in another terminal:"
    echo "   cd ../backend && npm start"
    echo ""
    read -p "Press Enter to continue anyway, or Ctrl+C to start backend first..."
fi

# Check if Metro is running
if lsof -ti:8081 > /dev/null 2>&1; then
    echo "✅ Metro bundler already running on port 8081"
else
    echo "🚀 Starting Metro bundler..."
    npm start > /dev/null 2>&1 &
    METRO_PID=$!
    echo "Metro started (PID: $METRO_PID)"
    echo "Waiting 5 seconds for Metro to start..."
    sleep 5
fi

echo ""
echo "🚀 Building and running Android app..."
echo ""

# Run the app
npm run android

echo ""
echo "✅ Done! Check your device/emulator for the app."

