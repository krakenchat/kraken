# ReactionTooltip Component

## Overview

`ReactionTooltip` is a specialized tooltip component that displays the names of users who reacted to a message with a specific emoji. It fetches user profile information dynamically and shows a clean list of display names in a dark tooltip overlay, with intelligent handling of large user lists.

## Component Details

**Location**: `frontend/src/components/Message/ReactionTooltip.tsx`

**Type**: Functional Component with React hooks

**Purpose**: Show user names when hovering over message reactions with performance optimization

## Props

```typescript
interface ReactionTooltipProps {
  userIds: string[];           // Array of user IDs who reacted with this emoji
  children: React.ReactElement; // Child element that triggers the tooltip (must be ReactElement)
}
```

### Prop Details

- **`userIds`** (string[], required)
  - Array of MongoDB ObjectIds for users who reacted
  - Used to fetch individual user profile information
  - Limited to displaying first 15 users for performance

- **`children`** (React.ReactElement, required)
  - React element that acts as the tooltip trigger
  - Typically the reaction Chip component from MessageReactions
  - Must be a single ReactElement (not ReactNode array)

## Component Architecture

### Nested Component Structure

```
ReactionTooltip (main tooltip wrapper)
├── Tooltip (Material-UI base component)
│   └── Box (tooltip content container)
│       ├── UserName[] (individual user display components)
│       └── "+X more" (overflow indicator)
```

### UserName Sub-Component

```typescript
const UserName: React.FC<{ userId: string }> = ({ userId }) => {
  const { data: user, isLoading } = useGetUserByIdWithCacheQuery(userId);
  
  if (isLoading) return <Typography variant="body2" sx={{ fontSize: '12px' }}>Loading...</Typography>;
  
  const displayName = user?.displayName || user?.username || `User ${userId.slice(-4)}`;
  
  return (
    <Typography variant="body2" sx={{ fontSize: '12px' }}>
      {displayName}
    </Typography>
  );
};
```

**Key Features:**
- **Individual API Calls**: Each user fetched separately with caching
- **Loading States**: Shows "Loading..." while fetching user data
- **Fallback Names**: Graceful degradation for missing user data
- **Unique Identifier**: Uses last 4 characters of ID as final fallback

## Core Functionality

### User List Management

```typescript
const displayUserIds = useMemo(() => userIds.slice(0, 15), [userIds]);
const remainingCount = userIds.length - displayUserIds.length;
```

**Performance Optimization:**
- **Limit Display**: Only shows first 15 users to prevent UI overflow
- **Memoization**: User list memoized to prevent unnecessary re-computation
- **Overflow Handling**: Shows "+X more" for lists exceeding 15 users

### Tooltip Content Generation

```typescript
const tooltipContent = (
  <Box sx={{ maxWidth: 200 }}>
    {displayUserIds.map((userId) => (
      <UserName key={userId} userId={userId} />
    ))}
    {remainingCount > 0 && (
      <Typography variant="body2" sx={{ fontSize: '12px', fontStyle: 'italic', mt: 0.5 }}>
        +{remainingCount} more
      </Typography>
    )}
  </Box>
);
```

**Content Structure:**
- **Container**: Fixed max width for consistent tooltip sizing
- **User List**: Dynamic list of UserName components
- **Overflow Indicator**: Italic text showing additional user count
- **Responsive**: Adjusts height based on user count

## Visual Design Features

### Material-UI Tooltip Integration

```typescript
<Tooltip 
  title={tooltipContent} 
  placement="top"
  componentsProps={{
    tooltip: {
      sx: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        maxWidth: 'none'
      }
    }
  }}
>
  {children}
</Tooltip>
```

### Styling Features

#### Dark Theme Tooltip

```typescript
sx: {
  backgroundColor: 'rgba(0, 0, 0, 0.9)',  // Near-black background
  maxWidth: 'none'                        // Allow content to determine width
}
```

#### Typography Styling

```typescript
sx: { 
  fontSize: '12px'          // Consistent small text
}

// For overflow indicator
sx: { 
  fontSize: '12px', 
  fontStyle: 'italic',      // Distinguish from user names
  mt: 0.5                   // Small top margin
}
```

### User Name Display Logic

```typescript
const displayName = user?.displayName || user?.username || `User ${userId.slice(-4)}`;
```

**Fallback Hierarchy:**
1. **Display Name**: User's preferred display name (if set)
2. **Username**: User's unique username
3. **ID Suffix**: "User 1234" using last 4 characters of ID

## Performance Considerations

### Optimized Data Fetching

```typescript
// Uses cached query for each user
const { data: user, isLoading } = useGetUserByIdWithCacheQuery(userId);
```

**Benefits:**
- **RTK Query Caching**: User data cached across components
- **Deduplication**: Multiple tooltips share cached user data
- **Background Refetch**: Stale data updated automatically

### Memory Management

```typescript
// Memoized user list prevents unnecessary re-computation
const displayUserIds = useMemo(() => userIds.slice(0, 15), [userIds]);
```

**Optimization Features:**
- **Memoization**: User list only recalculated when userIds change
- **Limited Scope**: Maximum 15 API calls per tooltip
- **Lazy Loading**: User data fetched only when tooltip is hovered

### Rendering Efficiency

- **Conditional Rendering**: Overflow text only shown when needed
- **Key Props**: Proper keys for React list optimization
- **Single Responsibility**: Each UserName component handles one user

## User Experience Features

### Progressive Loading

```typescript
if (isLoading) return <Typography>Loading...</Typography>;
```

**Loading States:**
- Individual users show "Loading..." while fetching
- Other users can display immediately if cached
- Tooltip remains interactive during loading

### Graceful Degradation

```typescript
const displayName = user?.displayName || user?.username || `User ${userId.slice(-4)}`;
```

**Error Handling:**
- **Missing User Data**: Falls back to ID-based name
- **Network Errors**: RTK Query handles retry logic
- **Invalid User IDs**: Shows placeholder name

### Hover Interaction

- **Top Placement**: Tooltip appears above the reaction
- **Hover Trigger**: Shows on mouse enter, hides on mouse leave
- **No Click Required**: Pure hover interaction
- **Responsive**: Works on both desktop and touch devices

## Integration Examples

### Basic Usage with MessageReactions

```typescript
import { ReactionTooltip } from '@/components/Message/ReactionTooltip';

function SingleReactionChip({ reaction, onReactionClick }) {
  return (
    <ReactionTooltip userIds={reaction.userIds}>
      <Chip
        label={`${reaction.emoji} ${reaction.userIds.length}`}
        onClick={() => onReactionClick(reaction.emoji)}
        sx={chipStyles}
      />
    </ReactionTooltip>
  );
}
```

### Custom Trigger Element

```typescript
function CustomReactionButton({ reaction }) {
  return (
    <ReactionTooltip userIds={reaction.userIds}>
      <Button 
        variant="outlined" 
        size="small"
        onClick={() => handleReactionClick(reaction.emoji)}
      >
        {reaction.emoji} {reaction.userIds.length}
      </Button>
    </ReactionTooltip>
  );
}
```

### With Error Boundaries

```typescript
function SafeReactionTooltip({ userIds, children }) {
  return (
    <ErrorBoundary fallback={<span>Reaction info unavailable</span>}>
      <ReactionTooltip userIds={userIds}>
        {children}
      </ReactionTooltip>
    </ErrorBoundary>
  );
}
```

## Edge Cases and Error Handling

### Empty User Lists

```typescript
// Component handles empty arrays gracefully
<ReactionTooltip userIds={[]}>
  <Chip label="👍 0" />
</ReactionTooltip>
// Result: Empty tooltip content, still interactive
```

### Large User Lists

```typescript
// Automatically truncates to 15 users
const userIds = Array.from({ length: 50 }, (_, i) => `user${i}`);

<ReactionTooltip userIds={userIds}>
  <Chip label="👍 50" />
</ReactionTooltip>
// Result: Shows 15 names + "+35 more"
```

### Invalid User IDs

```typescript
// Handles non-existent users gracefully
<ReactionTooltip userIds={['invalid-id-1', 'invalid-id-2']}>
  <Chip label="👍 2" />
</ReactionTooltip>
// Result: Shows "User id-1", "User id-2" as fallbacks
```

## Testing

### Unit Testing

**Test File**: `ReactionTooltip.test.tsx`

**Test Coverage:**
- User name fetching and display
- Loading state handling
- Overflow user count display
- Tooltip positioning and styling
- Error handling for invalid user IDs

**Example Tests:**
```typescript
describe('ReactionTooltip', () => {
  it('displays user names in tooltip', async () => {
    const mockUsers = [
      { id: 'user1', displayName: 'Alice', username: 'alice' },
      { id: 'user2', displayName: 'Bob', username: 'bob' }
    ];
    
    mockUsers.forEach(user => {
      jest.mocked(useGetUserByIdWithCacheQuery).mockReturnValueOnce({
        data: user,
        isLoading: false
      });
    });
    
    render(
      <ReactionTooltip userIds={['user1', 'user2']}>
        <div>Trigger</div>
      </ReactionTooltip>
    );
    
    // Hover to trigger tooltip
    fireEvent.mouseEnter(screen.getByText('Trigger'));
    
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching users', () => {
    jest.mocked(useGetUserByIdWithCacheQuery).mockReturnValue({
      data: null,
      isLoading: true
    });
    
    render(
      <ReactionTooltip userIds={['user1']}>
        <div>Trigger</div>
      </ReactionTooltip>
    );
    
    fireEvent.mouseEnter(screen.getByText('Trigger'));
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('truncates user list to 15 users with overflow indicator', () => {
    const userIds = Array.from({ length: 20 }, (_, i) => `user${i}`);
    
    render(
      <ReactionTooltip userIds={userIds}>
        <div>Trigger</div>
      </ReactionTooltip>
    );
    
    // Should only render 15 UserName components + overflow
    expect(screen.getAllByText(/User \d{4}/)).toHaveLength(15);
    expect(screen.getByText('+5 more')).toBeInTheDocument();
  });
});
```

### Integration Testing

- **Real User Data**: Test with actual user profiles
- **Cache Behavior**: Verify user data caching across tooltips
- **Network Errors**: Test behavior when user fetch fails

## Related Components

### Direct Dependencies

- **`useGetUserByIdWithCacheQuery`**: Fetches individual user profile data
- **Material-UI Tooltip**: Base tooltip component
- **Material-UI Box**: Content container
- **Material-UI Typography**: Text display

### Parent Components

- **`MessageReactions`**: Primary consumer of ReactionTooltip
- **`SingleReactionChip`**: Direct wrapper that provides userIds

### Related User Components

- **`UserProfile`**: May share user data cache
- **`MemberList`**: Similar user display patterns
- **`UserMention`**: Similar name display logic

---

## Design Considerations

### Accessibility

- **ARIA Labels**: Material-UI Tooltip provides built-in ARIA support
- **Keyboard Navigation**: Tooltip accessible via focus events
- **Screen Readers**: User names announced properly
- **High Contrast**: Dark tooltip works with accessibility themes

### Mobile Experience

- **Touch Support**: Tooltip works with touch devices
- **Size Optimization**: Small font size appropriate for mobile
- **Performance**: Limited user list prevents mobile performance issues

This component provides essential context for message reactions while maintaining excellent performance characteristics and a clean, Discord-like user experience.

<function_calls>
<invoke name="Read">
<parameter name="file_path">/home/mike/projects/kraken/frontend/src/components/Message/ReactionTooltip.tsx