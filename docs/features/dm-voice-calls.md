# DM Voice & Video Calls Feature

**Status**: 🟡 **80% Complete** - Core infrastructure implemented, testing and notifications pending

**Discord Parity**: ✅ Matches Discord's DM voice call pattern

---

## 📋 Overview

This feature enables voice and video calls in Direct Messages (both 1:1 and group DMs), matching Discord's call functionality. Users can start audio-only or video calls directly from DM headers, with automatic ringing for all participants.

### Key Features

- **Discord-Style Call Flow**: First user to join triggers "call started" event that rings all DM members
- **Unified Voice System**: Reuses existing LiveKit + voice presence infrastructure
- **Context-Aware Controls**: Voice bottom bar works for both channel and DM voice
- **Phone/Video Icons**: Start calls directly from DM header
- **Full Voice Features**: Mute, deafen, video, screen share, device switching

---

## ✅ Completed Implementation (80%)

### Backend Implementation

#### 1. Voice Presence Service Extension
**File**: `backend/src/voice-presence/voice-presence.service.ts`

**Added DM Support:**
- DM-specific Redis key prefixes for isolation
- `joinDmVoice(dmGroupId, user)` - Join DM call with membership verification
- `leaveDmVoice(dmGroupId, userId)` - Leave DM call
- `getDmPresence(dmGroupId)` - Get current call participants
- `updateDmVoiceState(dmGroupId, userId, updates)` - Update mute/video/screen states

**Ringing Logic:**
```typescript
// First user to join triggers DM_VOICE_CALL_STARTED (rings everyone)
const existingMembers = await client.smembers(dmMembersKey);
const isFirstUser = existingMembers.length === 0;

if (isFirstUser) {
  this.websocketService.sendToRoom(
    `dm:${dmGroupId}`,
    ServerEvents.DM_VOICE_CALL_STARTED,
    { dmGroupId, user: userPresence }
  );
} else {
  this.websocketService.sendToRoom(
    `dm:${dmGroupId}`,
    ServerEvents.DM_VOICE_USER_JOINED,
    { dmGroupId, user: userPresence }
  );
}
```

**Redis Architecture:**
- `dm_voice_presence:user:{userId}` - JSON user state
- `dm_voice_presence:dm:{dmGroupId}` - SET of user IDs in call
- `dm_voice_presence:user_dms:{userId}` - SET of DM group IDs user is in
- O(1) performance using SETs (production-safe)

#### 2. REST API Endpoints
**File**: `backend/src/voice-presence/voice-presence.controller.ts`

**New Controller**: `DmVoicePresenceController`

**Endpoints:**
| Method | Path | Description | RBAC |
|--------|------|-------------|------|
| GET | `/dm-groups/:dmGroupId/voice-presence` | Get call participants | READ_DM |
| POST | `/dm-groups/:dmGroupId/voice-presence/join` | Join DM call | SEND_DM |
| DELETE | `/dm-groups/:dmGroupId/voice-presence/leave` | Leave DM call | SEND_DM |
| PUT | `/dm-groups/:dmGroupId/voice-presence/state` | Update voice state | SEND_DM |

**RBAC Integration:**
```typescript
@RbacResource({
  type: RbacResourceType.DM_GROUP,
  idKey: 'dmGroupId',
  source: ResourceIdSource.PARAM,
})
```

#### 3. WebSocket Events
**File**: `backend/src/websocket/events.enum/server-events.enum.ts`

**Added Events:**
```typescript
enum ServerEvents {
  // DM Voice Calls
  DM_VOICE_CALL_STARTED = 'dmVoiceCallStarted',  // Rings all members
  DM_VOICE_USER_JOINED = 'dmVoiceUserJoined',    // User joined
  DM_VOICE_USER_LEFT = 'dmVoiceUserLeft',        // User left
  DM_VOICE_USER_UPDATED = 'dmVoiceUserUpdated',  // State changed
}
```

**Event Payloads:**
- `DM_VOICE_CALL_STARTED`: `{ dmGroupId, user: VoicePresenceUser }`
- `DM_VOICE_USER_JOINED`: `{ dmGroupId, user: VoicePresenceUser }`
- `DM_VOICE_USER_LEFT`: `{ dmGroupId, userId }`
- `DM_VOICE_USER_UPDATED`: `{ dmGroupId, user: VoicePresenceUser }`

#### 4. LiveKit Token Generation
**File**: `backend/src/livekit/livekit.controller.ts`

**Endpoint:**
```typescript
POST /livekit/dm-token
{
  roomId: string;      // DM group ID
  identity?: string;   // User ID
  name?: string;       // Display name
}
```

**RBAC**: `SEND_DM` permission on `DM_GROUP` resource

---

### Frontend Implementation

#### 1. Voice Slice Extension
**File**: `frontend/src/features/voice/voiceSlice.ts`

**Added Context Support:**
```typescript
type VoiceContextType = 'channel' | 'dm' | null;

interface VoiceState {
  contextType: VoiceContextType;

  // Channel fields
  currentChannelId: string | null;
  channelName: string | null;
  communityId: string | null;

  // DM fields
  currentDmGroupId: string | null;
  dmGroupName: string | null;

  // Shared voice state
  isConnected: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  participants: VoicePresenceUser[];
}
```

**Actions:**
- `setConnected(channelInfo)` - Sets `contextType: 'channel'`
- `setDmConnected(dmInfo)` - Sets `contextType: 'dm'`
- `setDisconnected()` - Resets all state

#### 2. API Endpoints (RTK Query)
**File**: `frontend/src/features/voice-presence/voicePresenceApiSlice.ts`

**DM Endpoints:**
```typescript
getDmPresence: builder.query<DmPresenceResponse, string>
joinDmVoice: builder.mutation<DmVoiceActionResponse, string>
leaveDmVoice: builder.mutation<DmVoiceActionResponse, string>
updateDmVoiceState: builder.mutation<DmVoiceActionResponse, { dmGroupId, updates }>
```

**File**: `frontend/src/features/livekit/livekitApiSlice.ts`

**DM Token:**
```typescript
generateDmToken: builder.mutation<TokenResponse, CreateTokenRequest>
```

**Optimistic Updates**: DM voice state updates use optimistic caching like channel voice

#### 3. Voice Thunks
**File**: `frontend/src/features/voice/voiceThunks.ts`

**DM-Specific Thunks:**
```typescript
// Join/Leave
joinDmVoice({ dmGroupId, dmGroupName, user, connectionInfo, socket, setRoom })
leaveDmVoice({ socket, getRoom, setRoom })

// Toggle Controls
toggleDmAudio({ getRoom })
toggleDmVideo({ getRoom })
toggleDmScreenShare({ getRoom })
toggleDmMute()
toggleDmDeafen()
```

**Join Flow:**
1. Dispatch `setConnecting(true)`
2. Generate LiveKit DM token via API
3. Call backend join endpoint (`/dm-groups/:id/voice-presence/join`)
4. Connect to LiveKit room
5. Dispatch `setDmConnected({ dmGroupId, dmGroupName })`
6. Backend broadcasts WebSocket event

#### 4. Context-Aware Voice Hook
**File**: `frontend/src/hooks/useVoiceConnection.ts`

**Smart Dispatching:**
```typescript
const handleToggleMute = useCallback(async () => {
  if (voiceState.contextType === 'dm') {
    await dispatch(toggleDmMute()).unwrap();
  } else {
    await dispatch(toggleMute()).unwrap();
  }
}, [dispatch, voiceState.contextType]);
```

**All toggle actions check `contextType` and route to correct thunk automatically!**

#### 5. DM Voice Controls Component
**File**: `frontend/src/components/DirectMessage/DMVoiceControls.tsx`

**Features:**
- Phone icon - Start audio call
- Video icon - Start video call (auto-enables camera)
- Active indicator when in call (pulsing green dot)
- Disabled state when in another call
- Loading spinner during connection

**Usage:**
```tsx
<DMVoiceControls
  dmGroupId={dmGroup.id}
  dmGroupName={dmGroup.name}
/>
```

#### 6. DM Chat Header
**File**: `frontend/src/components/DirectMessages/DMChatHeader.tsx`

**Features:**
- DM group name display
- Optional back button (mobile)
- Voice controls (phone/video icons)
- Consistent styling

**Integration:**
```tsx
<DMChatHeader
  dmGroupId={selectedDmGroupId}
  dmGroupName={getDmDisplayName(selectedDmGroup)}
  showBackButton={isMobile}
  onBack={() => setSelectedDmGroupId(undefined)}
/>
```

#### 7. Voice Bottom Bar Enhancement
**File**: `frontend/src/components/Voice/VoiceBottomBar.tsx`

**Context-Aware Display:**
```typescript
const displayName = state.contextType === 'dm'
  ? state.dmGroupName || 'Direct Message'
  : state.channelName || 'Voice Channel';

const displayType = state.contextType === 'dm'
  ? 'DM Voice Call'
  : 'Voice Connected';
```

**Features:**
- Shows for both channel and DM calls
- Hides channel-specific UI (user list) when in DM
- All controls work in both contexts (mute, deafen, video, screen share, settings, disconnect)

#### 8. DM Voice Hook
**File**: `frontend/src/hooks/useDmVoiceConnection.ts`

DM-specific version of `useVoiceConnection` for direct usage if needed.

---

## ❌ Pending Implementation (20%)

### 1. Ringing/Notification UI

**Status**: ❌ Not Started

**What's Needed:**
- Listen for `DM_VOICE_CALL_STARTED` WebSocket event
- Show ringing notification dialog/snackbar when someone starts a call
- "Join Call" and "Dismiss" buttons
- Play ringing sound (optional)
- Auto-dismiss after timeout (e.g., 30 seconds)

**Implementation Location:**
- Create `DMCallNotification.tsx` component
- Add WebSocket listener in `useVoiceEvents.ts` or new `useDmVoiceEvents.ts`
- Use notification context or Material-UI Snackbar

**Example Flow:**
```typescript
socket.on(ServerEvents.DM_VOICE_CALL_STARTED, ({ dmGroupId, user }) => {
  // Show notification: "John started a call"
  showCallNotification({
    dmGroupId,
    dmGroupName: "John",
    onJoin: () => actions.joinDmVoice(dmGroupId, dmGroupName),
    onDismiss: () => hideNotification(),
  });
});
```

### 2. DM Voice WebSocket Event Listeners

**Status**: ❌ Not Started

**What's Needed:**
- Listen for all DM voice events in existing voice event handlers
- Update participant list when users join/leave/update
- Handle edge cases (call ended, kicked from DM, etc.)

**Events to Handle:**
| Event | Action |
|-------|--------|
| `DM_VOICE_CALL_STARTED` | Show ringing UI if not already in call |
| `DM_VOICE_USER_JOINED` | Add user to participants, update UI |
| `DM_VOICE_USER_LEFT` | Remove user from participants |
| `DM_VOICE_USER_UPDATED` | Update user's mute/video/screen state |

**Implementation Location:**
- `frontend/src/hooks/useVoiceEvents.ts` - Add DM event listeners
- Or create `frontend/src/hooks/useDmVoiceEvents.ts` for separation

**Example:**
```typescript
useEffect(() => {
  if (!socket) return;

  socket.on(ServerEvents.DM_VOICE_USER_JOINED, ({ dmGroupId, user }) => {
    if (voiceState.currentDmGroupId === dmGroupId) {
      dispatch(updateParticipant(user));
    }
  });

  return () => {
    socket.off(ServerEvents.DM_VOICE_USER_JOINED);
  };
}, [socket, voiceState.currentDmGroupId]);
```

### 3. End-to-End Testing

**Status**: ❌ Not Started

**Test Scenarios:**

**1:1 DM Voice Call:**
- [ ] User A starts audio call in 1:1 DM
- [ ] User B receives ringing notification
- [ ] User B joins call
- [ ] Both users can hear each other
- [ ] Mute/unmute works for both users
- [ ] Video toggle works
- [ ] Screen share works
- [ ] Either user can disconnect
- [ ] Call ends properly when last user leaves

**Group DM Voice Call:**
- [ ] User A starts call in 3-person DM
- [ ] Users B and C receive notifications
- [ ] Both join call
- [ ] All 3 users connected and can communicate
- [ ] User B leaves, others remain connected
- [ ] User A ends call, disconnects all

**Edge Cases:**
- [ ] User already in channel call tries to join DM call (should leave channel first)
- [ ] User already in DM call A tries to join DM call B (should leave A first)
- [ ] User gets removed from DM while in call (should disconnect)
- [ ] Connection drops and reconnects
- [ ] LiveKit token expiration handling

**Device Switching:**
- [ ] Audio input/output switching works in DM calls
- [ ] Video device switching works in DM calls
- [ ] Settings persist across calls

---

## 📁 Files Created/Modified

### Backend Files Created
✅ None (extended existing files)

### Backend Files Modified
1. ✅ `backend/src/voice-presence/voice-presence.service.ts` - Added DM methods
2. ✅ `backend/src/voice-presence/voice-presence.controller.ts` - Added `DmVoicePresenceController`
3. ✅ `backend/src/voice-presence/voice-presence.module.ts` - Registered new controller
4. ✅ `backend/src/livekit/livekit.controller.ts` - Added `/dm-token` endpoint
5. ✅ `backend/src/websocket/events.enum/server-events.enum.ts` - Added DM voice events

### Frontend Files Created
1. ✅ `frontend/src/hooks/useDmVoiceConnection.ts` - DM-specific voice hook
2. ✅ `frontend/src/components/DirectMessage/DMVoiceControls.tsx` - Voice control buttons
3. ✅ `frontend/src/components/DirectMessages/DMChatHeader.tsx` - DM header with controls

### Frontend Files Modified
1. ✅ `frontend/src/features/voice/voiceSlice.ts` - Added `contextType` and DM fields
2. ✅ `frontend/src/features/voice/voiceThunks.ts` - Added DM voice thunks
3. ✅ `frontend/src/features/voice-presence/voicePresenceApiSlice.ts` - Added DM endpoints
4. ✅ `frontend/src/features/livekit/livekitApiSlice.ts` - Added `generateDmToken`
5. ✅ `frontend/src/hooks/useVoiceConnection.ts` - Made context-aware
6. ✅ `frontend/src/components/Voice/VoiceBottomBar.tsx` - Support both contexts
7. ✅ `frontend/src/pages/DirectMessagesPage.tsx` - Integrated `DMChatHeader`

---

## 🔌 Integration Points

### Backend Integration
- **Voice Presence Service**: Unified Redis architecture for both channels and DMs
- **RBAC System**: Uses existing `DM_GROUP` resource type with `SEND_DM` permission
- **WebSocket Service**: Reuses room-based broadcasting (`dm:{dmGroupId}`)
- **LiveKit Service**: Same token generation, different endpoint

### Frontend Integration
- **Voice State**: Single Redux slice handles both channel and DM voice
- **Voice Controls**: VoiceBottomBar works for both contexts automatically
- **LiveKit Room**: Same Room instance, different room IDs
- **Device Settings**: Shared device preferences across all voice contexts

---

## 🎯 Next Steps (To Complete Feature)

### Priority 1: WebSocket Listeners (1-2 hours)
1. Add DM voice event listeners to `useVoiceEvents.ts`
2. Handle `DM_VOICE_USER_JOINED/LEFT/UPDATED` events
3. Update participant list in real-time

### Priority 2: Ringing UI (2-3 hours)
1. Create `DMCallNotification.tsx` component
2. Listen for `DM_VOICE_CALL_STARTED` event
3. Show ringing dialog with join/dismiss buttons
4. Add optional ringing sound
5. Auto-dismiss after timeout

### Priority 3: Testing (4-6 hours)
1. Manual testing of all scenarios (1:1, group, edge cases)
2. Device switching verification
3. Multi-tab testing (presence system)
4. Error handling and edge case verification
5. Performance testing (Redis load, LiveKit connections)

### Priority 4: Documentation Update (1 hour)
1. Update `discord-parity.md` - Mark "Voice/Video DMs" as complete
2. Update `incomplete.md` - Mark DM voice as 100% complete
3. Add user-facing documentation for starting DM calls

---

## 📊 Discord Parity Impact

**Before:** Voice/Video DMs = ❌ Missing
**After (when complete):** Voice/Video DMs = ✅ Complete

**Social Features Category:**
- Before: 21% parity
- After: ~35% parity (+14%)

**Overall Parity:**
- Before: 62%
- After: ~65% (+3%)

---

## 🏗️ Architecture Decisions

### Why Unified Voice System?
**Decision**: Extend existing voice infrastructure instead of separate DM voice system

**Rationale:**
- Code reuse (70% of voice logic is identical)
- Single LiveKit connection architecture
- Consistent user experience
- Easier maintenance

**Trade-off:**
- Slightly more complex context switching logic
- BUT: Handled cleanly with `contextType` field

### Why Context-Aware Hook Pattern?
**Decision**: Make `useVoiceConnection` context-aware instead of separate hooks

**Rationale:**
- VoiceBottomBar can work for both without changes
- Single source of truth for voice state
- Simpler component code (no conditional hook imports)

**Trade-off:**
- Hook is slightly more complex internally
- BUT: Complexity hidden from consumers

### Why Redis SETs for Presence?
**Decision**: Use Redis SETs instead of KEYS pattern

**Rationale:**
- O(1) performance for all operations
- Production-safe (KEYS is O(N) and blocks Redis)
- Scales to thousands of concurrent DM calls

**Trade-off:**
- Slightly more complex key structure
- BUT: Performance gain is massive

---

## 🐛 Known Limitations

### Current Limitations
1. **No Ringing UI**: Users must manually check if call started
2. **No WebSocket Listeners**: Participant list doesn't update in real-time
3. **No Call History**: Calls aren't logged/tracked
4. **No Missed Call Notifications**: Users don't know if they missed a call

### Future Enhancements (Not Blocking)
- Call history/log in DM
- Missed call indicators
- Call duration tracking
- Call recording (if needed)
- Picture-in-Picture mode for video
- Noise suppression (LiveKit feature)
- Background blur for video

---

## 📚 Related Documentation

- [Voice & Video System](./voice-video.md) - Overall voice architecture
- [Voice Presence](../modules/voice/voice-presence.md) - Presence tracking system
- [LiveKit Integration](../integrations/livekit.md) - WebRTC implementation
- [Direct Messages](./direct-messages.md) - DM system overview
- [WebSocket Events](../architecture/websocket-events.md) - Event system

---

## 👥 Usage Examples

### Starting a Voice Call
```typescript
// In a DM component
import { DMVoiceControls } from './DMVoiceControls';

<DMChatHeader
  dmGroupId={dmGroup.id}
  dmGroupName={dmGroup.name}
/>
// DMChatHeader includes DMVoiceControls automatically
```

### Programmatic Call Join
```typescript
import { useVoiceConnection } from '@/hooks/useVoiceConnection';

const { actions } = useVoiceConnection();

// Join DM voice call
await actions.joinDmVoice(dmGroupId, dmGroupName);

// Toggle controls work automatically based on context
await actions.toggleMute();
await actions.toggleVideo();
```

### Checking Call State
```typescript
const { state } = useVoiceConnection();

if (state.contextType === 'dm' && state.currentDmGroupId === dmGroupId) {
  // User is in this DM's call
}

if (state.isConnected) {
  // User is in any call (channel or DM)
}
```

---

**Last Updated**: 2025-10-26
**Implementation Time**: ~6-8 hours
**Remaining Time**: ~4-6 hours
**Total Effort**: ~12 hours
