# LiveKit Module

> **Location:** `backend/src/livekit/livekit.module.ts`  
> **Type:** Voice/Video Module  
> **Domain:** WebRTC voice and video communication

## Overview

The LiveKit Module provides integration with LiveKit's WebRTC platform for high-quality voice and video communication within Kraken communities. It handles JWT token generation for room access, permission management, and connection configuration. This module is essential for voice channels, enabling Discord-like voice chat functionality with screen sharing and video capabilities.

## Module Structure

```
livekit/
├── livekit.module.ts          # Module definition
├── livekit.service.ts         # Core LiveKit integration logic
├── livekit.controller.ts      # HTTP endpoints for token generation
├── livekit.service.spec.ts    # Service unit tests
├── livekit.controller.spec.ts # Controller unit tests
├── dto/
│   ├── create-token.dto.ts    # Token generation request DTO
│   ├── token-response.dto.ts  # Token response DTO
│   └── update-livekit.dto.ts  # Update DTO (if needed)
├── entities/
│   └── livekit.entity.ts      # LiveKit entity definition (if needed)
└── exceptions/
    └── livekit.exception.ts   # Custom LiveKit exceptions
```

## Services

### LivekitService

**Purpose:** Manages LiveKit JWT token generation, server connection information, and configuration validation for WebRTC communication.

#### Key Methods

```typescript
class LivekitService {
  constructor(private readonly configService: ConfigService) {}

  // Core token generation
  async generateToken(createTokenDto: CreateTokenDto): Promise<TokenResponseDto> {
    // Generates JWT token for LiveKit room access with permissions:
    // - Room join permission
    // - Audio/video publishing
    // - Data channel publishing
    // - Subscription to other participants
    // Returns token with expiration and server URL
  }

  // Configuration and health
  getConnectionInfo(): { url?: string } {
    // Returns LiveKit server connection URL for client setup
  }

  validateConfiguration(): boolean {
    // Validates required LiveKit environment variables
    // Ensures API key, secret, and server URL are configured
  }
}
```

#### Token Generation Implementation

```typescript
async generateToken(createTokenDto: CreateTokenDto): Promise<TokenResponseDto> {
  const { identity, roomId, name, ttl } = createTokenDto;

  // Retrieve configuration
  const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
  const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');
  const livekitUrl = this.configService.get<string>('LIVEKIT_URL');

  // Validate credentials
  if (!apiKey || !apiSecret) {
    throw new LivekitException(
      'LiveKit credentials not configured',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  // Create access token with permissions
  const tokenTtl = ttl || 3600; // Default 1 hour
  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: name || identity,
    ttl: tokenTtl,
  });

  // Grant comprehensive room permissions
  token.addGrant({
    room: roomId,
    roomJoin: true,        // Can join the room
    canPublish: true,      // Can publish audio/video
    canSubscribe: true,    // Can receive others' streams
    canPublishData: true,  // Can send data messages
  });

  // Generate JWT and return response
  const jwt = await token.toJwt();
  
  return {
    token: jwt,
    identity,
    roomId,
    url: livekitUrl,
    expiresAt: new Date(Date.now() + tokenTtl * 1000),
  };
}
```

#### Configuration Management

```typescript
validateConfiguration(): boolean {
  const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
  const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');
  const livekitUrl = this.configService.get<string>('LIVEKIT_URL');

  if (!apiKey || !apiSecret || !livekitUrl) {
    this.logger.warn('LiveKit configuration incomplete');
    return false;
  }

  this.logger.log('LiveKit configuration validated successfully');
  return true;
}
```

## Controllers

### LivekitController

**Base Route:** `/api/livekit`

#### Endpoints

| Method | Endpoint | Description | Auth Required | RBAC Actions |
|--------|----------|-------------|---------------|--------------|
| POST | `/token` | Generate room access token | ✅ | `JOIN_CHANNEL` |
| GET | `/connection-info` | Get LiveKit server URL | ✅ | None |
| GET | `/health` | Check LiveKit configuration | ✅ | None |

#### Example Endpoint Implementation

```typescript
@Post('token')
@RequiredActions(RbacActions.JOIN_CHANNEL)
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'roomId',
  source: ResourceIdSource.BODY,
})
async generateToken(
  @Body() createTokenDto: CreateTokenDto,
  @Req() req: { user: UserEntity },
) {
  // Use authenticated user's ID as default identity
  const tokenDto = {
    ...createTokenDto,
    identity: createTokenDto.identity || req.user.id,
  };
  return this.livekitService.generateToken(tokenDto);
}

@Get('connection-info')
getConnectionInfo() {
  return this.livekitService.getConnectionInfo();
}

@Get('health')
validateConfiguration() {
  const isValid = this.livekitService.validateConfiguration();
  return {
    status: isValid ? 'healthy' : 'unhealthy',
    configured: isValid,
  };
}
```

#### Channel-based Authorization

```typescript
// Token generation requires channel access permission
@RequiredActions(RbacActions.JOIN_CHANNEL)
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'roomId',              // Room ID maps to channel ID
  source: ResourceIdSource.BODY
})
```

## DTOs (Data Transfer Objects)

### CreateTokenDto

```typescript
export class CreateTokenDto {
  @IsString()
  @IsNotEmpty()
  identity: string;       // User identity for LiveKit (usually user ID)
  
  @IsString()
  @IsNotEmpty()
  roomId: string;         // Room ID (maps to channel ID)
  
  @IsOptional()
  @IsString()
  name?: string;          // Display name for the participant
  
  @IsOptional()
  @IsNumber()
  @Min(1)
  ttl?: number;          // Token time-to-live in seconds (default: 3600)
}
```

### TokenResponseDto

```typescript
export class TokenResponseDto {
  token: string;          // JWT token for LiveKit authentication
  identity: string;       // User identity in the room
  roomId: string;         // Room/channel ID
  url?: string;          // LiveKit server URL
  expiresAt?: Date;      // Token expiration timestamp
}
```

### Token Permissions

```typescript
// LiveKit token grants comprehensive room permissions
token.addGrant({
  room: roomId,
  roomJoin: true,        // Permission to join the room
  canPublish: true,      // Permission to publish audio/video streams
  canSubscribe: true,    // Permission to subscribe to other participants
  canPublishData: true,  // Permission to publish data messages
});
```

## Integration with Channels

### Voice Channel Mapping

```typescript
// Voice channels use their ID as LiveKit room ID
const voiceChannel = {
  id: 'channel-abc123',
  type: ChannelType.VOICE,
  name: 'General Voice',
  // ...
};

// LiveKit room uses channel ID directly
const livekitRoomId = voiceChannel.id; // 'channel-abc123'
```

### Room Access Flow

```typescript
// 1. User requests to join voice channel
// 2. Frontend calls token endpoint with channel ID as roomId
POST /livekit/token
{
  "roomId": "channel-abc123",  // Voice channel ID
  "identity": "user-456",      // User ID
  "name": "Alice"              // Display name
}

// 3. Server validates user has JOIN_CHANNEL permission for channel
// 4. Server generates LiveKit token for room access
// 5. Client connects to LiveKit room using token
```

## Dependencies

### Internal Dependencies
- `@/auth/auth.module` - Authentication and RBAC protection
- `@nestjs/config` - Configuration management for LiveKit credentials

### External Dependencies
- `livekit-server-sdk` - Official LiveKit server SDK for token generation
- `@nestjs/common` - NestJS decorators and exceptions
- `class-validator` - DTO validation decorators

## Environment Configuration

### Required Environment Variables

```bash
# LiveKit Server Configuration
LIVEKIT_API_KEY=your-livekit-api-key          # LiveKit API key
LIVEKIT_API_SECRET=your-livekit-secret-key    # LiveKit API secret
LIVEKIT_URL=wss://your-livekit-server.com     # LiveKit server WebSocket URL

# Optional Configuration
LIVEKIT_TOKEN_TTL=3600                        # Default token TTL (1 hour)
```

### Configuration Validation

```typescript
// Service validates configuration on startup
validateConfiguration(): boolean {
  const required = ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_URL'];
  const missing = required.filter(key => !this.configService.get(key));
  
  if (missing.length > 0) {
    this.logger.warn(`Missing LiveKit configuration: ${missing.join(', ')}`);
    return false;
  }
  
  return true;
}
```

## Authentication & Authorization

### Guards Used
- `JwtAuthGuard` - Ensures user authentication
- `RbacGuard` - Enforces channel-based access control

### RBAC Permissions

```typescript
// Voice channel access permission
JOIN_CHANNEL    // Required to generate tokens for voice channel access
```

### Resource Context

```typescript
// Channel-scoped permission validation
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'roomId',                    // Room ID must match channel ID
  source: ResourceIdSource.BODY       // Extract from request body
})
```

### Identity Management

```typescript
// Authenticated user ID used as LiveKit identity
const tokenDto = {
  ...createTokenDto,
  identity: createTokenDto.identity || req.user.id,  // Default to user ID
};
```

## Error Handling

### Custom Exceptions

```typescript
export class LivekitException extends HttpException {
  constructor(
    message: string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    super(message, status);
  }
}
```

### Common Error Scenarios

```typescript
// Missing configuration
throw new LivekitException(
  'LiveKit credentials not configured',
  HttpStatus.INTERNAL_SERVER_ERROR,
);

// Token generation failure
throw new LivekitException(
  'Failed to generate token',
  HttpStatus.INTERNAL_SERVER_ERROR,
);
```

### Configuration Health Check

```typescript
// Health endpoint provides configuration status
GET /livekit/health
{
  "status": "healthy",     // or "unhealthy"
  "configured": true       // Configuration completeness
}
```

## Performance Considerations

- **Token Caching:** Tokens are generated per request (no caching to maintain security)
- **Token TTL:** Default 1-hour expiration balances security and user experience
- **Room Permissions:** Full permissions granted for maximum functionality
- **Configuration Validation:** Cached validation results to avoid repeated checks

## Testing

### Service Tests

```typescript
describe('LivekitService', () => {
  describe('generateToken', () => {
    it('should generate valid token with permissions', async () => {
      const createTokenDto = {
        identity: 'user-123',
        roomId: 'channel-456',
        name: 'Alice',
        ttl: 3600,
      };

      const result = await service.generateToken(createTokenDto);

      expect(result.token).toBeDefined();
      expect(result.identity).toBe('user-123');
      expect(result.roomId).toBe('channel-456');
      expect(result.url).toBe('wss://livekit.example.com');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw exception when credentials missing', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await expect(service.generateToken(createTokenDto))
        .rejects.toThrow(LivekitException);
    });
  });

  describe('validateConfiguration', () => {
    it('should return true when fully configured', () => {
      mockConfigService.get
        .mockReturnValueOnce('api-key')
        .mockReturnValueOnce('secret')
        .mockReturnValueOnce('wss://livekit.com');

      expect(service.validateConfiguration()).toBe(true);
    });

    it('should return false when configuration incomplete', () => {
      mockConfigService.get.mockReturnValue(undefined);

      expect(service.validateConfiguration()).toBe(false);
    });
  });
});
```

### Controller Tests

```typescript
describe('LivekitController', () => {
  describe('generateToken', () => {
    it('should use authenticated user ID as default identity', async () => {
      const createTokenDto = { roomId: 'channel-123' };
      const req = { user: { id: 'user-456' } };

      await controller.generateToken(createTokenDto, req);

      expect(mockLivekitService.generateToken).toHaveBeenCalledWith({
        roomId: 'channel-123',
        identity: 'user-456',
      });
    });

    it('should preserve provided identity', async () => {
      const createTokenDto = { 
        roomId: 'channel-123', 
        identity: 'custom-identity' 
      };

      await controller.generateToken(createTokenDto, req);

      expect(mockLivekitService.generateToken).toHaveBeenCalledWith(
        expect.objectContaining({ identity: 'custom-identity' })
      );
    });
  });
});
```

## Integration Patterns

### Voice Channel Connection Flow

```typescript
// 1. User clicks join voice channel in frontend
// 2. Frontend requests LiveKit token
const tokenResponse = await fetch('/api/livekit/token', {
  method: 'POST',
  headers: { 
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json' 
  },
  body: JSON.stringify({
    roomId: voiceChannelId,
    name: userDisplayName
  })
});

const { token, url } = await tokenResponse.json();

// 3. Frontend connects to LiveKit room
const room = new Room();
await room.connect(url, token);
```

### Channel-Room Mapping

```typescript
// Voice channels directly map to LiveKit rooms
const voiceChannel = {
  id: 'channel-abc123',
  type: ChannelType.VOICE,
  name: 'General Voice'
};

// LiveKit room configuration
const livekitRoom = {
  roomId: voiceChannel.id,  // Direct mapping
  name: voiceChannel.name,
  // Room inherits channel permissions via RBAC
};
```

## Common Usage Patterns

### Pattern 1: Voice Channel Join

```typescript
// User joining voice channel
POST /livekit/token
{
  "roomId": "channel-voice-123",
  "name": "Alice"
}

// Response with connection details
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "identity": "user-456",
  "roomId": "channel-voice-123", 
  "url": "wss://livekit.example.com",
  "expiresAt": "2023-12-01T15:00:00Z"
}
```

### Pattern 2: Configuration Health Check

```typescript
// Verify LiveKit integration health
GET /livekit/health

{
  "status": "healthy",
  "configured": true
}

// Use for startup checks and monitoring
```

### Pattern 3: Connection Info for Client Setup

```typescript
// Get server URL for client configuration
GET /livekit/connection-info

{
  "url": "wss://livekit.example.com"
}
```

### Pattern 4: Token with Custom TTL

```typescript
// Extended session token for long meetings
POST /livekit/token
{
  "roomId": "channel-meeting-456",
  "ttl": 7200,  // 2 hours
  "name": "Bob"
}
```

## Related Modules

- **Channels Module** - Voice channel management and permissions
- **Auth Module** - User authentication and channel access control
- **Voice Presence Module** - User presence tracking in voice channels
- **Rooms Module** - Room management and participant tracking

## Migration Notes

### LiveKit Version Updates
- **Version 1.x:** Basic token generation and room access
- **Future:** Enhanced permissions, recording, webhooks integration

### Token Security Evolution  
- **Current:** Full room permissions for all users
- **Future:** Granular permission system based on user roles

## Troubleshooting

### Common Issues

1. **Token Generation Failures**
   - **Symptoms:** LivekitException on token requests
   - **Cause:** Missing or invalid LiveKit credentials
   - **Solution:** Verify LIVEKIT_API_KEY and LIVEKIT_API_SECRET configuration

2. **Connection Failures**
   - **Symptoms:** Client cannot connect to LiveKit room
   - **Cause:** Incorrect LIVEKIT_URL or network issues
   - **Solution:** Verify server URL and network connectivity

3. **Permission Denied Errors**
   - **Symptoms:** 403 Forbidden on token requests
   - **Cause:** User lacks JOIN_CHANNEL permission for voice channel
   - **Solution:** Verify channel membership and role permissions

4. **Token Expiration Issues**
   - **Symptoms:** Users disconnected after token expires
   - **Cause:** Default TTL too short for long sessions
   - **Solution:** Adjust TTL or implement token refresh mechanism

### Debug Information

```typescript
// Enable debug logging for troubleshooting
this.logger.log(`Generated token for user ${identity} in room ${roomId}`);
this.logger.error('Failed to generate LiveKit token', error);
this.logger.warn('LiveKit configuration incomplete');
```

## Related Documentation

- [Voice Presence Module](voice-presence.md)
- [Channels Module](../features/channels.md)
- [LiveKit API](../../api/livekit.md)
- [Voice Persistence](../../features/voice-persistence.md)
- [WebRTC Integration Guide](../../setup/livekit-setup.md)

## LiveKit SDK Integration

### Client-Side Usage Example

```typescript
import { Room, connect } from 'livekit-client';

// Get token from Kraken backend
const tokenResponse = await fetch('/api/livekit/token', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${accessToken}` },
  body: JSON.stringify({ roomId: channelId })
});

const { token, url } = await tokenResponse.json();

// Connect to LiveKit room
const room = new Room();
await room.connect(url, token);

// Handle room events
room.on('participantConnected', (participant) => {
  console.log('Participant joined:', participant.identity);
});

room.on('trackSubscribed', (track, publication, participant) => {
  // Handle audio/video tracks
  if (track.kind === 'video') {
    const videoElement = track.attach();
    document.body.appendChild(videoElement);
  }
});
```