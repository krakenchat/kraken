# Cross-Reference System

This document provides a comprehensive cross-reference system linking all related components, APIs, modules, hooks, and documentation across the Kraken application.

## How to Use This Cross-Reference

1. **Find your starting point** - Component, API, module, or feature
2. **Follow the links** to understand dependencies and relationships  
3. **Use the quick navigation** to jump between related documentation
4. **Check integration patterns** for implementation guidance

---

## 📱 Frontend Components → Backend APIs

### Authentication Flow
- **Component:** [LoginPage](components/auth/LoginPage.md) 
- **API:** [Auth API](api/auth.md) → `POST /api/auth/login`
- **Hook:** [useAuth](hooks/useAuth.md)
- **State:** [Auth API Slice](state/authApi.md)

### Community Management
- **Component:** [CommunityFormContent](components/community/CommunityFormContent.md)
- **API:** [Community API](api/community.md) → `POST /api/communities`
- **Hook:** [useCommunityForm](hooks/useCommunityForm.md)
- **State:** [Community API Slice](state/communityApi.md)
- **Module:** [Community Module](modules/community/community.md)

### Real-time Messaging
- **Component:** [MessageComponent](components/messages/MessageComponent.md)
- **API:** [Messages API](api/messages.md) → `POST /api/messages`
- **WebSocket:** [Messages Events](api/websocket-events.md#send_message)
- **Hook:** [useWebSocketEvent](hooks/useWebSocketEvent.md)
- **State:** [Messages API + Slice](state/messagesApi.md)
- **Module:** [Messages Module](modules/messaging/messages.md)

### Voice & Video Integration
- **Component:** [VoiceBottomBar](components/voice/VoiceBottomBar.md)
- **API:** [LiveKit API](api/livekit.md) → `POST /api/livekit/token`
- **WebSocket:** [Voice Presence Events](api/websocket-events.md#voice_channel_join)
- **Hook:** [useVoiceConnection](hooks/useVoiceConnection.md)
- **State:** [Voice Slice](state/voiceSlice.md) + [LiveKit API](state/livekitApi.md)
- **Module:** [LiveKit Module](modules/voice/livekit.md)

---

## 🔐 RBAC Permission System

### Permission Components
- **Component:** [RoleBasedComponents](components/roles/RoleBasedComponents.md)
- **Hook:** [useUserPermissions](hooks/useUserPermissions.md)
- **API:** [Roles API](api/roles.md) → `GET /api/roles/permissions`
- **State:** [Roles API Slice](state/rolesApi.md)
- **Module:** [Roles Module](modules/core/roles.md)

### Permission Flow Examples

#### Community Management Permissions
```
Frontend: useUserPermissions('CREATE_COMMUNITY')
    ↓
State: rolesApi.useGetUserPermissionsQuery() 
    ↓
API: GET /api/roles/permissions
    ↓
Backend: RolesService.getUserPermissions()
    ↓
Database: User roles and permissions lookup
```

#### Message Creation Permissions  
```
Frontend: MessageInput component permission check
    ↓
WebSocket: SEND_MESSAGE event with RBAC guard
    ↓  
Backend: @RequiredActions(RbacActions.CREATE_MESSAGE)
    ↓
RBAC: Channel resource context validation
    ↓
Database: User community/channel membership check
```

---

## 🔄 Real-time Data Flow

### Message Broadcasting
```
Frontend: MessageInput → sendMessage()
    ↓
WebSocket: emit('SEND_MESSAGE', payload)
    ↓
Backend: MessagesGateway.handleMessage()
    ↓
Service: MessagesService.create()
    ↓
Database: Prisma message creation
    ↓
WebSocket: broadcast('NEW_MESSAGE', message) to room
    ↓
Frontend: useWebSocketEvent('NEW_MESSAGE') → RTK Query cache update
    ↓
UI: MessageComponent re-renders with new message
```

### Voice Presence Updates
```
Frontend: VoiceBottomBar → join voice channel
    ↓
WebSocket: emit('VOICE_CHANNEL_JOIN', channelId)
    ↓
Backend: VoicePresenceGateway.handleJoin()
    ↓
Service: VoicePresenceService.joinChannel()
    ↓
Database: Voice presence record creation
    ↓
WebSocket: broadcast voice presence to community
    ↓
Frontend: Voice presence cache updates
    ↓
UI: Voice channel user lists update
```

---

## 📊 Data State Management

### RTK Query → WebSocket Integration

#### Community Data
- **Query:** `useGetCommunitiesQuery()` → [Community API](state/communityApi.md)
- **WebSocket:** `COMMUNITY_UPDATED` → Cache update
- **Components:** [MemberManagement](components/community/MemberManagement.md), Community forms

#### Message Data  
- **Query:** `useGetMessagesQuery(channelId)` → [Messages API](state/messagesApi.md)
- **Local State:** Message drafts, editing → [Messages Slice](state/messagesApi.md#local-state)
- **WebSocket:** `NEW_MESSAGE`, `UPDATE_MESSAGE` → Cache updates
- **Components:** [MessageComponent](components/messages/MessageComponent.md), [MessageInput](components/messages/MessageInput.md)

#### Voice State
- **Local State:** Connection status, device settings → [Voice Slice](state/voiceSlice.md)
- **API Query:** LiveKit tokens → [LiveKit API](state/livekitApi.md)  
- **WebSocket:** Voice presence events → Presence cache updates
- **Components:** [VoiceBottomBar](components/voice/VoiceBottomBar.md), Device settings

---

## 🏗️ Module Dependencies

### Core Infrastructure
```
Database Module
    ├── Used by: All feature modules
    ├── Provides: Prisma client, transactions
    └── Related: [Database Module](modules/core/database.md)

WebSocket Module  
    ├── Used by: Messages, Presence, Community modules
    ├── Provides: Real-time communication
    └── Related: [WebSocket Module](modules/core/websocket.md)

Auth Module
    ├── Used by: All protected endpoints
    ├── Provides: JWT, RBAC guards
    └── Related: [Auth Module](modules/auth/auth.md)
```

### Feature Module Relationships
```
Community Module
    ├── Depends on: Auth, Database, WebSocket
    ├── Used by: Channels, Membership modules
    └── Related: [Community Module](modules/community/community.md)

Messages Module
    ├── Depends on: Auth, Database, WebSocket, Community
    ├── Integrates: Mentions, spans, attachments
    └── Related: [Messages Module](modules/messaging/messages.md)

LiveKit Module
    ├── Depends on: Auth, Database, Community
    ├── Provides: WebRTC tokens, room management
    └── Related: [LiveKit Module](modules/voice/livekit.md)
```

---

## 🎯 Feature Implementation Paths

### Adding a New Message Feature

1. **Backend:**
   - Update [Messages Module](modules/messaging/messages.md) service
   - Add endpoint to [Messages Controller](api/messages.md)
   - Update DTOs and validation
   - Add WebSocket events if needed

2. **Frontend:**
   - Update [Messages API Slice](state/messagesApi.md) 
   - Modify [MessageComponent](components/messages/MessageComponent.md)
   - Add WebSocket event handling
   - Update related hooks if needed

3. **Documentation:**
   - Update API documentation
   - Update component documentation
   - Update WebSocket events
   - Update cross-references

### Adding RBAC Protection

1. **Define Permission:**
   - Add to [Roles Module](modules/core/roles.md)
   - Update permission constants
   - Add to database seeds

2. **Backend Protection:**
   - Add `@RequiredActions()` decorator
   - Configure resource context
   - Update controller documentation

3. **Frontend Integration:**
   - Use [useUserPermissions](hooks/useUserPermissions.md)
   - Update [RoleBasedComponents](components/roles/RoleBasedComponents.md)
   - Add permission checks to components

---

## 🔍 Quick Navigation by Feature

### Authentication
- **Components:** [LoginPage](components/auth/LoginPage.md), [RegisterPage](components/auth/RegisterPage.md)
- **API:** [Auth API](api/auth.md)
- **Module:** [Auth Module](modules/auth/auth.md)
- **State:** [Auth API](state/authApi.md)
- **Hooks:** [useAuth](hooks/useAuth.md)

### Community Management
- **Components:** [CommunityFormContent](components/community/CommunityFormContent.md), [MemberManagement](components/community/MemberManagement.md)
- **API:** [Community API](api/community.md), [Membership API](api/membership.md)  
- **Module:** [Community Module](modules/community/community.md), [Membership Module](modules/community/membership.md)
- **State:** [Community API](state/communityApi.md), [Membership API](state/membershipApi.md)
- **Hooks:** [useCommunityForm](hooks/useCommunityForm.md), [useCommunityJoin](hooks/useCommunityJoin.md)

### Messaging System
- **Components:** [MessageComponent](components/messages/MessageComponent.md), [MessageInput](components/messages/MessageInput.md)
- **API:** [Messages API](api/messages.md)
- **WebSocket:** [Messages Events](api/websocket-events.md#messaging-events)
- **Module:** [Messages Module](modules/messaging/messages.md)
- **State:** [Messages API + Slice](state/messagesApi.md)
- **Hooks:** [useWebSocketEvent](hooks/useWebSocketEvent.md)

### Voice & Video
- **Components:** [VoiceBottomBar](components/voice/VoiceBottomBar.md), Voice controls
- **API:** [LiveKit API](api/livekit.md), [Voice Presence API](api/voice-presence.md)
- **WebSocket:** [Voice Events](api/websocket-events.md#voice-events)
- **Module:** [LiveKit Module](modules/voice/livekit.md)
- **State:** [Voice Slice](state/voiceSlice.md), [LiveKit API](state/livekitApi.md)
- **Hooks:** [useVoiceConnection](hooks/useVoiceConnection.md), [useDeviceSettings](hooks/useDeviceSettings.md)

### Role-Based Access Control
- **Components:** [RoleBasedComponents](components/roles/RoleBasedComponents.md)
- **API:** [Roles API](api/roles.md)
- **Module:** [Roles Module](modules/core/roles.md)
- **State:** [Roles API](state/rolesApi.md)
- **Hooks:** [useUserPermissions](hooks/useUserPermissions.md)

---

## 🛠️ Development Workflow References

### Making API Changes
1. Update [Backend Module](modules/) documentation
2. Update [API Endpoint](api/) documentation  
3. Update [Frontend State](state/) documentation
4. Update affected [Components](components/)
5. Update [WebSocket Events](api/websocket-events.md) if needed
6. Update this cross-reference document

### Adding New Components
1. Create component following [Component Template](templates/component.template.md)
2. Document API dependencies in cross-reference
3. Update related [Hook](hooks/) documentation
4. Update [State Management](state/) integration
5. Add to component README and cross-reference

### WebSocket Event Changes
1. Update [WebSocket Events](api/websocket-events.md)
2. Update related [Backend Module](modules/) documentation
3. Update [Frontend Hooks](hooks/) that handle the events
4. Update [Component](components/) integration
5. Update cross-reference event flows

This cross-reference system ensures that developers can navigate the entire Kraken codebase efficiently and understand the relationships between all parts of the system.