import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { PresenceService } from './presence.service';
import {
  UserPresenceResponseDto,
  BulkPresenceResponseDto,
} from './dto/presence-response.dto';

@Controller('presence')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Get('user/:userId')
  @ApiOkResponse({ type: UserPresenceResponseDto })
  async getUserPresence(
    @Param('userId') userId: string,
  ): Promise<UserPresenceResponseDto> {
    const isOnline = await this.presenceService.isOnline(userId);
    return {
      userId,
      isOnline,
    };
  }

  @Get('users/bulk')
  @ApiOkResponse({ type: BulkPresenceResponseDto })
  async getBulkPresence(): Promise<BulkPresenceResponseDto> {
    const onlineUsers = await this.presenceService.getOnlineUsers();
    const presence: Record<string, boolean> = {};

    // Mark all online users as true
    for (const userId of onlineUsers) {
      presence[userId] = true;
    }

    return { presence };
  }

  @Get('users/:userIds')
  @ApiOkResponse({ type: BulkPresenceResponseDto })
  async getMultipleUserPresence(
    @Param('userIds') userIds: string,
  ): Promise<BulkPresenceResponseDto> {
    const userIdArray = userIds.split(',');
    const presence: Record<string, boolean> = {};

    for (const userId of userIdArray) {
      const isOnline = await this.presenceService.isOnline(userId);
      presence[userId] = isOnline;
    }

    return { presence };
  }
}
