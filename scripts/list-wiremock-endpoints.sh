#!/bin/bash

# Script to list all WireMock API endpoints in a readable format

set -e

WIREMOCK_URL="${1:-http://localhost:8080}"

echo "📋 WireMock API Endpoints"
echo "=========================="
echo "Base URL: $WIREMOCK_URL"
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq is not installed. Installing via curl with basic parsing..."
    
    # Fetch mappings and parse without jq
    curl -s "$WIREMOCK_URL/__admin/mappings" | \
      grep -o '"method":"[^"]*"' | sort -u | \
      sed 's/"method":"\(.*\)"/Method: \1/' || echo "❌ Failed to fetch mappings"
    
    echo ""
    echo "💡 Install jq for better formatting: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

# Check if WireMock is running
if ! curl -s "$WIREMOCK_URL/__admin/health" > /dev/null 2>&1; then
    echo "❌ WireMock is not running at $WIREMOCK_URL"
    echo "💡 Start it with: npm run wiremock:start"
    exit 1
fi

# Fetch and format mappings
MAPPINGS=$(curl -s "$WIREMOCK_URL/__admin/mappings")

if [ -z "$MAPPINGS" ]; then
    echo "❌ Failed to fetch mappings"
    exit 1
fi

# Count total mappings
TOTAL=$(echo "$MAPPINGS" | jq '.mappings | length')
echo "📊 Total Mappings: $TOTAL"
echo ""

# List all endpoints
echo "Endpoints:"
echo "$MAPPINGS" | jq -r '.mappings[] | 
  "\(.request.method // "GET" | ascii_upcase) \(.request.url // .request.urlPattern // "N/A") -> \(.response.status // 200)"' | \
  sort | \
  while IFS= read -r line; do
    echo "  $line"
  done

echo ""
echo "🌐 Admin UI: $WIREMOCK_URL/__admin/webapp"
echo "📋 Admin API: $WIREMOCK_URL/__admin/mappings"


