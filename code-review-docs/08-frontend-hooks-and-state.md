# 08 — Hooks, State & Data Flow

> **53 primary hooks** organized by domain. TanStack Query for server state, Context for UI state, SocketHub for real-time.

---

## Table of Contents

- [Hook Inventory](#hook-inventory)
- [TanStack Query Patterns](#tanstack-query-patterns)
- [Socket → Cache Update Flow](#socket--cache-update-flow)
- [Key Data Flow Diagrams](#key-data-flow-diagrams)

---

## Hook Inventory

### Core Connectivity (3)

| Hook | File | Purpose |
|------|------|---------|
| `useSocket` | `hooks/useSocket.ts` | Returns Socket.IO instance from context |
| `useSocketConnected` | `hooks/useSocket.ts` | Boolean connection status |
| `useSocketHub` | `socket-hub/useSocketHub.ts` | Central hub: event → cache handler + event bus |
| `useServerEvent` | `socket-hub/useServerEvent.ts` | Subscribe to server events for UI side effects |

### User & Auth (2)

| Hook | File | Purpose |
|------|------|---------|
| `useCurrentUser` | `hooks/useCurrentUser.ts` | Fetches cached user profile via `userControllerGetProfile` |
| `useUserPermissions` | `features/roles/useUserPermissions.ts` | Check RBAC permissions for resource context |

Sub-hooks: `useMyRolesForCommunity`, `useMyRolesForChannel`, `useMyInstanceRoles`, `useCanPerformAction`

### Messages (8)

| Hook | File | Purpose |
|------|------|---------|
| `useMessages` | `hooks/useMessages.ts` | Infinite query for channel/DM messages (25/page) |
| `useSendMessage` | `hooks/useSendMessage.ts` | Unified send for channels + DMs with socket reconnect handling |
| `useMessagePermissions` | `hooks/useMessagePermissions.ts` | canEdit, canDelete, canPin per message |
| `useMessageFileUpload` | `hooks/useMessageFileUpload.ts` | Upload attachments after message creation, optimistic cache |
| `useMessageVisibility` | `hooks/useMessageVisibility.ts` | IntersectionObserver + auto mark as read (50% visible, 1s debounce) |
| `useTypingUsers` | `hooks/useTypingUsers.ts` | Track typing users (8s safety timeout) |
| `useTypingEmitter` | `hooks/useTypingEmitter.ts` | Emit TYPING_START/STOP (3s debounce, 5s idle timeout) |

### Threads (2)

| Hook | File | Purpose |
|------|------|---------|
| `useThreadReplies` | `hooks/useThreadReplies.ts` | Fetch thread replies (limit: 50) |
| `useThreadSubscription` | `hooks/useThreadSubscription.ts` | Subscribe/unsubscribe with optimistic updates |

### Voice & Video (15)

| Hook | File | Purpose |
|------|------|---------|
| `useVoiceConnection` | `hooks/useVoiceConnection.ts` | Core: join/leave, toggle audio/video/screen/deafen, device switching |
| `useRoom` | `hooks/useRoom.ts` | LiveKit Room instance from RoomContext |
| `useLocalMediaState` | `hooks/useLocalMediaState.ts` | Local mic/camera/screen state from LiveKit |
| `useParticipantTracks` | `hooks/useParticipantTracks.ts` | Any participant's media state |
| `useSpeakingDetection` | `hooks/useSpeakingDetection.ts` | Speaking detection with hysteresis (local: AnalyserNode, remote: LiveKit) |
| `useVoicePresenceHeartbeat` | `hooks/useVoicePresenceHeartbeat.ts` | 30s heartbeat refresh for Redis TTL |
| `useScreenShare` | `hooks/useScreenShare.ts` | Platform-aware screen sharing (Electron picker vs browser) |
| `usePushToTalk` | `hooks/usePushToTalk.ts` | PTT key handling (respects input focus) |
| `useVoiceSettings` | `hooks/useVoiceSettings.ts` | Voice activity vs PTT mode, key binding (localStorage) |
| `useVoicePresenceSounds` | `hooks/useVoicePresenceSounds.ts` | Join/leave sounds via useServerEvent |
| `useDeafenEffect` | `hooks/useDeafenEffect.ts` | Mute all remote audio (volume=0), restore on undeafen |
| `useRemoteVolumeEffect` | `hooks/useRemoteVolumeEffect.ts` | Reapply per-user volume from localStorage |
| `useServerMuteEffect` | `hooks/useServerMuteEffect.ts` | Enforce server-side mute via VOICE_CHANNEL_USER_UPDATED |
| `useVoiceRecovery` | `hooks/useVoiceRecovery.ts` | Auto-rejoin voice after page refresh (5 min expiry) |
| `useReplayBuffer` | `hooks/useReplayBuffer.ts` | Auto-manage egress recording during screen share |

### Files & Media (4)

| Hook | File | Purpose |
|------|------|---------|
| `useFileUpload` | `hooks/useFileUpload.ts` | Generic file upload via FormData to /file-upload |
| `useAuthenticatedFile` | `hooks/useAuthenticatedFile.ts` | Fetch file metadata/blob with auth, global cache |
| `useAuthenticatedImage` | `hooks/useAuthenticatedImage.ts` | Alias for useAuthenticatedFile (fetchBlob=true) |
| `useVideoUrl` | `hooks/useVideoUrl.ts` | Auth video URL (Web: plain, Electron: signed URL with auto-refresh) |

### Notifications (5)

| Hook | File | Purpose |
|------|------|---------|
| `useNotifications` | `hooks/useNotifications.ts` | Fetch notifications + unread count, mutations for markAsRead |
| `useAutoMarkNotificationsRead` | `hooks/useAutoMarkNotificationsRead.ts` | Auto-mark on channel/DM view (debounced, dedup via Set) |
| `useNotificationSideEffects` | `hooks/useNotificationSideEffects.ts` | Desktop notifications, sounds, navigation |
| `useNotificationPermission` | `hooks/useNotificationPermission.ts` | Permission state (polls every 5s for changes) |
| `usePushNotifications` | `hooks/usePushNotifications.ts` | VAPID subscription management (Web PWA only) |

### Forms (3)

| Hook | File | Purpose |
|------|------|---------|
| `useProfileForm` | `hooks/useProfileForm.ts` | Profile edit state (displayName, avatar, banner, bio, status) |
| `useCommunityForm` | `hooks/useCommunityForm.ts` | Community create/edit state (name, description, avatar, banner) |
| `useMentionAutocomplete` | `hooks/useMentionAutocomplete.ts` | @mention autocomplete (users, @here/@channel, alias groups) |

### Read Receipts (1)

| Hook | File | Purpose |
|------|------|---------|
| `useReadReceipts` | `hooks/useReadReceipts.ts` | Unread counts per channel/DM, mention counts, totalDmUnreadCount |

### Devices & Settings (3)

| Hook | File | Purpose |
|------|------|---------|
| `useDeviceSettings` | `hooks/useDeviceSettings.ts` | Enumerate audio/video devices, save preferences to localStorage |
| `useDeviceTest` | `hooks/useDeviceTest.ts` | Test devices with real-time feedback (AnalyserNode for audio levels) |
| `useThemeSync` | `hooks/useThemeSync.ts` | Sync theme settings between ThemeContext and server |

### UI & Responsive (3)

| Hook | File | Purpose |
|------|------|---------|
| `useResponsive` | `hooks/useResponsive.ts` | Breakpoint detection: phone/tablet/desktop + orientation + touch |
| `useDebounce` | `hooks/useDebounce.ts` | Simple value debounce with custom delay |

Sub-hooks: `useMobileBreakpoint`, `useTabletBreakpoint`, `useCompactLayout`

### PWA (2)

| Hook | File | Purpose |
|------|------|---------|
| `usePWA` | `hooks/usePWA.ts` | Standalone mode, iOS/Android detection, installability |
| `usePWAInstall` | `hooks/usePWAInstall.ts` | Install prompt + 7-day dismiss persistence |

### Sound & Haptics (2)

| Hook | File | Purpose |
|------|------|---------|
| `useSound` | `hooks/useSound.ts` | Lazy-load and cache WAV files, playSound/stopSound |
| `useHapticFeedback` | `hooks/useHapticFeedback.ts` | Vibration API patterns (light, medium, heavy, success, etc.) |

### Gestures (1)

| Hook | File | Purpose |
|------|------|---------|
| `useSwipeGesture` | `hooks/useSwipeGesture.ts` | Swipe detection with edge detection and velocity |

Sub-hooks: `useLongPress`, `usePullToRefresh`

### Debug (1)

| Hook | File | Purpose |
|------|------|---------|
| `useDebugPanelShortcut` | `hooks/useDebugPanelShortcut.ts` | Ctrl+Shift+D toggle for debug panel |

---

## TanStack Query Patterns

### Query Configuration

```typescript
// Global defaults
{ staleTime: 30_000, retry: 1, refetchOnWindowFocus: false }
```

### Query Key Factories

Generated by OpenAPI SDK. Examples:

```typescript
userControllerGetProfileQueryKey()
channelsControllerFindAllQueryKey({ path: { communityId } })
messagesControllerFindAllForChannelQueryKey({ path: { channelId } })
voicePresenceControllerGetChannelPresenceQueryKey({ path: { channelId } })
```

### Infinite Query (Messages)

```typescript
useInfiniteQuery({
  ...messagesControllerFindAllForChannel({ path: { channelId } }),
  getNextPageParam: (lastPage) => lastPage.continuationToken,
  initialPageParam: undefined,
});
```

Pages are cursor-based with continuation tokens (25 messages per page).

### Mutation Patterns

```typescript
// Optimistic update example (thread subscription)
useMutation({
  mutationFn: () => threadSubscriptionsControllerSubscribe(...),
  onMutate: async () => {
    await queryClient.cancelQueries({ queryKey });
    const previous = queryClient.getQueryData(queryKey);
    queryClient.setQueryData(queryKey, optimisticValue);
    return { previous };
  },
  onError: (err, vars, context) => {
    queryClient.setQueryData(queryKey, context.previous);  // Rollback
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey });  // Refetch truth
  },
});
```

### Cache Update Patterns (via WebSocket)

| Pattern | Method | Use Case |
|---------|--------|----------|
| **Prepend** | `setQueryData(key, prepend(msg))` | New messages |
| **Update in place** | `setQueryData(key, updateById(id, data))` | Edit message, add reaction |
| **Remove** | `setQueryData(key, filterOut(id))` | Delete message |
| **Increment counter** | `setQueryData(key, inc(field))` | Unread counts |
| **Invalidate** | `invalidateQueries({ queryKey })` | Structural changes |
| **Predicate invalidate** | `invalidateQueries({ predicate })` | Cross-query invalidation |

---

## Socket → Cache Update Flow

```
Socket.IO event received
    │
    ├─ 1. useSocketHub listener fires
    │      │
    │      ├─ 2a. handlerRegistry[event] exists?
    │      │       └─ Yes → Run handler(payload, queryClient)
    │      │              └─ setQueryData or invalidateQueries
    │      │
    │      └─ 2b. eventBus.emit(event, payload)
    │              └─ UI components subscribed via useServerEvent
    │              └─ Typing indicators, sounds, scroll behavior
    │
    └─ 3. React components re-render via query cache changes
```

### Example: New Message Arrives

```typescript
// Handler runs:
1. queryClient.setQueryData(messageQueryKey, prependMessage)
2. If DM: invalidateQueries(dmGroupsListKey)  // Update sidebar preview
3. If not own message: setQueryData(unreadCountsKey, incrementUnread)

// Event bus:
4. useServerEvent listeners fire (sound effects, scroll to bottom)
```

### Example: Channel Created

```typescript
// Handler runs:
1. queryClient.invalidateQueries(channelsForCommunityKey)  // Refetch channel list

// Event bus:
2. RoomSubscriptionHandler already joined sockets to new channel room
3. UI re-renders when channel list query resolves
```

---

## Key Data Flow Diagrams

### Message Send Flow

```
User types + clicks send
    │
    ├─ useSendMessage.sendMessage()
    │   ├─ Check socket connected (5s timeout + retry)
    │   ├─ Emit ClientEvents.SEND_MESSAGE via socket
    │   └─ Callback receives messageId
    │
    ├─ useMessageFileUpload (if attachments)
    │   ├─ Upload files to /file-upload endpoint
    │   ├─ POST /messages/:id/attachments
    │   └─ Optimistic cache update (update message with file metadata)
    │
    └─ Server broadcasts NEW_MESSAGE
        ├─ All clients: setQueryData (prepend message)
        └─ Sender: already has optimistic data
```

### File Upload Flow

```
User drags file / clicks attach
    │
    ├─ MessageInput stores file in local state
    ├─ AttachmentPreview shows preview
    │
    ├─ On send: message created first (pendingAttachments count)
    │
    └─ useMessageFileUpload:
        ├─ Upload each file via FormData
        ├─ POST /messages/:id/attachments
        ├─ Cache updated with attachment metadata
        └─ pendingAttachments decremented to 0
```

### Voice Connect Flow

```
User clicks "Join Voice"
    │
    ├─ useVoiceConnection.joinVoiceChannel()
    │   ├─ GET /livekit/connection-info (URL)
    │   ├─ POST /livekit/token (JWT for room)
    │   ├─ POST /channels/:id/voice-presence/join
    │   ├─ Save connection state to localStorage (recovery)
    │   └─ room.connect(url, token)
    │
    ├─ LiveKit connection established
    │   └─ Publish local audio track
    │
    ├─ LiveKit webhook → backend
    │   └─ VOICE_CHANNEL_USER_JOINED broadcast
    │   └─ setQueryData: add user to voice presence cache
    │
    └─ Voice UI activates:
        ├─ VoiceBottomBar (controls)
        ├─ useVoicePresenceHeartbeat (30s)
        ├─ useSpeakingDetection (AnalyserNode + hysteresis)
        └─ useReplayBuffer (auto-starts on screen share)
```

### Theme Sync Flow

```
User changes accent color
    │
    ├─ ThemeContext.setAccentColor()
    │   ├─ Update state (instant UI change)
    │   ├─ Save to localStorage
    │   └─ Notify registered onChange callbacks
    │
    └─ useThemeSync
        └─ Debounced mutation to PATCH /appearance-settings
            └─ On error: revert to server value
```

---

## Hook Domain Summary

| Domain | Count | Key Patterns |
|--------|-------|-------------|
| Core Connectivity | 3 | Socket singleton, event bus, callback refs |
| User & Auth | 2 | Query cache, RBAC check |
| Messages | 8 | Infinite query, socket emit with callback, IntersectionObserver |
| Threads | 2 | Optimistic mutations |
| Voice/Video | 15 | LiveKit integration, AnalyserNode, localStorage recovery |
| Files & Media | 4 | FormData upload, blob cache, signed URLs |
| Notifications | 5 | Push subscription, desktop notifications, auto-mark |
| Forms | 3 | Local state, blob URL cleanup, client-side filtering |
| Read Receipts | 1 | Aggregated counts |
| Devices | 3 | navigator.mediaDevices, localStorage preferences |
| UI | 3 | Responsive breakpoints, debounce |
| PWA | 2 | beforeinstallprompt, dismiss persistence |
| Sound/Haptics | 2 | Audio element caching, Vibration API |
| Gestures | 1 | Touch event handling |
| **Total** | **53** | |

---

## Cross-References

- Component usage → [05-frontend-components.md](./05-frontend-components.md)
- WebSocket event handlers → [06-websocket-system.md](./06-websocket-system.md)
- Voice hooks details → [07-voice-and-media.md](./07-voice-and-media.md)
- API client setup → [04-frontend-architecture.md](./04-frontend-architecture.md)
- Backend endpoints → [02-backend-modules.md](./02-backend-modules.md)
