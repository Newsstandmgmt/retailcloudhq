#!/bin/bash

# Real-time error viewer for React Native
echo "📱 React Native Error Viewer"
echo "============================"
echo ""
echo "Watching for errors in real-time..."
echo "Press Ctrl+C to stop"
echo ""

# Clear logs
adb logcat -c

# Watch for errors
adb logcat | grep --line-buffered -E "ReactNativeJS|ERROR|Exception|FATAL|AsyncStorage|WebSocket|AppRegistry|\[App\]|\[Registration" | while read line; do
    # Highlight errors in red (if terminal supports it)
    if echo "$line" | grep -qi "error\|exception\|fatal"; then
        echo -e "\033[31m$line\033[0m"  # Red
    elif echo "$line" | grep -qi "ReactNativeJS.*Running"; then
        echo -e "\033[32m$line\033[0m"  # Green
    else
        echo "$line"
    fi
done

