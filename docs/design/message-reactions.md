# Message Reactions System Implementation Plan

## 🎯 Overview

Implement a comprehensive message reaction system allowing users to add emoji reactions to messages with real-time updates and permission-based controls.

## 📊 Current State

**Backend**: ✅ Complete
- Prisma schema includes `Reaction` type in Message model
- Database structure ready for emoji reactions with user tracking

**Frontend**: ❌ Missing
- No emoji picker component
- No reaction display UI  
- No reaction interaction handlers

## 🏗️ Architecture

### Database Schema (Already Complete)

```prisma
type Reaction {
  emoji   String      // Unicode emoji or custom emoji ID
  userIds String[]    // Array of user IDs who reacted
}

model Message {
  // ... existing fields
  reactions Reaction[] // Array of reaction objects
}
```

### API Endpoints (New)

```typescript
// backend/src/messages/dto/add-reaction.dto.ts
export class AddReactionDto {
  messageId: string;
  emoji: string;
}

// backend/src/messages/dto/remove-reaction.dto.ts  
export class RemoveReactionDto {
  messageId: string;
  emoji: string;
}
```

### WebSocket Events (New)

```typescript
// Real-time reaction updates
enum ServerEvents {
  REACTION_ADDED = 'reaction_added',
  REACTION_REMOVED = 'reaction_removed',
  REACTION_UPDATED = 'reaction_updated',
}

enum ClientEvents {
  ADD_REACTION = 'add_reaction', 
  REMOVE_REACTION = 'remove_reaction',
}
```

### State Management

```typescript
// frontend/src/features/reactions/reactionsApiSlice.ts
export const reactionsApi = createApi({
  reducerPath: 'reactionsApi',
  baseQuery: authedBaseQuery,
  tagTypes: ['Reactions'],
  endpoints: (builder) => ({
    addReaction: builder.mutation<void, AddReactionDto>({
      query: (data) => ({
        url: '/messages/reactions',
        method: 'POST', 
        body: data,
      }),
      invalidatesTags: ['Messages'],
    }),
    removeReaction: builder.mutation<void, RemoveReactionDto>({
      query: (data) => ({
        url: '/messages/reactions',
        method: 'DELETE',
        body: data, 
      }),
      invalidatesTags: ['Messages'],
    }),
  }),
});
```

## 🔧 Implementation Details

### Backend Implementation

#### 1. Messages Service Methods

```typescript
// backend/src/messages/messages.service.ts

async addReaction(messageId: string, emoji: string, userId: string) {
  const message = await this.findOne(messageId);
  
  // Find existing reaction for this emoji
  const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);
  
  if (reactionIndex >= 0) {
    // Add user to existing reaction if not already present
    const reaction = message.reactions[reactionIndex];
    if (!reaction.userIds.includes(userId)) {
      reaction.userIds.push(userId);
    }
  } else {
    // Create new reaction
    message.reactions.push({
      emoji,
      userIds: [userId]
    });
  }
  
  return this.update(messageId, { reactions: message.reactions });
}

async removeReaction(messageId: string, emoji: string, userId: string) {
  const message = await this.findOne(messageId);
  
  const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);
  if (reactionIndex >= 0) {
    const reaction = message.reactions[reactionIndex];
    reaction.userIds = reaction.userIds.filter(id => id !== userId);
    
    // Remove reaction entirely if no users left
    if (reaction.userIds.length === 0) {
      message.reactions.splice(reactionIndex, 1);
    }
  }
  
  return this.update(messageId, { reactions: message.reactions });
}
```

#### 2. Messages Controller

```typescript
// backend/src/messages/messages.controller.ts

@Post('reactions')
@RequiredActions(RbacActions.CREATE_REACTION)
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'messageId',
  source: ResourceIdSource.PAYLOAD,
})
async addReaction(@Body() addReactionDto: AddReactionDto, @Req() req) {
  const result = await this.messagesService.addReaction(
    addReactionDto.messageId,
    addReactionDto.emoji, 
    req.user.id
  );
  
  // Emit WebSocket event
  this.websocketService.sendToRoom(
    result.channelId,
    ServerEvents.REACTION_ADDED,
    { messageId: result.id, reaction: result.reactions.find(r => r.emoji === addReactionDto.emoji) }
  );
  
  return result;
}

@Delete('reactions')
@RequiredActions(RbacActions.DELETE_REACTION)
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'messageId', 
  source: ResourceIdSource.PAYLOAD,
})
async removeReaction(@Body() removeReactionDto: RemoveReactionDto, @Req() req) {
  const result = await this.messagesService.removeReaction(
    removeReactionDto.messageId,
    removeReactionDto.emoji,
    req.user.id
  );
  
  // Emit WebSocket event
  this.websocketService.sendToRoom(
    result.channelId,
    ServerEvents.REACTION_REMOVED,
    { messageId: result.id, emoji: removeReactionDto.emoji }
  );
  
  return result;
}
```

#### 3. WebSocket Gateway Updates

```typescript
// backend/src/messages/messages.gateway.ts

@SubscribeMessage(ClientEvents.ADD_REACTION)
async handleAddReaction(@MessageBody() payload: AddReactionDto, @ConnectedSocket() client: any) {
  const result = await this.messagesService.addReaction(
    payload.messageId, 
    payload.emoji,
    client.userId
  );
  
  // Broadcast to all users in the channel
  this.websocketService.sendToRoom(
    result.channelId,
    ServerEvents.REACTION_ADDED,
    { messageId: result.id, reaction: result.reactions.find(r => r.emoji === payload.emoji) }
  );
}

@SubscribeMessage(ClientEvents.REMOVE_REACTION)  
async handleRemoveReaction(@MessageBody() payload: RemoveReactionDto, @ConnectedSocket() client: any) {
  const result = await this.messagesService.removeReaction(
    payload.messageId,
    payload.emoji, 
    client.userId
  );
  
  // Broadcast to all users in the channel
  this.websocketService.sendToRoom(
    result.channelId,
    ServerEvents.REACTION_REMOVED,
    { messageId: result.id, emoji: payload.emoji }
  );
}
```

### Frontend Implementation

#### 1. Reaction Display Component

```typescript
// frontend/src/components/Message/MessageReactions.tsx

import React from 'react';
import { Box, Chip, Tooltip } from '@mui/material';
import { useAddReactionMutation, useRemoveReactionMutation } from '../../features/reactions/reactionsApiSlice';
import { useProfileQuery } from '../../features/users/usersSlice';

interface MessageReactionsProps {
  messageId: string;
  reactions: Reaction[];
}

export const MessageReactions: React.FC<MessageReactionsProps> = ({ messageId, reactions }) => {
  const { data: currentUser } = useProfileQuery();
  const [addReaction] = useAddReactionMutation();
  const [removeReaction] = useRemoveReactionMutation();

  const handleReactionClick = async (emoji: string) => {
    if (!currentUser) return;

    const reaction = reactions.find(r => r.emoji === emoji);
    const userHasReacted = reaction?.userIds.includes(currentUser.id) ?? false;

    if (userHasReacted) {
      await removeReaction({ messageId, emoji });
    } else {
      await addReaction({ messageId, emoji });
    }
  };

  if (reactions.length === 0) return null;

  return (
    <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
      {reactions.map((reaction) => {
        const userHasReacted = currentUser ? reaction.userIds.includes(currentUser.id) : false;
        const count = reaction.userIds.length;

        return (
          <Tooltip 
            key={reaction.emoji}
            title={`${count} ${count === 1 ? 'person' : 'people'} reacted`}
          >
            <Chip
              label={`${reaction.emoji} ${count}`}
              size="small"
              variant={userHasReacted ? "filled" : "outlined"}
              color={userHasReacted ? "primary" : "default"}
              onClick={() => handleReactionClick(reaction.emoji)}
              sx={{
                height: '24px',
                fontSize: '12px',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: userHasReacted ? 'primary.dark' : 'action.hover',
                }
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
};
```

#### 2. Emoji Picker Component

```typescript
// frontend/src/components/Message/EmojiPicker.tsx

import React, { useState } from 'react';
import { IconButton, Popover, Box, Typography } from '@mui/material';
import { AddReaction as AddReactionIcon } from '@mui/icons-material';

const COMMON_EMOJIS = [
  '👍', '👎', '❤️', '😂', '😮', '😢', '😡', '👏',
  '🎉', '🔥', '💯', '⭐', '❓', '❗', '✅', '❌'
];

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    handleClose();
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton size="small" onClick={handleClick}>
        <AddReactionIcon fontSize="small" />
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left', 
        }}
      >
        <Box p={2} maxWidth={240}>
          <Typography variant="subtitle2" gutterBottom>
            Add Reaction
          </Typography>
          <Box display="grid" gridTemplateColumns="repeat(8, 1fr)" gap={0.5}>
            {COMMON_EMOJIS.map((emoji) => (
              <IconButton
                key={emoji}
                size="small"
                onClick={() => handleEmojiClick(emoji)}
                sx={{
                  fontSize: '18px',
                  padding: '4px',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  }
                }}
              >
                {emoji}
              </IconButton>
            ))}
          </Box>
        </Box>
      </Popover>
    </>
  );
};
```

#### 3. MessageComponent Integration

```typescript
// frontend/src/components/Message/MessageComponent.tsx

import { MessageReactions } from './MessageReactions';
import { EmojiPicker } from './EmojiPicker';
import { useAddReactionMutation } from '../../features/reactions/reactionsApiSlice';

const MessageComponent: React.FC<MessageProps> = ({ message }) => {
  const [addReaction] = useAddReactionMutation();

  const handleEmojiSelect = async (emoji: string) => {
    await addReaction({ messageId: message.id, emoji });
  };

  return (
    <Container>
      {/* ... existing message content ... */}
      
      {/* Message Actions */}
      <Box className="message-actions">
        <EmojiPicker onEmojiSelect={handleEmojiSelect} />
        {/* ... existing action buttons ... */}
      </Box>
      
      {/* Reactions Display */}
      <MessageReactions messageId={message.id} reactions={message.reactions || []} />
    </Container>
  );
};
```

#### 4. WebSocket Integration

```typescript
// frontend/src/hooks/useMessageWebSocket.ts

useEffect(() => {
  // ... existing event handlers ...

  socket.on(ServerEvents.REACTION_ADDED, (data: { messageId: string, reaction: Reaction }) => {
    dispatch(messagesApi.util.updateQueryData('getMessages', channelId, (draft) => {
      const message = draft.find(m => m.id === data.messageId);
      if (message) {
        const existingReaction = message.reactions?.find(r => r.emoji === data.reaction.emoji);
        if (existingReaction) {
          existingReaction.userIds = data.reaction.userIds;
        } else {
          message.reactions = message.reactions || [];
          message.reactions.push(data.reaction);
        }
      }
    }));
  });

  socket.on(ServerEvents.REACTION_REMOVED, (data: { messageId: string, emoji: string }) => {
    dispatch(messagesApi.util.updateQueryData('getMessages', channelId, (draft) => {
      const message = draft.find(m => m.id === data.messageId);
      if (message && message.reactions) {
        message.reactions = message.reactions.filter(r => r.emoji !== data.emoji);
      }
    }));
  });

  return () => {
    socket.off(ServerEvents.REACTION_ADDED);
    socket.off(ServerEvents.REACTION_REMOVED);
  };
}, [socket, channelId, dispatch]);
```

## 🔒 Security & Permissions

### RBAC Actions (New)

```typescript
enum RbacActions {
  // ... existing actions ...
  CREATE_REACTION = 'CREATE_REACTION',
  DELETE_REACTION = 'DELETE_REACTION', 
  VIEW_REACTIONS = 'VIEW_REACTIONS',
}
```

### Permission Logic

- Users can add reactions to any message they can read
- Users can only remove their own reactions
- Moderators can remove any reaction
- Channel permissions apply (private channels, etc.)

## 📁 File Structure

### New Files
```
backend/src/messages/dto/
├── add-reaction.dto.ts
└── remove-reaction.dto.ts

frontend/src/components/Message/
├── MessageReactions.tsx
├── EmojiPicker.tsx
└── ReactionTooltip.tsx

frontend/src/features/reactions/
├── reactionsApiSlice.ts
└── types.ts
```

### Modified Files
```
backend/src/messages/
├── messages.service.ts        # Add reaction methods
├── messages.controller.ts     # Add reaction endpoints  
└── messages.gateway.ts        # Add reaction WebSocket handlers

frontend/src/components/Message/
└── MessageComponent.tsx       # Integrate reaction components

backend/src/auth/rbac/
└── rbac-actions.enum.ts       # Add reaction permissions
```

## 🧪 Testing Strategy

### Unit Tests
- Reaction service methods (add, remove, validation)
- Emoji picker component interactions
- Reaction display rendering

### Integration Tests  
- WebSocket reaction events
- Permission enforcement
- Real-time updates across clients

### Manual Testing Checklist
- [ ] Add reaction to message
- [ ] Remove own reaction
- [ ] Multiple users react to same message
- [ ] Emoji picker displays correctly
- [ ] Real-time updates work
- [ ] Permissions enforced properly
- [ ] Reactions persist after page refresh

## ⏱️ Implementation Timeline

**Estimated Time: 5-7 days**

### Day 1-2: Backend Implementation
- [ ] Create DTOs and update message service
- [ ] Add controller endpoints  
- [ ] Implement WebSocket handlers
- [ ] Add RBAC permissions

### Day 3-4: Frontend Components
- [ ] Create MessageReactions component
- [ ] Build EmojiPicker component
- [ ] Integrate with MessageComponent

### Day 5: API Integration
- [ ] Create reactions API slice
- [ ] Add WebSocket event handlers
- [ ] Test real-time updates

### Day 6-7: Polish & Testing
- [ ] Write unit tests
- [ ] Manual testing
- [ ] UI polish and error handling
- [ ] Performance optimization

## 🚀 Success Metrics

- Users can add/remove reactions within 200ms
- Real-time updates propagate to all clients within 500ms
- Emoji picker loads with <100ms delay
- Zero data loss during reaction operations
- Proper permission enforcement (100% coverage)

## 🔗 Dependencies

- Material-UI components (existing)
- Redux RTK Query (existing)
- WebSocket connection (existing)  
- RBAC system (existing)
- Message display system (existing)

## 📝 Notes

- Start with common emojis, expand to full emoji set later
- Consider emoji skin tone variants in future iteration
- Custom emojis can be added later as server-specific feature
- Reaction counts should update optimistically for better UX