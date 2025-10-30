# VoiceChannelUserList Component

## Overview

`VoiceChannelUserList` is a comprehensive component that displays users currently connected to voice channels with real-time presence information, Discord-style visual indicators, and multiple display modes. It provides rich user status information including mute states, video status, screen sharing, and speaking indicators.

## Component Details

**Location**: `frontend/src/components/Voice/VoiceChannelUserList.tsx`

**Type**: Functional Component with React hooks and real-time updates

**Purpose**: Display voice channel participants with comprehensive status information and multiple viewing modes

## Props

```typescript
interface VoiceChannelUserListProps {
  channel: Channel;              // Voice channel object
  showInline?: boolean;          // Compact inline display mode
  showDiscordStyle?: boolean;    // Discord-style nested display
}
```

### Prop Details

- **`channel`** (Channel, required)
  - Complete channel object with type information
  - Must be a VOICE type channel for component to render
  - Used to fetch presence data and determine context

- **`showInline`** (boolean, optional, default: false)
  - Enables compact horizontal display mode
  - Shows up to 3 user avatars with overflow indicator
  - Useful for channel lists and compact layouts

- **`showDiscordStyle`** (boolean, optional, default: false)
  - Enables Discord-style nested display under voice channel
  - Indented user list with comprehensive status indicators
  - Optimized for sidebar/navigation display

## Voice Presence Integration

### Real-time Presence Data

```typescript
const {
  data: presence,
  isLoading,
  error,
} = useGetChannelPresenceQuery(channel.id, {
  skip: channel.type !== ChannelType.VOICE,
});
```

**Presence Features:**
- **Real-time Updates**: WebSocket-driven presence changes
- **Voice Channel Only**: Automatically skipped for non-voice channels
- **Error Handling**: Graceful fallback for failed presence queries
- **Loading States**: Proper loading indicators during data fetch

### Presence Data Structure

```typescript
interface VoicePresence {
  count: number;      // Total users in voice channel
  users: VoiceUser[]; // Array of user presence objects
}

interface VoiceUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  joinedAt: Date;            // When user joined voice channel
  isMuted: boolean;          // User has muted their microphone
  isDeafened: boolean;       // User has deafened (disabled audio input/output)
  isVideoEnabled: boolean;   // User has camera enabled
  isScreenSharing: boolean;  // User is screen sharing
}
```

## Display Modes

### 1. Standard Full Display Mode (Default)

```typescript
// When neither showInline nor showDiscordStyle is true
return (
  <Paper elevation={2} sx={{ maxHeight: 300, overflow: "auto" }}>
    <Box sx={{ p: 2, pb: 1 }}>
      <Typography variant="h6">
        Voice Channel — {presence.count} {presence.count === 1 ? "user" : "users"}
      </Typography>
    </Box>
    <List disablePadding>
      {presence.users.map((user, index) => (
        <UserItem key={user.id} user={user} index={index} />
      ))}
    </List>
  </Paper>
);
```

**Features:**
- **Paper Container**: Elevated card with scrolling
- **User Count Header**: Shows total connected users
- **Full User Details**: Complete user information display
- **Join Timestamps**: Shows when users joined the channel
- **Status Icons**: All voice states displayed with icons

### 2. Inline Display Mode

```typescript
if (showInline) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexWrap: "wrap" }}>
      {presence.users.slice(0, 3).map((user) => (
        <Tooltip key={user.id} title={user.displayName || user.username}>
          <Avatar
            src={user.avatarUrl}
            sx={{
              width: 24,
              height: 24,
              border: user.isVideoEnabled ? "2px solid" : "none",
              borderColor: "primary.main",
            }}
          >
            {(user.displayName || user.username).charAt(0).toUpperCase()}
          </Avatar>
        </Tooltip>
      ))}
      {presence.users.length > 3 && (
        <Chip label={`+${presence.users.length - 3}`} size="small" />
      )}
    </Box>
  );
}
```

**Features:**
- **Compact Avatars**: Small 24px avatars with tooltips
- **Video Indicators**: Blue border for users with video enabled
- **Overflow Handling**: Shows "+X" chip for additional users
- **Horizontal Layout**: Fits in channel lists and compact spaces
- **Tooltip Names**: Hover for full user names

### 3. Discord-Style Nested Display

```typescript
if (showDiscordStyle) {
  return (
    <Box>
      {presence.users.map((user) => (
        <DiscordStyleUserItem key={user.id} user={user} />
      ))}
    </Box>
  );
}
```

**Features:**
- **Nested Layout**: Indented under voice channel like Discord
- **Status Badges**: Mute/deafen indicators overlaid on avatars
- **Speaking Indication**: Green border for active speakers (planned)
- **Compact Spacing**: Optimized for sidebar navigation

## Status Indicators and Visual Design

### DiscordStyleUserItem Implementation

```typescript
const DiscordStyleUserItem: React.FC<{ user: VoiceUser }> = React.memo(({ user }) => {
  const isSpeaking = false; // TODO: Add speaking detection from LiveKit
  
  const userState = {
    isMuted: Boolean(user.isMuted),
    isDeafened: Boolean(user.isDeafened),
    isVideoEnabled: Boolean(user.isVideoEnabled),
    isScreenSharing: Boolean(user.isScreenSharing),
  };
  
  return (
    <ListItem sx={{ px: 1, py: 0.5, pl: 4, minHeight: 40 }}>
      <ListItemAvatar sx={{ minWidth: 40 }}>
        <Box sx={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Avatar
            src={user.avatarUrl}
            sx={{
              width: 32,
              height: 32,
              border: isSpeaking ? "2px solid #00ff00" : "2px solid transparent",
              transition: "border-color 0.2s ease",
            }}
          >
            {(user.displayName || user.username).charAt(0).toUpperCase()}
          </Avatar>
          
          {/* Status Badges */}
          {userState.isMuted && <MutedBadge />}
          {userState.isDeafened && <DeafenedBadge />}
        </Box>
      </ListItemAvatar>

      <ListItemText
        primary={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "14px" }}>
              {user.displayName || user.username}
            </Typography>
            
            <Box sx={{ display: "flex", gap: 0.5, ml: "auto" }}>
              {/* Status Icons */}
              {userState.isMuted && <MicOff sx={{ fontSize: 16, color: "#f04747" }} />}
              {userState.isDeafened && <VolumeOff sx={{ fontSize: 16, color: "#f04747" }} />}
              {userState.isVideoEnabled && <Videocam sx={{ fontSize: 16, color: "#43b581" }} />}
              {userState.isScreenSharing && <ScreenShare sx={{ fontSize: 16, color: "#593695" }} />}
            </Box>
          </Box>
        }
      />
    </ListItem>
  );
});
```

### Status Badge Components

#### Muted Indicator Badge

```typescript
{userState.isMuted && (
  <Box
    sx={{
      position: "absolute",
      bottom: -2,
      right: -2,
      backgroundColor: "#f04747",          // Discord red
      borderRadius: "50%",
      width: 16,
      height: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "2px solid",
      borderColor: "background.paper",
    }}
  >
    <MicOff sx={{ fontSize: 10, color: "white" }} />
  </Box>
)}
```

#### Deafened Indicator Badge

```typescript
{userState.isDeafened && (
  <Box
    sx={{
      position: "absolute",
      bottom: -2,
      left: -2,
      backgroundColor: "#f04747",
      borderRadius: "50%",
      width: 16,
      height: 16,
      // ... similar styling to muted badge
    }}
  >
    <VolumeOff sx={{ fontSize: 10, color: "white" }} />
  </Box>
)}
```

### Status Icon Definitions

| Icon | Color | Meaning |
|------|-------|---------|
| 🎤 `MicOff` | Red (#f04747) | User has muted their microphone |
| 🔊 `VolumeOff` | Red (#f04747) | User has deafened (can't hear) |
| 📹 `Videocam` | Green (#43b581) | User has camera enabled |
| 🖥️ `ScreenShare` | Purple (#593695) | User is screen sharing |

## User Experience Features

### State Normalization

```typescript
const userState = {
  isMuted: Boolean(user.isMuted),
  isDeafened: Boolean(user.isDeafened),
  isVideoEnabled: Boolean(user.isVideoEnabled),
  isScreenSharing: Boolean(user.isScreenSharing),
};
```

**Benefits:**
- **Type Safety**: Ensures boolean values for all states
- **Null Safety**: Handles undefined/null values gracefully
- **Consistent Logic**: Standardized state checking across component

### Speaking Detection (✅ Implemented)

```typescript
// Real-time speaking detection from LiveKit
const { isSpeaking } = useSpeakingDetection();
const speaking = isSpeaking(user.id);
```

**Implemented Features:**
- **LiveKit Integration**: Real-time speaking detection using LiveKit's `isSpeakingChanged` event
- **Visual Feedback**: Green border (#00ff00) around speaking user's avatar
- **Animation**: Smooth transitions (0.2s ease) for speaking state changes
- **Redux Integration**: Local user's speaking state synced to Redux store
- **Multi-participant Support**: Tracks speaking state for all participants simultaneously

**How It Works:**
1. `useSpeakingDetection` hook listens to LiveKit participant events
2. When a participant's audio level crosses the speaking threshold, LiveKit fires `isSpeakingChanged`
3. Hook updates internal Map with participant speaking states
4. Component receives updated speaking state via `isSpeaking(userId)` function
5. Avatar border color changes instantly with smooth CSS transition

### Time-based Information

```typescript
const joinedAgo = formatDistanceToNow(new Date(user.joinedAt), {
  addSuffix: true,
});

// Displays: "Joined 5 minutes ago"
```

**Temporal Features:**
- **Join Timestamps**: Shows when users joined the voice channel
- **Relative Time**: Human-readable "X ago" format using date-fns
- **Auto-updating**: Times update as component re-renders
- **Localization**: Supports different locales via date-fns

## Loading and Error States

### Loading State

```typescript
if (isLoading) {
  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="body2" color="text.secondary">
        Loading voice channel...
      </Typography>
    </Box>
  );
}
```

### Error State

```typescript
if (error) {
  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="body2" color="error">
        Failed to load voice channel users
      </Typography>
    </Box>
  );
}
```

### Empty State

```typescript
if (!presence || presence.users.length === 0) {
  return null; // Component doesn't render when no users
}
```

**State Handling:**
- **Graceful Degradation**: Component handles all failure scenarios
- **User Feedback**: Clear messages for loading and error states
- **Clean UI**: Empty channels don't show unnecessary UI elements

## Performance Optimizations

### React.memo for User Items

```typescript
const DiscordStyleUserItem: React.FC<{ user: VoiceUser }> = React.memo(({ user }) => {
  // Component implementation
});

const UserItem: React.FC<{ user: VoiceUser; index: number }> = React.memo(({ user, index }) => {
  // Component implementation  
});
```

**Benefits:**
- **Reduced Re-renders**: User items only re-render when user data changes
- **Performance**: Efficient handling of large voice channels
- **Memory**: Stable component instances across renders

### Query Optimization

```typescript
const { data: presence } = useGetChannelPresenceQuery(channel.id, {
  skip: channel.type !== ChannelType.VOICE,
});
```

**Optimizations:**
- **Conditional Queries**: Only fetch presence for voice channels
- **RTK Query Caching**: Automatic caching and cache invalidation
- **Real-time Updates**: WebSocket-driven presence updates
- **Background Refetch**: Keeps data fresh automatically

## Usage Examples

### Standard Voice Channel Display

```typescript
import { VoiceChannelUserList } from '@/components/Voice/VoiceChannelUserList';

function VoiceChannelView({ channel }: { channel: Channel }) {
  if (channel.type !== ChannelType.VOICE) {
    return <div>Not a voice channel</div>;
  }

  return (
    <div className="voice-channel-view">
      <h2>{channel.name}</h2>
      <VoiceChannelUserList channel={channel} />
    </div>
  );
}
```

### Channel List Integration (Inline Mode)

```typescript
function ChannelListItem({ channel }: { channel: Channel }) {
  return (
    <div className="channel-item">
      <div className="channel-info">
        <span className="channel-name">🔊 {channel.name}</span>
        {channel.type === ChannelType.VOICE && (
          <VoiceChannelUserList 
            channel={channel} 
            showInline={true} 
          />
        )}
      </div>
    </div>
  );
}
```

### Discord-Style Sidebar Integration

```typescript
function VoiceChannelSection({ channels }: { channels: Channel[] }) {
  const voiceChannels = channels.filter(ch => ch.type === ChannelType.VOICE);

  return (
    <div className="voice-channels">
      {voiceChannels.map(channel => (
        <div key={channel.id}>
          <div className="channel-header">
            🔊 {channel.name}
          </div>
          <VoiceChannelUserList 
            channel={channel} 
            showDiscordStyle={true} 
          />
        </div>
      ))}
    </div>
  );
}
```

### Real-time Status Monitoring

```typescript
function VoiceChannelMonitor({ channel }: { channel: Channel }) {
  const [notifications, setNotifications] = useState<string[]>([]);

  const { data: presence } = useGetChannelPresenceQuery(channel.id);

  useEffect(() => {
    if (presence?.users) {
      // Monitor for users joining/leaving
      const currentUsers = presence.users.map(u => u.id);
      // Add notification logic here
    }
  }, [presence?.users]);

  return (
    <div>
      <VoiceChannelUserList channel={channel} />
      <div className="notifications">
        {notifications.map((notification, idx) => (
          <div key={idx} className="notification">
            {notification}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Testing

### Unit Testing

**Test File**: `VoiceChannelUserList.test.tsx`

**Test Coverage:**
- Display mode switching (inline, Discord-style, standard)
- Voice channel type filtering
- User status indicators (mute, deafen, video, screen share)
- Loading and error state handling
- Empty state behavior
- Avatar fallback display

**Example Tests:**
```typescript
describe('VoiceChannelUserList', () => {
  const mockVoiceChannel = {
    id: 'voice-channel-1',
    name: 'Voice Channel',
    type: ChannelType.VOICE
  };

  const mockPresence = {
    count: 2,
    users: [
      {
        id: 'user1',
        username: 'alice',
        displayName: 'Alice',
        avatarUrl: '/avatars/alice.jpg',
        joinedAt: new Date('2023-01-01T12:00:00Z'),
        isMuted: true,
        isDeafened: false,
        isVideoEnabled: false,
        isScreenSharing: false
      },
      {
        id: 'user2',
        username: 'bob',
        displayName: 'Bob',
        avatarUrl: null,
        joinedAt: new Date('2023-01-01T12:05:00Z'),
        isMuted: false,
        isDeafened: false,
        isVideoEnabled: true,
        isScreenSharing: true
      }
    ]
  };

  it('renders voice channel users with status indicators', () => {
    jest.mocked(useGetChannelPresenceQuery).mockReturnValue({
      data: mockPresence,
      isLoading: false,
      error: null
    });

    render(<VoiceChannelUserList channel={mockVoiceChannel} />);

    expect(screen.getByText('Voice Channel — 2 users')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    
    // Check status icons
    expect(screen.getByTestId('mic-off-icon')).toBeInTheDocument(); // Alice is muted
    expect(screen.getByTestId('videocam-icon')).toBeInTheDocument(); // Bob has video
    expect(screen.getByTestId('screen-share-icon')).toBeInTheDocument(); // Bob is screen sharing
  });

  it('shows inline display with avatar overflow', () => {
    const largePresence = {
      count: 5,
      users: Array.from({ length: 5 }, (_, i) => ({
        id: `user${i}`,
        username: `user${i}`,
        displayName: `User ${i}`,
        // ... other required fields
      }))
    };

    jest.mocked(useGetChannelPresenceQuery).mockReturnValue({
      data: largePresence,
      isLoading: false,
      error: null
    });

    render(
      <VoiceChannelUserList 
        channel={mockVoiceChannel} 
        showInline={true} 
      />
    );

    // Should show 3 avatars + overflow indicator
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('returns null for non-voice channels', () => {
    const textChannel = {
      ...mockVoiceChannel,
      type: ChannelType.TEXT
    };

    const { container } = render(
      <VoiceChannelUserList channel={textChannel} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows Discord-style layout with indentation', () => {
    jest.mocked(useGetChannelPresenceQuery).mockReturnValue({
      data: mockPresence,
      isLoading: false,
      error: null
    });

    render(
      <VoiceChannelUserList 
        channel={mockVoiceChannel} 
        showDiscordStyle={true} 
      />
    );

    // Check for indented layout
    const listItems = screen.getAllByRole('listitem');
    expect(listItems[0]).toHaveStyle({ paddingLeft: '32px' }); // 4 * 8px theme spacing
  });
});
```

### Integration Testing

- **Real-time Presence Updates**: Test WebSocket presence changes
- **LiveKit Integration**: Test speaking detection when implemented
- **Multi-channel Display**: Test multiple voice channels simultaneously
- **Performance**: Test with large numbers of users (50+ in voice channel)

## Related Components

### Direct Dependencies

- **`useGetChannelPresenceQuery`**: Voice presence data fetching
- **`useSpeakingDetection`**: Real-time speaking detection via LiveKit
- **Material-UI Components**: List, Avatar, Typography, Chip, Tooltip, etc.
- **Material-UI Icons**: MicOff, VolumeOff, Videocam, ScreenShare
- **date-fns**: Time formatting utilities

### Related Voice Components

- **`VoiceBottomBar`**: Voice controls and connection status
- **`VideoTiles`**: Video display for voice channels
- **`DeviceSettingsDialog`**: Audio/video device configuration
- **`VoiceChannelJoinButton`**: Join/leave voice channel controls

### Integration Points

- **Channel Lists**: Displays voice channel activity
- **Voice Connection**: Shows current connection status
- **Presence System**: Real-time user status updates
- **LiveKit Integration**: Audio/video stream management

---

## Future Enhancements

### Planned Features

1. **Enhanced Speaking Detection** (basic detection ✅ complete)
   - Audio level meters/waveforms
   - Speaking history/statistics
   - Customizable speaking threshold

2. **Enhanced Status Display**
   - Push-to-talk indicators
   - Voice activity level meters
   - Connection quality indicators

3. **User Interactions**
   - Click to view user profile
   - Right-click context menus
   - Direct message shortcuts

4. **Accessibility Improvements**
   - Screen reader announcements for status changes
   - Keyboard navigation support
   - High contrast mode support

### Performance Enhancements

1. **Virtualization**
   - Handle large voice channels (100+ users)
   - Memory-efficient rendering
   - Smooth scrolling performance

2. **Optimistic Updates**
   - Immediate status change feedback
   - Conflict resolution for simultaneous updates
   - Offline state handling

This component provides comprehensive voice channel presence information with multiple display modes, real-time updates, and rich status indicators, making it a cornerstone of Kraken's voice communication features.