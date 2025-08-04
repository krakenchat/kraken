# Instance Invitation System Implementation Plan

The Instance Invitation system is a **unique architectural decision** that sets Kraken apart from Discord. Instead of just joining servers, users must first be invited to the entire Kraken instance, providing better control for self-hosted deployments and private communities.

## 🏗️ **Current Architecture Status**

### ✅ **Exceptional Database Foundation** - 100% Complete

#### **InstanceInvite Model** - Sophisticated Invite System
```prisma
model InstanceInvite {
  id                 String    @id @default(auto()) @map("_id") @db.ObjectId
  code               String    @unique              // Unique invite code
  createdById        String?   @db.ObjectId        // Who created this invite
  createdBy          User?     @relation(fields: [createdById], references: [id])
  defaultCommunityId String[]  @db.ObjectId        // Communities to auto-join
  maxUses            Int?                          // Usage limit (null = unlimited)
  uses               Int       @default(0)         // Current usage count
  validUntil         DateTime?                     // Expiration date (null = never)
  createdAt          DateTime  @default(now())
  usedByIds          String[]  @db.ObjectId        // Track who used this invite
  disabled           Boolean   @default(false)      // Admin disable toggle
}
```

**Key Features**:
- **Unique Codes**: Each invite has a unique, shareable code
- **Usage Limits**: Control how many times an invite can be used
- **Expiration**: Time-based invite expiration
- **Auto-Community Join**: New users automatically join specified communities
- **Usage Tracking**: Track who used each invite
- **Creator Attribution**: Know who created each invite
- **Admin Controls**: Disable invites without deleting them

### ✅ **RBAC Integration** - Permission System Ready
```prisma
enum RbacActions {
  CREATE_INSTANCE_INVITE   // Create new instance invites
  DELETE_INSTANCE_INVITE   // Delete/disable invites
  READ_INSTANCE_INVITE     // View invite details and usage
  UPDATE_INSTANCE_INVITE   // Modify invite settings
}
```

### ✅ **Backend Service Foundation** - Partial Implementation
```typescript
// backend/src/invite/invite.service.ts - Basic structure exists
// backend/src/invite/invite.controller.ts - Basic endpoints exist
// backend/src/invite/invite.module.ts - Module configured
```

## ❌ **Missing Implementation** - Frontend and Advanced Logic

### **No Frontend Interface** - 0% Complete
- No invite creation UI
- No invite management dashboard
- No invite link sharing
- No invite usage analytics
- No invite redemption flow

### **Backend Gaps** - 30% Complete
- Basic CRUD exists but needs enhancement
- No invite code generation logic
- No invite redemption validation
- No auto-community joining logic
- No usage tracking implementation

## 📋 **Complete Implementation Plan**

### **Phase 1: Enhanced Backend Logic (4-5 hours)**

#### **1.1 Enhanced Invite Service**
**File**: `backend/src/invite/invite.service.ts` (Enhance existing)

```typescript
@Injectable()
export class InviteService {
  constructor(
    private readonly prisma: DatabaseService,
    private readonly membershipService: MembershipService,
  ) {}

  async createInstanceInvite(
    createInviteDto: CreateInstanceInviteDto,
    createdById: string,
  ): Promise<InstanceInviteResponse> {
    // Generate unique invite code
    const code = await this.generateUniqueInviteCode();
    
    // Validate default communities exist and creator has access
    if (createInviteDto.defaultCommunityIds?.length > 0) {
      await this.validateCommunitiesAccess(
        createInviteDto.defaultCommunityIds,
        createdById,
      );
    }

    const invite = await this.prisma.instanceInvite.create({
      data: {
        code,
        createdById,
        defaultCommunityId: createInviteDto.defaultCommunityIds || [],
        maxUses: createInviteDto.maxUses,
        validUntil: createInviteDto.validUntil,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return this.mapToResponse(invite);
  }

  async redeemInvite(
    inviteCode: string,
    userEmail: string,
    username: string,
    password: string,
  ): Promise<{ user: User; joinedCommunities: Community[] }> {
    // Find and validate invite
    const invite = await this.prisma.instanceInvite.findUnique({
      where: { code: inviteCode },
      include: { createdBy: true },
    });

    if (!invite) {
      throw new NotFoundException('Invalid invite code');
    }

    // Validate invite is still usable
    this.validateInviteUsability(invite);

    // Create user account
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await this.prisma.user.create({
      data: {
        username,
        email: userEmail,
        hashedPassword,
        verified: false, // Email verification can be separate
      },
    });

    // Update invite usage
    await this.prisma.instanceInvite.update({
      where: { id: invite.id },
      data: {
        uses: { increment: 1 },
        usedByIds: { push: user.id },
      },
    });

    // Auto-join default communities
    const joinedCommunities: Community[] = [];
    if (invite.defaultCommunityId.length > 0) {
      for (const communityId of invite.defaultCommunityId) {
        try {
          const membership = await this.membershipService.createMembership({
            userId: user.id,
            communityId,
          });
          
          const community = await this.prisma.community.findUnique({
            where: { id: communityId },
          });
          
          if (community) {
            joinedCommunities.push(community);
          }
        } catch (error) {
          // Log error but don't fail the entire process
          console.error(`Failed to join community ${communityId}:`, error);
        }
      }
    }

    return { user, joinedCommunities };
  }

  async getInstanceInvites(
    userId: string,
    includeUsage = false,
  ): Promise<InstanceInviteResponse[]> {
    // Check if user can view invites (admin permissions)
    const invites = await this.prisma.instanceInvite.findMany({
      where: {
        OR: [
          { createdById: userId }, // User's own invites
          // Add admin check here if needed
        ],
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invites.map(invite => this.mapToResponse(invite, includeUsage));
  }

  async getInviteAnalytics(inviteId: string): Promise<InviteAnalytics> {
    const invite = await this.prisma.instanceInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    // Get users who used this invite
    const usedByUsers = await this.prisma.user.findMany({
      where: { id: { in: invite.usedByIds } },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const isExpired = invite.validUntil ? invite.validUntil < new Date() : false;
    const isMaxUsesReached = invite.maxUses ? invite.uses >= invite.maxUses : false;
    const isActive = !invite.disabled && !isExpired && !isMaxUsesReached;

    return {
      invite: this.mapToResponse(invite, true),
      usedByUsers,
      analytics: {
        totalUses: invite.uses,
        remainingUses: invite.maxUses ? invite.maxUses - invite.uses : null,
        isActive,
        isExpired,
        isMaxUsesReached,
        usageOverTime: await this.getUsageOverTime(inviteId),
      },
    };
  }

  async disableInvite(inviteId: string, userId: string): Promise<void> {
    const invite = await this.prisma.instanceInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    // Check permissions (creator or admin)
    if (invite.createdById !== userId) {
      // Add admin permission check here
      throw new ForbiddenException('You can only disable your own invites');
    }

    await this.prisma.instanceInvite.update({
      where: { id: inviteId },
      data: { disabled: true },
    });
  }

  async validateInviteCode(code: string): Promise<InviteValidationResult> {
    const invite = await this.prisma.instanceInvite.findUnique({
      where: { code },
      include: {
        createdBy: {
          select: {
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!invite) {
      return { isValid: false, reason: 'Invalid invite code' };
    }

    if (invite.disabled) {
      return { isValid: false, reason: 'This invite has been disabled' };
    }

    if (invite.validUntil && invite.validUntil < new Date()) {
      return { isValid: false, reason: 'This invite has expired' };
    }

    if (invite.maxUses && invite.uses >= invite.maxUses) {
      return { isValid: false, reason: 'This invite has reached its usage limit' };
    }

    // Get default communities info
    const defaultCommunities = await this.prisma.community.findMany({
      where: { id: { in: invite.defaultCommunityId } },
      select: {
        id: true,
        name: true,
        avatar: true,
        description: true,
      },
    });

    return {
      isValid: true,
      invite: {
        code: invite.code,
        createdBy: invite.createdBy,
        defaultCommunities,
        createdAt: invite.createdAt,
      },
    };
  }

  private async generateUniqueInviteCode(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      // Generate a readable invite code (8 characters, no confusing letters)
      const code = this.generateReadableCode(8);
      
      const existing = await this.prisma.instanceInvite.findUnique({
        where: { code },
      });

      if (!existing) {
        return code;
      }

      attempts++;
    }

    throw new InternalServerErrorException('Failed to generate unique invite code');
  }

  private generateReadableCode(length: number): string {
    // Exclude confusing characters: 0, O, I, l, 1
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  private validateInviteUsability(invite: InstanceInvite): void {
    if (invite.disabled) {
      throw new BadRequestException('This invite has been disabled');
    }

    if (invite.validUntil && invite.validUntil < new Date()) {
      throw new BadRequestException('This invite has expired');
    }

    if (invite.maxUses && invite.uses >= invite.maxUses) {
      throw new BadRequestException('This invite has reached its usage limit');
    }
  }

  private async validateCommunitiesAccess(
    communityIds: string[],
    userId: string,
  ): Promise<void> {
    for (const communityId of communityIds) {
      const membership = await this.prisma.membership.findUnique({
        where: {
          userId_communityId: {
            userId,
            communityId,
          },
        },
      });

      if (!membership) {
        throw new BadRequestException(
          `You don't have access to community ${communityId}`,
        );
      }
    }
  }

  private mapToResponse(
    invite: InstanceInvite & { createdBy?: User },
    includeUsage = false,
  ): InstanceInviteResponse {
    const isExpired = invite.validUntil ? invite.validUntil < new Date() : false;
    const isMaxUsesReached = invite.maxUses ? invite.uses >= invite.maxUses : false;
    const isActive = !invite.disabled && !isExpired && !isMaxUsesReached;

    return {
      id: invite.id,
      code: invite.code,
      createdBy: invite.createdBy,
      defaultCommunityIds: invite.defaultCommunityId,
      maxUses: invite.maxUses,
      uses: includeUsage ? invite.uses : undefined,
      validUntil: invite.validUntil,
      createdAt: invite.createdAt,
      disabled: invite.disabled,
      isActive,
      isExpired,
      isMaxUsesReached,
    };
  }
}
```

#### **1.2 Enhanced Invite Controller**
**File**: `backend/src/invite/invite.controller.ts` (Enhance existing)

```typescript
@Controller('invites')
@UseGuards(JwtAuthGuard, RbacGuard)
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @Post()
  @RequiredActions(RbacActions.CREATE_INSTANCE_INVITE)
  async createInvite(
    @Body() createInviteDto: CreateInstanceInviteDto,
    @Request() req,
  ): Promise<InstanceInviteResponse> {
    return this.inviteService.createInstanceInvite(createInviteDto, req.user.id);
  }

  @Get()
  @RequiredActions(RbacActions.READ_INSTANCE_INVITE)
  async getInvites(
    @Request() req,
    @Query('includeUsage') includeUsage?: string,
  ): Promise<InstanceInviteResponse[]> {
    return this.inviteService.getInstanceInvites(
      req.user.id,
      includeUsage === 'true',
    );
  }

  @Get(':inviteId/analytics')
  @RequiredActions(RbacActions.READ_INSTANCE_INVITE)
  async getInviteAnalytics(
    @Param('inviteId') inviteId: string,
  ): Promise<InviteAnalytics> {
    return this.inviteService.getInviteAnalytics(inviteId);
  }

  @Put(':inviteId/disable')
  @RequiredActions(RbacActions.UPDATE_INSTANCE_INVITE)
  async disableInvite(
    @Param('inviteId') inviteId: string,
    @Request() req,
  ): Promise<void> {
    return this.inviteService.disableInvite(inviteId, req.user.id);
  }

  @Delete(':inviteId')
  @RequiredActions(RbacActions.DELETE_INSTANCE_INVITE)
  async deleteInvite(@Param('inviteId') inviteId: string): Promise<void> {
    return this.inviteService.deleteInvite(inviteId);
  }

  // Public endpoint for invite validation (no auth required)
  @Get('validate/:code')
  @Public()
  async validateInvite(
    @Param('code') code: string,
  ): Promise<InviteValidationResult> {
    return this.inviteService.validateInviteCode(code);
  }

  // Public endpoint for invite redemption (creates user account)
  @Post('redeem/:code')
  @Public()
  async redeemInvite(
    @Param('code') code: string,
    @Body() redeemDto: RedeemInviteDto,
  ): Promise<{ user: User; joinedCommunities: Community[]; token: string }> {
    const result = await this.inviteService.redeemInvite(
      code,
      redeemDto.email,
      redeemDto.username,
      redeemDto.password,
    );

    // Generate JWT token for the new user
    const token = await this.authService.generateTokenForUser(result.user);

    return {
      ...result,
      token,
    };
  }
}
```

### **Phase 2: Frontend State Management (2-3 hours)**

#### **2.1 Instance Invites API Slice**
**File**: `frontend/src/features/instance-invites/instanceInvitesApiSlice.ts`

```typescript
export const instanceInvitesApi = createApi({
  reducerPath: 'instanceInvitesApi',
  baseQuery: authedBaseQuery,
  tagTypes: ['InstanceInvite'],
  endpoints: (builder) => ({
    getInstanceInvites: builder.query<InstanceInviteResponse[], boolean>({
      query: (includeUsage = false) => 
        `/invites?includeUsage=${includeUsage}`,
      providesTags: ['InstanceInvite'],
    }),

    createInstanceInvite: builder.mutation<
      InstanceInviteResponse,
      CreateInstanceInviteDto
    >({
      query: (body) => ({
        url: '/invites',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['InstanceInvite'],
    }),

    getInviteAnalytics: builder.query<InviteAnalytics, string>({
      query: (inviteId) => `/invites/${inviteId}/analytics`,
      providesTags: (result, error, inviteId) => [
        { type: 'InstanceInvite', id: inviteId },
      ],
    }),

    disableInvite: builder.mutation<void, string>({
      query: (inviteId) => ({
        url: `/invites/${inviteId}/disable`,
        method: 'PUT',
      }),
      invalidatesTags: ['InstanceInvite'],
    }),

    deleteInvite: builder.mutation<void, string>({
      query: (inviteId) => ({
        url: `/invites/${inviteId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['InstanceInvite'],
    }),

    validateInviteCode: builder.query<InviteValidationResult, string>({
      query: (code) => `/invites/validate/${code}`,
    }),

    redeemInvite: builder.mutation<
      { user: User; joinedCommunities: Community[]; token: string },
      { code: string; email: string; username: string; password: string }
    >({
      query: ({ code, ...body }) => ({
        url: `/invites/redeem/${code}`,
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useGetInstanceInvitesQuery,
  useCreateInstanceInviteMutation,
  useGetInviteAnalyticsQuery,
  useDisableInviteMutation,
  useDeleteInviteMutation,
  useValidateInviteCodeQuery,
  useRedeemInviteMutation,
} = instanceInvitesApi;
```

### **Phase 3: Admin Management Interface (6-8 hours)**

#### **3.1 Instance Invites Management Page**
**File**: `frontend/src/pages/InstanceInvitesPage.tsx`

```typescript
export function InstanceInvitesPage() {
  const { data: invites, isLoading } = useGetInstanceInvitesQuery(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedInvite, setSelectedInvite] = useState<InstanceInviteResponse | null>(null);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Instance Invites</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Invite
        </Button>
      </Box>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Manage invitations to your Kraken instance. Users need an invite to create accounts and join communities.
      </Typography>

      {isLoading ? (
        <InvitesSkeleton />
      ) : (
        <Grid container spacing={3}>
          {invites?.map((invite) => (
            <Grid item xs={12} md={6} lg={4} key={invite.id}>
              <InviteCard
                invite={invite}
                onViewAnalytics={() => setSelectedInvite(invite)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {invites?.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <PersonAddIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Invites Created Yet
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Create invite codes to allow new users to join your Kraken instance.
          </Typography>
          <Button
            variant="contained"
            onClick={() => setCreateDialogOpen(true)}
            startIcon={<AddIcon />}
          >
            Create Your First Invite
          </Button>
        </Paper>
      )}

      <CreateInviteDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />

      {selectedInvite && (
        <InviteAnalyticsDialog
          invite={selectedInvite}
          open={!!selectedInvite}
          onClose={() => setSelectedInvite(null)}
        />
      )}
    </Container>
  );
}
```

#### **3.2 Invite Card Component**
**File**: `frontend/src/components/Invites/InviteCard.tsx`

```typescript
interface InviteCardProps {
  invite: InstanceInviteResponse;
  onViewAnalytics: () => void;
}

export function InviteCard({ invite, onViewAnalytics }: InviteCardProps) {
  const [disableInvite] = useDisableInviteMutation();
  const [deleteInvite] = useDeleteInviteMutation();
  const [copied, setCopied] = useState(false);

  const inviteUrl = `${window.location.origin}/invite/${invite.code}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy invite link:', error);
    }
  };

  const handleDisable = async () => {
    try {
      await disableInvite(invite.id).unwrap();
    } catch (error) {
      console.error('Failed to disable invite:', error);
    }
  };

  const getStatusColor = (): 'success' | 'warning' | 'error' => {
    if (!invite.isActive) return 'error';
    if (invite.maxUses && invite.uses && invite.uses / invite.maxUses > 0.8) return 'warning';
    return 'success';
  };

  const getStatusText = (): string => {
    if (invite.disabled) return 'Disabled';
    if (invite.isExpired) return 'Expired';
    if (invite.isMaxUsesReached) return 'Usage Limit Reached';
    return 'Active';
  };

  return (
    <Card>
      <CardHeader
        avatar={
          <Avatar sx={{ bgcolor: `${getStatusColor()}.main` }}>
            <LinkIcon />
          </Avatar>
        }
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
              {invite.code}
            </Typography>
            <Chip
              size="small"
              label={getStatusText()}
              color={getStatusColor()}
              variant="outlined"
            />
          </Box>
        }
        subheader={`Created ${new Date(invite.createdAt).toLocaleDateString()}`}
        action={
          <IconButton onClick={onViewAnalytics}>
            <AnalyticsIcon />
          </IconButton>
        }
      />

      <CardContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Invite Link:
          </Typography>
          <Paper
            sx={{
              p: 1,
              bgcolor: 'grey.100',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                flex: 1,
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {inviteUrl}
            </Typography>
            <IconButton size="small" onClick={handleCopyLink}>
              {copied ? <CheckIcon color="success" /> : <ContentCopyIcon />}
            </IconButton>
          </Paper>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Uses
            </Typography>
            <Typography variant="h6">
              {invite.uses || 0}
              {invite.maxUses && ` / ${invite.maxUses}`}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Expires
            </Typography>
            <Typography variant="body2">
              {invite.validUntil 
                ? new Date(invite.validUntil).toLocaleDateString()
                : 'Never'
              }
            </Typography>
          </Grid>
        </Grid>

        {invite.defaultCommunityIds.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Auto-join Communities: {invite.defaultCommunityIds.length}
            </Typography>
          </Box>
        )}
      </CardContent>

      <CardActions>
        <Button size="small" variant="outlined" onClick={handleCopyLink}>
          {copied ? 'Copied!' : 'Copy Link'}
        </Button>
        <Button size="small" onClick={onViewAnalytics}>
          Analytics
        </Button>
        {invite.isActive && (
          <Button size="small" color="error" onClick={handleDisable}>
            Disable
          </Button>
        )}
      </CardActions>
    </Card>
  );
}
```

#### **3.3 Create Invite Dialog**
**File**: `frontend/src/components/Invites/CreateInviteDialog.tsx`

```typescript
export function CreateInviteDialog({ open, onClose }: CreateInviteDialogProps) {
  const [maxUses, setMaxUses] = useState<number | null>(null);
  const [validUntil, setValidUntil] = useState<string>('');
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [unlimitedUses, setUnlimitedUses] = useState(true);
  const [neverExpires, setNeverExpires] = useState(true);

  const [createInvite, { isLoading }] = useCreateInstanceInviteMutation();
  const { data: communities } = useGetUserCommunitiesQuery();

  const handleCreate = async () => {
    try {
      await createInvite({
        maxUses: unlimitedUses ? null : maxUses,
        validUntil: neverExpires ? null : new Date(validUntil).toISOString(),
        defaultCommunityIds: selectedCommunities,
      }).unwrap();

      onClose();
      // Reset form
      setMaxUses(null);
      setValidUntil('');
      setSelectedCommunities([]);
      setUnlimitedUses(true);
      setNeverExpires(true);
    } catch (error) {
      console.error('Failed to create invite:', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Instance Invite</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          {/* Usage Limits */}
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={unlimitedUses}
                  onChange={(e) => setUnlimitedUses(e.target.checked)}
                />
              }
              label="Unlimited uses"
            />
          </FormGroup>

          {!unlimitedUses && (
            <TextField
              margin="dense"
              label="Maximum uses"
              type="number"
              fullWidth
              variant="outlined"
              value={maxUses || ''}
              onChange={(e) => setMaxUses(parseInt(e.target.value) || null)}
              inputProps={{ min: 1 }}
            />
          )}

          {/* Expiration */}
          <FormGroup sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={neverExpires}
                  onChange={(e) => setNeverExpires(e.target.checked)}
                />
              }
              label="Never expires"
            />
          </FormGroup>

          {!neverExpires && (
            <TextField
              margin="dense"
              label="Expires on"
              type="datetime-local"
              fullWidth
              variant="outlined"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          )}

          {/* Default Communities */}
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Auto-join Communities (Optional)
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            New users will automatically be added to selected communities
          </Typography>

          <FormGroup>
            {communities?.map((community) => (
              <FormControlLabel
                key={community.id}
                control={
                  <Checkbox
                    checked={selectedCommunities.includes(community.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCommunities(prev => [...prev, community.id]);
                      } else {
                        setSelectedCommunities(prev => 
                          prev.filter(id => id !== community.id)
                        );
                      }
                    }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar src={community.avatar} sx={{ width: 24, height: 24 }}>
                      {community.name[0]}
                    </Avatar>
                    {community.name}
                  </Box>
                }
              />
            ))}
          </FormGroup>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={isLoading}
        >
          {isLoading ? 'Creating...' : 'Create Invite'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### **Phase 4: Public Invite Redemption (4-5 hours)**

#### **4.1 Invite Landing Page**
**File**: `frontend/src/pages/InvitePage.tsx`

```typescript
export function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  
  const { data: validation, isLoading: validating } = useValidateInviteCodeQuery(
    code || '',
    { skip: !code }
  );
  
  const [redeemInvite, { isLoading: redeeming }] = useRedeemInviteMutation();
  
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      // Show error
      return;
    }

    try {
      const result = await redeemInvite({
        code: code!,
        email: formData.email,
        username: formData.username,
        password: formData.password,
      }).unwrap();

      // Store token and redirect
      localStorage.setItem('kraken_token', result.token);
      navigate('/');
    } catch (error) {
      console.error('Failed to redeem invite:', error);
    }
  };

  if (validating) {
    return <InviteValidationSkeleton />;
  }

  if (!validation?.isValid) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <Paper sx={{ p: 4 }}>
          <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Invalid Invite
          </Typography>
          <Typography color="text.secondary">
            {validation?.reason || 'This invite code is not valid.'}
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" gutterBottom>
            You're Invited to Kraken!
          </Typography>
          
          {validation.invite?.createdBy && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
              <Avatar src={validation.invite.createdBy.avatarUrl} sx={{ width: 32, height: 32 }}>
                {validation.invite.createdBy.displayName?.[0] || validation.invite.createdBy.username[0]}
              </Avatar>
              <Typography variant="body2" color="text.secondary">
                Invited by {validation.invite.createdBy.displayName || validation.invite.createdBy.username}
              </Typography>
            </Box>
          )}

          {validation.invite?.defaultCommunities && validation.invite.defaultCommunities.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                You'll automatically join:
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                {validation.invite.defaultCommunities.map((community) => (
                  <Chip
                    key={community.id}
                    avatar={<Avatar src={community.avatar}>{community.name[0]}</Avatar>}
                    label={community.name}
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>

        <form onSubmit={handleRedeem}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            margin="normal"
            required
          />
          
          <TextField
            fullWidth
            label="Username"
            value={formData.username}
            onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
            margin="normal"
            required
          />
          
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            margin="normal"
            required
          />
          
          <TextField
            fullWidth
            label="Confirm Password"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            margin="normal"
            required
            error={formData.confirmPassword && formData.password !== formData.confirmPassword}
            helperText={
              formData.confirmPassword && formData.password !== formData.confirmPassword
                ? 'Passwords do not match'
                : ''
            }
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={redeeming || formData.password !== formData.confirmPassword}
            sx={{ mt: 3 }}
          >
            {redeeming ? 'Creating Account...' : 'Join Kraken'}
          </Button>
        </form>
      </Paper>
    </Container>
  );
}
```

## 📊 **Implementation Timeline**

| Phase | Duration | Complexity | Priority |
|-------|----------|------------|----------|
| **Phase 1: Backend Logic** | 4-5 hours | Medium | Critical |
| **Phase 2: Frontend State** | 2-3 hours | Low | Critical |
| **Phase 3: Admin Interface** | 6-8 hours | High | High |
| **Phase 4: Public Redemption** | 4-5 hours | Medium | High |

**Total Implementation Time: 16-21 hours**

## 🎯 **Success Metrics**

### **Core Functionality Complete**:
- ✅ Admins can create instance invites with limits and expiration
- ✅ Invite codes are unique, readable, and shareable
- ✅ New users can redeem invites to create accounts
- ✅ Auto-community joining works for new users

### **Advanced Features Complete**:
- ✅ Invite analytics show usage patterns and user details
- ✅ Invite management with disable/delete capabilities
- ✅ Permission-based invite creation and management
- ✅ Beautiful public invite redemption experience

## 🚀 **Competitive Advantages**

### **Beyond Discord's Model**:
1. **Instance-Level Control** - Perfect for self-hosted deployments
2. **Advanced Invite Management** - Rich analytics and controls
3. **Auto-Community Assignment** - Streamlined onboarding
4. **Usage Tracking** - Know exactly who joined from which invite

### **Use Cases Discord Can't Handle**:
- **Private Instances** - Completely closed communities
- **Corporate Deployments** - Controlled user onboarding
- **Educational Use** - Class-based invite management
- **Family/Friend Groups** - Intimate community control

### **Technical Benefits**:
1. **Flexible Architecture** - Supports both open and closed instances
2. **Rich Analytics** - Detailed invite performance tracking
3. **Automated Onboarding** - Users land in the right communities immediately
4. **Admin Control** - Fine-grained invite management

This instance invite system provides a **unique architectural advantage** that positions Kraken as the perfect solution for self-hosted, private, or controlled-access chat communities - something Discord simply cannot offer with its open server model.