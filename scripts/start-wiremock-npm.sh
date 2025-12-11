#!/bin/bash

# Alternative: Start WireMock using npm (if Docker is not available)
# This requires wiremock package to be installed: npm install -g wiremock

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WIREMOCK_DIR="$PROJECT_ROOT/wiremock"

echo "🚀 Starting WireMock with npm..."
echo "📁 Using mappings from: $WIREMOCK_DIR/mappings"
echo "🌐 WireMock will be available at: http://localhost:8080"
echo ""

cd "$WIREMOCK_DIR"

# Check if wiremock is installed
if ! command -v wiremock &> /dev/null; then
    echo "📦 Installing wiremock package..."
    npm install -g wiremock
fi

# Check if port 8080 is already in use
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Port 8080 is already in use. Please stop the service using port 8080 first."
    exit 1
fi

# Start WireMock
echo "🌐 Starting WireMock on port 8080..."
wiremock --port 8080 --root-dir ./mappings --global-response-templating --verbose

