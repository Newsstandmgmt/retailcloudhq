#!/bin/bash

echo "🔍 Checking for Errors..."
echo ""
echo "1. Testing Backend Error API..."
curl -s http://localhost:3000/api/errors/test | jq '.'
echo ""
echo ""

echo "2. Getting Recent Errors (Last 20)..."
curl -s "http://localhost:3000/api/errors/logs?limit=20" | jq '.logs[] | {timestamp, errorType, severity, errorMessage: (.errorMessage | .[0:100]), deviceId, userId}' 2>/dev/null
echo ""

echo "3. Error Statistics..."
curl -s "http://localhost:3000/api/errors/stats" | jq '.stats' 2>/dev/null
echo ""

echo "4. Checking Error Log File..."
if [ -f "backend/logs/errors.json" ]; then
    echo "✅ Error log file exists"
    ERROR_COUNT=$(cat backend/logs/errors.json | jq 'length' 2>/dev/null)
    echo "   Total errors in file: $ERROR_COUNT"
    echo ""
    echo "   Last 5 errors:"
    cat backend/logs/errors.json | jq '.[-5:] | .[] | {timestamp, errorType, severity, errorMessage: (.errorMessage | .[0:80])}' 2>/dev/null
else
    echo "ℹ️  Error log file doesn't exist yet"
    echo "   (Errors will be logged here when they occur)"
fi

