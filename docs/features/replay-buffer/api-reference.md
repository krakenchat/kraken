# Replay Buffer - API Reference

Complete REST API documentation for replay buffer endpoints.

## Base URL

```
/livekit-replay
```

## Authentication

All endpoints require JWT authentication via `JwtAuthGuard`.

Include JWT token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Endpoints

### 1. Start Replay Buffer

Start continuous recording of screen share.

**Endpoint**: `POST /livekit-replay/start`

**Request Body**:
```typescript
{
  roomName: string;          // LiveKit room name (matches channel ID)
  communityId?: string;      // Optional: community ID for limits/quota
  quality?: '720p' | '1080p' | '1440p';  // Default: '1080p'
}
```

**Response**: `200 OK`
```typescript
{
  id: string;                // Session ID
  egressId: string;          // LiveKit egress ID
  userId: string;
  communityId: string | null;
  roomName: string;
  quality: string;
  status: 'active';
  segmentPath: string;
  startedAt: string;         // ISO 8601 timestamp
  createdAt: string;
  updatedAt: string;
}
```

**Errors**:
- `400 Bad Request`: User already has active replay buffer
- `401 Unauthorized`: Invalid or missing JWT
- `403 Forbidden`: Missing `ENABLE_REPLAY_BUFFER` permission
- `429 Too Many Requests`: Community concurrent limit reached

**Example**:
```bash
curl -X POST http://localhost:3001/livekit-replay/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roomName": "voice-channel-123",
    "communityId": "community-456",
    "quality": "1080p"
  }'
```

---

### 2. Stop Replay Buffer

Stop continuous recording and cleanup segments.

**Endpoint**: `POST /livekit-replay/stop/:sessionId`

**URL Parameters**:
- `sessionId` (string, required): Egress session ID

**Response**: `200 OK`
```typescript
{
  message: 'Replay buffer stopped';
  sessionId: string;
}
```

**Errors**:
- `404 Not Found`: Session not found
- `400 Bad Request`: Session is not active
- `401 Unauthorized`: Invalid or missing JWT

**Example**:
```bash
curl -X POST http://localhost:3001/livekit-replay/stop/60f7b3c4e4b0c8d8f8e4b0c8 \
  -H "Authorization: Bearer $TOKEN"
```

---

### 3. Capture Replay

Capture last N minutes from active replay buffer.

**Endpoint**: `POST /livekit-replay/capture`

**Request Body**:
```typescript
{
  sessionId: string;                          // Active session ID
  durationMinutes: 1 | 2 | 5 | 10;           // How much to capture
  shareOption?: 'dm' | 'channel';            // Optional: auto-share
  targetChannelId?: string;                  // Required if shareOption='channel'
}
```

**Response**: `200 OK`
```typescript
{
  clipId: string;             // ReplayClip database ID
  fileId: string;             // File database ID
  durationSeconds: number;    // Actual duration (may be +10s)
  sizeBytes: number;          // File size in bytes
  downloadUrl?: string;       // If shareOption='dm', presigned URL
  messageId?: string;         // If shareOption='channel', message ID
}
```

**Errors**:
- `404 Not Found`: Session not found
- `400 Bad Request`: No segments in time range
- `403 Forbidden`: Session does not belong to user
- `507 Insufficient Storage`: User quota exceeded
- `500 Internal Server Error`: FFmpeg failure

**Example**:
```bash
curl -X POST http://localhost:3001/livekit-replay/capture \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "60f7b3c4e4b0c8d8f8e4b0c8",
    "durationMinutes": 5,
    "shareOption": "channel",
    "targetChannelId": "60f7b3c4e4b0c8d8f8e4b0c9"
  }'
```

---

### 4. Get Status

Get active replay buffer sessions in a room.

**Endpoint**: `GET /livekit-replay/status/:roomName`

**URL Parameters**:
- `roomName` (string, required): LiveKit room name

**Response**: `200 OK`
```typescript
{
  activeSessions: [
    {
      id: string;
      userId: string;
      username: string;       // Joined from User model
      quality: string;
      startedAt: string;
      durationMinutes: number;  // How long buffer has been running
    }
  ]
}
```

**Example**:
```bash
curl http://localhost:3001/livekit-replay/status/voice-channel-123 \
  -H "Authorization: Bearer $TOKEN"
```

---

### 5. Get My Clips

List all replay clips for authenticated user.

**Endpoint**: `GET /livekit-replay/my-clips`

**Query Parameters**:
- `limit` (number, optional): Max results (default: 20)
- `offset` (number, optional): Pagination offset (default: 0)
- `communityId` (string, optional): Filter by community

**Response**: `200 OK`
```typescript
{
  clips: [
    {
      id: string;
      roomName: string;
      communityId: string | null;
      durationSeconds: number;
      fileId: string;
      filename: string;          // Joined from File model
      sizeBytes: number;         // Joined from File model
      downloadUrl: string;       // Presigned URL (1-hour expiry)
      createdAt: string;
    }
  ],
  total: number;
  hasMore: boolean;
}
```

**Example**:
```bash
curl http://localhost:3001/livekit-replay/my-clips?limit=10&offset=0 \
  -H "Authorization: Bearer $TOKEN"
```

---

### 6. Delete Clip

Delete a saved replay clip and free quota.

**Endpoint**: `DELETE /livekit-replay/clips/:id`

**URL Parameters**:
- `id` (string, required): ReplayClip ID

**Response**: `200 OK`
```typescript
{
  message: 'Clip deleted successfully';
  freedBytes: number;        // How much quota was freed
  remainingQuotaBytes: number;
}
```

**Errors**:
- `404 Not Found`: Clip not found
- `403 Forbidden`: Clip does not belong to user
- `401 Unauthorized`: Invalid or missing JWT

**Example**:
```bash
curl -X DELETE http://localhost:3001/livekit-replay/clips/60f7b3c4e4b0c8d8f8e4b0c8 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Admin Endpoints

### 7. Get Community Config

Get replay buffer configuration for a community.

**Endpoint**: `GET /livekit-replay/admin/community/:communityId/config`

**Permission**: `MANAGE_REPLAY_LIMITS`

**Response**: `200 OK`
```typescript
{
  id: string;
  communityId: string;
  maxConcurrent: number;
  enabled: boolean;
  activeSessions: number;    // Current active count
  createdAt: string;
  updatedAt: string;
}
```

---

### 8. Update Community Config

Update replay buffer settings for a community.

**Endpoint**: `PATCH /livekit-replay/admin/community/:communityId/config`

**Permission**: `MANAGE_REPLAY_LIMITS`

**Request Body**:
```typescript
{
  maxConcurrent?: number;    // 0-20 recommended
  enabled?: boolean;
}
```

**Response**: `200 OK`
```typescript
{
  id: string;
  communityId: string;
  maxConcurrent: number;
  enabled: boolean;
  updatedAt: string;
}
```

---

### 9. Get User Quota

Get storage quota for a user.

**Endpoint**: `GET /livekit-replay/admin/users/:userId/quota`

**Permission**: Instance admin only

**Response**: `200 OK`
```typescript
{
  id: string;
  userId: string;
  quotaBytes: number;
  usedBytes: number;
  percentUsed: number;
  clipsCount: number;
  createdAt: string;
  updatedAt: string;
}
```

---

### 10. Update User Quota

Update storage quota for a user.

**Endpoint**: `PATCH /livekit-replay/admin/users/:userId/quota`

**Permission**: Instance admin only

**Request Body**:
```typescript
{
  quotaBytes: number;    // New quota in bytes
}
```

**Response**: `200 OK`
```typescript
{
  id: string;
  userId: string;
  quotaBytes: number;
  usedBytes: number;
  updatedAt: string;
}
```

---

## Webhooks (Optional)

LiveKit can send webhooks for egress events. Configure in LiveKit settings.

### Egress Started

```typescript
{
  event: 'egress_started';
  egressInfo: {
    egressId: string;
    roomName: string;
    status: string;
  };
  id: string;           // Event ID
  createdAt: number;    // UNIX timestamp
}
```

### Egress Updated

```typescript
{
  event: 'egress_updated';
  egressInfo: {
    egressId: string;
    status: string;
    updatedAt: number;
  };
  id: string;
  createdAt: number;
}
```

### Egress Ended

```typescript
{
  event: 'egress_ended';
  egressInfo: {
    egressId: string;
    status: 'complete' | 'failed';
    error?: string;
  };
  id: string;
  createdAt: number;
}
```

**Webhook Handler** (in backend):

```typescript
@Post('webhooks/livekit')
async handleWebhook(@Body() event: LiveKitWebhookEvent) {
  if (event.event === 'egress_ended') {
    // Handle egress completion/failure
    const session = await this.findSessionByEgressId(event.egressInfo.egressId);
    if (session) {
      await this.updateSessionStatus(session.id, event.egressInfo.status);
    }
  }
}
```

---

## Error Codes

| Status Code | Error | Description |
|-------------|-------|-------------|
| `400` | Bad Request | Invalid parameters or state |
| `401` | Unauthorized | Missing or invalid JWT token |
| `403` | Forbidden | Missing permissions or not owner |
| `404` | Not Found | Resource not found |
| `429` | Too Many Requests | Rate limited or concurrent limit |
| `507` | Insufficient Storage | User quota exceeded |
| `500` | Internal Server Error | Server or FFmpeg failure |

---

## Rate Limiting

**Recommended limits** (implement with `@nestjs/throttler`):

- `POST /start`: 5 requests per minute per user
- `POST /capture`: 10 requests per minute per user
- `DELETE /clips/:id`: 20 requests per minute per user

---

## RBAC Permissions

Required permissions for each endpoint:

| Endpoint | Permission |
|----------|-----------|
| `POST /start` | `ENABLE_REPLAY_BUFFER` |
| `POST /stop/:id` | `ENABLE_REPLAY_BUFFER` (owner only) |
| `POST /capture` | `CAPTURE_REPLAY` (owner only) |
| `GET /status/:roomName` | None (public) |
| `GET /my-clips` | None (own data) |
| `DELETE /clips/:id` | None (owner only) |
| `GET /admin/community/:id/config` | `MANAGE_REPLAY_LIMITS` |
| `PATCH /admin/community/:id/config` | `MANAGE_REPLAY_LIMITS` |
| `GET /admin/users/:id/quota` | Instance admin |
| `PATCH /admin/users/:id/quota` | Instance admin |

---

## Next Steps

- Implement frontend components to call these APIs
- Add rate limiting with `@nestjs/throttler`
- Set up webhook endpoint for LiveKit events
- Add API documentation to Swagger/OpenAPI
