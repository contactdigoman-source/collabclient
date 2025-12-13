# Building and Pushing WireMock Docker Image

## Quick Start

### 1. Build Custom Image

```bash
cd colabclient/wiremock
docker build -t colabclient-wiremock:latest .
```

### 2. Test Locally

```bash
docker run -p 8080:8080 colabclient-wiremock:latest
```

Open http://localhost:8080/__admin to verify it's working.

### 3. Push to Docker Hub

```bash
# Login to Docker Hub
docker login

# Tag for Docker Hub (replace YOUR_USERNAME)
docker tag colabclient-wiremock:latest YOUR_USERNAME/colabclient-wiremock:latest
docker tag colabclient-wiremock:latest YOUR_USERNAME/colabclient-wiremock:v1.0.0

# Push
docker push YOUR_USERNAME/colabclient-wiremock:latest
docker push YOUR_USERNAME/colabclient-wiremock:v1.0.0
```

### 4. Use from Registry

Update `docker-compose.prod.yml`:

```yaml
services:
  wiremock:
    image: YOUR_USERNAME/colabclient-wiremock:latest
```

Then run:

```bash
docker-compose -f docker-compose.prod.yml up
```

## Detailed Steps

### Step 1: Build Image with Version Tag

```bash
cd colabclient/wiremock

# Build with version tag
docker build -t colabclient-wiremock:v1.0.0 .
docker build -t colabclient-wiremock:latest .
```

### Step 2: Test the Image

```bash
# Run container
docker run -d -p 8080:8080 --name wiremock-test colabclient-wiremock:latest

# Check health
curl http://localhost:8080/__admin/health

# Check mappings loaded
curl http://localhost:8080/__admin/mappings

# Stop test container
docker stop wiremock-test
docker rm wiremock-test
```

### Step 3: Tag for Registry

**For Docker Hub:**
```bash
docker tag colabclient-wiremock:latest YOUR_USERNAME/colabclient-wiremock:latest
docker tag colabclient-wiremock:v1.0.0 YOUR_USERNAME/colabclient-wiremock:v1.0.0
```

**For AWS ECR:**
```bash
docker tag colabclient-wiremock:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/colabclient-wiremock:latest
```

**For Azure ACR:**
```bash
docker tag colabclient-wiremock:latest YOUR_REGISTRY.azurecr.io/colabclient-wiremock:latest
```

### Step 4: Push to Registry

**Docker Hub:**
```bash
docker login
docker push YOUR_USERNAME/colabclient-wiremock:latest
docker push YOUR_USERNAME/colabclient-wiremock:v1.0.0
```

**AWS ECR:**
```bash
# Get login token
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Create repository (if doesn't exist)
aws ecr create-repository --repository-name colabclient-wiremock --region us-east-1

# Push
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/colabclient-wiremock:latest
```

**Azure ACR:**
```bash
# Login
az acr login --name YOUR_REGISTRY

# Push
docker push YOUR_REGISTRY.azurecr.io/colabclient-wiremock:latest
```

**Google Container Registry (GCR):**
```bash
# Configure Docker for GCR
gcloud auth configure-docker

# Tag
docker tag colabclient-wiremock:latest gcr.io/YOUR_PROJECT/colabclient-wiremock:latest

# Push
docker push gcr.io/YOUR_PROJECT/colabclient-wiremock:latest
```

### Step 5: Pull and Use

```bash
# Pull from registry
docker pull YOUR_USERNAME/colabclient-wiremock:latest

# Run
docker run -p 8080:8080 YOUR_USERNAME/colabclient-wiremock:latest

# Or use docker-compose
docker-compose -f docker-compose.prod.yml up
```

## Automated Build Script

Create `scripts/build-and-push.sh`:

```bash
#!/bin/bash

set -e

# Configuration
IMAGE_NAME="colabclient-wiremock"
VERSION="${1:-latest}"
REGISTRY="${2:-}"  # e.g., "your-username" for Docker Hub

echo "Building ${IMAGE_NAME}:${VERSION}..."

cd "$(dirname "$0")/../wiremock"
docker build -t ${IMAGE_NAME}:${VERSION} .
docker tag ${IMAGE_NAME}:${VERSION} ${IMAGE_NAME}:latest

if [ -n "$REGISTRY" ]; then
  echo "Tagging for registry: ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
  docker tag ${IMAGE_NAME}:${VERSION} ${REGISTRY}/${IMAGE_NAME}:${VERSION}
  docker tag ${IMAGE_NAME}:latest ${REGISTRY}/${IMAGE_NAME}:latest
  
  echo "Pushing to registry..."
  docker push ${REGISTRY}/${IMAGE_NAME}:${VERSION}
  docker push ${REGISTRY}/${IMAGE_NAME}:latest
  echo "✅ Pushed to ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
else
  echo "✅ Built ${IMAGE_NAME}:${VERSION} (local only)"
  echo "To push to registry, provide registry name as second argument"
fi
```

Usage:
```bash
# Build only
./scripts/build-and-push.sh v1.0.0

# Build and push to Docker Hub
./scripts/build-and-push.sh v1.0.0 your-username
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Push WireMock Image

on:
  push:
    tags:
      - 'wiremock-v*'
    paths:
      - 'colabclient/wiremock/**'

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Extract version
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/wiremock-v}" >> $GITHUB_OUTPUT
      
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: ./colabclient/wiremock
          push: true
          tags: |
            your-username/colabclient-wiremock:latest
            your-username/colabclient-wiremock:v${{ steps.version.outputs.VERSION }}
```

## Versioning Strategy

Recommendation:
- `latest` - Always points to most recent stable version
- `v1.0.0`, `v1.1.0` - Semantic versioning for releases
- `dev`, `staging` - Environment-specific tags
- `commit-sha` - Specific commit builds

Example:
```bash
docker tag colabclient-wiremock:latest your-username/colabclient-wiremock:latest
docker tag colabclient-wiremock:latest your-username/colabclient-wiremock:v1.0.0
docker tag colabclient-wiremock:latest your-username/colabclient-wiremock:dev
```

## Troubleshooting

### Image too large
- Check `.dockerignore` excludes unnecessary files
- Use multi-stage builds if needed
- Compress mappings if possible

### Mappings not loading
- Verify `COPY mappings/` in Dockerfile
- Check mappings are valid JSON
- Check WireMock logs: `docker logs container-name`

### Push fails
- Verify login: `docker login`
- Check permissions for registry
- Verify image is tagged correctly

## Summary

**Development:** Use Docker with volume mounting (current setup)
**Production:** Build custom image and push to registry
**Sharing:** Push to Docker Hub or organization registry


