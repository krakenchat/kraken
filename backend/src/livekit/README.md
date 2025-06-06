# LiveKit Integration

This module provides LiveKit token generation and management for real-time video/audio communication.

## Environment Variables

Make sure to set the following environment variables:

```bash
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

## API Endpoints

### Generate Token

`POST /api/livekit/token`

Generate a JWT token for a user to join a LiveKit room.

**Headers:**

- `Authorization: Bearer <jwt-token>`

**Body:**

```json
{
  "identity": "user123",
  "roomId": "room123",
  "name": "John Doe",
  "ttl": 3600
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "identity": "user123",
  "roomId": "room123",
  "url": "wss://your-livekit-server.com",
  "expiresAt": "2025-06-06T12:00:00.000Z"
}
```

### Get Connection Info

`GET /api/livekit/connection-info`

Get the LiveKit server URL for client connections.

**Headers:**

- `Authorization: Bearer <jwt-token>`

**Response:**

```json
{
  "url": "wss://your-livekit-server.com"
}
```

### Health Check

`GET /api/livekit/health`

Check if LiveKit is properly configured.

**Headers:**

- `Authorization: Bearer <jwt-token>`

**Response:**

```json
{
  "status": "healthy",
  "configured": true
}
```

## Usage

1. Set up your environment variables
2. Authenticate with your JWT token
3. Call the token endpoint with user identity and room ID
4. Use the returned token and URL to connect to LiveKit from your client

## Token Permissions

Generated tokens include the following permissions:

- `roomJoin`: Allow joining the specified room
- `canPublish`: Allow publishing audio/video streams
- `canSubscribe`: Allow subscribing to other participants' streams
- `canPublishData`: Allow sending data messages

## Client Integration

Use the returned token and URL with the LiveKit client SDK to establish a connection:

```typescript
// Example client-side usage
const response = await fetch('/api/livekit/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${yourJwtToken}`,
  },
  body: JSON.stringify({
    identity: 'user123',
    roomId: 'room123',
    name: 'John Doe',
  }),
});

const { token, url } = await response.json();

// Connect with LiveKit client SDK
import { Room } from 'livekit-client';
const room = new Room();
await room.connect(url, token);
```
