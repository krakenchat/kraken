# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🐳 **CRITICAL**: ALL DEVELOPMENT USES DOCKER

**Never run npm/yarn/node commands directly on the host. Always use Docker containers as shown in the Development Commands section below.**

## Project Overview

**Kraken** is a Discord-like voice chat application built with NestJS backend and React frontend, designed to provide feature parity with popular voice chat platforms like Discord.

### Core Concepts

- **Instance**: The application stack running in hosted or self-hosted environments
- **Communities**: User/admin-created servers with members, channels, and voice/video contexts
- **Members**: Users registered with the instance and added to communities
- **Channels**: Text and voice channels within communities
- **Direct Messages & Groups**: Private messaging between users (✅ implemented with file attachments)

### Platform Goals

- **Current**: Browser-based application
- **Future Roadmap**:
  - Mobile app (React Native or Electron)
  - Desktop application (Electron)

### Key Features

- Real-time messaging via WebSockets with file attachments
- Voice/video calls powered by LiveKit integration
- Community-based organization similar to Discord servers
- Role-based permissions system (RBAC)
- Private channels and direct messaging
- User presence and online status
- User profiles with avatars and banners
- Authenticated file caching system

### Voice Channel Implementation Notes

- **LiveKit Integration**: Channel IDs are used as LiveKit room IDs for voice/video sessions
- **Persistent Connections**: Voice connections should persist across page navigation (similar to Discord)
- **Presence System**: Track users currently in voice channels for REST API and real-time updates
- **Channel Types**: `VOICE` channels support both audio-only and video modes with screen sharing
- **UI Pattern**: Bottom persistent bar when connected + video tiles overlay when video enabled

## Development Commands

**🐳 ALL DEVELOPMENT SHOULD BE DONE WITH DOCKER**

### Essential Docker Commands

- **Start development**: `docker-compose up` (starts all services with hot reload)
- **Start in background**: `docker-compose up -d`
- **Stop all services**: `docker-compose down`
- **View logs**: `docker-compose logs [service-name]` (e.g., `docker-compose logs backend`)
- **Rebuild containers**: `docker-compose build --no-cache`
- **Clean up**: `docker-compose down -v` (removes volumes)

### Backend Development (NestJS in Docker)

- **Backend shell**: `docker compose run backend bash`
- **Run tests**: `docker compose run backend npm run test`
- **Run e2e tests**: `docker compose run backend npm run test:e2e`
- **Lint code**: `docker compose run backend npm run lint`
- **Build**: `docker compose run backend npm run build`
- **Single test**: `docker compose run backend jest <test-pattern>`

### Frontend Development (React + Vite in Docker)

- **Frontend shell**: `docker compose run frontend bash`
- **Lint frontend**: `docker compose run frontend npm run lint`
- **Build frontend**: `docker compose run frontend npm run build`
- **Type check**: `docker compose run frontend npm run type-check`

### Database Operations (Prisma in Docker)

- **Generate Prisma client**: `docker compose run backend npm run prisma:generate`
- **Push schema to DB**: `docker compose run backend npm run prisma:push`
- **Full setup**: `docker compose run backend npm run prisma` (generates + pushes)
- **Prisma studio**: `docker compose run -p 5555:5555 backend npx prisma studio`

### 🚨 **Important Notes**

- **Never run npm commands directly on host** - always use Docker containers
- **Hot reload is enabled** - file changes automatically update in containers
- **Ports**: Frontend (5173), Backend (3001), MongoDB (27017), Redis (6379)
- **Data persistence**: MongoDB and Redis data is persisted in Docker volumes

### 📋 **Daily Development Workflow**

```bash
# 1. Start development environment
docker-compose up

# 2. In separate terminal: Run backend tests
docker compose run backend npm run test

# 3. In separate terminal: Check backend linting
docker compose run backend npm run lint

# 4. In separate terminal: Update database schema
docker compose run backend npm run prisma:push

# 5. View logs for specific service
docker-compose logs backend -f

# 6. Stop everything when done
docker-compose down
```

### 🔧 **Troubleshooting**

- **Services not starting**: Try `docker-compose down` then `docker-compose build --no-cache`
- **Database connection issues**: Ensure MongoDB container is healthy with `docker-compose ps`
- **Port conflicts**: Check if ports 3001, 5173, 27017, 6379 are available
- **Permission issues**: Use `docker compose run --rm backend bash` to debug
- **Fresh start**: `docker-compose down -v && docker-compose build --no-cache && docker-compose up`

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

### Documentation Updates

- **ALWAYS update documentation when adding new features or modifying existing code**
- Update relevant files in `docs/` after implementing new components, modules, or APIs
- Create new documentation using templates in `docs/templates/` for new features
- Keep cross-references updated between related components and modules

## 📚 Comprehensive Documentation

**Full documentation is available in the `docs/` folder:**

### Architecture Documentation

- **[Backend Architecture](docs/architecture/backend.md)** - NestJS modules, services, and design patterns
- **[Frontend Architecture](docs/architecture/frontend.md)** - React components, Redux state management, and UI patterns
- **[Database Schema](docs/architecture/database.md)** - MongoDB models, relationships, and query patterns

### Feature Analysis

- **[Discord Feature Parity](docs/features/discord-parity.md)** - Comprehensive comparison (~51% parity achieved)
- **[Incomplete Features](docs/features/incomplete.md)** - Foundation features ready for completion

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

## 🤖 AI Assistant Documentation System

This project includes a comprehensive documentation system designed to accelerate AI-assisted development. **ALWAYS reference these docs before writing or modifying code.**

### Documentation Structure

```
docs/
├── api/                    # REST & WebSocket API documentation
├── components/            # React component reference docs
├── modules/               # Backend NestJS module documentation
├── hooks/                 # Custom React hooks documentation
├── state/                 # Redux slices & RTK Query APIs
├── templates/             # Documentation templates for new code
├── architecture/          # High-level architecture docs
└── features/              # Feature analysis and specifications
```

### **MANDATORY: Pre-Development Documentation Lookup**

Before implementing any feature or modifying existing code, you MUST:

1. **Check Component Docs**: `docs/components/[feature]/[ComponentName].md`

   - Understand props, usage patterns, and integration points
   - Follow established patterns and conventions
   - Identify related components and dependencies

2. **Check Module Docs**: `docs/modules/[module-name].md`

   - Understand service methods, DTOs, and business logic
   - Follow RBAC patterns and database query conventions
   - Identify existing endpoints and WebSocket events

3. **Check API Docs**: `docs/api/[controller-name].md`

   - Understand existing endpoints and their contracts
   - Follow authentication and permission patterns
   - Identify WebSocket events triggered by API changes

4. **Check Hook Docs**: `docs/hooks/[hookName].md`

   - Understand custom hook APIs and usage patterns
   - Identify existing hooks that might satisfy requirements
   - Follow established state management patterns

5. **Check State Docs**: `docs/state/[entity]Api.md`
   - Understand RTK Query endpoints and caching strategies
   - Follow established mutation and query patterns
   - Identify existing WebSocket integrations

### **AI Development Workflow**

#### 1. Research Phase (MANDATORY)

```typescript
// ALWAYS start by reading relevant documentation:
// 1. docs/components/[feature]/[RelatedComponent].md
// 2. docs/modules/[related-module].md
// 3. docs/api/[related-api].md
// 4. docs/hooks/[related-hook].md
// 5. docs/state/[related-state].md
```

#### 2. Implementation Phase

- **Follow Documented Patterns**: Use existing patterns from the docs rather than creating new ones
- **Maintain Consistency**: Match the documented code style, naming conventions, and architectural decisions
- **Integrate Properly**: Use documented APIs, props, and integration points
- **Handle Errors**: Follow documented error handling patterns

#### 3. Documentation Update Phase

After implementing new code:

- **Update Existing Docs**: Modify docs to reflect any changes to existing components/modules
- **Create New Docs**: Use templates in `docs/templates/` for new components/modules
- **Cross-Reference**: Add links between related documentation

### **Quick Reference Commands**

```bash
# Find component documentation
find docs/components -name "*ComponentName*"

# Find API documentation
find docs/api -name "*endpoint*"

# Find hook documentation
find docs/hooks -name "*hookName*"

# Search all documentation for a pattern
grep -r "pattern" docs/
```

### **Documentation Templates**

When creating new code, use these templates:

- **React Component**: `docs/templates/component.template.md`
- **NestJS Module**: `docs/templates/module.template.md`
- **API Endpoints**: `docs/templates/api.template.md`
- **Custom Hooks**: `docs/templates/hook.template.md`
- **Redux Slices**: `docs/templates/slice.template.md`
- **WebSocket Events**: `docs/templates/websocket.template.md`

### **Integration Patterns**

#### Component Integration

```typescript
// ALWAYS check docs/components/[feature]/ first
import { ExistingComponent } from "@/components/[feature]/ExistingComponent";
// Follow documented prop patterns and usage examples
```

#### API Integration

```typescript
// ALWAYS check docs/api/[controller].md first
// Follow documented endpoint patterns, RBAC, and error handling
```

#### State Management

```typescript
// ALWAYS check docs/state/[entity]Api.md first
// Follow documented RTK Query patterns and caching strategies
```

### **Cross-Reference System**

Each documentation file includes:

- **Related Components**: Links to connected frontend components
- **Related Modules**: Links to backend services and controllers
- **Related APIs**: Links to REST and WebSocket endpoints
- **Related Documentation**: Links to architecture and feature docs

### **Maintenance Guidelines**

- **Keep Docs Updated**: Update documentation when modifying code
- **Use Consistent Format**: Follow the established template structure
- **Add Usage Examples**: Include practical code examples
- **Cross-Reference**: Maintain links between related components
- **Test Examples**: Ensure code examples are current and working

### **AI Performance Tips**

1. **Batch Documentation Reads**: Read multiple related docs before starting implementation
2. **Follow Established Patterns**: Don't reinvent - use documented approaches
3. **Leverage Cross-References**: Follow links to understand component relationships
4. **Use Search**: Grep documentation for patterns before writing new code
5. **Check Templates**: Use templates for consistency when creating new files

**This documentation system is designed to make you 10x more effective. Use it religiously.**
