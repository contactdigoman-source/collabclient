#!/bin/bash

# Build, Push, and Start WireMock Docker Image
# This script builds a custom WireMock image with mappings, optionally pushes to registry, and starts it

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WIREMOCK_DIR="$PROJECT_ROOT/wiremock"

# Configuration
IMAGE_NAME="colabclient-wiremock"
VERSION="${1:-latest}"
REGISTRY="${2:-}"  # Optional: Docker Hub username or registry URL
PUSH_IMAGE="${3:-false}"  # Set to "true" to push to registry
USE_REGISTRY_IMAGE="${4:-false}"  # Set to "true" to use registry image instead of building

echo "🚀 WireMock Build, Push & Start Script"
echo "========================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

cd "$WIREMOCK_DIR"

# Step 1: Build the image
if [ "$USE_REGISTRY_IMAGE" = "false" ]; then
    echo "📦 Step 1: Building Docker image..."
    echo "   Image: ${IMAGE_NAME}:${VERSION}"
    echo ""
    
    docker build -t ${IMAGE_NAME}:${VERSION} .
    docker tag ${IMAGE_NAME}:${VERSION} ${IMAGE_NAME}:latest
    
    echo "✅ Image built successfully!"
    echo ""
else
    echo "📦 Step 1: Using registry image (skipping build)"
    echo ""
fi

# Step 2: Tag and push to registry (if registry provided)
if [ -n "$REGISTRY" ] && [ "$PUSH_IMAGE" = "true" ]; then
    echo "🏷️  Step 2: Tagging and pushing to registry..."
    echo "   Registry: ${REGISTRY}"
    echo ""
    
    # Check if logged in to Docker Hub
    if [[ "$REGISTRY" != *"ecr"* ]] && [[ "$REGISTRY" != *"azurecr"* ]] && [[ "$REGISTRY" != *"gcr.io"* ]]; then
        if ! docker info | grep -q "Username"; then
            echo "🔐 Please login to Docker Hub first:"
            echo "   docker login"
            read -p "Press Enter after logging in..."
        fi
    fi
    
    # Tag for registry
    REGISTRY_IMAGE="${REGISTRY}/${IMAGE_NAME}"
    docker tag ${IMAGE_NAME}:${VERSION} ${REGISTRY_IMAGE}:${VERSION}
    docker tag ${IMAGE_NAME}:latest ${REGISTRY_IMAGE}:latest
    
    echo "   Tagged: ${REGISTRY_IMAGE}:${VERSION}"
    echo "   Tagged: ${REGISTRY_IMAGE}:latest"
    echo ""
    
    # Push to registry
    echo "📤 Pushing to registry..."
    docker push ${REGISTRY_IMAGE}:${VERSION}
    docker push ${REGISTRY_IMAGE}:latest
    
    echo "✅ Image pushed successfully!"
    echo ""
    
    # Update image name to use registry version
    IMAGE_NAME="${REGISTRY_IMAGE}"
elif [ -n "$REGISTRY" ] && [ "$USE_REGISTRY_IMAGE" = "true" ]; then
    # Use registry image directly
    IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}"
    echo "📥 Step 2: Using registry image: ${IMAGE_NAME}:${VERSION}"
    echo ""
    
    # Pull latest image
    docker pull ${IMAGE_NAME}:${VERSION} || docker pull ${IMAGE_NAME}:latest
    docker tag ${IMAGE_NAME}:${VERSION} ${IMAGE_NAME}:latest 2>/dev/null || true
else
    echo "📦 Step 2: Skipping push (no registry provided or push disabled)"
    echo ""
fi

# Step 3: Stop existing container
echo "🛑 Step 3: Stopping existing WireMock container (if running)..."
if docker ps -a | grep -q "colabclient-wiremock"; then
    docker stop colabclient-wiremock > /dev/null 2>&1 || true
    docker rm colabclient-wiremock > /dev/null 2>&1 || true
    echo "   ✅ Stopped existing container"
else
    echo "   ℹ️  No existing container found"
fi
echo ""

# Step 4: Start WireMock
echo "🚀 Step 4: Starting WireMock..."
echo "   Image: ${IMAGE_NAME}:${VERSION}"
echo "   Port: 8080"
echo ""

# Determine which docker-compose file to use
if [ -n "$REGISTRY" ] && [ "$USE_REGISTRY_IMAGE" = "true" ]; then
    # Use production compose file with registry image
    COMPOSE_FILE="docker-compose.prod.yml"
    # Update the image in the compose file temporarily
    sed -i.bak "s|image:.*|image: ${IMAGE_NAME}:${VERSION}|" docker-compose.prod.yml
    docker-compose -f docker-compose.prod.yml up -d
    # Restore original file
    mv docker-compose.prod.yml.bak docker-compose.prod.yml 2>/dev/null || true
else
    # Use regular compose file but with custom image
    # Create a temporary compose file (without version - it's obsolete in newer docker-compose)
    cat > docker-compose.temp.yml <<EOF
services:
  wiremock:
    image: ${IMAGE_NAME}:${VERSION}
    container_name: colabclient-wiremock
    ports:
      - "0.0.0.0:8080:8080"
    command: --global-response-templating --verbose --disable-request-logging=false
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/__admin/health"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - wiremock-network
    restart: unless-stopped

networks:
  wiremock-network:
    driver: bridge
EOF
    docker-compose -f docker-compose.temp.yml up -d
    rm docker-compose.temp.yml
fi

# Wait for WireMock to start
echo "⏳ Waiting for WireMock to start..."
sleep 5

# Step 5: Verify WireMock is running
echo ""
echo "🔍 Step 5: Verifying WireMock..."

# Try multiple times with retries
MAX_RETRIES=6
RETRY_COUNT=0
WIREMOCK_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:8080/__admin/health > /dev/null 2>&1; then
        WIREMOCK_READY=true
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "   Attempt $RETRY_COUNT/$MAX_RETRIES: Waiting for WireMock..."
    sleep 2
done

if [ "$WIREMOCK_READY" = true ]; then
    echo "✅ WireMock is running successfully!"
    echo ""
    echo "📊 Admin UI: http://localhost:8080/__admin"
    echo "🌐 API Base URL: http://localhost:8080/api"
    echo ""
    echo "📱 For Android Emulator: http://10.0.2.2:8080"
    echo "📱 For iOS Simulator: http://localhost:8080"
    echo "📱 For Physical Device: http://$(ipconfig getifaddr en0 2>/dev/null || hostname -I | awk '{print $1}'):8080"
    echo ""
    echo "📝 Useful commands:"
    echo "   View logs: cd wiremock && docker-compose logs -f"
    echo "   Stop: cd wiremock && docker-compose down"
    echo "   List endpoints: ./scripts/list-wiremock-endpoints.sh"
else
    echo "⚠️  WireMock may still be starting. Check logs:"
    echo "   cd wiremock && docker-compose logs"
fi

echo ""
echo "✨ Done!"

