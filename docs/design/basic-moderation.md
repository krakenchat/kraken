# Basic Moderation Tools Implementation Plan

## 🎯 Overview

Implement essential moderation tools to enable community administrators and moderators to manage users and content effectively. This includes user ban/kick functionality, message moderation, and basic automated moderation features.

## 📊 Current State

**Backend RBAC**: ✅ Partial Implementation
- Permission system exists with granular actions
- Some moderation permissions defined (DELETE_MESSAGE)
- User role assignment working
- Missing: Ban/kick implementation, moderation logging

**Frontend**: ❌ Missing
- No moderation interfaces in community management
- No user context menus for mod actions
- No moderation logs/audit trail
- No automated moderation controls

## 🏗️ Architecture

### Database Schema Extensions

```prisma
// Add to existing schema
model CommunityBan {
  id          String    @id @default(cuid())
  communityId String
  userId      String
  bannedById  String
  reason      String?
  bannedAt    DateTime  @default(now())
  expiresAt   DateTime? // null for permanent ban
  active      Boolean   @default(true)
  
  community   Community @relation(fields: [communityId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  bannedBy    User      @relation(fields: [bannedById], references: [id], onDelete: Cascade)
  
  @@unique([communityId, userId])
  @@map("community_bans")
}

model ModerationLog {
  id          String           @id @default(cuid())
  communityId String?
  channelId   String?
  moderatorId String
  targetId    String?          // User or message ID
  action      ModerationAction
  reason      String?
  metadata    Json?            // Additional context
  createdAt   DateTime         @default(now())
  
  community   Community? @relation(fields: [communityId], references: [id], onDelete: Cascade)
  channel     Channel?   @relation(fields: [channelId], references: [id], onDelete: Cascade)
  moderator   User       @relation(fields: [moderatorId], references: [id], onDelete: Cascade)
  
  @@map("moderation_logs")
}

enum ModerationAction {
  BAN_USER
  UNBAN_USER
  KICK_USER
  DELETE_MESSAGE
  PIN_MESSAGE
  UNPIN_MESSAGE
  TIMEOUT_USER
  WARN_USER
  ROLE_ASSIGN
  ROLE_REMOVE
  CHANNEL_LOCK
  CHANNEL_UNLOCK
}

// Add to Message model
model Message {
  // ... existing fields
  deleted     Boolean   @default(false)
  deletedAt   DateTime?
  deletedBy   String?
  deleteReason String?
  pinned      Boolean   @default(false)
  pinnedAt    DateTime?
  pinnedBy    String?
  
  deletedByUser User? @relation(fields: [deletedBy], references: [id])
  pinnedByUser  User? @relation(fields: [pinnedBy], references: [id])
}
```

### Enhanced RBAC Actions

```typescript
enum RbacActions {
  // ... existing actions ...
  
  // User moderation
  BAN_USER = 'BAN_USER',
  UNBAN_USER = 'UNBAN_USER', 
  KICK_USER = 'KICK_USER',
  TIMEOUT_USER = 'TIMEOUT_USER',
  WARN_USER = 'WARN_USER',
  
  // Message moderation
  PIN_MESSAGE = 'PIN_MESSAGE',
  UNPIN_MESSAGE = 'UNPIN_MESSAGE',
  DELETE_ANY_MESSAGE = 'DELETE_ANY_MESSAGE',
  
  // Channel moderation
  LOCK_CHANNEL = 'LOCK_CHANNEL',
  UNLOCK_CHANNEL = 'UNLOCK_CHANNEL',
  
  // Moderation oversight
  VIEW_MODERATION_LOGS = 'VIEW_MODERATION_LOGS',
  VIEW_BAN_LIST = 'VIEW_BAN_LIST',
}
```

## 🔧 Implementation Details

### Backend Implementation

#### 1. Moderation Service

```typescript
// backend/src/moderation/moderation.service.ts

import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { ModerationAction } from '@prisma/client';

@Injectable()
export class ModerationService {
  constructor(private readonly databaseService: DatabaseService) {}

  async banUser(
    communityId: string,
    userId: string,
    moderatorId: string,
    reason?: string,
    expiresAt?: Date,
  ) {
    // Check if user is already banned
    const existingBan = await this.databaseService.communityBan.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });

    if (existingBan && existingBan.active) {
      throw new ForbiddenException('User is already banned');
    }

    // Prevent self-ban
    if (userId === moderatorId) {
      throw new ForbiddenException('Cannot ban yourself');
    }

    // Check if target user has higher or equal role
    const [targetMembership, moderatorMembership] = await Promise.all([
      this.databaseService.member.findFirst({
        where: { communityId, userId },
        include: { roles: { include: { role: true } } },
      }),
      this.databaseService.member.findFirst({
        where: { communityId, userId: moderatorId },
        include: { roles: { include: { role: true } } },
      }),
    ]);

    if (!targetMembership) {
      throw new NotFoundException('User is not a member of this community');
    }

    // Role hierarchy check (simplified - you may want more complex logic)
    const targetIsAdmin = targetMembership.roles.some(r => r.role.name === 'Admin');
    const moderatorIsOwner = moderatorMembership?.roles.some(r => r.role.name === 'Owner');

    if (targetIsAdmin && !moderatorIsOwner) {
      throw new ForbiddenException('Cannot ban an administrator');
    }

    // Create or update ban
    const ban = await this.databaseService.communityBan.upsert({
      where: { communityId_userId: { communityId, userId } },
      create: {
        communityId,
        userId,
        bannedById: moderatorId,
        reason,
        expiresAt,
        active: true,
      },
      update: {
        bannedById: moderatorId,
        reason,
        expiresAt,
        active: true,
        bannedAt: new Date(),
      },
    });

    // Remove user from community
    await this.databaseService.member.delete({
      where: { communityId_userId: { communityId, userId } },
    });

    // Log the action
    await this.logModerationAction({
      communityId,
      moderatorId,
      targetId: userId,
      action: ModerationAction.BAN_USER,
      reason,
      metadata: { expiresAt, banId: ban.id },
    });

    return ban;
  }

  async unbanUser(communityId: string, userId: string, moderatorId: string) {
    const ban = await this.databaseService.communityBan.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });

    if (!ban || !ban.active) {
      throw new NotFoundException('User is not banned');
    }

    // Deactivate ban
    const updatedBan = await this.databaseService.communityBan.update({
      where: { id: ban.id },
      data: { active: false },
    });

    // Log the action
    await this.logModerationAction({
      communityId,
      moderatorId,
      targetId: userId,
      action: ModerationAction.UNBAN_USER,
      metadata: { banId: ban.id },
    });

    return updatedBan;
  }

  async kickUser(communityId: string, userId: string, moderatorId: string, reason?: string) {
    // Similar role hierarchy checks as ban
    if (userId === moderatorId) {
      throw new ForbiddenException('Cannot kick yourself');
    }

    // Remove user from community (without ban record)
    const membership = await this.databaseService.member.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });

    if (!membership) {
      throw new NotFoundException('User is not a member of this community');
    }

    await this.databaseService.member.delete({
      where: { communityId_userId: { communityId, userId } },
    });

    // Log the action
    await this.logModerationAction({
      communityId,
      moderatorId,
      targetId: userId,
      action: ModerationAction.KICK_USER,
      reason,
    });

    return { success: true };
  }

  async deleteMessage(
    messageId: string,
    moderatorId: string,
    reason?: string,
  ) {
    const message = await this.databaseService.message.findUnique({
      where: { id: messageId },
      include: { channel: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Soft delete message
    const updatedMessage = await this.databaseService.message.update({
      where: { id: messageId },
      data: {
        deleted: true,
        deletedAt: new Date(),
        deletedBy: moderatorId,
        deleteReason: reason,
      },
    });

    // Log the action
    await this.logModerationAction({
      communityId: message.channel?.communityId,
      channelId: message.channelId,
      moderatorId,
      targetId: messageId,
      action: ModerationAction.DELETE_MESSAGE,
      reason,
    });

    return updatedMessage;
  }

  async pinMessage(messageId: string, moderatorId: string) {
    const message = await this.databaseService.message.findUnique({
      where: { id: messageId },
      include: { channel: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const updatedMessage = await this.databaseService.message.update({
      where: { id: messageId },
      data: {
        pinned: true,
        pinnedAt: new Date(),
        pinnedBy: moderatorId,
      },
    });

    await this.logModerationAction({
      communityId: message.channel?.communityId,
      channelId: message.channelId,
      moderatorId,
      targetId: messageId,
      action: ModerationAction.PIN_MESSAGE,
    });

    return updatedMessage;
  }

  async getBanList(communityId: string) {
    return this.databaseService.communityBan.findMany({
      where: { communityId, active: true },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
        bannedBy: { select: { id: true, username: true } },
      },
      orderBy: { bannedAt: 'desc' },
    });
  }

  async getModerationLogs(communityId: string, limit = 50, offset = 0) {
    return this.databaseService.moderationLog.findMany({
      where: { communityId },
      include: {
        moderator: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  private async logModerationAction(data: {
    communityId?: string;
    channelId?: string;
    moderatorId: string;
    targetId?: string;
    action: ModerationAction;
    reason?: string;
    metadata?: any;
  }) {
    return this.databaseService.moderationLog.create({
      data: {
        ...data,
        metadata: data.metadata || {},
      },
    });
  }
}
```

#### 2. Moderation Controller

```typescript
// backend/src/moderation/moderation.controller.ts

import { 
  Controller, 
  Post, 
  Delete, 
  Get, 
  Body, 
  Param, 
  Query,
  UseGuards 
} from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import { RbacResource } from '@/auth/rbac-resource.decorator';
import { ModerationService } from './moderation.service';

@Controller('moderation')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('ban/:communityId/:userId')
  @RequiredActions(RbacActions.BAN_USER)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async banUser(
    @Param('communityId') communityId: string,
    @Param('userId') userId: string,
    @Body() body: { reason?: string; expiresAt?: string },
    @Req() req,
  ) {
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;
    return this.moderationService.banUser(
      communityId,
      userId,
      req.user.id,
      body.reason,
      expiresAt,
    );
  }

  @Delete('ban/:communityId/:userId')
  @RequiredActions(RbacActions.UNBAN_USER)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async unbanUser(
    @Param('communityId') communityId: string,
    @Param('userId') userId: string,
    @Req() req,
  ) {
    return this.moderationService.unbanUser(communityId, userId, req.user.id);
  }

  @Post('kick/:communityId/:userId')
  @RequiredActions(RbacActions.KICK_USER)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async kickUser(
    @Param('communityId') communityId: string,
    @Param('userId') userId: string,
    @Body() body: { reason?: string },
    @Req() req,
  ) {
    return this.moderationService.kickUser(communityId, userId, req.user.id, body.reason);
  }

  @Post('delete-message/:messageId')
  @RequiredActions(RbacActions.DELETE_ANY_MESSAGE)
  @RbacResource({
    type: RbacResourceType.MESSAGE,
    idKey: 'messageId',
    source: ResourceIdSource.PARAM,
  })
  async deleteMessage(
    @Param('messageId') messageId: string,
    @Body() body: { reason?: string },
    @Req() req,
  ) {
    return this.moderationService.deleteMessage(messageId, req.user.id, body.reason);
  }

  @Post('pin-message/:messageId')
  @RequiredActions(RbacActions.PIN_MESSAGE)
  @RbacResource({
    type: RbacResourceType.MESSAGE,
    idKey: 'messageId',
    source: ResourceIdSource.PARAM,
  })
  async pinMessage(@Param('messageId') messageId: string, @Req() req) {
    return this.moderationService.pinMessage(messageId, req.user.id);
  }

  @Get('bans/:communityId')
  @RequiredActions(RbacActions.VIEW_BAN_LIST)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async getBanList(@Param('communityId') communityId: string) {
    return this.moderationService.getBanList(communityId);
  }

  @Get('logs/:communityId')
  @RequiredActions(RbacActions.VIEW_MODERATION_LOGS)
  @RbacResource({
    type: RbacResourceType.COMMUNITY,
    idKey: 'communityId',
    source: ResourceIdSource.PARAM,
  })
  async getModerationLogs(
    @Param('communityId') communityId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.moderationService.getModerationLogs(
      communityId,
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0,
    );
  }
}
```

### Frontend Implementation

#### 1. User Context Menu with Moderation Actions

```typescript
// frontend/src/components/User/UserContextMenu.tsx

import React, { useState } from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material';
import {
  Block as BanIcon,
  ExitToApp as KickIcon,
  Report as ReportIcon,
  AdminPanelSettings as ModIcon,
} from '@mui/icons-material';
import { useUserPermissions } from '../../features/roles/useUserPermissions';
import { 
  useBanUserMutation, 
  useKickUserMutation 
} from '../../features/moderation/moderationApiSlice';

interface UserContextMenuProps {
  userId: string;
  username: string;
  communityId: string;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

export const UserContextMenu: React.FC<UserContextMenuProps> = ({
  userId,
  username,
  communityId,
  anchorEl,
  onClose,
}) => {
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [kickDialogOpen, setKickDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [banDuration, setBanDuration] = useState('');

  const [banUser, { isLoading: banning }] = useBanUserMutation();
  const [kickUser, { isLoading: kicking }] = useKickUserMutation();

  const { hasPermissions: canBan } = useUserPermissions({
    resourceType: 'COMMUNITY',
    resourceId: communityId,
    actions: ['BAN_USER'],
  });

  const { hasPermissions: canKick } = useUserPermissions({
    resourceType: 'COMMUNITY',
    resourceId: communityId,
    actions: ['KICK_USER'],
  });

  const handleBan = async () => {
    try {
      const expiresAt = banDuration ? new Date(Date.now() + parseInt(banDuration) * 24 * 60 * 60 * 1000) : undefined;
      await banUser({ communityId, userId, reason, expiresAt }).unwrap();
      setBanDialogOpen(false);
      setReason('');
      setBanDuration('');
      onClose();
    } catch (error) {
      console.error('Failed to ban user:', error);
    }
  };

  const handleKick = async () => {
    try {
      await kickUser({ communityId, userId, reason }).unwrap();
      setKickDialogOpen(false);
      setReason('');
      onClose();
    } catch (error) {
      console.error('Failed to kick user:', error);
    }
  };

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => { /* View profile */ }}>
          <ListItemIcon><ModIcon /></ListItemIcon>
          <ListItemText>View Profile</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => { /* Send DM */ }}>
          <ListItemIcon><ReportIcon /></ListItemIcon>
          <ListItemText>Send Message</ListItemText>
        </MenuItem>

        {(canKick || canBan) && <Divider />}

        {canKick && (
          <MenuItem onClick={() => { setKickDialogOpen(true); onClose(); }}>
            <ListItemIcon><KickIcon color="warning" /></ListItemIcon>
            <ListItemText>Kick User</ListItemText>
          </MenuItem>
        )}

        {canBan && (
          <MenuItem onClick={() => { setBanDialogOpen(true); onClose(); }}>
            <ListItemIcon><BanIcon color="error" /></ListItemIcon>
            <ListItemText>Ban User</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Ban Dialog */}
      <Dialog open={banDialogOpen} onClose={() => setBanDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ban {username}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Reason (optional)"
            fullWidth
            multiline
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Duration (days, leave empty for permanent)"
            type="number"
            fullWidth
            value={banDuration}
            onChange={(e) => setBanDuration(e.target.value)}
            inputProps={{ min: 1, max: 365 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBanDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleBan} color="error" disabled={banning}>
            {banning ? 'Banning...' : 'Ban User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Kick Dialog */}
      <Dialog open={kickDialogOpen} onClose={() => setKickDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Kick {username}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Reason (optional)"
            fullWidth
            multiline
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKickDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleKick} color="warning" disabled={kicking}>
            {kicking ? 'Kicking...' : 'Kick User'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
```

#### 2. Message Moderation Actions

```typescript
// frontend/src/components/Message/MessageModerationActions.tsx

import React, { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material';
import { 
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  PushPin as PinIcon,
  Report as ReportIcon,
} from '@mui/icons-material';
import { useUserPermissions } from '../../features/roles/useUserPermissions';
import { 
  useDeleteMessageMutation, 
  usePinMessageMutation 
} from '../../features/moderation/moderationApiSlice';

interface MessageModerationActionsProps {
  messageId: string;
  channelId: string;
  isPinned?: boolean;
}

export const MessageModerationActions: React.FC<MessageModerationActionsProps> = ({
  messageId,
  channelId,
  isPinned = false,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  const [deleteMessage, { isLoading: deleting }] = useDeleteMessageMutation();
  const [pinMessage, { isLoading: pinning }] = usePinMessageMutation();

  const { hasPermissions: canDeleteAny } = useUserPermissions({
    resourceType: 'CHANNEL',
    resourceId: channelId,
    actions: ['DELETE_ANY_MESSAGE'],
  });

  const { hasPermissions: canPin } = useUserPermissions({
    resourceType: 'CHANNEL',
    resourceId: channelId,
    actions: ['PIN_MESSAGE'],
  });

  const handleDelete = async () => {
    try {
      await deleteMessage({ messageId, reason: deleteReason }).unwrap();
      setDeleteDialogOpen(false);
      setDeleteReason('');
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const handlePin = async () => {
    try {
      await pinMessage(messageId).unwrap();
      setAnchorEl(null);
    } catch (error) {
      console.error('Failed to pin message:', error);
    }
  };

  if (!canDeleteAny && !canPin) {
    return null;
  }

  return (
    <>
      <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
        <MoreIcon fontSize="small" />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {canPin && (
          <MenuItem onClick={handlePin} disabled={pinning}>
            <ListItemIcon><PinIcon /></ListItemIcon>
            <ListItemText>{isPinned ? 'Unpin Message' : 'Pin Message'}</ListItemText>
          </MenuItem>
        )}

        {canDeleteAny && (
          <MenuItem 
            onClick={() => { 
              setDeleteDialogOpen(true); 
              setAnchorEl(null); 
            }}
          >
            <ListItemIcon><DeleteIcon color="error" /></ListItemIcon>
            <ListItemText>Delete Message</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Message</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Reason (optional)"
            fullWidth
            multiline
            rows={2}
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
```

#### 3. Ban List Management

```typescript
// frontend/src/components/Community/BanListManagement.tsx

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Chip,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import { Remove as UnbanIcon } from '@mui/icons-material';
import { 
  useGetBanListQuery, 
  useUnbanUserMutation 
} from '../../features/moderation/moderationApiSlice';

interface BanListManagementProps {
  communityId: string;
}

export const BanListManagement: React.FC<BanListManagementProps> = ({ communityId }) => {
  const [confirmUnbanOpen, setConfirmUnbanOpen] = useState(false);
  const [selectedBan, setSelectedBan] = useState<any>(null);

  const { data: bans, isLoading } = useGetBanListQuery(communityId);
  const [unbanUser, { isLoading: unbanning }] = useUnbanUserMutation();

  const handleUnban = async () => {
    if (!selectedBan) return;

    try {
      await unbanUser({ communityId, userId: selectedBan.userId }).unwrap();
      setConfirmUnbanOpen(false);
      setSelectedBan(null);
    } catch (error) {
      console.error('Failed to unban user:', error);
    }
  };

  const formatBanDuration = (bannedAt: string, expiresAt?: string) => {
    if (!expiresAt) return 'Permanent';
    
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffTime = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Expired';
    return `${diffDays} days remaining`;
  };

  if (isLoading) {
    return <Typography>Loading ban list...</Typography>;
  }

  return (
    <>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Banned Users ({bans?.length || 0})
          </Typography>
          
          {!bans || bans.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No banned users
            </Typography>
          ) : (
            <List>
              {bans.map((ban) => (
                <ListItem
                  key={ban.id}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={() => {
                        setSelectedBan(ban);
                        setConfirmUnbanOpen(true);
                      }}
                      color="primary"
                    >
                      <UnbanIcon />
                    </IconButton>
                  }
                >
                  <ListItemAvatar>
                    <Avatar src={ban.user.avatar}>
                      {ban.user.username.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={ban.user.username}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          Banned by {ban.bannedBy.username}
                        </Typography>
                        {ban.reason && (
                          <Typography variant="caption" display="block" color="text.secondary">
                            Reason: {ban.reason}
                          </Typography>
                        )}
                        <Chip
                          label={formatBanDuration(ban.bannedAt, ban.expiresAt)}
                          size="small"
                          color={ban.expiresAt ? 'warning' : 'error'}
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Unban Confirmation Dialog */}
      <Dialog open={confirmUnbanOpen} onClose={() => setConfirmUnbanOpen(false)}>
        <DialogTitle>Unban User</DialogTitle>
        <DialogContent>
          Are you sure you want to unban {selectedBan?.user?.username}?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmUnbanOpen(false)}>Cancel</Button>
          <Button onClick={handleUnban} color="primary" disabled={unbanning}>
            {unbanning ? 'Unbanning...' : 'Unban'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
```

#### 4. Moderation API Slice

```typescript
// frontend/src/features/moderation/moderationApiSlice.ts

import { createApi } from '@reduxjs/toolkit/query/react';
import { authedBaseQuery } from '../api/baseQuery';

export const moderationApi = createApi({
  reducerPath: 'moderationApi',
  baseQuery: authedBaseQuery,
  tagTypes: ['Bans', 'ModerationLogs', 'Messages'],
  endpoints: (builder) => ({
    banUser: builder.mutation<void, {
      communityId: string;
      userId: string;
      reason?: string;
      expiresAt?: Date;
    }>({
      query: ({ communityId, userId, ...body }) => ({
        url: `/moderation/ban/${communityId}/${userId}`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Bans'],
    }),

    unbanUser: builder.mutation<void, {
      communityId: string;
      userId: string;
    }>({
      query: ({ communityId, userId }) => ({
        url: `/moderation/ban/${communityId}/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Bans'],
    }),

    kickUser: builder.mutation<void, {
      communityId: string;
      userId: string;
      reason?: string;
    }>({
      query: ({ communityId, userId, ...body }) => ({
        url: `/moderation/kick/${communityId}/${userId}`,
        method: 'POST',
        body,
      }),
    }),

    deleteMessage: builder.mutation<void, {
      messageId: string;
      reason?: string;
    }>({
      query: ({ messageId, ...body }) => ({
        url: `/moderation/delete-message/${messageId}`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Messages'],
    }),

    pinMessage: builder.mutation<void, string>({
      query: (messageId) => ({
        url: `/moderation/pin-message/${messageId}`,
        method: 'POST',
      }),
      invalidatesTags: ['Messages'],
    }),

    getBanList: builder.query<any[], string>({
      query: (communityId) => `/moderation/bans/${communityId}`,
      providesTags: ['Bans'],
    }),

    getModerationLogs: builder.query<any[], {
      communityId: string;
      limit?: number;
      offset?: number;
    }>({
      query: ({ communityId, limit = 50, offset = 0 }) => 
        `/moderation/logs/${communityId}?limit=${limit}&offset=${offset}`,
      providesTags: ['ModerationLogs'],
    }),
  }),
});

export const {
  useBanUserMutation,
  useUnbanUserMutation,
  useKickUserMutation,
  useDeleteMessageMutation,
  usePinMessageMutation,
  useGetBanListQuery,
  useGetModerationLogsQuery,
} = moderationApi;
```

## 📁 File Structure

### New Files
```
backend/src/moderation/
├── moderation.service.ts      # Core moderation business logic
├── moderation.controller.ts   # Moderation API endpoints
├── moderation.module.ts       # Module configuration
└── dto/
    ├── ban-user.dto.ts        # Ban user request DTO
    ├── kick-user.dto.ts       # Kick user request DTO
    └── delete-message.dto.ts  # Delete message request DTO

frontend/src/components/User/
├── UserContextMenu.tsx        # Right-click user moderation menu
└── UserModerationDialog.tsx   # Moderation action dialogs

frontend/src/components/Message/
└── MessageModerationActions.tsx  # Message moderation controls

frontend/src/components/Community/
├── BanListManagement.tsx      # Ban list interface
├── ModerationLogs.tsx         # Audit log display
└── ModerationSettings.tsx     # Auto-moderation settings

frontend/src/features/moderation/
├── moderationApiSlice.ts      # RTK Query API
└── types.ts                   # Moderation type definitions
```

### Modified Files
```
backend/prisma/schema.prisma          # Add ban and moderation log models
backend/src/auth/rbac/rbac-actions.enum.ts  # Add moderation actions
frontend/src/components/Message/MessageComponent.tsx  # Integrate moderation actions
frontend/src/components/Community/CommunitySettings.tsx  # Add moderation tabs
frontend/src/app/store.ts             # Add moderation API
```

## 🧪 Testing Strategy

### Unit Tests
- Moderation service methods
- Permission validation logic
- User context menu interactions
- Ban/kick dialog workflows

### Integration Tests
- End-to-end moderation actions
- Permission enforcement across roles
- Moderation log creation
- WebSocket notifications for moderation events

### Manual Testing Checklist
- [ ] Ban user removes them from community
- [ ] Kick user removes without ban record
- [ ] Unban user allows rejoin
- [ ] Message deletion soft-deletes properly
- [ ] Message pinning works correctly
- [ ] Ban list displays correctly
- [ ] Moderation logs track all actions
- [ ] Role hierarchy prevents improper actions
- [ ] Temporary bans expire correctly

## ⏱️ Implementation Timeline

**Estimated Time: 1-2 weeks**

### Week 1: Backend Foundation
- [ ] Create moderation service and database models
- [ ] Implement ban/kick/delete functionality
- [ ] Add moderation API endpoints
- [ ] Set up logging system

### Week 2: Frontend Interface
- [ ] Build user context menus
- [ ] Create moderation dialogs
- [ ] Implement ban list management
- [ ] Add message moderation controls
- [ ] Testing and polish

## 🚀 Success Metrics

- Moderation actions execute within 500ms
- Ban list updates in real-time
- Zero data loss in moderation logs
- Proper permission enforcement (100% coverage)
- Intuitive moderation workflows
- Clear audit trail for all actions

## 🔗 Dependencies

- RBAC system (existing)
- Database service (existing)
- Material-UI components (existing)
- Redux RTK Query (existing)

## 🎯 Future Enhancements

### Advanced Features
- Automated moderation rules
- Word filters and spam detection
- User warning system
- Temporary timeouts/mutes
- Moderation appeals process
- Bulk moderation actions

### Analytics & Reporting
- Moderation activity dashboards
- Community health metrics
- Moderator performance tracking
- Automated reporting tools

## 📝 Notes

- Start with core ban/kick functionality
- Focus on clear audit trails for accountability
- Implement role hierarchy carefully to prevent abuse
- Consider automated temporary ban expiration
- Add rate limiting to prevent moderation spam
- Plan for moderation bot integration later