# Backend Architecture

Kraken's backend is built with **NestJS**, following a modular architecture pattern with clear separation of concerns. The system uses MongoDB as the primary database, Redis for caching and WebSocket scaling, and integrates with LiveKit for voice/video functionality.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  HTTP Controllers  │  WebSocket Gateways  │  Guards & Auth  │
├─────────────────────────────────────────────────────────────┤
│                      SERVICE LAYER                          │
├─────────────────────────────────────────────────────────────┤
│    Business Logic   │   External APIs    │   Cache Layer    │
├─────────────────────────────────────────────────────────────┤
│                     DATA ACCESS LAYER                       │
├─────────────────────────────────────────────────────────────┤
│     Prisma ORM     │    MongoDB        │      Redis         │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Module Organization

The backend follows NestJS's modular structure with feature-based organization:

### Core Infrastructure Modules

#### **DatabaseModule** (`src/database/`)
- **Purpose**: Prisma client configuration and database connection
- **Key Files**:
  - `database.service.ts` - Prisma client wrapper and connection management
  - `database.module.ts` - Module configuration
- **Responsibilities**:
  - Database connection lifecycle
  - Prisma client singleton
  - Connection health checks

#### **AuthModule** (`src/auth/`)
- **Purpose**: Authentication and authorization system
- **Key Components**:
  - JWT strategy and guards (`jwt.strategy.ts`, `jwt-auth.guard.ts`)
  - Local authentication (`local.strategy.ts`, `local-auth.guard.ts`)
  - WebSocket authentication (`ws-jwt-auth.guard.ts`)
  - RBAC system (`rbac.guard.ts`, `rbac-action.decorator.ts`, `rbac-resource.decorator.ts`)
- **Features**:
  - JWT token generation and validation
  - Role-based access control (RBAC)
  - WebSocket authentication
  - Cookie-based session management

#### **RedisModule** (`src/redis/`)
- **Purpose**: Redis connection and pub/sub for WebSocket scaling
- **Integration**: Used by WebSocket adapter for multi-instance scaling
- **Services**: Connection management and pub/sub operations

#### **CacheModule** (`src/cache/`)
- **Purpose**: Application-level caching layer
- **Implementation**: Redis-backed caching for frequently accessed data
- **Use Cases**: User permissions, community memberships, channel lists

### Feature Modules

#### **UserModule** (`src/user/`)
- **Purpose**: User management and profiles
- **Entities**: User profiles, preferences, avatars
- **Operations**: CRUD operations, profile updates, user lookup
- **Integration**: Core dependency for all other modules

#### **CommunityModule** (`src/community/`)
- **Purpose**: Discord-like server management
- **Features**:
  - Community creation and management
  - Member management
  - Community settings (avatar, banner, description)
- **Relationships**: Has many channels, members, roles

#### **ChannelsModule** (`src/channels/`)
- **Purpose**: Text and voice channel management
- **Channel Types**: 
  - `TEXT` - For messaging
  - `VOICE` - For voice/video calls
- **Features**:
  - Public and private channels
  - Channel permissions
  - Integration with LiveKit for voice channels

#### **MessagesModule** (`src/messages/`)
- **Purpose**: Real-time messaging system
- **Features**:
  - Rich text with spans (mentions, formatting)
  - File attachments
  - Message reactions
  - Edit/delete functionality
- **Real-time**: WebSocket gateway for instant message delivery
- **Data Model**: Flexible span-based message structure

#### **MembershipModule** (`src/membership/`)
- **Purpose**: Community membership management
- **Operations**: Join/leave communities, member listing
- **Integration**: Works with roles for permission management

#### **ChannelMembershipModule** (`src/channel-membership/`)
- **Purpose**: Private channel access control
- **Features**: 
  - Add/remove users from private channels
  - Membership tracking
  - Permission verification

#### **RolesModule** (`src/roles/`)
- **Purpose**: Role-based access control system
- **Features**:
  - Granular permission system
  - Default role templates
  - Community-specific roles
- **Integration**: Core to the RBAC system across all modules

### Real-time Modules

#### **WebsocketModule** (`src/websocket/`)
- **Purpose**: Core WebSocket infrastructure
- **Features**:
  - Redis adapter for scaling
  - Event routing
  - Client management
  - Exception handling

#### **PresenceModule** (`src/presence/`)
- **Purpose**: User online/offline status
- **Features**: Real-time presence updates via WebSocket
- **Integration**: Tracks user activity across the application

#### **VoicePresenceModule** (`src/voice-presence/`)
- **Purpose**: Voice channel presence tracking
- **Features**: Track users in voice channels
- **Integration**: Works with LiveKit for voice channel state

### Integration Modules

#### **LivekitModule** (`src/livekit/`)
- **Purpose**: Voice/video call integration
- **Features**:
  - JWT token generation for LiveKit
  - Room management
  - Connection info provider
- **Security**: Generates secure tokens for voice/video access

#### **InviteModule** (`src/invite/`)
- **Purpose**: Instance and community invitation system
- **Features**:
  - Invite code generation
  - Usage tracking
  - Expiration management

## 🔒 Security Architecture

### Authentication Flow
1. **Login**: User provides credentials → JWT token generated
2. **Request**: Client sends JWT in Authorization header
3. **Validation**: JWT guard validates token and extracts user
4. **Authorization**: RBAC guard checks permissions for action

### RBAC System
The Role-Based Access Control system is implemented with:

- **Actions**: Granular permissions (e.g., `CREATE_MESSAGE`, `DELETE_CHANNEL`)
- **Resources**: Entity types (e.g., `COMMUNITY`, `CHANNEL`, `MESSAGE`)
- **Roles**: Collections of actions for specific contexts
- **Guards**: Decorators that enforce permissions at the controller/method level

```typescript
@RequiredActions(RbacActions.CREATE_MESSAGE)
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'channelId',
  source: ResourceIdSource.PAYLOAD,
})
```

## 🌐 WebSocket Architecture

### Event System
- **Client Events**: Actions initiated by clients (`SEND_MESSAGE`, `JOIN_CHANNEL`)
- **Server Events**: Responses and notifications (`NEW_MESSAGE`, `USER_JOINED`)
- **Room Management**: Users automatically join rooms for channels/communities

### Scaling
- **Redis Adapter**: Enables horizontal scaling across multiple server instances
- **Event Broadcasting**: Messages distributed to all connected clients in relevant rooms

## 🗄️ Data Access Patterns

### Prisma Integration
- **Schema-First**: Database schema defined in `prisma/schema.prisma`
- **Type Safety**: Fully typed database operations
- **No Migrations**: Uses `db push` for development flexibility

### Query Patterns
- **Service Layer**: All database operations encapsulated in services
- **DTOs**: Data Transfer Objects for request/response validation
- **Entities**: Type definitions for database models

## 🚀 Performance Considerations

### Caching Strategy
- **Redis Cache**: Frequently accessed data (user permissions, community info)
- **Query Optimization**: Efficient database queries with proper indexing
- **Connection Pooling**: MongoDB connection pool management

### Rate Limiting
- **Throttling**: Multiple rate limit tiers (short, medium, long term)
- **WebSocket Limits**: Prevent spam and abuse in real-time features

## 🧪 Testing Architecture

### Test Organization
- **Unit Tests**: `*.spec.ts` files alongside source code
- **E2E Tests**: End-to-end tests in `test/` directory
- **Mocking**: Database and external service mocking for isolated tests

### Testing Tools
- **Jest**: Primary testing framework
- **Supertest**: HTTP endpoint testing
- **Test Database**: Separate test database configuration

## 🔧 Configuration Management

### Environment Variables
- **Configuration**: Centralized in `ConfigModule`
- **Validation**: Environment variable validation and defaults
- **Security**: Sensitive values (JWT secrets, API keys) via environment

### Feature Flags
- **Conditional Features**: Environment-based feature enabling/disabling
- **Development vs Production**: Different configurations per environment

## 📈 Monitoring and Observability

### Logging
- **Structured Logging**: JSON-formatted logs with context
- **Log Levels**: Appropriate log levels for different environments
- **Request Tracing**: Request/response logging with timing

### Health Checks
- **Database Health**: MongoDB connection status
- **Redis Health**: Cache layer availability
- **Service Health**: Individual module health status

## 🔄 Data Flow Examples

### Message Creation Flow
1. Client sends `SEND_MESSAGE` via WebSocket
2. `MessagesGateway` receives event
3. RBAC guard validates user can create messages in channel
4. `MessagesService` creates message in database
5. `WebsocketService` broadcasts `NEW_MESSAGE` to channel room
6. All connected clients in channel receive message

### User Authentication Flow
1. Client POST to `/auth/login` with credentials
2. `AuthController` validates credentials via `AuthService`
3. JWT token generated and returned
4. Client includes token in subsequent requests
5. `JwtAuthGuard` validates token on protected routes
6. User context available throughout request lifecycle

This modular architecture provides clear separation of concerns, scalability, and maintainability while supporting real-time features and complex permission systems.