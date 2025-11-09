# Testing Guide

Comprehensive guide to testing in the Kraken backend.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Test Infrastructure](#test-infrastructure)
4. [Writing Tests](#writing-tests)
5. [Testing Patterns](#testing-patterns)
6. [Coverage Requirements](#coverage-requirements)

## Overview

The Kraken backend uses:
- **Jest** as the test runner
- **@nestjs/testing** for NestJS test utilities
- **@suites/unit** for enhanced testbed support
- **Custom test utilities** in `src/test-utils/`

### Test Structure

```
backend/src/
├── [module]/
│   ├── [service].service.ts
│   ├── [service].service.spec.ts      # Unit tests
│   ├── [controller].controller.ts
│   └── [controller].controller.spec.ts
└── test-utils/
    ├── factories/     # Mock data factories
    ├── mocks/         # Service mocks
    └── helpers/       # Test helpers
```

## Quick Start

### Running Tests

```bash
# Run all tests
docker compose run backend npm run test

# Run tests in watch mode
docker compose run backend npm run test:watch

# Run tests with coverage
docker compose run backend npm run test:cov

# Run specific test file
docker compose run backend npm run test -- user.service.spec.ts

# Run E2E tests
docker compose run backend npm run test:e2e
```

### Writing Your First Test

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { createMockDatabase, UserFactory } from '@/test-utils';
import { DatabaseService } from '@/database/database.service';

describe('UserService', () => {
  let service: UserService;
  let mockDatabase: any;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: DatabaseService, useValue: mockDatabase },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should find user by id', async () => {
    const mockUser = UserFactory.build();
    mockDatabase.user.findUnique.mockResolvedValue(mockUser);

    const result = await service.findOne(mockUser.id);

    expect(result).toEqual(mockUser);
    expect(mockDatabase.user.findUnique).toHaveBeenCalledWith({
      where: { id: mockUser.id },
    });
  });
});
```

## Test Infrastructure

### Factories

Factories create mock entities with sensible defaults:

```typescript
import { UserFactory, MessageFactory, CommunityFactory } from '@/test-utils';

// Create a user with defaults
const user = UserFactory.build();

// Override specific properties
const admin = UserFactory.build({ role: InstanceRole.OWNER });

// Use specialized builders
const verifiedUser = UserFactory.buildVerified();
const owner = UserFactory.buildOwner();

// Create multiple entities
const users = UserFactory.buildMany(5);
```

**Available Factories:**
- `UserFactory`
- `MessageFactory`
- `CommunityFactory`
- `ChannelFactory`
- `MembershipFactory`
- `ChannelMembershipFactory`
- `RoleFactory`
- `DirectMessageGroupFactory`
- `FileFactory`
- `RefreshTokenFactory`
- `InstanceInviteFactory`

### Mocks

Comprehensive mocks for core services:

```typescript
import {
  createMockDatabase,
  createMockRedis,
  createMockWebsocketService,
} from '@/test-utils';

// Database mock (Prisma client)
const mockDatabase = createMockDatabase();
mockDatabase.user.findUnique.mockResolvedValue(user);

// Redis mock
const mockRedis = createMockRedis();
mockRedis.get.mockResolvedValue('cached-data');

// WebSocket mock
const mockWebsocket = createMockWebsocketService();
mockWebsocket.sendToUser.mockImplementation(() => {});
```

### Helpers

Utility functions for common test operations:

```typescript
import {
  createTestModule,
  createMockJwtService,
  createMockHttpExecutionContext,
  mockAuthenticatedRequest,
} from '@/test-utils';

// Create test module with common mocks
const module = await createTestModule({
  providers: [MyService],
});

// Mock HTTP execution context for guards
const context = createMockHttpExecutionContext({
  user: UserFactory.build(),
  params: { id: '123' },
});

// Mock authenticated request
const req = mockAuthenticatedRequest(user);
```

## Writing Tests

See detailed guides for:
- [Testing Services](./testing-services.md)
- [Testing Controllers](./testing-controllers.md)
- [Testing Guards](./testing-guards.md)
- [Testing Gateways](./testing-gateways.md)

## Testing Patterns

### Pattern 1: Service with Database Dependency

```typescript
describe('MessagesService', () => {
  let service: MessagesService;
  let mockDatabase: any;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const module = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: DatabaseService, useValue: mockDatabase },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  it('should create message', async () => {
    const dto = { content: 'Hello', channelId: 'ch1' };
    const mockMessage = MessageFactory.build(dto);

    mockDatabase.message.create.mockResolvedValue(mockMessage);

    const result = await service.create(dto);

    expect(result).toEqual(mockMessage);
  });
});
```

### Pattern 2: Testing Error Handling

```typescript
it('should throw NotFoundException when user not found', async () => {
  mockDatabase.user.findUnique.mockResolvedValue(null);

  await expect(service.findOne('invalid-id')).rejects.toThrow(
    NotFoundException
  );
});
```

### Pattern 3: Testing RBAC Guards

```typescript
import { RbacGuard } from './rbac.guard';
import { createMockHttpExecutionContext } from '@/test-utils';

describe('RbacGuard', () => {
  it('should allow user with required action', () => {
    const user = createMockUserWithActions([RbacActions.DELETE_MESSAGE]);
    const context = createMockHttpExecutionContext({ user });

    const canActivate = guard.canActivate(context);

    expect(canActivate).toBe(true);
  });
});
```

## Coverage Requirements

### Global Thresholds

- **Branches**: 60%
- **Functions**: 60%
- **Lines**: 60%
- **Statements**: 60%

### Priority Modules (Target 80%+)

Security-critical modules should have higher coverage:
- `auth/` - Authentication and authorization
- `roles/` - RBAC system
- `file/` - File access control

### Running Coverage Reports

```bash
# Generate coverage report
docker compose run backend npm run test:cov

# View HTML report
open coverage/lcov-report/index.html
```

### Coverage Commands

```bash
# Check coverage without running tests
docker compose run backend npm run test:cov -- --collectCoverageFrom="src/**/*.ts"

# Coverage for specific module
docker compose run backend npm run test:cov -- auth
```

## Best Practices

1. **Use factories** for creating test data
2. **Mock all external dependencies** (database, redis, etc.)
3. **Test edge cases** (null values, empty arrays, etc.)
4. **Test error paths** (validation errors, not found, etc.)
5. **Keep tests focused** - one concept per test
6. **Use descriptive test names** - "should do X when Y"
7. **Clean up** - reset mocks in `afterEach` if needed

## Resources

- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [@suites/unit Documentation](https://suites.dev/docs/unit)
