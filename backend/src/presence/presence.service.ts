import { Injectable } from '@nestjs/common';
import { RedisService } from '@/redis/redis.service';
import { Cron, CronExpression } from '@nestjs/schedule';

const ONLINE_USERS_SET = 'presence:online-users';
const USER_PRESENCE_KEY_PREFIX = 'presence:user:';
const DEFAULT_TTL_SECONDS = 60; // 1 minute, can be adjusted

@Injectable()
export class PresenceService {
  constructor(private readonly redisService: RedisService) {}

  /**
   * Mark a user as online and refresh their TTL.
   */
  async setOnline(
    userId: string,
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    // Add to online set
    await this.redisService.getClient().sadd(ONLINE_USERS_SET, userId);
    // Set/refresh TTL for user
    await this.redisService.set(
      USER_PRESENCE_KEY_PREFIX + userId,
      '1',
      ttlSeconds,
    );
  }

  /**
   * Mark a user as offline immediately.
   */
  async setOffline(userId: string): Promise<void> {
    await this.redisService.getClient().srem(ONLINE_USERS_SET, userId);
    await this.redisService.del(USER_PRESENCE_KEY_PREFIX + userId);
  }

  /**
   * Check if a user is online (TTL not expired).
   */
  async isOnline(userId: string): Promise<boolean> {
    const exists = await this.redisService.get(
      USER_PRESENCE_KEY_PREFIX + userId,
    );
    return !!exists;
  }

  /**
   * Get all currently online user IDs.
   */
  async getOnlineUsers(): Promise<string[]> {
    return this.redisService.getClient().smembers(ONLINE_USERS_SET);
  }

  /**
   * Remove users from the online set whose TTL has expired.
   * Runs every minute.
   */
  @Cron(CronExpression.EVERY_MINUTE) // TODO: is this excessive?
  async cleanupExpired(): Promise<void> {
    const userIds = await this.getOnlineUsers();
    for (const userId of userIds) {
      const isOnline = await this.isOnline(userId);
      if (!isOnline) {
        await this.setOffline(userId);
      }
    }
  }
}
