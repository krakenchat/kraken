# RoleEditor Component

> **Location:** `frontend/src/components/Community/RoleEditor.tsx`  
> **Type:** Form Component  
> **Domain:** Role Management

## Overview

The RoleEditor component provides a comprehensive interface for creating and editing custom roles within communities. It features an interactive permission matrix with grouped permissions, real-time validation, and a user-friendly accordion-style layout for managing the 57+ available RBAC permissions.

## Component Interface

```typescript
interface RoleEditorProps {
  role?: RoleDto;                                           // undefined for creating new role
  onSave: (data: { name: string; actions: string[] }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}
```

## Key Features

### ✅ Interactive Permission Matrix
- **Grouped Permissions**: Organizes 57+ permissions into 9 logical categories
- **Accordion Layout**: Collapsible sections for Messages, Channels, Community, Members, etc.
- **Select All/None**: Group-level checkboxes for bulk permission selection
- **Visual Feedback**: Indeterminate state for partial group selection

### ✅ Advanced Form Validation
- **Name Validation**: Required, max 50 characters
- **Permission Validation**: Minimum 1 permission required
- **Real-time Feedback**: Instant validation with error messages
- **Character Counter**: Live character count for role name

### ✅ User Experience Features
- **Permission Counter**: Shows selected permission count
- **Progress Indicators**: Loading states during save operations
- **Error Handling**: Displays API error messages
- **Responsive Design**: Works on desktop and mobile

### ✅ Permission Organization

```typescript
const PERMISSION_GROUPS = {
  'Messages': [
    'CREATE_MESSAGE',
    'DELETE_MESSAGE', 
    'READ_MESSAGE'
  ],
  'Channels': [
    'CREATE_CHANNEL',
    'UPDATE_CHANNEL',
    'DELETE_CHANNEL',
    'READ_CHANNEL',
    'JOIN_CHANNEL'
  ],
  'Community': [
    'UPDATE_COMMUNITY',
    'DELETE_COMMUNITY',
    'READ_COMMUNITY'
  ],
  // ... 6 more groups
};
```

## Usage Examples

### Creating New Role

```typescript
import RoleEditor from '@/components/Community/RoleEditor';
import { useCreateCommunityRoleMutation } from '@/features/roles/rolesApiSlice';

function CreateRoleDialog({ communityId }: { communityId: string }) {
  const [createRole, { isLoading, error }] = useCreateCommunityRoleMutation();

  const handleSave = async (data: { name: string; actions: string[] }) => {
    await createRole({
      communityId,
      data,
    }).unwrap();
  };

  return (
    <RoleEditor
      onSave={handleSave}
      onCancel={onClose}
      isLoading={isLoading}
      error={error ? `Failed to create role: ${error.message}` : undefined}
    />
  );
}
```

### Editing Existing Role

```typescript
function EditRoleDialog({ role, onClose }: { role: RoleDto; onClose: () => void }) {
  const [updateRole, { isLoading, error }] = useUpdateRoleMutation();

  const handleSave = async (data: { name: string; actions: string[] }) => {
    await updateRole({
      roleId: role.id,
      data,
    }).unwrap();
    onClose();
  };

  return (
    <RoleEditor
      role={role}                    // Pre-populate with existing data
      onSave={handleSave}
      onCancel={onClose}
      isLoading={isLoading}
      error={error ? `Failed to update role: ${error.message}` : undefined}
    />
  );
}
```

## Component Architecture

### State Management

```typescript
const [name, setName] = useState(role?.name || "");
const [selectedActions, setSelectedActions] = useState<Set<string>>(
  new Set(role?.actions || [])
);
const [nameError, setNameError] = useState("");
```

### Permission Selection Logic

```typescript
const handleActionToggle = useCallback((action: string) => {
  setSelectedActions(prev => {
    const newSet = new Set(prev);
    if (newSet.has(action)) {
      newSet.delete(action);
    } else {
      newSet.add(action);
    }
    return newSet;
  });
}, []);

const handleGroupToggle = useCallback((groupActions: string[]) => {
  const allSelected = groupActions.every(action => selectedActions.has(action));
  
  setSelectedActions(prev => {
    const newSet = new Set(prev);
    if (allSelected) {
      groupActions.forEach(action => newSet.delete(action));
    } else {
      groupActions.forEach(action => newSet.add(action));
    }
    return newSet;
  });
}, [selectedActions]);
```

### Form Validation

```typescript
const isFormValid = name.trim().length > 0 && selectedActions.size > 0 && !nameError;

const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  const newName = event.target.value;
  setName(newName);
  
  if (newName.trim().length === 0) {
    setNameError("Role name is required");
  } else if (newName.length > 50) {
    setNameError("Role name must not exceed 50 characters");
  } else {
    setNameError("");
  }
};
```

## Dependencies

### Internal Dependencies
- `@/constants/rbacActions` - Permission definitions and human-readable labels
- `@/features/roles/rolesApiSlice` - Role management API integration

### External Dependencies
- `@mui/material` - UI components (TextField, Button, Checkbox, Accordion)
- `@mui/icons-material` - Icons (ExpandMore, Save, Cancel)
- `react` - Component state and lifecycle

## Styling & UI

### Material-UI Components
- **TextField**: Role name input with validation
- **Accordion**: Collapsible permission groups
- **Checkbox**: Individual and group permission selection
- **Button**: Save/cancel actions with loading states
- **Chip**: Permission count indicators

### Visual Hierarchy
```typescript
// Permission group with counter
<FormControlLabel
  control={<Checkbox checked={allSelected} indeterminate={someSelected} />}
  label={
    <Box display="flex" alignItems="center" gap={1}>
      <Typography variant="subtitle2">{groupName}</Typography>
      <Chip 
        label={`${selectedCount}/${actions.length}`}
        color={selectedCount > 0 ? "primary" : "default"}
      />
    </Box>
  }
/>
```

## Performance Considerations

### Optimization Strategies
- **useCallback**: Memoized event handlers prevent unnecessary re-renders
- **Set-based Selection**: Efficient O(1) permission lookup and toggle
- **Controlled Components**: Minimal state updates with batched changes
- **Conditional Rendering**: Only render active accordion sections

### Memory Management
- **Cleanup on Unmount**: No subscriptions or timers to clean up
- **Efficient State**: Uses Set for permission selection instead of arrays
- **Memoized Handlers**: Prevents callback recreation on every render

## Testing Strategy

### Component Testing
```typescript
describe('RoleEditor', () => {
  it('should validate role name requirements', () => {
    // Test name validation logic
  });

  it('should require at least one permission', () => {
    // Test permission validation
  });

  it('should handle group permission selection', () => {
    // Test bulk permission toggle
  });

  it('should call onSave with correct data format', () => {
    // Test form submission
  });
});
```

### Integration Testing
- **API Integration**: Test with actual role creation/update endpoints
- **Error Handling**: Verify error message display and recovery
- **Loading States**: Test UI during async operations

## Accessibility

### ARIA Support
- **Accordion Navigation**: Keyboard navigation between groups
- **Checkbox Labels**: Screen reader friendly permission descriptions
- **Error Announcements**: Form validation errors announced to screen readers
- **Loading States**: Loading spinners with appropriate ARIA labels

### Keyboard Support
- **Tab Navigation**: Full keyboard navigation support
- **Space/Enter**: Toggle checkboxes and buttons
- **Escape**: Cancel dialog (when used in modal context)

## Error Handling

### Validation Errors
```typescript
// Name validation
if (newName.trim().length === 0) {
  setNameError("Role name is required");
} else if (newName.length > 50) {
  setNameError("Role name must not exceed 50 characters");
}

// Permission validation  
if (selectedActions.size === 0) {
  // Show warning message
}
```

### API Error Display
- **Server Errors**: Display backend validation messages
- **Network Errors**: Generic error message with retry option
- **Conflict Errors**: Specific guidance for role name conflicts

## Related Components

- **[RoleManagement](./RoleManagement.md)** - Parent component that uses RoleEditor
- **[RoleAssignmentDialog](./RoleAssignmentDialog.md)** - User-role assignment interface
- **[MemberManagement](./MemberManagement.md)** - Integrates role management features

## Related Documentation

### Backend Integration
- **[Roles Backend Module](../../modules/auth/roles.md)** - Backend role management service and business logic
- **[Roles API Endpoints](../../api/roles.md)** - REST API documentation for role CRUD operations

### State Management
- **[Roles API Slice](../../state/rolesApi.md)** - RTK Query integration and caching strategies
- **[Role Management Hooks](../../state/rolesApi.md#generated-hooks)** - Complete list of available hooks

### System Architecture
- **[RBAC System](../../features/auth-rbac.md)** - Overall permission system architecture
- **[RBAC Actions Constants](../../constants/rbacActions.md)** - Permission definitions and human-readable labels