# Alias Groups (Custom Mention Groups) Implementation Plan

Alias Groups are an **advanced mention system** that goes beyond Discord's basic functionality. This feature allows communities to create custom mention groups like `@moderators`, `@designers`, or `@weekend-crew` - providing more flexible communication than Discord's role-based mentions.

## 🏗️ **Current Architecture Status**

### ✅ **Exceptional Database Foundation** - 100% Complete

#### **AliasGroup Model** - Perfect Design
```prisma
model AliasGroup {
  id          String             @id @default(auto()) @map("_id") @db.ObjectId
  name        String
  communityId String             @db.ObjectId
  members     AliasGroupMember[]
  createdAt   DateTime           @default(now())
  
  @@unique([communityId, name]) // Prevent duplicate names per community
}
```

#### **AliasGroupMember Model** - Membership Tracking
```prisma
model AliasGroupMember {
  id           String      @id @default(auto()) @map("_id") @db.ObjectId
  aliasGroupId String      @db.ObjectId
  userId       String      @db.ObjectId
  aliasGroup   AliasGroup? @relation(fields: [aliasGroupId], references: [id])
}
```

#### **Span System Integration** - Already Supported
```prisma
type Span {
  type     SpanType
  aliasId  String? // For ALIAS_MENTION - perfectly integrated!
  text     String?
}

enum SpanType {
  ALIAS_MENTION // Already defined in your schema!
}
```

#### **RBAC Integration** - Permission Ready
```prisma
enum RbacActions {
  CREATE_ALIAS_GROUP
  UPDATE_ALIAS_GROUP  
  DELETE_ALIAS_GROUP
  READ_ALIAS_GROUP
  CREATE_ALIAS_GROUP_MEMBER
  DELETE_ALIAS_GROUP_MEMBER
  READ_ALIAS_GROUP_MEMBER
  UPDATE_ALIAS_GROUP_MEMBER
}
```

### ✅ **Frontend Display Ready** - Message Rendering Complete
```typescript
// Already implemented in MessageComponent.tsx!
case SpanType.ALIAS_MENTION:
  return (
    <span key={idx} style={{ color: "#fbc02d", fontWeight: 600 }}>
      @{span.text || span.aliasId}
    </span>
  );
```

## ❌ **Missing Implementation** - Management Interface Only

### **No Backend CRUD APIs** - 0% Complete
- No alias group creation endpoints
- No member management APIs
- No alias group listing/search
- No mention resolution logic

### **No Frontend Management UI** - 0% Complete
- No alias group creation interface
- No member assignment UI
- No alias group browsing
- No integration with mention autocomplete

## 📋 **Complete Implementation Plan**

### **Phase 1: Backend APIs (4-6 hours)**

#### **1.1 AliasGroup Controller**
**File**: `backend/src/alias-groups/alias-groups.controller.ts` (New Module)

```typescript
@Controller('alias-groups')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AliasGroupsController {
  constructor(private readonly aliasGroupsService: AliasGroupsService) {}

  @Get('community/:communityId')
  @RequiredActions(RbacActions.READ_ALIAS_GROUP)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async getCommunityAliasGroups(@Param('communityId') communityId: string) {
    return this.aliasGroupsService.getCommunityAliasGroups(communityId);
  }

  @Post('community/:communityId')
  @RequiredActions(RbacActions.CREATE_ALIAS_GROUP)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async createAliasGroup(
    @Param('communityId') communityId: string,
    @Body() createAliasGroupDto: CreateAliasGroupDto,
    @Request() req,
  ) {
    return this.aliasGroupsService.createAliasGroup(
      communityId,
      createAliasGroupDto,
      req.user.id,
    );
  }

  @Get(':groupId')
  @RequiredActions(RbacActions.READ_ALIAS_GROUP)
  async getAliasGroup(@Param('groupId') groupId: string) {
    return this.aliasGroupsService.getAliasGroup(groupId);
  }

  @Put(':groupId')
  @RequiredActions(RbacActions.UPDATE_ALIAS_GROUP)
  async updateAliasGroup(
    @Param('groupId') groupId: string,
    @Body() updateAliasGroupDto: UpdateAliasGroupDto,
  ) {
    return this.aliasGroupsService.updateAliasGroup(groupId, updateAliasGroupDto);
  }

  @Delete(':groupId')
  @RequiredActions(RbacActions.DELETE_ALIAS_GROUP)
  async deleteAliasGroup(@Param('groupId') groupId: string) {
    return this.aliasGroupsService.deleteAliasGroup(groupId);
  }

  @Post(':groupId/members')
  @RequiredActions(RbacActions.CREATE_ALIAS_GROUP_MEMBER)
  async addMember(
    @Param('groupId') groupId: string,
    @Body() addMemberDto: AddAliasGroupMemberDto,
  ) {
    return this.aliasGroupsService.addMember(groupId, addMemberDto.userId);
  }

  @Delete(':groupId/members/:userId')
  @RequiredActions(RbacActions.DELETE_ALIAS_GROUP_MEMBER)
  async removeMember(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ) {
    return this.aliasGroupsService.removeMember(groupId, userId);
  }

  @Put(':groupId/members')
  @RequiredActions(RbacActions.UPDATE_ALIAS_GROUP_MEMBER)
  async updateMembers(
    @Param('groupId') groupId: string,
    @Body() updateMembersDto: UpdateAliasGroupMembersDto,
  ) {
    return this.aliasGroupsService.updateMembers(groupId, updateMembersDto.userIds);
  }
}
```

#### **1.2 AliasGroup Service**
**File**: `backend/src/alias-groups/alias-groups.service.ts`

```typescript
@Injectable()
export class AliasGroupsService {
  constructor(private readonly prisma: DatabaseService) {}

  async getCommunityAliasGroups(communityId: string): Promise<AliasGroupWithMembers[]> {
    return this.prisma.aliasGroup.findMany({
      where: { communityId },
      include: {
        members: {
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
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createAliasGroup(
    communityId: string,
    createDto: CreateAliasGroupDto,
    createdById: string,
  ): Promise<AliasGroup> {
    // Validate community exists and user has access
    await this.validateCommunityAccess(communityId, createdById);
    
    // Check for duplicate names
    const existing = await this.prisma.aliasGroup.findFirst({
      where: {
        communityId,
        name: { equals: createDto.name, mode: 'insensitive' },
      },
    });
    
    if (existing) {
      throw new ConflictException(`Alias group "${createDto.name}" already exists`);
    }

    return this.prisma.aliasGroup.create({
      data: {
        name: createDto.name,
        communityId,
      },
      include: {
        members: {
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
        },
      },
    });
  }

  async addMember(groupId: string, userId: string): Promise<AliasGroupMember> {
    // Check if user is already a member
    const existingMember = await this.prisma.aliasGroupMember.findFirst({
      where: { aliasGroupId: groupId, userId },
    });
    
    if (existingMember) {
      throw new ConflictException('User is already a member of this alias group');
    }

    // Verify user exists and has access to the community
    const aliasGroup = await this.prisma.aliasGroup.findUnique({
      where: { id: groupId },
    });
    
    if (!aliasGroup) {
      throw new NotFoundException('Alias group not found');
    }

    await this.validateUserCommunityAccess(userId, aliasGroup.communityId);

    return this.prisma.aliasGroupMember.create({
      data: {
        aliasGroupId: groupId,
        userId,
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
    });
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    const member = await this.prisma.aliasGroupMember.findFirst({
      where: { aliasGroupId: groupId, userId },
    });
    
    if (!member) {
      throw new NotFoundException('User is not a member of this alias group');
    }

    await this.prisma.aliasGroupMember.delete({
      where: { id: member.id },
    });
  }

  async updateMembers(groupId: string, userIds: string[]): Promise<AliasGroupWithMembers> {
    const aliasGroup = await this.prisma.aliasGroup.findUnique({
      where: { id: groupId },
    });
    
    if (!aliasGroup) {
      throw new NotFoundException('Alias group not found');
    }

    // Remove all existing members
    await this.prisma.aliasGroupMember.deleteMany({
      where: { aliasGroupId: groupId },
    });

    // Add new members
    if (userIds.length > 0) {
      // Validate all users have community access
      for (const userId of userIds) {
        await this.validateUserCommunityAccess(userId, aliasGroup.communityId);
      }

      await this.prisma.aliasGroupMember.createMany({
        data: userIds.map(userId => ({
          aliasGroupId: groupId,
          userId,
        })),
      });
    }

    return this.getAliasGroup(groupId);
  }

  async resolveAliasGroupMention(aliasId: string): Promise<string[]> {
    const members = await this.prisma.aliasGroupMember.findMany({
      where: { aliasGroupId: aliasId },
      select: { userId: true },
    });
    
    return members.map(member => member.userId);
  }

  async getAliasGroupsForMentions(communityId: string): Promise<AliasGroupMentionInfo[]> {
    const groups = await this.prisma.aliasGroup.findMany({
      where: { communityId },
      select: {
        id: true,
        name: true,
        _count: {
          select: { members: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return groups.map(group => ({
      id: group.id,
      name: group.name,
      memberCount: group._count.members,
    }));
  }

  private async validateCommunityAccess(communityId: string, userId: string): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_communityId: {
          userId,
          communityId,
        },
      },
    });
    
    if (!membership) {
      throw new ForbiddenException('User does not have access to this community');
    }
  }

  private async validateUserCommunityAccess(userId: string, communityId: string): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_communityId: {
          userId,
          communityId,
        },
      },
    });
    
    if (!membership) {
      throw new BadRequestException(`User ${userId} does not have access to this community`);
    }
  }
}
```

### **Phase 2: Frontend State Management (2-3 hours)**

#### **2.1 Alias Groups API Slice**
**File**: `frontend/src/features/alias-groups/aliasGroupsApiSlice.ts`

```typescript
export const aliasGroupsApi = createApi({
  reducerPath: 'aliasGroupsApi',
  baseQuery: authedBaseQuery,
  tagTypes: ['AliasGroup', 'AliasGroupMember'],
  endpoints: (builder) => ({
    getCommunityAliasGroups: builder.query<AliasGroupWithMembers[], string>({
      query: (communityId) => `/alias-groups/community/${communityId}`,
      providesTags: (result, error, communityId) => [
        { type: 'AliasGroup', id: communityId },
        ...(result?.map(group => ({ type: 'AliasGroup' as const, id: group.id })) || []),
      ],
    }),

    createAliasGroup: builder.mutation<
      AliasGroup,
      { communityId: string; name: string }
    >({
      query: ({ communityId, name }) => ({
        url: `/alias-groups/community/${communityId}`,
        method: 'POST',
        body: { name },
      }),
      invalidatesTags: (result, error, { communityId }) => [
        { type: 'AliasGroup', id: communityId },
      ],
    }),

    updateAliasGroup: builder.mutation<
      AliasGroup,
      { groupId: string; name: string }
    >({
      query: ({ groupId, name }) => ({
        url: `/alias-groups/${groupId}`,
        method: 'PUT',
        body: { name },
      }),
      invalidatesTags: (result, error, { groupId }) => [
        { type: 'AliasGroup', id: groupId },
      ],
    }),

    deleteAliasGroup: builder.mutation<void, string>({
      query: (groupId) => ({
        url: `/alias-groups/${groupId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, groupId) => [
        { type: 'AliasGroup', id: groupId },
        'AliasGroup',
      ],
    }),

    addAliasGroupMember: builder.mutation<
      AliasGroupMember,
      { groupId: string; userId: string }
    >({
      query: ({ groupId, userId }) => ({
        url: `/alias-groups/${groupId}/members`,
        method: 'POST',
        body: { userId },
      }),
      invalidatesTags: (result, error, { groupId }) => [
        { type: 'AliasGroup', id: groupId },
        { type: 'AliasGroupMember', id: groupId },
      ],
    }),

    removeAliasGroupMember: builder.mutation<
      void,
      { groupId: string; userId: string }
    >({
      query: ({ groupId, userId }) => ({
        url: `/alias-groups/${groupId}/members/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { groupId }) => [
        { type: 'AliasGroup', id: groupId },
        { type: 'AliasGroupMember', id: groupId },
      ],
    }),

    updateAliasGroupMembers: builder.mutation<
      AliasGroupWithMembers,
      { groupId: string; userIds: string[] }
    >({
      query: ({ groupId, userIds }) => ({
        url: `/alias-groups/${groupId}/members`,
        method: 'PUT',
        body: { userIds },
      }),
      invalidatesTags: (result, error, { groupId }) => [
        { type: 'AliasGroup', id: groupId },
        { type: 'AliasGroupMember', id: groupId },
      ],
    }),

    getAliasGroupsForMentions: builder.query<AliasGroupMentionInfo[], string>({
      query: (communityId) => `/alias-groups/community/${communityId}/mentions`,
      providesTags: (result, error, communityId) => [
        { type: 'AliasGroup', id: `${communityId}-mentions` },
      ],
    }),
  }),
});

export const {
  useGetCommunityAliasGroupsQuery,
  useCreateAliasGroupMutation,
  useUpdateAliasGroupMutation,
  useDeleteAliasGroupMutation,
  useAddAliasGroupMemberMutation,
  useRemoveAliasGroupMemberMutation,
  useUpdateAliasGroupMembersMutation,
  useGetAliasGroupsForMentionsQuery,
} = aliasGroupsApi;
```

### **Phase 3: Management Interface Components (6-8 hours)**

#### **3.1 Alias Groups Management Page**
**File**: `frontend/src/components/Community/AliasGroupManagement.tsx`

```typescript
interface AliasGroupManagementProps {
  communityId: string;
}

export function AliasGroupManagement({ communityId }: AliasGroupManagementProps) {
  const { data: aliasGroups, isLoading } = useGetCommunityAliasGroupsQuery(communityId);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AliasGroupWithMembers | null>(null);

  if (isLoading) return <AliasGroupsSkeleton />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Alias Groups</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Alias Group
        </Button>
      </Box>

      <Grid container spacing={2}>
        {aliasGroups?.map((group) => (
          <Grid item xs={12} md={6} key={group.id}>
            <AliasGroupCard
              group={group}
              onEdit={() => setEditingGroup(group)}
            />
          </Grid>
        ))}
      </Grid>

      {aliasGroups?.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <GroupIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Alias Groups Yet
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Create alias groups to mention specific groups of people like @moderators or @designers.
          </Typography>
          <Button
            variant="contained"
            onClick={() => setCreateDialogOpen(true)}
            startIcon={<AddIcon />}
          >
            Create Your First Alias Group
          </Button>
        </Paper>
      )}

      <CreateAliasGroupDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        communityId={communityId}
      />

      {editingGroup && (
        <EditAliasGroupDialog
          open={!!editingGroup}
          onClose={() => setEditingGroup(null)}
          group={editingGroup}
        />
      )}
    </Box>
  );
}
```

#### **3.2 Alias Group Card Component**
**File**: `frontend/src/components/Community/AliasGroupCard.tsx`

```typescript
interface AliasGroupCardProps {
  group: AliasGroupWithMembers;
  onEdit: () => void;
}

export function AliasGroupCard({ group, onEdit }: AliasGroupCardProps) {
  const [deleteAliasGroup] = useDeleteAliasGroupMutation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteAliasGroup(group.id).unwrap();
      setConfirmDelete(false);
    } catch (error) {
      console.error('Failed to delete alias group:', error);
    }
  };

  return (
    <Card>
      <CardHeader
        avatar={
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            <GroupIcon />
          </Avatar>
        }
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6">@{group.name}</Typography>
            <Chip
              size="small"
              label={`${group.members.length} members`}
              color="primary"
              variant="outlined"
            />
          </Box>
        }
        subheader={`Created ${new Date(group.createdAt).toLocaleDateString()}`}
        action={
          <Box>
            <IconButton onClick={onEdit}>
              <EditIcon />
            </IconButton>
            <IconButton onClick={() => setConfirmDelete(true)} color="error">
              <DeleteIcon />
            </IconButton>
          </Box>
        }
      />
      
      <CardContent>
        {group.members.length > 0 ? (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Members:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {group.members.slice(0, 8).map((member) => (
                <Tooltip
                  key={member.id}
                  title={member.user.displayName || member.user.username}
                >
                  <Avatar
                    src={member.user.avatarUrl}
                    sx={{ width: 32, height: 32 }}
                  >
                    {(member.user.displayName || member.user.username)[0]}
                  </Avatar>
                </Tooltip>
              ))}
              {group.members.length > 8 && (
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'grey.400' }}>
                  +{group.members.length - 8}
                </Avatar>
              )}
            </Box>
          </Box>
        ) : (
          <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No members yet
          </Typography>
        )}
      </CardContent>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <DialogTitle>Delete Alias Group</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "@{group.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
```

#### **3.3 Create/Edit Alias Group Dialog**
**File**: `frontend/src/components/Community/CreateAliasGroupDialog.tsx`

```typescript
interface CreateAliasGroupDialogProps {
  open: boolean;
  onClose: () => void;
  communityId: string;
}

export function CreateAliasGroupDialog({
  open,
  onClose,
  communityId,
}: CreateAliasGroupDialogProps) {
  const [name, setName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
  
  const [createAliasGroup] = useCreateAliasGroupMutation();
  const { data: communityMembers } = useGetCommunityMembersQuery(communityId);

  const handleCreate = async () => {
    if (!name.trim()) return;

    try {
      const group = await createAliasGroup({
        communityId,
        name: name.trim(),
      }).unwrap();

      // Add selected members if any
      if (selectedMembers.length > 0) {
        // Add members via separate API calls or batch update
        for (const member of selectedMembers) {
          await addAliasGroupMember({
            groupId: group.id,
            userId: member.id,
          });
        }
      }

      onClose();
      setName('');
      setSelectedMembers([]);
    } catch (error) {
      console.error('Failed to create alias group:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Create Alias Group</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Alias Group Name"
          fullWidth
          variant="outlined"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., moderators, designers, weekend-crew"
          sx={{ mb: 2 }}
        />

        <Typography variant="subtitle2" gutterBottom>
          Add Members (optional):
        </Typography>
        
        <MemberSelector
          members={communityMembers || []}
          selectedMembers={selectedMembers}
          onSelectionChange={setSelectedMembers}
        />

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          You can add or remove members later. Members will be notified when mentioned via @{name}.
        </Typography>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={!name.trim()}
        >
          Create Alias Group
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### **Phase 4: Mention Integration (3-4 hours)**

#### **4.1 Enhanced Mention Parser with Alias Support**
**File**: `frontend/src/utils/mentionParser.ts` (Enhance existing)

```typescript
export interface MentionContext {
  users: Array<{ id: string; username: string; displayName: string | null }>;
  channels: Array<{ id: string; name: string }>;
  aliasGroups: Array<{ id: string; name: string; memberCount: number }>; // Add this
  specialMentions: string[];
}

export function parseMessageWithMentions(
  text: string,
  context: MentionContext
): Span[] {
  const spans: Span[] = [];
  let lastIndex = 0;

  // Enhanced regex to include alias group mentions
  const mentionRegex = /(@(\w+(?:-\w+)*)|#(\w+(?:-\w+)*)|@(here|everyone))/g;
  
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
      // Check if it's an alias group first
      const aliasGroup = context.aliasGroups.find(
        group => group.name.toLowerCase() === username.toLowerCase()
      );
      
      if (aliasGroup) {
        spans.push({
          type: SpanType.ALIAS_MENTION,
          aliasId: aliasGroup.id,
          text: aliasGroup.name,
        });
      } else {
        // Check for user mention
        const user = findUser(username, context.users);
        if (user) {
          spans.push({
            type: SpanType.USER_MENTION,
            userId: user.id,
            text: user.displayName || user.username,
          });
        } else {
          // Unknown mention, keep as plaintext
          spans.push({
            type: SpanType.PLAINTEXT,
            text: fullMatch,
          });
        }
      }
    } else if (channelName) {
      // Handle channel mentions (existing logic)
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
      // Handle special mentions (existing logic)
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
```

#### **4.2 Enhanced Mention Autocomplete**
**File**: `frontend/src/hooks/useMentionAutocomplete.ts` (Enhance existing)

```typescript
export function useMentionAutocomplete(
  query: string,
  communityId: string,
  mentionType: 'user' | 'channel' | 'special'
) {
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  
  const { data: members } = useGetCommunityMembersQuery(communityId);
  const { data: channels } = useGetMentionableChannelsQuery(communityId);
  const { data: aliasGroups } = useGetAliasGroupsForMentionsQuery(communityId); // Add this

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    const filtered: MentionSuggestion[] = [];

    if (mentionType === 'user') {
      // Add alias group suggestions first (higher priority)
      const aliasMatches = aliasGroups
        ?.filter(group => 
          group.name.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 3)
        .map(group => ({
          type: 'alias' as const,
          id: group.id,
          display: group.name,
          secondary: `${group.memberCount} members`,
          priority: 1, // Higher priority than users
        })) || [];

      filtered.push(...aliasMatches);

      // Add user suggestions
      const userMatches = members
        ?.filter(m => 
          m.user.username.toLowerCase().includes(query.toLowerCase()) ||
          m.user.displayName?.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 5)
        .map(m => ({
          type: 'user' as const,
          id: m.user.id,
          display: m.user.displayName || m.user.username,
          avatar: m.user.avatarUrl,
          secondary: m.user.username !== m.user.displayName ? m.user.username : undefined,
          priority: 2,
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
          priority: 3,
        }));

      filtered.push(...specialMatches);
    }

    // Sort by priority and relevance
    filtered.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Secondary sort by how well the query matches
      const aMatch = a.display.toLowerCase().indexOf(query.toLowerCase());
      const bMatch = b.display.toLowerCase().indexOf(query.toLowerCase());
      return aMatch - bMatch;
    });

    setSuggestions(filtered);
  }, [query, mentionType, members, channels, aliasGroups]);

  return { suggestions, isLoading: false };
}
```

## 📊 **Implementation Timeline**

| Phase | Duration | Complexity | Priority |
|-------|----------|------------|----------|
| **Phase 1: Backend APIs** | 4-6 hours | Medium | High |
| **Phase 2: Frontend State** | 2-3 hours | Low | High |
| **Phase 3: Management UI** | 6-8 hours | High | Medium |
| **Phase 4: Mention Integration** | 3-4 hours | Medium | High |

**Total Implementation Time: 15-21 hours**

## 🎯 **Success Metrics**

### **Core Functionality Complete**:
- ✅ Community admins can create alias groups (e.g., @moderators)
- ✅ Members can be added/removed from alias groups
- ✅ @aliasgroup mentions work in messages with autocomplete
- ✅ Alias mentions resolve to notify all group members

### **Advanced Features Complete**:
- ✅ Permission-based alias group management
- ✅ Visual management interface with member previews
- ✅ Integration with existing mention system
- ✅ Autocomplete shows alias groups with member counts

## 🚀 **Competitive Advantages**

### **Beyond Discord's Capabilities**:
1. **Flexible Group Mentions** - Discord only has role-based mentions
2. **Dynamic Membership** - Easy to manage without role complications
3. **Community-Specific** - Each community has its own alias groups
4. **Advanced Management** - Rich UI for group administration

### **Use Cases Discord Can't Handle**:
- **Project Teams**: @frontend-team, @backend-team
- **Interests**: @movie-lovers, @gamers, @book-club
- **Availability**: @weekend-crew, @night-owls, @early-birds
- **Skills**: @designers, @writers, @reviewers

### **Technical Benefits**:
1. **Perfect Schema Design** - Your model is more flexible than Discord's roles
2. **RBAC Integration** - Proper permission management
3. **Scalable Architecture** - Can handle thousands of alias groups
4. **Real-time Ready** - Integrates with existing WebSocket system

This alias groups system would be a **major differentiator** for Kraken, providing functionality that goes beyond what Discord offers while maintaining the excellent architectural foundations you've already built.