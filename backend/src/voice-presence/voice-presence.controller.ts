import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { VoicePresenceService } from './voice-presence.service';
import { VoiceStateUpdateDto } from './dto/voice-state-update.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { RequiredActions } from '../auth/rbac-action.decorator';
import { RbacActions } from '@prisma/client';
import {
  RbacResource,
  RbacResourceType,
  ResourceIdSource,
} from '../auth/rbac-resource.decorator';
import { UserEntity } from '../user/dto/user-response.dto';

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
  async getChannelPresence(@Param('channelId') channelId: string) {
    const users = await this.voicePresenceService.getChannelPresence(channelId);
    return {
      channelId,
      users,
      count: users.length,
    };
  }

  @Post('join')
  @RequiredActions(RbacActions.JOIN_CHANNEL)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PARAM,
  })
  async joinVoiceChannel(
    @Param('channelId') channelId: string,
    @Req() req: { user: UserEntity },
  ) {
    await this.voicePresenceService.joinVoiceChannel(channelId, req.user);
    return {
      success: true,
      message: 'Successfully joined voice channel',
      channelId,
    };
  }

  @Delete('leave')
  @RequiredActions(RbacActions.JOIN_CHANNEL)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PARAM,
  })
  async leaveVoiceChannel(
    @Param('channelId') channelId: string,
    @Req() req: { user: UserEntity },
  ) {
    await this.voicePresenceService.leaveVoiceChannel(channelId, req.user.id);
    return {
      success: true,
      message: 'Successfully left voice channel',
      channelId,
    };
  }

  @Put('state')
  @RequiredActions(RbacActions.JOIN_CHANNEL)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PARAM,
  })
  async updateVoiceState(
    @Param('channelId') channelId: string,
    @Body() voiceStateUpdateDto: VoiceStateUpdateDto,
    @Req() req: { user: UserEntity },
  ) {
    await this.voicePresenceService.updateVoiceState(
      channelId,
      req.user.id,
      voiceStateUpdateDto,
    );
    return {
      success: true,
      message: 'Voice state updated successfully',
      channelId,
      updates: voiceStateUpdateDto,
    };
  }

  @Post('refresh')
  @RequiredActions(RbacActions.JOIN_CHANNEL)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PARAM,
  })
  async refreshPresence(
    @Param('channelId') channelId: string,
    @Req() req: { user: UserEntity },
  ) {
    await this.voicePresenceService.refreshPresence(channelId, req.user.id);
    return {
      success: true,
      message: 'Presence refreshed successfully',
      channelId,
    };
  }
}

@Controller('dm-groups/:dmGroupId/voice-presence')
@UseGuards(JwtAuthGuard)
export class DmVoicePresenceController {
  constructor(private readonly voicePresenceService: VoicePresenceService) {}

  @Get()
  async getDmPresence(@Param('dmGroupId') dmGroupId: string) {
    const users = await this.voicePresenceService.getDmPresence(dmGroupId);
    return {
      dmGroupId,
      users,
      count: users.length,
    };
  }

  @Post('join')
  async joinDmVoice(
    @Param('dmGroupId') dmGroupId: string,
    @Req() req: { user: UserEntity },
  ) {
    // Membership verification is done in the service layer
    await this.voicePresenceService.joinDmVoice(dmGroupId, req.user);
    return {
      success: true,
      message: 'Successfully joined DM voice call',
      dmGroupId,
    };
  }

  @Delete('leave')
  async leaveDmVoice(
    @Param('dmGroupId') dmGroupId: string,
    @Req() req: { user: UserEntity },
  ) {
    await this.voicePresenceService.leaveDmVoice(dmGroupId, req.user.id);
    return {
      success: true,
      message: 'Successfully left DM voice call',
      dmGroupId,
    };
  }

  @Put('state')
  async updateDmVoiceState(
    @Param('dmGroupId') dmGroupId: string,
    @Body() voiceStateUpdateDto: VoiceStateUpdateDto,
    @Req() req: { user: UserEntity },
  ) {
    await this.voicePresenceService.updateDmVoiceState(
      dmGroupId,
      req.user.id,
      voiceStateUpdateDto,
    );
    return {
      success: true,
      message: 'DM voice state updated successfully',
      dmGroupId,
      updates: voiceStateUpdateDto,
    };
  }
}

@Controller('voice-presence')
@UseGuards(JwtAuthGuard)
export class UserVoicePresenceController {
  constructor(private readonly voicePresenceService: VoicePresenceService) {}

  @Get('me')
  async getMyVoiceChannels(@Req() req: { user: UserEntity }) {
    const channels = await this.voicePresenceService.getUserVoiceChannels(
      req.user.id,
    );
    return {
      userId: req.user.id,
      voiceChannels: channels,
    };
  }
}
