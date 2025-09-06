# React Components Documentation

This directory contains comprehensive documentation for all React components in the Kraken frontend application. Each component is organized by feature area and documented with real implementation details, usage patterns, and integration examples.

## Documentation Structure

### Authentication Components (`auth/`)
- **[LoginPage](auth/LoginPage.md)** - User authentication interface with form validation and JWT token management
- **[RegisterPage](auth/RegisterPage.md)** - User registration with invitation code requirement and auto-login

### Layout Components (`layout/`)
- **[App](layout/App.md)** - Root application component handling routing, authentication guards, and onboarding flow
- **[Layout](layout/Layout.md)** - Main application shell with navigation, sidebar, and voice integration
- **[HomePage](layout/HomePage.md)** - User dashboard displaying profile information and status

### Navigation Components (`navigation/`)
- **[NavigationLinks](navigation/NavigationLinks.md)** - Top navigation links with authentication-based conditional rendering
- **[ProfileIcon](navigation/ProfileIcon.md)** - User profile avatar with dropdown menu in navigation bar

### Community Management (`community/`)
- **[CommunityFormContent](community/CommunityFormContent.md)** - Form orchestration for community creation/editing
- **[MemberManagement](community/MemberManagement.md)** - Comprehensive member management with RBAC controls
- **[RoleManagement](community/RoleManagement.md)** - Role management interface (placeholder for future implementation)
- **[CommunityFormFields](community/CommunityFormFields.md)** - Name and description input fields
- **[CommunityAvatarUpload](community/CommunityAvatarUpload.md)** - Avatar image upload with preview
- **[CommunityBannerUpload](community/CommunityBannerUpload.md)** - Banner image upload with preview
- **[EditCommunityButton](community/EditCommunityButton.md)** - Quick access to community editing
- **[InviteManagement](community/InviteManagement.md)** - Community invitation system
- **[ChannelManagement](community/ChannelManagement.md)** - Channel creation and management
- **[PrivateChannelMembership](community/PrivateChannelMembership.md)** - Private channel access control

### Message System (`messages/`)
- **[MessageComponent](messages/MessageComponent.md)** - Rich message display with editing, deletion, and mention support
- **[MessageInput](messages/MessageInput.md)** - Message composition with mention detection and real-time features
- **[MessageSkeleton](messages/MessageSkeleton.md)** - Loading placeholder for messages

### Voice & Video (`voice/`)
- **[VoiceBottomBar](voice/VoiceBottomBar.md)** - Persistent voice control interface with comprehensive audio/video controls
- **[VoiceChannelJoinButton](voice/VoiceChannelJoinButton.md)** - Channel connection trigger with permission checking
- **[VoiceChannelUserList](voice/VoiceChannelUserList.md)** - Real-time participant list with speaking indicators
- **[DeviceSettingsDialog](voice/DeviceSettingsDialog.md)** - Audio/video device configuration interface
- **[VideoTiles](voice/VideoTiles.md)** - Video participant display with layout management

### LiveKit Integration (`livekit/`)
- **[LiveKitVideoCall](livekit/LiveKitVideoCall.md)** - Complete WebRTC video calling interface

### Permission System (`roles/`)
- **[RoleBasedComponents](roles/RoleBasedComponents.md)** - RBAC utility components for conditional UI rendering

### Channel Interface (`channels/`)
- **[Channel](channels/Channel.md)** - Individual channel display component
- **[ChannelList](channels/ChannelList.md)** - Community channel listing with hierarchy
- **[ChannelMessageContainer](channels/ChannelMessageContainer.md)** - Message display container for channels

### Onboarding Flow (`onboarding/`)
- **[OnboardingWizard](onboarding/OnboardingWizard.md)** - Multi-step instance setup wizard
- **[WelcomeStep](onboarding/WelcomeStep.md)** - Introduction step
- **[InstanceSetupStep](onboarding/InstanceSetupStep.md)** - Instance configuration
- **[AdminSetupStep](onboarding/AdminSetupStep.md)** - Admin account creation
- **[CommunitySetupStep](onboarding/CommunitySetupStep.md)** - Initial community creation
- **[CompletionStep](onboarding/CompletionStep.md)** - Setup completion confirmation

### Common Utilities (`common/`)
- **[ThemeToggle](common/ThemeToggle.md)** - Dark/light mode switching interface

## Component Categories by Functionality

### 🏗️ **Architecture Components**
Components that provide structure and routing:
- App (root with routing)
- Layout (main shell)
- Navigation components

### 🔐 **Authentication & Permissions**
User authentication and access control:
- LoginPage, RegisterPage
- RoleBasedComponents (RBAC utilities)
- Permission-aware community management

### 💬 **Messaging System**
Real-time messaging with rich features:
- MessageComponent (display with editing/deletion)
- MessageInput (composition with mentions)
- Channel-based message containers

### 🏘️ **Community Management**
Server/community administration:
- Community creation and editing forms
- Member and role management
- Channel organization
- Invitation systems

### 🎤 **Voice & Video**
Professional-grade voice/video communication:
- VoiceBottomBar (persistent controls)
- LiveKit integration
- Device management
- Video tile layouts

### 🚀 **Onboarding**
First-time user and instance setup:
- Multi-step wizard interface
- Instance configuration
- Admin account creation

## Key Implementation Patterns

### 1. **RBAC Integration**
```tsx
// Permission-based rendering throughout the app
<RoleBasedComponent
  communityId={communityId}
  requiredActions={["CREATE_CHANNEL"]}
>
  <CreateChannelButton />
</RoleBasedComponent>
```

### 2. **RTK Query Integration**
```tsx
// Consistent API integration pattern
const { data, isLoading, error } = useGetCommunityQuery(communityId);
const [updateCommunity] = useUpdateCommunityMutation();
```

### 3. **Real-time WebSocket Integration**
```tsx
// Real-time updates via WebSocket hooks
const { socket } = useSocket();
const { sendMessage } = useSendMessageSocket(channelId);
```

### 4. **Material-UI Theming**
```tsx
// Consistent theming and responsive design
const StyledComponent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1),
  },
}));
```

### 5. **Form Management**
```tsx
// Custom hooks for form state management
const {
  formData,
  handleSubmit,
  isValid,
} = useCommunityForm();
```

## Testing Strategy

### Current Status
- Most components lack comprehensive tests
- Testing framework set up (Jest + React Testing Library)
- Component structure supports testability

### Recommended Test Patterns
```tsx
// Permission-based rendering tests
test('should show admin controls with proper permissions', () => {
  mockUseUserPermissions({ hasPermissions: true });
  // ... test implementation
});

// API integration tests
test('should handle loading and error states', () => {
  mockApiResponse({ isLoading: true });
  // ... test implementation
});

// User interaction tests  
test('should submit form on Enter key', () => {
  fireEvent.keyDown(input, { key: 'Enter' });
  // ... assertions
});
```

## Performance Considerations

### Optimization Strategies
1. **Code Splitting:** Route-based lazy loading ready for implementation
2. **Memoization:** React.memo opportunities identified in documentation
3. **Bundle Size:** Tree-shakeable imports used throughout
4. **API Caching:** RTK Query provides automatic caching
5. **WebSocket Optimization:** Efficient event handling patterns

### Current Metrics
- **Bundle Size:** ~2.5MB development build
- **Component Count:** 40+ documented components
- **Dependencies:** Material-UI, RTK Query, React Router, LiveKit

## Development Workflow

### Adding New Components
1. Follow existing component structure and patterns
2. Implement RBAC integration where appropriate
3. Add RTK Query integration for API calls
4. Include proper TypeScript interfaces
5. Document using provided templates

### Updating Existing Components
1. Maintain backward compatibility
2. Update related documentation
3. Consider performance impact
4. Test permission boundary changes

## Integration Points

### Backend API
- RESTful endpoints via RTK Query
- WebSocket events for real-time features
- File upload handling for avatars/banners
- LiveKit token management

### External Services
- **LiveKit:** WebRTC for voice/video
- **Material-UI:** Complete design system
- **React Router:** Client-side routing
- **Redux Toolkit:** State management

## Future Roadmap

### High-Priority Components Needed
1. **Direct Message Interface** - Database schema complete, UI needed
2. **File Attachment System** - Upload infrastructure exists, message integration needed
3. **Advanced Role Management** - RBAC backend ready, admin UI needed
4. **Mobile Responsive Components** - Current desktop focus needs mobile optimization

### Enhancement Opportunities
1. **Rich Text Editor** - Markdown support and advanced formatting
2. **Emoji Reactions** - Message reaction system
3. **Thread Replies** - Message threading interface
4. **Advanced Search** - Message and user search components
5. **Bot Integration** - Bot management and webhook interfaces

## Related Documentation

- [Backend Architecture](../architecture/backend.md) - API structure and business logic
- [Frontend Architecture](../architecture/frontend.md) - State management and routing
- [Database Schema](../architecture/database.md) - Data models and relationships
- [RBAC System](../features/auth-rbac.md) - Permission system implementation
- [Voice Persistence](../features/voice-persistence.md) - Voice connection management
- [Discord Feature Parity](../features/discord-parity.md) - Feature comparison and roadmap