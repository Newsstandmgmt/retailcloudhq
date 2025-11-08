#!/bin/bash

# Script to ensure Metro bundler is running and properly configured

echo "🔧 Fixing Metro Bundler Connection..."
echo ""

# Check if Metro is running
if lsof -ti:8081 > /dev/null 2>&1; then
    echo "✅ Metro bundler is running on port 8081"
else
    echo "🚀 Starting Metro bundler..."
    cd "$(dirname "$0")"
    npm start > /dev/null 2>&1 &
    METRO_PID=$!
    echo "Metro started (PID: $METRO_PID)"
    echo "Waiting 10 seconds for Metro to fully start..."
    sleep 10
fi

# Set up port forwarding for emulator
echo ""
echo "🔗 Setting up port forwarding..."
adb reverse tcp:8081 tcp:8081

if [ $? -eq 0 ]; then
    echo "✅ Port forwarding configured"
else
    echo "❌ Failed to set up port forwarding"
    echo "   Make sure emulator is running: adb devices"
    exit 1
fi

# Verify Metro is accessible
echo ""
echo "🔍 Verifying Metro connection..."
sleep 2
if curl -s http://localhost:8081/status > /dev/null 2>&1; then
    echo "✅ Metro is responding"
else
    echo "⚠️  Metro may still be starting..."
    echo "   Wait a few more seconds and try reloading the app"
fi

echo ""
echo "📱 Reloading app..."
adb shell input keyevent 82  # Open dev menu
sleep 1
adb shell input text "RR"      # Reload

echo ""
echo "✅ Done! Check your emulator."
echo ""
echo "If the error persists:"
echo "  1. Shake device or press Cmd+M (Mac) / Ctrl+M (Windows/Linux)"
echo "  2. Select 'Reload' from the dev menu"
echo "  3. Or run: adb shell input text 'RR'"

