#!/bin/bash

# Watch React Native errors in real-time
echo "📱 Watching React Native errors..."
echo "Press Ctrl+C to stop"
echo ""

adb logcat -c  # Clear logs
adb logcat | grep --line-buffered -i "ReactNativeJS\|error\|exception\|crash\|AsyncStorage\|WebSocket\|AppRegistry"

