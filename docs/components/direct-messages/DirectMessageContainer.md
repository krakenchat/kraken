# DirectMessageContainer Component

## Overview

`DirectMessageContainer` is the main container component for displaying direct message conversations. It wraps the unified `MessageContainerWrapper` and provides DM-specific context, including member lists, message handling with file upload support, and WebSocket integration for real-time messaging.

## Component Details

**Location**: `frontend/src/components/DirectMessages/DirectMessageContainer.tsx`

**Type**: Functional Component with React hooks

**Purpose**: Orchestrates direct message display with member management, file uploads, real-time updates, and unified message interface

**Last Updated**: 2025-01-06 (Unified messaging system with file upload support)

## Props

```typescript
interface DirectMessageContainerProps {
  dmGroupId: string;  // Required: Direct message group ID for the conversation
}
```

### Prop Details

- **`dmGroupId`** (string, required)
  - MongoDB ObjectId of the direct message group
  - Used for API queries, WebSocket rooms, and message context
  - Must correspond to a valid DM group where the user is a member

## Hooks Integration

### State Management Hooks

```typescript
// User profile for author ID
const { data: user } = useProfileQuery();
const authorId = user?.id || "";

// File upload support
const { uploadFile } = useFileUpload();
const [addAttachment] = useAddAttachmentMutation();
const { showNotification } = useNotification();
const pendingFilesRef = React.useRef<File[] | null>(null);

// RTK Query for DM group data
const { data: dmGroup } = useGetDmGroupQuery(dmGroupId);

// Custom hook for DM messages with real-time updates
const messagesHookResult = useDirectMessages(dmGroupId);

// Unified send message hook with file upload callback
const sendMessage = useSendMessage("dm", async (messageId: string) => {
  // File upload callback logic
});
```

### Hook Dependencies

1. **`useProfileQuery()`**
   - Source: `usersSlice.ts`
   - Fetches current user profile for authorId
   - Required for message creation

2. **`useFileUpload()`**
   - Source: `hooks/useFileUpload.ts`
   - Handles file uploads with resource types
   - Supports multiple concurrent uploads

3. **`useAddAttachmentMutation()`**
   - Source: `messagesApiSlice.ts`
   - Associates uploaded files with messages
   - Handles pendingAttachments counter

4. **`useGetDmGroupQuery(dmGroupId)`**
   - Source: `directMessagesApiSlice.ts`
   - Fetches DM group details including members
   - Provides member data for mentions and UI display
   - Auto-refetches on focus/reconnection

5. **`useDirectMessages(dmGroupId)`**
   - Source: `hooks/useDirectMessages.ts`
   - Manages message state with real-time WebSocket updates
   - Returns messages, loading state, and pagination info
   - Integrates with Redux store for caching

6. **`useSendMessage("dm", callback)`**
   - Source: `hooks/useSendMessage.ts`
   - Unified message sending for channels and DMs
   - Supports acknowledgment callback for file uploads
   - Emits SEND_DM WebSocket event

## Core Functionality

### Message Handling with File Upload Support

**Send Message Function:**
```typescript
const handleSendMessage = async (messageContent: string, spans: unknown[], files?: File[]) => {
  // Create message with pendingAttachments count
  const msg = {
    directMessageGroupId: dmGroupId,
    authorId,
    spans,
    attachments: [],
    pendingAttachments: files?.length || 0,
    reactions: [],
    sentAt: new Date().toISOString(),
  };

  // Store files in ref for callback
  pendingFilesRef.current = files || null;

  // Send message immediately (optimistic)
  sendMessage(msg);
};
```

**File Upload Callback:**
```typescript
const sendMessage = useSendMessage("dm", async (messageId: string) => {
  const files = pendingFilesRef.current;
  if (!files || files.length === 0) return;

  try {
    // Upload all files in parallel
    const uploadPromises = files.map(file =>
      uploadFile(file, {
        resourceType: "MESSAGE_ATTACHMENT",
        resourceId: messageId,
      })
    );

    const uploadedFiles = await Promise.all(uploadPromises);

    // Add each uploaded file to the message
    for (const uploadedFile of uploadedFiles) {
      await addAttachment({
        messageId,
        fileId: uploadedFile.id,
      });
    }
  } catch (error) {
    console.error("Failed to upload files:", error);
    showNotification(error.message, "error");

    // Decrement pendingAttachments counter for failed uploads
    for (let i = 0; i < files.length; i++) {
      await addAttachment({ messageId }); // No fileId = just decrement
    }
  } finally {
    pendingFilesRef.current = null;
  }
});
```

**Features:**
- **Rich Text Support**: Spans for mentions, formatting, links
- **File Attachments**: Multiple file upload support
- **Optimistic Updates**: Message appears immediately with pending state
- **Progress Tracking**: pendingAttachments counter shows upload status
- **Error Handling**: User notification on upload failure
- **Parallel Uploads**: All files uploaded concurrently for speed

### User Mentions Integration

**Member-to-Mention Conversion:**
```typescript
const userMentions: UserMention[] = React.useMemo(() => {
  return dmGroup?.members?.map((member) => ({
    id: member.user.id,
    username: member.user.username,
    displayName: member.user.displayName || undefined,
  })) || [];
}, [dmGroup?.members]);
```

**Purpose:**
- Converts DM group members to mention format for input autocomplete
- Enables @username mentions within the conversation  
- Updates automatically when members change
- Filters out null/undefined display names

### Member List Integration

**Member List Component Creation:**
```typescript
const memberListComponent = (
  <MemberListContainer
    contextType="dm"
    contextId={dmGroupId}
  />
);
```

**Features:**
- Shows all DM group members with online status
- Contextual member display (different from channel members)
- Integrated with unified member list system
- Auto-updates with presence information

## UI Integration

### MessageContainerWrapper Props

```typescript
<MessageContainerWrapper
  contextType="dm"                              // Context: direct messages
  contextId={dmGroupId}                         // DM group identifier
  useMessagesHook={() => messagesHookResult}    // Message state hook
  userMentions={userMentions}                   // Available users for @mentions
  onSendMessage={handleSendMessage}             // Message sending handler
  memberListComponent={memberListComponent}     // Right sidebar member list
  placeholder="Type a direct message..."        // Input placeholder text
  emptyStateMessage="No messages yet. Start the conversation!"  // Empty state
/>
```

### Context-Specific Customization

**DM-Specific Features:**
- Custom placeholder text for direct message context
- DM-appropriate empty state messaging  
- Member list shows DM participants (not channel members)
- WebSocket events use DM room identifiers

**Unified Interface Benefits:**
- Consistent message display across channels and DMs
- Shared message components (reactions, editing, etc.)
- Common keyboard shortcuts and interactions
- Unified attachment and emoji support

## Component Architecture

### Design Pattern: Wrapper + Context

```
DirectMessageContainer (DM-specific logic)
├── useDirectMessages (DM message state)
├── useDirectMessageWebSocket (DM WebSocket)  
├── useGetDmGroupQuery (DM group data)
└── MessageContainerWrapper (unified UI)
    ├── MessageList (shared message display)
    ├── MessageInput (shared input component)
    └── MemberListContainer (contextual members)
```

**Benefits:**
- **Separation of Concerns**: DM-specific logic separate from UI components
- **Reusability**: Shared message UI between channels and DMs  
- **Maintainability**: Changes to message UI affect both contexts
- **Consistency**: Identical user experience across message types

### State Management Flow

```
1. Component mounts with dmGroupId
2. useGetDmGroupQuery fetches DM group data
3. useDirectMessages sets up message state + WebSocket listeners
4. useDirectMessageWebSocket prepares message sending
5. MessageContainerWrapper renders with DM context
6. User interactions flow through DM-specific handlers
7. Real-time updates flow through WebSocket hooks
```

## WebSocket Integration

### Room Management

**DM Room Identifier**: Uses `dmGroupId` as WebSocket room ID
**Events Handled**:
- `NEW_DM` - New messages in the DM group
- `UPDATE_MESSAGE` - Message edits
- `DELETE_MESSAGE` - Message deletions
- `REACTION_ADDED/REMOVED` - Message reactions

### Real-time Message Updates

**Message Reception Flow:**
```
WebSocket Event → useDirectMessages → Redux Update → UI Re-render
```

**Message Sending Flow:**  
```
User Input → handleSendMessage → sendDirectMessage → WebSocket Emit
```

## Error Handling

### Common Error Scenarios

1. **Invalid DM Group ID**
   - Query returns 404 error
   - Component shows error state
   - User redirected or notified

2. **WebSocket Connection Issues**
   - Messages may not send in real-time
   - Fallback to polling or retry logic
   - User notified of connection status

3. **Permission Issues**
   - User not member of DM group
   - API returns 403 Forbidden
   - Component shows access denied state

### Error Boundaries

```typescript
// Error handling in useGetDmGroupQuery
const { data: dmGroup, error, isLoading } = useGetDmGroupQuery(dmGroupId);

if (error) {
  // Handle API errors (403, 404, etc.)
  return <ErrorComponent message="Unable to load conversation" />;
}

if (isLoading) {
  // Show loading skeleton
  return <MessageContainerSkeleton />;
}
```

## Performance Considerations

### Optimizations

1. **React.useMemo for User Mentions**
   - Prevents unnecessary re-computation of mention list
   - Only updates when DM group members change
   - Reduces input autocomplete re-renders

2. **Hook Result Caching**
   - `messagesHookResult` maintains stable reference
   - Prevents MessageContainerWrapper from unnecessary re-renders
   - WebSocket connection persisted across renders

3. **Selective Re-rendering**
   - Components only re-render when relevant data changes
   - RTK Query handles data caching automatically
   - WebSocket updates target specific UI elements

### Memory Management

- **WebSocket Cleanup**: Hooks handle connection cleanup on unmount
- **Query Cleanup**: RTK Query manages cache lifecycle  
- **Event Listener Cleanup**: All event listeners removed on unmount

## Usage Examples

### Basic Usage

```typescript
import DirectMessageContainer from '@/components/DirectMessages/DirectMessageContainer';

function DirectMessagesPage() {
  const { dmGroupId } = useParams();
  
  return (
    <div className="dm-page">
      <DirectMessageContainer dmGroupId={dmGroupId} />
    </div>
  );
}
```

### With Navigation Integration

```typescript
import { useNavigate } from 'react-router-dom';

function DMConversationView({ dmGroupId }: { dmGroupId: string }) {
  const navigate = useNavigate();
  
  const handleBackToDMs = () => {
    navigate('/messages');
  };
  
  return (
    <div className="dm-conversation">
      <header>
        <button onClick={handleBackToDMs}>← Back to Messages</button>
        <h1>Direct Message</h1>
      </header>
      <DirectMessageContainer dmGroupId={dmGroupId} />
    </div>
  );
}
```

### Error Handling Example

```typescript
function SafeDMContainer({ dmGroupId }: { dmGroupId: string }) {
  if (!dmGroupId) {
    return <div>Invalid conversation ID</div>;
  }
  
  return (
    <ErrorBoundary fallback={<DMErrorFallback />}>
      <DirectMessageContainer dmGroupId={dmGroupId} />
    </ErrorBoundary>
  );
}

function DMErrorFallback() {
  return (
    <div className="dm-error">
      <h2>Unable to load conversation</h2>
      <p>Please try refreshing the page or contact support.</p>
    </div>
  );
}
```

## Testing

### Unit Tests

**Test File**: `DirectMessageContainer.test.tsx`

**Test Coverage:**
- Props handling and validation
- Hook integrations (mocked)
- Message sending functionality  
- Member list integration
- Error handling scenarios

**Example Test:**
```typescript
describe('DirectMessageContainer', () => {
  it('should render with valid dmGroupId', () => {
    const mockDmGroup = {
      id: 'test-dm-group',
      members: [{ user: { id: '1', username: 'test' } }]
    };
    
    jest.mocked(useGetDmGroupQuery).mockReturnValue({
      data: mockDmGroup,
      isLoading: false,
      error: null
    });
    
    render(<DirectMessageContainer dmGroupId="test-dm-group" />);
    
    expect(screen.getByPlaceholderText('Type a direct message...')).toBeInTheDocument();
  });
});
```

### Integration Tests

- **WebSocket Message Flow**: Send and receive messages end-to-end
- **Member List Updates**: Member changes reflect in UI
- **Real-time Synchronization**: Multiple clients receive updates

## Related Components

### Direct Dependencies

- **`MessageContainerWrapper`**: Unified message display component
- **`MemberListContainer`**: Member list for DM participants  
- **`useDirectMessages`**: DM-specific message state management
- **`useDirectMessageWebSocket`**: DM WebSocket integration
- **`useGetDmGroupQuery`**: DM group data fetching

### Related DM Components

- **`DirectMessageList`**: List of all user's DM conversations
- **`DirectMessageInput`**: Specialized input for DM context (if different from shared)
- **`CreateDMDialog`**: New DM conversation creation

### Shared Message Components

- **`MessageComponent`**: Individual message display
- **`MessageReactions`**: Reaction handling (works in DM context)
- **`MessageInput`**: Rich text input with mentions
- **`MemberList`**: Generic member display component

---

## Migration Notes

### From Channel to DM Context

When adapting channel-based message components for DM use:

1. **Context Type**: Change from `"channel"` to `"dm"`
2. **ID Parameter**: Use `dmGroupId` instead of `channelId`  
3. **WebSocket Events**: Handle DM-specific event names
4. **Member Data**: Access DM group members vs. channel members
5. **Permissions**: Use DM group membership vs. channel permissions

### Backwards Compatibility

Component maintains compatibility with:
- **Legacy Message Format**: Supports existing message structures
- **Shared Components**: Works with existing MessageInput, MessageComponent, etc.
- **WebSocket Protocol**: Uses established WebSocket event patterns
- **State Management**: Integrates with existing Redux architecture

This component demonstrates the successful integration of direct messages into Kraken's unified messaging system while maintaining the flexibility to customize DM-specific features and behaviors.