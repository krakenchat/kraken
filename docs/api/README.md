# API Documentation

This directory contains comprehensive documentation for all REST API endpoints and WebSocket events in the Kraken application.

## API Structure

### REST APIs
- **auth.md** - Authentication endpoints (login, register, refresh)
- **user.md** - User management and profile endpoints
- **community.md** - Community/server management endpoints
- **channels.md** - Text and voice channel endpoints
- **messages.md** - Message handling endpoints
- **membership.md** - Community membership endpoints
- **channel-membership.md** - Private channel access endpoints
- **presence.md** - User presence and status endpoints
- **invite.md** - Instance and community invitation endpoints
- **livekit.md** - Video call token and room endpoints
- **roles.md** - Role and permission management endpoints
- **file-upload.md** - File attachment endpoints
- **alias-groups.md** - User alias management endpoints

### WebSocket Events
- **websocket-events.md** - All real-time event documentation

## Authentication

All API endpoints (except public auth endpoints) require JWT authentication:
```
Authorization: Bearer <jwt_token>
```

## Base URL

Development: `http://localhost:3001/api`
Production: `https://your-domain.com/api`

## Rate Limiting

API endpoints are protected by rate limiting. Specific limits are documented per endpoint.

## RBAC System

Many endpoints use Role-Based Access Control (RBAC) with granular permissions. Required permissions are documented for each endpoint.

## Error Handling

All APIs follow consistent error response formats:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resources)
- `500` - Internal Server Error

## WebSocket Integration

Many API operations trigger real-time WebSocket events. These are documented alongside the relevant endpoints.

## Testing

API endpoints can be tested using:
- **Postman/Insomnia** - Import the provided collections
- **curl** - Examples provided in each endpoint documentation
- **Frontend Integration** - RTK Query examples included