import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { VoicePresenceService } from './voice-presence.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequiredActions } from '../auth/rbac-action.decorator';
import { RbacActions } from '@prisma/client';
import {
  RbacResource,
  RbacResourceType,
  ResourceIdSource,
} from '../auth/rbac-resource.decorator';
import { AuthenticatedRequest } from '@/types';
import {
  ChannelVoicePresenceResponseDto,
  DmVoicePresenceResponseDto,
  RefreshPresenceResponseDto,
  RefreshDmPresenceResponseDto,
  UserVoiceChannelsResponseDto,
} from './dto/voice-presence-response.dto';

@Controller('channels/:channelId/voice-presence')
@UseGuards(JwtAuthGuard, RbacGuard)
export class VoicePresenceController {
  constructor(private readonly voicePresenceService: VoicePresenceService) {}

  @Get()
  @RequiredActions(RbacActions.READ_CHANNEL)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PARAM,
  })
  @ApiOkResponse({ type: ChannelVoicePresenceResponseDto })
  async getChannelPresence(
    @Param('channelId') channelId: string,
  ): Promise<ChannelVoicePresenceResponseDto> {
    const users = await this.voicePresenceService.getChannelPresence(channelId);
    return {
      channelId,
      users,
      count: users.length,
    };
  }

  @Post('refresh')
  @RequiredActions(RbacActions.JOIN_CHANNEL)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PARAM,
  })
  @ApiCreatedResponse({ type: RefreshPresenceResponseDto })
  async refreshPresence(
    @Param('channelId') channelId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<RefreshPresenceResponseDto> {
    await this.voicePresenceService.refreshPresence(channelId, req.user.id);
    return {
      success: true,
      message: 'Presence refreshed successfully',
      channelId,
    };
  }

  @Post('join')
  @RequiredActions(RbacActions.JOIN_CHANNEL)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PARAM,
  })
  @ApiCreatedResponse({ type: RefreshPresenceResponseDto })
  async joinPresence(
    @Param('channelId') channelId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<RefreshPresenceResponseDto> {
    await this.voicePresenceService.joinVoiceChannelDirect(
      channelId,
      req.user.id,
    );
    return {
      success: true,
      message: 'Voice presence registered',
      channelId,
    };
  }

  @Post('leave')
  @RequiredActions(RbacActions.JOIN_CHANNEL)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PARAM,
  })
  @ApiCreatedResponse({ type: RefreshPresenceResponseDto })
  async leavePresence(
    @Param('channelId') channelId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<RefreshPresenceResponseDto> {
    await this.voicePresenceService.leaveVoiceChannel(channelId, req.user.id);
    return {
      success: true,
      message: 'Voice presence removed',
      channelId,
    };
  }
}

@Controller('dm-groups/:dmGroupId/voice-presence')
@UseGuards(JwtAuthGuard)
export class DmVoicePresenceController {
  constructor(private readonly voicePresenceService: VoicePresenceService) {}

  @Get()
  @ApiOkResponse({ type: DmVoicePresenceResponseDto })
  async getDmPresence(
    @Param('dmGroupId') dmGroupId: string,
  ): Promise<DmVoicePresenceResponseDto> {
    const users = await this.voicePresenceService.getDmPresence(dmGroupId);
    return {
      dmGroupId,
      users,
      count: users.length,
    };
  }

  @Post('refresh')
  @ApiCreatedResponse({ type: RefreshDmPresenceResponseDto })
  async refreshDmPresence(
    @Param('dmGroupId') dmGroupId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<RefreshDmPresenceResponseDto> {
    await this.voicePresenceService.refreshDmPresence(
      dmGroupId,
      req.user.id,
    );
    return {
      success: true,
      message: 'DM presence refreshed successfully',
      dmGroupId,
    };
  }
}

@Controller('voice-presence')
@UseGuards(JwtAuthGuard)
export class UserVoicePresenceController {
  constructor(private readonly voicePresenceService: VoicePresenceService) {}

  @Get('me')
  @ApiOkResponse({ type: UserVoiceChannelsResponseDto })
  async getMyVoiceChannels(
    @Req() req: AuthenticatedRequest,
  ): Promise<UserVoiceChannelsResponseDto> {
    const channels = await this.voicePresenceService.getUserVoiceChannels(
      req.user.id,
    );
    return {
      userId: req.user.id,
      voiceChannels: channels,
    };
  }
}
