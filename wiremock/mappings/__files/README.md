# WireMock Mappings

This directory contains WireMock stub mappings for the Nexval Attendance API.

## Structure

Each JSON file represents a stub mapping with:
- Request matching criteria (method, URL, headers, body patterns)
- Response (status, headers, body)

## Running WireMock

### Using Docker:
```bash
docker run -it --rm \
  -p 8080:8080 \
  -v $(pwd)/mappings:/home/wiremock/mappings \
  wiremock/wiremock:latest
```

### Using Java:
```bash
java -jar wiremock-jre8-standalone.jar --port 8080
```

### Using npm:
```bash
npx wiremock --port 8080 --root-dir ./mappings
```

## API Endpoints

All endpoints are prefixed with `/api`:

- **Auth APIs**: `/api/auth/*`
- **Attendance APIs**: `/api/attendance/*`
- **Invite APIs**: `/api/invite/*`
- **License APIs**: `/api/license/*`
- **Members APIs**: `/api/members/*`
- **Organization APIs**: `/api/organization/*`
- **Seed APIs**: `/api/seed/*`

## Default Port

WireMock runs on port `8080` by default. Update your API base URL to:
```
http://localhost:8080/api
```

