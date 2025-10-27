# Incomplete & Foundation Features

This document details features that have been started or have foundational code in place but require completion. These represent the **highest-impact, lowest-effort** improvements to make.

## 🏗️ Foundation Complete, Implementation Needed

### 1. Role-Based Access Control (RBAC) System

**Status**: ✅ **95% Complete - Production Ready**

#### What's Implemented
- **Backend Core**: Complete RBAC infrastructure in `backend/src/auth/`
  - `rbac.guard.ts` - Permission enforcement guard
  - `rbac-action.decorator.ts` - Action requirement decorator
  - `rbac-resource.decorator.ts` - Resource targeting decorator
  - `default-roles.config.ts` - Default admin/moderator roles
- **Database Schema**: Full RBAC models in Prisma schema
  - `Role` model with granular `RbacActions`
  - `UserRoles` junction table supporting community and instance roles
  - 40+ predefined permissions covering all major operations
- **Frontend Complete**: Full UI for role management
  - `RoleManagement.tsx` - Complete role CRUD interface with table view
  - `RoleEditor.tsx` - Permission matrix UI for editing roles
  - `RoleAssignmentDialog.tsx` - Assign roles to users
  - `RoleBasedComponents.tsx` - Conditional rendering based on permissions
  - `useUserPermissions.ts` - Permission checking hooks
  - `rolesApiSlice.ts` - Full API integration

#### What's Missing (Minor)
- **Testing**: Comprehensive RBAC testing across all features
- **Audit Logs**: Track permission changes (low priority)

#### Key Files
```
backend/src/auth/
├── rbac.guard.ts                                ✅ Permission enforcement
├── rbac-action.decorator.ts                     ✅ Action requirements
└── rbac-resource.decorator.ts                   ✅ Resource targeting

frontend/src/components/Community/
├── RoleManagement.tsx                           ✅ Full role management UI
├── RoleEditor.tsx                               ✅ Permission matrix editor
└── RoleAssignmentDialog.tsx                     ✅ User role assignment

frontend/src/features/roles/
├── RoleBasedComponents.tsx                      ✅ Conditional rendering
├── useUserPermissions.ts                        ✅ Permission hooks
└── rolesApiSlice.ts                             ✅ API integration
```

---

### 2. Direct Message System

**Status**: ✅ **100% Complete - Fully Implemented**

#### What's Implemented
- **Database Schema**: Complete DM models
  - `DirectMessageGroup` - Supports 1:1 and group DMs
  - `DirectMessageGroupMember` - Group membership tracking
  - `Message` model supports both channel and DM contexts
- **Backend API**: Full DM functionality
  - `messages.gateway.ts` handles all DM events
  - WebSocket room management for DM groups
  - Message storage in DM contexts
- **Frontend Interface**: Complete DM UI
  - DM conversation list in sidebar
  - Full chat interface with real-time messaging
  - Create DM dialog for starting conversations
  - Group DM support (multiple participants)
- **File Attachments**: Full file upload/download in DMs
- **Real-time Updates**: WebSocket-based live messaging

#### Key Files
```
frontend/src/components/DirectMessage/
├── DMList.tsx                    ✅ DM conversation list
├── DMChat.tsx                    ✅ DM chat interface
├── CreateDMDialog.tsx            ✅ Start new conversation
├── DMMessageList.tsx             ✅ Message rendering
└── GroupDMSettings.tsx           ✅ Group management

frontend/src/pages/DirectMessagePage.tsx  ✅ Main DM page
backend/src/messages/messages.gateway.ts  ✅ DM event handlers
frontend/src/features/direct-messages/    ✅ State management
```

---

### 3. File Attachment System

**Status**: ✅ **100% Complete - Fully Implemented**

#### What's Implemented
- **Database Schema**: `Attachment` type in Message model with full metadata
- **Backend Infrastructure**:
  - Complete file upload/download API in `file.service.ts`
  - Upload directory structure with proper organization
  - File caching system with `FileCacheContext`
  - Automatic cleanup of deleted files
- **Frontend Components**:
  - Drag & drop file upload in messages
  - File preview and download
  - Image thumbnails and previews
  - File type icons and metadata display
- **File Support**: Works in both channels and DMs
- **Performance**: Efficient caching prevents duplicate fetches

#### Key Files
```
backend/src/file/
├── file.service.ts               ✅ Upload/download/caching
├── file.controller.ts            ✅ REST endpoints
└── file.module.ts                ✅ Module configuration

frontend/src/components/Message/
├── MessageAttachment.tsx         ✅ Attachment display
└── FileUpload.tsx                ✅ Upload interface

frontend/src/contexts/
└── FileCacheContext.tsx          ✅ Performance optimization
```

---

### 4. Message Reactions System

**Status**: ✅ **100% Complete - Fully Implemented**

#### What's Implemented
- **Database Schema**: `Reaction` type in Message model
  ```prisma
  type Reaction {
    emoji   String
    userIds String[]
  }
  ```
- **Backend API**: Complete add/remove reaction mutations
  - `useAddReactionMutation()` in messagesApiSlice
  - `useRemoveReactionMutation()` in messagesApiSlice
- **Frontend Components**:
  - `MessageReactions.tsx` - Discord-style reaction chips with counts
  - `ReactionTooltip.tsx` - Shows who reacted on hover
  - `EmojiPicker.tsx` - Emoji selection interface
- **Real-time Updates**: WebSocket events for reaction changes
- **User Experience**:
  - Highlighted when current user has reacted
  - Click to add/remove reaction
  - Smooth animations and transitions
  - Shows up to 15 users in tooltip, "+N more" for additional

#### Key Files
```
frontend/src/components/Message/
├── MessageReactions.tsx          ✅ Reaction display component
├── ReactionTooltip.tsx           ✅ User list on hover
├── EmojiPicker.tsx               ✅ Emoji selection
└── MessageComponent.tsx          ✅ Integration & handlers

frontend/src/features/messages/
└── messagesApiSlice.ts           ✅ Add/remove mutations
```

---

### 5. Message Editing System

**Status**: ✅ **100% Complete - Fully Implemented**

#### What's Implemented
- **Database Schema**: `editedAt` field in Message model
- **Backend API**: Complete message update endpoint
  - `useUpdateMessageMutation()` in messagesApiSlice
- **Frontend Interface**: Full inline editing UI
  - Edit button in message hover menu
  - TextField for editing message content
  - Save (check) and cancel buttons
  - Permission-based visibility
- **Edit Indicators**: "(edited)" badge on edited messages
- **Real-time Updates**: Broadcasts edits via WebSocket
- **Permission System**: RBAC-based edit permissions
  - Users can edit their own messages
  - Moderators can edit any messages (if permitted)

#### Key Files
```
frontend/src/components/Message/
└── MessageComponent.tsx          ✅ Full editing UI with state management

frontend/src/features/messages/
└── messagesApiSlice.ts           ✅ Update mutation
```

---

## 🚧 Partial Implementations Needing Completion

### 6. Voice Channel Persistence & Settings

**Status**: 🔧 **75% Complete - Device Switching Implemented**

#### What's Implemented
- **Voice Connection**: Join/leave voice channels works
- **LiveKit Integration**: WebRTC connection established
- **Voice Controls**: Mute, video, screen share controls
- **Voice UI**: Bottom bar and video tiles
- **Device Switching**: Full audio input/output/video device selection (✅ NEW)
  - `switchAudioInputDevice` thunk implemented
  - `switchAudioOutputDevice` thunk implemented
  - `switchVideoInputDevice` thunk implemented
  - Redux state tracking selected devices
- **Discord-Style Behavior**: Auto-mute when deafening (✅ NEW)
- **Screen Share**: Fixed display and auto-rendering (✅ NEW)

#### What's Missing
- **Navigation Persistence**: Stay connected when changing pages
- **Connection Recovery**: Automatic reconnection after disconnects
- **Background Connection**: Keep voice active when app backgrounded

#### Implementation Effort
- **Time**: 1-2 weeks
- **Complexity**: Medium - state management complexity
- **Impact**: High - core voice feature expectation

#### Key Files
```
frontend/src/features/voice/voiceThunks.ts  ✅ Device switching thunks
frontend/src/components/Voice/VideoTiles.tsx ✅ Video display with LiveKit events
frontend/src/components/Voice/VoiceChannelUserList.tsx ✅ Discord-style icons
```

---

### 7. DM Voice & Video Calls

**Status**: 🔧 **80% Complete - Core Infrastructure Implemented**

#### What's Implemented
- **Backend Voice Presence**: Full DM support in voice presence service
  - `joinDmVoice()`, `leaveDmVoice()`, `getDmPresence()`, `updateDmVoiceState()`
  - Redis SET-based architecture for O(1) performance
  - Discord-style ringing (first user triggers call-started event)
- **REST Endpoints**: Complete DM voice API
  - GET `/dm-groups/:id/voice-presence` - Get participants
  - POST `/dm-groups/:id/voice-presence/join` - Join call
  - DELETE `/dm-groups/:id/voice-presence/leave` - Leave call
  - PUT `/dm-groups/:id/voice-presence/state` - Update state
- **WebSocket Events**: 4 DM voice events defined
  - `DM_VOICE_CALL_STARTED`, `DM_VOICE_USER_JOINED`, `DM_VOICE_USER_LEFT`, `DM_VOICE_USER_UPDATED`
- **LiveKit Integration**: DM token generation endpoint
- **Frontend State**: Voice slice extended for DM context
  - `contextType: 'channel' | 'dm'`
  - DM-specific fields and actions
- **Voice Thunks**: All DM voice thunks implemented
  - Join/leave, toggle audio/video/screen/mute/deafen
- **Context-Aware Controls**: VoiceBottomBar works for both contexts
- **DM Header Controls**: Phone/video icons in DM headers
  - `DMVoiceControls` component
  - `DMChatHeader` with integrated controls
- **Screen Share**: Works in DM calls (same as channels)

#### What's Missing
- **Ringing UI**: Notification when someone starts a DM call
  - Show dialog/snackbar with join/dismiss buttons
  - Optional ringing sound
  - Auto-dismiss after timeout
- **WebSocket Listeners**: Real-time event handling
  - Listen for DM voice events
  - Update participant list
  - Handle edge cases
- **Testing**: End-to-end verification
  - 1:1 DM calls
  - Group DM calls
  - Device switching in DMs
  - Edge cases (disconnects, multi-tab, etc.)

#### Implementation Effort
- **Remaining Time**: 4-6 hours
- **Complexity**: Low-Medium - mostly UI and event handling
- **Impact**: High - Discord parity for DM calls

#### Key Files
```
Backend:
backend/src/voice-presence/voice-presence.service.ts  ✅ DM methods
backend/src/voice-presence/voice-presence.controller.ts ✅ DmVoicePresenceController
backend/src/livekit/livekit.controller.ts ✅ DM token endpoint
backend/src/websocket/events.enum/server-events.enum.ts ✅ DM events

Frontend:
frontend/src/features/voice/voiceSlice.ts ✅ Context support
frontend/src/features/voice/voiceThunks.ts ✅ DM thunks
frontend/src/hooks/useVoiceConnection.ts ✅ Context-aware
frontend/src/components/DirectMessage/DMVoiceControls.tsx ✅ Controls
frontend/src/components/DirectMessages/DMChatHeader.tsx ✅ Header
frontend/src/components/Voice/VoiceBottomBar.tsx ✅ Both contexts
```

---

### 8. Community Invitation System

**Status**: ✅ **100% Complete - Fully Implemented**

#### What's Implemented
- **Database Schema**: `InstanceInvite` model with full features
- **Backend API**: Complete invite creation and management
  - Create invites with expiration and usage limits
  - Delete invites
  - Track invite usage
  - Permission-based access control
- **Frontend Interface**: Complete invite management UI
  - `InviteManagement.tsx` - Full CRUD interface
  - Create dialog with max uses and expiration options
  - Copy invite code to clipboard functionality
  - Delete confirmation dialog
  - Visual indicators for expired/maxed invites
  - Permission-based button visibility

#### Key Files
```
backend/src/invite/
├── invite.service.ts                            ✅ Full invite logic
├── invite.controller.ts                         ✅ REST endpoints
└── dto/create-invite.dto.ts                     ✅ Validation

frontend/src/components/Community/
└── InviteManagement.tsx                         ✅ Complete UI with create/delete/copy

frontend/src/features/invite/
└── inviteApiSlice.ts                            ✅ RTK Query integration
```

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

### 8. Instance Onboarding Wizard

**Status**: ✅ **100% Complete - Implementation Complete**

#### What's Implemented
- **Fresh Install Detection**: Automatic detection when no users exist and no active invites
- **Admin User Creation**: Secure form to create first administrator with full permissions
- **Default Community Setup**: Optional auto-creation of community with default channels
- **Instance Configuration**: Set instance name and description
- **Multi-Step UI**: Complete wizard interface with progress tracking
- **Automatic Routing**: Redirects to onboarding when fresh install detected
- **Security**: Setup tokens prevent unauthorized access to onboarding endpoints

#### Implementation Details
- **Backend Module**: Complete `OnboardingModule` with service, controller, and DTOs
- **Frontend Components**: Full wizard with 5 steps (Welcome, Admin Setup, Instance Config, Community Setup, Completion)
- **API Integration**: RESTful endpoints for status checking and setup completion
- **State Management**: Redux integration with RTK Query for API calls
- **Auto-Detection**: App-level routing checks onboarding status on startup
- **Default Content**: Creates welcome message and basic channel structure

#### Files Created
```
backend/src/onboarding/
├── onboarding.module.ts          ✅ Module configuration
├── onboarding.service.ts         ✅ Fresh install detection & setup logic
├── onboarding.controller.ts      ✅ API endpoints
└── dto/setup-instance.dto.ts     ✅ Data transfer objects

frontend/src/components/Onboarding/
├── OnboardingWizard.tsx          ✅ Main wizard container
├── WelcomeStep.tsx               ✅ Welcome/feature overview
├── AdminSetupStep.tsx            ✅ Admin user creation
├── InstanceSetupStep.tsx         ✅ Instance configuration
├── CommunitySetupStep.tsx        ✅ Default community setup
└── CompletionStep.tsx            ✅ Setup execution & completion

frontend/src/features/onboarding/
└── onboardingApiSlice.ts         ✅ Redux API slice

frontend/src/pages/OnboardingPage.tsx  ✅ Main onboarding page
```

#### Key Features
- **Zero-Config Setup**: Fresh installs automatically enter setup mode
- **Security First**: Setup tokens prevent unauthorized access
- **User-Friendly**: Clear progress indication and validation
- **Flexible**: Optional community creation with sensible defaults
- **Production Ready**: Proper error handling and loading states

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

### ✅ Recently Completed (High Impact)
1. ~~**Direct Messages**~~ - ✅ Complete 1:1 and group DMs
2. ~~**File Attachments**~~ - ✅ Full upload/download in channels and DMs
3. ~~**Voice Device Settings**~~ - ✅ Audio/video device switching

### ✅ Recently Completed (Phase 2 - High Impact Features)
1. ~~**Community Invitations**~~ - ✅ Complete UI with create/delete/copy functionality
2. ~~**Message Editing**~~ - ✅ Full inline editing with save/cancel and edited indicator
3. ~~**Message Reactions**~~ - ✅ Discord-style reactions with emoji picker and tooltips
4. ~~**RBAC Management UI**~~ - ✅ Complete role management, editor, and assignment dialogs

### High Impact, Medium Effort (Do Next)
1. **Voice Persistence** (1-2 weeks) - Stay connected across navigation
2. **Message Search** (2-3 weeks) - Essential for large communities
3. **Mobile Optimization** (4-6 weeks) - Responsive design improvements

### High Impact, High Effort (Plan Carefully)
1. **Rich Text System** (3-4 weeks) - Complex implementation
2. **Mobile Optimization** (4-6 weeks) - Responsive design overhaul
3. **Advanced Moderation** (3-4 weeks) - Ban system, timeouts, slowmode

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

### ✅ Phase 1: Foundation Features (COMPLETED)
- ~~Direct Messages~~ ✅
- ~~File Attachment System~~ ✅
- ~~Voice Device Settings~~ ✅
- ~~Multi-connection Presence~~ ✅
- ~~Screen Sharing Fixes~~ ✅

### Phase 2: Core Completion (4-6 weeks)
- Community Invitations UI
- Message Editing UI
- Basic Reactions
- Voice Persistence across navigation
- RBAC System UI

### Phase 3: Enhanced Features (6-8 weeks)
- Message Search
- Mobile Optimization
- Advanced Moderation (ban, timeout, slowmode)
- Rich Text Editor
- Message Pinning

### Phase 4: Advanced Features (8-12 weeks)
- Friend System
- Voice Activity Indicators
- Custom Emojis
- Bot/Webhook System

## 📈 Progress Summary

**Completed Major Features:**
- ✅ Direct messaging (1:1 and group)
- ✅ File attachments in all contexts
- ✅ Voice device switching
- ✅ Screen sharing with proper rendering
- ✅ Multi-connection presence tracking
- ✅ Discord-style mute/deafen behavior

**Current Priority:**
Focus on completing UI for existing backend features (invitations, RBAC, message editing) before expanding into new functionality. This maximizes ROI on work already done.

**Last Updated**: Based on comprehensive codebase analysis as of session continuation.