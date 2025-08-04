# @ Mentions System Implementation Plan

The @ mentions system in Kraken has an **exceptional foundation** but is incomplete. The span-based message architecture is perfectly designed for rich mentions - it just needs the parsing and UI components to be finished.

## 🏗️ Current Architecture (Excellent Foundation)

### ✅ **Complete Backend Foundation**

#### **Database Schema** - Perfect Span System
```prisma
type Span {
  type        SpanType
  text        String?
  userId      String? // For USER_MENTION
  specialKind String? // For SPECIAL_MENTION: "here", "everyone", "mods"
  channelId   String? // For CHANNEL_MENTION
  communityId String? // For COMMUNITY_MENTION
  aliasId     String? // For ALIAS_MENTION
}

enum SpanType {
  PLAINTEXT
  USER_MENTION
  SPECIAL_MENTION
  CHANNEL_MENTION
  COMMUNITY_MENTION
  ALIAS_MENTION
}
```

#### **Message Processing** - Fully Supports Spans
- `CreateMessageDto` accepts span arrays
- Messages stored with complete span structure
- Real-time WebSocket delivery preserves spans

### ✅ **Complete Frontend Display**

#### **Message Rendering** - Fully Functional
```typescript
// frontend/src/components/Message/MessageComponent.tsx
function renderSpan(span: Span, idx: number) {
  switch (span.type) {
    case SpanType.USER_MENTION:
      return (
        <span key={idx} style={{ color: "#1976d2", fontWeight: 600 }}>
          @{span.text || span.userId}
        </span>
      );
    case SpanType.SPECIAL_MENTION:
      return (
        <span key={idx} style={{ color: "#388e3c", fontWeight: 600 }}>
          @{span.text || span.specialKind}
        </span>
      );
    case SpanType.CHANNEL_MENTION:
      return (
        <span key={idx} style={{ color: "#7b1fa2", fontWeight: 600 }}>
          #{span.text || span.channelId}
        </span>
      );
    // ... other mention types
  }
}
```

**Styling Status**: ✅ All mention types have distinct colors and styling

## ❌ **Missing Implementation**

### **Input Processing** - 90% Missing
- MessageInput only creates `PLAINTEXT` spans
- No @ symbol detection or parsing
- No autocomplete system
- No mention resolution

### **Data Resolution** - 50% Missing  
- Displays raw IDs instead of usernames
- No user/channel lookup for mentions
- Missing community member APIs

## 📋 **Complete Implementation Plan**

### **Phase 1: Foundation APIs (2-3 hours)**

#### **1.1 Member Lookup Endpoints**
**File**: `backend/src/membership/membership.controller.ts`

```typescript
@Get('community/:communityId/members')
@RequiredActions(RbacActions.READ_MEMBER)
@RbacResource({
  type: RbacResourceType.COMMUNITY,
  idKey: 'communityId',
  source: ResourceIdSource.PARAM,
})
async getCommunityMembers(
  @Param('communityId') communityId: string,
) {
  return this.membershipService.getCommunityMembersForMentions(communityId);
}

@Get('community/:communityId/members/search')
@RequiredActions(RbacActions.READ_MEMBER)
async searchCommunityMembers(
  @Param('communityId') communityId: string,
  @Query('q') query?: string,
) {
  return this.membershipService.searchMembers(communityId, query);
}
```

**Service Methods**:
```typescript
// backend/src/membership/membership.service.ts
async getCommunityMembersForMentions(communityId: string) {
  return this.prisma.membership.findMany({
    where: { communityId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });
}

async searchMembers(communityId: string, query: string) {
  return this.prisma.membership.findMany({
    where: {
      communityId,
      user: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
        ],
      },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
    take: 10, // Limit autocomplete results
  });
}
```

#### **1.2 Channel Lookup Endpoints**
**File**: `backend/src/channels/channels.controller.ts`

```typescript
@Get('community/:communityId/channels/mentionable')
@RequiredActions(RbacActions.READ_CHANNEL)
async getMentionableChannels(
  @Param('communityId') communityId: string,
) {
  return this.channelsService.getMentionableChannels(communityId);
}
```

### **Phase 2: Frontend APIs (1 hour)**

#### **2.1 RTK Query Integration**
**File**: `frontend/src/features/membership/membershipApiSlice.ts`

```typescript
getCommunityMembers: builder.query<MembershipResponseDto[], string>({
  query: (communityId) => `/community/${communityId}/members`,
  providesTags: (result, error, communityId) => [
    { type: 'Membership', id: communityId },
  ],
}),

searchCommunityMembers: builder.query<
  MembershipResponseDto[],
  { communityId: string; query: string }
>({
  query: ({ communityId, query }) => 
    `/community/${communityId}/members/search?q=${encodeURIComponent(query)}`,
}),
```

#### **2.2 Channel API Integration**
**File**: `frontend/src/features/channel/channelApiSlice.ts`

```typescript
getMentionableChannels: builder.query<Channel[], string>({
  query: (communityId) => `/community/${communityId}/channels/mentionable`,
  providesTags: (result, error, communityId) => [
    { type: 'Channel', id: communityId },
  ],
}),
```

### **Phase 3: Mention Parsing (2-3 hours)**

#### **3.1 Mention Parser Utility**
**File**: `frontend/src/utils/mentionParser.ts`

```typescript
export interface MentionContext {
  users: Array<{ id: string; username: string; displayName: string | null }>;
  channels: Array<{ id: string; name: string }>;
  specialMentions: string[]; // ['here', 'everyone']
}

export function parseMessageWithMentions(
  text: string,
  context: MentionContext
): Span[] {
  const spans: Span[] = [];
  let lastIndex = 0;

  // Combined regex for all mention types
  const mentionRegex = /(@(\w+)|#(\w+(?:-\w+)*)|@(here|everyone))/g;
  
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    const [fullMatch, , username, channelName, specialMention] = match;
    const startIndex = match.index;

    // Add plaintext before mention
    if (startIndex > lastIndex) {
      spans.push({
        type: SpanType.PLAINTEXT,
        text: text.slice(lastIndex, startIndex),
      });
    }

    if (username) {
      // User mention (@username)
      const user = findUser(username, context.users);
      if (user) {
        spans.push({
          type: SpanType.USER_MENTION,
          userId: user.id,
          text: user.displayName || user.username,
        });
      } else {
        // Unknown user, keep as plaintext
        spans.push({
          type: SpanType.PLAINTEXT,
          text: fullMatch,
        });
      }
    } else if (channelName) {
      // Channel mention (#channel-name)
      const channel = context.channels.find(c => c.name === channelName);
      if (channel) {
        spans.push({
          type: SpanType.CHANNEL_MENTION,
          channelId: channel.id,
          text: channel.name,
        });
      } else {
        spans.push({
          type: SpanType.PLAINTEXT,
          text: fullMatch,
        });
      }
    } else if (specialMention) {
      // Special mention (@here, @everyone)
      spans.push({
        type: SpanType.SPECIAL_MENTION,
        specialKind: specialMention,
        text: specialMention,
      });
    }

    lastIndex = startIndex + fullMatch.length;
  }

  // Add remaining plaintext
  if (lastIndex < text.length) {
    spans.push({
      type: SpanType.PLAINTEXT,
      text: text.slice(lastIndex),
    });
  }

  return spans.filter(span => span.text && span.text.length > 0);
}

function findUser(
  query: string,
  users: Array<{ id: string; username: string; displayName: string | null }>
) {
  return users.find(
    user =>
      user.username.toLowerCase() === query.toLowerCase() ||
      user.displayName?.toLowerCase() === query.toLowerCase()
  );
}
```

#### **3.2 Mention Resolution Utility**
**File**: `frontend/src/utils/mentionResolver.ts`

```typescript
export function resolveMentionText(span: Span, context: MentionContext): string {
  switch (span.type) {
    case SpanType.USER_MENTION:
      if (span.text) return span.text; // Already resolved
      const user = context.users.find(u => u.id === span.userId);
      return user?.displayName || user?.username || span.userId || 'Unknown User';
      
    case SpanType.CHANNEL_MENTION:
      if (span.text) return span.text;
      const channel = context.channels.find(c => c.id === span.channelId);
      return channel?.name || span.channelId || 'Unknown Channel';
      
    case SpanType.SPECIAL_MENTION:
      return span.specialKind || span.text || 'Unknown';
      
    default:
      return span.text || '';
  }
}
```

### **Phase 4: Interactive Input (4-6 hours)**

#### **4.1 Mention Autocomplete Hook**
**File**: `frontend/src/hooks/useMentionAutocomplete.ts`

```typescript
export interface MentionSuggestion {
  type: 'user' | 'channel' | 'special';
  id: string;
  display: string;
  avatar?: string;
  secondary?: string;
}

export function useMentionAutocomplete(
  query: string,
  communityId: string,
  mentionType: 'user' | 'channel' | 'special'
) {
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { data: members } = useGetCommunityMembersQuery(communityId);
  const { data: channels } = useGetMentionableChannelsQuery(communityId);

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    
    const filtered: MentionSuggestion[] = [];

    if (mentionType === 'user') {
      // Filter users by query
      const userMatches = members
        ?.filter(m => 
          m.user.username.toLowerCase().includes(query.toLowerCase()) ||
          m.user.displayName?.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 8)
        .map(m => ({
          type: 'user' as const,
          id: m.user.id,
          display: m.user.displayName || m.user.username,
          avatar: m.user.avatarUrl,
          secondary: m.user.username !== m.user.displayName ? m.user.username : undefined,
        })) || [];

      filtered.push(...userMatches);

      // Add special mentions
      const specialMatches = ['here', 'everyone']
        .filter(special => special.includes(query.toLowerCase()))
        .map(special => ({
          type: 'special' as const,
          id: special,
          display: special,
          secondary: special === 'here' ? 'Notify online members' : 'Notify all members',
        }));

      filtered.push(...specialMatches);
    }

    if (mentionType === 'channel') {
      const channelMatches = channels
        ?.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 8)
        .map(c => ({
          type: 'channel' as const,
          id: c.id,
          display: c.name,
          secondary: c.type === 'VOICE' ? 'Voice Channel' : 'Text Channel',
        })) || [];

      filtered.push(...channelMatches);
    }

    setSuggestions(filtered);
    setIsLoading(false);
  }, [query, mentionType, members, channels]);

  return { suggestions, isLoading };
}
```

#### **4.2 Mention Dropdown Component**
**File**: `frontend/src/components/Message/MentionDropdown.tsx`

```typescript
interface MentionDropdownProps {
  suggestions: MentionSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: MentionSuggestion) => void;
  position: { top: number; left: number };
}

export function MentionDropdown({
  suggestions,
  selectedIndex,
  onSelect,
  position,
}: MentionDropdownProps) {
  return (
    <Paper
      sx={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        maxHeight: 200,
        overflowY: 'auto',
        minWidth: 200,
        zIndex: 1000,
      }}
      elevation={8}
    >
      <List dense>
        {suggestions.map((suggestion, index) => (
          <ListItem
            key={suggestion.id}
            selected={index === selectedIndex}
            onClick={() => onSelect(suggestion)}
            sx={{ cursor: 'pointer' }}
          >
            <ListItemAvatar>
              {suggestion.avatar ? (
                <Avatar src={suggestion.avatar} sx={{ width: 24, height: 24 }} />
              ) : (
                <Avatar sx={{ width: 24, height: 24 }}>
                  {suggestion.type === 'user' ? '@' : '#'}
                </Avatar>
              )}
            </ListItemAvatar>
            <ListItemText
              primary={suggestion.display}
              secondary={suggestion.secondary}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
```

#### **4.3 Enhanced MessageInput Component**
**File**: `frontend/src/components/Message/MessageInput.tsx`

```typescript
export default function MessageInput({ channelId, authorId }: MessageInputProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionType, setMentionType] = useState<'user' | 'channel'>('user');
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionStart, setMentionStart] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const sendMessage = useSendMessageSocket(() => setSending(false));
  
  // Get community context
  const communityId = useSelector(selectCurrentCommunityId);
  const { data: members } = useGetCommunityMembersQuery(communityId);
  const { data: channels } = useGetMentionableChannelsQuery(communityId);
  
  const { suggestions } = useMentionAutocomplete(mentionQuery, communityId, mentionType);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    const newCursorPos = e.target.selectionStart || 0;
    
    setText(newText);
    setCursorPosition(newCursorPos);
    
    // Check for mention triggers
    const beforeCursor = newText.slice(0, newCursorPos);
    const atMatch = beforeCursor.match(/@(\w*)$/);
    const hashMatch = beforeCursor.match(/#(\w*)$/);
    
    if (atMatch) {
      setMentionType('user');
      setMentionQuery(atMatch[1]);
      setMentionStart(beforeCursor.length - atMatch[0].length);
      setShowMentions(true);
      setSelectedSuggestion(0);
    } else if (hashMatch) {
      setMentionType('channel');
      setMentionQuery(hashMatch[1]);
      setMentionStart(beforeCursor.length - hashMatch[0].length);
      setShowMentions(true);
      setSelectedSuggestion(0);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (suggestion: MentionSuggestion) => {
    const beforeMention = text.slice(0, mentionStart);
    const afterCursor = text.slice(cursorPosition);
    
    const mentionText = suggestion.type === 'channel' 
      ? `#${suggestion.display}` 
      : `@${suggestion.display}`;
    
    const newText = `${beforeMention}${mentionText} ${afterCursor}`;
    setText(newText);
    setShowMentions(false);
    
    // Focus back to input
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestion(prev => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestion(prev => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          insertMention(suggestions[selectedSuggestion]);
          break;
        case 'Escape':
          setShowMentions(false);
          break;
      }
    }
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    
    // Parse mentions before sending
    const mentionContext: MentionContext = {
      users: members?.map(m => m.user) || [],
      channels: channels || [],
      specialMentions: ['here', 'everyone'],
    };
    
    const spans = parseMessageWithMentions(text, mentionContext);
    
    const msg: NewMessagePayload = {
      channelId,
      authorId,
      spans,
      attachments: [],
      reactions: [],
      sentAt: new Date().toISOString(),
    };
    
    sendMessage(msg);
    setText("");
    setShowMentions(false);
  };

  return (
    <Box sx={{ width: "100%", position: 'relative' }}>
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
        <StyledPaper elevation={2}>
          <StyledTextField
            fullWidth
            size="small"
            variant="outlined"
            placeholder="Type a message... Use @ to mention users, # for channels"
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            sx={{ flex: 1 }}
            inputRef={inputRef}
          />
          <IconButton
            color="primary"
            type="submit"
            disabled={sending || !text.trim()}
          >
            {sending ? <CircularProgress size={24} /> : <SendIcon />}
          </IconButton>
        </StyledPaper>
      </form>
      
      {showMentions && suggestions.length > 0 && (
        <MentionDropdown
          suggestions={suggestions}
          selectedIndex={selectedSuggestion}
          onSelect={insertMention}
          position={{ top: -200, left: 0 }} // Position above input
        />
      )}
    </Box>
  );
}
```

### **Phase 5: Enhanced Display (1-2 hours)**

#### **5.1 Mention Resolution in MessageComponent**
**File**: `frontend/src/components/Message/MessageComponent.tsx`

```typescript
// Add to MessageComponent
const communityId = useSelector(selectCurrentCommunityId);
const { data: members } = useGetCommunityMembersQuery(communityId);
const { data: channels } = useGetMentionableChannelsQuery(communityId);

const mentionContext: MentionContext = {
  users: members?.map(m => m.user) || [],
  channels: channels || [],
  specialMentions: ['here', 'everyone'],
};

// Enhanced renderSpan function
function renderSpan(span: Span, idx: number, context: MentionContext) {
  switch (span.type) {
    case SpanType.USER_MENTION:
      const resolvedUserText = resolveMentionText(span, context);
      return (
        <Chip
          key={idx}
          label={`@${resolvedUserText}`}
          size="small"
          sx={{
            backgroundColor: '#1976d2',
            color: 'white',
            fontWeight: 600,
            '& .MuiChip-label': { px: 1 },
          }}
          onClick={() => {
            // Optional: Show user profile popup
          }}
        />
      );
    case SpanType.CHANNEL_MENTION:
      const resolvedChannelText = resolveMentionText(span, context);
      return (
        <Chip
          key={idx}
          label={`#${resolvedChannelText}`}
          size="small"
          sx={{
            backgroundColor: '#7b1fa2',
            color: 'white',
            fontWeight: 600,
            '& .MuiChip-label': { px: 1 },
          }}
          onClick={() => {
            // Navigate to channel
          }}
        />
      );
    case SpanType.SPECIAL_MENTION:
      return (
        <Chip
          key={idx}
          label={`@${span.specialKind}`}
          size="small"
          sx={{
            backgroundColor: '#388e3c',
            color: 'white',
            fontWeight: 600,
            '& .MuiChip-label': { px: 1 },
          }}
        />
      );
    // ... other cases
  }
}
```

## 📊 **Implementation Timeline**

| Phase | Duration | Complexity | Priority |
|-------|----------|------------|----------|
| **Phase 1: Foundation APIs** | 2-3 hours | Low | Critical |
| **Phase 2: Frontend APIs** | 1 hour | Low | Critical |
| **Phase 3: Mention Parsing** | 2-3 hours | Medium | Critical |
| **Phase 4: Interactive Input** | 4-6 hours | High | High |
| **Phase 5: Enhanced Display** | 1-2 hours | Low | Medium |

**Total Implementation Time: 10-15 hours**

## 🎯 **Success Metrics**

### **Phase 1 Complete**:
- ✅ Can fetch community members via API
- ✅ Can search members with query
- ✅ Can fetch mentionable channels

### **Phase 2 Complete**:
- ✅ Frontend can fetch member/channel data
- ✅ Data properly cached in Redux

### **Phase 3 Complete**:
- ✅ Text like "@john hello #general" parses to proper spans
- ✅ Unknown mentions remain as plaintext
- ✅ Special mentions (@here, @everyone) parse correctly

### **Phase 4 Complete**:
- ✅ Typing "@" shows user autocomplete dropdown
- ✅ Typing "#" shows channel autocomplete dropdown
- ✅ Arrow keys navigate suggestions
- ✅ Enter/Tab inserts selected mention
- ✅ Messages sent with proper span structure

### **Phase 5 Complete**:
- ✅ User mentions display as "@John Doe" (resolved names)
- ✅ Channel mentions display as "#general" (resolved names)
- ✅ Mentions are visually distinct (chips/highlighting)
- ✅ Clicking mentions shows user info or navigates to channel

## 🚀 **Future Enhancements**

### **Advanced Features** (Post-MVP):
1. **User Hover Cards** - Show user info on mention hover
2. **Mention Notifications** - Real-time notifications for mentioned users
3. **Mention History** - Track who mentioned whom
4. **Custom Mention Groups** - @moderators, @admins (alias system)
5. **Cross-Community Mentions** - Mention users from other servers
6. **Rich Mention Previews** - Show user avatars in mentions

### **Performance Optimizations**:
1. **Mention Caching** - Cache resolved mention data
2. **Lazy Loading** - Load user data only when needed
3. **Debounced Search** - Optimize autocomplete queries
4. **Virtual Scrolling** - Handle large member lists

This implementation plan leverages your excellent span-based foundation to deliver a comprehensive mention system that rivals Discord's functionality. The modular approach allows for incremental development and testing at each phase.