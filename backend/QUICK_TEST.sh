#!/bin/bash

# Quick API Testing Script
# Copy and paste these commands to test your API

BASE_URL="http://localhost:3000"

echo "🧪 RetailCloudHQ API Testing"
echo "=========================================="
echo ""

# 1. Health Check
echo "1️⃣  Testing Health Endpoint..."
curl -s "$BASE_URL/health" | jq '.' || curl -s "$BASE_URL/health"
echo ""
echo ""

# 2. Login and get token
echo "2️⃣  Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patelmit101@gmail.com",
    "password": "Retail123"
  }')

echo "$LOGIN_RESPONSE" | jq '.' || echo "$LOGIN_RESPONSE"

# Extract token (if jq is available)
if command -v jq &> /dev/null; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
else
    # Fallback: extract token manually
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "❌ Failed to get token. Check your credentials."
    exit 1
fi

echo ""
echo "✅ Token obtained: ${TOKEN:0:20}..."
echo ""
echo ""

# 3. Get profile
echo "3️⃣  Getting user profile..."
curl -s -X GET "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq '.' || \
curl -s -X GET "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $TOKEN"
echo ""
echo ""

# 4. Get stores
echo "4️⃣  Getting all stores..."
STORES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/stores" \
  -H "Authorization: Bearer $TOKEN")

echo "$STORES_RESPONSE" | jq '.' || echo "$STORES_RESPONSE"

# Extract first store ID (if jq is available)
if command -v jq &> /dev/null; then
    STORE_ID=$(echo "$STORES_RESPONSE" | jq -r '.stores[0].id // empty')
else
    # Fallback: try to extract UUID
    STORE_ID=$(echo "$STORES_RESPONSE" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
fi

echo ""
echo ""

if [ -n "$STORE_ID" ] && [ "$STORE_ID" != "null" ]; then
    echo "5️⃣  Testing with Store ID: $STORE_ID"
    echo ""
    
    # Get revenue for today
    TODAY=$(date +%Y-%m-%d)
    echo "   Getting revenue for $TODAY..."
    curl -s -X GET "$BASE_URL/api/revenue/$STORE_ID/daily/$TODAY" \
      -H "Authorization: Bearer $TOKEN" | jq '.' || \
    curl -s -X GET "$BASE_URL/api/revenue/$STORE_ID/daily/$TODAY" \
      -H "Authorization: Bearer $TOKEN"
    echo ""
    echo ""
else
    echo "5️⃣  No stores found. Create a store first."
    echo ""
    echo "   Example: Create a store"
    echo "   curl -X POST \"$BASE_URL/api/stores\" \\"
    echo "     -H \"Authorization: Bearer $TOKEN\" \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -d '{\"name\": \"My Store\", \"store_type\": \"galaxy\"}'"
    echo ""
fi

echo "=========================================="
echo "✅ Testing complete!"
echo ""
echo "💡 To use these commands manually:"
echo "   export TOKEN=\"$TOKEN\""
echo "   curl -H \"Authorization: Bearer \$TOKEN\" $BASE_URL/api/stores"

