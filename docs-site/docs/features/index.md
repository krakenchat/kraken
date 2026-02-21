# Feature Overview

Kraken targets Discord feature parity and currently sits at **~84%** across all categories.

## Feature Status

| Category | Parity | Highlights |
|----------|--------|------------|
| **Core Chat** | 100% | Text channels, real-time messaging, mentions, reactions, threads, search, attachments, message editing |
| **Voice & Video** | 80% | LiveKit-powered voice/video, screen sharing, push-to-talk, replay buffer, DM calls, voice persistence |
| **Community Management** | 92% | Community CRUD, 40+ RBAC permissions, role management UI, invites, channel reordering |
| **User Features** | 80% | Profiles (avatar, banner, bio, status), presence, friends, DMs, session management |
| **Moderation** | 67% | Ban, kick, timeout, message pinning, slowmode, mod logs |
| **Social** | 50% | Reactions, group DMs, screen share in DMs, user blocking, friend requests |
| **Platform** | 60% | PWA support, mobile-responsive UI, Electron desktop app (in progress) |

## Implemented Features

### Messaging
- Real-time text channels with WebSocket delivery
- Span-based rich text (mentions: user, channel, special, alias)
- File attachments with authenticated serving and video streaming
- Message reactions with emoji picker
- Inline message editing with edit indicators
- Message search (channel-wide and community-wide)
- Message threads with real-time replies and subscription notifications
- Read receipts and unread tracking
- Typing indicators

### Voice & Video
- LiveKit-powered voice channels with join/leave/mute
- Video calls with camera toggle and participant tiles
- Screen sharing in channels and DMs
- Push-to-talk with configurable key
- Voice activity detection with speaking indicators
- Voice persistence across page navigation (draggable PiP overlay, page refresh recovery)
- Replay buffer -- continuous screen recording with on-demand clip capture (see [Replay Buffer](replay-buffer.md))
- Audio/video device settings

### Communities
- Community creation with name, description, avatar, banner
- Text and voice channels with private channel support
- Drag-to-reorder channels
- Full RBAC with 40+ granular permissions and role editor UI
- Member management (add/remove, role assignment)
- Instance and community invite system with expiration and usage limits
- Instance onboarding wizard

### User Features
- JWT authentication with refresh token rotation
- User profiles: avatar, banner, display name, bio, custom status
- Multi-connection presence tracking (online/offline)
- Friend system: send/accept/decline/cancel requests
- 1:1 and group direct messages with file attachments
- User blocking
- Session management (view/revoke active sessions with device tracking)
- Theme system: 12 accent colors, 3 intensity levels

### Moderation
- Ban/unban (permanent and temporary) with BanDialog UI
- Kick with confirmation dialog
- Timeout with configurable duration
- Message pinning (pin/unpin, PinnedMessagesPanel)
- Slowmode (configurable per-channel rate limiting)
- Comprehensive moderation audit logs
- Moderator message deletion

### Admin
- User storage quotas with enforcement
- Instance storage dashboard (usage breakdown, server stats)
- Configurable max file size per upload

### Platform
- PWA with install prompt, service worker, offline caching
- Mobile-responsive UI with Discord-inspired bottom nav and swipe gestures
- Electron desktop app (in progress)

## Notable Gaps

- Rich text formatting (bold, italic, code blocks, embeds)
- Two-factor authentication
- Custom emojis and stickers
- Bot/webhook integration
- Noise suppression
- Native mobile apps
