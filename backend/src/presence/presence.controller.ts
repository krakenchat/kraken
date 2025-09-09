import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { PresenceService } from './presence.service';

interface UserPresenceResponse {
  userId: string;
  isOnline: boolean;
}

interface BulkPresenceResponse {
  presence: Record<string, boolean>;
}

@Controller('presence')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Get('user/:userId')
  async getUserPresence(
    @Param('userId') userId: string,
  ): Promise<UserPresenceResponse> {
    const isOnline = await this.presenceService.isOnline(userId);
    return {
      userId,
      isOnline,
    };
  }

  @Get('users/bulk')
  async getBulkPresence(): Promise<BulkPresenceResponse> {
    const onlineUsers = await this.presenceService.getOnlineUsers();
    const presence: Record<string, boolean> = {};

    // Mark all online users as true
    for (const userId of onlineUsers) {
      presence[userId] = true;
    }

    return { presence };
  }

  @Get('users/:userIds')
  async getMultipleUserPresence(
    @Param('userIds') userIds: string,
  ): Promise<BulkPresenceResponse> {
    const userIdArray = userIds.split(',');
    const presence: Record<string, boolean> = {};

    for (const userId of userIdArray) {
      const isOnline = await this.presenceService.isOnline(userId);
      presence[userId] = isOnline;
    }

    return { presence };
  }
}
