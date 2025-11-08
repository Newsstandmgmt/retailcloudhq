#!/bin/bash

# Start Metro bundler with proper file watcher limits

echo "🚀 Starting Metro Bundler..."
echo ""

# Increase file watcher limit
ulimit -n 4096 2>/dev/null || ulimit -n 10240

# Kill any existing Metro processes
pkill -f "react-native start" 2>/dev/null
pkill -f "metro" 2>/dev/null
sleep 2

# Start Metro
cd "$(dirname "$0")"
npm start

