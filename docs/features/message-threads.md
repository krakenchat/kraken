# Message Threads

Message threads allow users to create focused conversations branching off from a parent message, keeping the main channel organized while enabling deeper discussions.

## ✅ Feature Status: 100% Complete

### What's Implemented

- **Thread Creation**: Reply to any message to start a thread
- **Thread Panel**: Side panel showing parent message and all replies
- **Real-time Updates**: WebSocket events for new replies and count updates
- **Reply Count Indicator**: Shows "X replies" below parent messages in main channel
- **Thread Subscriptions**: Subscribe/unsubscribe for notification preferences
- **Pagination**: Load earlier replies with continuation tokens

## 🏗️ Architecture

### Backend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| ThreadsModule | `backend/src/threads/` | Thread operations and subscriptions |
| ThreadsGateway | `backend/src/threads/threads.gateway.ts` | WebSocket events for real-time replies |
| ThreadsController | `backend/src/threads/threads.controller.ts` | REST endpoints for thread data |
| ThreadsService | `backend/src/threads/threads.service.ts` | Business logic and database operations |

### Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| ThreadPanel | `frontend/src/components/Thread/ThreadPanel.tsx` | Main thread viewing UI |
| ThreadMessageInput | `frontend/src/components/Thread/ThreadMessageInput.tsx` | Input for thread replies |
| threadsSlice | `frontend/src/features/threads/threadsSlice.ts` | Redux state for thread data |
| threadsApiSlice | `frontend/src/features/threads/threadsApiSlice.ts` | RTK Query endpoints |
| useThreadWebSocket | `frontend/src/hooks/useThreadWebSocket.ts` | Real-time thread updates |

### Database Schema

```prisma
model Message {
  // Thread relationships
  parentMessageId String?   @db.ObjectId
  parentMessage   Message?  @relation("ThreadReplies", fields: [parentMessageId], references: [id], onDelete: SetNull)
  replies         Message[] @relation("ThreadReplies")

  // Thread metadata
  replyCount   Int       @default(0)
  lastReplyAt  DateTime?
}

model ThreadSubscription {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  userId          String   @db.ObjectId
  parentMessageId String   @db.ObjectId
  createdAt       DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, parentMessageId])
}
```

## 🔌 WebSocket Events

### Server Events (Backend → Frontend)

| Event | Payload | Description |
|-------|---------|-------------|
| `THREAD_NEW_REPLY` | `{ parentMessageId, reply: Message }` | New reply added to thread |
| `THREAD_REPLY_COUNT_UPDATED` | `{ parentMessageId, replyCount, lastReplyAt }` | Reply count changed |

### Client Events (Frontend → Backend)

| Event | Payload | Description |
|-------|---------|-------------|
| `THREAD_REPLY` | `{ parentMessageId, spans, attachments? }` | Send a thread reply |

## 📡 REST Endpoints

### GET `/threads/:parentMessageId/replies`
Get paginated replies for a thread.

**Query Parameters:**
- `limit` (default: 50) - Number of replies to return
- `continuationToken` - Token for pagination

**Response:**
```json
{
  "replies": [Message[]],
  "continuationToken": "string | null"
}
```

### GET `/threads/:parentMessageId/metadata`
Get thread metadata including subscription status.

**Response:**
```json
{
  "parentMessageId": "string",
  "replyCount": 5,
  "lastReplyAt": "2024-12-08T...",
  "isSubscribed": true
}
```

### POST `/threads/:parentMessageId/subscribe`
Subscribe to thread notifications.

### DELETE `/threads/:parentMessageId/subscribe`
Unsubscribe from thread notifications.

## 🔄 Data Flow

### Creating a Thread Reply

```
User clicks "Reply in thread"
        ↓
ThreadPanel opens with parent message
        ↓
User types reply in ThreadMessageInput
        ↓
WebSocket: THREAD_REPLY event sent
        ↓
Backend: ThreadsGateway.handleThreadReply()
  - Creates message with parentMessageId
  - Updates parent's replyCount and lastReplyAt
  - Emits THREAD_NEW_REPLY to thread subscribers
  - Emits THREAD_REPLY_COUNT_UPDATED to channel room
        ↓
Frontend: useThreadWebSocket receives THREAD_NEW_REPLY
  - Adds reply to threadsSlice state
        ↓
Frontend: useChannelWebSocket receives THREAD_REPLY_COUNT_UPDATED
  - Updates parent message's replyCount in messagesSlice
```

### Message Filtering

Thread replies are filtered from the main channel message list:
- Backend: `messages.service.ts` filters messages where `parentMessageId !== null`
- Only top-level messages appear in channel/DM message lists
- Thread replies only appear in the ThreadPanel

## 🎨 UI Components

### ThreadPanel
- Header with "Thread" title and close button
- Subscription toggle (bell icon)
- Parent message display (highlighted)
- Scrollable replies list with pagination
- Message input at bottom

### Reply Count Indicator
- Appears below parent messages in main channel
- Shows "X replies" with relative timestamp of last reply
- Clickable to open thread panel

## 📦 Key Files

```
backend/
├── src/threads/
│   ├── threads.module.ts
│   ├── threads.controller.ts
│   ├── threads.service.ts
│   └── threads.gateway.ts

frontend/
├── src/components/Thread/
│   ├── ThreadPanel.tsx
│   └── ThreadMessageInput.tsx
├── src/features/threads/
│   ├── threadsSlice.ts
│   └── threadsApiSlice.ts
├── src/hooks/
│   ├── useThreadWebSocket.ts
│   └── useChannelWebSocket.ts (handles THREAD_REPLY_COUNT_UPDATED)
└── src/types/
    └── websocket-payloads.ts (ThreadReplyCountUpdatedPayload)
```

---

**Last Updated**: December 8, 2024
