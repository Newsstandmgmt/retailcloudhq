#!/bin/bash

# Quick setup script for Lottery Google Sheets integration
# This helps you configure Google Sheets for lottery data syncing

echo "🎫 Lottery Google Sheets Integration Setup"
echo "=========================================="
echo ""

# Check if store ID is provided
if [ -z "$1" ]; then
    echo "Usage: ./setup-lottery-google-sheets.sh STORE_ID"
    echo ""
    echo "Example:"
    echo "  ./setup-lottery-google-sheets.sh 73fd0761-02a3-4168-93fb-e3b8d7c8c6de"
    exit 1
fi

STORE_ID=$1
API_URL="${API_URL:-http://localhost:3000}"

echo "Store ID: $STORE_ID"
echo "API URL: $API_URL"
echo ""

# Check if token is provided
if [ -z "$TOKEN" ]; then
    echo "⚠️  No TOKEN environment variable set."
    echo "   Please login first and set your token:"
    echo "   export TOKEN=\$(curl -s -X POST $API_URL/api/auth/login \\"
    echo "     -H 'Content-Type: application/json' \\"
    echo "     -d '{\"email\":\"patelmit101@gmail.com\",\"password\":\"Retail123\"}' \\"
    echo "     | grep -o '\"token\":\"[^\"]*' | cut -d'\"' -f4)"
    echo ""
    read -p "Enter your auth token (or press Enter to exit): " TOKEN
    if [ -z "$TOKEN" ]; then
        exit 1
    fi
fi

echo ""
echo "📋 Step 1: Enter your Google Sheet details"
echo "-------------------------------------------"
read -p "Spreadsheet ID (from Google Sheets URL): " SPREADSHEET_ID
read -p "Sheet Name (tab name, e.g., 'Sheet1'): " SHEET_NAME
read -p "Service Account JSON Key (paste the JSON or file path): " SERVICE_ACCOUNT_KEY

# Check if it's a file path
if [ -f "$SERVICE_ACCOUNT_KEY" ]; then
    SERVICE_ACCOUNT_KEY=$(cat "$SERVICE_ACCOUNT_KEY")
fi

echo ""
echo "🧪 Step 2: Testing connection..."
echo "-------------------------------------------"

TEST_RESPONSE=$(curl -s -X POST "$API_URL/api/google-sheets/store/$STORE_ID/test" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"spreadsheet_id\": \"$SPREADSHEET_ID\",
    \"sheet_name\": \"$SHEET_NAME\",
    \"service_account_key\": $SERVICE_ACCOUNT_KEY
  }")

if echo "$TEST_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Connection successful!"
    echo ""
    echo "📊 Detected headers:"
    echo "$TEST_RESPONSE" | python3 -m json.tool 2>/dev/null | grep -A 50 '"headers"' | head -30
else
    echo "❌ Connection failed!"
    echo "$TEST_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$TEST_RESPONSE"
    exit 1
fi

echo ""
read -p "Continue with setup? (y/n): " CONTINUE
if [ "$CONTINUE" != "y" ]; then
    exit 0
fi

echo ""
echo "💾 Step 3: Saving configuration..."
echo "-------------------------------------------"

# Read the column mapping from the config file
COLUMN_MAPPING=$(cat config/LOTTERY_GOOGLE_SHEETS_CONFIG.json)

CONFIG_RESPONSE=$(curl -s -X POST "$API_URL/api/google-sheets/store/$STORE_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"spreadsheet_id\": \"$SPREADSHEET_ID\",
    \"sheet_name\": \"$SHEET_NAME\",
    \"service_account_key\": $SERVICE_ACCOUNT_KEY,
    \"auto_sync_enabled\": true,
    \"sync_frequency\": \"daily\",
    \"column_mapping\": $COLUMN_MAPPING
  }")

if echo "$CONFIG_RESPONSE" | grep -q '"message"'; then
    echo "✅ Configuration saved successfully!"
    echo ""
    echo "🔄 Step 4: Testing manual sync..."
    echo "-------------------------------------------"
    
    SYNC_RESPONSE=$(curl -s -X POST "$API_URL/api/google-sheets/store/$STORE_ID/sync" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"sync_type": "lottery"}')
    
    echo "$SYNC_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$SYNC_RESPONSE"
    
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "📝 Next steps:"
    echo "  - Data will sync automatically daily at 2 AM"
    echo "  - You can trigger manual sync via API"
    echo "  - Check sync logs: GET /api/google-sheets/store/$STORE_ID/logs"
else
    echo "❌ Configuration failed!"
    echo "$CONFIG_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CONFIG_RESPONSE"
    exit 1
fi

