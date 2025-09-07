# Voice Navigation Persistence Implementation Plan

## 🎯 Overview

Implement persistent voice connections that survive page navigation, similar to Discord's voice experience. Users should remain connected to voice channels while browsing different parts of the application.

## 📊 Current State

**Voice Connection**: ✅ Partially Working
- LiveKit integration functional for voice/video
- Users can join/leave voice channels
- Voice controls (mute, video, screen share) work
- Bottom bar shows when connected to voice

**Navigation Issue**: ❌ Critical Problem
- Voice connection drops when navigating between pages
- LiveKit room connection is lost on page changes
- Users must rejoin voice after every navigation
- No persistent voice state across route changes

## 🏗️ Architecture

### Current Voice State Management Issues

```typescript
// Current problem: Voice state is page-scoped
// LiveKit connection gets destroyed on route changes
// No global voice state management
```

### Proposed Global Voice State

```typescript
// Global voice state that persists across navigation
interface VoiceState {
  isConnected: boolean;
  channelId: string | null;
  channelName: string | null;
  communityId: string | null;
  participants: VoiceParticipant[];
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  localTrackStates: {
    camera: boolean;
    microphone: boolean;
    screenShare: boolean;
  };
}
```

### State Management Architecture

```typescript
// Redux slice for global voice state
interface VoiceSliceState {
  connection: VoiceState;
  room: LiveKitRoom | null;
  error: string | null;
  reconnectAttempts: number;
}
```

## 🔧 Implementation Details

### 1. Global Voice State Management

#### Voice Redux Slice

```typescript
// frontend/src/features/voice/voiceSlice.ts

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Room, RoomEvent, ConnectionState } from 'livekit-client';

interface VoiceState {
  isConnected: boolean;
  channelId: string | null;
  channelName: string | null;
  communityId: string | null;
  participants: VoiceParticipant[];
  connectionState: ConnectionState;
  localTrackStates: {
    camera: boolean;
    microphone: boolean;
    screenShare: boolean;
  };
}

interface VoiceSliceState {
  connection: VoiceState;
  room: Room | null;
  error: string | null;
  reconnectAttempts: number;
  isReconnecting: boolean;
}

// Async thunk for joining voice channel
export const joinVoiceChannel = createAsyncThunk(
  'voice/joinChannel',
  async ({ channelId, token }: { channelId: string; token: string }) => {
    const room = new Room();
    
    // Set up room event listeners
    room.on(RoomEvent.Connected, () => {
      console.log('Connected to LiveKit room');
    });
    
    room.on(RoomEvent.Disconnected, () => {
      console.log('Disconnected from LiveKit room');
    });
    
    room.on(RoomEvent.Reconnecting, () => {
      console.log('Reconnecting to LiveKit room');
    });
    
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('Participant connected:', participant.identity);
    });
    
    await room.connect(process.env.REACT_APP_LIVEKIT_URL!, token);
    
    return { room, channelId };
  }
);

// Async thunk for leaving voice channel
export const leaveVoiceChannel = createAsyncThunk(
  'voice/leaveChannel',
  async (_, { getState }) => {
    const state = getState() as { voice: VoiceSliceState };
    if (state.voice.room) {
      state.voice.room.disconnect();
    }
  }
);

const voiceSlice = createSlice({
  name: 'voice',
  initialState: {
    connection: {
      isConnected: false,
      channelId: null,
      channelName: null,
      communityId: null,
      participants: [],
      connectionState: ConnectionState.Disconnected,
      localTrackStates: {
        camera: false,
        microphone: false,
        screenShare: false,
      },
    },
    room: null,
    error: null,
    reconnectAttempts: 0,
    isReconnecting: false,
  } as VoiceSliceState,
  reducers: {
    updateConnectionState: (state, action: PayloadAction<ConnectionState>) => {
      state.connection.connectionState = action.payload;
    },
    updateParticipants: (state, action: PayloadAction<VoiceParticipant[]>) => {
      state.connection.participants = action.payload;
    },
    updateLocalTrackState: (state, action: PayloadAction<{ 
      track: 'camera' | 'microphone' | 'screenShare';
      enabled: boolean;
    }>) => {
      state.connection.localTrackStates[action.payload.track] = action.payload.enabled;
    },
    clearError: (state) => {
      state.error = null;
    },
    incrementReconnectAttempts: (state) => {
      state.reconnectAttempts += 1;
    },
    resetReconnectAttempts: (state) => {
      state.reconnectAttempts = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(joinVoiceChannel.fulfilled, (state, action) => {
        state.room = action.payload.room;
        state.connection.isConnected = true;
        state.connection.channelId = action.payload.channelId;
        state.connection.connectionState = ConnectionState.Connected;
        state.error = null;
        state.reconnectAttempts = 0;
      })
      .addCase(joinVoiceChannel.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to join voice channel';
        state.connection.isConnected = false;
      })
      .addCase(leaveVoiceChannel.fulfilled, (state) => {
        state.room = null;
        state.connection.isConnected = false;
        state.connection.channelId = null;
        state.connection.channelName = null;
        state.connection.communityId = null;
        state.connection.participants = [];
        state.connection.connectionState = ConnectionState.Disconnected;
      });
  },
});

export const {
  updateConnectionState,
  updateParticipants,
  updateLocalTrackState,
  clearError,
  incrementReconnectAttempts,
  resetReconnectAttempts,
} = voiceSlice.actions;

export default voiceSlice.reducer;
```

### 2. Persistent Voice Connection Hook

#### Global Voice Hook

```typescript
// frontend/src/hooks/useVoiceConnection.ts

import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Room, RoomEvent, ConnectionState } from 'livekit-client';
import { 
  joinVoiceChannel, 
  leaveVoiceChannel,
  updateConnectionState,
  updateParticipants,
  incrementReconnectAttempts,
  resetReconnectAttempts
} from '../features/voice/voiceSlice';
import { RootState } from '../app/store';

export const useVoiceConnection = () => {
  const dispatch = useDispatch();
  const voiceState = useSelector((state: RootState) => state.voice);
  
  // Auto-reconnection logic
  useEffect(() => {
    if (!voiceState.room) return;
    
    const room = voiceState.room;
    
    const handleDisconnect = () => {
      dispatch(updateConnectionState(ConnectionState.Disconnected));
      
      // Attempt reconnection with backoff
      const reconnectDelay = Math.min(1000 * Math.pow(2, voiceState.reconnectAttempts), 10000);
      
      if (voiceState.reconnectAttempts < 5) {
        setTimeout(() => {
          dispatch(incrementReconnectAttempts());
          // Attempt to rejoin with existing channel ID
          if (voiceState.connection.channelId) {
            rejoinCurrentChannel();
          }
        }, reconnectDelay);
      }
    };
    
    const handleReconnected = () => {
      dispatch(updateConnectionState(ConnectionState.Connected));
      dispatch(resetReconnectAttempts());
    };
    
    const handleReconnecting = () => {
      dispatch(updateConnectionState(ConnectionState.Reconnecting));
    };
    
    room.on(RoomEvent.Disconnected, handleDisconnect);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    
    return () => {
      room.off(RoomEvent.Disconnected, handleDisconnect);
      room.off(RoomEvent.Reconnected, handleReconnected);
      room.off(RoomEvent.Reconnecting, handleReconnecting);
    };
  }, [voiceState.room, voiceState.reconnectAttempts, dispatch]);
  
  const joinChannel = useCallback(async (channelId: string) => {
    try {
      // Get fresh token from backend
      const response = await fetch(`/api/livekit/token/${channelId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const { token } = await response.json();
      
      dispatch(joinVoiceChannel({ channelId, token }));
    } catch (error) {
      console.error('Failed to join voice channel:', error);
    }
  }, [dispatch]);
  
  const leaveChannel = useCallback(() => {
    dispatch(leaveVoiceChannel());
  }, [dispatch]);
  
  const rejoinCurrentChannel = useCallback(async () => {
    if (voiceState.connection.channelId) {
      await joinChannel(voiceState.connection.channelId);
    }
  }, [voiceState.connection.channelId, joinChannel]);
  
  const toggleMicrophone = useCallback(async () => {
    if (!voiceState.room) return;
    
    const enabled = !voiceState.connection.localTrackStates.microphone;
    await voiceState.room.localParticipant.setMicrophoneEnabled(enabled);
    dispatch(updateLocalTrackState({ track: 'microphone', enabled }));
  }, [voiceState.room, voiceState.connection.localTrackStates.microphone, dispatch]);
  
  const toggleCamera = useCallback(async () => {
    if (!voiceState.room) return;
    
    const enabled = !voiceState.connection.localTrackStates.camera;
    await voiceState.room.localParticipant.setCameraEnabled(enabled);
    dispatch(updateLocalTrackState({ track: 'camera', enabled }));
  }, [voiceState.room, voiceState.connection.localTrackStates.camera, dispatch]);
  
  return {
    voiceState: voiceState.connection,
    room: voiceState.room,
    error: voiceState.error,
    isReconnecting: voiceState.isReconnecting,
    joinChannel,
    leaveChannel,
    toggleMicrophone,
    toggleCamera,
  };
};
```

### 3. Persistent Voice Bottom Bar

#### Global Voice Bar Component

```typescript
// frontend/src/components/Voice/PersistentVoiceBar.tsx

import React from 'react';
import { Box, Paper, Typography, IconButton, Chip } from '@mui/material';
import { 
  Mic, 
  MicOff, 
  Videocam, 
  VideocamOff, 
  CallEnd, 
  ScreenShare,
  ScreenShareOff 
} from '@mui/icons-material';
import { useVoiceConnection } from '../../hooks/useVoiceConnection';
import { ConnectionState } from 'livekit-client';

export const PersistentVoiceBar: React.FC = () => {
  const { 
    voiceState, 
    leaveChannel, 
    toggleMicrophone, 
    toggleCamera,
    isReconnecting 
  } = useVoiceConnection();
  
  // Don't render if not connected
  if (!voiceState.isConnected && !isReconnecting) {
    return null;
  }
  
  const getConnectionStatusColor = () => {
    switch (voiceState.connectionState) {
      case ConnectionState.Connected:
        return 'success';
      case ConnectionState.Connecting:
      case ConnectionState.Reconnecting:
        return 'warning';
      case ConnectionState.Disconnected:
        return 'error';
      default:
        return 'default';
    }
  };
  
  const getConnectionStatusText = () => {
    switch (voiceState.connectionState) {
      case ConnectionState.Connected:
        return 'Connected';
      case ConnectionState.Connecting:
        return 'Connecting...';
      case ConnectionState.Reconnecting:
        return 'Reconnecting...';
      case ConnectionState.Disconnected:
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };
  
  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1300,
        backgroundColor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        p: 2,
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between">
        {/* Channel Info */}
        <Box display="flex" alignItems="center" gap={2}>
          <Box>
            <Typography variant="subtitle2" fontWeight="bold">
              {voiceState.channelName || `Channel ${voiceState.channelId}`}
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                label={getConnectionStatusText()}
                size="small"
                color={getConnectionStatusColor() as any}
                variant="outlined"
              />
              <Typography variant="caption" color="text.secondary">
                {voiceState.participants.length} participant{voiceState.participants.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
          </Box>
        </Box>
        
        {/* Voice Controls */}
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton
            color={voiceState.localTrackStates.microphone ? 'primary' : 'default'}
            onClick={toggleMicrophone}
            disabled={voiceState.connectionState !== ConnectionState.Connected}
          >
            {voiceState.localTrackStates.microphone ? <Mic /> : <MicOff />}
          </IconButton>
          
          <IconButton
            color={voiceState.localTrackStates.camera ? 'primary' : 'default'}
            onClick={toggleCamera}
            disabled={voiceState.connectionState !== ConnectionState.Connected}
          >
            {voiceState.localTrackStates.camera ? <Videocam /> : <VideocamOff />}
          </IconButton>
          
          <IconButton
            color="error"
            onClick={leaveChannel}
          >
            <CallEnd />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
};
```

### 4. App-Level Integration

#### Root App Component Integration

```typescript
// frontend/src/App.tsx

import { PersistentVoiceBar } from './components/Voice/PersistentVoiceBar';
import { useVoiceConnection } from './hooks/useVoiceConnection';

function App() {
  const { voiceState } = useVoiceConnection();
  
  return (
    <Router>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box 
          display="flex" 
          flexDirection="column" 
          minHeight="100vh"
          // Add bottom padding when voice bar is active
          pb={voiceState.isConnected ? '80px' : 0}
        >
          {/* Main app content */}
          <Routes>
            {/* ... existing routes ... */}
          </Routes>
          
          {/* Persistent voice bar - renders at app level */}
          <PersistentVoiceBar />
        </Box>
      </ThemeProvider>
    </Router>
  );
}
```

#### Store Integration

```typescript
// frontend/src/app/store.ts

import voiceReducer from '../features/voice/voiceSlice';

export const store = configureStore({
  reducer: {
    // ... existing reducers ...
    voice: voiceReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore LiveKit Room instances in Redux state
        ignoredActions: ['voice/joinChannel/fulfilled'],
        ignoredPaths: ['voice.room'],
      },
    }),
});
```

### 5. Enhanced Voice Channel Components

#### Updated Voice Join Button

```typescript
// frontend/src/components/Voice/VoiceChannelJoinButton.tsx

import { useVoiceConnection } from '../../hooks/useVoiceConnection';

export const VoiceChannelJoinButton: React.FC<{ channelId: string }> = ({ channelId }) => {
  const { voiceState, joinChannel, leaveChannel } = useVoiceConnection();
  
  const isCurrentChannel = voiceState.channelId === channelId;
  const isConnected = voiceState.isConnected && isCurrentChannel;
  
  const handleClick = () => {
    if (isConnected) {
      leaveChannel();
    } else {
      joinChannel(channelId);
    }
  };
  
  return (
    <Button
      variant={isConnected ? "contained" : "outlined"}
      color={isConnected ? "error" : "primary"}
      onClick={handleClick}
      startIcon={isConnected ? <CallEnd /> : <Call />}
    >
      {isConnected ? 'Leave' : 'Join'}
    </Button>
  );
};
```

## 🔒 Connection Recovery

### Automatic Reconnection Strategy

```typescript
// Exponential backoff reconnection
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Max 16 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

// Connection quality monitoring
const monitorConnectionQuality = (room: Room) => {
  room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
    if (participant.isLocal && quality === ConnectionQuality.Poor) {
      // Warn user about poor connection
      // Maybe reduce video quality
    }
  });
};
```

### Token Refresh Strategy

```typescript
// Proactive token refresh before expiration
const refreshTokenBeforeExpiry = async (room: Room) => {
  // JWT tokens typically expire after 1 hour
  // Refresh 5 minutes before expiry
  const refreshInterval = 55 * 60 * 1000; // 55 minutes
  
  setInterval(async () => {
    try {
      const response = await fetch(`/api/livekit/token/${channelId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const { token } = await response.json();
      
      // Update room with new token
      await room.switchActiveServer(process.env.REACT_APP_LIVEKIT_URL!, token);
    } catch (error) {
      console.error('Failed to refresh voice token:', error);
    }
  }, refreshInterval);
};
```

## 📁 File Structure

### New Files
```
frontend/src/features/voice/
├── voiceSlice.ts              # Global voice state management
└── voiceTypes.ts              # Voice-related type definitions

frontend/src/hooks/
└── useVoiceConnection.ts      # Global voice connection hook

frontend/src/components/Voice/
├── PersistentVoiceBar.tsx     # App-level persistent voice UI
└── VoiceConnectionStatus.tsx  # Connection status indicator
```

### Modified Files
```
frontend/src/App.tsx                           # Integrate persistent voice bar
frontend/src/app/store.ts                      # Add voice reducer
frontend/src/components/Voice/VoiceChannelJoinButton.tsx  # Use global state
frontend/src/components/Voice/VoiceBottomBar.tsx          # Integrate with global state
```

## 🧪 Testing Strategy

### Unit Tests
- Voice state management (Redux slice)
- Connection recovery logic
- Voice control functions
- Component rendering with different states

### Integration Tests
- Voice persistence across navigation
- Automatic reconnection scenarios
- Token refresh functionality
- Multiple tab behavior

### Manual Testing Checklist
- [ ] Join voice channel from any page
- [ ] Navigate between pages while in voice
- [ ] Voice connection persists across navigation
- [ ] Voice controls work from persistent bar
- [ ] Automatic reconnection after network issues
- [ ] Multiple participants join/leave correctly
- [ ] Connection status updates properly
- [ ] Proper cleanup when leaving channel

## ⏱️ Implementation Timeline

**Estimated Time: 1-2 weeks**

### Week 1: Core Implementation
- [ ] Create voice Redux slice
- [ ] Implement global voice hook
- [ ] Build persistent voice bar component
- [ ] Integrate with app routing

### Week 2: Polish & Reliability
- [ ] Add connection recovery logic
- [ ] Implement token refresh
- [ ] Add connection quality monitoring
- [ ] Testing and bug fixes

## 🚀 Success Metrics

- Voice connection survives 100% of page navigations
- Automatic reconnection success rate >90%
- Voice bar responds to controls within 200ms
- Zero voice drops during normal navigation
- Connection quality remains stable across pages

## 🔗 Dependencies

- Redux Toolkit (existing)
- LiveKit React SDK (existing)
- Material-UI (existing)
- React Router (existing)

## 🎯 Future Enhancements

### Advanced Features
- Voice activity detection indicators
- Noise suppression controls  
- Push-to-talk functionality
- Voice channel switching without disconnection
- Multi-channel voice support

### Performance Optimizations
- Connection pooling for faster joins
- Predictive token refresh
- Background connection maintenance
- Bandwidth adaptation based on connection quality

## 📝 Notes

- Voice state must be carefully managed to prevent memory leaks
- LiveKit Room instances should not be stored directly in Redux (use middleware)
- Connection recovery should be gradual to avoid overwhelming the server
- Consider browser tab visibility API for background connection management
- Token security is critical - never expose tokens in client logs