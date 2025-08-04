# Frontend Architecture

Kraken's frontend is built with **React 19** and follows modern React patterns with Redux Toolkit for state management, Material-UI for components, and a feature-based architecture for scalability.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                      │
├─────────────────────────────────────────────────────────────┤
│    Pages/Routes    │    Components     │   Material-UI      │
├─────────────────────────────────────────────────────────────┤
│                      STATE MANAGEMENT                       │
├─────────────────────────────────────────────────────────────┤
│  Redux Toolkit     │  RTK Query APIs   │   Local State     │
├─────────────────────────────────────────────────────────────┤
│                      INTEGRATION LAYER                      │
├─────────────────────────────────────────────────────────────┤
│  WebSocket Hooks   │  LiveKit SDK     │   HTTP Client      │
├─────────────────────────────────────────────────────────────┤
│                      EXTERNAL SERVICES                      │
├─────────────────────────────────────────────────────────────┤
│   Backend APIs     │   LiveKit        │   File Storage     │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

### Core Application Structure (`src/`)

```
src/
├── app/                    # Redux store configuration
│   ├── store.ts           # Main store setup with all slices
│   └── hooks.ts           # Typed Redux hooks
├── pages/                 # Route-level components
├── components/            # Feature-organized UI components
├── features/              # Feature-based state management
├── hooks/                 # Custom React hooks
├── contexts/              # React Context providers
├── types/                 # TypeScript type definitions
├── utils/                 # Utility functions and helpers
└── assets/               # Static assets
```

## 🎯 Feature-Based Architecture

The frontend follows a feature-based organization where each major functionality has its own slice:

### State Management Structure (`src/features/`)

#### **Authentication** (`features/auth/`)
- **authSlice.ts**: User authentication state and RTK Query API
- **Features**: Login, logout, token management, user profile
- **Integration**: JWT token handling, automatic token refresh

#### **Communities** (`features/community/`)
- **communityApiSlice.ts**: Community CRUD operations
- **State**: Community list, selected community, member lists
- **Operations**: Create, update, delete communities, member management

#### **Channels** (`features/channel/`)
- **channelApiSlice.ts**: Channel management API
- **Features**: Channel CRUD, channel selection, typing indicators
- **Types**: Text channels, voice channels, private channels

#### **Messages** (`features/messages/`)
- **messagesApiSlice.ts**: Message operations API
- **messagesSlice.ts**: Local message state management
- **Features**: Real-time message updates, message history, rich text
- **Integration**: WebSocket for real-time updates

#### **Voice & Video** (`features/voice/`)
- **voiceSlice.ts**: Voice connection state
- **voiceThunks.ts**: Async voice operations
- **Features**: Join/leave voice channels, audio/video controls
- **Integration**: LiveKit SDK for WebRTC

#### **Roles & Permissions** (`features/roles/`)
- **rolesApiSlice.ts**: Role management API
- **RoleBasedComponents.tsx**: Permission-based UI rendering
- **useUserPermissions.ts**: Permission checking hooks
- **Features**: Role assignment, permission validation

### Component Organization (`src/components/`)

#### **Community Management** (`components/Community/`)
```
Community/
├── CommunityFormContent.tsx      # Community creation/edit form
├── CommunityFormFields.tsx       # Form field components
├── CommunityFormLayout.tsx       # Form layout wrapper
├── CommunitySettingsForm.tsx     # Settings management
├── CommunityAvatarUpload.tsx     # Avatar upload handling
├── CommunityBannerUpload.tsx     # Banner upload handling
├── EditCommunityButton.tsx       # Edit trigger component
├── MemberManagement.tsx          # Member list and operations
├── RoleManagement.tsx            # Role assignment interface
├── ChannelManagement.tsx         # Channel CRUD interface
└── PrivateChannelMembership.tsx  # Private channel access
```

#### **Channel Components** (`components/Channel/`)
```
Channel/
├── Channel.tsx                   # Main channel view
├── ChannelList.tsx              # Channel sidebar
└── ChannelMessageContainer.tsx   # Message display container
```

#### **Voice Features** (`components/Voice/`)
```
Voice/
├── VoiceBottomBar.tsx           # Persistent voice controls
├── VoiceChannelJoinButton.tsx   # Voice channel entry point
├── VoiceChannelUserList.tsx     # Users in voice channel
└── VideoTiles.tsx               # Video call interface
```

#### **Messaging** (`components/Message/`)
```
Message/
├── MessageComponent.tsx         # Individual message display
├── MessageInput.tsx            # Message composition
└── MessageSkeleton.tsx         # Loading placeholder
```

## 🔄 State Management Strategy

### Redux Toolkit Setup

The application uses **Redux Toolkit** with **RTK Query** for efficient state management:

```typescript
// store.ts
export const store = configureStore({
  reducer: {
    // RTK Query APIs
    [authApi.reducerPath]: authApi.reducer,
    [communityApi.reducerPath]: communityApi.reducer,
    [channelApi.reducerPath]: channelApi.reducer,
    [messagesApi.reducerPath]: messagesApi.reducer,
    // Local state slices
    messages: messagesReducer,
    voice: voiceReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      communityApi.middleware,
      // ... other API middlewares
    ),
});
```

### Data Fetching Patterns

#### **RTK Query APIs**
- **Automatic Caching**: Intelligent caching with tag-based invalidation
- **Background Refetching**: Automatic data synchronization
- **Optimistic Updates**: Immediate UI updates with rollback capability
- **Error Handling**: Centralized error handling and retry logic

#### **WebSocket Integration**
Real-time features are handled through custom hooks that integrate with Redux:

```typescript
// useChannelWebSocket.ts
export const useChannelWebSocket = (channelId: string) => {
  const socket = useSocket();
  const dispatch = useDispatch();
  
  useEffect(() => {
    if (!socket || !channelId) return;
    
    socket.on(ServerEvents.NEW_MESSAGE, (data) => {
      dispatch(messagesApi.util.invalidateTags(['Messages']));
    });
    
    return () => socket.off(ServerEvents.NEW_MESSAGE);
  }, [socket, channelId, dispatch]);
};
```

## 🎨 UI/UX Architecture

### Material-UI Integration
- **Theme System**: Consistent design tokens and theming
- **Component Library**: Leverages MUI components with custom styling
- **Responsive Design**: Mobile-first responsive layouts
- **Dark/Light Mode**: Theme switching capability

### Layout Structure
```
App.tsx
├── Layout.tsx                    # Main application layout
│   ├── NavBar/                  # Top navigation
│   │   ├── NavigationLinks.tsx
│   │   └── ProfileIcon.tsx
│   ├── CommunityList/           # Left sidebar
│   │   ├── CommunityListItem.tsx
│   │   └── CreateCommunityButton.tsx
│   └── Main Content Area
│       ├── Channel View
│       └── Voice Bottom Bar
```

## 🔌 Real-time Integration

### WebSocket Hooks
Custom hooks manage WebSocket connections and events:

#### **useSocket.ts**
- **Connection Management**: Automatic connection/reconnection
- **Authentication**: JWT token integration
- **Event Handling**: Type-safe event emission and listening

#### **Voice Connection Hooks**
```typescript
// useVoiceConnection.ts
export const useVoiceConnection = () => {
  const dispatch = useDispatch();
  const voiceState = useSelector((state) => state.voice);
  
  return {
    state: voiceState,
    actions: {
      joinVoiceChannel: handleJoinVoiceChannel,
      leaveVoiceChannel: handleLeaveVoiceChannel,
      toggleAudio: handleToggleAudio,
      toggleVideo: handleToggleVideo,
    },
  };
};
```

### LiveKit Integration
Voice and video functionality uses the LiveKit React SDK:

- **Room Management**: Automatic room joining/leaving
- **Media Controls**: Audio/video/screen share controls
- **Participant Management**: Track participant states
- **Error Handling**: Connection error recovery

## 🛡️ Permission System

### Role-Based Components
The frontend implements a sophisticated permission system:

```typescript
// RoleBasedComponents.tsx
export function RoleBasedComponent({
  communityId,
  children,
  requiredActions,
}: RoleBasedComponentProps) {
  const { hasPermissions, isLoading } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId,
    actions: requiredActions,
  });

  if (!hasPermissions) return null;
  return <>{children}</>;
}
```

### Permission Hooks
```typescript
// useUserPermissions.ts
export const useUserPermissions = ({
  resourceType,
  resourceId,
  actions,
}) => {
  // Permission checking logic
  return { hasPermissions, isLoading, error };
};
```

## 📱 Responsive Design

### Mobile-First Approach
- **Breakpoint System**: Material-UI's responsive breakpoints
- **Adaptive Layouts**: Components adapt to screen size
- **Touch Interactions**: Mobile-optimized interaction patterns

### Planned Mobile Features
- **Progressive Web App**: PWA capabilities for mobile
- **Native Apps**: React Native implementation roadmap
- **Desktop App**: Electron wrapper for desktop experience

## 🧪 Component Testing Strategy

### Testing Tools
- **React Testing Library**: Component testing
- **Jest**: Unit testing framework
- **MSW**: API mocking for integration tests

### Testing Patterns
- **Component Testing**: Isolated component behavior
- **Hook Testing**: Custom hook logic validation
- **Integration Testing**: Feature workflow testing

## 🚀 Performance Optimization

### Code Splitting
- **Route-Based Splitting**: Lazy loading for different pages
- **Component Splitting**: Dynamic imports for heavy components
- **Feature Splitting**: Separate bundles for optional features

### State Optimization
- **Memoization**: React.memo for expensive components
- **Selector Optimization**: Reselect for derived state
- **Query Optimization**: RTK Query caching strategies

### Asset Optimization
- **Image Optimization**: Lazy loading and responsive images
- **Bundle Analysis**: Webpack bundle analyzer integration
- **Tree Shaking**: Unused code elimination

## 🔄 Data Flow Examples

### Message Sending Flow
1. User types message in `MessageInput`
2. Form submission triggers `useSendMessageSocket` hook
3. WebSocket event sent to backend via `socket.emit`
4. Backend processes message and broadcasts to room
5. Other clients receive message via WebSocket
6. `useChannelWebSocket` hook updates local state
7. `MessageComponent` re-renders with new message

### Voice Channel Join Flow
1. User clicks join button in `VoiceChannelJoinButton`
2. `useVoiceConnection` hook dispatches `joinVoiceChannel` thunk
3. Thunk requests LiveKit token from backend
4. LiveKit room connection established
5. Voice state updated in Redux store
6. `VoiceBottomBar` appears with controls
7. Other users see participant join via voice presence

## 🔧 Development Tools

### Development Workflow
- **Hot Reload**: Vite-powered fast refresh
- **TypeScript**: Full type safety throughout
- **ESLint**: Code quality and consistency
- **Prettier**: Automatic code formatting

### Debugging Tools
- **Redux DevTools**: State inspection and time travel
- **React DevTools**: Component tree inspection
- **Browser DevTools**: Network and performance monitoring

This architecture provides a scalable, maintainable frontend that can grow with the application's needs while maintaining excellent user experience and developer productivity.