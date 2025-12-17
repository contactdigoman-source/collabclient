# Viewing WireMock Mappings

## ❌ Swagger/OpenAPI

WireMock **does NOT have Swagger/OpenAPI** documentation out of the box. However, WireMock provides several ways to view and manage your API stubs.

## ✅ WireMock Admin API

WireMock exposes an Admin API at `/__admin` that provides all the information you need.

### 1. Admin UI (Newer Versions)

WireMock Standalone (2.35.0+) includes a built-in Admin UI:

**URL:** `http://localhost:8080/__admin/webapp`

This provides a web interface to:
- View all mappings
- Create/edit/delete mappings
- View request logs
- Test mappings

### 2. List All Mappings (JSON API)

**Get all mappings:**
```bash
curl http://localhost:8080/__admin/mappings
```

**Response:** JSON array of all stub mappings

**Pretty print:**
```bash
curl http://localhost:8080/__admin/mappings | jq .
```

### 3. Get Single Mapping by ID

```bash
curl http://localhost:8080/__admin/mappings/{mapping-id}
```

### 4. Search Mappings

```bash
# Find mappings by URL pattern
curl "http://localhost:8080/__admin/mappings/find-by-metadata?matchesJSONPath=$[?(@.request.url =~ /.*auth.*/i)]"
```

### 5. Health Check

```bash
curl http://localhost:8080/__admin/health
```

## 📋 Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/__admin` | GET | Admin API root |
| `/__admin/webapp` | GET | Admin UI (if available) |
| `/__admin/mappings` | GET | List all mappings |
| `/__admin/mappings` | POST | Create new mapping |
| `/__admin/mappings/{id}` | GET | Get specific mapping |
| `/__admin/mappings/{id}` | DELETE | Delete mapping |
| `/__admin/reset` | POST | Reset all mappings |
| `/__admin/requests` | GET | View request logs |
| `/__admin/scenarios` | GET | View scenarios |
| `/__admin/health` | GET | Health check |

## 🔍 Viewing Our Mappings

### List All Mappings

```bash
curl http://localhost:8080/__admin/mappings | jq '.mappings[] | {id: .id, name: .name, request: .request}'
```

### Count Mappings

```bash
curl http://localhost:8080/__admin/mappings | jq '.mappings | length'
```

### List by Service/Endpoint

```bash
# Auth endpoints
curl http://localhost:8080/__admin/mappings | jq '.mappings[] | select(.request.url | contains("/api/auth"))'

# Attendance endpoints
curl http://localhost:8080/__admin/mappings | jq '.mappings[] | select(.request.url | contains("/api/attendance"))'
```

## 📝 Generate Swagger/OpenAPI from WireMock (Optional)

If you want Swagger documentation, you can:

### Option 1: Create a Script to Convert WireMock to OpenAPI

Create `scripts/generate-openapi-from-wiremock.js`:

```javascript
const fs = require('fs');
const axios = require('axios');

async function generateOpenAPI() {
  try {
    // Fetch all mappings from WireMock
    const response = await axios.get('http://localhost:8080/__admin/mappings');
    const mappings = response.data.mappings || [];

    // Convert to OpenAPI 3.0 format
    const openAPI = {
      openapi: '3.0.0',
      info: {
        title: 'ColabClient API (WireMock Stubs)',
        version: '1.0.0',
        description: 'API documentation generated from WireMock mappings',
      },
      servers: [
        {
          url: 'http://localhost:8080',
          description: 'WireMock Server',
        },
      ],
      paths: {},
    };

    // Convert each mapping to OpenAPI path
    mappings.forEach(mapping => {
      const method = mapping.request.method?.toLowerCase() || 'get';
      const url = mapping.request.url || mapping.request.urlPattern || '';
      
      // Extract path (remove query params)
      const path = url.split('?')[0].replace('/api', '');
      
      if (!openAPI.paths[path]) {
        openAPI.paths[path] = {};
      }

      openAPI.paths[path][method] = {
        summary: mapping.name || `${method.toUpperCase()} ${path}`,
        description: mapping.request.description || '',
        responses: {
          [mapping.response.status || 200]: {
            description: 'Success',
            content: {
              'application/json': {
                example: mapping.response.jsonBody || mapping.response.body,
              },
            },
          },
        },
      };
    });

    // Write to file
    fs.writeFileSync('wiremock/openapi.json', JSON.stringify(openAPI, null, 2));
    console.log('✅ OpenAPI spec generated: wiremock/openapi.json');
  } catch (error) {
    console.error('Error generating OpenAPI:', error.message);
  }
}

generateOpenAPI();
```

### Option 2: Use WireMock Admin UI

If you're using WireMock Standalone 2.35.0+, the Admin UI provides a visual way to browse all mappings.

### Option 3: Use Postman/Insomnia

Import WireMock mappings directly:
1. Export mappings: `curl http://localhost:8080/__admin/mappings > mappings.json`
2. Import to Postman/Insomnia

## 🛠️ Useful Scripts

### Script to List All Endpoints

Create `scripts/list-wiremock-endpoints.sh`:

```bash
#!/bin/bash

echo "📋 WireMock API Endpoints"
echo "=========================="
echo ""

curl -s http://localhost:8080/__admin/mappings | \
  jq -r '.mappings[] | 
    "\(.request.method // "GET") \(.request.url // .request.urlPattern // "N/A") -> \(.response.status // 200)"' | \
  sort | \
  column -t
```

### Script to Export All Mappings

```bash
#!/bin/bash

echo "📦 Exporting WireMock mappings..."

curl -s http://localhost:8080/__admin/mappings > wiremock/mappings-export.json

echo "✅ Exported to wiremock/mappings-export.json"
echo "📊 Total mappings: $(jq '.mappings | length' wiremock/mappings-export.json)"
```

## 🌐 Browser Access

### Admin UI (if available)
Open in browser: `http://localhost:8080/__admin/webapp`

### JSON View
Open in browser: `http://localhost:8080/__admin/mappings`

For pretty JSON, use a browser extension like "JSON Formatter" or visit:
```
http://localhost:8080/__admin/mappings?pretty=true
```

## 📊 Summary

- ✅ **No Swagger** - WireMock doesn't provide Swagger/OpenAPI out of the box
- ✅ **Admin API** - Use `/__admin/mappings` to list all stubs
- ✅ **Admin UI** - Available in newer WireMock versions at `/__admin/webapp`
- ✅ **JSON API** - Full REST API for managing mappings
- ⚠️ **Custom Solution** - Can generate OpenAPI from mappings (see above)

## Quick Commands

```bash
# List all mappings
curl http://localhost:8080/__admin/mappings | jq .

# Count mappings
curl http://localhost:8080/__admin/mappings | jq '.mappings | length'

# View in browser
open http://localhost:8080/__admin/webapp  # macOS
# or
xdg-open http://localhost:8080/__admin/webapp  # Linux

# Health check
curl http://localhost:8080/__admin/health
```



