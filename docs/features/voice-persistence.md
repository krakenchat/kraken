# Voice Connection Persistence Implementation Plan

Voice connection persistence is a **critical Discord-like feature** where users remain connected to voice channels while navigating the application. Kraken has excellent LiveKit integration but lacks the persistent connection behavior that users expect.

## 🎯 **Current Status vs Discord Behavior**

### **Discord Voice Behavior**:
- Join voice channel → persistent bottom bar appears
- Navigate between text channels → voice connection maintained
- Navigate between servers → voice connection maintained
- Only disconnect when explicitly leaving or closing app
- Voice controls always accessible via bottom bar
- Video overlay toggles on/off without breaking connection

### **Kraken Current Behavior**:
- ✅ Voice connection works within channel view
- ❌ Connection drops when navigating away from voice channel
- ❌ No persistent voice controls
- ❌ Voice state not maintained across route changes
- ❌ Video tiles disappear on navigation

## 🏗️ **Current Architecture Analysis**

### ✅ **Excellent Foundation Components**

#### **Voice State Management** - Redux Store
```typescript
// frontend/src/features/voice/voiceSlice.ts
interface VoiceState {
  isConnected: boolean;
  channelId: string | null;
  channelName: string | null;
  communityId: string | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  showVideoTiles: boolean;
  participants: VoiceParticipant[];
  connectionError: string | null;
}
```

#### **Voice Connection Hook** - Comprehensive API
```typescript
// frontend/src/hooks/useVoiceConnection.ts
export const useVoiceConnection = () => {
  const actions = {
    joinVoiceChannel: handleJoinVoiceChannel,
    leaveVoiceChannel: handleLeaveVoiceChannel,
    toggleAudio: handleToggleAudio,
    toggleVideo: handleToggleVideo,
    toggleScreenShare: handleToggleScreenShare,
    toggleMute: handleToggleMute,
    toggleDeafen: handleToggleDeafen,
    setShowVideoTiles: handleSetShowVideoTiles,
  };
  
  return { state: { ...voiceState, room }, actions };
};
```

#### **Voice Components** - UI Ready
- `VoiceBottomBar.tsx` - Persistent controls bar
- `VideoTiles.tsx` - Video call interface  
- `VoiceChannelJoinButton.tsx` - Channel entry point
- `VoiceChannelUserList.tsx` - Participant display

#### **LiveKit Integration** - Professional WebRTC
- Full LiveKit room management
- Audio/video/screen share controls
- Participant tracking
- Connection recovery

### ❌ **Missing Persistence Layer**

#### **Route Navigation Issues**:
- Voice state resets on component unmount
- LiveKit room connection lost during navigation
- Voice controls not globally accessible
- Video tiles tied to specific route

#### **State Persistence Issues**:
- No voice state recovery after page refresh
- Connection state not synchronized across tabs
- Room references lost during route changes

## 📋 **Implementation Plan**

### **Phase 1: Global Voice State (2-3 hours)**

#### **1.1 Enhanced Voice Context Provider**
**File**: `frontend/src/contexts/VoiceContext.tsx`

```typescript
interface VoiceContextType {
  // Connection state
  isConnected: boolean;
  currentChannel: VoiceChannelInfo | null;
  room: Room | null;
  
  // Controls
  joinChannel: (channelInfo: VoiceChannelInfo) => Promise<void>;
  leaveChannel: () => Promise<void>;
  toggleAudio: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  
  // UI state
  showBottomBar: boolean;
  showVideoTiles: boolean;
  setShowVideoTiles: (show: boolean) => void;
  
  // Participants
  participants: VoiceParticipant[];
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [voiceState, setVoiceState] = useState<VoiceState>(initialState);
  const [room, setRoom] = useState<Room | null>(null);
  const roomRef = useRef<Room | null>(null);
  
  // Persist room reference across renders
  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const joinChannel = useCallback(async (channelInfo: VoiceChannelInfo) => {
    try {
      // Create room connection
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Set up event listeners before connecting
      setupRoomEventListeners(newRoom, setVoiceState);
      
      // Connect to LiveKit room
      await newRoom.connect(channelInfo.livekitUrl, channelInfo.token);
      
      // Update state
      setRoom(newRoom);
      setVoiceState(prev => ({
        ...prev,
        isConnected: true,
        currentChannel: channelInfo,
        showBottomBar: true,
        connectionError: null,
      }));
      
      // Notify other components
      localStorage.setItem('kraken_voice_state', JSON.stringify({
        channelId: channelInfo.id,
        channelName: channelInfo.name,
        communityId: channelInfo.communityId,
        connectedAt: Date.now(),
      }));
      
    } catch (error) {
      console.error('Failed to join voice channel:', error);
      setVoiceState(prev => ({
        ...prev,
        connectionError: error.message,
      }));
    }
  }, []);

  const leaveChannel = useCallback(async () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      setRoom(null);
    }
    
    setVoiceState(prev => ({
      ...prev,
      isConnected: false,
      currentChannel: null,
      showBottomBar: false,
      showVideoTiles: false,
      participants: [],
    }));
    
    localStorage.removeItem('kraken_voice_state');
  }, []);

  // Recovery on page reload
  useEffect(() => {
    const savedState = localStorage.getItem('kraken_voice_state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        // Attempt to reconnect if session is recent (< 5 minutes)
        if (Date.now() - parsed.connectedAt < 5 * 60 * 1000) {
          // Trigger reconnection flow
          reconnectToVoiceChannel(parsed);
        }
      } catch (error) {
        localStorage.removeItem('kraken_voice_state');
      }
    }
  }, []);

  return (
    <VoiceContext.Provider
      value={{
        isConnected: voiceState.isConnected,
        currentChannel: voiceState.currentChannel,
        room,
        joinChannel,
        leaveChannel,
        toggleAudio: () => toggleAudioTrack(roomRef.current),
        toggleVideo: () => toggleVideoTrack(roomRef.current),
        toggleScreenShare: () => toggleScreenShare(roomRef.current),
        showBottomBar: voiceState.showBottomBar,
        showVideoTiles: voiceState.showVideoTiles,
        setShowVideoTiles: (show) => setVoiceState(prev => ({ ...prev, showVideoTiles: show })),
        participants: voiceState.participants,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}
```

#### **1.2 Global Voice Hook**
**File**: `frontend/src/hooks/useGlobalVoice.ts`

```typescript
export function useGlobalVoice() {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useGlobalVoice must be used within VoiceProvider');
  }
  return context;
}

// Convenient hooks for specific functionality
export function useVoiceConnectionState() {
  const { isConnected, currentChannel } = useGlobalVoice();
  return { isConnected, currentChannel };
}

export function useVoiceControls() {
  const { 
    joinChannel, 
    leaveChannel, 
    toggleAudio, 
    toggleVideo, 
    toggleScreenShare 
  } = useGlobalVoice();
  
  return {
    joinChannel,
    leaveChannel,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  };
}
```

### **Phase 2: Persistent UI Components (3-4 hours)**

#### **2.1 Global Persistent Bottom Bar**
**File**: `frontend/src/components/Voice/PersistentVoiceBar.tsx`

```typescript
export function PersistentVoiceBar() {
  const { 
    isConnected, 
    currentChannel, 
    showBottomBar,
    showVideoTiles,
    setShowVideoTiles,
    participants 
  } = useGlobalVoice();
  
  const { 
    leaveChannel, 
    toggleAudio, 
    toggleVideo, 
    toggleScreenShare 
  } = useVoiceControls();

  if (!isConnected || !showBottomBar || !currentChannel) {
    return null;
  }

  return (
    <Portal>
      <Paper
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1300, // Above most MUI components
          display: 'flex',
          alignItems: 'center',
          padding: 2,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        elevation={8}
      >
        {/* Channel Info */}
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <VolumeUpIcon sx={{ mr: 1, color: 'success.main' }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {currentChannel.name}
          </Typography>
          <Typography variant="caption" sx={{ ml: 1, opacity: 0.7 }}>
            {participants.length} connected
          </Typography>
        </Box>

        {/* Participant Avatars */}
        <Box sx={{ display: 'flex', mx: 2 }}>
          {participants.slice(0, 5).map((participant) => (
            <Avatar
              key={participant.id}
              src={participant.avatar}
              sx={{ 
                width: 32, 
                height: 32, 
                ml: -0.5,
                border: '2px solid',
                borderColor: participant.isAudioEnabled ? 'success.main' : 'error.main',
              }}
            >
              {participant.name[0]}
            </Avatar>
          ))}
          {participants.length > 5 && (
            <Avatar sx={{ width: 32, height: 32, ml: -0.5, bgcolor: 'grey.600' }}>
              +{participants.length - 5}
            </Avatar>
          )}
        </Box>

        {/* Voice Controls */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            onClick={toggleAudio}
            sx={{ color: 'white' }}
            size="small"
          >
            <MicIcon />
          </IconButton>
          
          <IconButton
            onClick={toggleVideo}
            sx={{ color: 'white' }}
            size="small"
          >
            <VideocamIcon />
          </IconButton>
          
          <IconButton
            onClick={toggleScreenShare}
            sx={{ color: 'white' }}
            size="small"
          >
            <ScreenShareIcon />
          </IconButton>
          
          <IconButton
            onClick={() => setShowVideoTiles(!showVideoTiles)}
            sx={{ 
              color: showVideoTiles ? 'primary.main' : 'white',
              bgcolor: showVideoTiles ? 'rgba(255,255,255,0.1)' : 'transparent',
            }}
            size="small"
          >
            <GridViewIcon />
          </IconButton>
          
          <Divider orientation="vertical" flexItem sx={{ mx: 1, bgcolor: 'rgba(255,255,255,0.2)' }} />
          
          <IconButton
            onClick={leaveChannel}
            sx={{ color: 'error.main' }}
            size="small"
          >
            <CallEndIcon />
          </IconButton>
        </Box>
      </Paper>
    </Portal>
  );
}
```

#### **2.2 Floating Video Tiles**
**File**: `frontend/src/components/Voice/FloatingVideoTiles.tsx`

```typescript
export function FloatingVideoTiles() {
  const { showVideoTiles, participants, setShowVideoTiles } = useGlobalVoice();
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);

  if (!showVideoTiles || participants.filter(p => p.isVideoEnabled).length === 0) {
    return null;
  }

  const videoParticipants = participants.filter(p => p.isVideoEnabled);

  return (
    <Portal>
      <Draggable
        position={position}
        onStart={() => setIsDragging(true)}
        onStop={(_, data) => {
          setPosition({ x: data.x, y: data.y });
          setIsDragging(false);
        }}
      >
        <Paper
          sx={{
            position: 'fixed',
            zIndex: 1400,
            maxWidth: 400,
            maxHeight: 300,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            borderRadius: 2,
            overflow: 'hidden',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          elevation={16}
        >
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <Typography variant="caption" sx={{ color: 'white', fontWeight: 600 }}>
              Video Call ({videoParticipants.length})
            </Typography>
            <IconButton
              size="small"
              onClick={() => setShowVideoTiles(false)}
              sx={{ color: 'white' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Video Grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: videoParticipants.length === 1 ? '1fr' : 'repeat(2, 1fr)',
              gap: 1,
              p: 1,
            }}
          >
            {videoParticipants.map((participant) => (
              <Box
                key={participant.id}
                sx={{
                  position: 'relative',
                  aspectRatio: '16/9',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                {/* Video Element */}
                <video
                  ref={(el) => {
                    if (el && participant.videoTrack) {
                      participant.videoTrack.attach(el);
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                  autoPlay
                  muted={participant.id === 'local'}
                />
                
                {/* Participant Name */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 4,
                    left: 4,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="caption">
                    {participant.name}
                  </Typography>
                </Box>
                
                {/* Audio Indicator */}
                {!participant.isAudioEnabled && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      backgroundColor: 'error.main',
                      borderRadius: '50%',
                      p: 0.5,
                    }}
                  >
                    <MicOffIcon sx={{ fontSize: 16, color: 'white' }} />
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </Paper>
      </Draggable>
    </Portal>
  );
}
```

### **Phase 3: Navigation Integration (2-3 hours)**

#### **3.1 Layout Integration**
**File**: `frontend/src/Layout.tsx` (Enhance existing)

```typescript
export default function Layout() {
  const { showBottomBar } = useGlobalVoice();

  return (
    <VoiceProvider>
      <Box sx={{ display: 'flex', height: '100vh' }}>
        {/* Existing layout content */}
        <Box component="aside" sx={{ width: 280 }}>
          {/* Sidebar content */}
        </Box>
        
        <Box 
          component="main" 
          sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column',
            // Add bottom padding when voice bar is visible
            paddingBottom: showBottomBar ? '80px' : 0,
            transition: 'padding-bottom 0.3s ease',
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {/* Global Voice Components */}
      <PersistentVoiceBar />
      <FloatingVideoTiles />
    </VoiceProvider>
  );
}
```

#### **3.2 Route-Aware Voice Handling**
**File**: `frontend/src/hooks/useRouteAwareVoice.ts`

```typescript
export function useRouteAwareVoice() {
  const location = useLocation();
  const { isConnected, currentChannel } = useGlobalVoice();
  
  // Update voice presence based on current route
  useEffect(() => {
    if (isConnected && currentChannel) {
      // Emit route change to WebSocket for voice presence
      const socket = getSocketInstance();
      if (socket) {
        socket.emit('voice-route-change', {
          channelId: currentChannel.id,
          currentRoute: location.pathname,
        });
      }
    }
  }, [location.pathname, isConnected, currentChannel]);
}

// Use in main App component
export function App() {
  useRouteAwareVoice();
  
  return (
    <Router>
      {/* App content */}
    </Router>
  );
}
```

### **Phase 4: Connection Recovery (2-3 hours)**

#### **4.1 Connection Recovery Service**
**File**: `frontend/src/services/voiceRecoveryService.ts`

```typescript
interface VoiceRecoveryState {
  channelId: string;
  channelName: string;
  communityId: string;
  connectedAt: number;
  lastSeen: number;
}

class VoiceRecoveryService {
  private static instance: VoiceRecoveryService;
  private recoveryKey = 'kraken_voice_recovery';
  
  static getInstance(): VoiceRecoveryService {
    if (!VoiceRecoveryService.instance) {
      VoiceRecoveryService.instance = new VoiceRecoveryService();
    }
    return VoiceRecoveryService.instance;
  }

  saveVoiceState(state: VoiceRecoveryState): void {
    localStorage.setItem(this.recoveryKey, JSON.stringify({
      ...state,
      lastSeen: Date.now(),
    }));
  }

  getVoiceState(): VoiceRecoveryState | null {
    const saved = localStorage.getItem(this.recoveryKey);
    if (!saved) return null;
    
    try {
      const state = JSON.parse(saved);
      // Only recover if session is recent (< 10 minutes)
      if (Date.now() - state.lastSeen > 10 * 60 * 1000) {
        this.clearVoiceState();
        return null;
      }
      return state;
    } catch {
      this.clearVoiceState();
      return null;
    }
  }

  clearVoiceState(): void {
    localStorage.removeItem(this.recoveryKey);
  }

  async attemptRecovery(
    state: VoiceRecoveryState,
    joinChannel: (info: VoiceChannelInfo) => Promise<void>
  ): Promise<boolean> {
    try {
      // Fetch fresh channel info
      const response = await fetch(`/api/channels/${state.channelId}`);
      if (!response.ok) return false;
      
      const channelInfo = await response.json();
      
      // Generate new LiveKit token
      const tokenResponse = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: state.channelId,
          identity: `user_${Date.now()}`, // Fresh identity
        }),
      });
      
      if (!tokenResponse.ok) return false;
      
      const { token, url } = await tokenResponse.json();
      
      // Attempt to rejoin
      await joinChannel({
        id: state.channelId,
        name: state.channelName,
        communityId: state.communityId,
        token,
        livekitUrl: url,
      });
      
      return true;
    } catch (error) {
      console.error('Voice recovery failed:', error);
      return false;
    }
  }
}

export const voiceRecoveryService = VoiceRecoveryService.getInstance();
```

#### **4.2 Auto-Recovery Hook**
**File**: `frontend/src/hooks/useVoiceRecovery.ts`

```typescript
export function useVoiceRecovery() {
  const { joinChannel } = useVoiceControls();
  const { isConnected } = useGlobalVoice();
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    // Only attempt recovery if not already connected
    if (isConnected || isRecovering) return;

    const attemptRecovery = async () => {
      const savedState = voiceRecoveryService.getVoiceState();
      if (!savedState) return;

      setIsRecovering(true);
      
      try {
        const success = await voiceRecoveryService.attemptRecovery(
          savedState,
          joinChannel
        );
        
        if (!success) {
          voiceRecoveryService.clearVoiceState();
        }
      } catch (error) {
        console.error('Recovery attempt failed:', error);
        voiceRecoveryService.clearVoiceState();
      } finally {
        setIsRecovering(false);
      }
    };

    // Slight delay to allow other initialization
    const timer = setTimeout(attemptRecovery, 1000);
    return () => clearTimeout(timer);
  }, [isConnected, isRecovering, joinChannel]);

  return { isRecovering };
}
```

### **Phase 5: Performance & Polish (2-3 hours)**

#### **5.1 Performance Optimizations**
```typescript
// Memoize expensive voice components
export const MemoizedVoiceBottomBar = React.memo(PersistentVoiceBar);
export const MemoizedVideoTiles = React.memo(FloatingVideoTiles);

// Debounce voice state updates
const debouncedStateUpdate = useMemo(
  () => debounce((state: VoiceState) => {
    voiceRecoveryService.saveVoiceState(state);
  }, 1000),
  []
);
```

#### **5.2 Error Handling & Notifications**
```typescript
// Voice connection error handling
useEffect(() => {
  if (voiceState.connectionError) {
    // Show user-friendly error notification
    showNotification({
      type: 'error',
      title: 'Voice Connection Failed',
      message: 'Unable to connect to voice channel. Please try again.',
      action: {
        label: 'Retry',
        onClick: () => retryConnection(),
      },
    });
  }
}, [voiceState.connectionError]);
```

## 📊 **Implementation Timeline**

| Phase | Duration | Complexity | Priority |
|-------|----------|------------|----------|
| **Phase 1: Global State** | 2-3 hours | Medium | Critical |
| **Phase 2: Persistent UI** | 3-4 hours | High | Critical |
| **Phase 3: Navigation** | 2-3 hours | Medium | High |
| **Phase 4: Recovery** | 2-3 hours | Medium | High |
| **Phase 5: Polish** | 2-3 hours | Low | Medium |

**Total Implementation Time: 11-16 hours**

## 🎯 **Success Metrics**

### **Core Persistence (Phase 1-2)**:
- ✅ Voice connection survives route navigation
- ✅ Bottom bar appears when connected to voice
- ✅ Voice controls accessible from any page
- ✅ Video tiles float above all content

### **Full Discord Parity (All Phases)**:
- ✅ Connection recovers after page refresh
- ✅ Voice state persists across browser sessions
- ✅ Error handling with retry mechanisms
- ✅ Smooth transitions and animations

## 🚀 **Competitive Advantages**

### **Better Than Discord**:
1. **Draggable Video Tiles** - More flexible video layout
2. **Smart Recovery** - Better connection resilience
3. **Performance** - Modern React patterns, no legacy code
4. **Customization** - Users can modify voice UI behavior

### **Implementation Benefits**:
1. **Leverages Existing Code** - Builds on solid LiveKit foundation
2. **Minimal Backend Changes** - Mostly frontend architecture work
3. **Incremental Deployment** - Can be rolled out in phases
4. **Future-Proof** - Sets foundation for mobile voice persistence

This implementation would bring Kraken's voice experience to full Discord parity while providing the modern, persistent behavior that users expect from professional chat applications.