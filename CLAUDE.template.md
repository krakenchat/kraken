# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation-First Development

**Before implementing ANY feature, fixing ANY bug, or modifying ANY code, read the relevant documentation first.**

### Why This Matters

Without documentation:
- You'll reinvent patterns that already exist
- You'll miss existing utilities and components
- You'll break established conventions
- You'll create duplicate implementations

With documentation:
- You understand existing patterns and follow them
- You reuse components and utilities
- You integrate seamlessly with existing code
- You maintain consistency across the codebase

### Pre-Implementation Checklist

**Before writing ANY code, check these docs (in order):**

1. **Feature Docs** - `docs/features/[feature-name].md`
   - Understand the feature's architecture and flow
   - Identify all related components and modules

2. **Component Docs** - `docs/components/[ComponentName].md`
   - Understand props, state, and integration points
   - See usage examples and common patterns

3. **Hook Docs** - `docs/hooks/[hookName].md`
   - Understand hook APIs and return values
   - Identify existing hooks that solve your problem

4. **Module Docs** - `docs/modules/[module-name].md`
   - Understand backend services and DTOs
   - Follow permission patterns

5. **API Docs** - `docs/api/[controller-name].md`
   - Understand endpoint contracts
   - Follow authentication patterns

6. **State Docs** - `docs/state/[entity]Api.md`
   - Understand RTK Query endpoints
   - Follow caching strategies

### Documentation Structure

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

## Project Overview

<!-- Replace with your project description -->
A full-stack application built with NestJS backend and React frontend.

### Tech Stack

- **Backend**: NestJS (TypeScript) with modular architecture
- **Database**: MongoDB/PostgreSQL with Prisma ORM
- **Frontend**: React + TypeScript + Vite + Material-UI (or your UI library)
- **State Management**: Redux Toolkit with RTK Query
- **Real-time**: WebSockets via Socket.IO with Redis adapter
- **Authentication**: JWT with Passport.js strategies
- **Development**: Docker Compose with hot reload

## Development Commands

### Docker-Based Development

Using Docker ensures consistent environments across all developers.

#### Essential Docker Commands

```bash
# Start development environment
docker-compose up

# Start in background
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs [service-name]

# Rebuild containers
docker-compose build --no-cache

# Clean up (removes volumes)
docker-compose down -v
```

#### Backend Development (NestJS)

```bash
# Open shell in backend container
docker compose run backend bash

# Run tests
docker compose run backend npm run test

# Run e2e tests
docker compose run backend npm run test:e2e

# Lint code
docker compose run backend npm run lint

# Build
docker compose run backend npm run build
```

#### Frontend Development (React + Vite)

```bash
# Open shell in frontend container
docker compose run frontend bash

# Lint frontend
docker compose run frontend npm run lint

# Build frontend
docker compose run frontend npm run build

# Type check
docker compose run frontend npm run type-check
```

#### Database Operations (Prisma)

```bash
# Generate Prisma client
docker compose run backend npm run prisma:generate

# Push schema to DB
docker compose run backend npm run prisma:push

# Open Prisma Studio
docker compose run -p 5555:5555 backend npx prisma studio
```

### Daily Development Workflow

```bash
# 1. Start development environment
docker-compose up

# 2. Run backend tests (separate terminal)
docker compose run backend npm run test

# 3. Check linting (separate terminal)
docker compose run backend npm run lint

# 4. View logs for specific service
docker-compose logs backend -f

# 5. Stop everything when done
docker-compose down
```

### Troubleshooting

- **Services not starting**: `docker-compose down && docker-compose build --no-cache`
- **Database connection issues**: Ensure database container is healthy with `docker-compose ps`
- **Port conflicts**: Check if required ports are available
- **Fresh start**: `docker-compose down -v && docker-compose build --no-cache && docker-compose up`

## Architecture Overview

### Backend Architecture (NestJS)

The backend follows NestJS modular architecture in `backend/src/`:

#### Core Modules

- `auth/` - JWT authentication, guards, Passport strategies
- `user/` - User management and profiles
- `database/` - Prisma service and database connection
- `roles/` - Role-based access control system (if applicable)
- `cache/` - Redis caching service

#### Feature Modules

Organize by feature domain:
- Each feature has its own module, controller, service, and DTOs
- Services handle business logic
- Controllers handle HTTP requests
- Gateways handle WebSocket events

#### Real-time Modules

- `websocket/` - WebSocket service and event handling
- Feature-specific gateways for real-time events

### Frontend Architecture (React)

The frontend uses feature-based organization in `frontend/src/`:

#### State Management

```typescript
// Feature-based API slices with RTK Query
export const featureApi = createApi({
  reducerPath: 'featureApi',
  baseQuery: authedBaseQuery,
  tagTypes: ['Feature'],
  endpoints: (builder) => ({
    getItems: builder.query({...}),
    createItem: builder.mutation({...}),
  })
});
```

#### Directory Structure

```
frontend/src/
├── app/              # Redux store configuration
├── features/         # Feature-based API slices (RTK Query)
├── components/       # React components organized by feature
├── hooks/            # Custom React hooks
├── utils/            # Utility functions
├── contexts/         # React contexts
└── types/            # TypeScript type definitions
```

### Authentication & Authorization

- JWT-based auth with refresh tokens
- Role-based access control (RBAC) with granular permissions
- WebSocket authentication guards
- Protected routes on frontend

### Important Patterns

#### NestJS Controller Pattern

```typescript
@Controller('items')
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  findAll() {
    return this.itemsService.findAll();
  }

  @Post()
  create(@Body() createItemDto: CreateItemDto) {
    return this.itemsService.create(createItemDto);
  }
}
```

#### NestJS Service Pattern

```typescript
@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.item.findMany();
  }

  async create(dto: CreateItemDto) {
    return this.prisma.item.create({ data: dto });
  }
}
```

#### WebSocket Gateway Pattern

```typescript
@WebSocketGateway()
export class ItemsGateway {
  @SubscribeMessage('createItem')
  async handleCreate(@MessageBody() payload: CreateItemDto) {
    // Handle WebSocket event
  }
}
```

#### RTK Query Pattern

```typescript
export const itemsApi = createApi({
  reducerPath: 'itemsApi',
  baseQuery: authedBaseQuery,
  tagTypes: ['Items'],
  endpoints: (builder) => ({
    getItems: builder.query<Item[], void>({
      query: () => '/items',
      providesTags: ['Items'],
    }),
    createItem: builder.mutation<Item, CreateItemDto>({
      query: (body) => ({
        url: '/items',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Items'],
    }),
  }),
});
```

#### Custom Hook Pattern

```typescript
export function useItems() {
  const { data: items, isLoading, error } = useGetItemsQuery();
  const [createItem] = useCreateItemMutation();

  return {
    items: items ?? [],
    isLoading,
    error,
    createItem,
  };
}
```

## Code Quality Standards

### TypeScript

- Strict mode enabled
- No `any` types without justification
- Proper interface/type definitions for all data structures

### Linting & Formatting

- ESLint configured for both backend and frontend
- Prettier for code formatting
- Run lint checks before committing

### Testing

- Backend uses Jest for unit and e2e tests
- Test files follow `*.spec.ts` pattern
- E2E tests in `backend/test/` directory
- Use automocks where appropriate (e.g., `@suites/unit`)

### Documentation

- Update documentation when adding new features
- Create docs for new components, modules, and APIs
- Keep cross-references updated

## Environment Variables

Create `.env` files from samples:

```bash
cp backend/env.sample backend/.env
```

Required variables typically include:
- Database connection string
- JWT secrets (always change defaults!)
- Redis configuration
- API keys for external services

## Platform Separation (Web vs Desktop)

If supporting multiple platforms (Web + Electron):

### Platform Detection

```typescript
// Centralized platform utility
import { isElectron, isWeb } from './utils/platform';

if (isElectron()) {
  // Electron-specific code
}
```

### Platform-Specific Hooks

Encapsulate platform differences in hooks:

```typescript
// Good: Platform logic in hook
const { shareScreen } = useScreenShare();

// Avoid: Platform checks scattered in components
if (window.electronAPI) { /* ... */ }
```

### Guidelines

**Create platform-specific code for:**
- Native file system access
- Desktop notifications
- System tray integration
- Screen capture (different APIs)

**Keep platform-agnostic:**
- UI components
- State management
- WebSocket communication
- REST API calls

## Documentation Templates

Use templates when creating new code:

- **React Component**: `docs/templates/component.template.md`
- **NestJS Module**: `docs/templates/module.template.md`
- **API Endpoints**: `docs/templates/api.template.md`
- **Custom Hooks**: `docs/templates/hook.template.md`
- **Redux Slices**: `docs/templates/slice.template.md`
- **WebSocket Events**: `docs/templates/websocket.template.md`
