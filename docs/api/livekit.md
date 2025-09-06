# LiveKit API

> **Base URL:** `/api/livekit`  
> **Controller:** `backend/src/livekit/livekit.controller.ts`  
> **Service:** `backend/src/livekit/livekit.service.ts`

## Overview

LiveKit integration API for managing WebRTC video/audio communication tokens and connection information. Provides secure token generation for joining LiveKit rooms (voice channels) and exposes connection details for client-side LiveKit SDK integration.

## Authentication

- **Required:** ✅ All endpoints require authentication (except health check)
- **Token Type:** JWT Bearer token
- **Headers:** `Authorization: Bearer <jwt_token>`

## Endpoints Summary

| Method | Endpoint | Description | RBAC Permission |
|--------|----------|-------------|-----------------|
| POST | `/token` | Generate LiveKit access token | `JOIN_CHANNEL` |
| GET | `/connection-info` | Get LiveKit server connection info | None |
| GET | `/health` | Check LiveKit configuration health | None |

---

## POST `/api/livekit/token`

**Description:** Generates a LiveKit access token for joining a voice/video room. The token grants access to a specific LiveKit room using the channel ID as the room identifier. Tokens have configurable TTL and user identity.

### Request

**Body (JSON):**
```json
{
  "identity": "string",         // Optional: User identity (defaults to authenticated user ID)
  "roomId": "string",           // Required: Room ID (typically channel ID)
  "name": "string",            // Optional: Display name for the user in LiveKit
  "ttl": 3600                  // Optional: Token TTL in seconds (default varies)
}
```

**Validation Rules:**
- `identity` - Optional string, defaults to authenticated user's ID if not provided
- `roomId` - Required string, must be valid channel ID with appropriate permissions
- `name` - Optional string, display name for user in LiveKit room
- `ttl` - Optional number (minimum 1), token time-to-live in seconds

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "64f7b1234567890abcdef123",
    "name": "John Doe",
    "ttl": 7200
  }' \
  "http://localhost:3001/api/livekit/token"
```

**Auto-Identity Example (recommended):**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "roomId": "64f7b1234567890abcdef123"
  }' \
  "http://localhost:3001/api/livekit/token"
```

### Response

**Success (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2NDE2MTIwMzUsImlzcyI6IkFQSWtleSIsIm5iZiI6MTY0MTYwODQzNSwic3ViIjoiNjRmN2IxMjM0NTY3ODkwYWJjZGVmMTIzIiwidmlkZW8iOnsiY2FuUHVibGlzaCI6dHJ1ZSwiY2FuUHVibGlzaERhdGEiOnRydWUsImNhblN1YnNjcmliZSI6dHJ1ZSwicm9vbSI6IjY0ZjdiMTIzNDU2Nzg5MGFiY2RlZjEyMyIsInJvb21Kb2luIjp0cnVlfX0.signature",
  "identity": "64f7b1234567890abcdef456",
  "roomId": "64f7b1234567890abcdef123",
  "name": "John Doe",
  "expiresAt": "2024-01-01T14:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors (invalid roomId, negative TTL)
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `JOIN_CHANNEL`)
- `404 Not Found` - Channel/room not found
- `500 Internal Server Error` - LiveKit configuration error or server error

---

## GET `/api/livekit/connection-info`

**Description:** Retrieves the LiveKit server connection information needed for client-side SDK initialization. Returns server URL and connection details.

### Request

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/livekit/connection-info"
```

### Response

**Success (200):**
```json
{
  "serverUrl": "wss://livekit.example.com",
  "region": "us-east-1",
  "configured": true,
  "features": {
    "audio": true,
    "video": true,
    "screenShare": true,
    "recording": false
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `500 Internal Server Error` - LiveKit configuration error

---

## GET `/api/livekit/health`

**Description:** Health check endpoint to verify LiveKit service configuration and connectivity. Useful for monitoring and debugging LiveKit integration.

### Request

**Example:**
```bash
curl "http://localhost:3001/api/livekit/health"
```

### Response

**Healthy Configuration (200):**
```json
{
  "status": "healthy",
  "configured": true
}
```

**Unhealthy Configuration (200):**
```json
{
  "status": "unhealthy",
  "configured": false
}
```

**Error Responses:**
- `500 Internal Server Error` - Service unavailable

---

## LiveKit Integration

### Room ID Mapping
- **Channel ID as Room ID:** Voice channels use their MongoDB ObjectId as the LiveKit room identifier
- **Consistent Mapping:** Ensures direct correlation between Kraken channels and LiveKit rooms
- **Isolation:** Each voice channel becomes a separate LiveKit room

### Token Security
- **JWT-based:** LiveKit tokens are JWTs signed with LiveKit API secret
- **Scoped Permissions:** Tokens grant specific permissions (publish, subscribe, room join)
- **Time-Limited:** Configurable TTL prevents token misuse
- **User Identity:** Links LiveKit participants to Kraken user accounts

### Default Token Permissions
LiveKit tokens generated include the following permissions:
```json
{
  "canPublish": true,        // Can publish audio/video streams
  "canSubscribe": true,      // Can receive other participants' streams  
  "canPublishData": true,    // Can send data messages
  "roomJoin": true,          // Can join the specified room
  "room": "channelId"        // Scoped to specific channel/room
}
```

## RBAC Permissions

This API uses Role-Based Access Control with channel-specific resource contexts:

| Action | Permission | Description |
|--------|------------|-------------|
| Generate Token | `JOIN_CHANNEL` | Create LiveKit access tokens for voice channels |
| Connection Info | None | Get LiveKit server information |
| Health Check | None | Check service health status |

### Resource Context

For token generation:

```typescript
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'roomId',
  source: ResourceIdSource.BODY
})
```

**Resource Types Used:**
- `CHANNEL` - Channel-specific permission check using room ID (channel ID) from request body

## Client-Side Integration

### LiveKit SDK Connection Flow

```typescript
// 1. Get connection info
const connectionResponse = await fetch('/api/livekit/connection-info', {
  headers: { 'Authorization': `Bearer ${authToken}` }
});
const { serverUrl } = await connectionResponse.json();

// 2. Generate LiveKit token
const tokenResponse = await fetch('/api/livekit/token', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    roomId: channelId,
    name: userDisplayName
  })
});
const { token } = await tokenResponse.json();

// 3. Connect to LiveKit room
import { Room } from 'livekit-client';

const room = new Room();
await room.connect(serverUrl, token, {
  autoSubscribe: true,
  audio: true,
  video: false
});
```

### Token Refresh Strategy

```typescript
class LiveKitTokenManager {
  private currentToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  
  async getValidToken(roomId: string): Promise<string> {
    if (this.needsRefresh()) {
      await this.refreshToken(roomId);
    }
    return this.currentToken!;
  }
  
  private needsRefresh(): boolean {
    if (!this.currentToken || !this.tokenExpiresAt) {
      return true;
    }
    
    // Refresh 5 minutes before expiration
    const refreshTime = new Date(this.tokenExpiresAt.getTime() - 5 * 60 * 1000);
    return new Date() > refreshTime;
  }
  
  private async refreshToken(roomId: string) {
    const response = await fetch('/api/livekit/token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ roomId })
    });
    
    const tokenData = await response.json();
    this.currentToken = tokenData.token;
    this.tokenExpiresAt = new Date(tokenData.expiresAt);
    
    // Schedule next refresh
    this.scheduleRefresh(roomId);
  }
}
```

## Error Handling

### Common Error Formats

**Validation Error (400):**
```json
{
  "statusCode": 400,
  "message": [
    "roomId should not be empty",
    "ttl must not be less than 1"
  ],
  "error": "Bad Request"
}
```

**Channel Access Denied (403):**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required: JOIN_CHANNEL",
  "error": "Forbidden"
}
```

**LiveKit Configuration Error (500):**
```json
{
  "statusCode": 500,
  "message": "LiveKit service not configured properly",
  "error": "Internal Server Error"
}
```

**Room Not Found (404):**
```json
{
  "statusCode": 404,
  "message": "Channel with ID 64f7b1234567890abcdef123 not found",
  "error": "Not Found"
}
```

## Configuration

### Environment Variables

```bash
# LiveKit Server Configuration
LIVEKIT_SERVER_URL=wss://livekit.example.com
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret

# Optional: Token TTL (seconds)
LIVEKIT_DEFAULT_TOKEN_TTL=3600
```

### Service Configuration

```typescript
// LiveKit service configuration example
interface LiveKitConfig {
  serverUrl: string;        // WebSocket URL for client connections
  apiKey: string;          // API key for token generation
  apiSecret: string;       // Secret for JWT signing
  defaultTTL: number;      // Default token lifetime (seconds)
  region?: string;         // Geographic region (optional)
}
```

## Usage Examples

### Frontend Integration (RTK Query)

```typescript
// Redux LiveKit slice usage
import { useLiveKitApi } from '@/features/livekit/api/liveKitApi';

function VoiceChannel({ channelId }: { channelId: string }) {
  const { data: connectionInfo } = useLiveKitApi.useGetConnectionInfoQuery();
  const [generateToken] = useLiveKitApi.useGenerateTokenMutation();
  
  const joinVoiceChannel = async () => {
    try {
      // Generate token
      const tokenData = await generateToken({
        roomId: channelId,
        name: currentUser.displayName
      }).unwrap();
      
      // Connect to LiveKit
      await connectToLiveKit(connectionInfo.serverUrl, tokenData.token);
      
    } catch (error) {
      console.error('Failed to join voice channel:', error);
    }
  };
}

// LiveKit Room Manager
class LiveKitRoomManager {
  private room: Room | null = null;
  
  async connect(channelId: string, userDisplayName: string) {
    // Get connection info and token in parallel
    const [connectionInfo, tokenData] = await Promise.all([
      fetch('/api/livekit/connection-info', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }).then(r => r.json()),
      fetch('/api/livekit/token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roomId: channelId,
          name: userDisplayName
        })
      }).then(r => r.json())
    ]);
    
    // Initialize room
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    
    // Set up event listeners
    this.room.on('participantConnected', this.handleParticipantConnected);
    this.room.on('trackSubscribed', this.handleTrackSubscribed);
    
    // Connect to room
    await this.room.connect(connectionInfo.serverUrl, tokenData.token);
    
    return this.room;
  }
  
  async disconnect() {
    if (this.room) {
      await this.room.disconnect();
      this.room = null;
    }
  }
}
```

### Direct API Usage

```typescript
// Generate LiveKit token
const generateLiveKitToken = async (channelId: string, displayName?: string) => {
  const response = await fetch('/api/livekit/token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      roomId: channelId,
      name: displayName,
      ttl: 7200 // 2 hours
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to generate LiveKit token');
  }
  
  return await response.json();
};

// Check LiveKit health
const checkLiveKitHealth = async () => {
  const response = await fetch('/api/livekit/health');
  const health = await response.json();
  
  if (health.status !== 'healthy') {
    console.warn('LiveKit service is not healthy');
    return false;
  }
  
  return true;
};
```

## Testing

### Endpoint Tests
- **Location:** `backend/src/livekit/__tests__/livekit.controller.spec.ts`
- **Coverage:** Token generation, validation, health checks, RBAC permissions

### Test Examples

```typescript
// Example integration test
describe('LiveKit (e2e)', () => {
  it('should generate valid LiveKit token', () => {
    return request(app.getHttpServer())
      .post('/api/livekit/token')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        roomId: validChannelId,
        name: 'Test User'
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.token).toBeDefined();
        expect(res.body.roomId).toBe(validChannelId);
        expect(res.body.identity).toBe(userId);
      });
  });

  it('should enforce channel permissions for token generation', () => {
    return request(app.getHttpServer())
      .post('/api/livekit/token')
      .set('Authorization', `Bearer ${tokenWithoutJoinPermission}`)
      .send({
        roomId: validChannelId
      })
      .expect(403);
  });

  it('should return connection info', () => {
    return request(app.getHttpServer())
      .get('/api/livekit/connection-info')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.serverUrl).toBeDefined();
        expect(res.body.configured).toBe(true);
      });
  });
});
```

## Related Documentation

- [Voice-Presence API](voice-presence.md) - Voice channel presence management
- [Channels API](channels.md) - Voice channel creation
- [RBAC System](../features/auth-rbac.md)
- [Voice Persistence](../features/voice-persistence.md)
- [LiveKit Documentation](https://docs.livekit.io/) - Official LiveKit docs
- [Database Schema](../architecture/database.md#voice-channels)