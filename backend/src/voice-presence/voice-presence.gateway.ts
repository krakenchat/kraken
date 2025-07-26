import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WsException,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { VoicePresenceService } from './voice-presence.service';
import { VoiceStateUpdateDto } from './dto/voice-state-update.dto';
import { Socket } from 'socket.io';
import { UserEntity } from '@/user/dto/user-response.dto';
import {
  Logger,
  UseGuards,
  UsePipes,
  ValidationPipe,
  UseFilters,
} from '@nestjs/common';
import { RbacGuard } from '@/auth/rbac.guard';
import { ClientEvents } from '@/websocket/events.enum/client-events.enum';
import { RequiredActions } from '@/auth/rbac-action.decorator';
import { RbacActions } from '@prisma/client';
import {
  RbacResource,
  RbacResourceType,
  ResourceIdSource,
} from '@/auth/rbac-resource.decorator';
import { WsLoggingExceptionFilter } from '../websocket/ws-exception.filter';
import { WsJwtAuthGuard } from '@/auth/ws-jwt-auth.guard';
import { IsString, IsNotEmpty } from 'class-validator';

class VoiceChannelEventDto {
  @IsString()
  @IsNotEmpty()
  channelId: string;
}

class VoiceStateEventDto extends VoiceChannelEventDto {}

@UseFilters(WsLoggingExceptionFilter)
@WebSocketGateway()
@UsePipes(
  new ValidationPipe({ exceptionFactory: (errors) => new WsException(errors) }),
)
@UseGuards(WsJwtAuthGuard, RbacGuard)
export class VoicePresenceGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(VoicePresenceGateway.name);

  constructor(private readonly voicePresenceService: VoicePresenceService) {}

  async handleDisconnect(client: Socket) {
    const user = (client.handshake as { user?: UserEntity }).user;
    if (!user) return;

    this.logger.log(
      `Client disconnected: ${client.id}, cleaning up voice presence`,
    );

    // Clean up user's voice presence in all channels they were in
    const voiceChannels = await this.voicePresenceService.getUserVoiceChannels(
      user.id,
    );
    for (const channelId of voiceChannels) {
      await this.voicePresenceService.leaveVoiceChannel(channelId, user.id);
    }
  }

  @SubscribeMessage(ClientEvents.VOICE_CHANNEL_JOIN)
  @RequiredActions(RbacActions.JOIN_CHANNEL)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PAYLOAD,
  })
  async handleJoinVoiceChannel(
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
    @MessageBody() data: VoiceChannelEventDto,
  ) {
    const user = client.handshake.user;
    await this.voicePresenceService.joinVoiceChannel(data.channelId, user);

    this.logger.log(
      `User ${user.id} joined voice channel ${data.channelId} via WebSocket`,
    );

    return {
      success: true,
      channelId: data.channelId,
    };
  }

  @SubscribeMessage(ClientEvents.VOICE_CHANNEL_LEAVE)
  @RequiredActions(RbacActions.JOIN_CHANNEL)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PAYLOAD,
  })
  async handleLeaveVoiceChannel(
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
    @MessageBody() data: VoiceChannelEventDto,
  ) {
    const user = client.handshake.user;
    await this.voicePresenceService.leaveVoiceChannel(data.channelId, user.id);

    this.logger.log(
      `User ${user.id} left voice channel ${data.channelId} via WebSocket`,
    );

    return {
      success: true,
      channelId: data.channelId,
    };
  }

  @SubscribeMessage(ClientEvents.VOICE_STATE_UPDATE)
  @RequiredActions(RbacActions.JOIN_CHANNEL)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PAYLOAD,
  })
  async handleVoiceStateUpdate(
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
    @MessageBody() data: VoiceStateEventDto & VoiceStateUpdateDto,
  ) {
    const user = client.handshake.user;
    const { channelId, ...updates } = data;

    await this.voicePresenceService.updateVoiceState(
      channelId,
      user.id,
      updates,
    );

    this.logger.log(
      `User ${user.id} updated voice state in channel ${channelId}`,
      updates,
    );

    return {
      success: true,
      channelId,
      updates,
    };
  }

  @SubscribeMessage(ClientEvents.VOICE_PRESENCE_REFRESH)
  @RequiredActions(RbacActions.JOIN_CHANNEL)
  @RbacResource({
    type: RbacResourceType.CHANNEL,
    idKey: 'channelId',
    source: ResourceIdSource.PAYLOAD,
  })
  async handleRefreshPresence(
    @ConnectedSocket() client: Socket & { handshake: { user: UserEntity } },
    @MessageBody() data: VoiceChannelEventDto,
  ) {
    const user = client.handshake.user;
    await this.voicePresenceService.refreshPresence(data.channelId, user.id);

    return {
      success: true,
      channelId: data.channelId,
    };
  }
}
