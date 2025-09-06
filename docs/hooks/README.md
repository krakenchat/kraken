# Custom Hooks Documentation

This directory contains comprehensive documentation for all custom React hooks in the Kraken application. Each hook is documented with complete TypeScript interfaces, real-world usage examples, implementation details, performance considerations, testing patterns, and troubleshooting guides.

## Hook Categories

### **WebSocket Hooks** 🌐
Real-time communication and event handling:

- **[useSocket](./useSocket.md)** - Core WebSocket connection management and context access
- **[useChannelWebSocket](./useChannelWebSocket.md)** - Real-time message events for channels with Redux integration  
- **[useSendMessageSocket](./useSendMessageSocket.md)** - Focused message sending with callback support
- **[useCommunityJoin](./useCommunityJoin.md)** - Community WebSocket room management

### **Voice & Video Hooks** 🎤
LiveKit integration and media device management:

- **[useVoiceConnection](./useVoiceConnection.md)** - Comprehensive voice/video connection management
- **[useVoiceEvents](./useVoiceEvents.md)** - Voice presence WebSocket event handling
- **[useRoom](./useRoom.md)** - LiveKit room context and management
- **[useDeviceSettings](./useDeviceSettings.md)** - Audio/video device enumeration and preferences

### **Authentication & Permissions Hooks** 🔐
RBAC system and user management:

- **[useUserPermissions](./useUserPermissions.md)** - Comprehensive RBAC permission checking system
- **useMyRolesForCommunity** - Community-specific role queries (documented in useUserPermissions.md)
- **useMyRolesForChannel** - Channel-specific role queries (documented in useUserPermissions.md)
- **useMyInstanceRoles** - Instance-level role queries (documented in useUserPermissions.md)
- **useCanPerformAction** - Simple permission checking utility (documented in useUserPermissions.md)
- **useHasAnyPermission** - Multi-action permission checking (documented in useUserPermissions.md)

### **Form Management Hooks** 📝
Form state and validation:

- **[useCommunityForm](./useCommunityForm.md)** - Community creation/editing form with file uploads and validation

### **State Management Hooks** 🗄️
Redux integration and typed hooks:

- **[useAppDispatch & useAppSelector](./useAppDispatch.md)** - Type-safe Redux hooks with comprehensive examples

## Hook Implementation Summary

| Hook | Type | Category | Primary Use Case |
|------|------|----------|------------------|
| useSocket | Context | WebSocket | Socket.IO client access |
| useChannelWebSocket | Effect | WebSocket | Real-time message handling |
| useSendMessageSocket | Logic | WebSocket | Message sending with callbacks |
| useCommunityJoin | Effect | WebSocket | Community room management |
| useVoiceConnection | State | Voice | Voice/video control interface |
| useVoiceEvents | Effect | Voice | Voice presence synchronization |
| useRoom | Context | Voice | LiveKit room management |
| useDeviceSettings | State | Device | Media device configuration |
| useUserPermissions | Permission | Auth | RBAC permission checking |
| useCommunityForm | State | Forms | Community form management |
| useAppDispatch | Redux | State | Type-safe Redux dispatching |
| useAppSelector | Redux | State | Type-safe state selection |

## Hook Documentation Format

Each hook documentation includes:

- **Hook Signature** - Complete TypeScript interface
- **Parameters** - All parameters with types and descriptions
- **Return Value** - Complete return object with all properties
- **Usage Examples** - Basic and advanced usage patterns
- **Implementation Details** - Internal state and logic
- **Dependencies** - Internal and external dependencies
- **API Integration** - RTK Query and WebSocket integrations
- **Performance Considerations** - Memoization and optimization
- **Error Handling** - Error states and recovery patterns
- **Testing** - Test patterns and examples

## Common Hook Patterns

### WebSocket Real-time Communication

```tsx
import { useChannelWebSocket } from '@/hooks/useChannelWebSocket';
import { useCommunityJoin } from '@/hooks/useCommunityJoin';

function MessageContainer({ communityId }: { communityId: string }) {
  // Join WebSocket rooms for the community
  useCommunityJoin(communityId);
  
  // Handle real-time message events
  const { sendMessage } = useChannelWebSocket(communityId);
  
  const handleSend = (content: string) => {
    sendMessage({
      content,
      channelId: 'channel-123',
      authorId: 'user-456',
      spans: [],
      attachments: [],
      reactions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };
  
  return <MessageInterface onSend={handleSend} />;
}
```

### Permission-Based Component Rendering

```tsx
import { useUserPermissions } from '@/features/roles/useUserPermissions';

function AdminPanel({ communityId }: { communityId: string }) {
  const { hasPermissions, isLoading } = useUserPermissions({
    resourceType: 'COMMUNITY',
    resourceId: communityId,
    actions: ['MANAGE_COMMUNITY', 'DELETE_MESSAGES']
  });
  
  if (isLoading) return <div>Checking permissions...</div>;
  if (!hasPermissions) return <div>Access denied</div>;
  
  return <AdminInterface />;
}
```

### Voice Connection Management

```tsx
import { useVoiceConnection } from '@/hooks/useVoiceConnection';

function VoiceControls() {
  const { state, actions } = useVoiceConnection();
  
  const handleJoinVoice = async () => {
    await actions.joinVoiceChannel(
      'channel-123',
      'General Voice',
      'community-456',
      false,
      new Date().toISOString()
    );
  };
  
  return (
    <div>
      {state.isConnected ? (
        <div>
          <span>Connected to {state.currentChannelName}</span>
          <button onClick={actions.toggleMute}>
            {state.isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button onClick={actions.leaveVoiceChannel}>Leave</button>
        </div>
      ) : (
        <button onClick={handleJoinVoice}>Join Voice</button>
      )}
    </div>
  );
}
```

### Form Management with File Uploads

```tsx
import { useCommunityForm } from '@/hooks/useCommunityForm';

function CreateCommunityForm() {
  const {
    formData,
    previewUrls,
    formErrors,
    handleInputChange,
    validateForm,
  } = useCommunityForm();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    // Submit form data with files
    const formDataToSend = new FormData();
    formDataToSend.append('name', formData.name);
    formDataToSend.append('description', formData.description);
    if (formData.avatar) formDataToSend.append('avatar', formData.avatar);
    if (formData.banner) formDataToSend.append('banner', formData.banner);
    
    // Submit to API...
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.name}
        onChange={handleInputChange('name')}
        placeholder="Community name"
      />
      {formErrors.name && <span>{formErrors.name}</span>}
      
      <input
        type="file"
        accept="image/*"
        onChange={handleInputChange('avatar')}
      />
      {previewUrls.avatar && <img src={previewUrls.avatar} alt="Preview" />}
      
      <button type="submit">Create Community</button>
    </form>
  );
}
```

## Hook Dependencies

### React Hooks
Most custom hooks build on React's built-in hooks:
- `useState` - Local state management
- `useEffect` - Side effects and cleanup
- `useCallback` - Function memoization
- `useMemo` - Value memoization
- `useRef` - Reference management

### External Libraries
- **Socket.IO Client** - WebSocket communication
- **RTK Query** - API state management
- **LiveKit** - WebRTC functionality
- **Material-UI** - Component theming

### Internal Dependencies
- Custom utilities and type definitions
- Redux store and selectors
- API service configurations

## Performance Considerations

### Optimization Strategies

1. **Memoization**: Use `useCallback` and `useMemo` for expensive operations
2. **Debouncing**: Prevent excessive API calls with `useDebounce`
3. **Cleanup**: Proper effect cleanup to prevent memory leaks
4. **Dependency Arrays**: Careful management to prevent unnecessary re-renders

### Best Practices

- **Minimal Dependencies**: Keep hook dependency arrays minimal
- **Separation of Concerns**: Each hook should have a single responsibility
- **Error Boundaries**: Implement proper error handling
- **Type Safety**: Full TypeScript coverage for all hooks

## Testing Strategy

### Hook Testing
- **React Testing Library Hooks** - Unit testing hook behavior
- **Mock Dependencies** - Testing with mocked external services
- **Integration Testing** - Testing hooks within components
- **Error Scenarios** - Testing error handling and edge cases

### Test Patterns

```tsx
import { renderHook } from '@testing-library/react-hooks';
import { useCustomHook } from '../useCustomHook';

test('should handle data correctly', () => {
  const { result } = renderHook(() => useCustomHook());
  
  expect(result.current.data).toBeDefined();
});
```

## Hook Development Guidelines

### Creating New Hooks

1. **Define Purpose**: Clear single responsibility
2. **TypeScript Interfaces**: Complete type definitions
3. **Error Handling**: Robust error management
4. **Performance**: Optimization considerations
5. **Documentation**: Comprehensive usage examples
6. **Testing**: Complete test coverage

### Hook Naming Conventions

- Start with `use` (React convention)
- Descriptive and specific names
- Consistent with React ecosystem

### Common Anti-Patterns

- **Overuse of Effects**: Minimize `useEffect` usage
- **Inline Functions**: Avoid creating functions in render
- **Missing Dependencies**: Include all dependencies in arrays
- **Stale Closures**: Be aware of closure capturing

## Integration Examples

### WebSocket + Redux Integration

```tsx
import { useChannelWebSocket } from '@/hooks/useChannelWebSocket';
import { useAppDispatch } from '@/app/hooks';

function useRealTimeMessages(communityId: string) {
  const dispatch = useAppDispatch();
  
  // WebSocket events are automatically handled by useChannelWebSocket
  // which dispatches Redux actions to keep the store updated
  const { sendMessage } = useChannelWebSocket(communityId);
  
  return { sendMessage };
}
```

### Voice + Device Management Integration

```tsx
import { useVoiceConnection } from '@/hooks/useVoiceConnection';
import { useDeviceSettings } from '@/hooks/useDeviceSettings';

function VoiceControlsWithDevices() {
  const { state: voiceState, actions: voiceActions } = useVoiceConnection();
  const {
    audioInputDevices,
    selectedAudioInputId,
    setSelectedAudioInput
  } = useDeviceSettings();
  
  const handleDeviceChange = async (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    
    // Apply immediately if in active call
    if (voiceState.isConnected) {
      await voiceActions.switchAudioInputDevice(deviceId);
    }
  };
  
  return (
    <div>
      <select 
        value={selectedAudioInputId}
        onChange={(e) => handleDeviceChange(e.target.value)}
      >
        {audioInputDevices.map(device => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
      
      {voiceState.isConnected && (
        <div>Connected to {voiceState.currentChannelName}</div>
      )}
    </div>
  );
}
```

### Permissions + Form Integration

```tsx
import { useUserPermissions } from '@/features/roles/useUserPermissions';
import { useCommunityForm } from '@/hooks/useCommunityForm';

function ConditionalCommunityEditor({ communityId }: { communityId: string }) {
  const { hasPermissions: canEdit } = useUserPermissions({
    resourceType: 'COMMUNITY',
    resourceId: communityId,
    actions: ['EDIT_COMMUNITY']
  });
  
  const { hasPermissions: canDelete } = useUserPermissions({
    resourceType: 'COMMUNITY',
    resourceId: communityId,
    actions: ['DELETE_COMMUNITY']
  });
  
  const communityForm = useCommunityForm({
    initialData: {
      name: 'Existing Community',
      description: 'Community description',
      avatar: null,
      banner: null,
    }
  });
  
  if (!canEdit) {
    return <div>You don't have permission to edit this community</div>;
  }
  
  return (
    <div>
      <form>
        <input
          value={communityForm.formData.name}
          onChange={communityForm.handleInputChange('name')}
          disabled={!canEdit}
        />
        {/* Other form fields */}
      </form>
      
      {canDelete && (
        <button className="danger">Delete Community</button>
      )}
    </div>
  );
}
```

## Getting Started

To understand a hook:

1. **Read the overview** to understand its purpose
2. **Check the hook signature** for parameters and return value
3. **Review usage examples** for integration patterns
4. **Look at dependencies** to understand requirements
5. **Check performance notes** for optimization guidance