# AdminInvitePage

> **Location:** `frontend/src/pages/AdminInvitePage.tsx`  
> **Type:** Admin Dashboard Page Component  
> **Feature:** invite

## Overview

The AdminInvitePage provides a comprehensive interface for administrators to manage instance-level invitation codes. It features invite creation with community auto-join selection, invite statistics, advanced filtering, and invite lifecycle management.

## Component Interface

```typescript
interface AdminInvitePageProps {
  // This is a page component with no props
}

interface InviteFilters {
  status: 'all' | 'active' | 'expired' | 'disabled';
  usage: 'all' | 'unused' | 'partial' | 'exhausted';
}
```

## Usage Examples

### Route Integration
```tsx
// In App.tsx
<Route path="/admin/invites" element={<AdminInvitePage />} />
```

### Navigation Access
```tsx
// In NavigationLinks.tsx
{canViewInvites && (
  <Link to="/admin/invites">
    <ListItemText primary="Invites" />
  </Link>
)}
```

## Key Features

### 1. Invite Statistics Dashboard
- **Total Invites:** Count of all invitation codes
- **Active Invites:** Currently valid invitations  
- **Expired:** Time-expired invitations
- **Total Uses:** Aggregate redemption count

### 2. Invite Management Table
- **Invite Code Display:** Monospace formatted codes with copy functionality
- **Usage Tracking:** Shows current uses vs. maximum allowed
- **Expiration Display:** Human-readable expiration dates
- **Community Chips:** Visual display of associated communities
- **Status Indicators:** Color-coded status badges

### 3. Advanced Filtering
```typescript
const filters = {
  status: 'all' | 'active' | 'expired' | 'disabled',
  usage: 'all' | 'unused' | 'partial' | 'exhausted'
};
```

### 4. Create Invite Dialog
```typescript
interface CreateInviteForm {
  maxUses?: number;           // Usage limit (undefined = unlimited)
  validUntil?: string;        // ISO date string
  selectedCommunities: string[]; // Community IDs for auto-join
}
```

## Styling & Theming

- **Material-UI Components Used:** 
  - Container, Typography, Box, Card, CardContent
  - Button, Alert, CircularProgress, Dialog components
  - TextField, Chip, IconButton, Tooltip, Divider
  - Grid, Paper, FormControl, Select, MenuItem
  - Checkbox, FormControlLabel, FormGroup, FormLabel

- **Custom Styles:** 
  - Gradient invite creation section
  - Status-based border colors and backgrounds
  - Responsive grid layout for statistics cards
  - Monospace font for invite codes

```tsx
// Key styling patterns
sx={{
  border: 1,
  borderColor: isDisabled ? "error.main" : "divider",
  borderRadius: 1,
  bgcolor: isDisabled ? alpha("#f44336", 0.05) : "transparent",
  "&:hover": {
    bgcolor: isDisabled ? alpha("#f44336", 0.1) : alpha("#000", 0.02),
  },
}}
```

## State Management

### Local State
```typescript
const [createDialogOpen, setCreateDialogOpen] = useState(false);
const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
const [inviteToDelete, setInviteToDelete] = useState<InstanceInvite | null>(null);
const [copiedInvite, setCopiedInvite] = useState<string | null>(null);
const [filters, setFilters] = useState<InviteFilters>({ status: 'all', usage: 'all' });

// Form state
const [maxUses, setMaxUses] = useState<number | undefined>(undefined);
const [validUntil, setValidUntil] = useState<string>("");
const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
```

### Redux Integration
```typescript
// RTK Query APIs
const { data: invites = [], isLoading, error, refetch } = useGetInvitesQuery();
const { data: communities = [], isLoading: loadingCommunities } = useMyCommunitiesQuery();
const [createInvite, { isLoading: creatingInvite }] = useCreateInviteMutation();
const [deleteInvite, { isLoading: deletingInvite }] = useDeleteInviteMutation();

// Permission checks
const { hasPermissions: canCreateInvites } = useUserPermissions({
  resourceType: "INSTANCE",
  actions: ["CREATE_INSTANCE_INVITE"],
});
```

## Core Functionality

### Auto-Selection Logic
```typescript
// Community auto-selection when dialog opens
useEffect(() => {
  if (createDialogOpen && communities.length > 0 && selectedCommunities.length === 0) {
    const defaultCommunity = communities.find(c => c.name.toLowerCase() === 'default');
    if (defaultCommunity) {
      setSelectedCommunities([defaultCommunity.id]);
    } else {
      setSelectedCommunities(communities.map(c => c.id));
    }
  }
}, [createDialogOpen, communities, selectedCommunities.length]);
```

### Invite Status Logic
```typescript
const getInviteStatus = (invite: InstanceInvite) => {
  if (invite.disabled) return 'disabled';
  if (isInviteExpired(invite)) return 'expired';  
  if (isInviteExhausted(invite)) return 'exhausted';
  return 'active';
};

const isInviteExpired = (invite: InstanceInvite) => {
  if (!invite.validUntil) return false;
  return new Date() > new Date(invite.validUntil);
};

const isInviteExhausted = (invite: InstanceInvite) => {
  if (!invite.maxUses) return false;
  return invite.uses >= invite.maxUses;
};
```

### Quick Presets
```typescript
// 1 Use, 24h
onClick={() => {
  setMaxUses(1);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  setValidUntil(tomorrow.toISOString().slice(0, 16));
}}

// 10 Uses, 1 Week  
onClick={() => {
  setMaxUses(10);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  setValidUntil(nextWeek.toISOString().slice(0, 16));
}}

// Unlimited
onClick={() => {
  setMaxUses(undefined);
  setValidUntil("");
}}
```

## Dependencies

### Internal Dependencies
- `@/features/invite/inviteApiSlice` - Invite CRUD operations
- `@/features/community/communityApiSlice` - Community data fetching
- `@/features/roles/useUserPermissions` - Permission validation
- `@/types/invite.type` - TypeScript interfaces

### External Dependencies
- `@mui/material/*` - UI components and styling
- `@mui/icons-material/*` - Action icons

## API Integration

### Endpoints Used
- `GET /api/invite/` - Fetch all instance invites
- `POST /api/invite/` - Create new instance invite  
- `DELETE /api/invite/:code` - Delete specific invite
- `GET /api/community/mine` - Fetch user's communities for auto-join selection

### Invite Creation Payload
```typescript
const createInviteDto: CreateInviteDto = {
  communityIds: selectedCommunities.length > 0 ? selectedCommunities : [],
  maxUses: maxUses || undefined,
  validUntil: validUntil ? new Date(validUntil) : undefined,
};
```

## Permission System

### Required Permissions
```typescript
// View page
resourceType: "INSTANCE"  
actions: ["READ_INSTANCE_INVITE"]

// Create invites
resourceType: "INSTANCE"
actions: ["CREATE_INSTANCE_INVITE"]  

// Delete invites
resourceType: "INSTANCE"
actions: ["DELETE_INSTANCE_INVITE"]
```

### OWNER Role Bypass
OWNER users automatically bypass all RBAC checks and have full access to all invite management features.

## Community Auto-Join System

### Selection UI
```typescript
<FormGroup>
  {communities.map((community) => (
    <FormControlLabel
      key={community.id}
      control={
        <Checkbox
          checked={selectedCommunities.includes(community.id)}
          onChange={() => handleCommunityToggle(community.id)}
        />
      }
      label={
        <Box>
          <Typography variant="body2">{community.name}</Typography>
          {community.description && (
            <Typography variant="caption" color="text.secondary">
              {community.description}
            </Typography>
          )}
        </Box>
      }
    />
  ))}
</FormGroup>
```

### Display in Management
```typescript
{invite.defaultCommunityId.length > 0 && (
  <Box display="flex" gap={0.5} alignItems="center" flexWrap="wrap">
    <Typography variant="caption" color="text.secondary">
      Communities:
    </Typography>
    {invite.defaultCommunityId.map(id => {
      const community = communities.find(c => c.id === id);
      return (
        <Chip
          key={id}
          label={community?.name || 'Unknown'}
          size="small"
          variant="outlined"
          sx={{ 
            height: 20, 
            fontSize: '0.7rem',
            bgcolor: isDisabled ? 'transparent' : 'primary.50',
            borderColor: isDisabled ? 'error.main' : 'primary.main',
            color: isDisabled ? 'error.main' : 'primary.main',
          }}
        />
      );
    })}
  </Box>
)}
```

## Accessibility

- **ARIA Labels:** Copy buttons have descriptive tooltips
- **Keyboard Navigation:** Full tab navigation support
- **Screen Reader Support:** Status indicators use semantic color meanings
- **Form Labels:** All form inputs have proper labels and descriptions

## Performance Considerations

- **Memoization:** Filter calculations are optimized
- **Optimistic Updates:** Copy feedback is immediate
- **Efficient Re-renders:** State updates are batched where possible

## Troubleshooting

### Common Issues

1. **Permission Denied Error**
   - **Cause:** User lacks required RBAC permissions
   - **Solution:** Verify user has INSTANCE-level invite permissions or OWNER role

2. **Community Auto-Selection Not Working**
   - **Cause:** Communities not loaded when dialog opens
   - **Solution:** Check useMyCommunitiesQuery and ensure proper loading states

3. **Invite Creation Fails**
   - **Cause:** Invalid date format or missing required fields
   - **Solution:** Validate form data before submission

## Recent Changes

- **2025-09-08:** Added comprehensive community auto-join selection UI
- **2025-09-08:** Enhanced invite display with community chips
- **2025-09-08:** Added auto-selection logic for community defaults
- **2025-09-08:** Implemented advanced filtering and statistics dashboard

## Related Documentation

- [Invite API Documentation](../../api/invite.md)
- [Community API Documentation](../../api/community.md)
- [HomePage Quick Invite](../Home/HomePage.md)
- [JoinInvitePage](../Auth/JoinInvitePage.md)
- [RBAC System](../../modules/auth/roles.md)
- [Invite System Feature Overview](../../features/invite-system.md)