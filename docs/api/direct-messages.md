# Direct Messages API Documentation

## Overview

The Direct Messages API handles private messaging between users in the Kraken application. It supports both 1:1 conversations and group direct messages (DMs), providing a complete private messaging system with real-time capabilities.

## Controller: `DirectMessagesController`

**Location**: `backend/src/direct-messages/direct-messages.controller.ts`

**Base Route**: `/direct-messages`

**Guards**: 
- `JwtAuthGuard` (authentication required for all endpoints)
- `RbacGuard` (role-based access control)

### Endpoints

#### `GET /direct-messages`
Get all DM groups/conversations for the current user.

**Authentication**: Required
**RBAC**: No specific action required (authenticated users can view their own DMs)

**Response**: `DmGroupResponseDto[]`
- Returns array of DM groups ordered by creation date (newest first)
- Includes member information and last message preview
- Only returns groups where the user is a member

**Example Response**:
```json
[
  {
    "id": "64f8a1234567890abcdef123",
    "name": "Project Team Chat",
    "isGroup": true,
    "createdAt": "2023-09-01T10:00:00Z",
    "members": [
      {
        "id": "64f8a1234567890abcdef456",
        "userId": "64f8a1234567890abcdef789",
        "joinedAt": "2023-09-01T10:00:00Z",
        "user": {
          "id": "64f8a1234567890abcdef789",
          "username": "alice",
          "displayName": "Alice Smith",
          "avatarUrl": "/avatars/alice.jpg"
        }
      }
    ],
    "lastMessage": {
      "id": "64f8a1234567890abcdef999",
      "authorId": "64f8a1234567890abcdef789",
      "spans": [{"type": "text", "content": "Hello everyone!"}],
      "sentAt": "2023-09-01T10:30:00Z"
    }
  }
]
```

---

#### `POST /direct-messages`
Create a new DM group or 1:1 conversation.

**Authentication**: Required
**RBAC**: `CREATE_MESSAGE` action on `INSTANCE` resource

**Body**: `CreateDmGroupDto`
```typescript
{
  userIds: string[];     // Array of user IDs to include (excluding creator)
  name?: string;         // Optional name for group DMs
  isGroup?: boolean;     // Optional - auto-determined if not provided
}
```

**Response**: `DmGroupResponseDto`

**Business Logic**:
- Creator is automatically added to the conversation
- For 1:1 DMs (2 users total), checks for existing conversation and returns it if found
- `isGroup` is auto-determined: `true` if more than 2 total users, `false` otherwise
- For group DMs, name is optional but recommended

**Example Request**:
```json
{
  "userIds": ["64f8a1234567890abcdef789", "64f8a1234567890abcdef890"],
  "name": "Project Discussion",
  "isGroup": true
}
```

---

#### `GET /direct-messages/:id`
Get details for a specific DM group.

**Authentication**: Required
**RBAC**: `READ_MESSAGE` action on `DM_GROUP` resource (param: `id`)

**Parameters**:
- `id` (string): DM group ID

**Response**: `DmGroupResponseDto`

**Authorization**: User must be a member of the DM group
**Error Responses**:
- `403 Forbidden`: User is not a member of this DM group
- `404 Not Found`: DM group doesn't exist

---

#### `GET /direct-messages/:id/messages`
Get messages for a DM group.

**Authentication**: Required
**RBAC**: `READ_MESSAGE` action on `DM_GROUP` resource (param: `id`)

**Parameters**:
- `id` (string): DM group ID

**Response**: Array of `Message` objects

**Authorization**: User must be a member of the DM group
**Integration**: Uses `MessagesService.findAllForDirectMessageGroup()` to retrieve messages

**Example Response**:
```json
[
  {
    "id": "64f8a1234567890abcdef999",
    "authorId": "64f8a1234567890abcdef789",
    "directMessageGroupId": "64f8a1234567890abcdef123",
    "spans": [{"type": "text", "content": "Hello everyone!"}],
    "sentAt": "2023-09-01T10:30:00Z",
    "editedAt": null,
    "reactions": []
  }
]
```

---

#### `POST /direct-messages/:id/members`
Add members to a group DM.

**Authentication**: Required
**RBAC**: `CREATE_MESSAGE` action on `DM_GROUP` resource (param: `id`)

**Parameters**:
- `id` (string): DM group ID

**Body**: `AddMembersDto`
```typescript
{
  userIds: string[];  // Array of user IDs to add
}
```

**Response**: `DmGroupResponseDto` (updated group information)

**Business Logic**:
- Only works for group DMs (`isGroup: true`)
- User must be an existing member to add others
- Duplicate members are silently ignored (no error)
- Returns updated group information after adding members

**Error Responses**:
- `403 Forbidden`: User is not a member OR trying to add to 1:1 DM

---

#### `DELETE /direct-messages/:id/members/me`
Leave a DM group.

**Authentication**: Required
**RBAC**: `DELETE_MESSAGE` action on `DM_GROUP` resource (param: `id`)

**Parameters**:
- `id` (string): DM group ID

**Response**: `void` (204 No Content)

**Business Logic**:
- Removes the current user from the DM group
- Works for both 1:1 and group DMs
- User must be a member to leave

---

## Service: `DirectMessagesService`

**Location**: `backend/src/direct-messages/direct-messages.service.ts`

### Key Methods

#### `findUserDmGroups(userId: string)`
Retrieves all DM groups for a user with optimized queries including:
- Member information with user details
- Last message preview (most recent message)
- Ordered by group creation date (newest first)

#### `createDmGroup(dto: CreateDmGroupDto, creatorId: string)`
Creates new DM groups with intelligent handling:
- **1:1 DM Deduplication**: Checks for existing 1:1 conversations before creating new ones
- **Auto-Group Detection**: Automatically determines if conversation should be a group
- **Creator Inclusion**: Automatically includes creator in member list

#### `findDmGroup(groupId: string, userId: string)`
Retrieves DM group details with authorization checking:
- Verifies user membership before returning data
- Includes complete member and message information
- Throws appropriate errors for unauthorized access

#### `addMembers(groupId: string, dto: AddMembersDto, userId: string)`
Adds users to group DMs with validation:
- Only allows adding to group DMs (not 1:1 conversations)
- Handles duplicate member additions gracefully
- Requires existing membership to add others

#### `leaveDmGroup(groupId: string, userId: string)`
Removes user from DM group:
- Uses compound unique key for efficient deletion
- Works for both 1:1 and group DMs

### Private Helper Methods

#### `findExisting1on1Dm(userId1: string, userId2: string)`
Complex query to find existing 1:1 conversations:
- Ensures exactly 2 members
- Uses `every` and `none` Prisma operators for precision
- Prevents duplicate 1:1 conversations

#### `formatDmGroupResponse(dmGroup: any)`
Standardizes DM group response format for consistency across endpoints.

---

## DTOs (Data Transfer Objects)

### `CreateDmGroupDto`
**Location**: `backend/src/direct-messages/dto/create-dm-group.dto.ts`

```typescript
{
  userIds: string[];     // @IsArray, @IsString({ each: true })
  name?: string;         // @IsOptional, @IsString
  isGroup?: boolean;     // @IsOptional, @IsBoolean
}
```

**Validation**:
- `userIds`: Required array of valid user ID strings
- `name`: Optional string for group name
- `isGroup`: Optional boolean, auto-determined if not provided

### `AddMembersDto`
**Location**: `backend/src/direct-messages/dto/add-members.dto.ts`

```typescript
{
  userIds: string[];  // @IsArray, @IsString({ each: true })
}
```

**Validation**:
- `userIds`: Required array of valid user ID strings to add as members

### `DmGroupResponseDto`
**Location**: `backend/src/direct-messages/dto/dm-group-response.dto.ts`

```typescript
{
  id: string;
  name?: string | null;
  isGroup: boolean;
  createdAt: Date;
  members: {
    id: string;
    userId: string;
    joinedAt: Date;
    user: {
      id: string;
      username: string;
      displayName?: string | null;
      avatarUrl?: string | null;
    };
  }[];
  lastMessage?: {
    id: string;
    authorId: string;
    spans: any[];
    sentAt: Date;
  } | null;
}
```

**Structure**:
- Complete group information with nested member and user data
- Includes last message for conversation previews
- Handles optional fields with proper null types

---

## Database Models

### `DirectMessageGroup`
```prisma
model DirectMessageGroup {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  name      String? // Optional for group DMs
  isGroup   Boolean  @default(false) // true for group DMs, false for 1:1
  createdAt DateTime @default(now())
  
  members   DirectMessageGroupMember[]
  messages  Message[] @relation("DirectMessageGroupMessages")
}
```

### `DirectMessageGroupMember`
```prisma
model DirectMessageGroupMember {
  id       String   @id @default(auto()) @map("_id") @db.ObjectId
  groupId  String   @db.ObjectId
  userId   String   @db.ObjectId
  joinedAt DateTime @default(now())
  
  group    DirectMessageGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user     User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([groupId, userId]) // Prevents duplicate memberships
}
```

**Key Features**:
- **Cascade Deletion**: DM group deletion removes all memberships
- **Unique Constraint**: Prevents duplicate user memberships
- **User Relationship**: Links to user profile information

---

## WebSocket Integration

### Events

#### Client → Server: `SEND_DM`
Used to send direct messages to DM groups.

**Handler**: `messages.gateway.ts:handleDirectMessage()`
**RBAC**: `CREATE_MESSAGE` action on `DM_GROUP` resource
**Payload**: `CreateMessageDto` with `directMessageGroupId`

#### Server → Client: `NEW_DM`
Broadcasts new DM messages to group members.

**Room**: DM group ID
**Payload**: `{ message: Message }`

### Room Management
- Users join DM rooms using the group ID as the room identifier
- Messages are broadcast to all members of the DM group
- Room joining/leaving handled by WebSocket gateway

---

## Error Handling

### Common Error Scenarios

1. **Unauthorized Access** (`403 Forbidden`)
   - User not member of DM group
   - Trying to add members to 1:1 DM

2. **Not Found** (`404 Not Found`)
   - DM group doesn't exist
   - Referenced users don't exist

3. **Validation Errors** (`400 Bad Request`)
   - Invalid user IDs in request body
   - Missing required fields

### Error Response Format
```json
{
  "statusCode": 403,
  "message": "You are not a member of this DM group",
  "error": "Forbidden"
}
```

---

## Usage Examples

### Creating a 1:1 DM
```typescript
// POST /direct-messages
{
  "userIds": ["64f8a1234567890abcdef789"]
}
// isGroup will be automatically set to false
// name is not needed for 1:1 conversations
```

### Creating a Group DM
```typescript
// POST /direct-messages
{
  "userIds": ["64f8a1234567890abcdef789", "64f8a1234567890abcdef890"],
  "name": "Project Team",
  "isGroup": true
}
```

### Adding Members to Group
```typescript
// POST /direct-messages/64f8a1234567890abcdef123/members
{
  "userIds": ["64f8a1234567890abcdef999"]
}
```

---

## Integration Points

### Related Modules
- **Messages Module**: Handles message CRUD operations for DM messages
- **User Module**: Provides user information for DM participants
- **WebSocket Module**: Enables real-time DM messaging
- **Auth/RBAC Module**: Handles authorization for DM operations

### Frontend Integration
- **State Management**: RTK Query API slice for DM operations
- **Real-time Updates**: WebSocket hooks for live message updates
- **UI Components**: DM conversation list and chat interface
- **Navigation**: Integrated into main application layout

---

## Security Considerations

### Authorization
- All endpoints require authentication
- DM group access restricted to members only
- RBAC permissions control message operations
- Users can only access their own DM conversations

### Data Privacy
- Messages only visible to group members
- Member lists only shown to group participants
- No public discovery of DM groups or messages

### Rate Limiting
- Standard API rate limiting applies
- WebSocket rate limiting for message sending
- Prevents spam and abuse in private messages

---

## Performance Considerations

### Database Queries
- Optimized includes for member and message data
- Compound indexes on group membership
- Limited message previews (single latest message)

### WebSocket Efficiency
- Room-based message broadcasting
- Selective event subscriptions
- Minimal payload sizes for real-time events

### Caching Strategy
- DM group information cached in Redux store
- Message lists cached with RTK Query
- User profile data shared across DM contexts