import { Injectable } from '@nestjs/common';
import { RedisService } from '@/redis/redis.service';
import { Cron, CronExpression } from '@nestjs/schedule';

const ONLINE_USERS_SET = 'presence:online-users';
const USER_PRESENCE_KEY_PREFIX = 'presence:user:';
const USER_CONNECTIONS_KEY_PREFIX = 'presence:connections:';
const DEFAULT_TTL_SECONDS = 60; // 1 minute, can be adjusted

@Injectable()
export class PresenceService {
  constructor(private readonly redisService: RedisService) {}

  /**
   * Register a new connection for a user.
   * Returns true if this is the user's first connection (went from offline to online).
   */
  async addConnection(
    userId: string,
    connectionId: string,
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): Promise<boolean> {
    const client = this.redisService.getClient();
    const connectionsKey = USER_CONNECTIONS_KEY_PREFIX + userId;

    // Add connection to user's connections set
    await client.sadd(connectionsKey, connectionId);

    // Set TTL on the connections set
    await client.expire(connectionsKey, ttlSeconds);

    // Get connection count
    const connectionCount = await client.scard(connectionsKey);

    // If this is the first connection, mark user as online
    if (connectionCount === 1) {
      await client.sadd(ONLINE_USERS_SET, userId);
      await this.redisService.set(
        USER_PRESENCE_KEY_PREFIX + userId,
        '1',
        ttlSeconds,
      );
      return true; // User went from offline to online
    }

    // Refresh user presence TTL
    await this.redisService.set(
      USER_PRESENCE_KEY_PREFIX + userId,
      '1',
      ttlSeconds,
    );
    return false; // User was already online
  }

  /**
   * Remove a connection for a user.
   * Returns true if this was the user's last connection (went from online to offline).
   */
  async removeConnection(
    userId: string,
    connectionId: string,
  ): Promise<boolean> {
    const client = this.redisService.getClient();
    const connectionsKey = USER_CONNECTIONS_KEY_PREFIX + userId;

    // Remove connection from user's connections set
    await client.srem(connectionsKey, connectionId);

    // Get remaining connection count
    const connectionCount = await client.scard(connectionsKey);

    // If no connections remain, mark user as offline
    if (connectionCount === 0) {
      await client.srem(ONLINE_USERS_SET, userId);
      await this.redisService.del(USER_PRESENCE_KEY_PREFIX + userId);
      await this.redisService.del(connectionsKey);
      return true; // User went from online to offline
    }

    return false; // User still has other connections
  }

  /**
   * Refresh all connections for a user (extend TTL).
   */
  async refreshPresence(
    userId: string,
    ttlSeconds: number = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    const client = this.redisService.getClient();
    const connectionsKey = USER_CONNECTIONS_KEY_PREFIX + userId;

    // Refresh TTL on connections set
    await client.expire(connectionsKey, ttlSeconds);

    // Refresh user presence TTL
    await this.redisService.set(
      USER_PRESENCE_KEY_PREFIX + userId,
      '1',
      ttlSeconds,
    );
  }

  /**
   * Mark a user as online and refresh their TTL.
   * @deprecated Use addConnection instead for proper multi-connection tracking
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
   * @deprecated Use removeConnection instead for proper multi-connection tracking
   */
  async setOffline(userId: string): Promise<void> {
    const client = this.redisService.getClient();
    await client.srem(ONLINE_USERS_SET, userId);
    await this.redisService.del(USER_PRESENCE_KEY_PREFIX + userId);
    await this.redisService.del(USER_CONNECTIONS_KEY_PREFIX + userId);
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
   * Note: With connection tracking, this is less critical as cleanup happens
   * automatically when connections are removed.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupExpired(): Promise<void> {
    const client = this.redisService.getClient();
    const userIds = await this.getOnlineUsers();

    for (const userId of userIds) {
      // Check if user's presence key still exists
      const presenceExists = await this.redisService.get(
        USER_PRESENCE_KEY_PREFIX + userId,
      );

      if (!presenceExists) {
        // Presence expired but user is still in set - clean up
        await client.srem(ONLINE_USERS_SET, userId);
        await this.redisService.del(USER_CONNECTIONS_KEY_PREFIX + userId);
      }
    }
  }
}
