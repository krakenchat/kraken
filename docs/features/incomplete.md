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

### Voice Persistence - ✅ 95% Complete
- RoomProvider wraps all routes for persistent LiveKit Room
- VoiceBottomBar at Layout level (visible on all pages)
- Page refresh recovery via localStorage (useVoiceRecovery hook)
- Redux state management with non-serializable Room in Context
- Works for both channel and DM voice connections
- Minor: Cross-tab synchronization not implemented

---

## 🔬 Foundation Only - Needs Major Work

### 1. Friend System

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

### 2. Alias/Mention Groups

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

### 3. Advanced Rich Text

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

### High Impact, Medium Effort (Do Next)
1. **Message Search** - Essential for large communities
2. **Push to Talk** - Expected voice feature

### Medium Impact, High Effort
1. **Rich Text Editor** - Complex implementation
2. **Friend System** - Full feature build
3. **Advanced Moderation** - Ban system, timeouts

### Lower Priority
1. **Alias/Mention Groups** - Niche feature
2. **Mobile Optimization** - Responsive design improvements

---

## 🚀 Development Strategy

### Recommended Order
1. Message Search (high impact for growing communities)
2. Push to Talk (common voice feature request)
3. Friend System or Rich Text (depending on user demand)

---

**Last Updated**: December 2024
