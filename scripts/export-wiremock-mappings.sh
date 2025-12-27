#!/bin/bash

# Script to export all WireMock mappings to a JSON file

set -e

WIREMOCK_URL="${1:-http://localhost:8080}"
OUTPUT_FILE="${2:-wiremock/mappings-export.json}"

echo "📦 Exporting WireMock mappings..."
echo "Source: $WIREMOCK_URL/__admin/mappings"
echo "Output: $OUTPUT_FILE"
echo ""

# Check if WireMock is running
if ! curl -s "$WIREMOCK_URL/__admin/health" > /dev/null 2>&1; then
    echo "❌ WireMock is not running at $WIREMOCK_URL"
    echo "💡 Start it with: npm run wiremock:start"
    exit 1
fi

# Create directory if it doesn't exist
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Fetch and save mappings
curl -s "$WIREMOCK_URL/__admin/mappings" > "$OUTPUT_FILE"

# Check if jq is available for pretty printing and counting
if command -v jq &> /dev/null; then
    TOTAL=$(jq '.mappings | length' "$OUTPUT_FILE")
    echo "✅ Exported $TOTAL mappings to $OUTPUT_FILE"
    
    # Also create a pretty-printed version
    PRETTY_FILE="${OUTPUT_FILE%.json}-pretty.json"
    jq '.' "$OUTPUT_FILE" > "$PRETTY_FILE"
    echo "✨ Pretty-printed version: $PRETTY_FILE"
else
    echo "✅ Exported mappings to $OUTPUT_FILE"
    echo "💡 Install jq for better formatting: brew install jq"
fi







