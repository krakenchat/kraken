import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@/redis/redis.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { UserEntity } from '@/user/dto/user-response.dto';
import { ChannelsService } from '@/channels/channels.service';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';

export interface VoicePresenceUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  joinedAt: Date;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isMuted: boolean;
  isDeafened: boolean;
}

@Injectable()
export class VoicePresenceService {
  private readonly logger = new Logger(VoicePresenceService.name);
  private readonly VOICE_PRESENCE_KEY = 'voice_presence';
  private readonly VOICE_PRESENCE_TTL = 300; // 5 minutes

  constructor(
    private readonly redisService: RedisService,
    private readonly websocketService: WebsocketService,
    private readonly channelsService: ChannelsService,
  ) {}

  /**
   * Join a voice channel
   */
  async joinVoiceChannel(channelId: string, user: UserEntity): Promise<void> {
    try {
      // Verify channel exists and user has access
      await this.channelsService.findOne(channelId);

      const voiceUser: VoicePresenceUser = {
        id: user.id,
        username: user.username,
        displayName: user.displayName ?? undefined,
        avatarUrl: user.avatarUrl ?? undefined,
        joinedAt: new Date(),
        isVideoEnabled: false,
        isScreenSharing: false,
        isMuted: false,
        isDeafened: false,
      };

      // Store in Redis with expiration
      const key = `${this.VOICE_PRESENCE_KEY}:${channelId}:${user.id}`;
      await this.redisService.set(
        key,
        JSON.stringify(voiceUser),
        this.VOICE_PRESENCE_TTL,
      );

      // Notify other users in the channel
      this.websocketService.sendToRoom(
        `channel_${channelId}`,
        ServerEvents.VOICE_CHANNEL_USER_JOINED,
        {
          channelId,
          user: voiceUser,
        },
      );

      this.logger.log(`User ${user.id} joined voice channel ${channelId}`);
    } catch (error) {
      this.logger.error(
        `Failed to join voice channel ${channelId} for user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Leave a voice channel
   */
  async leaveVoiceChannel(channelId: string, userId: string): Promise<void> {
    try {
      const key = `${this.VOICE_PRESENCE_KEY}:${channelId}:${userId}`;

      // Get user info before removing
      const userDataStr = await this.redisService.get(key);
      if (!userDataStr) {
        this.logger.warn(
          `User ${userId} not found in voice channel ${channelId}`,
        );
        return;
      }

      const userData = JSON.parse(userDataStr) as VoicePresenceUser;

      // Remove from Redis
      await this.redisService.del(key);

      // Notify other users in the channel
      this.websocketService.sendToRoom(
        `channel_${channelId}`,
        ServerEvents.VOICE_CHANNEL_USER_LEFT,
        {
          channelId,
          userId,
          user: userData,
        },
      );

      this.logger.log(`User ${userId} left voice channel ${channelId}`);
    } catch (error) {
      this.logger.error(
        `Failed to leave voice channel ${channelId} for user ${userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get all users currently in a voice channel
   */
  async getChannelPresence(channelId: string): Promise<VoicePresenceUser[]> {
    try {
      const pattern = `${this.VOICE_PRESENCE_KEY}:${channelId}:*`;
      const keys = await this.redisService.getClient().keys(pattern);

      if (keys.length === 0) {
        return [];
      }

      const users: VoicePresenceUser[] = [];
      const values = await this.redisService.getClient().mget(keys);

      for (const value of values) {
        if (value) {
          try {
            const user = JSON.parse(value) as VoicePresenceUser;
            users.push(user);
          } catch (error) {
            this.logger.warn('Failed to parse voice presence data', error);
          }
        }
      }

      // Sort by join time
      return users.sort(
        (a, b) =>
          new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime(),
      );
    } catch (error) {
      this.logger.error(
        `Failed to get presence for voice channel ${channelId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update user's voice state (video, screen share, etc.)
   */
  async updateVoiceState(
    channelId: string,
    userId: string,
    updates: Partial<
      Pick<
        VoicePresenceUser,
        'isVideoEnabled' | 'isScreenSharing' | 'isMuted' | 'isDeafened'
      >
    >,
  ): Promise<void> {
    try {
      const key = `${this.VOICE_PRESENCE_KEY}:${channelId}:${userId}`;
      const userDataStr = await this.redisService.get(key);

      if (!userDataStr) {
        this.logger.warn(
          `User ${userId} not found in voice channel ${channelId}`,
        );
        return;
      }

      const userData = JSON.parse(userDataStr) as VoicePresenceUser;
      const updatedData = { ...userData, ...updates };

      // Update in Redis with fresh TTL
      await this.redisService.set(
        key,
        JSON.stringify(updatedData),
        this.VOICE_PRESENCE_TTL,
      );

      // Notify other users of the state change
      this.websocketService.sendToRoom(
        `channel_${channelId}`,
        ServerEvents.VOICE_CHANNEL_USER_UPDATED,
        {
          channelId,
          userId,
          user: updatedData,
          updates,
        },
      );

      this.logger.log(
        `Updated voice state for user ${userId} in channel ${channelId}`,
        updates,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update voice state for user ${userId} in channel ${channelId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Refresh a user's presence in the voice channel (extend TTL)
   */
  async refreshPresence(channelId: string, userId: string): Promise<void> {
    try {
      const key = `${this.VOICE_PRESENCE_KEY}:${channelId}:${userId}`;
      await this.redisService.expire(key, this.VOICE_PRESENCE_TTL);
    } catch (error) {
      this.logger.error(
        `Failed to refresh presence for user ${userId} in channel ${channelId}`,
        error,
      );
    }
  }

  /**
   * Clean up expired presence entries (called periodically)
   */
  async cleanupExpiredPresence(): Promise<void> {
    try {
      const pattern = `${this.VOICE_PRESENCE_KEY}:*`;
      const keys = await this.redisService.getClient().keys(pattern);

      for (const key of keys) {
        const ttl = await this.redisService.getClient().ttl(key);
        if (ttl === -1) {
          // Key exists but has no expiration, remove it
          await this.redisService.del(key);
          this.logger.warn(`Removed expired voice presence key: ${key}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired presence entries', error);
    }
  }

  /**
   * Get all channels where a user is currently in voice
   */
  async getUserVoiceChannels(userId: string): Promise<string[]> {
    try {
      const pattern = `${this.VOICE_PRESENCE_KEY}:*:${userId}`;
      const keys = await this.redisService.getClient().keys(pattern);

      return keys.map((key) => {
        const parts = key.split(':');
        return parts[2]; // Extract channelId from key
      });
    } catch (error) {
      this.logger.error(
        `Failed to get voice channels for user ${userId}`,
        error,
      );
      return [];
    }
  }
}
