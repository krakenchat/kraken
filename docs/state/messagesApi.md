# Messages Redux API Slice & State

> **Location:** `frontend/src/features/messages/messagesApiSlice.ts` & `messagesSlice.ts`  
> **Type:** Combined RTK Query API + Redux Slice  
> **Domain:** Real-time messaging system

## Overview

The Messages system combines RTK Query API for server operations with a Redux slice for optimized local state management. This dual approach enables efficient pagination, real-time updates via WebSocket, and optimistic UI updates while maintaining a responsive chat experience.

**Key Features:**
- Paginated message loading with continuation tokens
- Real-time message updates via WebSocket integration
- Optimistic updates for editing/deleting messages
- Memory-efficient message caching with automatic cleanup
- Message deduplication and ordering

## API Configuration

```typescript
export const messagesApi = createApi({
  reducerPath: "messagesApi",
  baseQuery: getBaseAuthedQuery(
    fetchBaseQuery({
      baseUrl: "/api/messages",
      prepareHeaders,
    })
  ),
  endpoints: (builder) => ({
    // API endpoints for server operations
  }),
});
```

### Base Configuration
- **Reducer Path:** `messagesApi`
- **Base Query:** `getBaseAuthedQuery` (includes JWT authentication and token refresh)
- **Base URL:** `/api/messages`
- **Tag Types:** None (uses Redux slice for local state management)

## Redux Slice Configuration

```typescript
interface MessagesState {
  byChannelId: {
    [channelId: string]: {
      messages: Message[];
      continuationToken?: string;
    };
  };
}

const messagesSlice = createSlice({
  name: "messagesSlice",
  initialState,
  reducers: {
    setMessages,     // Replace all messages for a channel
    appendMessages,  // Add older messages (pagination)
    prependMessage,  // Add new message at top (real-time)
    updateMessage,   // Update existing message
    deleteMessage,   // Remove message
    clearMessages,   // Clear channel messages
  },
});
```

## API Endpoints

### Query Endpoints

#### getMessagesByChannel
```typescript
getMessagesByChannel: builder.query<
  { messages: Message[]; continuationToken?: string },
  { channelId: string; limit?: number; continuationToken?: string }
>({
  query: ({ channelId, limit = 25, continuationToken }) => {
    let url = `/channel/${channelId}?limit=${limit}`;
    if (continuationToken) url += `&continuationToken=${continuationToken}`;
    return { url, method: "GET" };
  },
  async onQueryStarted({ channelId, continuationToken }, { dispatch, queryFulfilled }) {
    try {
      const { data } = await queryFulfilled;
      if (data?.messages) {
        if (continuationToken) {
          dispatch(appendMessages({
            channelId,
            messages: data.messages,
            continuationToken: data.continuationToken,
          }));
        } else {
          dispatch(setMessages({
            channelId,
            messages: data.messages,
            continuationToken: data.continuationToken,
          }));
        }
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  },
})
```

**Purpose:** Fetches paginated messages for a channel and automatically updates the Redux slice.

**Usage:**
```typescript
const { isLoading, error } = useGetMessagesByChannelQuery({
  channelId,
  limit: 25
});

// Messages are automatically available in Redux slice
const messages = useSelector(makeSelectMessagesByChannel())(state, channelId);
```

### Mutation Endpoints

#### updateMessage
```typescript
updateMessage: builder.mutation<
  Message,
  { id: string; channelId: string; data: Partial<Message> }
>({
  query: ({ id, data }) => ({
    url: `/${id}`,
    method: "PATCH",
    body: data,
  }),
  async onQueryStarted({ channelId }, { dispatch, queryFulfilled }) {
    try {
      const { data: updatedMessage } = await queryFulfilled;
      dispatch(updateMessage({
        channelId,
        message: updatedMessage,
      }));
    } catch (error) {
      console.error("Failed to update message:", error);
    }
  },
})
```

**Usage:**
```typescript
const [updateMessage, { isLoading }] = useUpdateMessageMutation();

const handleEditMessage = async (messageId: string, newContent: string) => {
  try {
    await updateMessage({
      id: messageId,
      channelId,
      data: { content: newContent }
    }).unwrap();
  } catch (err) {
    // Handle error
  }
};
```

#### deleteMessage
```typescript
deleteMessage: builder.mutation<void, { id: string; channelId: string }>({
  query: ({ id }) => ({
    url: `/${id}`,
    method: "DELETE",
  }),
  async onQueryStarted({ id, channelId }, { dispatch, queryFulfilled }) {
    try {
      await queryFulfilled;
      dispatch(deleteMessage({ channelId, id }));
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  },
})
```

**Usage:**
```typescript
const [deleteMessage, { isLoading }] = useDeleteMessageMutation();

const handleDeleteMessage = async (messageId: string) => {
  if (confirm('Delete this message?')) {
    try {
      await deleteMessage({ id: messageId, channelId }).unwrap();
    } catch (err) {
      // Handle error
    }
  }
};
```

## Redux Slice Actions

### Message Management Actions

#### setMessages
```typescript
setMessages(state, action: PayloadAction<{
  channelId: string;
  messages: Message[];
  continuationToken?: string;
}>) {
  const { channelId, messages, continuationToken } = action.payload;
  state.byChannelId[channelId] = {
    messages: messages.slice(-MAX_MESSAGES), // Keep only recent messages
    continuationToken,
  };
}
```

**Purpose:** Replaces all messages for a channel (used for initial loads).

#### appendMessages
```typescript
appendMessages(state, action: PayloadAction<{
  channelId: string;
  messages: Message[];
  continuationToken?: string;
}>) {
  const { channelId, messages, continuationToken } = action.payload;
  const existing = state.byChannelId[channelId]?.messages || [];
  
  // Deduplicate messages
  const existingIds = new Set(existing.map(msg => msg.id));
  const newMessages = messages.filter(msg => !existingIds.has(msg.id));
  
  state.byChannelId[channelId] = {
    messages: [...existing, ...newMessages].slice(-MAX_MESSAGES),
    continuationToken,
  };
}
```

**Purpose:** Adds older messages for pagination (appends to end of array).

#### prependMessage
```typescript
prependMessage(state, action: PayloadAction<{
  channelId: string;
  message: Message;
}>) {
  const { channelId, message } = action.payload;
  const existing = state.byChannelId[channelId]?.messages || [];
  
  if (!existing.some(msg => msg.id === message.id)) {
    state.byChannelId[channelId] = {
      ...state.byChannelId[channelId],
      messages: [message, ...existing].slice(0, MAX_MESSAGES),
    };
  }
}
```

**Purpose:** Adds new messages at the beginning (for real-time updates).

## Type Definitions

### Request Types

```typescript
interface UpdateMessageRequest {
  content?: string;
  attachments?: string[];
  embeds?: MessageEmbed[];
}
```

### Response Types

```typescript
interface Message {
  id: string;
  content: string;
  authorId: string;
  channelId: string;
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
  spans: MessageSpan[]; // Rich text formatting
  attachments: MessageAttachment[];
  embeds: MessageEmbed[];
  reactions: MessageReaction[];
  mentions: MessageMention[];
  replyTo?: string; // Reply to message ID
  isDeleted: boolean;
  author: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

interface MessageSpan {
  type: 'text' | 'mention' | 'channel' | 'emoji' | 'link';
  content: string;
  start: number;
  end: number;
  userId?: string;    // For mentions
  channelId?: string; // For channel links
  emojiId?: string;   // For custom emojis
}
```

## Selectors

### Memoized Selectors

```typescript
// Get messages for a specific channel
export const makeSelectMessagesByChannel = () =>
  createSelector(
    [(state: RootState) => state.messages.byChannelId, (_, channelId: string) => channelId],
    (byChannelId, channelId) => byChannelId[channelId]?.messages || []
  );

// Get continuation token for pagination
export const makeSelectContinuationTokenByChannel = () =>
  createSelector(
    [(state: RootState) => state.messages.byChannelId, (_, channelId: string) => channelId],
    (byChannelId, channelId) => byChannelId[channelId]?.continuationToken
  );
```

**Usage:**
```typescript
function MessageList({ channelId }: { channelId: string }) {
  const selectMessages = useMemo(makeSelectMessagesByChannel, []);
  const messages = useSelector(state => selectMessages(state, channelId));
  
  return (
    <div>
      {messages.map(message => (
        <MessageComponent key={message.id} message={message} />
      ))}
    </div>
  );
}
```

## WebSocket Integration

### Real-time Message Events

```typescript
// Listen for new messages
useWebSocket('NEW_MESSAGE', (newMessage) => {
  dispatch(prependMessage({
    channelId: newMessage.channelId,
    message: newMessage,
  }));
});

// Listen for message updates
useWebSocket('MESSAGE_UPDATED', (updatedMessage) => {
  dispatch(updateMessage({
    channelId: updatedMessage.channelId,
    message: updatedMessage,
  }));
});

// Listen for message deletions
useWebSocket('MESSAGE_DELETED', ({ messageId, channelId }) => {
  dispatch(deleteMessage({
    channelId,
    id: messageId,
  }));
});
```

## Component Integration

### Message List with Pagination

```typescript
import { useGetMessagesByChannelQuery, useLazyGetMessagesByChannelQuery } from '@/features/messages/messagesApiSlice';
import { makeSelectMessagesByChannel, makeSelectContinuationTokenByChannel } from '@/features/messages/messagesSlice';

function MessageList({ channelId }: { channelId: string }) {
  const selectMessages = useMemo(makeSelectMessagesByChannel, []);
  const selectContinuationToken = useMemo(makeSelectContinuationTokenByChannel, []);
  
  const messages = useSelector(state => selectMessages(state, channelId));
  const continuationToken = useSelector(state => selectContinuationToken(state, channelId));
  
  const { isLoading: isLoadingInitial } = useGetMessagesByChannelQuery({
    channelId,
    limit: 25
  });
  
  const [loadMoreMessages, { isLoading: isLoadingMore }] = useLazyGetMessagesByChannelQuery();
  
  const handleLoadMore = () => {
    if (continuationToken && !isLoadingMore) {
      loadMoreMessages({
        channelId,
        limit: 25,
        continuationToken
      });
    }
  };

  if (isLoadingInitial) return <MessageListSkeleton />;

  return (
    <div className="message-list">
      {continuationToken && (
        <button 
          onClick={handleLoadMore} 
          disabled={isLoadingMore}
          className="load-more-button"
        >
          {isLoadingMore ? 'Loading...' : 'Load More Messages'}
        </button>
      )}
      
      {messages.map(message => (
        <MessageComponent 
          key={message.id} 
          message={message}
          channelId={channelId}
        />
      ))}
    </div>
  );
}
```

### Message Component with Edit/Delete

```typescript
function MessageComponent({ message, channelId }: { 
  message: Message; 
  channelId: string; 
}) {
  const [updateMessage] = useUpdateMessageMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const handleEdit = async () => {
    if (editContent !== message.content) {
      try {
        await updateMessage({
          id: message.id,
          channelId,
          data: { content: editContent }
        }).unwrap();
        setIsEditing(false);
      } catch (err) {
        console.error('Failed to update message:', err);
      }
    }
  };

  const handleDelete = async () => {
    if (confirm('Delete this message?')) {
      try {
        await deleteMessage({
          id: message.id,
          channelId
        }).unwrap();
      } catch (err) {
        console.error('Failed to delete message:', err);
      }
    }
  };

  return (
    <div className="message">
      <div className="message-header">
        <img src={message.author.avatarUrl} alt="" className="avatar" />
        <span className="username">{message.author.displayName || message.author.username}</span>
        <span className="timestamp">{formatTimestamp(message.createdAt)}</span>
        {message.editedAt && <span className="edited">(edited)</span>}
      </div>
      
      <div className="message-content">
        {isEditing ? (
          <div className="edit-form">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleEdit();
                } else if (e.key === 'Escape') {
                  setIsEditing(false);
                  setEditContent(message.content);
                }
              }}
            />
            <div className="edit-actions">
              <button onClick={handleEdit}>Save</button>
              <button onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="message-text">
            <RichMessageContent spans={message.spans} />
          </div>
        )}
      </div>
      
      <div className="message-actions">
        <button onClick={() => setIsEditing(true)}>Edit</button>
        <button onClick={handleDelete}>Delete</button>
      </div>
    </div>
  );
}
```

## Performance Optimization

### Memory Management

```typescript
// Automatic message cleanup to prevent memory leaks
const MAX_MESSAGES = 1000;

// In messagesSlice
messages: [...existing, ...newMessages].slice(-MAX_MESSAGES)
```

### Virtualization for Large Message Lists

```typescript
import { FixedSizeList as List } from 'react-window';

function VirtualizedMessageList({ channelId }: { channelId: string }) {
  const selectMessages = useMemo(makeSelectMessagesByChannel, []);
  const messages = useSelector(state => selectMessages(state, channelId));

  const MessageRow = ({ index, style }: { index: number; style: any }) => (
    <div style={style}>
      <MessageComponent message={messages[index]} channelId={channelId} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={messages.length}
      itemSize={80}
      itemData={messages}
    >
      {MessageRow}
    </List>
  );
}
```

### Optimistic Updates

```typescript
const [updateMessage] = useUpdateMessageMutation({
  onQueryStarted: async ({ id, channelId, data }, { dispatch, queryFulfilled }) => {
    // Optimistic update
    const patchResult = dispatch(updateMessage({
      channelId,
      message: { ...currentMessage, ...data, editedAt: new Date().toISOString() }
    }));
    
    try {
      await queryFulfilled;
    } catch {
      // Revert on error
      patchResult.undo();
    }
  },
});
```

## Error Handling

### Message Loading Errors

```typescript
const { error } = useGetMessagesByChannelQuery({ channelId });

if (error) {
  if ('status' in error) {
    switch (error.status) {
      case 403:
        return <div>You don't have permission to view this channel</div>;
      case 404:
        return <div>Channel not found</div>;
      default:
        return <div>Error loading messages</div>;
    }
  }
}
```

### Message Action Errors

```typescript
const [updateMessage] = useUpdateMessageMutation();

const handleEdit = async (messageId: string, content: string) => {
  try {
    await updateMessage({
      id: messageId,
      channelId,
      data: { content }
    }).unwrap();
  } catch (err: any) {
    if (err.status === 403) {
      setError("You can only edit your own messages");
    } else if (err.status === 400) {
      setError("Message content is invalid");
    } else {
      setError("Failed to update message");
    }
  }
};
```

## Testing

### Slice Testing

```typescript
import messagesReducer, { setMessages, prependMessage } from '../messagesSlice';

describe('messagesSlice', () => {
  it('should set messages for a channel', () => {
    const initialState = { byChannelId: {} };
    const messages = [{ id: '1', content: 'Hello', channelId: 'ch1' }];
    
    const newState = messagesReducer(initialState, setMessages({
      channelId: 'ch1',
      messages,
    }));
    
    expect(newState.byChannelId.ch1.messages).toEqual(messages);
  });
  
  it('should prepend new messages', () => {
    const initialState = {
      byChannelId: {
        ch1: { messages: [{ id: '1', content: 'Old' }] }
      }
    };
    
    const newMessage = { id: '2', content: 'New', channelId: 'ch1' };
    const newState = messagesReducer(initialState, prependMessage({
      channelId: 'ch1',
      message: newMessage,
    }));
    
    expect(newState.byChannelId.ch1.messages[0]).toEqual(newMessage);
  });
});
```

### API Testing

```typescript
import { messagesApi } from '../messagesApiSlice';

describe('messagesApi', () => {
  it('should fetch messages for a channel', async () => {
    const { result } = renderHook(
      () => messagesApi.useGetMessagesByChannelQuery({ channelId: 'ch1' }),
      { wrapper: TestProvider }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
```

## Related Documentation

- [WebSocket Events](../api/websocket-events.md) - Real-time message events
- [Channel API](./channelApi.md) - Channel management
- [Users API](./usersApi.md) - Message author information
- [Message Components](../components/messages/) - UI components for messages
- [Rich Text System](../features/mentions-system.md) - Message formatting and mentions