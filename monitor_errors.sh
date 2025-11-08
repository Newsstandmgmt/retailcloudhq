#!/bin/bash

echo "🔍 Monitoring for Errors..."
echo ""
echo "Checking for new errors every 10 seconds..."
echo "Press Ctrl+C to stop"
echo ""

PREVIOUS_COUNT=0

while true; do
    CURRENT_COUNT=$(curl -s "http://localhost:3000/api/errors/stats" | jq -r '.stats.total' 2>/dev/null || echo "0")
    
    if [ "$CURRENT_COUNT" != "$PREVIOUS_COUNT" ] && [ "$CURRENT_COUNT" != "0" ]; then
        echo ""
        echo "🚨 NEW ERROR DETECTED!"
        echo "Total errors: $CURRENT_COUNT"
        echo ""
        echo "Latest error:"
        curl -s "http://localhost:3000/api/errors/logs?limit=1" | jq -r '.logs[0] | "   Timestamp: \(.timestamp)\n   Type: \(.errorType)\n   Severity: \(.severity)\n   Message: \(.errorMessage)\n   Device: \(.deviceModel // "Unknown")\n   User: \(.userId // "Not logged in")\n"'
        echo ""
        PREVIOUS_COUNT=$CURRENT_COUNT
    fi
    
    sleep 10
done

