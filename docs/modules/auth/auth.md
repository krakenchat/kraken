# Auth Module

> **Location:** `backend/src/auth/auth.module.ts`  
> **Type:** Core Module  
> **Domain:** authentication & authorization

## Overview

The Auth Module provides comprehensive authentication and authorization infrastructure for the Kraken application. It implements JWT-based authentication with refresh token rotation, role-based access control (RBAC), and both HTTP and WebSocket authentication guards. This module is central to securing all application features and controlling access to resources.

## Module Structure

```
auth/
├── auth.module.ts              # Module definition with JWT and Passport config
├── auth.service.ts             # Authentication logic and token management
├── auth.controller.ts          # HTTP authentication endpoints
├── auth.controller.spec.ts     # Controller unit tests
├── auth.service.spec.ts        # Service unit tests
├── cookie-helper.ts           # Cookie management utilities
├── public.decorator.ts        # Decorator for public endpoints
├── rbac-action.decorator.ts   # RBAC action requirement decorator
├── rbac-resource.decorator.ts # RBAC resource context decorator
├── rbac.guard.ts              # Role-based access control guard
├── jwt-auth.guard.ts          # JWT authentication guard for HTTP
├── jwt.strategy.ts            # JWT Passport strategy
├── local-auth.guard.ts        # Local authentication guard
├── local.strategy.ts          # Local Passport strategy
└── ws-jwt-auth.guard.ts       # JWT authentication guard for WebSockets
```

## Services

### AuthService

**Purpose:** Handles user authentication, JWT token generation/validation, and refresh token lifecycle management.

#### Key Methods

```typescript
class AuthService {
  private readonly jwtRefreshSecret: string;

  // User authentication
  async validateUser(username: string, pass: string): Promise<UserEntity | null> {
    // Validates username/password against database
    // Returns UserEntity if valid, null if invalid
  }

  // Token generation
  login(user: UserEntity): string {
    // Generates JWT access token with user payload
    // Payload: { username, sub: userId, role: instanceRole }
  }

  async generateRefreshToken(userId: string, tx?: Prisma.TransactionClient): Promise<string> {
    // Creates refresh token with 30-day expiration
    // Stores hashed token in database with unique JTI
    // Returns signed JWT refresh token
  }

  // Token validation and refresh
  async verifyRefreshToken(refreshToken: string): Promise<[UserEntity, string]> {
    // Verifies refresh token signature and expiration
    // Returns user entity and token JTI for database lookup
  }

  async validateRefreshToken(jti: string, refreshToken: string, tx?: Prisma.TransactionClient): Promise<string | null> {
    // Validates refresh token against stored hash in database
    // Returns token ID if valid, null if invalid/expired
  }

  // Token cleanup
  async removeRefreshToken(jti: string, refreshToken: string, tx?: Prisma.TransactionClient): Promise<void> {
    // Removes refresh token from database
    // Used during logout and token rotation
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async cleanExpiredTokens(): Promise<void> {
    // Daily cleanup of expired refresh tokens
    // Prevents database bloat and maintains security
  }
}
```

#### Password Security

```typescript
// Password validation using bcrypt
const isValid = await bcrypt.compare(plainPassword, hashedPassword);

// Refresh token hashing for storage
const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
```

## Controllers

### AuthController

**Base Route:** `/api/auth`

#### Endpoints

| Method | Endpoint | Description | Throttling | RBAC Required |
|--------|----------|-------------|------------|---------------|
| POST | `/login` | Authenticate user with username/password | 4/1s, 10/1m | ❌ |
| POST | `/refresh` | Refresh access token using refresh token | 4/1s, 10/1m | ❌ |
| POST | `/logout` | Logout user and invalidate refresh token | 2/1s, 5/1m | ❌ |

#### Login Endpoint

```typescript
@Throttle({ short: { limit: 4, ttl: 1000 }, long: { limit: 10, ttl: 60000 } })
@UseGuards(LocalAuthGuard)
@Post('login')
@HttpCode(HttpStatus.OK)
async login(
  @Req() req: { user: UserEntity },
  @Res({ passthrough: true }) res: Response,
) {
  // Generate access and refresh tokens
  const accessToken = this.authService.login(req.user);
  const refreshToken = await this.authService.generateRefreshToken(req.user.id);
  
  // Set secure HttpOnly cookie for refresh token
  this.setRefreshCookie(res, refreshToken);
  
  return { accessToken };
}
```

#### Token Refresh Endpoint

```typescript
@Post('refresh')
async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
  // Extract refresh token from HttpOnly cookie
  const refreshToken = req.cookies[this.REFRESH_TOKEN_COOKIE_NAME];
  
  // Validate and rotate refresh token atomically
  const [user, jti] = await this.authService.verifyRefreshToken(refreshToken);
  
  const newToken = await this.databaseService.$transaction(async (tx) => {
    // Validate current token
    const tokenId = await this.authService.validateRefreshToken(jti, refreshToken, tx);
    if (!tokenId) throw new UnauthorizedException('Invalid refresh token');
    
    // Remove old token and generate new one (rotation)
    await this.authService.removeRefreshToken(jti, refreshToken, tx);
    return this.authService.generateRefreshToken(user.id, tx);
  });
  
  // Set new refresh token cookie and return new access token
  this.setRefreshCookie(res, newToken);
  return { accessToken: this.authService.login(user) };
}
```

## Authentication System

### JWT Strategy Configuration

```typescript
// JWT access token configuration
JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    secret: configService.get<string>('JWT_SECRET'),
    signOptions: { expiresIn: '1h' }, // Short-lived access tokens
  }),
})

// JWT refresh token configuration (separate secret)
const refreshSecret = configService.get<string>('JWT_REFRESH_SECRET');
const refreshToken = this.jwtService.sign(
  { sub: userId, jti: uniqueId },
  { secret: refreshSecret, expiresIn: '30d' }
);
```

### Passport Strategies

#### LocalStrategy
```typescript
// Username/password authentication
async validate(username: string, password: string): Promise<UserEntity> {
  const user = await this.authService.validateUser(username, password);
  if (!user) throw new UnauthorizedException();
  return user;
}
```

#### JwtStrategy
```typescript
// JWT token validation
async validate(payload: { sub: string; username: string; role: string }): Promise<UserEntity> {
  const user = await this.userService.findById(payload.sub);
  if (!user) throw new UnauthorizedException();
  return new UserEntity(user);
}
```

## Authorization System (RBAC)

### RBAC Decorators

#### RequiredActions Decorator
```typescript
// Specify required RBAC actions for endpoint
@RequiredActions(RbacActions.CREATE_MESSAGE, RbacActions.READ_CHANNEL)
@Post('messages')
async createMessage() {
  // Only users with both CREATE_MESSAGE and READ_CHANNEL permissions can access
}
```

#### RbacResource Decorator
```typescript
// Specify resource context for permission checking
@RbacResource({
  type: RbacResourceType.COMMUNITY,
  idKey: 'communityId',
  source: ResourceIdSource.BODY,
})
@RequiredActions(RbacActions.UPDATE_COMMUNITY)
@Put('communities')
async updateCommunity(@Body() body: { communityId: string; name: string }) {
  // Permission checked against specific community
}
```

### RBAC Guard Implementation

```typescript
@Injectable()
export class RbacGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Extract required actions from decorators
    const requiredActions = this.getRequiredRbacActions(context);
    if (!requiredActions.length) return true;
    
    // Extract resource context
    const resourceOptions = this.getResourceOptions(context);
    const resourceId = this.getResourceId(context, resourceOptions);
    const resourceType = resourceOptions?.type;
    
    // Get authenticated user
    const user = this.getUser(context);
    if (!user) return false;
    
    // Instance owners bypass all checks
    if (user.role === InstanceRole.OWNER) return true;
    
    // Check permissions through RolesService
    return this.rolesService.verifyActionsForUserAndResource(
      user.id,
      resourceId,
      resourceType,
      requiredActions
    );
  }
}
```

### Resource Types and Sources

```typescript
export enum RbacResourceType {
  COMMUNITY = 'COMMUNITY',
  CHANNEL = 'CHANNEL', 
  INSTANCE = 'INSTANCE',
  DM_GROUP = 'DM_GROUP',
}

export enum ResourceIdSource {
  BODY = 'body',        // Extract from request body
  QUERY = 'query',      // Extract from query parameters
  PARAM = 'param',      // Extract from URL parameters
  PAYLOAD = 'payload',  // Extract from WebSocket payload
  TEXT_PAYLOAD = 'text_payload', // WebSocket text payload
}
```

## Security Features

### Refresh Token Rotation
```typescript
// Secure token rotation pattern
const newToken = await this.databaseService.$transaction(async (tx) => {
  // Validate current refresh token
  const isValid = await this.authService.validateRefreshToken(jti, oldToken, tx);
  if (!isValid) throw new UnauthorizedException();
  
  // Delete old token (prevents reuse)
  await this.authService.removeRefreshToken(jti, oldToken, tx);
  
  // Generate new token
  return this.authService.generateRefreshToken(userId, tx);
});
```

### Secure Cookie Configuration
```typescript
private setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie(this.REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,           // Prevents XSS access
    sameSite: true,          // CSRF protection
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    maxAge: 30 * 24 * 60 * 60 * 1000,              // 30 days
    path: '/',
  });
}
```

### Rate Limiting
```typescript
// Login endpoint throttling
@Throttle({ 
  short: { limit: 4, ttl: 1000 },   // 4 requests per second
  long: { limit: 10, ttl: 60000 }   // 10 requests per minute
})
```

## Guards Usage

### HTTP Authentication
```typescript
@UseGuards(JwtAuthGuard, RbacGuard)
@RequiredActions(RbacActions.CREATE_MESSAGE)
@RbacResource({ type: RbacResourceType.CHANNEL, idKey: 'channelId', source: ResourceIdSource.BODY })
@Post('messages')
async createMessage(@Body() body: CreateMessageDto, @GetUser() user: UserEntity) {
  // Authenticated and authorized request
}
```

### WebSocket Authentication
```typescript
@UseGuards(WsJwtAuthGuard)
@SubscribeMessage(ClientEvents.SEND_MESSAGE)
async handleMessage(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
  const user = client.handshake.user; // Populated by WsJwtAuthGuard
  // Process authenticated WebSocket message
}
```

### Public Endpoints
```typescript
@Public() // Bypasses all authentication
@Get('health')
getHealth() {
  return { status: 'ok' };
}
```

## Dependencies

### Internal Dependencies
- `@/user/user.module` - User validation and data
- `@/roles/roles.module` - RBAC permission checking
- `@/database/database.module` - Refresh token storage

### External Dependencies
- `@nestjs/passport` - Authentication strategies
- `@nestjs/jwt` - JWT token handling
- `@nestjs/throttler` - Rate limiting
- `bcrypt` - Password and token hashing
- `mongodb` - ObjectId generation for JTI

## Environment Configuration

### Required Environment Variables
```bash
# JWT Configuration
JWT_SECRET=your-jwt-secret-key           # Access token signing secret
JWT_REFRESH_SECRET=your-refresh-secret   # Refresh token signing secret

# Security Settings
NODE_ENV=production                      # Enables secure cookies
```

## Error Handling

### Authentication Errors
```typescript
// Invalid credentials
throw new UnauthorizedException('Invalid username or password');

// Token validation failures
throw new UnauthorizedException('Invalid or expired token');

// Missing refresh token
throw new UnauthorizedException('No refresh token provided');
```

### Authorization Errors
```typescript
// RBAC permission denied (handled by RbacGuard)
// Returns 403 Forbidden automatically when user lacks required permissions

// Resource not found during permission check
// Returns appropriate error from RolesService
```

## Testing

### Service Tests
- **Location:** `backend/src/auth/auth.service.spec.ts`
- **Coverage:** Token generation, validation, refresh token lifecycle

```typescript
describe('AuthService', () => {
  it('should validate user with correct credentials', async () => {
    const user = await service.validateUser('testuser', 'password123');
    expect(user).toBeDefined();
    expect(user.username).toBe('testuser');
  });

  it('should generate valid refresh token', async () => {
    const token = await service.generateRefreshToken('user-id');
    expect(token).toBeDefined();
    
    const [user, jti] = await service.verifyRefreshToken(token);
    expect(user).toBeDefined();
    expect(jti).toBeDefined();
  });
});
```

### Controller Tests
- **Location:** `backend/src/auth/auth.controller.spec.ts`
- **Coverage:** Login flow, token refresh, logout

```typescript
describe('AuthController - login', () => {
  it('should return access token and set refresh cookie', async () => {
    const mockUser = { id: '123', username: 'test', role: 'USER' };
    const result = await controller.login({ user: mockUser }, mockResponse);
    
    expect(result.accessToken).toBeDefined();
    expect(mockResponse.cookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    );
  });
});
```

## Performance Considerations

- **Token Storage:** Refresh tokens stored as hashes for security
- **Database Cleanup:** Automated daily cleanup of expired tokens
- **Transaction Usage:** Atomic token rotation prevents race conditions
- **Rate Limiting:** Prevents brute force and abuse attacks
- **Cookie Security:** HttpOnly, Secure, SameSite protection

## Common Usage Patterns

### Pattern 1: Protected Controller
```typescript
@Controller('api/protected')
@UseGuards(JwtAuthGuard)
export class ProtectedController {
  @Get('profile')
  getProfile(@GetUser() user: UserEntity) {
    return user;
  }
}
```

### Pattern 2: RBAC Protected Endpoint
```typescript
@RequiredActions(RbacActions.CREATE_COMMUNITY)
@RbacResource({ type: RbacResourceType.INSTANCE })
@Post('communities')
async createCommunity(@Body() data: CreateCommunityDto, @GetUser() user: UserEntity) {
  // Only users with CREATE_COMMUNITY permission can access
}
```

### Pattern 3: WebSocket Authentication
```typescript
@WebSocketGateway()
@UseGuards(WsJwtAuthGuard)
export class ChatGateway {
  @SubscribeMessage('send_message')
  handleMessage(@ConnectedSocket() client: Socket) {
    const user = client.handshake.user; // Available after authentication
  }
}
```

## Related Modules

- **Roles Module** - RBAC permission validation
- **User Module** - User data and validation
- **Database Module** - Refresh token persistence
- **Community/Channel Modules** - Resource-based authorization

## Troubleshooting

### Common Issues
1. **Token Validation Failures**
   - **Symptoms:** Constant 401 errors, users logged out
   - **Cause:** JWT_SECRET mismatch between environments
   - **Solution:** Verify JWT_SECRET consistency across instances

2. **Refresh Token Rotation Issues**
   - **Symptoms:** Users unable to refresh tokens
   - **Cause:** Database transaction failures or timing issues
   - **Solution:** Check database connectivity and transaction handling

3. **RBAC Permission Denied**
   - **Symptoms:** 403 Forbidden on authorized actions
   - **Cause:** Missing user roles or incorrect resource context
   - **Solution:** Verify user role assignments and resource decorators

## Related Documentation

- [Roles Module](roles.md)
- [User Module](../features/user.md)
- [RBAC System](../../features/auth-rbac.md)
- [API Authentication](../../api/auth.md)