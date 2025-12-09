# Incomplete & Foundation Features

This document details features that have been started or have foundational code in place but require completion. These represent the **highest-impact, lowest-effort** improvements to make.

---

## ✅ Recently Completed Features

These features were previously incomplete but are now fully implemented:

### Message Reactions System - ✅ 100% Complete
- Discord-style reaction chips with counts
- Emoji picker integration
- Real-time WebSocket updates
- User list tooltips on hover

### Message Editing System - ✅ 100% Complete
- Inline editing with save/cancel
- "(edited)" indicator on modified messages
- Permission-based edit access
- Real-time broadcast of edits

### Community Invitation System - ✅ 100% Complete
- Create invites with expiration and usage limits
- Copy invite code to clipboard
- Delete invites with confirmation
- Permission-based access control

### RBAC System - ✅ 95% Complete
- Full backend infrastructure (guards, decorators, 40+ permissions)
- Complete frontend UI (RoleManagement, RoleEditor, RoleAssignmentDialog)
- Permission-based component rendering
- Minor: Comprehensive testing and audit logs

### Direct Message System - ✅ 100% Complete
- 1:1 and group DMs with file attachments
- Real-time WebSocket messaging
- Voice/video calls in DMs
- Screen sharing in DM calls

### File Attachment System - ✅ 100% Complete
- Drag & drop file upload
- Image previews and thumbnails
- File caching with FileCacheContext
- Works in channels and DMs

### Instance Onboarding - ✅ 100% Complete
- Fresh install detection
- Admin user creation wizard
- Default community setup
- Instance configuration

### Voice Channel Reordering - ✅ 100% Complete
- Move up/down buttons in community settings
- Position normalization for legacy channels
- WebSocket broadcast of reorder events
- Separate ordering within TEXT/VOICE types

### Notifications System - ✅ 100% Complete
- Full backend module with service, gateway, and controller
- NotificationCenter drawer with CRUD operations
- NotificationBadge with unread count
- NotificationSettings UI (desktop, push, DND, sounds, channel defaults)
- Per-channel notification override menu (ChannelNotificationMenu)
- Push notifications for offline users (Web Push API)
- Real-time WebSocket delivery
- Auto-mark-as-read when navigating to channels/DMs
- Mobile NotificationsScreen
- Sound playback with test button

### Read Receipts System - ✅ 100% Complete
- Discord-style "NEW MESSAGES" unread divider
- Auto-mark messages as read via Intersection Observer
- WebSocket sync across tabs/devices
- Checkmark indicators (✓ sent, ✓✓ read) for DM messages
- "Seen by" hover tooltip with lazy-loaded user list
- Backend watermark-based tracking per channel/DM
- Real-time broadcast to DM rooms for instant read status updates

---

## 🚧 Features In Progress

### 1. Replay Buffer & Clip Saving

**Status**: 🔧 **85% Complete**

#### What's Implemented
- **LiveKit Egress**: HLS segment recording during screen share
- **Backend Service**: `livekit-replay.service.ts` with FFmpeg processing
- **TrimPreview Component**: Video trimming UI with seek controls
- **ClipLibrary Component**: User's saved clips on profile page
- **Database Model**: `EgressSession` and clip metadata storage

#### What's Missing
- Polish and edge case handling
- Mobile-friendly clip viewer
- Clip sharing/download improvements

#### Key Files
```
backend/src/livekit/livekit-replay.service.ts
backend/src/livekit/ffmpeg.service.ts
frontend/src/components/Voice/TrimPreview.tsx
frontend/src/components/Voice/CaptureReplayModal.tsx
frontend/src/components/Profile/ClipLibrary.tsx
```

---

### 2. Voice Persistence

**Status**: 🔧 **75% Complete**

#### What's Implemented
- Voice connection via LiveKit
- Device switching (audio input/output, video)
- Discord-style mute/deafen behavior
- Voice presence via LiveKit webhooks

#### What's Missing
- **Navigation Persistence**: Stay connected when changing pages
- **Connection Recovery**: Automatic reconnection after disconnects
- **Background Connection**: Keep voice active when app backgrounded

#### Key Files
```
frontend/src/features/voice/voiceSlice.ts
frontend/src/features/voice/voiceThunks.ts
frontend/src/hooks/useVoiceConnection.ts
frontend/src/components/Voice/VoiceBottomBar.tsx
```

---

## 🔬 Foundation Only - Needs Major Work

### 3. Friend System

**Status**: 🔧 **10% Complete - Schema Only**

#### What's Implemented
- **Database Schema**: `Friendship` model with status tracking
- **Friendship States**: PENDING, ACCEPTED, BLOCKED

#### What's Missing
- Backend service and controller
- Friend request sending/accepting/denying
- Friend list UI
- Integration with DM system

---

### 4. Alias/Mention Groups

**Status**: 🔧 **10% Complete - Schema Only**

#### What's Implemented
- **Database Schema**: `AliasGroup` and `AliasGroupMember` models
- **Span System**: Supports alias mention type

#### What's Missing
- Group CRUD operations
- Member management UI
- Mention resolution
- Permission controls

---

### 5. Advanced Rich Text

**Status**: 🔧 **15% Complete - Span System Ready**

#### What's Implemented
- Span-based message structure
- User/channel/special mention types
- Basic text formatting support

#### What's Missing
- WYSIWYG editor
- Markdown rendering (bold, italic, code)
- Link previews/embeds
- Code syntax highlighting

---

## 📋 Priority Matrix

### High Impact, Low Effort (Do Next)
1. **Voice Persistence** - Stay connected across navigation
2. **Replay Buffer Polish** - Edge case handling and mobile-friendly viewer

### High Impact, Medium Effort
1. **Message Search** (2-3 weeks) - Essential for large communities
2. **Push to Talk** (1-2 weeks) - Expected voice feature
3. **Mobile Optimization** (4-6 weeks) - Responsive design improvements

### Medium Impact, High Effort
1. **Rich Text Editor** (3-4 weeks) - Complex implementation
2. **Friend System** (2-3 weeks) - Full feature build
3. **Advanced Moderation** (3-4 weeks) - Ban system, timeouts

---

## 🚀 Development Strategy

### Current Focus
Focus on completing the in-progress features (85-70% complete) before starting new ones. This maximizes ROI on existing work.

### Recommended Order
1. Finish Replay Buffer polish
2. Add Read Receipt visual indicators
3. Implement Voice Persistence
4. Then move to new features (Rich Text, Friend System)

---

**Last Updated**: December 9, 2024
