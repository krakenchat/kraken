# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 📖 **CRITICAL**: DOCUMENTATION-FIRST DEVELOPMENT

**⚠️ STOP: Before implementing ANY feature, fixing ANY bug, or modifying ANY code, you MUST read the relevant documentation first.**

### WHY THIS MATTERS

Without documentation:
- ❌ You'll reinvent patterns that already exist
- ❌ You'll miss existing utilities and components
- ❌ You'll break established conventions
- ❌ You'll create duplicate implementations
- ❌ Your code won't integrate properly
- ❌ You'll waste time on already-solved problems

With documentation:
- ✅ You understand existing patterns and follow them
- ✅ You reuse components and utilities
- ✅ You integrate seamlessly with existing code
- ✅ You maintain consistency across the codebase
- ✅ You work 10x faster with complete context

### MANDATORY PRE-IMPLEMENTATION CHECKLIST

**Before writing ANY code, check these docs (in order):**

1. **Feature Docs** → `docs/features/[feature-name].md`
   - Understand the feature's architecture and flow
   - Identify all related components and modules
   - See complete examples of the feature in action

2. **Component Docs** → `docs/components/[feature]/[ComponentName].md`
   - Understand props, state, and integration points
   - See usage examples and common patterns
   - Identify dependencies and related components

3. **Hook Docs** → `docs/hooks/[hookName].md`
   - Understand hook APIs and return values
   - See integration examples
   - Identify existing hooks that solve your problem

4. **Module Docs** → `docs/modules/[module-name].md`
   - Understand backend services and DTOs
   - Follow RBAC and permission patterns
   - See database query patterns

5. **API Docs** → `docs/api/[controller-name].md`
   - Understand endpoint contracts
   - Follow authentication patterns
   - Identify WebSocket events

6. **State Docs** → `docs/state/[entity]Api.md`
   - Understand RTK Query endpoints
   - Follow caching strategies
   - See mutation patterns

### DOCUMENTATION-FIRST WORKFLOW

```
User asks to implement feature X
         ↓
❌ WRONG: Start coding immediately
         ↓
✅ CORRECT: Search docs for related components
         ↓
Read feature docs (docs/features/)
         ↓
Read component docs (docs/components/)
         ↓
Read hook docs (docs/hooks/)
         ↓
Read module docs (docs/modules/)
         ↓
Read API docs (docs/api/)
         ↓
Read state docs (docs/state/)
         ↓
NOW you have complete context
         ↓
Implement following documented patterns
         ↓
Update docs to reflect your changes
```

### REAL EXAMPLES

**❌ BAD: Ignoring docs**
```
User: "Add user avatars to messages"
AI: *Immediately starts implementing avatar component*
Result: Creates duplicate of existing UserAvatar component,
        doesn't use FileCacheContext, causes 50x duplicate fetches,
        breaks existing patterns, wastes 2 hours
```

**✅ GOOD: Using docs**
```
User: "Add user avatars to messages"
AI: *Searches docs/components/common/* → finds UserAvatar.md
AI: *Reads UserAvatar.md* → learns about sizes, caching, props
AI: *Reads FileCacheContext.md* → understands performance optimization
AI: *Implements in 5 minutes using existing UserAvatar component*
Result: <UserAvatar user={message.author} size="small" />
        Uses existing caching, follows patterns, works perfectly
```

### QUICK REFERENCE

```bash
# Find docs before coding
find docs/ -name "*pattern*" -type f

# Search docs for keywords
grep -r "authentication" docs/

# List all component docs
ls docs/components/*/

# List all hook docs
ls docs/hooks/
```

### DOCUMENTATION STRUCTURE

```
docs/
├── features/          # Feature overviews and flows (START HERE)
├── components/        # React component docs with props and examples
├── hooks/             # Custom hook docs with usage patterns
├── modules/           # Backend module/service docs
├── api/               # REST & WebSocket endpoint docs
├── state/             # Redux/RTK Query docs
├── contexts/          # React context docs
├── templates/         # Templates for creating new docs
└── architecture/      # High-level system design
```

**🔥 REMEMBER: Documentation is not optional. It's your roadmap to working effectively in this codebase.**

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

### 🔌 Platform Separation Pattern (Web vs Electron)

**Kraken supports both web browsers and Electron desktop app. Use these patterns for clean platform separation:**

#### **1. Platform Detection Utility**

Always use the centralized platform utility instead of inline checks:

```typescript
// ✅ CORRECT: Use platform utility
import { isElectron, isWeb, hasElectronFeature } from './utils/platform';

if (isElectron()) {
  // Electron-specific code
}

if (hasElectronFeature('getDesktopSources')) {
  // Feature-specific check
}
```

```typescript
// ❌ WRONG: Inline platform checks
if (window.electronAPI) {  // Don't do this
  // ...
}
```

#### **2. Platform-Specific Hooks**

Use hooks to encapsulate platform differences (see `src/hooks/`):

- `useScreenShare()` - Platform-aware screen sharing (Electron picker vs browser native)
- `useMediaDevices()` - Cross-platform media device management
- More hooks in `docs/hooks/`

**Example:**
```typescript
// ✅ CORRECT: Use platform hook
import { useScreenShare } from '../../hooks/useScreenShare';

const MyComponent = () => {
  const { toggleScreenShare, isScreenSharing, showSourcePicker } = useScreenShare();

  return (
    <button onClick={toggleScreenShare}>
      {isScreenSharing ? 'Stop' : 'Share'} Screen
    </button>
  );
};
```

```typescript
// ❌ WRONG: Platform checks in component
const MyComponent = () => {
  const handleClick = () => {
    if (window.electronAPI?.getDesktopSources) {
      // Electron code
    } else {
      // Browser code
    }
  };
  // Messy and hard to test
};
```

#### **3. Platform Separation Guidelines**

**When to create platform-specific code:**
- Screen capture/sharing (different APIs)
- Native file system access
- Desktop notifications
- Auto-updates (Electron only)
- System tray integration (Electron only)

**What should be platform-agnostic:**
- Voice/video connection logic (LiveKit works on both)
- UI components (Material-UI works on both)
- State management (Redux works on both)
- WebSocket communication (works on both)
- REST API calls (works on both)

#### **4. Testing Platform Code**

```typescript
// Mock platform detection in tests
jest.mock('./utils/platform', () => ({
  isElectron: jest.fn(() => false),  // Test web behavior
  isWeb: jest.fn(() => true),
}));
```

#### **5. Common Pitfalls**

❌ **Don't**: Override browser APIs globally (breaks LiveKit)
```typescript
// NEVER DO THIS - Deprecated pattern
navigator.mediaDevices.getDisplayMedia = myCustomFunction;
```

✅ **Do**: Let Electron intercept via `setDisplayMediaRequestHandler` in main process
```typescript
// main.ts (Electron only)
session.defaultSession.setDisplayMediaRequestHandler(...)
```

❌ **Don't**: Scatter platform checks throughout components
```typescript
// Hard to maintain
if (window.electronAPI) { /* ... */ }
if (window.electronAPI?.feature) { /* ... */ }
```

✅ **Do**: Centralize in utility or hooks
```typescript
import { isElectron, hasElectronFeature } from './utils/platform';
```

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

## Documentation Templates

When creating new components, hooks, or modules, use these templates for documentation:

- **React Component**: `docs/templates/component.template.md`
- **NestJS Module**: `docs/templates/module.template.md`
- **API Endpoints**: `docs/templates/api.template.md`
- **Custom Hooks**: `docs/templates/hook.template.md`
- **Redux Slices**: `docs/templates/slice.template.md`
- **WebSocket Events**: `docs/templates/websocket.template.md`

**After creating new code, ALWAYS create corresponding documentation using these templates.**
- Remove orphan containers when using docker to run commands
- use @suites/unit testbed automocks for backend tests and write tests whenever we implement a new backend feature