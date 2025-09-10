# DirectMessageList Component

## Overview

`DirectMessageList` is the primary navigation component for direct messages, displaying a list of all user's DM conversations with the ability to create new direct messages or group chats. It provides an interface similar to Discord's DM list with conversation previews, timestamps, and intelligent display naming.

## Component Details

**Location**: `frontend/src/components/DirectMessages/DirectMessageList.tsx`

**Type**: Functional Component with React hooks

**Purpose**: Display and manage the user's direct message conversations with creation capabilities

## Props

```typescript
interface DirectMessageListProps {
  selectedDmGroupId?: string;                    // Currently selected DM group ID
  onSelectDmGroup: (dmGroupId: string) => void; // Callback when DM is selected
  showCreateDialog: boolean;                     // Controls create DM dialog visibility
  setShowCreateDialog: (show: boolean) => void; // Toggle create dialog
}
```

### Prop Details

- **`selectedDmGroupId`** (string, optional)
  - ID of the currently active DM conversation
  - Used to highlight the selected conversation in the list
  - Updates UI selection state

- **`onSelectDmGroup`** (function, required)
  - Callback invoked when user clicks on a DM conversation
  - Receives the `dmGroupId` as parameter
  - Typically used to navigate to the conversation view

- **`showCreateDialog`** (boolean, required)
  - Controls visibility of the create DM/group dialog
  - Managed by parent component for dialog state

- **`setShowCreateDialog`** (function, required)
  - Function to toggle the create dialog visibility
  - Called when dialog is opened/closed

## State Management

### RTK Query Integration

```typescript
// Fetch user's DM groups with last message previews
const { data: dmGroups = [], isLoading } = useGetUserDmGroupsQuery();

// Get all users for DM creation (with pagination)
const { data: usersData } = useGetAllUsersQuery({ limit: 100 });

// Current user profile for filtering and display
const { data: currentUser } = useProfileQuery();

// DM group creation mutation
const [createDmGroup, { isLoading: isCreating }] = useCreateDmGroupMutation();
```

### Local State

```typescript
// Selected users for new DM creation
const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

// Group name for multi-user DMs
const [groupName, setGroupName] = useState("");
```

## Core Functionality

### DM Group Display Logic

#### Display Name Resolution

```typescript
const getDmDisplayName = (dmGroup: DirectMessageGroup): string => {
  if (dmGroup.name) return dmGroup.name;
  
  // For 1:1 DMs, show the other user's display name
  if (!dmGroup.isGroup && dmGroup.members.length === 2) {
    const otherMember = dmGroup.members.find(m => m.user.id !== currentUser?.id);
    return otherMember?.user.displayName || otherMember?.user.username || "Unknown User";
  }
  
  // For group DMs without a name, show member list (excluding current user)
  return dmGroup.members
    .filter(m => m.user.id !== currentUser?.id)
    .map(m => m.user.displayName || m.user.username)
    .join(", ");
};
```

**Logic:**
1. **Named Groups**: Use explicit group name if provided
2. **1:1 Conversations**: Show other participant's name
3. **Unnamed Groups**: Show comma-separated list of participants

#### Avatar Resolution

```typescript
const getDmAvatar = (dmGroup: DirectMessageGroup) => {
  if (!dmGroup.isGroup && dmGroup.members.length === 2) {
    const otherMember = dmGroup.members.find(m => m.user.id !== currentUser?.id);
    return otherMember?.user.avatarUrl;
  }
  return null; // Group DMs use default group icon
};
```

**Avatar Display Logic:**
- **1:1 DMs**: Show other participant's avatar
- **Group DMs**: Use default group icon (GroupIcon)
- **No Avatar**: Fallback to PersonIcon or GroupIcon

### Message Preview System

#### Last Message Display

```typescript
// Extract text from spans for preview
{dmGroup.lastMessage.spans.find(s => s.type === "PLAINTEXT")?.text || "Message"}
```

**Features:**
- Shows plain text content from message spans
- Graceful fallback to "Message" for complex messages
- Truncated with ellipsis for long messages

#### Timestamp Formatting

```typescript
const formatLastMessageTime = (date: Date) => {
  const now = new Date();
  const messageDate = new Date(date);
  const diffMs = now.getTime() - messageDate.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d ago`;
  } else if (diffHours > 0) {
    return `${diffHours}h ago`;
  } else {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return diffMinutes > 0 ? `${diffMinutes}m ago` : "Just now";
  }
};
```

**Time Display:**
- **Recent**: "Just now" for < 1 minute
- **Minutes**: "5m ago" for < 1 hour  
- **Hours**: "3h ago" for < 1 day
- **Days**: "2d ago" for older messages

### DM Creation System

#### User Selection Interface

```typescript
<Autocomplete
  multiple
  options={users}
  getOptionLabel={(user) => user.displayName || user.username}
  value={selectedUsers}
  onChange={(_, newValue) => setSelectedUsers(newValue)}
  renderTags={(tagValue, getTagProps) =>
    tagValue.map((user, index) => (
      <Chip
        key={user.id}
        label={user.displayName || user.username}
        {...getTagProps({ index })}
        avatar={<Avatar src={user.avatarUrl || undefined} />}
      />
    ))
  }
/>
```

**Features:**
- **Multi-select**: Choose multiple users for group DMs
- **Search**: Type-to-search user filtering
- **Visual Tags**: Selected users shown as chips with avatars
- **Smart Labeling**: Uses display name with username fallback

#### DM Creation Logic

```typescript
const handleCreateDM = async () => {
  if (selectedUsers.length === 0) return;

  try {
    const isGroup = selectedUsers.length > 1;
    const result = await createDmGroup({
      userIds: selectedUsers.map(u => u.id),
      name: isGroup ? groupName || undefined : undefined,
      isGroup,
    }).unwrap();

    // Navigate to new DM
    onSelectDmGroup(result.id);
    
    // Reset form and close dialog
    setShowCreateDialog(false);
    setSelectedUsers([]);
    setGroupName("");
  } catch (error) {
    console.error("Failed to create DM group:", error);
  }
};
```

**Creation Flow:**
1. **Validation**: Ensure at least one user selected
2. **Type Detection**: Automatically determine if group DM
3. **API Call**: Create DM group via RTK mutation
4. **Navigation**: Switch to newly created conversation
5. **Cleanup**: Reset form state and close dialog

## UI/UX Features

### Visual Design

#### Conversation List Items

```typescript
<ListItem
  component="button"
  selected={selectedDmGroupId === dmGroup.id}
  onClick={() => onSelectDmGroup(dmGroup.id)}
  sx={{
    borderRadius: 1,
    margin: "4px 0",
    padding: "8px 16px",
    cursor: "pointer",
    minWidth: 0,
    "&.Mui-selected": {
      backgroundColor: "action.selected",
    },
  }}
>
```

**Design Features:**
- **Selection State**: Visual highlight for active conversation
- **Hover Effects**: Interactive button styling
- **Spacing**: Consistent margins and padding
- **Responsive**: Handles text overflow gracefully

#### Avatar System

```typescript
<Avatar
  src={getDmAvatar(dmGroup) || undefined}
  sx={{ bgcolor: dmGroup.isGroup ? "secondary.main" : "primary.main" }}
>
  {getDmAvatar(dmGroup) ? null : dmGroup.isGroup ? (
    <GroupIcon />
  ) : (
    <PersonIcon />
  )}
</Avatar>
```

**Avatar Features:**
- **User Photos**: Show participant avatars for 1:1 DMs
- **Icon Fallbacks**: Group/Person icons when no photo
- **Color Coding**: Different colors for group vs. individual DMs
- **Consistent Sizing**: Uniform avatar dimensions

### Loading and Empty States

#### Loading State

```typescript
if (isLoading) {
  return (
    <Box sx={{ p: 2, textAlign: "center" }}>
      <CircularProgress />
    </Box>
  );
}
```

#### Empty State

```typescript
{dmGroups.length === 0 && (
  <Box sx={{ p: 3, textAlign: "center" }}>
    <Typography color="text.secondary">
      No direct messages yet. Start a conversation!
    </Typography>
  </Box>
)}
```

**UX Considerations:**
- **Loading**: Clear loading indicator during data fetch
- **Empty State**: Encouraging message when no DMs exist
- **Error Handling**: RTK Query handles network errors

## Advanced Features

### Smart Grouping and Sorting

- **Automatic Ordering**: DMs ordered by last message timestamp
- **Recent First**: Most active conversations at the top
- **Persistent Selection**: Maintains selection across renders

### Text Overflow Handling

```typescript
<Box 
  component="span" 
  sx={{ 
    flex: 1, 
    overflow: "hidden", 
    textOverflow: "ellipsis", 
    whiteSpace: "nowrap",
    minWidth: 0
  }}
>
  {/* Message preview */}
</Box>
```

**Responsive Text:**
- **Ellipsis Truncation**: Long messages cut off gracefully
- **Flex Layout**: Time stamp always visible
- **Min Width**: Prevents layout collapse

### Group DM Management

#### Conditional Group Name Input

```typescript
{selectedUsers.length > 1 && (
  <TextField
    fullWidth
    label="Group name (optional)"
    value={groupName}
    onChange={(e) => setGroupName(e.target.value)}
    placeholder="Enter a name for your group..."
  />
)}
```

**Group Features:**
- **Conditional Display**: Only show group name field for multi-user selection
- **Optional Naming**: Groups can be unnamed (auto-generated names)
- **Smart Detection**: Automatically determine group vs. individual DM

## Error Handling

### API Error Management

```typescript
// RTK Query handles most errors automatically
const { data: dmGroups = [], isLoading, error } = useGetUserDmGroupsQuery();

// Creation error handling
const [createDmGroup, { isLoading: isCreating, error: createError }] = useCreateDmGroupMutation();
```

**Error Scenarios:**
- **Network Failures**: RTK Query retry logic
- **Invalid Users**: Server validation errors
- **Permissions**: User not allowed to create DMs
- **Duplicates**: Creating DM with existing conversation

### Graceful Degradation

- **Missing Data**: Fallback to default values
- **Avatar Failures**: Icon fallbacks for missing images
- **Name Resolution**: Multiple fallback strategies for display names

## Performance Optimizations

### Efficient Rendering

```typescript
// Memoized display name calculation (if needed)
const displayName = useMemo(() => getDmDisplayName(dmGroup), [dmGroup, currentUser]);

// Efficient filtering for user search
const users = usersData?.users || [];
```

**Optimizations:**
- **Data Normalization**: RTK Query handles caching
- **Selective Updates**: Only re-render changed conversations
- **Lazy Loading**: Could implement virtualization for large lists

### Memory Management

- **Query Cleanup**: RTK Query manages cache lifecycle
- **State Reset**: Form state cleaned after dialog close
- **Event Cleanup**: No manual event listeners to clean

## Usage Examples

### Basic Integration

```typescript
import DirectMessageList from '@/components/DirectMessages/DirectMessageList';

function DirectMessagesPage() {
  const [selectedDmGroupId, setSelectedDmGroupId] = useState<string>();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="dm-page">
      <aside className="dm-sidebar">
        <header>
          <h2>Direct Messages</h2>
          <button onClick={() => setShowCreateDialog(true)}>
            + New Message
          </button>
        </header>
        
        <DirectMessageList
          selectedDmGroupId={selectedDmGroupId}
          onSelectDmGroup={setSelectedDmGroupId}
          showCreateDialog={showCreateDialog}
          setShowCreateDialog={setShowCreateDialog}
        />
      </aside>
      
      <main className="dm-content">
        {selectedDmGroupId ? (
          <DirectMessageContainer dmGroupId={selectedDmGroupId} />
        ) : (
          <div>Select a conversation to start messaging</div>
        )}
      </main>
    </div>
  );
}
```

### With Navigation Integration

```typescript
import { useParams, useNavigate } from 'react-router-dom';

function DMPageWithRouting() {
  const { dmGroupId } = useParams();
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleSelectDmGroup = (newDmGroupId: string) => {
    navigate(`/messages/${newDmGroupId}`);
  };

  return (
    <DirectMessageList
      selectedDmGroupId={dmGroupId}
      onSelectDmGroup={handleSelectDmGroup}
      showCreateDialog={showCreateDialog}
      setShowCreateDialog={setShowCreateDialog}
    />
  );
}
```

### With Keyboard Navigation

```typescript
function EnhancedDMList() {
  const [selectedDmGroupId, setSelectedDmGroupId] = useState<string>();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'n' && event.ctrlKey) {
      event.preventDefault();
      setShowCreateDialog(true);
    }
  };

  return (
    <div onKeyDown={handleKeyPress}>
      <DirectMessageList
        selectedDmGroupId={selectedDmGroupId}
        onSelectDmGroup={setSelectedDmGroupId}
        showCreateDialog={showCreateDialog}
        setShowCreateDialog={setShowCreateDialog}
      />
    </div>
  );
}
```

## Testing

### Unit Testing

**Test File**: `DirectMessageList.test.tsx`

**Test Coverage:**
- DM group display logic
- Display name resolution
- Avatar resolution
- Message preview formatting
- Time stamp formatting
- Dialog interaction flow

**Example Tests:**
```typescript
describe('DirectMessageList', () => {
  it('displays 1:1 DM with other user name', () => {
    const mockDmGroup = {
      id: '1',
      name: null,
      isGroup: false,
      members: [
        { user: { id: 'current', username: 'me' } },
        { user: { id: 'other', username: 'friend', displayName: 'Best Friend' } }
      ]
    };
    
    const displayName = getDmDisplayName(mockDmGroup);
    expect(displayName).toBe('Best Friend');
  });

  it('shows group name for named groups', () => {
    const mockDmGroup = {
      id: '1',
      name: 'Team Chat',
      isGroup: true,
      members: [/* multiple members */]
    };
    
    const displayName = getDmDisplayName(mockDmGroup);
    expect(displayName).toBe('Team Chat');
  });
});
```

### Integration Testing

- **DM Creation Flow**: Full user selection to conversation creation
- **Real-time Updates**: New DMs appear in list immediately
- **Selection Persistence**: Selected conversation maintains across renders

## Related Components

### Direct Dependencies

- **`useGetUserDmGroupsQuery`**: Fetches user's DM conversations
- **`useCreateDmGroupMutation`**: Creates new DM groups
- **`useGetAllUsersQuery`**: User search for DM creation
- **`useProfileQuery`**: Current user information

### Related DM Components

- **`DirectMessageContainer`**: Main conversation view
- **`DirectMessageInput`**: Message composition (if DM-specific)

### Shared Components

- **Material-UI Components**: List, Avatar, Dialog, Autocomplete, etc.
- **Icons**: GroupIcon, PersonIcon for visual indicators

---

## Integration Notes

### State Management Integration

The component integrates seamlessly with RTK Query for:
- **Automatic Caching**: DM groups cached and updated automatically
- **Real-time Updates**: WebSocket events update the cache
- **Error Handling**: Network errors handled by RTK Query
- **Loading States**: Built-in loading state management

### Design System Compliance

- **Material-UI Theme**: Uses theme colors and spacing
- **Consistent Styling**: Matches other Kraken components
- **Responsive Design**: Adapts to different screen sizes
- **Accessibility**: Proper ARIA labels and keyboard navigation

This component provides a complete direct messaging navigation experience, handling both simple 1:1 conversations and complex group DMs with an intuitive creation flow.