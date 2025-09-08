# Messages API

> **Base URL:** `/api/messages`  
> **Controller:** `backend/src/messages/messages.controller.ts`  
> **Service:** `backend/src/messages/messages.service.ts`

## Overview

Message management API for creating, reading, updating, and deleting messages in channels and direct message groups. Features rich text support through span-based content, file attachments, reactions, and real-time WebSocket notifications. Supports both channel messages and direct messages with unified endpoints.

## Authentication

- **Required:** ✅ All endpoints require authentication
- **Token Type:** JWT Bearer token
- **Headers:** `Authorization: Bearer <jwt_token>`

## Endpoints Summary

| Method | Endpoint | Description | RBAC Permission |
|--------|----------|-------------|-----------------|
| POST | `/` | Create new message | `CREATE_MESSAGE` |
| GET | `/channel/:channelId` | List channel messages | `READ_MESSAGE` |
| GET | `/group/:groupId` | List DM group messages | `READ_MESSAGE` |
| GET | `/:id` | Get message by ID | `READ_MESSAGE` |
| PATCH | `/:id` | Update message | `UPDATE_CHANNEL` |
| DELETE | `/:id` | Delete message | `DELETE_MESSAGE` |
| POST | `/reactions` | Add reaction to message | `CREATE_REACTION` |
| DELETE | `/reactions` | Remove reaction from message | `DELETE_REACTION` |

---

## POST `/api/messages`

**Description:** Creates a new message in a channel or direct message group. Messages use a span-based rich text system supporting mentions, links, and formatting. Automatically sets author and timestamp.

### Request

**Body (JSON):**
```json
{
  "channelId": "string",            // Optional: Channel ID (for channel messages)
  "directMessageGroupId": "string", // Optional: DM group ID (for direct messages)
  "spans": [                        // Required: Rich text content (minimum 1 span)
    {
      "type": "PLAINTEXT",
      "text": "Hello world!",
      "userId": null,
      "specialKind": null,
      "channelId": null,
      "communityId": null,
      "aliasId": null
    }
  ],
  "attachments": [                  // Optional: File attachments
    {
      "url": "https://example.com/file.jpg",
      "filename": "screenshot.jpg",
      "filetype": "image/jpeg",
      "size": 102400
    }
  ],
  "reactions": []                   // Optional: Initial reactions (usually empty)
}
```

**Span Types:**
- `PLAINTEXT` - Regular text content
- `USER_MENTION` - @username mentions (requires `userId`)
- `SPECIAL_MENTION` - @here, @everyone, etc. (requires `specialKind`)
- `CHANNEL_MENTION` - #channel references (requires `channelId`)
- `COMMUNITY_MENTION` - Community references (requires `communityId`)
- `ALIAS_MENTION` - Alias group mentions (requires `aliasId`)

**Validation Rules:**
- Either `channelId` OR `directMessageGroupId` must be provided (not both)
- `spans` array must contain at least one span
- `authorId` and `sentAt` are automatically set by the server

**Channel Message Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "64f7b1234567890abcdef123",
    "spans": [
      {
        "type": "PLAINTEXT",
        "text": "Hello ",
        "userId": null,
        "specialKind": null,
        "channelId": null,
        "communityId": null,
        "aliasId": null
      },
      {
        "type": "USER_MENTION",
        "text": null,
        "userId": "64f7b1234567890abcdef456",
        "specialKind": null,
        "channelId": null,
        "communityId": null,
        "aliasId": null
      },
      {
        "type": "PLAINTEXT",
        "text": " how are you?",
        "userId": null,
        "specialKind": null,
        "channelId": null,
        "communityId": null,
        "aliasId": null
      }
    ],
    "attachments": [],
    "reactions": []
  }' \
  "http://localhost:3001/api/messages"
```

**Direct Message Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "directMessageGroupId": "64f7b1234567890abcdef789",
    "spans": [
      {
        "type": "PLAINTEXT",
        "text": "Private message content",
        "userId": null,
        "specialKind": null,
        "channelId": null,
        "communityId": null,
        "aliasId": null
      }
    ],
    "attachments": [],
    "reactions": []
  }' \
  "http://localhost:3001/api/messages"
```

### Response

**Success (201):**
```json
{
  "id": "64f7b1234567890abcdef012",
  "channelId": "64f7b1234567890abcdef123",
  "directMessageGroupId": null,
  "authorId": "64f7b1234567890abcdef456",
  "spans": [
    {
      "type": "PLAINTEXT",
      "text": "Hello ",
      "userId": null,
      "specialKind": null,
      "channelId": null,
      "communityId": null,
      "aliasId": null
    },
    {
      "type": "USER_MENTION",
      "text": null,
      "userId": "64f7b1234567890abcdef456",
      "specialKind": null,
      "channelId": null,
      "communityId": null,
      "aliasId": null
    }
  ],
  "attachments": [],
  "reactions": [],
  "sentAt": "2024-01-01T12:00:00.000Z",
  "editedAt": null,
  "deletedAt": null
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors (missing spans, invalid span structure)
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `CREATE_MESSAGE`)
- `404 Not Found` - Channel or DM group not found
- `500 Internal Server Error` - Server error

---

## GET `/api/messages/channel/:channelId`

**Description:** Retrieves messages from a specific channel with pagination support. Returns messages in reverse chronological order (newest first).

### Request

**Path Parameters:**
- `channelId` (string, required) - Channel ID (MongoDB ObjectId)

**Query Parameters:**
```typescript
{
  limit?: string;               // Optional: Max messages per page (default: 50)
  continuationToken?: string;   // Optional: Token for pagination
}
```

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/messages/channel/64f7b1234567890abcdef123?limit=20"
```

**With pagination:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/messages/channel/64f7b1234567890abcdef123?limit=20&continuationToken=eyJzZW50QXQiOiIyMDI0LTAxLTAxVDEyOjAwOjAwLjAwMFoifQ"
```

### Response

**Success (200):**
```json
{
  "messages": [
    {
      "id": "64f7b1234567890abcdef012",
      "channelId": "64f7b1234567890abcdef123",
      "directMessageGroupId": null,
      "authorId": "64f7b1234567890abcdef456",
      "spans": [
        {
          "type": "PLAINTEXT",
          "text": "Latest message",
          "userId": null,
          "specialKind": null,
          "channelId": null,
          "communityId": null,
          "aliasId": null
        }
      ],
      "attachments": [
        {
          "url": "https://example.com/image.jpg",
          "filename": "screenshot.jpg",
          "filetype": "image/jpeg",
          "size": 102400
        }
      ],
      "reactions": [
        {
          "emoji": "👍",
          "userIds": ["64f7b1234567890abcdef789", "64f7b1234567890abcdef012"]
        }
      ],
      "sentAt": "2024-01-01T12:00:00.000Z",
      "editedAt": null,
      "deletedAt": null,
      "author": {
        "id": "64f7b1234567890abcdef456",
        "username": "john_doe",
        "displayName": "John Doe",
        "avatarUrl": "https://example.com/avatar.jpg"
      }
    }
  ],
  "continuationToken": "eyJzZW50QXQiOiIyMDI0LTAxLTAxVDExOjMwOjAwLjAwMFoifQ"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions or no channel access
- `404 Not Found` - Channel not found
- `500 Internal Server Error` - Server error

---

## GET `/api/messages/group/:groupId`

**Description:** Retrieves messages from a specific direct message group with pagination support.

### Request

**Path Parameters:**
- `groupId` (string, required) - Direct message group ID (MongoDB ObjectId)

**Query Parameters:**
```typescript
{
  limit?: string;               // Optional: Max messages per page (default: 50)
  continuationToken?: string;   // Optional: Token for pagination
}
```

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/messages/group/64f7b1234567890abcdef789?limit=20"
```

### Response

**Success (200):**
```json
{
  "messages": [
    {
      "id": "64f7b1234567890abcdef012",
      "channelId": null,
      "directMessageGroupId": "64f7b1234567890abcdef789",
      "authorId": "64f7b1234567890abcdef456",
      "spans": [
        {
          "type": "PLAINTEXT",
          "text": "Direct message content",
          "userId": null,
          "specialKind": null,
          "channelId": null,
          "communityId": null,
          "aliasId": null
        }
      ],
      "attachments": [],
      "reactions": [],
      "sentAt": "2024-01-01T12:00:00.000Z",
      "editedAt": null,
      "deletedAt": null,
      "author": {
        "id": "64f7b1234567890abcdef456",
        "username": "john_doe",
        "displayName": "John Doe",
        "avatarUrl": "https://example.com/avatar.jpg"
      }
    }
  ],
  "continuationToken": "eyJzZW50QXQiOiIyMDI0LTAxLTAxVDExOjMwOjAwLjAwMFoifQ"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions or no DM group access
- `404 Not Found` - DM group not found
- `500 Internal Server Error` - Server error

---

## GET `/api/messages/:id`

**Description:** Retrieves a specific message by its ID with full details including author information.

### Request

**Path Parameters:**
- `id` (string, required) - Message ID (MongoDB ObjectId)

**Example:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/messages/64f7b1234567890abcdef012"
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef012",
  "channelId": "64f7b1234567890abcdef123",
  "directMessageGroupId": null,
  "authorId": "64f7b1234567890abcdef456",
  "spans": [
    {
      "type": "PLAINTEXT",
      "text": "Hello ",
      "userId": null,
      "specialKind": null,
      "channelId": null,
      "communityId": null,
      "aliasId": null
    },
    {
      "type": "USER_MENTION",
      "text": null,
      "userId": "64f7b1234567890abcdef789",
      "specialKind": null,
      "channelId": null,
      "communityId": null,
      "aliasId": null
    }
  ],
  "attachments": [
    {
      "url": "https://example.com/file.pdf",
      "filename": "document.pdf",
      "filetype": "application/pdf",
      "size": 1024000
    }
  ],
  "reactions": [
    {
      "emoji": "❤️",
      "userIds": ["64f7b1234567890abcdef789"]
    }
  ],
  "sentAt": "2024-01-01T12:00:00.000Z",
  "editedAt": "2024-01-01T12:05:00.000Z",
  "deletedAt": null,
  "author": {
    "id": "64f7b1234567890abcdef456",
    "username": "john_doe",
    "displayName": "John Doe",
    "avatarUrl": "https://example.com/avatar.jpg"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions or no message access
- `404 Not Found` - Message not found
- `500 Internal Server Error` - Server error

---

## PATCH `/api/messages/:id`

**Description:** Updates an existing message. Only the message author or users with appropriate permissions can edit messages. Triggers real-time WebSocket notifications.

### Request

**Path Parameters:**
- `id` (string, required) - Message ID to update

**Body (JSON):**
```json
{
  "spans": [                        // Optional: Updated rich text content
    {
      "type": "PLAINTEXT",
      "text": "Edited message content",
      "userId": null,
      "specialKind": null,
      "channelId": null,
      "communityId": null,
      "aliasId": null
    }
  ],
  "attachments": [                  // Optional: Updated attachments
    {
      "url": "https://example.com/new-file.jpg",
      "filename": "new-screenshot.jpg",
      "filetype": "image/jpeg",
      "size": 204800
    }
  ]
}
```

**Example:**
```bash
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "spans": [
      {
        "type": "PLAINTEXT",
        "text": "This message has been edited",
        "userId": null,
        "specialKind": null,
        "channelId": null,
        "communityId": null,
        "aliasId": null
      }
    ]
  }' \
  "http://localhost:3001/api/messages/64f7b1234567890abcdef012"
```

### Response

**Success (200):**
```json
{
  "id": "64f7b1234567890abcdef012",
  "channelId": "64f7b1234567890abcdef123",
  "directMessageGroupId": null,
  "authorId": "64f7b1234567890abcdef456",
  "spans": [
    {
      "type": "PLAINTEXT",
      "text": "This message has been edited",
      "userId": null,
      "specialKind": null,
      "channelId": null,
      "communityId": null,
      "aliasId": null
    }
  ],
  "attachments": [],
  "reactions": [],
  "sentAt": "2024-01-01T12:00:00.000Z",
  "editedAt": "2024-01-01T12:10:00.000Z",
  "deletedAt": null
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `UPDATE_CHANNEL`)
- `404 Not Found` - Message not found
- `500 Internal Server Error` - Server error

---

## DELETE `/api/messages/:id`

**Description:** Permanently deletes a message. Only the message author or users with appropriate permissions can delete messages. Triggers real-time WebSocket notifications.

### Request

**Path Parameters:**
- `id` (string, required) - Message ID to delete

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/messages/64f7b1234567890abcdef012"
```

### Response

**Success (204):**
```
No Content
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Insufficient permissions (requires `DELETE_MESSAGE`)
- `404 Not Found` - Message not found
- `500 Internal Server Error` - Server error

---

## Rich Text System (Spans)

### Span Structure
Messages use a flexible span-based system for rich text content:

```typescript
interface Span {
  type: SpanType;                 // Type of content
  text: string | null;            // Text content (for PLAINTEXT)
  userId: string | null;          // User ID (for USER_MENTION)
  specialKind: string | null;     // Special mention type (for SPECIAL_MENTION)
  channelId: string | null;       // Channel ID (for CHANNEL_MENTION)
  communityId: string | null;     // Community ID (for COMMUNITY_MENTION)
  aliasId: string | null;         // Alias group ID (for ALIAS_MENTION)
}
```

### Span Types
- **PLAINTEXT** - Regular text content
- **USER_MENTION** - @username mentions that notify specific users
- **SPECIAL_MENTION** - @here, @everyone, @mods special mentions
- **CHANNEL_MENTION** - #channel-name references to other channels
- **COMMUNITY_MENTION** - References to communities/servers
- **ALIAS_MENTION** - @alias-group mentions for predefined user groups

### Example Rich Message
```json
{
  "spans": [
    {
      "type": "PLAINTEXT",
      "text": "Hey ",
      "userId": null,
      "specialKind": null,
      "channelId": null,
      "communityId": null,
      "aliasId": null
    },
    {
      "type": "USER_MENTION",
      "text": null,
      "userId": "64f7b1234567890abcdef456",
      "specialKind": null,
      "channelId": null,
      "communityId": null,
      "aliasId": null
    },
    {
      "type": "PLAINTEXT",
      "text": " check out ",
      "userId": null,
      "specialKind": null,
      "channelId": null,
      "communityId": null,
      "aliasId": null
    },
    {
      "type": "CHANNEL_MENTION",
      "text": null,
      "userId": null,
      "specialKind": null,
      "channelId": "64f7b1234567890abcdef789",
      "communityId": null,
      "aliasId": null
    }
  ]
}
```

## RBAC Permissions

This API uses Role-Based Access Control with channel-specific resource context:

| Action | Permission | Description |
|--------|------------|-------------|
| Create | `CREATE_MESSAGE` | Send messages to channels/DM groups |
| Read | `READ_MESSAGE` | View messages in channels/DM groups |
| Update | `UPDATE_CHANNEL` | Edit existing messages |
| Delete | `DELETE_MESSAGE` | Delete messages |

### Resource Context

For message operations, RBAC checks are performed against the channel:

```typescript
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'channelId',
  source: ResourceIdSource.BODY // For creation
})

@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'channelId',
  source: ResourceIdSource.PARAM // For channel queries
})
```

**Resource Types Used:**
- `CHANNEL` - Channel-specific permission check for all message operations

## WebSocket Events

Message operations trigger real-time WebSocket events to keep clients synchronized:

| Event | Trigger | Payload | Room |
|-------|---------|---------|------|
| `newMessage` | Message creation | `MessageData` | `channel:${channelId}` or `dm:${groupId}` |
| `updateMessage` | Message update | `{message: MessageData}` | `channel:${channelId}` or `dm:${groupId}` |
| `deleteMessage` | Message deletion | `{messageId, channelId?, directMessageGroupId?}` | `channel:${channelId}` or `dm:${groupId}` |
| `newDirectMessage` | DM creation | `MessageData` | `dm:${groupId}` |

### WebSocket Event Examples

**New Message Event:**
```json
{
  "event": "newMessage",
  "data": {
    "id": "64f7b1234567890abcdef012",
    "channelId": "64f7b1234567890abcdef123",
    "authorId": "64f7b1234567890abcdef456",
    "spans": [...],
    "attachments": [...],
    "sentAt": "2024-01-01T12:00:00.000Z"
  }
}
```

**Message Update Event:**
```json
{
  "event": "updateMessage",
  "data": {
    "message": {
      "id": "64f7b1234567890abcdef012",
      "spans": [...],
      "editedAt": "2024-01-01T12:10:00.000Z"
    }
  }
}
```

**Message Delete Event:**
```json
{
  "event": "deleteMessage",
  "data": {
    "messageId": "64f7b1234567890abcdef012",
    "channelId": "64f7b1234567890abcdef123",
    "directMessageGroupId": null
  }
}
```

## Error Handling

### Common Error Formats

**Validation Error (400):**
```json
{
  "statusCode": 400,
  "message": [
    "At least one span is required",
    "channelId should not be empty"
  ],
  "error": "Bad Request"
}
```

**Message Not Found (404):**
```json
{
  "statusCode": 404,
  "message": "Message with ID 64f7b1234567890abcdef012 not found",
  "error": "Not Found"
}
```

**Insufficient Permissions (403):**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required: CREATE_MESSAGE",
  "error": "Forbidden"
}
```

## Usage Examples

### Frontend Integration (RTK Query)

```typescript
// Redux messages slice usage
import { useMessagesApi } from '@/features/messages/api/messagesApi';

function MessageList({ channelId }: { channelId: string }) {
  const { data: messageData, isLoading } = useMessagesApi.useGetChannelMessagesQuery({
    channelId,
    limit: 50
  });
  
  const [sendMessage] = useMessagesApi.useSendMessageMutation();
  
  const handleSendMessage = async (content: string) => {
    await sendMessage({
      channelId,
      spans: [
        {
          type: 'PLAINTEXT',
          text: content,
          userId: null,
          specialKind: null,
          channelId: null,
          communityId: null,
          aliasId: null
        }
      ],
      attachments: [],
      reactions: []
    });
  };
}

function MessageComponent({ message }: { message: MessageData }) {
  const [editMessage] = useMessagesApi.useEditMessageMutation();
  const [deleteMessage] = useMessagesApi.useDeleteMessageMutation();
  
  const handleEdit = async (newSpans: Span[]) => {
    await editMessage({
      id: message.id,
      spans: newSpans
    });
  };
}
```

### Rich Text Message Creation

```typescript
// Create message with user mention
const createMentionMessage = async (channelId: string, mentionedUserId: string) => {
  const response = await fetch('/api/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channelId,
      spans: [
        {
          type: 'PLAINTEXT',
          text: 'Hello ',
          userId: null,
          specialKind: null,
          channelId: null,
          communityId: null,
          aliasId: null
        },
        {
          type: 'USER_MENTION',
          text: null,
          userId: mentionedUserId,
          specialKind: null,
          channelId: null,
          communityId: null,
          aliasId: null
        },
        {
          type: 'PLAINTEXT',
          text: '! How are you?',
          userId: null,
          specialKind: null,
          channelId: null,
          communityId: null,
          aliasId: null
        }
      ],
      attachments: [],
      reactions: []
    }),
  });
  
  return await response.json();
};
```

## Testing

### Endpoint Tests
- **Location:** `backend/src/messages/__tests__/messages.controller.spec.ts`
- **Coverage:** CRUD operations, rich text spans, WebSocket events, RBAC permissions

### Test Examples

```typescript
// Example integration test
describe('Messages (e2e)', () => {
  it('should create message with rich text spans', () => {
    return request(app.getHttpServer())
      .post('/api/messages')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        channelId: validChannelId,
        spans: [
          {
            type: 'PLAINTEXT',
            text: 'Hello world',
            userId: null,
            specialKind: null,
            channelId: null,
            communityId: null,
            aliasId: null
          }
        ],
        attachments: [],
        reactions: []
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.spans[0].text).toBe('Hello world');
      });
  });

  it('should emit WebSocket event on message creation', async () => {
    const wsListener = jest.fn();
    websocketService.sendToRoom = wsListener;
    
    await request(app.getHttpServer())
      .post('/api/messages')
      .set('Authorization', `Bearer ${validToken}`)
      .send(validMessageData)
      .expect(201);
    
    expect(wsListener).toHaveBeenCalledWith(
      validChannelId,
      'newMessage',
      expect.any(Object)
    );
  });
});
```

---

## POST `/api/messages/reactions`

**Description:** Adds an emoji reaction to a message. Users can react to any message they can read. If the user already has the same reaction, it will not be duplicated. Creates a new reaction entry or adds the user to an existing reaction for the same emoji.

### Request

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "messageId": "60d21b4667d0d8992e610c85",  // Required: Target message ID
  "emoji": "👍"                              // Required: Unicode emoji
}
```

### Response

**Success (200):**
```json
{
  "id": "60d21b4667d0d8992e610c85",
  "channelId": "60d21b4567d0d8992e610c83",
  "authorId": "60d21b4167d0d8992e610c82",
  "spans": [...],
  "reactions": [
    {
      "emoji": "👍",
      "userIds": ["60d21b4167d0d8992e610c82", "60d21b4267d0d8992e610c84"]
    }
  ],
  "sentAt": "2023-06-22T10:30:00.000Z",
  "editedAt": null,
  "deletedAt": null
}
```

### RBAC Requirements

- **Resource:** `CHANNEL` (based on message's channel)
- **Action:** `CREATE_REACTION`
- **Validation:** Message must exist and user must have read access to the channel

### WebSocket Events

Triggers real-time event to all channel members:
```json
{
  "event": "reactionAdded",
  "data": {
    "messageId": "60d21b4667d0d8992e610c85",
    "reaction": {
      "emoji": "👍",
      "userIds": ["60d21b4167d0d8992e610c82", "60d21b4267d0d8992e610c84"]
    }
  }
}
```

---

## DELETE `/api/messages/reactions`

**Description:** Removes an emoji reaction from a message. Only removes the current user's reaction. If the user was the last person with that reaction, the entire reaction entry is removed from the message.

### Request

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "messageId": "60d21b4667d0d8992e610c85",  // Required: Target message ID
  "emoji": "👍"                              // Required: Unicode emoji to remove
}
```

### Response

**Success (200):**
```json
{
  "id": "60d21b4667d0d8992e610c85",
  "channelId": "60d21b4567d0d8992e610c83",
  "authorId": "60d21b4167d0d8992e610c82",
  "spans": [...],
  "reactions": [
    // Reaction removed or user removed from userIds array
  ],
  "sentAt": "2023-06-22T10:30:00.000Z",
  "editedAt": null,
  "deletedAt": null
}
```

### RBAC Requirements

- **Resource:** `CHANNEL` (based on message's channel)  
- **Action:** `DELETE_REACTION`
- **Validation:** Message must exist and user must have read access to the channel

### WebSocket Events

Triggers real-time event to all channel members:
```json
{
  "event": "reactionRemoved", 
  "data": {
    "messageId": "60d21b4667d0d8992e610c85",
    "emoji": "👍"
  }
}
```

---

## Related Documentation

- [Channels API](channels.md) - Channel management
- [Mentions System](../features/mentions-system.md) - User and channel mentions  
- [File Attachments](../features/file-attachments.md) - Message attachments
- [WebSocket Events](websocket-events.md) - Real-time messaging
- [RBAC System](../features/auth-rbac.md)
- [Database Schema](../architecture/database.md#message)