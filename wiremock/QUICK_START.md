# WireMock Quick Start Guide

## 🚀 Starting WireMock

### Option 1: Using the Start Script (Recommended for Development)

```bash
# From project root
./scripts/start-wiremock.sh

# Or using npm script
npm run wiremock:start
```

This will:
- Start WireMock on port 8080
- Mount your local `mappings/` folder (live reload)
- Make it available at http://localhost:8080

### Option 2: Build, Push & Start (All-in-One)

```bash
# Build and start locally (no push)
./scripts/build-push-start-wiremock.sh

# Build, push to Docker Hub, and start
./scripts/build-push-start-wiremock.sh latest your-username true

# Use existing image from registry and start
./scripts/build-push-start-wiremock.sh latest your-username false true

# Using npm
npm run wiremock:build-push-start
```

### Option 3: Using Docker Compose Directly

```bash
cd wiremock
docker-compose up -d
```

## 🛑 Stopping WireMock

```bash
# Using script
cd wiremock && docker-compose down

# Or using npm script
npm run wiremock:stop
```

## 📊 Verify WireMock is Running

```bash
# Check health
curl http://localhost:8080/__admin/health

# View admin UI
open http://localhost:8080/__admin

# View logs
cd wiremock && docker-compose logs -f
```

## 🐳 Building and Pushing Docker Image

### Quick: Build, Push & Start in One Command

```bash
# Build, push to Docker Hub, and start
./scripts/build-push-start-wiremock.sh latest your-username true
```

### Manual Steps

#### Step 1: Build Custom Image (with mappings baked in)

```bash
cd wiremock
docker build -t colabclient-wiremock:latest .
```

#### Step 2: Test the Image Locally

```bash
# Run the built image
docker run -d -p 8080:8080 --name wiremock-test colabclient-wiremock:latest

# Verify it works
curl http://localhost:8080/__admin/health

# Stop test container
docker stop wiremock-test && docker rm wiremock-test
```

#### Step 3: Tag for Docker Hub

```bash
# Replace YOUR_USERNAME with your Docker Hub username
docker tag colabclient-wiremock:latest YOUR_USERNAME/colabclient-wiremock:latest
docker tag colabclient-wiremock:latest YOUR_USERNAME/colabclient-wiremock:v1.0.0
```

#### Step 4: Push to Docker Hub

```bash
# Login to Docker Hub
docker login

# Push the image
docker push YOUR_USERNAME/colabclient-wiremock:latest
docker push YOUR_USERNAME/colabclient-wiremock:v1.0.0
```

#### Step 5: Use from Registry

Update `docker-compose.prod.yml`:

```yaml
services:
  wiremock:
    image: YOUR_USERNAME/colabclient-wiremock:latest
```

Then run:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 📱 Accessing WireMock from Devices

- **Android Emulator**: `http://10.0.2.2:8080`
- **iOS Simulator**: `http://localhost:8080`
- **Physical Device**: `http://<your-computer-ip>:8080`

Find your IP:
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Or
ipconfig getifaddr en0  # macOS
```

## 🔄 Development vs Production

### Development (Current Setup)
- ✅ Uses volume mounting (live reload)
- ✅ Edit mappings locally, see changes immediately
- ✅ No need to rebuild image

```bash
docker-compose up -d
```

### Production
- ✅ Mappings baked into image
- ✅ Version controlled with tags
- ✅ Easy to deploy anywhere

```bash
docker build -t colabclient-wiremock:latest .
docker push YOUR_USERNAME/colabclient-wiremock:latest
```

## 📝 Quick Commands Reference

```bash
# Start (development with live reload)
./scripts/start-wiremock.sh

# Build, push & start (all-in-one)
./scripts/build-push-start-wiremock.sh latest your-username true

# Stop
cd wiremock && docker-compose down

# View logs
cd wiremock && docker-compose logs -f

# Build image only
cd wiremock && docker build -t colabclient-wiremock:latest .

# Push to Docker Hub
docker login
docker tag colabclient-wiremock:latest YOUR_USERNAME/colabclient-wiremock:latest
docker push YOUR_USERNAME/colabclient-wiremock:latest

# List endpoints
./scripts/list-wiremock-endpoints.sh
```

## 🆘 Troubleshooting

### Port 8080 already in use
```bash
# Find what's using port 8080
lsof -i :8080

# Kill the process or change port in docker-compose.yml
```

### Mappings not loading
```bash
# Check mappings directory
ls -la wiremock/mappings/

# Check WireMock logs
cd wiremock && docker-compose logs
```

### Can't access from device
- Ensure WireMock is bound to `0.0.0.0:8080` (not just `localhost`)
- Check firewall settings
- Verify device and computer are on same network
