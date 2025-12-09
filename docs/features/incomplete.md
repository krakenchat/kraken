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

### Message Search - ✅ 100% Complete
- Backend search endpoints for channels, DMs, and communities
- Frontend MessageSearch component with results display
- Uses searchText field for indexed full-text search
- RBAC-protected search endpoints

### Push to Talk - ✅ 100% Complete
- usePushToTalk hook with configurable key binding
- VoiceSettings UI for input mode selection
- Proper handling of key repeat, blur events
- Works with existing voice connection system

### Friend System - ✅ 100% Complete
- Full backend: FriendsController with send/accept/decline/cancel/remove
- FriendsService with all CRUD operations
- Frontend: FriendList, FriendRequestList, AddFriendDialog, FriendCard components
- friendsApiSlice with RTK Query endpoints
- Integration with DirectMessagesPage

---

## 🔬 Foundation Only - Needs Major Work

### 1. Alias/Mention Groups

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

### 2. Advanced Rich Text

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

### Medium Impact, High Effort
1. **Rich Text Editor** - Complex WYSIWYG implementation
2. **Advanced Moderation** - Ban system, timeouts (partially done)

### Lower Priority
1. **Alias/Mention Groups** - Niche feature, schema exists
2. **Mobile Optimization** - General responsive improvements

---

## 🚀 Development Strategy

Most major features are complete! Remaining work:
1. Rich Text Editor (if markdown/formatting needed)
2. Polish existing features based on user feedback
3. Mobile app considerations

---

**Last Updated**: December 2024
