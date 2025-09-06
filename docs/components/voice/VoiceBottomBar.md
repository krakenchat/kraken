# VoiceBottomBar

> **Location:** `frontend/src/components/Voice/VoiceBottomBar.tsx`  
> **Type:** Voice Control Interface Component  
> **Feature:** voice

## Overview

The VoiceBottomBar component provides a persistent, Discord-like voice control interface that appears at the bottom of the screen when a user is connected to a voice channel. It offers comprehensive voice and video controls, participant management, device settings, and connection status information with a professional, polished UI.

## Props Interface

```typescript
// VoiceBottomBar takes no props - uses useVoiceConnection hook for state
interface VoiceBottomBarProps {}
```

## Usage Examples

### Basic Usage (Layout Integration)
```tsx
import { VoiceBottomBar } from '@/components/Voice';

function Layout() {
  return (
    <>
      <AppBar />
      <MainContent />
      
      {/* VoiceBottomBar automatically shows when connected */}
      <VoiceBottomBar />
    </>
  );
}
```

### Conditional Rendering Based on Connection
```tsx
// Component handles its own conditional rendering
function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* ... routes */}
        </Routes>
        
        {/* Only renders when voice connection active */}
        <VoiceBottomBar />
      </Router>
    </ThemeProvider>
  );
}
```

## Styling & Theming

- **Material-UI Components Used:**
  - `Box` (layout containers)
  - `Paper` (main container with elevation)
  - `Typography` (channel info and labels)
  - `IconButton` (all voice controls)
  - `Tooltip` (control descriptions)
  - `Chip` (connection status)
  - `Divider` (visual separators)
  - `Menu` & `MenuItem` (settings dropdown)
  - `Badge` (participant count)
  - `Collapse` (user list expansion)
- **Material-UI Icons:** Complete set of voice/video icons (Mic, Videocam, ScreenShare, etc.)
- **Fixed Positioning:** Sticky bottom bar with high z-index (1300)
- **Theme Integration:** Uses theme colors, shadows, and spacing consistently

```tsx
// Key styling patterns
<Paper
  elevation={8}
  sx={{
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1300,
    borderRadius: 0,
    backgroundColor: "background.paper",
    borderTop: 1,
    borderColor: "divider",
  }}
>
  
// Dynamic button styling based on state
<IconButton
  sx={{
    backgroundColor: state.isMuted ? "error.main" : "transparent",
    color: state.isMuted ? "error.contrastText" : "text.primary",
    "&:hover": {
      backgroundColor: state.isMuted ? "error.dark" : "action.hover",
    },
  }}
>
```

## State Management

- **Voice Hook Integration:** Uses `useVoiceConnection` for complete voice state
- **Local State:**
  - `settingsAnchor` (HTMLElement | null) - settings menu anchor
  - `showUserList` (boolean) - controls participant list visibility
  - `showDeviceSettings` (boolean) - controls device settings dialog
- **Voice State Properties:**
  - Connection: `isConnected`, `currentChannelId`, `channelName`
  - Audio: `isMuted`, `isDeafened`
  - Video: `isVideoEnabled`, `isScreenSharing`, `showVideoTiles`
  - Participants: `participants` array with user data

## Dependencies

### Internal Dependencies
- `@/hooks/useVoiceConnection` - complete voice state management
- `@/components/Voice/VoiceChannelUserList` - participant list display
- `@/components/Voice/DeviceSettingsDialog` - audio/video device configuration
- `@/types/channel.type` - channel type definitions

### External Dependencies
- `@mui/material` - complete UI component set
- `@mui/icons-material` - comprehensive icon set for voice controls
- `react` (useState) - local state management

## Related Components

- **Parent Components:** Layout (global integration)
- **Child Components:** VoiceChannelUserList, DeviceSettingsDialog
- **Related Components:** VideoTiles (video display), VoiceChannelJoinButton (connection trigger)

## Common Patterns

### Pattern 1: Conditional Rendering Based on Connection
```tsx
if (!state.isConnected || !state.currentChannelId) {
  return null;
}
// Only renders when actively connected to voice channel
```

### Pattern 2: State-Based Icon and Color Management
```tsx
<IconButton
  onClick={actions.toggleMute}
  color={state.isMuted ? "error" : "default"}
  sx={{
    backgroundColor: state.isMuted ? "error.main" : "transparent",
    color: state.isMuted ? "error.contrastText" : "text.primary",
  }}
>
  {state.isMuted ? <MicOff /> : <Mic />}
</IconButton>
```

### Pattern 3: Expandable UI Sections
```tsx
<Collapse in={showUserList} timeout={300}>
  <Box sx={{ position: "fixed", bottom: 80, zIndex: 1200 }}>
    <VoiceChannelUserList channel={channelData} />
  </Box>
</Collapse>
```

### Pattern 4: Device Management Integration
```tsx
const handleDeviceChange = async (type: 'audio' | 'video', deviceId: string) => {
  try {
    if (type === 'audio') {
      await actions.switchAudioInputDevice(deviceId);
    } else if (type === 'video') {
      await actions.switchVideoInputDevice(deviceId);
    }
    console.log(`Successfully switched ${type} device`);
  } catch (error) {
    console.error(`Failed to switch ${type} device:`, error);
  }
};
```

### Pattern 5: Settings Menu with Context Actions
```tsx
<Menu anchorEl={settingsAnchor} open={Boolean(settingsAnchor)}>
  <MenuItem onClick={() => actions.setShowVideoTiles(!state.showVideoTiles)}>
    {state.showVideoTiles ? "Hide Video Tiles" : "Show Video Tiles"}
  </MenuItem>
  <MenuItem onClick={() => handleDeviceSettingsOpen('audio')}>
    Audio Settings
  </MenuItem>
</Menu>
```

## Testing

- **Test Location:** Not currently implemented
- **Key Test Cases:**
  - Component only renders when voice connected
  - All voice controls toggle correct states
  - Settings menu opens and closes properly
  - Device settings integration works
  - Participant list expands/collapses correctly
  - Disconnect functionality works properly

```tsx
// Example test patterns
test('should not render when not connected to voice', () => {
  // Mock useVoiceConnection with isConnected: false
  // Render VoiceBottomBar
  // Assert component returns null
});

test('should toggle mute state when mute button clicked', () => {
  // Mock voice connection with mute controls
  // Click mute button
  // Assert actions.toggleMute was called
  // Assert UI reflects muted state
});

test('should show participant count in badge', () => {
  // Mock voice connection with participants
  // Render component
  // Assert badge shows correct participant count
});
```

## Accessibility

- **ARIA Labels:** 
  - Comprehensive tooltips for all controls
  - Clear action descriptions (Mute/Unmute, etc.)
- **Keyboard Navigation:** 
  - Full keyboard support for all controls
  - Menu keyboard navigation
- **Screen Reader Support:**
  - Status information clearly announced
  - Control states properly communicated

## Performance Considerations

- **Conditional Rendering:** Completely removed from DOM when not needed
- **Animation Performance:** Uses CSS transitions for smooth state changes
- **State Updates:** Efficient re-rendering based on voice state changes
- **Bundle Size:** Large component but only loaded when voice features needed

## Voice Control Features

### Audio Controls
- **Microphone Toggle:** Mute/unmute with visual feedback
- **Headphone Toggle:** Deafen/undeafen (stops hearing others)
- **Push-to-Talk:** Future implementation ready

### Video Controls
- **Camera Toggle:** Enable/disable video with auto-tile showing
- **Screen Share:** Full screen sharing capability
- **Video Tiles:** Toggle video overlay visibility

### Connection Management
- **Connection Status:** Real-time status display with color coding
- **Participant Count:** Live participant count with expandable list
- **Disconnect:** Clean disconnect from voice channel

### Settings Integration
- **Device Settings:** Audio and video device selection
- **Video Tiles Control:** Show/hide video overlay
- **Quality Settings:** Future implementation ready

## UI Layout Sections

### Left Section - Channel Info
- Voice channel name and connection status
- Connection status chip with color coding
- Expandable participant list with count badge

### Center Section - Primary Controls
- Microphone and headphone controls with state styling
- Video and screen share controls
- Visual dividers for logical grouping

### Right Section - Secondary Actions
- Settings menu with device and display options
- Disconnect button with error styling

## Voice State Integration

### Connection State
```typescript
interface VoiceState {
  isConnected: boolean;
  currentChannelId: string | null;
  channelName: string | null;
  participants: VoiceParticipant[];
}
```

### Audio/Video State
```typescript
interface MediaState {
  isMuted: boolean;
  isDeafened: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  showVideoTiles: boolean;
}
```

## Troubleshooting

### Common Issues
1. **Bar not appearing when connected**
   - **Cause:** useVoiceConnection hook not returning connected state
   - **Solution:** Verify voice connection hook implementation

2. **Controls not responding**
   - **Cause:** Voice actions not properly connected
   - **Solution:** Check useVoiceConnection actions implementation

3. **Device settings not working**
   - **Cause:** WebRTC device permissions or API issues
   - **Solution:** Verify browser permissions and device availability

4. **Participant list not updating**
   - **Cause:** Voice presence events not being received
   - **Solution:** Check WebSocket voice presence implementation

## Recent Changes

- **Current:** Complete voice control interface with device management
- **Needs:** Push-to-talk support, voice activity indicators, quality settings

## Related Documentation

- [useVoiceConnection Hook](../../hooks/useVoiceConnection.md)
- [VoiceChannelUserList](./VoiceChannelUserList.md)
- [DeviceSettingsDialog](./DeviceSettingsDialog.md)
- [Voice Persistence](../../features/voice-persistence.md)
- [LiveKit Integration](../../features/livekit.md)