#!/bin/bash

# Script to start Android emulator

export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/emulator"
export PATH="$PATH:$ANDROID_HOME/platform-tools"

echo "📱 Starting Android Emulator..."
echo ""

# List available emulators
AVDS=$($ANDROID_HOME/emulator/emulator -list-avds 2>/dev/null)

if [ -z "$AVDS" ]; then
    echo "❌ No emulators found!"
    echo ""
    echo "Please create an emulator in Android Studio:"
    echo "1. Open Android Studio"
    echo "2. Tools → Device Manager"
    echo "3. Create Device → Choose device (Pixel 5)"
    echo "4. Download System Image (API 34)"
    echo "5. Finish"
    exit 1
fi

# Check if emulator is already running
if adb devices | grep -q "emulator"; then
    echo "✅ Emulator is already running"
    adb devices
    exit 0
fi

# Get first available emulator
EMULATOR_NAME=$(echo "$AVDS" | head -1)
echo "Found emulator: $EMULATOR_NAME"
echo ""
echo "Starting emulator (this may take 1-2 minutes)..."
echo ""

# Start emulator in background
$ANDROID_HOME/emulator/emulator -avd "$EMULATOR_NAME" > /dev/null 2>&1 &

EMULATOR_PID=$!
echo "Emulator starting (PID: $EMULATOR_PID)"
echo ""
echo "⏳ Waiting for emulator to boot..."
echo "   (This takes 1-2 minutes on first boot)"

# Wait for emulator to be ready
for i in {1..60}; do
    if adb devices | grep -q "emulator.*device$"; then
        echo ""
        echo "✅ Emulator is ready!"
        adb devices
        exit 0
    fi
    sleep 2
    echo -n "."
done

echo ""
echo "⚠️  Emulator is starting but may not be fully ready yet"
echo "   Check with: adb devices"
echo ""
echo "To stop emulator later, run:"
echo "  adb emu kill"
echo "  or close the emulator window"

