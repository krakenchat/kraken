# Redis Module

> **Location:** `backend/src/redis/redis.module.ts`  
> **Type:** Core Module  
> **Domain:** infrastructure

## Overview

The Redis Module provides the foundational Redis connection and client management for the Kraken application. It handles connection lifecycle, configuration management, and provides a low-level Redis interface that other modules (like Cache and WebSocket adapters) build upon.

## Module Structure

```
redis/
├── redis.module.ts          # Module definition with ConfigModule dependency
├── redis.service.ts         # Redis connection and client management
└── redis.service.spec.ts    # Unit tests
```

## Services

### RedisService

**Purpose:** Manages Redis connection lifecycle and provides basic Redis operations with proper configuration and connection handling.

#### Key Methods

```typescript
class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  
  constructor(private readonly configService: ConfigService) {}

  // Lifecycle management
  onModuleInit(): void {
    // Establishes Redis connection during module initialization
    this.client = new Redis({
      host: this.configService.get('REDIS_HOST') || 'localhost',
      port: parseInt(this.configService.get('REDIS_PORT') || '6379', 10),
      password: this.configService.get('REDIS_PASSWORD') || undefined,
      db: parseInt(this.configService.get('REDIS_DB') || '0', 10),
    });
  }
  
  async onModuleDestroy(): Promise<void> {
    // Gracefully closes Redis connection during shutdown
    if (this.client) {
      await this.client.quit();
    }
  }

  // Basic Redis operations
  async get(key: string): Promise<string | null> {
    // Retrieves string value by key
  }
  
  async set(
    key: string, 
    value: string, 
    expireSeconds?: number
  ): Promise<'OK' | null> {
    // Sets string value with optional expiration
  }
  
  async del(key: string): Promise<number> {
    // Deletes key and returns number of keys deleted
  }
  
  async expire(key: string, seconds: number): Promise<number> {
    // Sets expiration on existing key
  }
  
  getClient(): Redis {
    // Provides direct access to ioredis client for advanced operations
  }
}
```

#### Connection Configuration

```typescript
// Redis connection is configured through environment variables
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
};

// Advanced configuration options available through ioredis
const client = new Redis({
  ...redisConfig,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null, // Important for Socket.IO adapter
});
```

## Dependencies

### Internal Dependencies
- **ConfigModule** - Environment variable configuration management

### External Dependencies
- `@nestjs/common` - NestJS lifecycle interfaces and dependency injection
- `@nestjs/config` - Configuration service for environment variables
- `ioredis` - High-performance Redis client for Node.js

## Environment Configuration

### Required Environment Variables
```bash
# Redis connection settings
REDIS_HOST=localhost          # Redis server host
REDIS_PORT=6379              # Redis server port
REDIS_PASSWORD=              # Redis password (optional)
REDIS_DB=0                   # Redis database number (default 0)
```

### Docker Development
```yaml
# docker-compose.yml Redis service configuration
redis:
  image: redis:alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
```

## Advanced Operations

### Pattern 1: Direct Client Access
```typescript
@Injectable()
export class CustomRedisService {
  constructor(private readonly redisService: RedisService) {}

  async performComplexOperation() {
    const client = this.redisService.getClient();
    
    // Use Redis pipelines for batch operations
    const pipeline = client.pipeline();
    pipeline.set('key1', 'value1');
    pipeline.set('key2', 'value2');
    pipeline.expire('key1', 300);
    
    const results = await pipeline.exec();
    return results;
  }
}
```

### Pattern 2: Pub/Sub Operations
```typescript
async setupPubSub() {
  const client = this.redisService.getClient();
  const subscriber = client.duplicate(); // Create separate connection for subscriptions
  
  subscriber.subscribe('channel:messages', (err, count) => {
    console.log(`Subscribed to ${count} channels`);
  });
  
  subscriber.on('message', (channel, message) => {
    console.log(`Received message on ${channel}:`, message);
  });
}
```

### Pattern 3: Lua Script Execution
```typescript
async executeAtomicOperation() {
  const client = this.redisService.getClient();
  
  const luaScript = `
    local key = KEYS[1]
    local value = redis.call('GET', key)
    if value then
      return redis.call('INCR', key)
    else
      return redis.call('SET', key, 1)
    end
  `;
  
  return client.eval(luaScript, 1, 'counter:key');
}
```

## Performance Considerations

- **Connection Pooling:** ioredis handles connection pooling internally
- **Pipeline Usage:** Use pipelines for multiple operations to reduce round trips
- **Memory Management:** Monitor Redis memory usage and set appropriate memory policies
- **Persistence:** Configure appropriate persistence (AOF/RDB) for data durability
- **Connection Limits:** Be aware of Redis maxclients setting

## Error Handling

### Connection Error Handling
```typescript
onModuleInit() {
  this.client = new Redis(config);
  
  this.client.on('error', (error) => {
    console.error('Redis connection error:', error);
  });
  
  this.client.on('connect', () => {
    console.log('Redis connected successfully');
  });
  
  this.client.on('disconnect', () => {
    console.warn('Redis disconnected');
  });
}
```

### Common Error Scenarios
1. **Connection Timeout** - Redis server unreachable
2. **Authentication Failed** - Incorrect password
3. **Memory Limit** - Redis out of memory
4. **Network Issues** - Connection drops during operations

## Testing

### Service Tests
- **Location:** `backend/src/redis/redis.service.spec.ts`
- **Coverage:** Connection lifecycle, basic operations

```typescript
describe('RedisService', () => {
  let service: RedisService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config = {
          'REDIS_HOST': 'localhost',
          'REDIS_PORT': '6379',
          'REDIS_DB': '0',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

## Integration Points

### Socket.IO Adapter
```typescript
// Redis adapter for Socket.IO clustering
import { createAdapter } from '@socket.io/redis-adapter';

const pubClient = this.redisService.getClient();
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

### Session Store
```typescript
// Express session storage in Redis
import RedisStore from 'connect-redis';

const sessionStore = new RedisStore({
  client: this.redisService.getClient(),
  prefix: 'kraken:sess:',
  ttl: 86400, // 24 hours
});
```

## Monitoring and Maintenance

### Key Metrics to Monitor
- **Memory Usage:** `redis-cli info memory`
- **Connected Clients:** `redis-cli info clients`
- **Command Statistics:** `redis-cli info commandstats`
- **Persistence Status:** `redis-cli info persistence`

### Maintenance Commands
```bash
# Check Redis info
redis-cli info

# Monitor real-time commands
redis-cli monitor

# Check memory usage by key patterns
redis-cli --scan --pattern "session:*" | xargs redis-cli memory usage

# Flush specific database (development only)
redis-cli -n 0 flushdb
```

## Related Modules

- **Cache Module** - High-level caching abstraction
- **WebSocket Module** - Real-time communication (via Redis adapter)
- **Auth Module** - Session storage
- **Presence Module** - User online status tracking

## Migration Notes

### Redis Version Compatibility
- **Minimum Version:** Redis 5.0+ recommended for full feature support
- **Cluster Mode:** Not currently configured, but ioredis supports Redis Cluster
- **Persistence:** Configure based on durability requirements

## Troubleshooting

### Common Issues
1. **Connection Refused**
   - **Symptoms:** Module fails to start, Redis connection errors
   - **Cause:** Redis server not running or incorrect connection parameters
   - **Solution:** Verify Redis is running and check environment variables

2. **Memory Issues**
   - **Symptoms:** Redis operations failing, memory warnings
   - **Cause:** Redis running out of memory
   - **Solution:** Configure memory policy, increase memory, or implement TTL strategy

3. **Performance Issues**
   - **Symptoms:** Slow Redis operations, high latency
   - **Cause:** Network issues, inefficient operations, or Redis overload
   - **Solution:** Use pipelines, optimize operations, monitor Redis performance

## Related Documentation

- [Cache Module](cache.md)
- [Environment Configuration](../../setup/installation.md#redis-configuration)
- [WebSocket Scaling](../core/websocket.md#redis-adapter)
- [Performance Tuning](../../architecture/backend.md#redis-optimization)