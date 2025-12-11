#!/bin/bash

# Start WireMock locally using Docker
# This script starts WireMock on port 8080 with the mappings from wiremock/mappings

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WIREMOCK_DIR="$PROJECT_ROOT/wiremock"

echo "🚀 Starting WireMock..."
echo "📁 Using mappings from: $WIREMOCK_DIR/mappings"
echo "🌐 WireMock will be available at: http://localhost:8080"
echo ""

cd "$WIREMOCK_DIR"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Stop existing WireMock container if running
if docker ps -a | grep -q "colabclient-wiremock"; then
    echo "🛑 Stopping existing WireMock container..."
    docker stop colabclient-wiremock > /dev/null 2>&1 || true
    docker rm colabclient-wiremock > /dev/null 2>&1 || true
fi

# Start WireMock with Docker Compose
echo "🐳 Starting WireMock with Docker..."
docker-compose up -d

# Wait a moment for WireMock to start
sleep 2

# Check if WireMock is running
if curl -s http://localhost:8080/__admin/health > /dev/null 2>&1; then
    echo "✅ WireMock is running successfully!"
    echo ""
    echo "📊 Admin UI: http://localhost:8080/__admin"
    echo "🌐 API Base URL: http://localhost:8080/api"
    echo ""
    echo "📝 To view logs: cd wiremock && docker-compose logs -f"
    echo "🛑 To stop: cd wiremock && docker-compose down"
    echo ""
    echo "📱 For Android Emulator, use: http://10.0.2.2:8080"
    echo "📱 For iOS Simulator, use: http://localhost:8080"
    echo "📱 For Physical Device, use: http://<your-computer-ip>:8080"
else
    echo "⚠️  WireMock may still be starting. Please check logs:"
    echo "   cd wiremock && docker-compose logs"
fi

