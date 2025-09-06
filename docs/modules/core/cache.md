# Cache Module

> **Location:** `backend/src/cache/cache.module.ts`  
> **Type:** Core Module  
> **Domain:** infrastructure

## Overview

The Cache Module provides a high-level caching abstraction layer over Redis. It offers JSON serialization/deserialization, expiration management, and a simplified API for caching operations across the application. This module is essential for performance optimization, session management, and temporary data storage.

## Module Structure

```
cache/
├── cache.module.ts          # Module definition with Redis dependency
├── cache.service.ts         # High-level caching service
└── cache.service.spec.ts    # Unit tests
```

## Services

### CacheService

**Purpose:** Provides a simplified, type-safe interface for Redis operations with automatic JSON serialization and deserialization.

#### Key Methods

```typescript
class CacheService {
  constructor(private readonly redisService: RedisService) {}

  // Core caching operations
  async get<T>(key: string): Promise<T | null> {
    // Retrieves and deserializes JSON data from Redis
    // Returns null if key doesn't exist or JSON parsing fails
  }
  
  async set<T>(
    key: string, 
    value: T, 
    expireSeconds?: number
  ): Promise<'OK' | null> {
    // Serializes data to JSON and stores in Redis
    // Optional expiration time in seconds
  }
  
  async del(key: string): Promise<number> {
    // Deletes a key from Redis
    // Returns number of keys deleted (0 or 1)
  }
  
  async expire(key: string, seconds: number): Promise<number> {
    // Sets expiration time for existing key
    // Returns 1 if timeout was set, 0 if key doesn't exist
  }
  
  getClient(): Redis {
    // Provides direct access to underlying Redis client
    // For advanced operations not covered by service methods
  }
}
```

#### Type-Safe Caching

```typescript
// Type-safe caching with automatic serialization
interface UserSession {
  userId: string;
  communityId: string;
  permissions: string[];
}

// Store typed data
await this.cacheService.set<UserSession>(
  `session:${sessionId}`, 
  { userId: 'user-123', communityId: 'community-456', permissions: ['READ_MESSAGES'] },
  3600 // 1 hour expiration
);

// Retrieve typed data
const session = await this.cacheService.get<UserSession>(`session:${sessionId}`);
if (session) {
  console.log(session.userId); // TypeScript knows this is a string
}
```

## Dependencies

### Internal Dependencies
- `@/redis/redis.module` - Provides underlying Redis connection and client

### External Dependencies
- `@nestjs/common` - NestJS dependency injection decorators
- `ioredis` (via RedisService) - Redis client library

## Common Usage Patterns

### Pattern 1: Session Caching
```typescript
@Injectable()
export class SessionService {
  constructor(private readonly cacheService: CacheService) {}

  async storeUserSession(sessionId: string, userData: UserSession) {
    const key = `session:${sessionId}`;
    await this.cacheService.set(key, userData, 86400); // 24 hours
  }

  async getUserSession(sessionId: string): Promise<UserSession | null> {
    const key = `session:${sessionId}`;
    return this.cacheService.get<UserSession>(key);
  }
}
```

### Pattern 2: Query Result Caching
```typescript
@Injectable()
export class CommunityService {
  constructor(
    private readonly database: DatabaseService,
    private readonly cacheService: CacheService
  ) {}

  async getCommunityMembers(communityId: string) {
    const cacheKey = `community:${communityId}:members`;
    
    // Try cache first
    const cached = await this.cacheService.get<Member[]>(cacheKey);
    if (cached) return cached;

    // Query database and cache result
    const members = await this.database.membership.findMany({
      where: { communityId },
      include: { user: true }
    });
    
    await this.cacheService.set(cacheKey, members, 300); // 5 minutes
    return members;
  }
}
```

### Pattern 3: Rate Limiting
```typescript
async checkRateLimit(userId: string, action: string): Promise<boolean> {
  const key = `rate_limit:${userId}:${action}`;
  const current = await this.cacheService.get<number>(key);
  
  if (current && current >= 10) {
    return false; // Rate limit exceeded
  }
  
  await this.cacheService.set(key, (current || 0) + 1, 60); // 1 minute window
  return true;
}
```

## Error Handling

### JSON Serialization Errors
```typescript
async get<T>(key: string): Promise<T | null> {
  const value = await this.redisService.get(key);
  if (value === null) return null;
  
  try {
    return JSON.parse(value) as T;
  } catch {
    // Gracefully handle JSON parsing errors
    return null;
  }
}
```

### Common Error Scenarios
1. **Redis Connection Lost** - Operations will fail, service should handle gracefully
2. **JSON Parse Errors** - Invalid JSON in cache returns null instead of throwing
3. **Memory Limits** - Redis memory limits can cause eviction of cached data

## Performance Considerations

- **JSON Overhead:** Serialization/deserialization adds CPU cost but provides type safety
- **Memory Usage:** JSON strings consume more memory than native Redis data types
- **Expiration Strategy:** Always set appropriate TTL to prevent memory leaks
- **Key Naming:** Use consistent, hierarchical key naming for easier management

## Testing

### Service Tests
- **Location:** `backend/src/cache/cache.service.spec.ts`
- **Coverage:** Mocking Redis operations, testing serialization logic

```typescript
describe('CacheService', () => {
  let service: CacheService;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
      getClient: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    redisService = module.get(RedisService);
  });

  it('should serialize and store data', async () => {
    const testData = { key: 'value' };
    redisService.set.mockResolvedValue('OK');

    await service.set('test-key', testData, 300);

    expect(redisService.set).toHaveBeenCalledWith(
      'test-key',
      JSON.stringify(testData),
      300
    );
  });
});
```

## Cache Key Conventions

### Recommended Key Patterns
```typescript
// User-related data
`user:${userId}:profile`
`user:${userId}:permissions`
`user:${userId}:sessions`

// Community-related data  
`community:${communityId}:members`
`community:${communityId}:channels`
`community:${communityId}:settings`

// Session management
`session:${sessionId}`
`refresh_token:${tokenId}`

// Rate limiting
`rate_limit:${userId}:${action}`
`rate_limit:${ip}:${endpoint}`

// Temporary locks
`lock:${resource}:${operation}`
```

## Related Modules

- **Redis Module** - Provides underlying Redis connection
- **Auth Module** - Session and token caching
- **Community Module** - Member list caching
- **Messages Module** - Message caching for performance
- **User Module** - Profile and permission caching

## Troubleshooting

### Common Issues
1. **Cache Misses**
   - **Symptoms:** High database load, slow response times
   - **Cause:** Cache keys not being set or expiring too quickly
   - **Solution:** Verify cache set operations and adjust TTL values

2. **Memory Usage**
   - **Symptoms:** Redis memory alerts, cache evictions
   - **Cause:** Too much data cached or no expiration set
   - **Solution:** Implement proper TTL strategy and monitor memory usage

3. **Stale Data**
   - **Symptoms:** Users seeing outdated information
   - **Cause:** Cache not being invalidated after data updates
   - **Solution:** Implement cache invalidation strategy for data mutations

## Related Documentation

- [Redis Module](redis.md)
- [Performance Optimization](../../architecture/backend.md#caching-strategy)
- [Session Management](../auth/auth.md#session-caching)