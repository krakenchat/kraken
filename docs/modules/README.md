# Kraken Backend Module Documentation

This directory contains comprehensive documentation for all NestJS modules in the Kraken backend application. Each module is documented with its structure, services, controllers, DTOs, database schema, authentication patterns, and integration details.

## Module Organization

### Core Infrastructure Modules
Core services that provide foundational functionality for the entire application.

- **[Database Module](core/database.md)** - Prisma client wrapper with lifecycle management
- **[Cache Module](core/cache.md)** - Redis-based caching with JSON serialization  
- **[Redis Module](core/redis.md)** - Redis connection and basic operations
- **[WebSocket Module](core/websocket.md)** - Socket.IO service for real-time communication

### Authentication & Authorization Modules  
Comprehensive security system with JWT authentication and role-based access control.

- **[Auth Module](auth/auth.md)** - JWT authentication, refresh tokens, RBAC guards
- **[Roles Module](auth/roles.md)** - Role-based access control and permission management

### Feature Modules
Business logic modules that implement core Kraken functionality.

- **[Community Module](features/community.md)** - Discord-like community/server management
- **[Channels Module](features/channels.md)** - Text and voice channel management  
- **[Messages Module](features/messages.md)** - Rich messaging with spans, mentions, attachments
- **[Users Module](features/users.md)** - User registration, profiles, search functionality
- **[Membership Module](features/membership.md)** - Community membership lifecycle management
- **[Channel Membership Module](features/channel-membership.md)** - Private channel access control

### Voice & Communication Modules
Real-time voice/video communication powered by LiveKit integration.

- **[LiveKit Module](voice/livekit.md)** - WebRTC token generation and room management
- **[Rooms Module](voice/rooms.md)** - Voice room management and participant tracking
- **[Presence Module](voice/presence.md)** - User online status and activity tracking
- **[Voice Presence Module](voice/voice-presence.md)** - Voice channel presence management

### Integration & Utility Modules
Supporting modules for invitation system, onboarding, and external integrations.

- **[Invite Module](utilities/invite.md)** - Instance invitation system for user registration
- **[Onboarding Module](utilities/onboarding.md)** - First-time setup and configuration

## Architecture Patterns

### Common Patterns Across Modules

#### Module Structure
```
module-name/
├── module-name.module.ts          # Module definition
├── module-name.service.ts         # Business logic
├── module-name.controller.ts      # HTTP endpoints  
├── module-name.gateway.ts         # WebSocket handlers (if applicable)
├── dto/                          # Data transfer objects
├── entities/                     # Database entity definitions
└── __tests__/                    # Unit tests
```

#### Service Patterns
- **Constructor Injection**: All dependencies injected via constructor
- **Database Operations**: Prisma client via DatabaseService
- **Transaction Usage**: Complex operations wrapped in database transactions
- **Error Handling**: Consistent exception throwing with proper HTTP status codes
- **Logging**: Structured logging using NestJS Logger

#### Controller Patterns  
- **Authentication**: JwtAuthGuard for protected endpoints
- **Authorization**: RbacGuard with RequiredActions and RbacResource decorators
- **Validation**: class-validator decorators on DTOs
- **Response DTOs**: Sanitized response objects excluding sensitive data

#### Integration Patterns
- **WebSocket Events**: Real-time updates via WebsocketService
- **RBAC Protection**: Granular permissions with resource context
- **Database Relations**: Leveraging Prisma relations for efficient queries
- **Error Propagation**: Consistent error handling across module boundaries

## Key Dependencies

### Internal Dependencies
All modules depend on core infrastructure:
- `DatabaseModule` - Data persistence
- `AuthModule` - Authentication and authorization
- `WebsocketModule` - Real-time communication
- `CacheModule` - Performance optimization

### External Dependencies
- **Database**: MongoDB with Prisma ORM
- **Authentication**: JWT with bcrypt password hashing
- **Real-time**: Socket.IO with Redis adapter
- **Voice/Video**: LiveKit WebRTC platform
- **Validation**: class-validator and class-transformer

## Database Schema Overview

### Core Entities
- **User** - User accounts with instance roles
- **Community** - Discord-like servers/communities
- **Channel** - Text and voice channels within communities
- **Message** - Rich messages with span-based content structure
- **Membership** - User-community relationships
- **ChannelMembership** - User access to private channels

### Supporting Entities
- **RefreshToken** - JWT refresh token storage
- **InstanceInvite** - User registration invitation system
- **Role** - RBAC role definitions
- **UserRoles** - User-role assignments (community-scoped)
- **DirectMessageGroup** - Private messaging (planned)

### Schema Characteristics
- **MongoDB with Prisma**: NoSQL flexibility with type-safe ORM
- **Embedded Documents**: Spans, Attachments, Reactions as embedded types
- **Unique Constraints**: Composite unique keys for relationships
- **Cascade Deletions**: Database-level cleanup for data consistency

## RBAC Permission System

### Permission Categories
```typescript
// Message permissions
CREATE_MESSAGE, READ_MESSAGE, DELETE_MESSAGE

// Channel permissions  
CREATE_CHANNEL, READ_CHANNEL, UPDATE_CHANNEL, DELETE_CHANNEL, JOIN_CHANNEL

// Community permissions
CREATE_COMMUNITY, READ_COMMUNITY, UPDATE_COMMUNITY, DELETE_COMMUNITY

// User management
CREATE_USER, READ_USER, UPDATE_USER, DELETE_USER

// Administrative
CREATE_INSTANCE_INVITE, READ_INSTANCE_INVITE, DELETE_INSTANCE_INVITE
```

### Resource Context Types
```typescript
enum RbacResourceType {
  INSTANCE = 'INSTANCE',      // Instance-level permissions
  COMMUNITY = 'COMMUNITY',    // Community-scoped permissions
  CHANNEL = 'CHANNEL',        // Channel-specific permissions
  DM_GROUP = 'DM_GROUP',      // Direct message group permissions
}
```

## Real-time Communication

### WebSocket Event Categories
- **Message Events**: NEW_MESSAGE, UPDATE_MESSAGE, DELETE_MESSAGE
- **Presence Events**: USER_ONLINE, USER_OFFLINE, TYPING_START, TYPING_STOP
- **Voice Events**: VOICE_STATE_UPDATE, VOICE_USER_JOIN, VOICE_USER_LEAVE
- **Community Events**: MEMBER_JOIN, MEMBER_LEAVE, ROLE_UPDATE

### Integration Pattern
1. HTTP endpoints handle business logic and data persistence
2. WebSocket service broadcasts real-time updates to relevant rooms
3. Frontend receives updates and updates UI state accordingly

## Performance Considerations

### Database Optimization
- **Indexes**: Strategic indexing on frequently queried fields
- **Relations**: Selective includes to avoid N+1 queries
- **Pagination**: Cursor-based pagination for efficient large dataset handling
- **Transactions**: Atomic operations for data consistency

### Caching Strategy
- **Session Data**: User sessions and authentication tokens
- **Query Results**: Community members, channel lists
- **Rate Limiting**: Request throttling and abuse prevention
- **Message History**: Frequently accessed message threads

### Real-time Scaling
- **Redis Adapter**: Socket.IO scaling across multiple server instances
- **Room Management**: Efficient room subscription and broadcasting
- **Connection Pooling**: Optimized database connection management

## Testing Strategy

### Unit Testing
- **Service Tests**: Business logic validation with mocked dependencies
- **Controller Tests**: HTTP endpoint testing with request/response validation
- **Gateway Tests**: WebSocket event handling verification

### Integration Testing
- **Database Tests**: End-to-end database operation validation
- **Authentication Tests**: JWT flow and RBAC permission verification  
- **Real-time Tests**: WebSocket event propagation testing

### Test Utilities
- **Mock Factories**: Reusable mock objects for testing
- **Database Seeding**: Test data setup for integration tests
- **Authentication Helpers**: Test user creation and token generation

## Development Guidelines

### Adding New Modules
1. Follow established directory structure and naming conventions
2. Implement consistent error handling and logging patterns
3. Add comprehensive RBAC protection with appropriate resource context
4. Include WebSocket integration for real-time features where applicable
5. Write comprehensive unit and integration tests
6. Document module following the established template

### Extending Existing Modules
1. Maintain backward compatibility where possible
2. Follow established service and controller patterns
3. Update related documentation and tests
4. Consider impact on dependent modules
5. Test integration points thoroughly

### Database Changes
1. Update Prisma schema with proper relations and constraints
2. Run `npm run prisma:generate` to update client types
3. Use `npm run prisma:push` to apply changes to database
4. Update affected DTOs and service methods
5. Test migration impact on existing data

## Related Documentation

- **[API Documentation](../api/README.md)** - HTTP endpoint specifications
- **[Architecture Documentation](../architecture/README.md)** - System design and patterns
- **[Features Documentation](../features/README.md)** - Feature-specific implementation details
- **[Setup Documentation](../setup/README.md)** - Development and deployment guides

## Module Dependency Graph

```
Database Module (Core)
├── Auth Module
│   ├── Roles Module
│   └── All Feature Modules (Authentication)
├── Cache Module → Redis Module
├── WebSocket Module → All Real-time Modules
├── Community Module
│   ├── Channels Module → LiveKit Module
│   ├── Membership Module
│   └── Messages Module
├── Users Module → Invite Module
└── Voice Modules (LiveKit, Rooms, Presence, Voice Presence)
```

This comprehensive module documentation provides the foundation for understanding, maintaining, and extending the Kraken backend architecture. Each module builds upon the core infrastructure while maintaining clear separation of concerns and consistent integration patterns.