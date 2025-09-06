# Invite Redux API Slice

> **Location:** `frontend/src/features/invite/inviteApiSlice.ts`  
> **Type:** RTK Query API  
> **Domain:** Instance invitation management

## Overview

The Invite API slice manages instance-level invitations that allow new users to register and join the Kraken instance. It provides functionality for creating, retrieving, and managing invite codes that control access to the instance registration process.

## API Configuration

```typescript
export const inviteApi = createApi({
  reducerPath: "inviteApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/invite",
      prepareHeaders,
    })
  ),
  tagTypes: ["Invite"],
  endpoints: (builder) => ({
    // Endpoints defined below
  }),
});
```

### Base Configuration
- **Reducer Path:** `inviteApi`
- **Base Query:** `getBaseAuthedQuery` (includes JWT authentication and token refresh)
- **Base URL:** `/api/invite`
- **Tag Types:** `["Invite"]`

## Endpoints

### Query Endpoints (Data Fetching)

#### getInvites
```typescript
getInvites: builder.query<InstanceInvite[], void>({
  query: () => ({
    url: "/",
    method: "GET",
  }),
  providesTags: ["Invite"],
})
```

**Purpose:** Fetches all active instance invites (admin functionality).

**Usage:**
```typescript
const { 
  data: invites = [], 
  error, 
  isLoading,
  refetch 
} = useInviteApi.useGetInvitesQuery();

// Display list of all active invites for administration
```

#### getInviteByCode
```typescript
getInviteByCode: builder.query<InstanceInvite | null, string>({
  query: (code) => ({
    url: `/${code}`,
    method: "GET",
  }),
  providesTags: (_result, _error, code) => [
    { type: "Invite", id: code },
  ],
})
```

**Purpose:** Fetches details for a specific invite code (used during registration process).

**Usage:**
```typescript
const { 
  data: invite, 
  error, 
  isLoading 
} = useInviteApi.useGetInviteByCodeQuery(inviteCode, {
  skip: !inviteCode,
});

// Validate invite code during user registration
if (invite && invite.isActive) {
  // Allow registration to proceed
  setCanRegister(true);
} else {
  // Show invalid invite error
  setInviteError("Invalid or expired invite code");
}
```

### Mutation Endpoints (Data Modification)

#### createInvite
```typescript
createInvite: builder.mutation<InstanceInvite, CreateInviteDto>({
  query: (createInviteDto) => ({
    url: "/",
    method: "POST",
    body: createInviteDto,
  }),
  invalidatesTags: ["Invite"],
})
```

**Purpose:** Creates a new instance invite (requires admin permissions).

**Usage:**
```typescript
const [createInvite, { isLoading, error }] = useInviteApi.useCreateInviteMutation();

const handleCreateInvite = async (inviteData: CreateInviteDto) => {
  try {
    const newInvite = await createInvite(inviteData).unwrap();
    
    // Show success with invite code
    toast.success(`Invite created: ${newInvite.code}`);
    
    // Optionally copy to clipboard
    navigator.clipboard.writeText(newInvite.code);
  } catch (err) {
    console.error('Failed to create invite:', err);
  }
};
```

#### deleteInvite
```typescript
deleteInvite: builder.mutation<void, string>({
  query: (code) => ({
    url: `/${code}`,
    method: "DELETE",
  }),
  invalidatesTags: (_result, _error, code) => [
    { type: "Invite", id: code },
    "Invite",
  ],
})
```

**Purpose:** Deletes/deactivates an invite code (requires admin permissions).

**Usage:**
```typescript
const [deleteInvite, { isLoading }] = useInviteApi.useDeleteInviteMutation();

const handleDeleteInvite = async (code: string) => {
  if (confirm('Are you sure you want to delete this invite?')) {
    try {
      await deleteInvite(code).unwrap();
      toast.success('Invite deleted successfully');
    } catch (err) {
      console.error('Failed to delete invite:', err);
    }
  }
};
```

## Type Definitions

### Request Types

```typescript
interface CreateInviteDto {
  description?: string;        // Optional description for the invite
  maxUses?: number;           // Maximum number of uses (null = unlimited)
  expiresAt?: string;         // Expiration date (ISO string, null = no expiry)
  createdBy?: string;         // Creator ID (auto-filled by server)
}
```

### Response Types

```typescript
interface InstanceInvite {
  id: string;
  code: string;              // Unique invite code (e.g., "abc123def")
  description?: string;      // Optional description
  maxUses?: number;          // Maximum uses allowed
  usedCount: number;         // Number of times used
  expiresAt?: string;        // Expiration date (ISO string)
  isActive: boolean;         // Whether invite is currently usable
  createdBy: string;         // User ID who created the invite
  createdAt: string;         // Creation timestamp
  updatedAt: string;         // Last update timestamp
  creator?: {                // Creator user info (populated in some contexts)
    id: string;
    username: string;
    displayName?: string;
  };
}
```

## Caching Strategy

### Cache Tags

```typescript
tagTypes: ["Invite"]

// Tagging patterns:
// - All invites: "Invite" (generic tag)
// - Specific invite: { type: "Invite", id: code }
```

### Cache Invalidation

| Action | Invalidates | Reason |
|--------|-------------|---------|
| Create Invite | `"Invite"` generic tag | New invite affects invite list |
| Delete Invite | Specific code + generic `"Invite"` | Invite removed from all caches |

### Cache Behavior

- **Long-term Caching:** Invite data is cached for extended periods since it changes infrequently
- **Background Refresh:** Admin invite lists refresh in background to show usage updates
- **Selective Invalidation:** Only specific invite codes are invalidated when deleted

## State Management

### Generated Hooks

```typescript
export const {
  // Query hooks
  useGetInvitesQuery,
  useGetInviteByCodeQuery,
  
  // Mutation hooks  
  useCreateInviteMutation,
  useDeleteInviteMutation,
  
  // Utility hooks
  usePrefetch,
} = inviteApi;
```

### Manual Cache Operations

```typescript
// Prefetch invite validation during registration flow
const prefetch = usePrefetch('getInviteByCode');

const handleInviteCodeChange = (code: string) => {
  if (code.length >= 6) {
    prefetch(code, { force: false });
  }
};

// Update invite usage count optimistically
const updateInviteUsage = (code: string) => {
  dispatch(inviteApi.util.updateQueryData('getInviteByCode', code, (draft) => {
    if (draft) {
      draft.usedCount += 1;
    }
  }));
};
```

## Component Integration

### Invite Management Panel (Admin)

```typescript
import { useInviteApi } from '@/features/invite/inviteApiSlice';

function InviteManagementPanel() {
  const { 
    data: invites = [], 
    error, 
    isLoading,
    refetch 
  } = useInviteApi.useGetInvitesQuery();

  const [deleteInvite, { isLoading: isDeleting }] = useInviteApi.useDeleteInviteMutation();

  const handleDeleteInvite = async (code: string) => {
    if (confirm('Delete this invite?')) {
      try {
        await deleteInvite(code).unwrap();
      } catch (err) {
        toast.error('Failed to delete invite');
      }
    }
  };

  const copyInviteLink = (code: string) => {
    const inviteUrl = `${window.location.origin}/register?invite=${code}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success('Invite link copied to clipboard');
  };

  if (isLoading) return <div>Loading invites...</div>;
  if (error) return <div>Error loading invites</div>;

  return (
    <div className="invite-management">
      <div className="panel-header">
        <h3>Instance Invites</h3>
        <button onClick={() => setShowCreateInvite(true)}>
          Create New Invite
        </button>
      </div>

      <div className="invites-list">
        {invites.map(invite => (
          <div key={invite.code} className="invite-item">
            <div className="invite-info">
              <div className="invite-code">
                <code>{invite.code}</code>
                <button 
                  onClick={() => copyInviteLink(invite.code)}
                  className="copy-btn"
                >
                  📋
                </button>
              </div>
              
              {invite.description && (
                <p className="invite-description">{invite.description}</p>
              )}
              
              <div className="invite-stats">
                <span>Used: {invite.usedCount}</span>
                {invite.maxUses && <span> / {invite.maxUses}</span>}
                
                {invite.expiresAt && (
                  <span> • Expires: {formatDate(invite.expiresAt)}</span>
                )}
                
                <span className={`status ${invite.isActive ? 'active' : 'inactive'}`}>
                  {invite.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            
            <div className="invite-actions">
              <button 
                onClick={() => handleDeleteInvite(invite.code)}
                disabled={isDeleting}
                className="delete-btn"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        
        {invites.length === 0 && (
          <div className="no-invites">
            No invites created yet. Create one to allow new users to register.
          </div>
        )}
      </div>
    </div>
  );
}
```

### Create Invite Form

```typescript
function CreateInviteForm({ onClose }: { onClose: () => void }) {
  const [createInvite, { isLoading, error }] = useInviteApi.useCreateInviteMutation();
  const [formData, setFormData] = useState<CreateInviteDto>({
    description: '',
    maxUses: undefined,
    expiresAt: undefined,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newInvite = await createInvite(formData).unwrap();
      
      // Show success with copy option
      const inviteUrl = `${window.location.origin}/register?invite=${newInvite.code}`;
      
      toast.success(
        <div>
          <p>Invite created successfully!</p>
          <button 
            onClick={() => navigator.clipboard.writeText(inviteUrl)}
            className="copy-invite-btn"
          >
            Copy Invite Link
          </button>
        </div>
      );
      
      onClose();
    } catch (err) {
      console.error('Failed to create invite:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-invite-form">
      <h3>Create Instance Invite</h3>
      
      <div className="form-group">
        <label>Description (Optional)</label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="e.g., For new team members"
        />
      </div>

      <div className="form-group">
        <label>Maximum Uses</label>
        <input
          type="number"
          min="1"
          value={formData.maxUses || ''}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            maxUses: e.target.value ? parseInt(e.target.value) : undefined 
          }))}
          placeholder="Unlimited"
        />
        <small>Leave empty for unlimited uses</small>
      </div>

      <div className="form-group">
        <label>Expiration Date</label>
        <input
          type="datetime-local"
          value={formData.expiresAt ? formData.expiresAt.slice(0, 16) : ''}
          onChange={(e) => setFormData(prev => ({ 
            ...prev, 
            expiresAt: e.target.value ? new Date(e.target.value).toISOString() : undefined 
          }))}
        />
        <small>Leave empty for no expiration</small>
      </div>

      <div className="form-actions">
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Invite'}
        </button>
      </div>
      
      {error && <div className="error">Failed to create invite</div>}
    </form>
  );
}
```

### Registration Invite Validation

```typescript
function RegistrationForm() {
  const [inviteCode, setInviteCode] = useState(
    new URLSearchParams(window.location.search).get('invite') || ''
  );
  
  const { 
    data: invite, 
    error: inviteError, 
    isLoading: isValidatingInvite 
  } = useInviteApi.useGetInviteByCodeQuery(inviteCode, {
    skip: !inviteCode,
  });

  const inviteIsValid = invite && invite.isActive && 
    (!invite.maxUses || invite.usedCount < invite.maxUses) &&
    (!invite.expiresAt || new Date(invite.expiresAt) > new Date());

  return (
    <div className="registration-form">
      <h2>Register for Kraken</h2>
      
      <div className="form-group">
        <label>Invite Code *</label>
        <input
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="Enter your invite code"
          required
        />
        
        {isValidatingInvite && (
          <div className="validation-status">Validating invite...</div>
        )}
        
        {inviteError && (
          <div className="validation-error">Invalid invite code</div>
        )}
        
        {invite && !inviteIsValid && (
          <div className="validation-error">
            This invite is no longer valid
            {invite.maxUses && invite.usedCount >= invite.maxUses && " (maximum uses reached)"}
            {invite.expiresAt && new Date(invite.expiresAt) <= new Date() && " (expired)"}
          </div>
        )}
        
        {inviteIsValid && (
          <div className="validation-success">
            ✓ Valid invite code
            {invite.description && <p>"{invite.description}"</p>}
          </div>
        )}
      </div>

      {/* Rest of registration form */}
      <div className="form-group">
        <label>Username *</label>
        <input
          type="text"
          required
          disabled={!inviteIsValid}
        />
      </div>
      
      {/* ... other fields ... */}

      <button 
        type="submit" 
        disabled={!inviteIsValid || isValidatingInvite}
      >
        Register
      </button>
    </div>
  );
}
```

### Join Page Component

```typescript
function JoinInvitePage() {
  const { code } = useParams<{ code: string }>();
  const { 
    data: invite, 
    error, 
    isLoading 
  } = useInviteApi.useGetInviteByCodeQuery(code || '');

  if (isLoading) return <div>Validating invite...</div>;
  if (error || !invite) return <InviteNotFoundPage />;
  if (!invite.isActive) return <InviteExpiredPage />;

  return (
    <div className="join-invite-page">
      <div className="invite-header">
        <h1>You're Invited to Join Kraken!</h1>
        {invite.description && (
          <p className="invite-description">"{invite.description}"</p>
        )}
      </div>

      <div className="invite-stats">
        {invite.maxUses && (
          <p>{invite.maxUses - invite.usedCount} uses remaining</p>
        )}
        {invite.expiresAt && (
          <p>Expires: {formatDate(invite.expiresAt)}</p>
        )}
      </div>

      <div className="join-actions">
        <Link 
          to={`/register?invite=${code}`}
          className="btn btn-primary"
        >
          Create Account
        </Link>
        
        <Link to="/login" className="btn btn-secondary">
          Already have an account? Sign In
        </Link>
      </div>
    </div>
  );
}
```

## Error Handling

### Invite Validation Errors

```typescript
const { data: invite, error } = useGetInviteByCodeQuery(inviteCode);

if (error) {
  if ('status' in error) {
    switch (error.status) {
      case 404:
        setInviteMessage('Invite code not found');
        break;
      case 410:
        setInviteMessage('This invite has expired');
        break;
      default:
        setInviteMessage('Error validating invite code');
    }
  }
}
```

### Admin Invite Management Errors

```typescript
const [createInvite, { error }] = useCreateInviteMutation();

const handleCreateInviteError = (error: any) => {
  if (error.status === 403) {
    toast.error("You don't have permission to create invites");
  } else if (error.status === 429) {
    toast.error("Too many invites created. Please wait.");
  } else {
    toast.error("Failed to create invite");
  }
};
```

## Performance Optimization

### Invite Code Validation

```typescript
// Debounce invite code validation
const debouncedValidateInvite = useMemo(
  () => debounce((code: string) => {
    if (code.length >= 6) {
      dispatch(inviteApi.util.prefetch('getInviteByCode', code));
    }
  }, 300),
  []
);
```

### Admin Dashboard Optimization

```typescript
// Only fetch invites when admin panel is visible
const { data: invites } = useGetInvitesQuery(undefined, {
  skip: !isAdminPanelVisible,
  pollingInterval: 30000, // Refresh every 30 seconds for usage updates
});
```

## Testing

### Invite Validation Testing

```typescript
describe('inviteApi', () => {
  it('should validate invite code successfully', async () => {
    const inviteCode = 'abc123';
    
    const { result } = renderHook(
      () => inviteApi.useGetInviteByCodeQuery(inviteCode),
      { wrapper: TestProvider }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.code).toBe(inviteCode);
    expect(result.current.data?.isActive).toBe(true);
  });
});
```

### Invite Creation Testing

```typescript
it('should create invite successfully', async () => {
  const inviteData = {
    description: 'Test invite',
    maxUses: 10
  };

  const { result } = renderHook(
    () => inviteApi.useCreateInviteMutation(),
    { wrapper: TestProvider }
  );

  await act(async () => {
    const response = await result.current[0](inviteData).unwrap();
    expect(response.code).toBeDefined();
    expect(response.description).toBe(inviteData.description);
    expect(response.maxUses).toBe(inviteData.maxUses);
  });
});
```

## Related Documentation

- [Onboarding API](./onboardingApi.md) - Instance setup and first-time configuration
- [Auth API](./authApi.md) - User registration with invite codes
- [Users API](./usersApi.md) - User registration process
- [Instance Invites Feature](../features/instance-invites.md) - Complete invite system overview
- [Onboarding Flow](../components/onboarding/) - Registration and setup process
- [Admin Management](../features/auth-rbac.md#admin-features) - Administrative invite management