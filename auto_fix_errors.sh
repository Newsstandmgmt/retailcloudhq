#!/bin/bash

echo "🔧 Auto-Fix and Cleanup Errors"
echo ""

# Function to check and fix common errors
check_and_fix_errors() {
    echo "1. Checking for errors..."
    ERRORS=$(curl -s "http://localhost:3000/api/errors/logs?limit=50")
    ERROR_COUNT=$(echo $ERRORS | jq -r '.logs | length' 2>/dev/null || echo "0")
    
    if [ "$ERROR_COUNT" = "0" ]; then
        echo "   ✅ No errors found"
        return
    fi
    
    echo "   Found $ERROR_COUNT error(s)"
    echo ""
    
    # Check for 401 errors (authentication)
    echo "2. Checking for authentication errors (401)..."
    AUTH_ERRORS=$(echo $ERRORS | jq -r '.logs[] | select(.errorMessage | contains("401") or contains("Unauthorized")) | .timestamp' 2>/dev/null)
    if [ ! -z "$AUTH_ERRORS" ]; then
        echo "   Found authentication errors - these are usually resolved after login"
        echo "   Removing old 401 errors..."
        curl -s -X POST http://localhost:3000/api/errors/resolve \
            -H "Content-Type: application/json" \
            -d '{"errorPattern": "401"}' | jq -r '.message'
    else
        echo "   ✅ No authentication errors"
    fi
    echo ""
    
    # Check for database errors
    echo "3. Checking for database errors..."
    DB_ERRORS=$(echo $ERRORS | jq -r '.logs[] | select(.errorType == "database") | .errorMessage' 2>/dev/null)
    if [ ! -z "$DB_ERRORS" ]; then
        echo "   ⚠️  Found database errors - these may need manual investigation"
        echo "$DB_ERRORS" | while read error; do
            echo "      - $error"
        done
    else
        echo "   ✅ No database errors"
    fi
    echo ""
    
    # Check for network errors
    echo "4. Checking for network errors..."
    NETWORK_ERRORS=$(echo $ERRORS | jq -r '.logs[] | select(.errorType == "network") | .errorMessage' 2>/dev/null)
    if [ ! -z "$NETWORK_ERRORS" ]; then
        echo "   ⚠️  Found network errors - check network connectivity"
        echo "$NETWORK_ERRORS" | while read error; do
            echo "      - $error"
        done
    else
        echo "   ✅ No network errors"
    fi
    echo ""
    
    # Run automatic cleanup
    echo "5. Running automatic cleanup..."
    CLEANUP_RESULT=$(curl -s -X POST http://localhost:3000/api/errors/cleanup)
    REMOVED=$(echo $CLEANUP_RESULT | jq -r '.removed' 2>/dev/null || echo "0")
    REMAINING=$(echo $CLEANUP_RESULT | jq -r '.remaining' 2>/dev/null || echo "0")
    echo "   Removed: $REMOVED resolved errors"
    echo "   Remaining: $REMAINING errors"
    echo ""
    
    # Show remaining errors
    if [ "$REMAINING" != "0" ]; then
        echo "6. Remaining errors that need attention:"
        curl -s "http://localhost:3000/api/errors/logs?limit=10" | jq -r '.logs[] | "   • \(.timestamp) [\(.severity)] \(.errorType): \(.errorMessage[0:80])"'
    else
        echo "6. ✅ All errors have been resolved or cleaned up"
    fi
}

# Run the check
check_and_fix_errors

echo ""
echo "✅ Error check and cleanup complete"

