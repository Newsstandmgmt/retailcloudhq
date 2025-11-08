#!/bin/bash

# Start Metro bundler for React Native

cd "$(dirname "$0")"

echo "🚀 Starting Metro Bundler..."
echo ""

# Check if port 8081 is already in use
if lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Metro bundler is already running on port 8081"
    echo "   To stop it, run: killall node"
    echo "   Or use: kill \$(lsof -ti:8081)"
    echo ""
    read -p "Do you want to kill the existing Metro process? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🛑 Stopping existing Metro..."
        killall node 2>/dev/null
        sleep 2
    else
        echo "❌ Exiting. Please stop Metro manually or use a different port."
        exit 1
    fi
fi

# Clear caches
echo "🧹 Clearing caches..."
rm -rf node_modules/.cache
rm -rf $TMPDIR/react-* 2>/dev/null

# Get local IP address for reference
LOCAL_IP=$(ifconfig | grep -E "inet.*broadcast|inet.*netmask" | grep -v "127.0.0.1" | head -1 | awk '{print $2}' | cut -d: -f2)

echo "✅ Caches cleared"
echo ""
echo "📱 Debug Server Info:"
echo "   Local: http://localhost:8081"
if [ ! -z "$LOCAL_IP" ]; then
    echo "   Network: http://$LOCAL_IP:8081"
    echo ""
    echo "   For physical device, set debug server host to: $LOCAL_IP:8081"
fi
echo ""
echo "🚀 Starting Metro bundler..."
echo "   Press Ctrl+C to stop"
echo ""

# Start Metro
npx react-native start --reset-cache

