# Incomplete & Foundation Features

This document details features that have been started or have foundational code in place but require completion. These represent the **highest-impact, lowest-effort** improvements to make.

## 🏗️ Foundation Complete, Implementation Needed

### 1. Role-Based Access Control (RBAC) System

**Status**: 🔧 **40% Complete - Strong Foundation**

#### What's Implemented
- **Backend Core**: Complete RBAC infrastructure in `backend/src/auth/`
  - `rbac.guard.ts` - Permission enforcement guard
  - `rbac-action.decorator.ts` - Action requirement decorator
  - `rbac-resource.decorator.ts` - Resource targeting decorator
  - `default-roles.config.ts` - Default admin/moderator roles
- **Database Schema**: Full RBAC models in Prisma schema
  - `Role` model with granular `RbacActions`
  - `UserRoles` junction table supporting community and instance roles
  - 57 predefined permissions covering all major operations
- **Frontend Foundation**: Permission system components
  - `RoleBasedComponents.tsx` - Conditional rendering based on permissions
  - `useUserPermissions.ts` - Permission checking hooks
  - `rolesApiSlice.ts` - API integration ready

#### What's Missing
- **Permission Matrix UI**: Admin interface for role management
- **Role Assignment Interface**: Bulk role operations
- **Permission Visualization**: Clear UI showing what each role can do
- **Testing**: Comprehensive RBAC testing across all features

#### Implementation Effort
- **Time**: 2-3 weeks
- **Complexity**: Medium - mostly frontend work
- **Impact**: High - unlocks community self-management

#### Files to Complete
```
frontend/src/components/Community/RoleManagement.tsx  # Needs UI implementation
frontend/src/pages/RoleManagementPage.tsx            # New page needed
backend/src/roles/roles.service.ts                   # Some methods incomplete
```

---

### 2. Direct Message System

**Status**: 🔧 **30% Complete - Database Ready**

#### What's Implemented
- **Database Schema**: Complete DM models
  - `DirectMessageGroup` - Supports 1:1 and group DMs
  - `DirectMessageGroupMember` - Group membership tracking
  - `Message` model supports both channel and DM contexts
- **Backend API**: Basic DM message handling
  - `messages.gateway.ts` has `SEND_DM` event handler
  - WebSocket room management for DM groups
- **Message Storage**: Messages can be stored in DM contexts

#### What's Missing
- **Frontend Interface**: Complete DM UI
- **DM Creation**: Interface to start new conversations
- **DM List**: Sidebar showing active conversations
- **Friend System Integration**: Connect DMs with friend requests
- **Notification System**: DM-specific notifications

#### Implementation Effort
- **Time**: 3-4 weeks
- **Complexity**: Medium-High - requires new UI components
- **Impact**: High - core communication feature

#### Files to Create/Complete
```
frontend/src/components/DirectMessage/
├── DMList.tsx                    # DM conversation list
├── DMChat.tsx                    # DM chat interface
├── CreateDMDialog.tsx            # Start new conversation
└── DMNotifications.tsx           # DM-specific notifications

frontend/src/pages/DirectMessagePage.tsx
backend/src/direct-messages/      # New module for DM-specific logic
```

---

### 3. File Attachment System

**Status**: 🔧 **25% Complete - Schema & Upload Ready**

#### What's Implemented
- **Database Schema**: `Attachment` type in Message model
  ```prisma
  type Attachment {
    url      String
    filename String
    filetype String
    size     Int
  }
  ```
- **Backend Infrastructure**: Upload directory structure exists
  ```
  backend/uploads/
  ├── channel/    # Channel attachments
  ├── community/  # Community assets
  ├── dm/         # DM attachments
  ├── profile/    # User avatars
  └── temp/       # Temporary files
  ```
- **File Upload Components**: Avatar/banner upload working

#### What's Missing
- **Message Attachments**: Drag & drop file upload in messages
- **File Processing**: Image thumbnails, file type validation
- **File Management**: Delete, rename, organize files
- **Security**: File type restrictions, virus scanning
- **Storage**: Cloud storage integration (S3, etc.)

#### Implementation Effort
- **Time**: 2-3 weeks
- **Complexity**: Medium - file handling complexity
- **Impact**: High - expected basic functionality

#### Files to Complete
```
frontend/src/components/Message/MessageAttachment.tsx
frontend/src/components/Message/FileUpload.tsx
backend/src/attachments/                          # New module
backend/src/storage/                              # Storage abstraction
```

---

### 4. Message Reactions System

**Status**: 🔧 **20% Complete - Schema Ready**

#### What's Implemented
- **Database Schema**: `Reaction` type in Message model
  ```prisma
  type Reaction {
    emoji   String
    userIds String[]
  }
  ```
- **Backend Foundation**: Message model supports reactions array

#### What's Missing
- **Emoji Picker**: UI component for selecting emojis
- **Reaction Display**: Show reactions under messages
- **Reaction API**: Backend endpoints for add/remove reactions
- **Real-time Updates**: WebSocket events for reaction changes
- **Custom Emojis**: Community-specific emoji support

#### Implementation Effort
- **Time**: 1-2 weeks
- **Complexity**: Low-Medium - straightforward UI work
- **Impact**: Medium - enhances user engagement

---

### 5. Message Editing System

**Status**: 🔧 **35% Complete - Backend Ready**

#### What's Implemented
- **Database Schema**: `editedAt` field in Message model
- **Backend Logic**: Message update capability exists
- **Permission System**: Edit permissions in RBAC actions

#### What's Missing
- **Frontend Interface**: Edit message UI
- **Edit Indicators**: Show when messages were edited
- **Edit History**: Track and display edit history
- **Real-time Updates**: Broadcast edits to other users

#### Implementation Effort
- **Time**: 1 week
- **Complexity**: Low - mostly frontend work
- **Impact**: Medium - quality of life improvement

---

## 🚧 Partial Implementations Needing Completion

### 6. Voice Channel Persistence

**Status**: 🔧 **60% Complete - Core Working**

#### What's Implemented
- **Voice Connection**: Join/leave voice channels works
- **LiveKit Integration**: WebRTC connection established
- **Voice Controls**: Mute, video, screen share controls
- **Voice UI**: Bottom bar and video tiles

#### What's Missing
- **Navigation Persistence**: Stay connected when changing pages
- **Connection Recovery**: Automatic reconnection after disconnects
- **Background Connection**: Keep voice active when app backgrounded

#### Implementation Effort
- **Time**: 1-2 weeks
- **Complexity**: Medium - state management complexity
- **Impact**: High - core voice feature expectation

---

### 7. Community Invitation System

**Status**: 🔧 **70% Complete - Backend Complete**

#### What's Implemented
- **Database Schema**: `InstanceInvite` model with full features
- **Backend API**: Complete invite creation and management
- **Invite Logic**: Usage tracking, expiration, permissions

#### What's Missing
- **Frontend Interface**: Invite creation and management UI
- **Invite Links**: Shareable invite link generation
- **Join Flow**: User-friendly invite acceptance flow

#### Implementation Effort
- **Time**: 1 week
- **Complexity**: Low - mostly frontend forms
- **Impact**: High - essential for community growth

---

### 8. Advanced Messaging Features

**Status**: 🔧 **15% Complete - Span System Ready**

#### What's Implemented
- **Rich Text Foundation**: Span-based message system
  ```prisma
  enum SpanType {
    PLAINTEXT
    USER_MENTION
    SPECIAL_MENTION      # @here, @everyone
    CHANNEL_MENTION      # #channel-name
    COMMUNITY_MENTION    # Server mentions
    ALIAS_MENTION        # Custom mention groups
  }
  ```

#### What's Missing
- **Rich Text Editor**: WYSIWYG message input
- **Markdown Support**: Bold, italic, code blocks
- **Embed System**: Link previews, rich embeds
- **Code Syntax**: Syntax highlighting for code blocks

#### Implementation Effort
- **Time**: 3-4 weeks
- **Complexity**: High - complex text editing
- **Impact**: Medium - enhances message quality

---

## 🔬 Foundation Only - Needs Major Work

### 9. Friend System

**Status**: 🔧 **10% Complete - Schema Only**

#### What's Implemented
- **Database Schema**: `Friendship` model with status tracking
- **Friendship States**: PENDING, ACCEPTED, BLOCKED

#### What's Missing
- **Everything else**: Complete friend system implementation
- **Friend Requests**: Send, accept, deny friend requests
- **Friend List**: UI for managing friends
- **Integration**: Connect with DM system

#### Implementation Effort
- **Time**: 2-3 weeks
- **Complexity**: Medium - social feature complexity
- **Impact**: Medium - nice to have feature

---

### 10. Alias/Mention Groups

**Status**: 🔧 **10% Complete - Schema Only**

#### What's Implemented
- **Database Schema**: `AliasGroup` and `AliasGroupMember` models
- **Mention Support**: Span system supports alias mentions

#### What's Missing
- **Group Management**: Create, edit, delete mention groups
- **Member Management**: Add/remove users from groups
- **Mention Resolution**: Resolve alias mentions to users
- **Permissions**: Who can create/manage groups

#### Implementation Effort
- **Time**: 1-2 weeks
- **Complexity**: Low-Medium - straightforward CRUD
- **Impact**: Low - advanced feature

---

## 📋 Completion Priority Matrix

### High Impact, Low Effort (Do First)
1. **Community Invitations** (1 week) - Essential for growth
2. **Message Editing** (1 week) - Basic UX expectation
3. **Message Reactions** (1-2 weeks) - User engagement

### High Impact, Medium Effort (Do Next)
1. **RBAC System** (2-3 weeks) - Unlocks self-management
2. **File Attachments** (2-3 weeks) - Core functionality
3. **Voice Persistence** (1-2 weeks) - Core voice feature

### High Impact, High Effort (Plan Carefully)
1. **Direct Messages** (3-4 weeks) - Major feature
2. **Rich Text System** (3-4 weeks) - Complex implementation

### Medium/Low Impact (Future)
1. **Friend System** (2-3 weeks)
2. **Alias Groups** (1-2 weeks)

## 🚀 Quick Wins (1 week each)

These features can be completed quickly and provide immediate value:

1. **Message Editing UI** - Backend exists, need frontend
2. **Community Invitations UI** - Backend complete
3. **Basic Reactions** - Simple emoji picker and display
4. **Message Pinning** - Add pin/unpin functionality
5. **User Status Settings** - Online/away/DND status

## 🔧 Development Strategy

### Phase 1: Complete Foundation Features (4-6 weeks)
- Community Invitations
- Message Editing
- Basic Reactions
- Voice Persistence

### Phase 2: Major Features (6-8 weeks)
- Complete RBAC System
- File Attachment System
- Direct Message Interface

### Phase 3: Advanced Features (8-12 weeks)
- Rich Text System
- Friend System
- Advanced Moderation

This roadmap focuses on completing existing foundations before starting new features, maximizing the return on investment of work already done.