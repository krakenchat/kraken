# [ModuleName] Module

> **Location:** `backend/src/[path]/[module-name].module.ts`  
> **Type:** [Feature Module | Core Module | Shared Module]  
> **Domain:** [auth | community | messages | users | etc.]

## Overview

[Brief description of the module's purpose and responsibilities within the application]

## Module Structure

```
[module-name]/
├── [module-name].module.ts          # Module definition
├── [module-name].service.ts         # Core business logic
├── [module-name].controller.ts      # HTTP endpoints
├── entities/                        # Database entities
│   └── [entity].entity.ts
├── dto/                            # Data transfer objects
│   ├── create-[entity].dto.ts
│   ├── update-[entity].dto.ts
│   └── [entity]-response.dto.ts
└── __tests__/                      # Test files
    ├── [module-name].service.spec.ts
    └── [module-name].controller.spec.ts
```

## Services

### [PrimaryService]

**Purpose:** [What this service is responsible for]

#### Key Methods

```typescript
class [PrimaryService] {
  // Core CRUD operations
  async create[Entity](data: Create[Entity]Dto): Promise<[Entity]> {
    // [Brief description of implementation]
  }
  
  async findAll(): Promise<[Entity][]> {
    // [Query patterns and filtering]
  }
  
  async findOne(id: string): Promise<[Entity]> {
    // [How single entities are retrieved]
  }
  
  async update(id: string, data: Update[Entity]Dto): Promise<[Entity]> {
    // [Update logic and validation]
  }
  
  async remove(id: string): Promise<void> {
    // [Deletion logic and cleanup]
  }
  
  // Business logic methods
  async [customMethod]([params]): Promise<[ReturnType]> {
    // [Description of business logic]
  }
}
```

#### Database Queries

```typescript
// Common query patterns
const [entities] = await this.prisma.[entity].findMany({
  where: { [condition] },
  include: { [relations] },
  orderBy: { [field]: 'desc' }
});
```

## Controllers

### [PrimaryController]

**Base Route:** `/api/[route-prefix]`

#### Endpoints

| Method | Endpoint | Description | Auth Required | RBAC Actions |
|--------|----------|-------------|---------------|--------------|
| GET | `/` | [List all entities] | ✅ | `VIEW_[ENTITY]` |
| GET | `/:id` | [Get single entity] | ✅ | `VIEW_[ENTITY]` |
| POST | `/` | [Create new entity] | ✅ | `CREATE_[ENTITY]` |
| PUT | `/:id` | [Update entity] | ✅ | `UPDATE_[ENTITY]` |
| DELETE | `/:id` | [Delete entity] | ✅ | `DELETE_[ENTITY]` |

#### Example Endpoint

```typescript
@Post()
@RequiredActions(RbacActions.CREATE_[ENTITY])
@RbacResource({
  type: RbacResourceType.[RESOURCE],
  idKey: '[resourceId]',
  source: ResourceIdSource.PAYLOAD,
})
async create[Entity](
  @Body() create[Entity]Dto: Create[Entity]Dto,
  @GetUser() user: User,
): Promise<[Entity]ResponseDto> {
  const [entity] = await this.[service].create[Entity](create[Entity]Dto);
  return new [Entity]ResponseDto([entity]);
}
```

## DTOs (Data Transfer Objects)

### Create[Entity]Dto

```typescript
export class Create[Entity]Dto {
  @IsString()
  @IsNotEmpty()
  [field]: string;
  
  @IsOptional()
  @IsString()
  [optionalField]?: string;
  
  // [Other validation rules and field descriptions]
}
```

### [Entity]ResponseDto

```typescript
export class [Entity]ResponseDto {
  id: string;
  [field]: string;
  [optionalField]?: string;
  createdAt: Date;
  updatedAt: Date;
  
  constructor([entity]: [Entity]) {
    // [Response transformation logic]
  }
}
```

## Database Schema

### [Entity] Model

```prisma
model [Entity] {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  [field]   String
  [optional] String?
  
  // Relations
  [relation] [RelatedEntity][] @relation("[RelationName]")
  
  // Metadata
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("[collection_name]")
}
```

## Dependencies

### Internal Dependencies
- `@/database/database.service` - [database operations]
- `@/auth/auth.module` - [authentication integration]
- `@/roles/roles.module` - [RBAC permissions]
- `@/[related-module]/[related-module].service` - [specific usage]

### External Dependencies
- `@nestjs/common` - [decorators and exceptions]
- `class-validator` - [DTO validation]
- `class-transformer` - [object transformation]

## Authentication & Authorization

### Guards Used
- `JwtAuthGuard` - [authentication requirement]
- `RbacGuard` - [permission-based access control]

### RBAC Permissions
```typescript
// Required actions for each operation
CREATE_[ENTITY]    // [when this permission is needed]
VIEW_[ENTITY]      // [viewing permissions]
UPDATE_[ENTITY]    // [modification permissions]
DELETE_[ENTITY]    // [deletion permissions]
```

### Resource Context
```typescript
// How resources are identified for RBAC
@RbacResource({
  type: RbacResourceType.[RESOURCE_TYPE],
  idKey: '[resourceIdField]',
  source: ResourceIdSource.[SOURCE],
})
```

## WebSocket Integration

[If the module handles real-time events]

### Events Emitted
- `[EVENT_NAME]` - [when this is emitted and payload structure]
- `[ANOTHER_EVENT]` - [event description]

### Events Handled
- `[INCOMING_EVENT]` - [how the module responds]

```typescript
// WebSocket event handling example
this.websocketService.sendToRoom(
  [roomId],
  ServerEvents.[EVENT_NAME],
  [payload]
);
```

## Error Handling

### Custom Exceptions
```typescript
// Module-specific exceptions
export class [Entity]NotFoundException extends NotFoundException {
  constructor(id: string) {
    super(`[Entity] with ID ${id} not found`);
  }
}
```

### Common Error Scenarios
1. **[Error Type]** - [when it occurs and how it's handled]
2. **[Another Error]** - [error description and resolution]

## Testing

### Service Tests
- **Location:** `backend/src/[path]/__tests__/[module-name].service.spec.ts`
- **Coverage:** [percentage or description of test coverage]

```typescript
// Key test patterns
describe('[Service] - [method]', () => {
  it('should [behavior]', async () => {
    // [test implementation example]
  });
});
```

### Controller Tests
- **Location:** `backend/src/[path]/__tests__/[module-name].controller.spec.ts`
- **Coverage:** [HTTP endpoint test coverage]

## Performance Considerations

- **Database Queries:** [Query optimization strategies]
- **Caching:** [Any caching mechanisms used]
- **Pagination:** [How large datasets are handled]
- **N+1 Queries:** [Prevention strategies]

## Common Usage Patterns

### Pattern 1: [Pattern Name]
```typescript
// [Code example showing common service usage]
```

### Pattern 2: [Integration Pattern]
```typescript
// [How this module is typically integrated with others]
```

## Related Modules

- **[RelatedModule]** - [relationship and data exchange]
- **[AnotherModule]** - [integration points]

## Migration Notes

[If there are important schema changes or breaking changes]

- **Version [x.x.x]:** [what changed and migration steps]
- **Breaking Changes:** [list of breaking changes and fixes]

## Troubleshooting

### Common Issues
1. **[Issue Description]**
   - **Symptoms:** [how to identify the problem]
   - **Cause:** [root cause analysis]
   - **Solution:** [step-by-step fix]

## Related Documentation

- [API Endpoints](../api/[module-name].md)
- [Database Schema](../architecture/database.md#[entity])
- [RBAC Permissions](../features/auth-rbac.md#[module]-permissions)
- [WebSocket Events](../api/websocket-events.md#[module]-events)