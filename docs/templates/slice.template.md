# [EntityName] Redux Slice

> **Location:** `frontend/src/features/[feature]/api/[entity]Api.ts`  
> **Type:** [RTK Query API | Redux Slice | Combined API + Slice]  
> **Domain:** [auth | community | messages | users | etc.]

## Overview

[Brief description of what this slice manages and its role in the application state]

## API Configuration

```typescript
export const [entity]Api = createApi({
  reducerPath: '[entity]Api',
  baseQuery: authedBaseQuery,
  tagTypes: ['[Entity]', '[RelatedEntity]'],
  endpoints: (builder) => ({
    // [List of endpoints defined]
  }),
});
```

### Base Configuration
- **Reducer Path:** `[entity]Api`
- **Base Query:** `authedBaseQuery` (includes JWT authentication)
- **Tag Types:** `['[Entity]', '[RelatedEntity]']`

## Endpoints

### Query Endpoints (Data Fetching)

#### get[Entities]

```typescript
get[Entities]: builder.query<[Entity][], [QueryParams]>({
  query: ([params]) => ({
    url: '/[route]',
    params: [params],
  }),
  providesTags: (result) => 
    result
      ? [
          ...result.map(({ id }) => ({ type: '[Entity]' as const, id })),
          { type: '[Entity]', id: 'LIST' },
        ]
      : [{ type: '[Entity]', id: 'LIST' }],
}),
```

**Usage:**
```typescript
const { 
  data: [entities], 
  error, 
  isLoading,
  refetch 
} = use[Entity]Api.useGet[Entities]Query([queryParams]);
```

#### get[Entity]ById

```typescript
get[Entity]ById: builder.query<[Entity], string>({
  query: (id) => `/[route]/${id}`,
  providesTags: (result, error, id) => [{ type: '[Entity]', id }],
}),
```

**Usage:**
```typescript
const { 
  data: [entity], 
  error, 
  isLoading 
} = use[Entity]Api.useGet[Entity]ByIdQuery([entityId], {
  skip: ![entityId], // Skip if no ID provided
});
```

### Mutation Endpoints (Data Modification)

#### create[Entity]

```typescript
create[Entity]: builder.mutation<[Entity], Create[Entity]Request>({
  query: ([data]) => ({
    url: '/[route]',
    method: 'POST',
    body: [data],
  }),
  invalidatesTags: [{ type: '[Entity]', id: 'LIST' }],
}),
```

**Usage:**
```typescript
const [create[Entity], { isLoading, error }] = use[Entity]Api.useCreate[Entity]Mutation();

const handleCreate = async ([formData]: Create[Entity]Data) => {
  try {
    const new[Entity] = await create[Entity]([formData]).unwrap();
    // Handle success
  } catch (err) {
    // Handle error
  }
};
```

#### update[Entity]

```typescript
update[Entity]: builder.mutation<[Entity], { id: string; data: Update[Entity]Request }>({
  query: ({ id, data }) => ({
    url: `/[route]/${id}`,
    method: 'PUT',
    body: data,
  }),
  invalidatesTags: (result, error, { id }) => [
    { type: '[Entity]', id },
    { type: '[Entity]', id: 'LIST' },
  ],
}),
```

#### delete[Entity]

```typescript
delete[Entity]: builder.mutation<void, string>({
  query: (id) => ({
    url: `/[route]/${id}`,
    method: 'DELETE',
  }),
  invalidatesTags: (result, error, id) => [
    { type: '[Entity]', id },
    { type: '[Entity]', id: 'LIST' },
  ],
}),
```

## Type Definitions

### Request Types

```typescript
interface Create[Entity]Request {
  [field]: string;           // [description]
  [optionalField]?: string;  // [optional field description]
  [relationId]: string;      // [relation field description]
}

interface Update[Entity]Request {
  [field]?: string;          // [partial update fields]
  [optionalField]?: string;  // [optional updates]
}

interface [Entity]QueryParams {
  page?: number;             // Pagination page
  limit?: number;            // Items per page  
  search?: string;           // Search term
  sortBy?: string;           // Sort field
  sortOrder?: 'asc' | 'desc'; // Sort direction
  [filter]?: string;         // Specific filters
}
```

### Response Types

```typescript
interface [Entity] {
  id: string;
  [field]: string;
  [optionalField]?: string;
  [relations]: [RelatedEntity][];
  createdAt: string;
  updatedAt: string;
}

interface [Entity]ListResponse {
  data: [Entity][];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

## Caching Strategy

### Cache Tags

```typescript
// Tag types used for cache invalidation
tagTypes: ['[Entity]', '[RelatedEntity]']

// Tagging patterns:
// - List queries: { type: '[Entity]', id: 'LIST' }
// - Single items: { type: '[Entity]', id: [entityId] }
// - Related data: { type: '[RelatedEntity]', id: [relationId] }
```

### Cache Invalidation

| Action | Invalidates | Reason |
|--------|-------------|---------|
| Create [Entity] | `LIST` tag | New item affects list queries |
| Update [Entity] | Specific ID + `LIST` | Item and list data changed |
| Delete [Entity] | Specific ID + `LIST` | Item removed from cache |

### Cache Behavior

- **Automatic Refetching:** Queries automatically refetch when their tags are invalidated
- **Background Updates:** Queries can be set to refetch in background
- **Optimistic Updates:** [If implemented, describe optimistic update patterns]

## State Management

### Generated Hooks

```typescript
// Auto-generated hooks from RTK Query
export const {
  // Query hooks
  useGet[Entities]Query,
  useGet[Entity]ByIdQuery,
  useLazyGet[Entities]Query,    // Lazy query versions
  
  // Mutation hooks  
  useCreate[Entity]Mutation,
  useUpdate[Entity]Mutation,
  useDelete[Entity]Mutation,
  
  // Utility hooks
  usePrefetch,                  // For prefetching data
} = [entity]Api;
```

### Manual Cache Manipulation

```typescript
// Accessing cached data
const cachedData = store.getState().[entity]Api.queries['get[Entities](undefined)']?.data;

// Manual cache updates (rarely needed)
dispatch([entity]Api.util.updateQueryData('get[Entities]', undefined, (draft) => {
  draft.push(newItem);
}));

// Prefetching
dispatch([entity]Api.util.prefetch('get[Entity]ById', [entityId], { force: true }));
```

## Error Handling

### Query Errors

```typescript
const { data, error, isLoading } = use[Entity]Api.useGet[Entities]Query();

if (error) {
  if ('status' in error) {
    // RTK Query error with HTTP status
    const { status, data: errorData } = error;
    // Handle based on status code
  } else {
    // Network or other error
    console.error('Network error:', error.message);
  }
}
```

### Mutation Errors

```typescript
const [create[Entity], { error, isLoading }] = use[Entity]Api.useCreate[Entity]Mutation();

const handleSubmit = async (data) => {
  try {
    await create[Entity](data).unwrap();
  } catch (err) {
    if (err.status === 400) {
      // Validation error
    } else if (err.status === 403) {
      // Permission error
    }
  }
};
```

## WebSocket Integration

[If the slice handles real-time updates]

### Real-time Event Handling

```typescript
// WebSocket event listeners that update the cache
useWebSocket('[ENTITY]_CREATED', (newEntity) => {
  dispatch([entity]Api.util.updateQueryData('get[Entities]', undefined, (draft) => {
    draft.unshift(newEntity);
  }));
});

useWebSocket('[ENTITY]_UPDATED', (updatedEntity) => {
  dispatch([entity]Api.util.updateQueryData('get[Entity]ById', updatedEntity.id, () => updatedEntity));
});

useWebSocket('[ENTITY]_DELETED', (deletedId) => {
  dispatch([entity]Api.util.invalidateTags([{ type: '[Entity]', id: deletedId }]));
});
```

## Component Integration

### Basic Component Usage

```typescript
import { use[Entity]Api } from '@/features/[feature]/api/[entity]Api';

function [Entity]List() {
  const { 
    data: [entities] = [], 
    error, 
    isLoading,
    refetch 
  } = use[Entity]Api.useGet[Entities]Query({
    page: 1,
    limit: 20
  });

  const [delete[Entity]] = use[Entity]Api.useDelete[Entity]Mutation();

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure?')) {
      await delete[Entity](id);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading [entities]</div>;

  return (
    <div>
      {[entities].map([entity] => (
        <div key={[entity].id}>
          <h3>{[entity].[field]}</h3>
          <button onClick={() => handleDelete([entity].id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Form Integration

```typescript
function Create[Entity]Form() {
  const [create[Entity], { isLoading, error }] = use[Entity]Api.useCreate[Entity]Mutation();
  const [formData, setFormData] = useState<Create[Entity]Request>({
    [field]: '',
    [relationId]: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create[Entity](formData).unwrap();
      // Reset form or redirect
      setFormData({ [field]: '', [relationId]: '' });
    } catch (err) {
      // Error handling
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create [Entity]'}
      </button>
      {error && <div>Error: {error.message}</div>}
    </form>
  );
}
```

## Performance Optimization

### Query Optimization

```typescript
// Selective re-rendering with selectFromResult
const { selectedData } = use[Entity]Api.useGet[Entities]Query(undefined, {
  selectFromResult: ({ data, ...other }) => ({
    ...other,
    selectedData: data?.filter([filterCondition])
  }),
});

// Polling for real-time updates
const { data } = use[Entity]Api.useGet[Entities]Query(undefined, {
  pollingInterval: 30000, // Poll every 30 seconds
});

// Skip queries conditionally
const { data } = use[Entity]Api.useGet[Entity]ByIdQuery([entityId], {
  skip: ![entityId] || !userCanView,
});
```

### Bundle Size Considerations

- **Code Splitting:** API slice is automatically code-split with the feature
- **Tree Shaking:** Unused endpoints are tree-shaken in production builds
- **Hook Generation:** Only generates hooks for defined endpoints

## Testing

### Query Testing

```typescript
import { renderHook } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { [entity]Api } from '../[entity]Api';

describe('[entity]Api', () => {
  it('should fetch [entities] successfully', async () => {
    const { result } = renderHook(
      () => use[Entity]Api.useGet[Entities]Query(),
      { wrapper: TestProvider }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
  });
});
```

### Mutation Testing

```typescript
it('should create [entity] successfully', async () => {
  const { result } = renderHook(
    () => use[Entity]Api.useCreate[Entity]Mutation(),
    { wrapper: TestProvider }
  );

  await act(async () => {
    const response = await result.current[0]([testData]).unwrap();
    expect(response.id).toBeDefined();
    expect(response.[field]).toBe([testData].[field]);
  });
});
```

## Common Usage Patterns

### Pattern 1: Master-Detail View

```typescript
function [Entity]MasterDetail() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const { data: [entities] } = use[Entity]Api.useGet[Entities]Query();
  const { data: [selectedEntity] } = use[Entity]Api.useGet[Entity]ByIdQuery(
    selectedId!, 
    { skip: !selectedId }
  );

  return (
    <div style={{ display: 'flex' }}>
      <[Entity]List 
        [entities]={[entities]} 
        onSelect={setSelectedId} 
      />
      {[selectedEntity] && (
        <[Entity]Detail [entity]={[selectedEntity]} />
      )}
    </div>
  );
}
```

### Pattern 2: Optimistic Updates

```typescript
const [update[Entity]] = use[Entity]Api.useUpdate[Entity]Mutation({
  onQueryStarted: async ({ id, data }, { dispatch, queryFulfilled }) => {
    // Optimistic update
    const patchResult = dispatch([entity]Api.util.updateQueryData(
      'get[Entity]ById', 
      id, 
      (draft) => {
        Object.assign(draft, data);
      }
    ));
    
    try {
      await queryFulfilled;
    } catch {
      // Revert on error
      patchResult.undo();
    }
  },
});
```

## Related Documentation

- [Module Documentation](../modules/[module-name].md)
- [API Endpoints](../api/[controller-name].md)
- [Component Documentation](../components/[related-components].md)
- [WebSocket Events](../api/websocket-events.md)