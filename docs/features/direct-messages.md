# Direct Messages System Implementation Plan

The Direct Messages (DM) system in Kraken has an **excellent database foundation** but needs complete frontend implementation. The backend models support both 1:1 conversations and group DMs, positioning Kraken ahead of many Discord alternatives.

## 🏗️ Current Architecture Status

### ✅ **Complete Database Foundation** - Exceptionally Well Designed

#### **DirectMessageGroup Model** - Supports 1:1 and Group DMs
```prisma
model DirectMessageGroup {
  id        String                     @id @default(auto()) @map("_id") @db.ObjectId
  name      String? // Optional, for group DMs
  isGroup   Boolean                    @default(false) // true for group DMs, false for 1:1
  createdAt DateTime                   @default(now())
  
  members   DirectMessageGroupMember[]
  messages  Message[]                  @relation("DirectMessageGroupMessages")
}
```

#### **DirectMessageGroupMember Model** - Group Membership
```prisma
model DirectMessageGroupMember {
  id       String             @id @default(auto()) @map("_id") @db.ObjectId
  groupId  String             @db.ObjectId
  userId   String             @db.ObjectId
  joinedAt DateTime           @default(now())
  
  group    DirectMessageGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user     User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([groupId, userId])
}
```

#### **Message Model Integration** - Dual Context Support
```prisma
model Message {
  channelId            String?      @db.ObjectId // For channel messages
  directMessageGroupId String?      @db.ObjectId // For DM messages
  
  channel            Channel?            @relation(fields: [channelId], references: [id])
  directMessageGroup DirectMessageGroup? @relation("DirectMessageGroupMessages", fields: [directMessageGroupId], references: [id])
}
```

**Architecture Advantage**: Messages can belong to either channels OR DM groups, providing perfect separation.

### ✅ **Backend WebSocket Support** - Ready for Real-time DMs

#### **WebSocket Gateway Support**
```typescript
// backend/src/messages/messages.gateway.ts
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
  const message = await this.messagesService.create({
    ...payload,
    authorId: client.handshake.user.id,
    sentAt: new Date(),
  });

  this.websocketService.sendToRoom(
    payload.directMessageGroupId!,
    ServerEvents.NEW_DM,
    { message },
  );

  return message.id;
}
```

**Status**: ✅ Complete - DM messages can be sent and received in real-time

### ✅ **Friendship System Foundation** - Social Graph Ready
```prisma
model Friendship {
  id        String           @id @default(auto()) @map("_id") @db.ObjectId
  userAId   String           @db.ObjectId
  userBId   String           @db.ObjectId
  status    FriendshipStatus @default(PENDING)
  createdAt DateTime         @default(now())
  
  userA     User @relation("FriendshipA", fields: [userAId], references: [id])
  userB     User @relation("FriendshipB", fields: [userBId], references: [id])
  
  @@unique([userAId, userBId])
}

enum FriendshipStatus {
  PENDING
  ACCEPTED
  BLOCKED
}
```

## ❌ **Missing Implementation** - Frontend Heavy

### **No Frontend Interface** - 0% Complete
- No DM conversation list
- No DM chat interface  
- No friend management UI
- No DM creation flow
- No group DM management

### **Missing Backend APIs** - Basic CRUD Needed
- Friend request endpoints
- DM group creation/management
- DM conversation listing
- User search for DM creation

## 📋 **Complete Implementation Plan**

### **Phase 1: Backend API Completion (4-6 hours)**

#### **1.1 Direct Message Endpoints**
**File**: `backend/src/direct-messages/direct-messages.controller.ts` (New Module)

```typescript
@Controller('direct-messages')
@UseGuards(JwtAuthGuard)
export class DirectMessagesController {
  constructor(private readonly dmService: DirectMessagesService) {}

  @Get('conversations')
  async getUserConversations(@Request() req) {
    return this.dmService.getUserConversations(req.user.id);
  }

  @Post('conversations')
  async createConversation(
    @Request() req,
    @Body() createConversationDto: CreateConversationDto,
  ) {
    return this.dmService.createConversation(req.user.id, createConversationDto);
  }

  @Get('conversations/:groupId/messages')
  async getConversationMessages(
    @Param('groupId') groupId: string,
    @Query('offset') offset?: number,
    @Query('limit') limit?: number,
  ) {
    return this.dmService.getConversationMessages(groupId, offset, limit);
  }

  @Post('conversations/:groupId/members')
  async addMember(
    @Param('groupId') groupId: string,
    @Body() addMemberDto: AddMemberDto,
  ) {
    return this.dmService.addMember(groupId, addMemberDto.userId);
  }

  @Delete('conversations/:groupId/members/:userId')
  async removeMember(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ) {
    return this.dmService.removeMember(groupId, userId);
  }
}
```

#### **1.2 Friend System Endpoints**
**File**: `backend/src/friends/friends.controller.ts` (New Module)

```typescript
@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  async getFriends(@Request() req) {
    return this.friendsService.getFriends(req.user.id);
  }

  @Get('requests')
  async getFriendRequests(@Request() req) {
    return this.friendsService.getFriendRequests(req.user.id);
  }

  @Post('requests')
  async sendFriendRequest(
    @Request() req,
    @Body() sendRequestDto: SendFriendRequestDto,
  ) {
    return this.friendsService.sendFriendRequest(req.user.id, sendRequestDto.username);
  }

  @Post('requests/:requestId/accept')
  async acceptFriendRequest(
    @Request() req,
    @Param('requestId') requestId: string,
  ) {
    return this.friendsService.acceptFriendRequest(req.user.id, requestId);
  }

  @Delete('requests/:requestId')
  async declineFriendRequest(
    @Request() req,
    @Param('requestId') requestId: string,
  ) {
    return this.friendsService.declineFriendRequest(req.user.id, requestId);
  }

  @Delete(':friendshipId')
  async removeFriend(
    @Request() req,
    @Param('friendshipId') friendshipId: string,
  ) {
    return this.friendsService.removeFriend(req.user.id, friendshipId);
  }
}
```

#### **1.3 User Search Endpoints**
**File**: `backend/src/user/user.controller.ts` (Add to existing)

```typescript
@Get('search')
async searchUsers(
  @Query('q') query: string,
  @Query('limit') limit: number = 10,
) {
  return this.userService.searchUsers(query, limit);
}
```

### **Phase 2: Frontend State Management (2-3 hours)**

#### **2.1 Direct Messages API Slice**
**File**: `frontend/src/features/direct-messages/directMessagesApiSlice.ts`

```typescript
export const directMessagesApi = createApi({
  reducerPath: 'directMessagesApi',
  baseQuery: authedBaseQuery,
  tagTypes: ['Conversation', 'DMMessage'],
  endpoints: (builder) => ({
    getConversations: builder.query<Conversation[], void>({
      query: () => '/direct-messages/conversations',
      providesTags: ['Conversation'],
    }),
    
    createConversation: builder.mutation<Conversation, CreateConversationDto>({
      query: (body) => ({
        url: '/direct-messages/conversations',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Conversation'],
    }),
    
    getConversationMessages: builder.query<
      Message[],
      { groupId: string; offset?: number; limit?: number }
    >({
      query: ({ groupId, offset = 0, limit = 50 }) =>
        `/direct-messages/conversations/${groupId}/messages?offset=${offset}&limit=${limit}`,
      providesTags: (result, error, { groupId }) => [
        { type: 'DMMessage', id: groupId },
      ],
    }),
    
    // ... other endpoints
  }),
});
```

#### **2.2 Friends API Slice**
**File**: `frontend/src/features/friends/friendsApiSlice.ts`

```typescript
export const friendsApi = createApi({
  reducerPath: 'friendsApi',
  baseQuery: authedBaseQuery,
  tagTypes: ['Friend', 'FriendRequest'],
  endpoints: (builder) => ({
    getFriends: builder.query<Friend[], void>({
      query: () => '/friends',
      providesTags: ['Friend'],
    }),
    
    getFriendRequests: builder.query<FriendRequest[], void>({
      query: () => '/friends/requests',
      providesTags: ['FriendRequest'],
    }),
    
    sendFriendRequest: builder.mutation<void, { username: string }>({
      query: (body) => ({
        url: '/friends/requests',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['FriendRequest'],
    }),
    
    acceptFriendRequest: builder.mutation<void, string>({
      query: (requestId) => ({
        url: `/friends/requests/${requestId}/accept`,
        method: 'POST',
      }),
      invalidatesTags: ['Friend', 'FriendRequest'],
    }),
    
    // ... other endpoints
  }),
});
```

### **Phase 3: Core DM Components (8-12 hours)**

#### **3.1 DM Conversation List**
**File**: `frontend/src/components/DirectMessage/DMConversationList.tsx`

```typescript
export function DMConversationList() {
  const { data: conversations, isLoading } = useGetConversationsQuery();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  if (isLoading) return <ConversationListSkeleton />;

  return (
    <List sx={{ width: 280, bgcolor: 'background.paper' }}>
      <ListSubheader>Direct Messages</ListSubheader>
      {conversations?.map((conversation) => (
        <ConversationListItem
          key={conversation.id}
          conversation={conversation}
          selected={selectedConversation === conversation.id}
          onClick={() => setSelectedConversation(conversation.id)}
        />
      ))}
      <ListItem>
        <Button
          startIcon={<AddIcon />}
          onClick={() => {/* Open create DM dialog */}}
          fullWidth
          variant="text"
        >
          New Message
        </Button>
      </ListItem>
    </List>
  );
}
```

#### **3.2 DM Chat Interface**
**File**: `frontend/src/components/DirectMessage/DMChat.tsx`

```typescript
interface DMChatProps {
  conversationId: string;
}

export function DMChat({ conversationId }: DMChatProps) {
  const { data: messages, isLoading } = useGetConversationMessagesQuery({
    groupId: conversationId,
  });
  const { data: user } = useProfileQuery();
  
  // WebSocket hook for real-time DM messages
  useDMWebSocket(conversationId);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Chat Header */}
      <DMChatHeader conversationId={conversationId} />
      
      {/* Messages */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
        {isLoading ? (
          <MessageSkeleton count={10} />
        ) : (
          messages?.map((message) => (
            <MessageComponent key={message.id} message={message} />
          ))
        )}
      </Box>
      
      {/* Message Input */}
      <Box sx={{ p: 2 }}>
        <DMMessageInput 
          conversationId={conversationId} 
          authorId={user?.id || ''} 
        />
      </Box>
    </Box>
  );
}
```

#### **3.3 Create DM Dialog**
**File**: `frontend/src/components/DirectMessage/CreateDMDialog.tsx`

```typescript
export function CreateDMDialog({ open, onClose }: CreateDMDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  
  const { data: friends } = useGetFriendsQuery();
  const { data: searchResults } = useSearchUsersQuery(searchQuery, {
    skip: !searchQuery.trim(),
  });
  const [createConversation] = useCreateConversationMutation();

  const handleCreate = async () => {
    try {
      const isGroup = selectedUsers.length > 1;
      await createConversation({
        memberIds: selectedUsers.map(u => u.id),
        name: isGroup ? groupName : undefined,
        isGroup,
      }).unwrap();
      onClose();
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Message</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Search users..."
          fullWidth
          variant="outlined"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        
        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2">To:</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              {selectedUsers.map(user => (
                <Chip
                  key={user.id}
                  label={user.displayName || user.username}
                  avatar={<Avatar src={user.avatarUrl} />}
                  onDelete={() => {
                    setSelectedUsers(prev => prev.filter(u => u.id !== user.id));
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
        
        {/* Group Name Input */}
        {selectedUsers.length > 1 && (
          <TextField
            margin="dense"
            label="Group name (optional)"
            fullWidth
            variant="outlined"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        )}
        
        {/* User Search Results */}
        <List sx={{ mt: 2, maxHeight: 300, overflowY: 'auto' }}>
          {(searchResults || friends)?.map(user => (
            <ListItem
              key={user.id}
              button
              onClick={() => {
                if (!selectedUsers.find(u => u.id === user.id)) {
                  setSelectedUsers(prev => [...prev, user]);
                }
              }}
            >
              <ListItemAvatar>
                <Avatar src={user.avatarUrl}>
                  {user.displayName?.[0] || user.username[0]}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={user.displayName || user.username}
                secondary={user.username !== user.displayName ? user.username : undefined}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={selectedUsers.length === 0}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### **Phase 4: Friend System UI (6-8 hours)**

#### **4.1 Friends List**
**File**: `frontend/src/components/Friends/FriendsList.tsx`

```typescript
export function FriendsList() {
  const { data: friends } = useGetFriendsQuery();
  const { data: friendRequests } = useGetFriendRequestsQuery();
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ width: '100%' }}>
      <Tabs value={tab} onChange={(_, newValue) => setTab(newValue)}>
        <Tab label={`Friends (${friends?.length || 0})`} />
        <Tab label={`Requests (${friendRequests?.length || 0})`} />
        <Tab label="Add Friend" />
      </Tabs>
      
      <TabPanel value={tab} index={0}>
        <FriendsListView friends={friends} />
      </TabPanel>
      
      <TabPanel value={tab} index={1}>
        <FriendRequestsView requests={friendRequests} />
      </TabPanel>
      
      <TabPanel value={tab} index={2}>
        <AddFriendForm />
      </TabPanel>
    </Box>
  );
}
```

#### **4.2 Add Friend Form**
**File**: `frontend/src/components/Friends/AddFriendForm.tsx`

```typescript
export function AddFriendForm() {
  const [username, setUsername] = useState('');
  const [sendFriendRequest, { isLoading, error }] = useSendFriendRequestMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    try {
      await sendFriendRequest({ username }).unwrap();
      setUsername('');
      // Show success message
    } catch (error) {
      // Error handled by RTK Query
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <TextField
        fullWidth
        label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={!!error}
        helperText={error ? 'Failed to send friend request' : 'Enter a username to send a friend request'}
        disabled={isLoading}
      />
      <Button
        type="submit"
        variant="contained"
        sx={{ mt: 2 }}
        disabled={!username.trim() || isLoading}
      >
        {isLoading ? 'Sending...' : 'Send Friend Request'}
      </Button>
    </Box>
  );
}
```

### **Phase 5: Integration & Polish (4-6 hours)**

#### **5.1 Navigation Integration**
**File**: `frontend/src/Layout.tsx` (Enhance existing)

```typescript
// Add DM section to main navigation
<List>
  <ListSubheader>Communities</ListSubheader>
  {/* Existing community list */}
  
  <Divider sx={{ my: 1 }} />
  
  <ListSubheader>Direct Messages</ListSubheader>
  <ListItem button onClick={() => navigate('/messages')}>
    <ListItemIcon><MessageIcon /></ListItemIcon>
    <ListItemText primary="Messages" />
  </ListItem>
  <ListItem button onClick={() => navigate('/friends')}>
    <ListItemIcon><PeopleIcon /></ListItemIcon>
    <ListItemText primary="Friends" />
  </ListItem>
</List>
```

#### **5.2 WebSocket Integration**
**File**: `frontend/src/hooks/useDMWebSocket.ts`

```typescript
export function useDMWebSocket(conversationId: string) {
  const socket = useSocket();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!socket || !conversationId) return;

    // Join DM room
    socket.emit('join-dm-room', conversationId);

    // Listen for new DM messages
    socket.on(ServerEvents.NEW_DM, (data) => {
      dispatch(
        directMessagesApi.util.updateQueryData(
          'getConversationMessages',
          { groupId: conversationId },
          (draft) => {
            draft.push(data.message);
          }
        )
      );
    });

    return () => {
      socket.off(ServerEvents.NEW_DM);
      socket.emit('leave-dm-room', conversationId);
    };
  }, [socket, conversationId, dispatch]);
}
```

## 📊 **Implementation Timeline**

| Phase | Duration | Complexity | Priority |
|-------|----------|------------|----------|
| **Phase 1: Backend APIs** | 4-6 hours | Medium | Critical |
| **Phase 2: Frontend State** | 2-3 hours | Low | Critical |
| **Phase 3: Core DM Components** | 8-12 hours | High | Critical |
| **Phase 4: Friend System UI** | 6-8 hours | Medium | High |
| **Phase 5: Integration** | 4-6 hours | Medium | High |

**Total Implementation Time: 24-35 hours**

## 🎯 **Success Metrics**

### **MVP Complete (Phase 1-3)**:
- ✅ Users can create 1:1 DM conversations
- ✅ Users can send/receive DM messages in real-time
- ✅ DM conversation list shows active conversations
- ✅ Messages display properly with user info

### **Full Feature Complete (All Phases)**:
- ✅ Friend request system fully functional
- ✅ Group DM creation and management
- ✅ Friends list and management interface
- ✅ Integrated navigation and notifications

## 🚀 **Competitive Advantages**

### **Better Than Discord**:
1. **Group DM Flexibility** - Clean separation of 1:1 and group conversations
2. **Friend System Integration** - More structured social connections
3. **Open Source** - Users can self-host and customize
4. **Modern Architecture** - Built with latest technologies

### **Technical Advantages**:
1. **Unified Message System** - Channel and DM messages use same infrastructure
2. **Real-time Ready** - WebSocket system already supports DMs
3. **Scalable Design** - Database schema handles large conversation histories
4. **Type Safety** - Full TypeScript coverage throughout

This DM system implementation would bring Kraken to feature parity with Discord's core communication features while providing a superior architecture foundation for future enhancements.