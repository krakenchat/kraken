# UserAvatar

> **Location:** `frontend/src/components/Common/UserAvatar.tsx`
> **Type:** UI Component (Unified Avatar Display)
> **Feature:** common

## Overview

`UserAvatar` is a unified component for displaying user avatars throughout the application. It handles authenticated image loading with caching, loading states with Material-UI Skeleton, optional presence indicators, and multiple size variants. This component replaced multiple duplicate avatar implementations to eliminate code repetition and ensure consistent avatar rendering across channels, messages, member lists, and member management.

**Key Features:**
- **Authenticated Image Loading**: Fetches avatars via `useAuthenticatedImage` with automatic caching
- **Loading States**: Shows Material-UI Skeleton while image loads
- **Fallback Initials**: Displays first letter of display name or username when no avatar
- **Size Variants**: Four predefined sizes (small, medium, large, xlarge)
- **Presence Indicator**: Optional online/offline status badge
- **Performance Optimized**: Single fetch per unique avatar with FileCacheContext deduplication

## Props Interface

```typescript
type AvatarSize = "small" | "medium" | "large" | "xlarge";

interface UserAvatarProps {
  // User data
  user?: {
    avatarUrl?: string | null;
    username?: string;
    displayName?: string | null;
  } | null;

  // Display options
  size?: AvatarSize;         // Default: "medium"
  showStatus?: boolean;      // Default: false
  isOnline?: boolean;        // Default: false (only used if showStatus=true)
}
```

**Props Details:**

- **`user`** - User object containing avatar URL and name information
  - `avatarUrl`: File ID for the user's avatar (fetched via authenticated endpoint)
  - `username`: User's unique username (used for fallback initial if no displayName)
  - `displayName`: User's display name (preferred for fallback initial)

- **`size`** - Avatar size variant
  - `"small"`: 32px (used in message lists, compact views)
  - `"medium"`: 40px (default, used in member lists)
  - `"large"`: 48px (used in member management)
  - `"xlarge"`: 120px (used in profile pages)

- **`showStatus`** - Whether to show presence indicator badge
  - When `true`, renders `UserStatusIndicator` component over avatar

- **`isOnline`** - Online/offline status for presence indicator
  - Only relevant when `showStatus={true}`

## Size Mapping

```typescript
const sizeMap: Record<AvatarSize, number> = {
  small: 32,    // Compact lists, inline displays
  medium: 40,   // Default size, member lists
  large: 48,    // Emphasized displays, management interfaces
  xlarge: 120,  // Profile pages, large avatar displays
};
```

## Usage Examples

### Basic Usage - Simple Avatar

```tsx
import UserAvatar from '@/components/Common/UserAvatar';

function MessageAuthor({ message }) {
  return (
    <div>
      <UserAvatar user={message.author} size="small" />
      <span>{message.author.displayName}</span>
    </div>
  );
}
```

### With Online Status Indicator

```tsx
import UserAvatar from '@/components/Common/UserAvatar';

function MemberListItem({ member, presenceStatus }) {
  const isOnline = presenceStatus?.status === "ONLINE";

  return (
    <div className="member-item">
      <UserAvatar
        user={member}
        size="medium"
        showStatus={true}
        isOnline={isOnline}
      />
      <div>
        <div>{member.displayName || member.username}</div>
        <div>{isOnline ? "Online" : "Offline"}</div>
      </div>
    </div>
  );
}
```

### Large Avatar for Profile

```tsx
import UserAvatar from '@/components/Common/UserAvatar';

function ProfileHeader({ user }) {
  return (
    <div className="profile-header">
      <UserAvatar user={user} size="xlarge" />
      <h1>{user.displayName || user.username}</h1>
      <p>@{user.username}</p>
    </div>
  );
}
```

### Advanced Usage - Integration with RTK Query

```tsx
import UserAvatar from '@/components/Common/UserAvatar';
import { useGetUserByIdQuery } from '@/features/users/usersSlice';

function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading } = useGetUserByIdQuery(userId);

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div>
      <UserAvatar user={user} size="large" />
      <h2>{user.displayName || user.username}</h2>
    </div>
  );
}
```

### Channel Messages with Avatars

```tsx
import UserAvatar from '@/components/Common/UserAvatar';
import { useGetMessagesQuery } from '@/features/messages/messagesApi';

function MessageList({ channelId }: { channelId: string }) {
  const { data: messages = [] } = useGetMessagesQuery(channelId);

  return (
    <div>
      {messages.map((message) => (
        <div key={message.id} className="message">
          <UserAvatar user={message.author} size="small" />
          <div className="message-content">
            <div className="author">{message.author.displayName}</div>
            <div className="text">{message.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Styling & Theming

- **Material-UI Components Used:**
  - `Avatar` - Main avatar display with src, sx props
  - `Skeleton` - Loading state placeholder
  - `Box` - Container for avatar + status indicator

- **Custom Styles:**
  - Size-based width/height via sx prop
  - Circular variant for avatars
  - Position relative for status indicator overlay

**Style Implementation:**

```tsx
// Avatar sizing
<Avatar
  src={blobUrl || undefined}
  sx={{ width: avatarSize, height: avatarSize }}
>
  {getInitials()}
</Avatar>

// Loading skeleton
<Skeleton
  variant="circular"
  width={avatarSize}
  height={avatarSize}
/>

// Status indicator container
<Box sx={{ position: "relative", display: "inline-block" }}>
  {avatar}
  <UserStatusIndicator isOnline={isOnline} />
</Box>
```

## State Management

- **Local State:** None
- **Props-driven:** All display logic based on props
- **External State:**
  - Avatar blob URL from `useAuthenticatedImage` hook
  - Loading state from `useAuthenticatedImage`

## Component Logic Flow

1. **Avatar Size Calculation**
   ```tsx
   const avatarSize = sizeMap[size]; // e.g., 40 for "medium"
   ```

2. **Authenticated Image Loading**
   ```tsx
   const { blobUrl, isLoading } = useAuthenticatedImage(user?.avatarUrl);
   ```
   - If `user?.avatarUrl` is null/undefined, returns `{ blobUrl: null, isLoading: false }`
   - If file ID provided, fetches from `/api/file/:fileId` with JWT auth
   - Returns cached blob URL if already fetched (via FileCacheContext)

3. **Initial Generation**
   ```tsx
   const getInitials = () => {
     if (!user) return "?";
     const name = user.displayName || user.username;
     if (!name) return "?";
     return name.charAt(0).toUpperCase();
   };
   ```

4. **Rendering Logic**
   - **Loading**: Show circular Skeleton
   - **Loaded**: Show Avatar with blobUrl (or initials if no image)
   - **With Status**: Wrap in Box with UserStatusIndicator

## Dependencies

### Internal Dependencies
- `@/hooks/useAuthenticatedImage` - Fetches and caches user avatar images
- `@/components/Message/UserStatusIndicator` - Presence badge overlay

### External Dependencies
- `@mui/material/Avatar` - Material-UI avatar component
- `@mui/material/Skeleton` - Loading state placeholder
- `@mui/material/Box` - Container for status indicator positioning

## Performance Considerations

### Optimizations

1. **Single Fetch Per Avatar**
   ```tsx
   // FileCacheContext ensures:
   // - 50 messages from same user = 1 fetch, not 50 fetches
   // - Blob URLs shared across all UserAvatar instances
   const { blobUrl, isLoading } = useAuthenticatedImage(user?.avatarUrl);
   ```

2. **No Internal State**
   - Component is stateless and purely props-driven
   - No useState, useEffect, or useCallback overhead

3. **React.memo Opportunity**
   ```tsx
   // Can be memoized by parent if needed
   const MemoizedAvatar = React.memo(UserAvatar);
   ```

4. **Lazy Loading**
   - Images only fetched when avatar URL is present
   - No unnecessary API calls for users without avatars

### Rendering Performance

- **Small Bundle**: Single component, minimal dependencies
- **Fast Re-renders**: No complex state logic
- **Cached Images**: Blob URLs reused across component instances

## Loading States

### Loading Behavior

```tsx
if (isLoading) {
  return (
    <Skeleton
      variant="circular"
      width={avatarSize}
      height={avatarSize}
    />
  );
}
```

**Characteristics:**
- Shows circular skeleton matching avatar size
- Material-UI default animation (pulse effect)
- Instant replacement when blob URL ready

### Empty State

When `user` is null/undefined:
```tsx
<Avatar sx={{ width: avatarSize, height: avatarSize }}>
  ?
</Avatar>
```

## Presence Indicator Integration

When `showStatus={true}`:

```tsx
<Box sx={{ position: "relative", display: "inline-block" }}>
  {avatar}
  <UserStatusIndicator isOnline={isOnline} />
</Box>
```

**UserStatusIndicator Placement:**
- Positioned absolutely at bottom-right of avatar
- Small circular badge (green for online, gray for offline)
- See [UserStatusIndicator.md](../Message/UserStatusIndicator.md) for details

## Common Patterns

### Pattern 1: Message Author Avatar

```tsx
function MessageItem({ message }) {
  return (
    <div className="message">
      <UserAvatar user={message.author} size="small" />
      <div className="message-body">
        {/* message content */}
      </div>
    </div>
  );
}
```

### Pattern 2: Member List with Presence

```tsx
function MemberList({ members, presenceMap }) {
  return (
    <div>
      {members.map((member) => (
        <div key={member.id} className="member">
          <UserAvatar
            user={member}
            size="medium"
            showStatus={true}
            isOnline={presenceMap[member.id]?.status === "ONLINE"}
          />
          <span>{member.displayName || member.username}</span>
        </div>
      ))}
    </div>
  );
}
```

### Pattern 3: Large Profile Avatar

```tsx
function ProfileBanner({ user }) {
  return (
    <div className="profile-banner">
      <UserAvatar user={user} size="xlarge" />
      <h1>{user.displayName || user.username}</h1>
      <p>@{user.username}</p>
    </div>
  );
}
```

### Pattern 4: Conditional Avatar Display

```tsx
function OptionalAvatar({ user }) {
  return user ? (
    <UserAvatar user={user} size="medium" />
  ) : (
    <Avatar sx={{ width: 40, height: 40 }}>
      <PersonIcon />
    </Avatar>
  );
}
```

## Use Cases Throughout Application

This component replaced duplicate implementations in:

1. **Message Lists**
   - Channel message author avatars
   - Direct message author avatars
   - File: `ChannelMessageContainer.tsx`, `DirectMessageContainer.tsx`

2. **Member Lists**
   - Community member sidebar
   - Presence list with online indicators
   - File: `MemberList.tsx`, `PresenceList.tsx`

3. **Member Management**
   - Admin member management table
   - Role assignment interfaces
   - File: `ManageMembers.tsx`

4. **Profile Pages**
   - User profile headers
   - Profile edit previews
   - File: `ProfilePage.tsx`, `ProfileEditPage.tsx`

**Before Unification:**
- 6+ duplicate avatar implementations
- Inconsistent loading states
- Race conditions with duplicate fetches

**After Unification:**
- Single source of truth
- Consistent UX across app
- Optimized caching with no duplicates

## Accessibility

- **Alt Text**: Avatar component handles alt text internally
- **Fallback Content**: Initials displayed when image unavailable
- **Loading State**: Skeleton provides visual feedback during load
- **Semantic HTML**: Uses Material-UI Avatar with proper ARIA attributes

## Troubleshooting

### Common Issues

1. **Avatar not loading**
   - **Cause:** Invalid or missing `user.avatarUrl` (file ID)
   - **Solution:** Verify file ID exists in database and `/api/file/:fileId` is accessible

   ```tsx
   // Debug: Check what avatarUrl value is
   console.log("Avatar URL:", user?.avatarUrl);

   // Should be a file ID like: "file-abc-123-def"
   // NOT a blob URL like: "blob:http://..."
   ```

2. **Initials not showing**
   - **Cause:** Both `displayName` and `username` are null/undefined
   - **Solution:** Ensure user object has at least username field

   ```tsx
   // Ensure user object has required fields
   const user = {
     username: "johndoe",           // Required for fallback
     displayName: "John Doe",       // Preferred for initials
     avatarUrl: "file-id-123"       // Optional
   };
   ```

3. **Avatar showing "?"**
   - **Cause:** `user` prop is null or undefined
   - **Solution:** Check if user data loaded before rendering

   ```tsx
   // Add loading check
   if (!user) return <Skeleton variant="circular" width={40} height={40} />;

   return <UserAvatar user={user} />;
   ```

4. **Status indicator not visible**
   - **Cause:** `showStatus` not set to true, or `UserStatusIndicator` component missing
   - **Solution:** Ensure both props are correctly set

   ```tsx
   <UserAvatar
     user={user}
     showStatus={true}    // Must be true
     isOnline={isOnline}  // Boolean value
   />
   ```

5. **Multiple fetches for same avatar**
   - **Symptoms:** Network tab shows duplicate `/api/file/:id` requests
   - **Cause:** FileCacheContext not properly initialized or race condition
   - **Solution:** Ensure FileCacheProvider wraps application root

   ```tsx
   // In App.tsx or similar
   import { FileCacheProvider } from '@/contexts/AvatarCacheContext';

   function App() {
     return (
       <FileCacheProvider>
         {/* Application components */}
       </FileCacheProvider>
     );
   }
   ```

### Best Practices

- **Always Provide User Object**: Even if just `{ username: "unknown" }`
- **Use Appropriate Size**: Match size to UI context (small for lists, xlarge for profiles)
- **Loading States**: Let component handle loading, don't wrap in custom spinners
- **Presence Indicators**: Only use when presence data is available and relevant
- **Null Checks**: Component handles null user gracefully, but parent should check if possible

## Related Components

- **Parent Components:**
  - `MessageItem` - Displays message with author avatar
  - `MemberListItem` - Shows member with presence indicator
  - `ManageMembersRow` - Member management table rows
  - `ProfileHeader` - Large profile avatar display

- **Child Components:**
  - `UserStatusIndicator` - Online/offline badge overlay

- **Similar Components:**
  - `CommunityAvatar` - Similar pattern for community icons (not unified yet)

## Recent Changes

- **2025-01-05:** Created as unified avatar component, replacing 6+ duplicate implementations
- **2025-01-05:** Integrated FileCacheContext for optimized image fetching
- **2025-01-05:** Added four size variants (small, medium, large, xlarge)
- **2025-01-05:** Integrated UserStatusIndicator for presence display

## Related Documentation

- [useAuthenticatedImage Hook](../../hooks/useAuthenticatedImage.md) - Avatar image loading
- [FileCacheContext](../../contexts/FileCacheContext.md) - Image caching and deduplication
- [UserStatusIndicator Component](../Message/UserStatusIndicator.md) - Presence badge
- [User API](../../api/user.md) - User profile endpoints
- [File API](../../api/file.md) - File fetching endpoint
- [User Profiles Feature](../../features/user-profiles.md) - Profile system overview
