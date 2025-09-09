# RoleAssignmentDialog Component

> **Location:** `frontend/src/components/Community/RoleAssignmentDialog.tsx`  
> **Type:** Dialog Component  
> **Domain:** Role Management

## Overview

The RoleAssignmentDialog component provides an intuitive interface for managing role assignments for individual users within communities. It displays available roles with current assignments highlighted, supports bulk role assignment/removal, and provides real-time feedback on changes.

## Component Interface

```typescript
interface RoleAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  communityId: string;
  userId: string;
  userName: string;
}
```

## Key Features

### ✅ Visual Role Selection
- **Current Role Highlight**: Shows which roles the user currently has
- **Role Information**: Displays permission count and sample permissions for each role
- **Change Tracking**: Visual indicators for roles being added or removed
- **Progress Feedback**: Shows selected role count in real-time

### ✅ Batch Operations
- **Multiple Role Selection**: Select/deselect multiple roles at once
- **Change Detection**: Only enables save when there are actual changes
- **Atomic Updates**: All role changes applied together or rolled back on error
- **Optimistic Updates**: RTK Query handles cache updates automatically

### ✅ User Experience
- **Loading States**: Shows loading during API calls
- **Error Handling**: Displays meaningful error messages
- **Change Summary**: Clear indication of what changes will be made
- **Responsive Design**: Works on desktop and mobile devices

## Usage Examples

### Basic Usage in Member Management

```typescript
import RoleAssignmentDialog from '@/components/Community/RoleAssignmentDialog';

function MemberManagement({ communityId }: { communityId: string }) {
  const [roleAssignmentOpen, setRoleAssignmentOpen] = useState(false);
  const [userForRoleAssignment, setUserForRoleAssignment] = useState<{id: string, name: string} | null>(null);

  const handleManageRoles = (userId: string, username: string) => {
    setUserForRoleAssignment({ id: userId, name: username });
    setRoleAssignmentOpen(true);
  };

  const handleCloseRoleAssignment = () => {
    setRoleAssignmentOpen(false);
    setUserForRoleAssignment(null);
  };

  return (
    <>
      {/* Member list with role management buttons */}
      <IconButton onClick={() => handleManageRoles(member.userId, member.user?.username)}>
        <SettingsIcon />
      </IconButton>

      {/* Role Assignment Dialog */}
      {userForRoleAssignment && (
        <RoleAssignmentDialog
          open={roleAssignmentOpen}
          onClose={handleCloseRoleAssignment}
          communityId={communityId}
          userId={userForRoleAssignment.id}
          userName={userForRoleAssignment.name}
        />
      )}
    </>
  );
}
```

## Component Architecture

### State Management

```typescript
const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
const [originalRoles, setOriginalRoles] = useState<Set<string>>(new Set());

// Update state when user roles load
useEffect(() => {
  if (userRoles?.roles) {
    const roleIds = new Set(userRoles.roles.map(role => role.id));
    setSelectedRoles(roleIds);
    setOriginalRoles(roleIds);
  }
}, [userRoles]);

// Reset state when dialog closes
useEffect(() => {
  if (!open) {
    setSelectedRoles(new Set());
    setOriginalRoles(new Set());
  }
}, [open]);
```

### Role Toggle Logic

```typescript
const handleRoleToggle = (roleId: string) => {
  setSelectedRoles(prev => {
    const newSet = new Set(prev);
    if (newSet.has(roleId)) {
      newSet.delete(roleId);
    } else {
      newSet.add(roleId);
    }
    return newSet;
  });
};
```

### Change Detection

```typescript
const hasChanges = 
  selectedRoles.size !== originalRoles.size ||
  !Array.from(selectedRoles).every(roleId => originalRoles.has(roleId));
```

### Batch Role Assignment

```typescript
const handleSave = async () => {
  const rolesToAdd = Array.from(selectedRoles).filter(roleId => !originalRoles.has(roleId));
  const rolesToRemove = Array.from(originalRoles).filter(roleId => !selectedRoles.has(roleId));

  try {
    // Add new roles
    for (const roleId of rolesToAdd) {
      await assignRole({
        communityId,
        data: { userId, roleId },
      }).unwrap();
    }

    // Remove old roles
    for (const roleId of rolesToRemove) {
      await removeRole({
        communityId,
        userId,
        roleId,
      }).unwrap();
    }

    onClose();
  } catch (error) {
    // Error handled by RTK Query
    console.error("Failed to update user roles:", error);
  }
};
```

## API Integration

### RTK Query Hooks

```typescript
const {
  data: communityRoles,
  isLoading: loadingRoles,
  error: rolesError,
} = useGetCommunityRolesQuery(communityId, {
  skip: !open,
});

const {
  data: userRoles,
  isLoading: loadingUserRoles,
  error: userRolesError,
} = useGetUserRolesForCommunityQuery(
  { userId, communityId },
  { skip: !open }
);

const [assignRole, { isLoading: assigning }] = useAssignRoleToUserMutation();
const [removeRole, { isLoading: removing }] = useRemoveRoleFromUserMutation();
```

### Cache Management
- **Automatic Invalidation**: RTK Query automatically updates related caches
- **Optimistic Updates**: UI updates immediately, rolls back on error
- **Background Refetch**: Keeps data fresh when dialog reopens

## Visual Design

### Dialog Structure

```typescript
<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
  <DialogTitle>
    Manage Roles for {userName}
  </DialogTitle>
  
  <DialogContent>
    {/* Role selection interface */}
    <FormGroup>
      {communityRoles?.roles.map(role => (
        <FormControlLabel
          key={role.id}
          control={
            <Checkbox
              checked={selectedRoles.has(role.id)}
              onChange={() => handleRoleToggle(role.id)}
            />
          }
          label={<RoleLabel role={role} isOriginal={originalRoles.has(role.id)} />}
        />
      ))}
    </FormGroup>
  </DialogContent>

  <DialogActions>
    <Button onClick={onClose}>Cancel</Button>
    <Button 
      onClick={handleSave}
      disabled={!hasChanges || isLoading}
      variant="contained"
    >
      Save Changes
    </Button>
  </DialogActions>
</Dialog>
```

### Role Information Display

```typescript
<FormControlLabel
  label={
    <Box>
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body2" fontWeight="medium">
          {role.name}
        </Typography>
        {wasOriginallySelected && (
          <Chip
            label="Current"
            size="small"
            color="primary"
            variant="outlined"
          />
        )}
      </Box>
      <Typography variant="caption" color="text.secondary">
        {role.actions.length} permission{role.actions.length !== 1 ? 's' : ''} 
        {role.actions.length > 0 && (
          <>
            {' '}• {role.actions.slice(0, 2).join(", ")}
            {role.actions.length > 2 && ` +${role.actions.length - 2} more`}
          </>
        )}
      </Typography>
    </Box>
  }
/>
```

## Loading States

### Initial Data Loading

```typescript
{isLoading ? (
  <Box display="flex" justifyContent="center" py={4}>
    <CircularProgress />
  </Box>
) : error ? (
  <Alert severity="error">
    Failed to load role information. Please try again.
  </Alert>
) : (
  // Role selection interface
)}
```

### Save Operation Loading

```typescript
<Button
  onClick={handleSave}
  disabled={!hasChanges || isLoading || assigning || removing}
>
  {assigning || removing ? (
    <>
      <CircularProgress size={16} sx={{ mr: 1 }} />
      Updating...
    </>
  ) : (
    "Save Changes"
  )}
</Button>
```

## Error Handling

### API Error Management
- **Network Errors**: Generic error message with retry capability
- **Permission Errors**: Specific guidance for insufficient permissions
- **Validation Errors**: Backend validation message display
- **Recovery Options**: Dialog stays open on error for user to retry

### User Feedback
```typescript
// Error display
{error && (
  <Alert severity="error" sx={{ mb: 2 }}>
    Failed to load role information. Please try again.
  </Alert>
)}

// Success indication
// Automatic dialog close on successful save
onClose(); // Called after successful API operations
```

## Performance Considerations

### Optimization Strategies
- **Conditional Loading**: Skip API calls when dialog is closed
- **Set-based Operations**: Efficient role selection state management
- **Memoized Handlers**: Prevent unnecessary re-renders
- **Batch API Calls**: Group multiple role changes into atomic operation

### Memory Management
- **State Cleanup**: Reset state when dialog closes
- **API Cancellation**: RTK Query automatically cancels in-flight requests
- **Event Listener Cleanup**: No manual cleanup required

## Accessibility

### Dialog Accessibility
- **Modal Focus Management**: Focus trapped within dialog
- **Escape Key**: Closes dialog
- **ARIA Labels**: Screen reader friendly role descriptions
- **Keyboard Navigation**: Full keyboard navigation support

### Form Accessibility
- **Checkbox Labels**: Clear role information for screen readers
- **Loading Announcements**: Loading states announced to screen readers
- **Error Announcements**: Validation errors announced appropriately

## Testing Strategy

### Unit Tests
```typescript
describe('RoleAssignmentDialog', () => {
  it('should load user roles and community roles', () => {
    // Test data loading
  });

  it('should detect changes in role selection', () => {
    // Test change detection logic
  });

  it('should save role changes correctly', () => {
    // Test batch role assignment/removal
  });

  it('should handle API errors gracefully', () => {
    // Test error handling
  });
});
```

### Integration Tests
- **API Integration**: Test with real role assignment endpoints
- **Cache Updates**: Verify RTK Query cache invalidation
- **User Workflow**: Test complete role assignment workflow

## Related Components

- **[MemberManagement](./MemberManagement.md)** - Parent component that launches dialog
- **[RoleManagement](./RoleManagement.md)** - Related role management interface
- **[RoleEditor](./RoleEditor.md)** - Role creation/editing component

## Related Documentation

### Backend Integration
- **[Roles Backend Module](../../modules/auth/roles.md)** - Backend role management service and business logic
- **[Roles API Endpoints](../../api/roles.md)** - REST API documentation for user-role assignment

### State Management
- **[Roles API Slice](../../state/rolesApi.md)** - RTK Query integration and caching strategies
- **[Role Assignment Hooks](../../state/rolesApi.md#user-role-assignment-endpoints)** - Mutation hooks for role assignment/removal

### System Architecture
- **[RBAC System](../../features/auth-rbac.md)** - Overall permission system architecture
- **[Community Management](../community/CommunityManagement.md)** - Integration with community management workflows