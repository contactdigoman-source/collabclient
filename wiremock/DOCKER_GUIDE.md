# WireMock Docker Guide

## Why Use Docker for WireMock?

### ✅ Benefits of Docker

1. **Consistency Across Environments**
   - Same WireMock version and configuration everywhere
   - Works identically on macOS, Linux, Windows
   - No Java/Node.js version conflicts

2. **Easy Setup**
   - No need to install Java or WireMock JAR
   - One command: `docker-compose up`
   - Pre-configured and ready to use

3. **Isolation**
   - Doesn't pollute your system with dependencies
   - Easy to remove: `docker-compose down`
   - No conflicts with other services

4. **Portability**
   - Share same setup across team
   - Works in CI/CD pipelines
   - Easy to deploy anywhere Docker runs

5. **Volume Mounting**
   - Live reload of mappings (edit JSON files, see changes)
   - No need to rebuild or restart
   - Easy to version control

6. **Network Isolation**
   - Can run on any port without conflicts
   - Isolated network for multiple services
   - Easy to connect to other containers

### ❌ When NOT to Use Docker

- **Very minimal resource environment** (though WireMock is lightweight)
- **Strict security policies** preventing Docker
- **Need for native performance** (rare for WireMock)

## Current Setup

We're currently using the official WireMock image with volume mounting:

```yaml
# docker-compose.yml
services:
  wiremock:
    image: wiremock/wiremock:latest  # Official image
    volumes:
      - ./mappings:/home/wiremock/mappings  # Mount local mappings
```

**This is great for development** - you edit JSON files locally and they're immediately available.

## Building a Custom Docker Image

If you want to **bake the mappings into the image** (for production/sharing), here's how:

### Option 1: Custom Dockerfile (Recommended)

Create `Dockerfile` in `wiremock/` directory:

```dockerfile
FROM wiremock/wiremock:latest

# Copy all mappings into the image
COPY mappings/ /home/wiremock/mappings/

# WireMock will automatically load mappings from /home/wiremock/mappings
# No additional commands needed
```

Build the image:

```bash
cd colabclient/wiremock
docker build -t colabclient-wiremock:latest .
```

Run it:

```bash
docker run -p 8080:8080 colabclient-wiremock:latest
```

### Option 2: Multi-stage Build (Advanced)

For more control:

```dockerfile
FROM wiremock/wiremock:latest as base

# Copy mappings
COPY --chown=wiremock:wiremock mappings/ /home/wiremock/mappings/

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD curl -f http://localhost:8080/__admin/health || exit 1

# Default command (WireMock auto-starts)
CMD ["--global-response-templating", "--verbose"]
```

### Option 3: With docker-compose

Update `docker-compose.yml` to use your custom image:

```yaml
version: '3.8'

services:
  wiremock:
    build:
      context: .
      dockerfile: Dockerfile
    image: colabclient-wiremock:latest
    container_name: colabclient-wiremock
    ports:
      - "0.0.0.0:8080:8080"
    # No volumes needed - mappings are in image
    command: --global-response-templating --verbose
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/__admin/health"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  default:
    driver: bridge
```

Build and run:

```bash
docker-compose up --build
```

## Pushing to Docker Registry

### Push to Docker Hub

1. **Login to Docker Hub:**
   ```bash
   docker login
   ```

2. **Tag your image:**
   ```bash
   docker tag colabclient-wiremock:latest your-username/colabclient-wiremock:latest
   docker tag colabclient-wiremock:latest your-username/colabclient-wiremock:v1.0.0
   ```

3. **Push the image:**
   ```bash
   docker push your-username/colabclient-wiremock:latest
   docker push your-username/colabclient-wiremock:v1.0.0
   ```

4. **Update docker-compose.yml to use your image:**
   ```yaml
   services:
     wiremock:
       image: your-username/colabclient-wiremock:latest
       # Remove build section if using pre-built image
   ```

### Push to Private Registry (AWS ECR, Azure ACR, etc.)

**AWS ECR Example:**

```bash
# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Tag image
docker tag colabclient-wiremock:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/colabclient-wiremock:latest

# Push
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/colabclient-wiremock:latest
```

**Azure ACR Example:**

```bash
# Login
az acr login --name YOUR_REGISTRY

# Tag
docker tag colabclient-wiremock:latest YOUR_REGISTRY.azurecr.io/colabclient-wiremock:latest

# Push
docker push YOUR_REGISTRY.azurecr.io/colabclient-wiremock:latest
```

## Alternative: Standalone WireMock (No Docker)

### Using Java (Standalone JAR)

```bash
# Download WireMock
wget https://repo1.maven.org/maven2/com/github/tomakehurst/wiremock-jre8-standalone/2.35.0/wiremock-jre8-standalone-2.35.0.jar

# Run with mappings
java -jar wiremock-jre8-standalone-2.35.0.jar \
  --port 8080 \
  --root-dir ./mappings \
  --global-response-templating \
  --verbose
```

### Using npm (WireMock Standalone)

```bash
# Install globally
npm install -g wiremock

# Run
wiremock \
  --port 8080 \
  --root-dir ./mappings \
  --global-response-templating
```

### Using npm Script (Package.json)

Already added in `wiremock/package.json`:

```json
{
  "scripts": {
    "start": "wiremock --port 8080 --root-dir ./mappings --global-response-templating"
  }
}
```

Run: `npm start`

## Comparison: Docker vs Standalone

| Feature | Docker | Standalone (Java/npm) |
|---------|--------|----------------------|
| Setup Complexity | Easy (one command) | Requires Java/npm install |
| Consistency | ✅ Same everywhere | ❌ Version conflicts |
| Isolation | ✅ Complete | ❌ System pollution |
| Portability | ✅ Excellent | ⚠️ Moderate |
| Resource Usage | Lightweight | Lightweight |
| CI/CD Integration | ✅ Excellent | ⚠️ Good |
| Live Reload | ✅ (with volumes) | ✅ |
| Team Sharing | ✅ Easy | ⚠️ Requires same env |

## Recommended Approach

### Development
- ✅ **Use Docker with volume mounting** (current setup)
- Edit mappings locally, see changes immediately
- Easy to share with team via docker-compose.yml

### Production/CI/CD
- ✅ **Build custom Docker image** with mappings baked in
- Push to registry (Docker Hub, ECR, ACR)
- Version control with tags (v1.0.0, v1.1.0, etc.)
- Easy to deploy anywhere

### Sharing with Team
- ✅ **Both approaches work:**
  - Share `docker-compose.yml` + `mappings/` folder
  - OR share pre-built Docker image from registry

## Quick Commands Reference

```bash
# Development (with volume mounting - current setup)
docker-compose up -d

# Build custom image
docker build -t colabclient-wiremock:latest .

# Tag for registry
docker tag colabclient-wiremock:latest your-username/colabclient-wiremock:latest

# Push to Docker Hub
docker push your-username/colabclient-wiremock:latest

# Pull and run from registry
docker pull your-username/colabclient-wiremock:latest
docker run -p 8080:8080 your-username/colabclient-wiremock:latest

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Next Steps

1. **For Development:** Continue using current setup (Docker with volumes)
2. **For Production:** Create Dockerfile and build custom image
3. **For Sharing:** Push to Docker Hub or your organization's registry


