# Database Module

> **Location:** `backend/src/database/database.module.ts`  
> **Type:** Core Module  
> **Domain:** infrastructure

## Overview

The Database Module provides the primary database connection and query interface for the entire Kraken application. It extends Prisma Client to provide a centralized, lifecycle-managed database service that handles MongoDB connections, disconnections, and provides the ORM interface for all database operations across the application.

## Module Structure

```
database/
├── database.module.ts          # Module definition
├── database.service.ts         # Prisma client wrapper service
└── database.service.spec.ts    # Unit tests
```

## Services

### DatabaseService

**Purpose:** Provides a lifecycle-managed Prisma Client wrapper that handles database connections and disconnections automatically.

#### Key Methods

```typescript
class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // Lifecycle management
  async onModuleInit(): Promise<void> {
    // Establishes database connection during module initialization
    await this.$connect();
  }
  
  async onModuleDestroy(): Promise<void> {
    // Gracefully closes database connection during shutdown
    await this.$disconnect();
  }
  
  // Inherits all Prisma Client methods:
  // - All model operations (findMany, findUnique, create, update, delete)
  // - Transaction management ($transaction)
  // - Raw queries ($queryRaw, $executeRaw)
  // - Connection status ($connect, $disconnect)
}
```

#### Database Operations

```typescript
// All Prisma operations are available through this service
const users = await this.databaseService.user.findMany({
  where: { instanceId: 'some-id' },
  include: { communities: true },
  orderBy: { createdAt: 'desc' }
});

// Transaction support
await this.databaseService.$transaction(async (prisma) => {
  const user = await prisma.user.create({ data: userData });
  const membership = await prisma.membership.create({ data: membershipData });
  return { user, membership };
});
```

## Dependencies

### Internal Dependencies
- **None** - This is a foundational module that other modules depend on

### External Dependencies
- `@nestjs/common` - NestJS lifecycle interfaces and decorators
- `@prisma/client` - MongoDB ORM and query builder

## Database Configuration

### Connection String
The database connection is configured through Prisma schema and environment variables:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}
```

### Environment Variables
```bash
DATABASE_URL="mongodb://username:password@localhost:27017/kraken?replicaSet=rs0"
```

## Schema Management

### Key Characteristics
- **No Migrations**: MongoDB with Prisma uses `prisma db push` instead of migrations
- **Schema Generation**: Run `prisma generate` after schema changes
- **Replica Set Required**: MongoDB must be configured with replica sets for change streams

### Common Commands
```bash
# Generate Prisma client
npm run prisma:generate

# Push schema changes to database
npm run prisma:push

# Combined generation and push
npm run prisma
```

## Performance Considerations

- **Connection Pooling:** Prisma Client handles connection pooling automatically
- **Query Optimization:** Uses MongoDB's native query engine with Prisma's query optimizer
- **Connection Lifecycle:** Single connection per module lifecycle prevents connection leaks
- **Change Streams:** Supports MongoDB change streams for real-time features

## Error Handling

### Common Error Scenarios
1. **Connection Failures** - Database unavailable during module initialization
2. **Schema Mismatches** - Prisma schema doesn't match database structure
3. **Constraint Violations** - Unique key constraints, required field violations

```typescript
// Connection error handling occurs at module level
// Individual query errors bubble up to consuming services
```

## Testing

### Service Tests
- **Location:** `backend/src/database/database.service.spec.ts`
- **Coverage:** Basic service instantiation and lifecycle

```typescript
describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseService],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

## Common Usage Patterns

### Pattern 1: Service Injection
```typescript
@Injectable()
export class SomeService {
  constructor(private readonly database: DatabaseService) {}
  
  async findUsers() {
    return this.database.user.findMany();
  }
}
```

### Pattern 2: Transaction Usage
```typescript
async createUserWithMembership(userData: any, communityId: string) {
  return this.database.$transaction(async (prisma) => {
    const user = await prisma.user.create({ data: userData });
    const membership = await prisma.membership.create({
      data: { userId: user.id, communityId }
    });
    return { user, membership };
  });
}
```

## Related Modules

This is a foundational module used by virtually all feature modules:
- **Community Module** - Community/server management
- **User Module** - User operations
- **Messages Module** - Message storage and retrieval
- **Auth Module** - User authentication data
- **All other feature modules** - Database operations

## Migration Notes

### Schema Changes
When updating the Prisma schema:
1. Update `prisma/schema.prisma`
2. Run `npm run prisma:generate` to update client types
3. Run `npm run prisma:push` to apply changes to database
4. Restart application to pick up new client

### Breaking Changes
- **Database URL Format:** Must include replica set parameter for production
- **Environment Variables:** DATABASE_URL is required for connection

## Troubleshooting

### Common Issues
1. **Connection Refused**
   - **Symptoms:** Module fails to start, connection errors in logs
   - **Cause:** MongoDB not running or incorrect connection string
   - **Solution:** Verify MongoDB is running and DATABASE_URL is correct

2. **Schema Mismatch**
   - **Symptoms:** TypeScript errors, runtime query failures
   - **Cause:** Prisma client not regenerated after schema changes
   - **Solution:** Run `npm run prisma:generate`

3. **Change Stream Errors**
   - **Symptoms:** Real-time features not working
   - **Cause:** MongoDB not configured as replica set
   - **Solution:** Configure MongoDB with replica set (required for change streams)

## Related Documentation

- [Database Schema](../../architecture/database.md)
- [MongoDB Setup](../../setup/installation.md#mongodb-configuration)
- [Environment Variables](../../setup/installation.md#environment-variables)