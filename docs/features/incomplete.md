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

### Replay Buffer & Clip Saving - ✅ 100% Complete
- LiveKit Track Composite Egress for HLS segment recording
- FFmpeg processing with segment concatenation and custom trimming
- Mobile-responsive TrimPreview with touch-friendly timeline
- ClipLibrary with loading skeletons, download indicators, delete confirmation
- Rate-limited capture endpoint (3/min, 15/hour)
- HLS error handling with retry functionality
- Clip sharing to channels or DMs
- Public/private visibility toggle on profile

---

## 🚧 Features In Progress

### 1. Voice Persistence

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

### High Impact, Medium Effort
1. **Message Search** - Essential for large communities
2. **Push to Talk** - Expected voice feature
3. **Mobile Optimization** - Responsive design improvements

### Medium Impact, High Effort
1. **Rich Text Editor** - Complex implementation
2. **Friend System** - Full feature build
3. **Advanced Moderation** - Ban system, timeouts

---

## 🚀 Development Strategy

### Current Focus
Complete Voice Persistence (75% done), then move to new features.

### Recommended Order
1. Implement Voice Persistence
2. Then move to new features (Message Search, Rich Text, Friend System)

---

**Last Updated**: December 2024
