# MemberList Component

## Overview

`MemberList` is a reusable component that displays a list of members with their avatars, usernames, display names, and online status indicators. It provides a Discord-style member sidebar with consistent styling, loading states, and error handling for both channel members and direct message participants.

## Component Details

**Location**: `frontend/src/components/Message/MemberList.tsx`

**Type**: Functional Component with TypeScript

**Purpose**: Display member lists with online status, avatars, and responsive design

## Props

```typescript
interface MemberListProps {
  members: MemberData[];        // Array of member data to display
  isLoading?: boolean;          // Loading state indicator
  error?: unknown;              // Error state for failed member fetching
  title?: string;               // Header title (default: "Members")
  maxHeight?: number | string;  // Maximum height for scrollable area
}

interface MemberData {
  id: string;                   // Unique member identifier
  username: string;             // User's username
  displayName?: string | null;  // User's display name (optional)
  avatarUrl?: string | null;    // User's avatar image URL
  isOnline?: boolean;           // Online status indicator
}
```

### Prop Details

- **`members`** (MemberData[], required)
  - Array of member objects containing user information
  - Each member must have id and username at minimum
  - Display names and avatars are optional
  - Online status used for presence indicators

- **`isLoading`** (boolean, optional, default: false)
  - Shows skeleton loading state while member data is being fetched
  - Displays placeholder skeleton items instead of actual members
  - Automatically handled by parent components using RTK Query

- **`error`** (unknown, optional, default: null)
  - Error state from failed API calls
  - Shows error alert when member data cannot be loaded
  - Typically comes from RTK Query error responses

- **`title`** (string, optional, default: "Members")
  - Header text displayed at top of member list
  - Can be customized for different contexts (e.g., "Online Members", "Channel Members")
  - Shows member count alongside title

- **`maxHeight`** (number | string, optional, default: 400)
  - Maximum height of the scrollable member list area
  - Can be number (pixels) or string ("100vh", "50%", etc.)
  - Enables vertical scrolling for large member lists

## Visual Design

### Layout Structure

```typescript
<Box
  sx={{
    width: 240,                    // Fixed sidebar width
    height: "100%",                // Full height container
    borderLeft: 1,                 // Left border separator
    borderColor: "divider",        // Theme-aware border color
    backgroundColor: "background.paper",  // Background color
    display: "flex",
    flexDirection: "column",
  }}
>
  {/* Header */}
  <Box sx={{ p: 2, pb: 1 }}>
    <Typography variant="h6" sx={{ fontSize: "14px", fontWeight: 600 }}>
      {title} — {isLoading ? "..." : members.length}
    </Typography>
  </Box>
  <Divider />

  {/* Scrollable Member List */}
  <Box sx={{ flex: 1, overflowY: "auto", maxHeight: maxHeight }}>
    {/* Member items or loading/error states */}
  </Box>
</Box>
```

### Member List Item Structure

```typescript
<ListItem
  sx={{
    px: 2,                         // Horizontal padding
    py: 0.5,                      // Vertical padding (compact)
    "&:hover": {
      backgroundColor: alpha("#000", 0.02),  // Subtle hover effect
    },
  }}
>
  <ListItemAvatar sx={{ minWidth: 40 }}>
    <Box sx={{ position: "relative", display: "inline-block" }}>
      <Avatar src={member.avatarUrl || ""} sx={{ width: 32, height: 32 }}>
        {member.username.charAt(0).toUpperCase()}
      </Avatar>
      <UserStatusIndicator isOnline={member.isOnline} />
    </Box>
  </ListItemAvatar>
  
  <ListItemText
    primary={
      <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "14px" }}>
        {member.username}
      </Typography>
    }
    secondary={
      member.displayName && (
        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "12px" }}>
          {member.displayName}
        </Typography>
      )
    }
  />
</ListItem>
```

## Loading States

### Loading Skeleton Component

```typescript
const MemberListSkeleton: React.FC = () => (
  <ListItem sx={{ px: 1, py: 0.5 }}>
    <ListItemAvatar sx={{ minWidth: 40 }}>
      <Skeleton variant="circular" width={32} height={32} />
    </ListItemAvatar>
    <ListItemText
      primary={<Skeleton variant="text" width="60%" />}
      secondary={<Skeleton variant="text" width="40%" />}
    />
  </ListItem>
);
```

**Loading Features:**
- **Skeleton Placeholders**: Material-UI skeleton components
- **Realistic Layout**: Matches actual member item structure
- **Multiple Items**: Shows 6 skeleton items during loading
- **Smooth Animation**: Built-in skeleton wave animation

### Loading State Implementation

```typescript
{isLoading
  ? Array.from({ length: 6 }).map((_, index) => (
      <MemberListSkeleton key={index} />
    ))
  : members.map((member) => (
      <MemberListItem key={member.id} member={member} />
    ))}
```

## Error Handling

### Error Display

```typescript
if (error) {
  return (
    <Box sx={{ width: 240, p: 2 }}>
      <Alert severity="error" size="small">
        Failed to load members
      </Alert>
    </Box>
  );
}
```

**Error Features:**
- **Early Return**: Error state takes precedence over normal rendering
- **Consistent Width**: Maintains 240px width for layout stability
- **User-Friendly Message**: Simple, clear error message
- **Material-UI Alert**: Consistent error styling

## Online Status Integration

### UserStatusIndicator Integration

```typescript
<UserStatusIndicator isOnline={member.isOnline} />
```

**Status Features:**
- **Visual Indicator**: Green dot for online, gray for offline
- **Positioned**: Absolute positioning over avatar
- **Conditional**: Only shows when status data is available
- **Theme-Aware**: Uses theme colors for consistency

### Avatar and Status Layout

```typescript
<Box sx={{ position: "relative", display: "inline-block" }}>
  <Avatar src={member.avatarUrl || ""} sx={{ width: 32, height: 32 }}>
    {member.username.charAt(0).toUpperCase()}
  </Avatar>
  <UserStatusIndicator isOnline={member.isOnline} />
</Box>
```

**Layout Features:**
- **Relative Container**: Positions status indicator relative to avatar
- **Avatar Fallback**: Shows first letter of username when no image
- **Status Overlay**: Online indicator positioned in bottom-right

## Empty State

### No Members Display

```typescript
{!isLoading && members.length === 0 && (
  <Box
    sx={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      py: 4,
    }}
  >
    <Typography variant="body2" color="text.secondary">
      No members
    </Typography>
  </Box>
)}
```

**Empty State Features:**
- **Conditional Rendering**: Only shows when not loading and no members
- **Centered Text**: Vertically and horizontally centered message
- **Consistent Styling**: Uses theme-aware text colors
- **Appropriate Spacing**: Adequate padding for visual balance

## Scrolling and Performance

### Custom Scrollbar Styling

```typescript
sx={{
  flex: 1,
  overflowY: "auto",
  maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
  "&::-webkit-scrollbar": {
    width: 8,
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: alpha("#000", 0.2),
    borderRadius: 4,
  },
}}
```

**Scrolling Features:**
- **Flexible Height**: Uses flex to fill available space
- **Max Height Control**: Respects maxHeight prop for container limits
- **Custom Scrollbar**: Webkit scrollbar styling for better appearance
- **Smooth Scrolling**: Native scroll behavior with styled scrollbar

## Usage Examples

### Basic Usage in Channel Context

```typescript
import MemberList from '@/components/Message/MemberList';

function ChannelSidebar({ channelId }: { channelId: string }) {
  const { data: membersData, isLoading, error } = useGetChannelMembersQuery(channelId);
  const members = membersData?.members || [];

  return (
    <MemberList
      members={members}
      isLoading={isLoading}
      error={error}
      title="Channel Members"
      maxHeight="calc(100vh - 200px)"
    />
  );
}
```

### Usage in Direct Message Context

```typescript
function DMSidebar({ dmGroupId }: { dmGroupId: string }) {
  const { data: dmGroup, isLoading, error } = useGetDmGroupQuery(dmGroupId);
  
  const members = React.useMemo(() => {
    return dmGroup?.members?.map(member => ({
      id: member.id,
      username: member.user.username,
      displayName: member.user.displayName,
      avatarUrl: member.user.avatarUrl,
      isOnline: member.user.isOnline,
    })) || [];
  }, [dmGroup?.members]);

  return (
    <MemberList
      members={members}
      isLoading={isLoading}
      error={error}
      title="Participants"
      maxHeight={300}
    />
  );
}
```

### Custom Member Display

```typescript
function CustomMemberList() {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'online'>('all');
  const { data: allMembers, isLoading, error } = useGetMembersQuery();
  
  const filteredMembers = React.useMemo(() => {
    if (!allMembers) return [];
    if (selectedFilter === 'online') {
      return allMembers.filter(member => member.isOnline);
    }
    return allMembers;
  }, [allMembers, selectedFilter]);

  return (
    <div>
      <div className="filter-controls">
        <button 
          onClick={() => setSelectedFilter('all')}
          className={selectedFilter === 'all' ? 'active' : ''}
        >
          All ({allMembers?.length || 0})
        </button>
        <button 
          onClick={() => setSelectedFilter('online')}
          className={selectedFilter === 'online' ? 'active' : ''}
        >
          Online ({allMembers?.filter(m => m.isOnline).length || 0})
        </button>
      </div>
      
      <MemberList
        members={filteredMembers}
        isLoading={isLoading}
        error={error}
        title={selectedFilter === 'online' ? 'Online Members' : 'All Members'}
      />
    </div>
  );
}
```

## Integration with Container Components

### MemberListContainer Integration

The `MemberList` component is typically used within `MemberListContainer` which provides context-specific data fetching:

```typescript
// In MemberListContainer
function MemberListContainer({ contextType, contextId }) {
  let membersQuery;
  
  if (contextType === 'channel') {
    membersQuery = useGetChannelMembersQuery(contextId);
  } else if (contextType === 'dm') {
    membersQuery = useGetDmGroupQuery(contextId);
  }
  
  return (
    <MemberList
      members={transformedMembers}
      isLoading={membersQuery.isLoading}
      error={membersQuery.error}
      title={contextType === 'dm' ? 'Participants' : 'Members'}
    />
  );
}
```

## Testing

### Unit Testing

**Test File**: `MemberList.test.tsx`

**Test Coverage:**
- Member list rendering with various member counts
- Loading state with skeleton placeholders
- Error state display
- Empty state handling
- Online status indicator display
- Scrolling behavior with large member lists

**Example Tests:**
```typescript
describe('MemberList', () => {
  it('renders members with usernames and avatars', () => {
    const members = [
      {
        id: '1',
        username: 'alice',
        displayName: 'Alice Smith',
        avatarUrl: '/avatars/alice.jpg',
        isOnline: true
      },
      {
        id: '2', 
        username: 'bob',
        displayName: null,
        avatarUrl: null,
        isOnline: false
      }
    ];

    render(<MemberList members={members} />);

    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('Members — 2')).toBeInTheDocument();
  });

  it('shows loading skeletons when loading', () => {
    render(<MemberList members={[]} isLoading={true} />);

    expect(screen.getAllByTestId('skeleton')).toHaveLength(6);
    expect(screen.getByText('Members — ...')).toBeInTheDocument();
  });

  it('displays error alert on error', () => {
    render(<MemberList members={[]} error={new Error('Failed to load')} />);

    expect(screen.getByText('Failed to load members')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows empty state when no members', () => {
    render(<MemberList members={[]} />);

    expect(screen.getByText('No members')).toBeInTheDocument();
    expect(screen.getByText('Members — 0')).toBeInTheDocument();
  });
});
```

### Integration Testing

- **Real Data Testing**: Test with actual member data from API
- **Presence Updates**: Test online status changes in real-time
- **Scrolling Performance**: Test with large member lists (100+ members)
- **Context Switching**: Test switching between different channels/DMs

## Related Components

### Direct Dependencies

- **`UserStatusIndicator`**: Online status indicator component
- **Material-UI Components**: List, ListItem, Avatar, Typography, Skeleton, Alert
- **Material-UI Box**: Layout container
- **Material-UI alpha**: Color utility for hover effects

### Parent Components

- **`MemberListContainer`**: Context-aware wrapper that provides member data
- **`MessageContainerWrapper`**: Integrates member list as sidebar
- **`DirectMessageContainer`**: Uses member list for DM participants
- **`ChannelMessageContainer`**: Uses member list for channel members

### Related Components

- **`PresenceIndicator`**: Similar online status functionality
- **`UserProfile`**: May share avatar and name display patterns
- **`UserMention`**: Similar user identification patterns

---

## Accessibility Features

### Screen Reader Support

- **Semantic HTML**: Uses proper list semantics with Material-UI List components
- **Alt Text**: Avatar images include proper alt text from usernames
- **ARIA Labels**: Member count and status information accessible
- **Focus Management**: Keyboard navigation through member list

### Keyboard Navigation

- **Tab Order**: Natural tab progression through interactive elements
- **Focus Indicators**: Visual focus states for keyboard users
- **Screen Reader Announcements**: Status changes announced appropriately

## Performance Considerations

### Virtualization for Large Lists

For very large member lists (100+ members), consider implementing virtualization:

```typescript
import { FixedSizeList as List } from 'react-window';

function VirtualizedMemberList({ members }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      <MemberListItem member={members[index]} />
    </div>
  );

  return (
    <List
      height={400}
      itemCount={members.length}
      itemSize={48}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

### Memory Optimization

- **Memoization**: Component can be wrapped with React.memo for prop-based memoization
- **Image Lazy Loading**: Avatar images loaded only when in viewport
- **Status Throttling**: Online status updates can be throttled to prevent excessive re-renders

This component provides a solid foundation for member display across different contexts in Kraken, with consistent styling, robust error handling, and excellent performance characteristics.