# Message Editing Interface Implementation Plan

## 🎯 Overview

Implement a comprehensive message editing system allowing users to edit their own messages with real-time updates, edit history tracking, and proper permission controls.

## 📊 Current State

**Backend**: ✅ Complete
- Message model has `editedAt` field
- `UpdateMessageDto` exists and is functional
- `messagesService.update()` method implemented
- Basic permission checking in place

**Frontend**: ❌ Missing  
- No edit UI in MessageComponent
- No edit indicators for edited messages
- No edit history display
- No optimistic updates for editing

## 🏗️ Architecture

### Database Schema (Already Complete)

```prisma
model Message {
  id        String   @id @default(cuid())
  content   Span[]   // Rich text spans
  editedAt  DateTime? // Tracks last edit timestamp
  sentAt    DateTime @default(now())
  // ... other fields
}
```

### API Endpoints (Existing - Need Frontend Integration)

```typescript
// PATCH /messages/:id (Already implemented)
// Uses UpdateMessageDto with content field

interface UpdateMessageDto {
  content?: Span[];  // New message content spans
}
```

### WebSocket Events (New)

```typescript
enum ServerEvents {
  MESSAGE_UPDATED = 'message_updated',
}

enum ClientEvents {
  UPDATE_MESSAGE = 'update_message',
}
```

### State Management (Existing API Slice - Need New Hooks)

```typescript
// frontend/src/features/messages/messagesApiSlice.ts
// useUpdateMessageMutation already exists, needs UI integration
```

## 🔧 Implementation Details

### Backend Implementation (Minimal Changes)

#### 1. Enhanced Messages Service

```typescript
// backend/src/messages/messages.service.ts

async update(id: string, updateMessageDto: UpdateMessageDto) {
  try {
    // Add editedAt timestamp
    const updateData = {
      ...updateMessageDto,
      editedAt: new Date(),
    };
    
    const result = await this.databaseService.message.update({
      where: { id },
      data: updateData,
    });
    
    return result;
  } catch (error) {
    this.logger.error('Error updating message', error);
    throw error;
  }
}
```

#### 2. WebSocket Gateway Updates

```typescript
// backend/src/messages/messages.gateway.ts

@SubscribeMessage(ClientEvents.UPDATE_MESSAGE)
async handleUpdateMessage(
  @MessageBody() payload: { messageId: string; content: Span[] },
  @ConnectedSocket() client: any
) {
  // Verify user owns the message
  const message = await this.messagesService.findOne(payload.messageId);
  if (message.userId !== client.userId) {
    throw new WsException('Cannot edit message from another user');
  }
  
  const updatedMessage = await this.messagesService.update(payload.messageId, {
    content: payload.content
  });
  
  // Broadcast update to all users in channel
  this.websocketService.sendToRoom(
    updatedMessage.channelId,
    ServerEvents.MESSAGE_UPDATED,
    updatedMessage
  );
  
  return updatedMessage;
}
```

### Frontend Implementation

#### 1. Edit State Management Hook

```typescript
// frontend/src/hooks/useMessageEdit.ts

import { useState, useCallback } from 'react';
import { useUpdateMessageMutation } from '../features/messages/messagesApiSlice';
import { Message, Span } from '../types/message.type';
import { parseMessageContent } from '../utils/mentionParser';

export const useMessageEdit = (message: Message) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [updateMessage, { isLoading }] = useUpdateMessageMutation();

  const startEditing = useCallback(() => {
    // Convert spans back to plain text for editing
    const plainText = message.content?.map(span => span.text).join('') || '';
    setEditContent(plainText);
    setIsEditing(true);
  }, [message.content]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditContent('');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editContent.trim()) {
      cancelEditing();
      return;
    }

    try {
      // Parse content to spans (reuse mention parsing logic)
      const parsedContent = parseMessageContent(editContent);
      
      await updateMessage({
        id: message.id,
        content: parsedContent,
      }).unwrap();
      
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update message:', error);
      // Keep edit mode open on error
    }
  }, [editContent, message.id, updateMessage]);

  return {
    isEditing,
    editContent,
    setEditContent,
    startEditing,
    cancelEditing,
    saveEdit,
    isLoading,
  };
};
```

#### 2. Edit Interface Component

```typescript
// frontend/src/components/Message/MessageEditForm.tsx

import React, { useRef, useEffect } from 'react';
import { Box, TextField, IconButton, Tooltip } from '@mui/material';
import { Check as SaveIcon, Close as CancelIcon } from '@mui/icons-material';

interface MessageEditFormProps {
  content: string;
  onChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

export const MessageEditForm: React.FC<MessageEditFormProps> = ({
  content,
  onChange,
  onSave,
  onCancel,
  isLoading,
}) => {
  const textFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus and select all text when editing starts
    if (textFieldRef.current) {
      textFieldRef.current.focus();
      textFieldRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <Box display="flex" alignItems="flex-end" gap={1} width="100%">
      <TextField
        ref={textFieldRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        multiline
        maxRows={10}
        size="small"
        fullWidth
        disabled={isLoading}
        placeholder="Edit your message..."
        sx={{
          '& .MuiOutlinedInput-root': {
            backgroundColor: 'background.paper',
          }
        }}
      />
      <Box display="flex" flexDirection="column" gap={0.5}>
        <Tooltip title="Save (Enter)">
          <IconButton
            size="small"
            color="primary"
            onClick={onSave}
            disabled={isLoading || !content.trim()}
          >
            <SaveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Cancel (Esc)">
          <IconButton
            size="small"
            color="default"
            onClick={onCancel}
            disabled={isLoading}
          >
            <CancelIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};
```

#### 3. Edit Indicator Component

```typescript
// frontend/src/components/Message/MessageEditIndicator.tsx

import React from 'react';
import { Typography, Tooltip, Box } from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';

interface MessageEditIndicatorProps {
  editedAt: string | Date;
  compact?: boolean;
}

export const MessageEditIndicator: React.FC<MessageEditIndicatorProps> = ({ 
  editedAt, 
  compact = false 
}) => {
  const editTime = new Date(editedAt);
  const formattedTime = editTime.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (compact) {
    return (
      <Tooltip title={`Edited ${formattedTime}`}>
        <EditIcon 
          fontSize="inherit" 
          sx={{ 
            ml: 0.5,
            color: 'text.secondary',
            fontSize: '12px',
          }} 
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={formattedTime}>
      <Box display="inline-flex" alignItems="center" gap={0.25}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: '11px', fontStyle: 'italic' }}
        >
          (edited)
        </Typography>
        <EditIcon sx={{ fontSize: '12px', color: 'text.secondary' }} />
      </Box>
    </Tooltip>
  );
};
```

#### 4. Enhanced MessageComponent

```typescript
// frontend/src/components/Message/MessageComponent.tsx (Enhanced)

import { useMessageEdit } from '../../hooks/useMessageEdit';
import { MessageEditForm } from './MessageEditForm';
import { MessageEditIndicator } from './MessageEditIndicator';
import { useProfileQuery } from '../../features/users/usersSlice';

const MessageComponent: React.FC<MessageProps> = ({ message }) => {
  const { data: currentUser } = useProfileQuery();
  const {
    isEditing,
    editContent,
    setEditContent,
    startEditing,
    cancelEditing,
    saveEdit,
    isLoading,
  } = useMessageEdit(message);

  const isOwnMessage = currentUser?.id === message.userId;
  const canEdit = isOwnMessage && !message.deleted;
  const isEdited = !!message.editedAt;

  return (
    <Container stagedForDelete={stagedForDelete} isDeleting={isDeleting}>
      <Avatar />
      <ContentBox>
        {/* Message Header */}
        <Box display="flex" alignItems="center" gap={1}>
          <UserName />
          <Timestamp />
          {isEdited && !isEditing && (
            <MessageEditIndicator editedAt={message.editedAt!} compact />
          )}
        </Box>

        {/* Message Content */}
        {isEditing ? (
          <MessageEditForm
            content={editContent}
            onChange={setEditContent}
            onSave={saveEdit}
            onCancel={cancelEditing}
            isLoading={isLoading}
          />
        ) : (
          <ContentText>
            {message.content?.map((span, idx) => renderSpan(span, idx))}
            {isEdited && (
              <MessageEditIndicator editedAt={message.editedAt!} />
            )}
          </ContentText>
        )}

        {/* Message Actions */}
        {!isEditing && (
          <Box className="message-actions" sx={{ opacity: 0, transition: 'opacity 0.2s' }}>
            {canEdit && (
              <Tooltip title="Edit message">
                <IconButton size="small" onClick={startEditing}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {/* ... other actions ... */}
          </Box>
        )}
      </ContentBox>
    </Container>
  );
};

// Add hover styles to show actions
const Container = styled('div')`
  &:hover .message-actions {
    opacity: 1;
  }
`;
```

#### 5. WebSocket Integration

```typescript
// frontend/src/hooks/useMessageWebSocket.ts (Enhanced)

useEffect(() => {
  // ... existing event handlers ...

  socket.on(ServerEvents.MESSAGE_UPDATED, (updatedMessage: Message) => {
    // Update the message in cache
    dispatch(messagesApi.util.updateQueryData('getMessages', channelId, (draft) => {
      const index = draft.findIndex(m => m.id === updatedMessage.id);
      if (index !== -1) {
        draft[index] = updatedMessage;
      }
    }));

    // Also update individual message queries
    dispatch(messagesApi.util.updateQueryData('getMessage', updatedMessage.id, () => updatedMessage));
  });

  return () => {
    socket.off(ServerEvents.MESSAGE_UPDATED);
    // ... other cleanup ...
  };
}, [socket, channelId, dispatch]);
```

#### 6. Enhanced Message Parsing

```typescript
// frontend/src/utils/mentionParser.ts (Enhanced)

export const parseMessageContent = (content: string): Span[] => {
  // Enhanced parsing logic to handle editing
  // This should preserve mention parsing while allowing text editing
  
  const spans: Span[] = [];
  const mentionRegex = /@(\w+)/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add plain text before mention
    if (match.index > lastIndex) {
      spans.push({
        type: SpanType.PLAINTEXT,
        text: content.slice(lastIndex, match.index),
      });
    }

    // Add mention span
    spans.push({
      type: SpanType.USER_MENTION,
      text: match[0],
      userId: match[1], // This would need user lookup in real implementation
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    spans.push({
      type: SpanType.PLAINTEXT,
      text: content.slice(lastIndex),
    });
  }

  return spans.length > 0 ? spans : [{ type: SpanType.PLAINTEXT, text: content }];
};
```

## 🔒 Security & Permissions

### Permission Checks
- Users can only edit their own messages
- Edit window could be time-limited (e.g., 5 minutes after posting)
- Moderators might have extended edit capabilities
- Deleted messages cannot be edited

### Rate Limiting
- Limit edit frequency to prevent spam
- Track edit count per message to prevent abuse

## 📁 File Structure

### New Files
```
frontend/src/components/Message/
├── MessageEditForm.tsx
├── MessageEditIndicator.tsx
└── EditHistory.tsx (future feature)

frontend/src/hooks/
└── useMessageEdit.ts
```

### Modified Files
```
backend/src/messages/
├── messages.service.ts        # Enhanced update method
└── messages.gateway.ts        # Add update WebSocket handler

frontend/src/components/Message/
└── MessageComponent.tsx       # Integrate edit functionality

frontend/src/hooks/
└── useMessageWebSocket.ts     # Add message update handler

frontend/src/utils/
└── mentionParser.ts           # Enhanced parsing for edits
```

## 🧪 Testing Strategy

### Unit Tests
- Message edit form component interactions
- Edit state management hook
- Message parsing for edited content
- Permission checks for editing

### Integration Tests
- WebSocket message updates
- Real-time edit propagation
- Edit indicators display correctly
- Mention parsing preservation

### Manual Testing Checklist
- [ ] Click edit button starts edit mode
- [ ] Enter key saves edit
- [ ] Escape key cancels edit  
- [ ] Edited messages show edit indicator
- [ ] Real-time updates work across clients
- [ ] Can't edit other users' messages
- [ ] Edit preserves mentions correctly
- [ ] Empty edits are handled properly

## ⏱️ Implementation Timeline

**Estimated Time: 3-4 days**

### Day 1: Edit State & Hooks
- [ ] Create useMessageEdit hook
- [ ] Add WebSocket message update handler
- [ ] Test edit state management

### Day 2: UI Components  
- [ ] Build MessageEditForm component
- [ ] Create MessageEditIndicator component
- [ ] Integrate with MessageComponent

### Day 3: Polish & Testing
- [ ] Add keyboard shortcuts (Enter/Escape)
- [ ] Improve parsing for edited content
- [ ] Add proper error handling
- [ ] Write unit tests

### Day 4: Integration & Refinement
- [ ] Test real-time updates
- [ ] Polish UI/UX
- [ ] Performance optimization
- [ ] Manual testing

## 🚀 Success Metrics

- Edit mode activates within 100ms of button click
- Save operation completes within 500ms
- Real-time updates propagate within 300ms
- Zero data loss during edit operations  
- Proper permission enforcement (100% coverage)
- Intuitive UX with clear visual feedback

## 🔗 Dependencies

- Material-UI components (existing)
- Redux RTK Query mutation (existing)
- WebSocket connection (existing)
- Message parsing utilities (existing/enhanced)
- RBAC system (existing)

## 🎯 Future Enhancements

### Edit History (Phase 2)
- Track all message edits
- Show edit history in tooltip/modal
- Compare different versions

### Rich Text Editing (Phase 2)  
- WYSIWYG editor for formatted messages
- Preserve formatting during edits
- Advanced mention auto-completion

### Time-Limited Editing (Phase 2)
- Configure edit time window
- Show countdown timer
- Disable editing after timeout

## 📝 Notes

- Start with plain text editing, rich text editing comes later
- Focus on core functionality and smooth UX first
- Consider edit conflicts if multiple users try to edit simultaneously
- Edit indicators should be subtle but noticeable
- Preserve accessibility with proper ARIA labels and keyboard navigation