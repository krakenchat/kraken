# Messages Module

> **Location:** `backend/src/messages/messages.module.ts`  
> **Type:** Feature Module  
> **Domain:** messaging system

## Overview

The Messages Module provides comprehensive messaging functionality for both channel-based messaging and direct messages within the Kraken application. It implements a sophisticated span-based message structure supporting rich text formatting, mentions, attachments, and reactions. The module integrates deeply with the WebSocket system for real-time message delivery and includes pagination support for efficient message history loading.

## Module Structure

```
messages/
├── messages.module.ts          # Module definition with WebSocket integration
├── messages.service.ts         # Core messaging business logic
├── messages.controller.ts      # HTTP endpoints for message operations
├── messages.gateway.ts         # WebSocket gateway for real-time messaging
├── messages.service.spec.ts    # Service unit tests
├── messages.controller.spec.ts # Controller unit tests  
├── messages.gateway.spec.ts    # Gateway unit tests
└── dto/
    ├── create-message.dto.ts   # Message creation DTO with span validation
    └── update-message.dto.ts   # Message update DTO
```

## Services

### MessagesService

**Purpose:** Manages message lifecycle operations, pagination, and supports both channel-based and direct messaging contexts.

#### Key Methods

```typescript
class MessagesService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Core CRUD operations
  async create(createMessageDto: CreateMessageDto): Promise<Message> {
    // Creates message with span-based content structure
    // Supports both channel messages and direct messages
    // Automatically sets sentAt timestamp and authorId
  }
  
  async findOne(id: string): Promise<Message> {
    // Retrieves single message by ID with error handling
  }
  
  async update(id: string, updateMessageDto: UpdateMessageDto): Promise<Message> {
    // Updates message content, sets editedAt timestamp
    // Used for message editing functionality
  }
  
  async remove(id: string): Promise<Message> {
    // Soft or hard deletes message
    // Triggers WebSocket notifications for real-time updates
  }

  // Pagination and retrieval methods
  async findAllForChannel(
    channelId: string, 
    limit = 50, 
    continuationToken?: string
  ): Promise<{ messages: Message[]; continuationToken?: string }> {
    // Retrieves paginated message history for channel
    // Uses cursor-based pagination for efficient scrolling
    // Returns messages in reverse chronological order (newest first)
  }
  
  async findAllForDirectMessageGroup(
    directMessageGroupId: string,
    limit = 50,
    continuationToken?: string  
  ): Promise<{ messages: Message[]; continuationToken?: string }> {
    // Retrieves paginated DM history
    // Same pagination pattern as channel messages
  }

  // Private helper methods
  private async findAllByField(
    field: 'channelId' | 'directMessageGroupId',
    value: string,
    limit = 50,
    continuationToken?: string,
  ): Promise<{ messages: Message[]; continuationToken?: string }> {
    // Shared pagination logic for both channels and DMs
    // Implements cursor-based pagination using message IDs
  }
}
```

#### Pagination Implementation

```typescript
// Cursor-based pagination for efficient scrolling
const query = {
  where: { [field]: value },
  orderBy: { sentAt: 'desc' },
  take: limit,
  ...(continuationToken 
    ? { cursor: { id: continuationToken }, skip: 1 }
    : {}
  ),
};

const messages = await this.databaseService.message.findMany(query);
const nextToken = messages.length === limit 
  ? messages[messages.length - 1].id 
  : undefined;

return { messages, continuationToken: nextToken };
```

## Controllers

### MessagesController

**Base Route:** `/api/messages`

#### Endpoints

| Method | Endpoint | Description | Auth Required | RBAC Actions |
|--------|----------|-------------|---------------|--------------|
| POST | `/` | Create new message | ✅ | `CREATE_MESSAGE` |
| GET | `/channel/:channelId` | Get channel message history | ✅ | `READ_MESSAGE` |
| GET | `/group/:groupId` | Get DM group message history | ✅ | `READ_MESSAGE` |
| GET | `/:id` | Get single message | ✅ | `READ_MESSAGE` |
| PATCH | `/:id` | Update message (edit) | ✅ | `UPDATE_CHANNEL` |
| DELETE | `/:id` | Delete message | ✅ | `DELETE_MESSAGE` |

#### Example Endpoint Implementation

```typescript
@Post()
@HttpCode(201)
@RequiredActions(RbacActions.CREATE_MESSAGE)
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'channelId',
  source: ResourceIdSource.BODY,
})
create(
  @Req() req: { user: UserEntity },
  @Body() createMessageDto: CreateMessageDto,
) {
  return this.messagesService.create({
    ...createMessageDto,
    authorId: req.user.id,
    sentAt: new Date(),
  });
}

@Get('/channel/:channelId')
@RequiredActions(RbacActions.READ_MESSAGE)
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'channelId',
  source: ResourceIdSource.PARAM,
})
findAllForChannel(
  @Param('channelId', ParseObjectIdPipe) channelId: string,
  @Query('limit') limit?: string,
  @Query('continuationToken') continuationToken?: string,
) {
  const parsedLimit = limit ? parseInt(limit, 10) : 50;
  return this.messagesService.findAllForChannel(
    channelId,
    parsedLimit,
    continuationToken,
  );
}
```

#### Real-time Integration

```typescript
@Patch(':id')
async update(
  @Param('id', ParseObjectIdPipe) id: string,
  @Body() updateMessageDto: UpdateMessageDto,
) {
  // Get original message for WebSocket notification
  const originalMessage = await this.messagesService.findOne(id);
  
  // Update the message
  const updatedMessage = await this.messagesService.update(id, updateMessageDto);
  
  // Emit real-time update to room
  const roomId = originalMessage.channelId || originalMessage.directMessageGroupId;
  if (roomId) {
    this.websocketService.sendToRoom(roomId, ServerEvents.UPDATE_MESSAGE, {
      message: updatedMessage,
    });
  }
  
  return updatedMessage;
}
```

## WebSocket Gateway

### MessagesGateway

**Purpose:** Handles real-time message sending via WebSocket connections with RBAC protection.

#### WebSocket Events

```typescript
@WebSocketGateway()
@UseGuards(WsJwtAuthGuard, RbacGuard)
export class MessagesGateway {
  
  // Channel message sending
  @SubscribeMessage(ClientEvents.SEND_MESSAGE)
  @RequiredActions(RbacActions.CREATE_MESSAGE)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PAYLOAD,
  })
  async handleMessage(
    @MessageBody() payload: CreateMessageDto,
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
  ): Promise<string> {
    // Create message with authenticated user as author
    const message = await this.messagesService.create({
      ...payload,
      authorId: client.handshake.user.id,
      sentAt: new Date(),
    });

    // Broadcast to channel room
    this.websocketService.sendToRoom(
      payload.channelId!,
      ServerEvents.NEW_MESSAGE,
      { message },
    );

    return message.id;
  }

  // Direct message sending
  @SubscribeMessage(ClientEvents.SEND_DM)
  @RequiredActions(RbacActions.CREATE_MESSAGE)  
  @RbacResource({
    type: RbacResourceType.DM_GROUP,
    idKey: 'directMessageGroupId',
    source: ResourceIdSource.PAYLOAD,
  })
  async handleDirectMessage(
    @MessageBody() payload: CreateMessageDto,
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
  ): Promise<string> {
    // Similar to channel messages but for DM groups
  }
}
```

#### Server Events Emitted

```typescript
// Real-time events sent to clients
ServerEvents.NEW_MESSAGE     // New message in channel
ServerEvents.NEW_DM         // New direct message
ServerEvents.UPDATE_MESSAGE  // Message edited
ServerEvents.DELETE_MESSAGE  // Message deleted
```

## DTOs (Data Transfer Objects)

### CreateMessageDto

```typescript
export class CreateMessageDto implements Message {
  @IsOptional()
  @IsString()
  channelId: string | null;              // For channel messages
  
  @IsOptional()
  @IsString()
  directMessageGroupId: string | null;   // For direct messages
  
  authorId: string;                      // Set automatically from auth
  sentAt: Date;                         // Set automatically
  
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  editedAt: Date | null;                // For edited messages
  
  @IsOptional()
  @IsDate()  
  @Type(() => Date)
  deletedAt: Date | null;               // For soft-deleted messages

  // Rich content structure
  @IsArray()
  @ArrayMinLength(1, { message: 'At least one span is required' })
  spans: {
    type: SpanType;                     // PLAINTEXT, USER_MENTION, etc.
    text: string | null;               // Text content
    userId: string | null;             // For USER_MENTION spans
    specialKind: string | null;        // For SPECIAL_MENTION (here, everyone)
    channelId: string | null;          // For CHANNEL_MENTION spans
    communityId: string | null;        // For COMMUNITY_MENTION spans  
    aliasId: string | null;            // For ALIAS_MENTION spans
  }[];

  @IsArray()
  attachments: {
    url: string;                       // File URL
    filename: string;                  // Original filename
    filetype: string;                  // MIME type
    size: number;                      // File size in bytes
  }[];

  @IsArray()
  reactions: { 
    emoji: string;                     // Emoji character or name
    userIds: string[];                 // Users who reacted
  }[];
  
  @Exclude()
  id: string;                          // Generated by database
}
```

### Span-based Message Structure

```typescript
// Message content is composed of spans for rich formatting
enum SpanType {
  PLAINTEXT        // Regular text content
  USER_MENTION     // @username mentions
  SPECIAL_MENTION  // @here, @everyone, @mods
  CHANNEL_MENTION  // #channel-name references
  COMMUNITY_MENTION // References to other communities
  ALIAS_MENTION    // @alias-group mentions
}

// Example message with multiple spans:
{
  spans: [
    { type: 'PLAINTEXT', text: 'Hello ' },
    { type: 'USER_MENTION', userId: 'user-123', text: '@john' },
    { type: 'PLAINTEXT', text: ', check out ' },
    { type: 'CHANNEL_MENTION', channelId: 'channel-456', text: '#announcements' }
  ]
}
```

## Database Schema

### Message Model

```prisma
model Message {
  id                   String    @id @default(auto()) @map("_id") @db.ObjectId
  channelId            String?   @db.ObjectId         // Channel messages
  directMessageGroupId String?   @db.ObjectId         // Direct messages
  authorId             String                         // Message author
  spans                Span[]                         // Rich content structure
  attachments          Attachment[]                   // File attachments
  reactions            Reaction[]                     // Emoji reactions
  sentAt               DateTime  @default(now())
  editedAt             DateTime?                      // Message edit timestamp
  deletedAt            DateTime?                      // Soft deletion timestamp

  // Relations
  channel            Channel?            @relation(fields: [channelId], references: [id], onDelete: Cascade)
  directMessageGroup DirectMessageGroup? @relation("DirectMessageGroupMessages", fields: [directMessageGroupId], references: [id], onDelete: Cascade)
  
  @@map("messages")
}

// Embedded types for message content
type Span {
  type        SpanType
  text        String?
  userId      String?    // For USER_MENTION
  specialKind String?    // For SPECIAL_MENTION: "here", "everyone", etc.
  channelId   String?    // For CHANNEL_MENTION
  communityId String?    // For COMMUNITY_MENTION
  aliasId     String?    // For ALIAS_MENTION
}

type Attachment {
  url      String        // File URL/path
  filename String        // Original filename
  filetype String        // MIME type
  size     Int           // File size in bytes
}

type Reaction {
  emoji   String         // Emoji character/name
  userIds String[]       // Array of user IDs who reacted
}
```

## Dependencies

### Internal Dependencies
- `@/database/database.module` - Message persistence via Prisma
- `@/websocket/websocket.module` - Real-time message broadcasting
- `@/auth/auth.module` - Authentication and RBAC protection

### External Dependencies
- `@nestjs/common` - NestJS decorators and exceptions
- `@nestjs/websockets` - WebSocket gateway functionality
- `nestjs-object-id` - MongoDB ObjectId validation
- `class-validator` - DTO validation decorators
- `class-transformer` - DTO serialization control
- `socket.io` - WebSocket server implementation

## Authentication & Authorization

### Guards Used
- `JwtAuthGuard` - HTTP endpoint authentication
- `WsJwtAuthGuard` - WebSocket connection authentication  
- `RbacGuard` - Role-based access control for both HTTP and WebSocket

### RBAC Permissions

```typescript
// Message-related permissions
CREATE_MESSAGE    // Send messages to channels/DMs
READ_MESSAGE     // View message content and history
UPDATE_CHANNEL   // Edit messages (note: currently uses channel permission)
DELETE_MESSAGE   // Delete messages
```

### Resource Context Patterns

```typescript
// Channel message operations
@RbacResource({
  type: RbacResourceType.CHANNEL,
  idKey: 'channelId',
  source: ResourceIdSource.BODY | ResourceIdSource.PARAM | ResourceIdSource.PAYLOAD
})

// Direct message operations  
@RbacResource({
  type: RbacResourceType.DM_GROUP,
  idKey: 'directMessageGroupId',
  source: ResourceIdSource.PAYLOAD
})
```

## Rich Text & Mentions System

### Span Types Implementation

```typescript
// Plaintext content
{ type: SpanType.PLAINTEXT, text: "Hello world!" }

// User mention
{ type: SpanType.USER_MENTION, userId: "user-123", text: "@john" }

// Special mentions
{ type: SpanType.SPECIAL_MENTION, specialKind: "everyone", text: "@everyone" }
{ type: SpanType.SPECIAL_MENTION, specialKind: "here", text: "@here" }

// Channel mention
{ type: SpanType.CHANNEL_MENTION, channelId: "channel-456", text: "#general" }

// Community mention
{ type: SpanType.COMMUNITY_MENTION, communityId: "community-789", text: "@Gaming Community" }

// Alias group mention
{ type: SpanType.ALIAS_MENTION, aliasId: "alias-123", text: "@moderators" }
```

### Message Parsing Example

```typescript
// Input: "Hello @john, check #announcements for @everyone updates"
// Parsed spans:
[
  { type: 'PLAINTEXT', text: 'Hello ' },
  { type: 'USER_MENTION', userId: 'user-123', text: '@john' },
  { type: 'PLAINTEXT', text: ', check ' },
  { type: 'CHANNEL_MENTION', channelId: 'chan-456', text: '#announcements' },
  { type: 'PLAINTEXT', text: ' for ' },
  { type: 'SPECIAL_MENTION', specialKind: 'everyone', text: '@everyone' },
  { type: 'PLAINTEXT', text: ' updates' }
]
```

## Real-time Message Flow

### Channel Message Flow
```typescript
// 1. Client sends WebSocket message
ClientEvents.SEND_MESSAGE → MessagesGateway.handleMessage()

// 2. RBAC validation occurs
// - Authenticate user via WsJwtAuthGuard  
// - Check CREATE_MESSAGE permission for channel via RbacGuard

// 3. Create message in database
messagesService.create(messageData)

// 4. Broadcast to channel room
websocketService.sendToRoom(channelId, ServerEvents.NEW_MESSAGE, { message })

// 5. All connected clients in channel receive message
```

### Message Update Flow
```typescript
// 1. HTTP request to update message
PATCH /messages/:id → MessagesController.update()

// 2. Update message in database  
messagesService.update(id, updateData)

// 3. Real-time notification
websocketService.sendToRoom(roomId, ServerEvents.UPDATE_MESSAGE, { message })
```

## Error Handling

### Common Exception Scenarios
```typescript
// Message not found
throw new NotFoundException('Message not found');

// Missing channel or DM group ID
throw new NotFoundException('No channelId provided');

// WebSocket validation errors
new WsException(validationErrors);  // Automatically converted from ValidationPipe
```

### Validation Rules
```typescript
// At least one span required
@ArrayMinLength(1, { message: 'At least one span is required' })
spans: Span[];

// Either channelId or directMessageGroupId required (but not both)
@IsOptional() channelId: string | null;
@IsOptional() directMessageGroupId: string | null;
```

## Performance Considerations

- **Cursor-based Pagination:** Efficient scrolling through large message histories
- **Reverse Chronological Order:** Messages sorted by sentAt DESC for recent-first display
- **WebSocket Room Management:** Messages broadcast only to relevant channel/DM participants
- **Span Structure:** Embedded document structure avoids join queries
- **Database Indexes:** Optimized queries on channelId, directMessageGroupId, and sentAt

## Testing

### Service Tests
```typescript
describe('MessagesService', () => {
  describe('findAllForChannel', () => {
    it('should return paginated messages with continuation token', async () => {
      const result = await service.findAllForChannel('channel-123', 10);
      
      expect(result.messages).toHaveLength(10);
      expect(result.continuationToken).toBeDefined();
    });
  });

  describe('create', () => {
    it('should create message with span structure', async () => {
      const messageDto = {
        channelId: 'channel-123',
        spans: [{ type: SpanType.PLAINTEXT, text: 'Hello world' }],
        attachments: [],
        reactions: []
      };
      
      const message = await service.create(messageDto);
      expect(message.spans).toHaveLength(1);
    });
  });
});
```

### Gateway Tests
```typescript
describe('MessagesGateway', () => {
  it('should create message and broadcast to room', async () => {
    const payload = { 
      channelId: 'channel-123',
      spans: [{ type: SpanType.PLAINTEXT, text: 'Test message' }]
    };
    
    const messageId = await gateway.handleMessage(payload, mockSocket);
    
    expect(mockMessagesService.create).toHaveBeenCalled();
    expect(mockWebsocketService.sendToRoom).toHaveBeenCalledWith(
      'channel-123',
      ServerEvents.NEW_MESSAGE,
      expect.any(Object)
    );
  });
});
```

## Common Usage Patterns

### Pattern 1: Real-time Channel Messaging
```typescript
// Client sends via WebSocket
socket.emit(ClientEvents.SEND_MESSAGE, {
  channelId: 'channel-123',
  spans: [{ type: 'PLAINTEXT', text: 'Hello everyone!' }],
  attachments: [],
  reactions: []
});

// Server broadcasts to all channel members
// Clients receive via ServerEvents.NEW_MESSAGE
```

### Pattern 2: Message History Loading
```typescript
// Initial load
GET /messages/channel/channel-123?limit=50

// Load more (pagination)
GET /messages/channel/channel-123?limit=50&continuationToken=msg-456

// Response includes messages and next continuation token
{
  messages: [...],
  continuationToken: "msg-789"  // For next page
}
```

### Pattern 3: Message Editing with Real-time Updates
```typescript
// 1. Edit via HTTP API
PATCH /messages/msg-123
Body: { spans: [{ type: 'PLAINTEXT', text: 'Updated content' }] }

// 2. Automatic real-time broadcast
// All channel members receive ServerEvents.UPDATE_MESSAGE

// 3. Frontend updates message in place
```

### Pattern 4: Rich Text with Mentions
```typescript
// Create message with user mention
{
  spans: [
    { type: 'PLAINTEXT', text: 'Hey ' },
    { type: 'USER_MENTION', userId: 'user-123', text: '@alice' },
    { type: 'PLAINTEXT', text: ', can you check this?' }
  ]
}

// Frontend renders with proper mention highlighting and click handling
```

## Related Modules

- **Channels Module** - Channel-based message context and permissions
- **WebSocket Module** - Real-time message broadcasting infrastructure
- **Auth Module** - User authentication and message authorship
- **Users Module** - User mention resolution and validation
- **Community Module** - Community-scoped mention and permission contexts

## Migration Notes

### Span System Evolution
- **Version 1.x:** Basic span support with core mention types
- **Future:** Extended span types for formatting (bold, italic, code blocks)

### Direct Messages Implementation
- **Current:** Basic DM support via directMessageGroupId
- **In Development:** Full DM group management and UI integration

## Troubleshooting

### Common Issues
1. **WebSocket Message Delivery Failures**
   - **Symptoms:** Messages sent but not received by other clients
   - **Cause:** Room subscription issues or WebSocket disconnections
   - **Solution:** Verify client room joining and connection stability

2. **Pagination Token Errors**
   - **Symptoms:** Invalid continuation tokens in message history
   - **Cause:** Deleted messages or database inconsistencies
   - **Solution:** Implement token validation and graceful fallbacks

3. **Mention Resolution Failures**  
   - **Symptoms:** User mentions not highlighting or linking properly
   - **Cause:** Invalid userId in USER_MENTION spans
   - **Solution:** Validate user existence during message creation

4. **RBAC Permission Denied**
   - **Symptoms:** 403 Forbidden on message operations
   - **Cause:** User lacks message permissions for channel/DM
   - **Solution:** Verify channel membership and role assignments

## Related Documentation

- [WebSocket Events](../../api/websocket-events.md#messages-events)
- [Messages API](../../api/messages.md)
- [Channels Module](channels.md)
- [Mentions System](../../features/mentions-system.md)
- [Real-time Communication](../core/websocket.md)