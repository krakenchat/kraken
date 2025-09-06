# [ControllerName] API

> **Base URL:** `/api/[route-prefix]`  
> **Controller:** `backend/src/[path]/[controller-name].controller.ts`  
> **Service:** `backend/src/[path]/[service-name].service.ts`

## Overview

[Brief description of what this API manages and its primary use cases]

## Authentication

- **Required:** ✅ All endpoints require authentication
- **Token Type:** JWT Bearer token
- **Headers:** `Authorization: Bearer <jwt_token>`

## Endpoints Summary

| Method | Endpoint | Description | RBAC Permission |
|--------|----------|-------------|-----------------|
| GET | `/` | [List entities] | `VIEW_[ENTITY]` |
| GET | `/:id` | [Get entity by ID] | `VIEW_[ENTITY]` |
| POST | `/` | [Create entity] | `CREATE_[ENTITY]` |
| PUT | `/:id` | [Update entity] | `UPDATE_[ENTITY]` |
| DELETE | `/:id` | [Delete entity] | `DELETE_[ENTITY]` |

---

## GET `/api/[route-prefix]`

**Description:** [What this endpoint returns]

### Request

**Query Parameters:**
```typescript
{
  page?: number;        // Page number (default: 1)
  limit?: number;       // Items per page (default: 20, max: 100)
  search?: string;      // Search term for filtering
  sortBy?: string;      // Field to sort by
  sortOrder?: 'asc' | 'desc'; // Sort direction
  [filterField]?: string; // Specific filters
}
```

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/[route-prefix]?page=1&limit=10&search=example"
```

### Response

**Success (200):**
```json
{
  "data": [
    {
      "id": "string",
      "[field]": "string",
      "[optionalField]": "string",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `500 Internal Server Error` - Server error

---

## GET `/api/[route-prefix]/:id`

**Description:** [What single entity data is returned]

### Request

**Path Parameters:**
- `id` (string, required) - [Entity] ID

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/[route-prefix]/64f7b1234567890abcdef123"
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef123",
  "[field]": "string",
  "[optionalField]": "string",
  "[relations]": [
    {
      "id": "string",
      "[relatedField]": "string"
    }
  ],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - [Entity] not found
- `500 Internal Server Error` - Server error

---

## POST `/api/[route-prefix]`

**Description:** [What this endpoint creates]

### Request

**Body (JSON):**
```json
{
  "[field]": "string",           // Required: [description]
  "[optionalField]": "string",   // Optional: [description]
  "[relationId]": "string"       // Required: [relation description]
}
```

**Validation Rules:**
- `[field]` - Required string, [validation rules]
- `[optionalField]` - Optional string, [validation rules]
- `[relationId]` - Required string, must be valid [relation] ID

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "[field]": "Example Value",
    "[optionalField]": "Optional Value",
    "[relationId]": "64f7b1234567890abcdef456"
  }' \
  "http://localhost:3001/api/[route-prefix]"
```

### Response

**Success (201):**
```json
{
  "id": "64f7b1234567890abcdef789",
  "[field]": "Example Value",
  "[optionalField]": "Optional Value",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `409 Conflict` - [Entity] already exists or constraint violation
- `500 Internal Server Error` - Server error

---

## PUT `/api/[route-prefix]/:id`

**Description:** [What this endpoint updates]

### Request

**Path Parameters:**
- `id` (string, required) - [Entity] ID to update

**Body (JSON):**
```json
{
  "[field]": "string",           // Optional: [description]
  "[optionalField]": "string"    // Optional: [description]
}
```

**Example:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "[field]": "Updated Value"
  }' \
  "http://localhost:3001/api/[route-prefix]/64f7b1234567890abcdef123"
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef123",
  "[field]": "Updated Value",
  "[optionalField]": "string",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T12:34:56.789Z"
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - [Entity] not found
- `500 Internal Server Error` - Server error

---

## DELETE `/api/[route-prefix]/:id`

**Description:** [What this endpoint deletes and any cascade effects]

### Request

**Path Parameters:**
- `id` (string, required) - [Entity] ID to delete

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/[route-prefix]/64f7b1234567890abcdef123"
```

### Response

**Success (200):**
```json
{
  "message": "[Entity] deleted successfully",
  "id": "64f7b1234567890abcdef123"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - [Entity] not found
- `409 Conflict` - Cannot delete due to existing references
- `500 Internal Server Error` - Server error

---

## RBAC Permissions

This API uses Role-Based Access Control. Required permissions:

| Action | Permission | Description |
|--------|------------|-------------|
| View | `VIEW_[ENTITY]` | [When this permission is checked] |
| Create | `CREATE_[ENTITY]` | [Creation permission context] |
| Update | `UPDATE_[ENTITY]` | [Update permission context] |
| Delete | `DELETE_[ENTITY]` | [Deletion permission context] |

### Resource Context

For resource-specific permissions:

```typescript
@RbacResource({
  type: RbacResourceType.[RESOURCE_TYPE],
  idKey: '[resourceIdField]',
  source: ResourceIdSource.[PAYLOAD|PARAMS|USER],
})
```

**Resource Types Used:**
- `[RESOURCE_TYPE]` - [Description of when this resource type applies]

## WebSocket Events

[If this API triggers real-time events]

### Events Emitted

When entities are modified, the following WebSocket events are emitted:

| Event | Trigger | Payload | Room |
|-------|---------|---------|------|
| `[EVENT_NAME]` | [When emitted] | `[PayloadType]` | `[room-pattern]` |
| `[ANOTHER_EVENT]` | [Trigger condition] | `[PayloadType]` | `[room-pattern]` |

**Example Event Payload:**
```json
{
  "event": "[EVENT_NAME]",
  "data": {
    "id": "string",
    "[field]": "string",
    "action": "created|updated|deleted"
  }
}
```

## Rate Limiting

[If rate limiting is applied]

- **Limit:** [requests per time period]
- **Window:** [time window]
- **Headers:** Rate limit info in response headers

## Caching

[If caching is implemented]

- **Cache Strategy:** [description of caching approach]
- **TTL:** [cache time-to-live]
- **Cache Keys:** [pattern of cache keys used]

## Error Handling

### Common Error Formats

**Validation Error (400):**
```json
{
  "statusCode": 400,
  "message": [
    "[field] should not be empty",
    "[field] must be a string"
  ],
  "error": "Bad Request"
}
```

**Resource Not Found (404):**
```json
{
  "statusCode": 404,
  "message": "[Entity] with ID [id] not found",
  "error": "Not Found"
}
```

**Permission Denied (403):**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required: [PERMISSION_NAME]",
  "error": "Forbidden"
}
```

## Usage Examples

### Frontend Integration (RTK Query)

```typescript
// Redux slice usage
import { use[Entity]Api } from '@/features/[feature]/api/[entity]Api';

function [Component]() {
  const { data: [entities], isLoading } = use[Entity]Api.useGet[Entities]Query();
  const [create[Entity]] = use[Entity]Api.useCreate[Entity]Mutation();
  
  const handleCreate = async ([data]: Create[Entity]Data) => {
    try {
      await create[Entity]([data]).unwrap();
    } catch (error) {
      // Handle error
    }
  };
}
```

### Direct HTTP Calls

```typescript
// Using fetch API
const response = await fetch('/api/[route-prefix]', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify([requestData]),
});

const [entity] = await response.json();
```

## Testing

### Endpoint Tests
- **Location:** `backend/src/[path]/__tests__/[controller-name].controller.spec.ts`
- **Coverage:** [description of test coverage]

### Test Examples

```typescript
// Example integration test
describe('[ControllerName] (e2e)', () => {
  it('should create [entity] with valid data', () => {
    return request(app.getHttpServer())
      .post('/api/[route-prefix]')
      .set('Authorization', `Bearer ${validToken}`)
      .send([validData])
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.[field]).toBe([expectedValue]);
      });
  });
});
```

## Related Documentation

- [Module Documentation](../modules/[module-name].md)
- [Database Schema](../architecture/database.md#[entity])
- [RBAC System](../features/auth-rbac.md)
- [WebSocket Events](../api/websocket-events.md)