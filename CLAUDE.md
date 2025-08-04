# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kraken** is a Discord-like voice chat application built with NestJS backend and React frontend, designed to provide feature parity with popular voice chat platforms like Discord.

### Core Concepts

- **Instance**: The application stack running in hosted or self-hosted environments
- **Communities**: User/admin-created servers with members, channels, and voice/video contexts
- **Members**: Users registered with the instance and added to communities
- **Channels**: Text and voice channels within communities
- **Direct Messages & Groups**: Private messaging with voice/video support (planned)

### Platform Goals

- **Current**: Browser-based application
- **Future Roadmap**:
  - Mobile app (React Native or Electron)
  - Desktop application (Electron)

### Key Features

- Real-time messaging via WebSockets
- Voice/video calls powered by LiveKit integration  
- Community-based organization similar to Discord servers
- Role-based permissions system
- Private channels and direct messaging
- User presence and online status

### Voice Channel Implementation Notes

- **LiveKit Integration**: Channel IDs are used as LiveKit room IDs for voice/video sessions
- **Persistent Connections**: Voice connections should persist across page navigation (similar to Discord)
- **Presence System**: Track users currently in voice channels for REST API and real-time updates
- **Channel Types**: `VOICE` channels support both audio-only and video modes with screen sharing
- **UI Pattern**: Bottom persistent bar when connected + video tiles overlay when video enabled

## Development Commands

### Backend (NestJS)
- **Build**: `npm run build` (from backend/)
- **Development**: `npm run start:dev` (hot reload)
- **Debug**: `npm run start:debug`
- **Production**: `npm run start:prod`
- **Lint**: `npm run lint`
- **Format**: `npm run format`
- **Test**: `npm run test`
- **Test with coverage**: `npm run test:cov`
- **E2E tests**: `npm run test:e2e`
- **Single test**: `jest <test-file-pattern>`

### Frontend (React + Vite)
- **Build**: `npm run build` (from frontend/)
- **Development**: `npm run dev` (hot reload on port 5173)
- **Electron dev**: `npm run electron-dev`
- **Clean**: `npm run clean`
- **Lint**: `npm run lint`
- **Lint with fix**: `npm run lint:fix`

### Database (Prisma + MongoDB)
- **Generate client**: `npm run prisma:generate` (from backend/)
- **Push schema**: `npm run prisma:push`
- **Full setup**: `npm run prisma` (generates + pushes)
- **Manual commands**:
  - `npx prisma db push --schema=prisma/schema.prisma`
  - `npx prisma generate --schema=prisma/schema.prisma`

### Docker Development
- **Start all services**: `docker-compose up`
- **Backend shell**: `docker compose run backend bash`
- **Push schema in container**: `docker compose run backend npm run prisma:generate && npm run prisma:push`
- **Rebuild containers**: `docker-compose build --no-cache`

## Architecture Overview

### Tech Stack
- **Backend**: NestJS (TypeScript) with modular architecture
- **Database**: MongoDB with Prisma ORM (no migrations, uses `db push`)
- **Frontend**: React 19 + TypeScript + Vite + Material-UI
- **State Management**: Redux Toolkit with RTK Query
- **Real-time**: WebSockets via Socket.IO with Redis adapter
- **Authentication**: JWT with Passport.js strategies
- **Video Calls**: LiveKit integration
- **Development**: Docker Compose with hot reload

### Key Backend Modules
The backend follows NestJS modular architecture in `backend/src/`:

- **Core Modules**:
  - `auth/` - JWT authentication, RBAC guards, Passport strategies
  - `user/` - User management and profiles
  - `database/` - Prisma service and database connection
  - `roles/` - Role-based access control system
  - `cache/` - Redis caching service

- **Chat Features**:
  - `community/` - Community/server management
  - `channels/` - Text and voice channels
  - `messages/` - Message handling with spans, attachments, reactions
  - `membership/` - Community membership management
  - `channel-membership/` - Private channel access control
  - `presence/` - User online status
  - `invite/` - Instance and community invitations

- **Real-time**:
  - `websocket/` - WebSocket service and event handling
  - `messages.gateway` - Real-time message events
  - `presence.gateway` - User presence updates
  - `rooms/` - Room management for voice/video

- **Integrations**:
  - `livekit/` - Video call token generation and room management
  - `redis/` - Redis connection and pub/sub

### Frontend Architecture
The frontend uses feature-based organization in `frontend/src/`:

- **State Management** (`app/store.ts`):
  - Redux store with RTK Query APIs for each backend module
  - Separate slice for local message state

- **Features** (`features/`):
  - Each feature has its own API slice using RTK Query
  - Matches backend module structure (auth, community, channels, etc.)
  - Role-based component rendering system

- **Components** (`components/`):
  - Feature-organized component structure
  - Material-UI based design system
  - LiveKit integration for video calls

- **Real-time** (`hooks/`, `utils/`):
  - WebSocket hooks for different features
  - Socket.IO singleton for connection management
  - Event-driven message updates

### Database Schema
MongoDB with Prisma schema defines:
- **Users**: Authentication, profiles, instance roles
- **Communities**: Discord-like servers with channels
- **Channels**: Text/voice channels with private channel support
- **Messages**: Rich messages with spans (mentions, formatting), attachments, reactions
- **Memberships**: Community and channel membership tracking
- **Roles & Permissions**: RBAC system with granular permissions
- **Direct Messages**: Private messaging between users
- **LiveKit Integration**: Video call room management

### Authentication & Authorization
- JWT-based auth with refresh tokens
- Role-based access control (RBAC) with granular permissions
- Instance-level and community-level roles
- WebSocket authentication guards
- Private channel membership system

### Development Environment
- Docker Compose orchestrates MongoDB (replica set), Redis, backend, and frontend
- Hot reload enabled for both frontend and backend
- MongoDB requires replica set for change streams
- Redis used for WebSocket scaling and caching

## Important Notes

### Database Operations
- MongoDB uses `prisma db push` instead of migrations
- Always run `prisma generate` after schema changes
- Database requires replica set configuration for real-time features

### Environment Variables
Copy `backend/env.sample` to `backend/.env` and configure:
- MongoDB connection string
- JWT secrets (change defaults!)
- Redis host configuration

### Testing
- Backend uses Jest for unit and e2e tests
- Test files follow `*.spec.ts` pattern
- E2E tests in `backend/test/` directory

### Code Quality
- ESLint configured for both backend and frontend
- Prettier for code formatting
- TypeScript strict mode enabled
- Consistent import path aliases using `@/` for backend src

## 📚 Comprehensive Documentation

**Full documentation is available in the `docs/` folder:**

### Architecture Documentation
- **[Backend Architecture](docs/architecture/backend.md)** - NestJS modules, services, and design patterns
- **[Frontend Architecture](docs/architecture/frontend.md)** - React components, Redux state management, and UI patterns  
- **[Database Schema](docs/architecture/database.md)** - MongoDB models, relationships, and query patterns

### Feature Analysis
- **[Discord Feature Parity](docs/features/discord-parity.md)** - Comprehensive comparison (~51% parity achieved)
- **[Incomplete Features](docs/features/incomplete.md)** - Foundation features ready for completion

### Key Findings from Codebase Analysis

#### Current Feature Status (High-Level)
- **✅ Core Chat**: 80% complete - Real-time messaging, channels, basic mentions
- **✅ Voice/Video**: 60% complete - LiveKit integration, voice channels, video calls
- **✅ Communities**: 69% complete - Server management, member management, basic roles
- **🔧 RBAC System**: 40% complete - Strong backend foundation, needs frontend completion
- **🔧 Direct Messages**: 30% complete - Database schema ready, needs UI implementation
- **🔧 File Attachments**: 25% complete - Upload infrastructure exists, needs message integration

#### High-Impact, Low-Effort Completions Available
1. **Community Invitations** (1 week) - Backend complete, needs frontend UI
2. **Message Editing** (1 week) - Backend ready, needs edit interface
3. **RBAC Management** (2-3 weeks) - Strong foundation, needs admin interface
4. **Voice Persistence** (1-2 weeks) - Core working, needs navigation persistence
5. **File Attachments** (2-3 weeks) - Upload system exists, needs message integration

#### Critical Architecture Strengths
- **Modular Design**: Clean separation between features and concerns
- **Type Safety**: Full TypeScript coverage with Prisma type generation
- **Real-time Foundation**: Robust WebSocket system with Redis scaling
- **Permission System**: Comprehensive RBAC with 57 granular permissions
- **Rich Text**: Flexible span-based message system supporting mentions and formatting
- **Voice Integration**: Professional LiveKit WebRTC implementation

#### Areas Needing Attention
- **Mobile Experience**: Currently desktop-focused, needs responsive optimization
- **Permission UI**: RBAC backend is solid, but admin interfaces are incomplete
- **DM System**: Database models complete, entire frontend needs implementation
- **File Handling**: Basic upload works, needs security, processing, and UI integration
- **Testing Coverage**: Unit tests exist but need expansion for complex features

### Development Priorities (Based on Analysis)

#### Phase 1: Complete Foundation Features (4-6 weeks)
1. Community invitation system (frontend)
2. Message editing interface  
3. Basic message reactions
4. Voice connection persistence

#### Phase 2: Major Features (6-8 weeks)
1. Complete RBAC management interface
2. File attachment system
3. Direct message interface
4. Mobile responsiveness

#### Phase 3: Advanced Features (Future)
1. Rich text editor with markdown
2. Advanced moderation tools
3. Mobile applications
4. Bot/webhook system

### Important Code Patterns

#### RBAC Usage
```typescript
@RequiredActions(RbacActions.CREATE_MESSAGE)
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'channelId',
  source: ResourceIdSource.PAYLOAD,
})
```

#### WebSocket Event Pattern
```typescript
@SubscribeMessage(ClientEvents.SEND_MESSAGE)
async handleMessage(@MessageBody() payload: CreateMessageDto) {
  // Process message
  this.websocketService.sendToRoom(channelId, ServerEvents.NEW_MESSAGE, data);
}
```

#### Redux State Management
```typescript
// Feature-based API slices with RTK Query
export const messagesApi = createApi({
  reducerPath: 'messagesApi',
  baseQuery: authedBaseQuery,
  tagTypes: ['Messages'],
  endpoints: (builder) => ({ ... })
});
```