# MemberManagement

> **Location:** `frontend/src/components/Community/MemberManagement.tsx`  
> **Type:** Management Container Component  
> **Feature:** community

## Overview

The MemberManagement component provides a comprehensive interface for managing community membership. It displays current community members with their profile information and provides functionality to add new members from the user base and remove existing members, all with proper RBAC permission checking.

## Props Interface

```typescript
interface MemberManagementProps {
  communityId: string;  // The community ID for member management operations
}
```

## Usage Examples

### Basic Usage
```tsx
import MemberManagement from '@/components/Community/MemberManagement';

function CommunitySettings() {
  const { communityId } = useParams();

  return (
    <MemberManagement communityId={communityId} />
  );
}
```

### Integration with Community Settings
```tsx
// EditCommunityPage.tsx usage
function EditCommunityPage() {
  const { communityId } = useParams();

  return (
    <Box>
      <CommunitySettingsForm communityId={communityId} />
      <MemberManagement communityId={communityId} />
      <RoleManagement communityId={communityId} />
    </Box>
  );
}
```

## Styling & Theming

- **Material-UI Components Used:**
  - `Box` (layout containers)
  - `Card` & `CardContent` (section containers)
  - `Typography` (headings and text)
  - `Button` & `IconButton` (actions)
  - `Alert` (error/info messages)
  - `CircularProgress` (loading indicators)
  - `Chip` (member role display)
  - `Avatar` (user profile pictures)
  - `Divider` (section separators)
  - `Dialog` (confirmation modal)
- **Material-UI Icons:** `Delete`, `PersonAdd`
- **Custom Styles:** Inline sx props with alpha transparency and hover effects

```tsx
// Key styling patterns
<Box
  display="flex"
  justifyContent="space-between"
  alignItems="center"
  p={2}
  sx={{
    border: 1,
    borderColor: "divider",
    borderRadius: 1,
    "&:hover": {
      bgcolor: alpha("#000", 0.02),
    },
  }}
>
```

## State Management

- **Local State:**
  - `confirmRemoveOpen` (boolean) - controls confirmation dialog visibility
  - `userToRemove` (object | null) - stores user data for removal confirmation
- **Redux Integration:**
  - `useGetMembersForCommunityQuery` - fetches community members
  - `useGetAllUsersQuery` - fetches available users for adding
  - `useCreateMembershipMutation` - adds new members
  - `useRemoveMembershipMutation` - removes members
- **RBAC Integration:** Uses `useUserPermissions` for permission checking

## Dependencies

### Internal Dependencies
- `@/features/membership` - membership API operations
- `@/features/roles/useUserPermissions` - RBAC permission checking
- `@/features/users/usersSlice` - user data fetching

### External Dependencies
- `@mui/material` - all UI components
- `@mui/icons-material` - Delete and PersonAdd icons
- `react` (useState, useMemo) - state and optimization hooks

## Related Components

- **Parent Components:** EditCommunityPage, CommunitySettingsForm
- **Child Components:** None (leaf component)
- **Related Components:** RoleManagement (similar management interface)

## Common Patterns

### Pattern 1: RBAC Permission Gates
```typescript
const { hasPermissions: canCreateMembers } = useUserPermissions({
  resourceType: "COMMUNITY",
  resourceId: communityId,
  actions: ["CREATE_MEMBER"],
});

const { hasPermissions: canDeleteMembers } = useUserPermissions({
  resourceType: "COMMUNITY", 
  resourceId: communityId,
  actions: ["DELETE_MEMBER"],
});

// Conditional rendering based on permissions
{canCreateMembers && <AddMembersSection />}
{canDeleteMembers && <RemoveButton />}
```

### Pattern 2: Optimized Member Checking
```typescript
const memberUserIds = useMemo(
  () => new Set(members?.map(member => member.userId || null) || []), 
  [members]
);

const isAlreadyMember = memberUserIds.has(user.id);
```

### Pattern 3: Confirmation Dialog Pattern
```typescript
const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
const [userToRemove, setUserToRemove] = useState<{id: string, name: string} | null>(null);

const handleRemoveMember = (userId: string, username: string) => {
  setUserToRemove({ id: userId, name: username });
  setConfirmRemoveOpen(true);
};

const confirmRemoveMember = async () => {
  if (!userToRemove) return;
  
  try {
    await removeMembership({ userId: userToRemove.id, communityId }).unwrap();
  } finally {
    setConfirmRemoveOpen(false);
    setUserToRemove(null);
  }
};
```

### Pattern 4: Loading State Management
```typescript
if (loadingMembers) {
  return (
    <Box display="flex" justifyContent="center" p={2}>
      <CircularProgress />
    </Box>
  );
}

// Button loading states
<Button disabled={addingMember}>
  {addingMember ? <CircularProgress size={16} /> : "Add"}
</Button>
```

## Testing

- **Test Location:** Not currently implemented
- **Key Test Cases:**
  - Members list displays correctly
  - Add member functionality with permissions
  - Remove member confirmation flow
  - Permission-based UI visibility
  - Loading states during API operations
  - Error handling for failed operations

```tsx
// Example test patterns
test('should show add member section only with CREATE_MEMBER permission', () => {
  // Mock useUserPermissions to return false for CREATE_MEMBER
  // Render component
  // Assert "Add New Members" section is not visible
});

test('should confirm before removing member', () => {
  // Render with members and DELETE_MEMBER permission
  // Click remove button
  // Assert confirmation dialog appears
  // Assert user name shown in dialog
});
```

## Accessibility

- **ARIA Labels:** Provided by MUI components (buttons, dialogs)
- **Keyboard Navigation:** Full keyboard support for all interactive elements
- **Screen Reader Support:**
  - Proper heading structure for sections
  - Clear button labeling for actions
  - Dialog properly announced when opened

## Performance Considerations

- **Memoization:** Uses useMemo for member ID set optimization
- **Bundle Size:** Large component due to comprehensive UI
- **Rendering:** Optimized member checking to prevent unnecessary re-renders
- **Pagination:** Users query limited to prevent large data loads

## API Integration

### Endpoints Used
- `GET /api/membership/community/:communityId` - fetches community members
- `GET /api/users?limit=10` - fetches users available for adding
- `POST /api/membership` - creates new membership
- `DELETE /api/membership` - removes membership

### RTK Query Features
- **Automatic Caching:** Member and user data cached by RTK Query
- **Optimistic Updates:** Membership mutations update cache immediately
- **Error Handling:** Displays user-friendly error messages

## Permission System Integration

### Required Permissions
- **CREATE_MEMBER:** Required to see "Add New Members" section
- **DELETE_MEMBER:** Required to see remove buttons and perform removals

### Permission Scoping
- All permissions scoped to specific community resource
- Uses COMMUNITY resource type with communityId

## User Interface Sections

### Current Members Section
- Lists all community members with avatars and names
- Shows member role chips
- Provides remove functionality for users with DELETE_MEMBER permission
- Empty state when no members exist

### Add New Members Section
- Shows available users not already in community
- Filters out existing members automatically
- Disabled state for users already in community
- Only visible with CREATE_MEMBER permission

### Confirmation Dialog
- Prevents accidental member removal
- Shows user name being removed
- Provides clear cancel/confirm options

## Troubleshooting

### Common Issues
1. **Members not loading**
   - **Cause:** Invalid communityId or API unavailable
   - **Solution:** Verify community exists and API is accessible

2. **Permission sections not showing**
   - **Cause:** User lacks required permissions or RBAC not configured
   - **Solution:** Check user roles and permissions in community

3. **Add member fails silently**
   - **Cause:** API error not properly handled
   - **Solution:** Check network tab and backend logs for error details

4. **Confirmation dialog not working**
   - **Cause:** State management issues with dialog controls
   - **Solution:** Verify userToRemove state is set correctly

## Recent Changes

- **Current:** Full member management with RBAC integration
- **Needs:** Bulk operations, member search, role assignment integration

## Related Documentation

- [RoleManagement](./RoleManagement.md)
- [RBAC System](../../features/auth-rbac.md)
- [Membership API](../../api/membership.md)
- [useUserPermissions Hook](../../hooks/useUserPermissions.md)