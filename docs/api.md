# Stackbox API Documentation

## Schemas

### Building

```json
{
  "id": "UUID",
  "name": "string",
  "address": {
    "street": "string",
    "city": "string",
    "state": "string",
    "zip": "string",
    "country": "string"
  },
  "location": {
    "latitude": "number",
    "longitude": "number"
  },
  "metadata": {
    "totalFloors": "integer",
    "heightMeters": "number",
    "floorHeightMeters": "number (optional)",
    "grossSquareFeet": "number (optional)",
    "yearBuilt": "integer (optional)"
  },
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

**Notes:**
- `address` for human-readable location, `location` for map rendering
- `metadata` contains building attributes, easily expandable
- UUIDs used for distributed system compatibility

---

### Tenant

```json
{
  "id": "UUID",
  "name": "string",
  "contact": {
    "email": "string (optional)",
    "phone": "string (optional)"
  },
  "createdAt": "ISO 8601",
  "updatedAt": "ISO 8601"
}
```

**Notes:**
- Tenants stored globally, can appear in multiple buildings

---

### Floor

```json
{
  "floorNumber": "integer",
  "label": "string (optional)",
  "squareFeet": "number (optional)",
  "geometry": "UUID",
  "occupancies": [
    {
      "tenantId": "UUID",
      "squareFeet": "number (optional)",
      "leaseStart": "ISO 8601 date (optional)",
      "leaseEnd": "ISO 8601 date (optional)"
    }
  ]
}
```

### Geometry

```json
{
  "type": "array",
  "items": {
    "type": "array",
    "items" {
      "type": "array",
      "items": ["number", "number"]
    }
  }
}
```

**Notes:**
- `floorNumber`: 0 = ground floor
- `geometry`: List storing floor shape coordinates in the order of magnitude of floors -> floor shapes -> coordinates (optional)
- GeoJSON coordinates use `[longitude, latitude]` order per RFC 7946 specification
- `occupancies` supports multiple tenants per floor. Empty means vacant floor

---

### StackingPlan

```json
{
  "building": Building,
  "tenants": [Tenant, ...],
  "floors": [Floor, ...],
  "geometries": [Geometry, ...]
}
```

---

## API Endpoints

Base: `/api/`

### Buildings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/buildings` | List all buildings |
| `POST` | `/buildings` | Create building |
| `GET` | `/buildings/{id}` | Get building |
| `PUT` | `/buildings/{id}` | Update building |
| `DELETE` | `/buildings/{id}` | Delete building |
| `GET` | `/buildings/{id}/stacking-plan` | Get stacking plan |

**`GET /buildings`**

Query: `page` (default 1), `limit` (default 20, max 100), `city`

Returns: `{ data: [Building, ...], pagination: { page, limit, total, totalPages } }`

**`POST /buildings`**

Body: `Building`

Returns: `201 Created` with `{ data: Building }`

**`GET /buildings/{id}/stacking-plan`**

Returns: `{ data: StackingPlan }`

---

### Tenants

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/tenants` | List all tenants |
| `POST` | `/tenants` | Create tenant |
| `GET` | `/tenants/{id}` | Get tenant |
| `PUT` | `/tenants/{id}` | Update tenant |
| `DELETE` | `/tenants/{id}` | Delete tenant |
| `GET` | `/tenants/{id}/occupancies` | Get tenant occupancies |

**`GET /tenants`**

Query: `search` (filter by name)

Returns: `{ data: [Tenant, ...] }`

**`POST /tenants`**

Body: `Tenant` (without `id`, `createdAt`, `updatedAt`)

Returns: `201 Created` with `{ data: Tenant }`

**`GET /tenants/{id}`**

Returns: `{ data: Tenant }`

**`PUT /tenants/{id}`**

Body: `Tenant` (partial update allowed)

Returns: `{ data: Tenant }`

**`DELETE /tenants/{id}`**

Returns: `204 No Content`

**`GET /tenants/{id}/occupancies`**

Returns:
```json
{
  "data": [
    {
      "buildingId": "UUID",
      "buildingName": "string",
      "floorNumber": "integer",
      "squareFeet": "number",
      "leaseStart": "ISO 8601",
      "leaseEnd": "ISO 8601"
    }
  ]
}
```

---

### Floors

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/buildings/{id}/floors` | List floors |
| `PUT` | `/buildings/{id}/floors/{floorNumber}` | Update floor |
| `POST` | `/buildings/{id}/floors/{floorNumber}/occupancies` | Add tenant |
| `PUT` | `/buildings/{id}/floors/{floorNumber}/occupancies/{tenantId}` | Update occupancy |
| `DELETE` | `/buildings/{id}/floors/{floorNumber}/occupancies/{tenantId}` | Remove tenant |

**`GET /buildings/{id}/floors`**

Returns: `{ data: [Floor, ...] }`

**`PUT /buildings/{id}/floors/{floorNumber}`**

Body: `{ label: "string (optional)", squareFeet: "number (optional)" }` (partial update)

Returns: `{ data: Floor }`

**`POST /buildings/{id}/floors/{floorNumber}/occupancies`**

Body: `{ tenantId: "UUID", squareFeet: "number (optional)", leaseStart: "ISO 8601 (optional)", leaseEnd: "ISO 8601 (optional)" }`

Validation: tenant must exist, valid lease dates

Returns: `201 Created` with `{ data: Floor }`

**`PUT /buildings/{id}/floors/{floorNumber}/occupancies/{tenantId}`**

Body: `{ squareFeet: "number (optional)", leaseStart: "ISO 8601 (optional)", leaseEnd: "ISO 8601 (optional)" }` (partial update)

Returns: `{ data: Floor }`

**`DELETE /buildings/{id}/floors/{floorNumber}/occupancies/{tenantId}`**

Returns: `204 No Content`

---

### File Uploads

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/buildings/{id}/upload/stl` | Upload 3D model |
| `POST` | `/buildings/{id}/upload/excel` | Upload stacking plan |
| `GET` | `/buildings/{id}/processing-status` | Check processing status |

**`POST /buildings/{id}/upload/stl`**

Upload 3D building model for floor geometry extraction.

Body: `file` (STL/GLB), `floorHeight` (meters), `baseElevation` (meters)

Returns: `{ data: { jobId: "UUID", status: "processing", message: "..." } }`

**`POST /buildings/{id}/upload/excel`**

Upload Excel file with stacking plan data.

Body: `file` (.xlsx)

Returns: `{ data: { jobId: "UUID", status: "processing", message: "..." } }`


