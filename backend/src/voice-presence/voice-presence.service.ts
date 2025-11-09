import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@/redis/redis.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { UserEntity } from '@/user/dto/user-response.dto';
import { ChannelsService } from '@/channels/channels.service';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';
import { DatabaseService } from '@/database/database.service';

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
  // Channel voice keys
  private readonly VOICE_PRESENCE_USER_DATA_PREFIX = 'voice_presence:user';
  private readonly VOICE_PRESENCE_CHANNEL_MEMBERS_PREFIX =
    'voice_presence:channel';
  private readonly VOICE_PRESENCE_USER_CHANNELS_PREFIX =
    'voice_presence:user_channels';
  // DM voice keys
  private readonly DM_VOICE_PRESENCE_USER_DATA_PREFIX =
    'dm_voice_presence:user';
  private readonly DM_VOICE_PRESENCE_MEMBERS_PREFIX = 'dm_voice_presence:dm';
  private readonly DM_VOICE_PRESENCE_USER_DMS_PREFIX =
    'dm_voice_presence:user_dms';
  private readonly VOICE_PRESENCE_TTL = 300; // 5 minutes

  constructor(
    private readonly redisService: RedisService,
    private readonly websocketService: WebsocketService,
    private readonly channelsService: ChannelsService,
    private readonly databaseService: DatabaseService,
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

      // Keys for Redis SET architecture
      const userDataKey = `${this.VOICE_PRESENCE_USER_DATA_PREFIX}:${channelId}:${user.id}`;
      const channelMembersKey = `${this.VOICE_PRESENCE_CHANNEL_MEMBERS_PREFIX}:${channelId}:members`;
      const userChannelsKey = `${this.VOICE_PRESENCE_USER_CHANNELS_PREFIX}:${user.id}`;

      const client = this.redisService.getClient();

      // Use pipeline for atomic operations
      const pipeline = client.pipeline();

      // Store user data with TTL
      pipeline.set(
        userDataKey,
        JSON.stringify(voiceUser),
        'EX',
        this.VOICE_PRESENCE_TTL,
      );

      // Add user to channel members set
      pipeline.sadd(channelMembersKey, user.id);

      // Add channel to user's channels set
      pipeline.sadd(userChannelsKey, channelId);

      await pipeline.exec();

      // Notify other users in the channel
      this.websocketService.sendToRoom(
        channelId,
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
      // Keys for Redis SET architecture
      const userDataKey = `${this.VOICE_PRESENCE_USER_DATA_PREFIX}:${channelId}:${userId}`;
      const channelMembersKey = `${this.VOICE_PRESENCE_CHANNEL_MEMBERS_PREFIX}:${channelId}:members`;
      const userChannelsKey = `${this.VOICE_PRESENCE_USER_CHANNELS_PREFIX}:${userId}`;

      // Get user info before removing
      const userDataStr = await this.redisService.get(userDataKey);
      if (!userDataStr) {
        this.logger.warn(
          `User ${userId} not found in voice channel ${channelId}`,
        );
        return;
      }

      const userData = JSON.parse(userDataStr) as VoicePresenceUser;

      const client = this.redisService.getClient();

      // Use pipeline for atomic operations
      const pipeline = client.pipeline();

      // Remove user data
      pipeline.del(userDataKey);

      // Remove user from channel members set
      pipeline.srem(channelMembersKey, userId);

      // Remove channel from user's channels set
      pipeline.srem(userChannelsKey, channelId);

      await pipeline.exec();

      // Notify other users in the channel
      this.websocketService.sendToRoom(
        channelId,
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
      const channelMembersKey = `${this.VOICE_PRESENCE_CHANNEL_MEMBERS_PREFIX}:${channelId}:members`;
      const client = this.redisService.getClient();

      // Get all user IDs in the channel (O(1) operation)
      const userIds = await client.smembers(channelMembersKey);

      if (userIds.length === 0) {
        return [];
      }

      // Build keys for user data
      const userDataKeys = userIds.map(
        (userId) =>
          `${this.VOICE_PRESENCE_USER_DATA_PREFIX}:${channelId}:${userId}`,
      );

      // Fetch all user data in one operation (O(m) where m is number of users)
      const values = await client.mget(userDataKeys);

      const users: VoicePresenceUser[] = [];

      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (value) {
          try {
            const user = JSON.parse(value) as VoicePresenceUser;
            users.push(user);
          } catch (error) {
            this.logger.warn('Failed to parse voice presence data', error);
          }
        } else {
          // User data expired but still in set - clean up
          const userId = userIds[i];
          this.logger.debug(
            `Cleaning up expired presence for user ${userId} in channel ${channelId}`,
          );
          await client.srem(channelMembersKey, userId);
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
      const userDataKey = `${this.VOICE_PRESENCE_USER_DATA_PREFIX}:${channelId}:${userId}`;
      const userDataStr = await this.redisService.get(userDataKey);

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
        userDataKey,
        JSON.stringify(updatedData),
        this.VOICE_PRESENCE_TTL,
      );

      // Notify other users of the state change
      this.websocketService.sendToRoom(
        channelId,
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
      const userDataKey = `${this.VOICE_PRESENCE_USER_DATA_PREFIX}:${channelId}:${userId}`;
      await this.redisService.expire(userDataKey, this.VOICE_PRESENCE_TTL);
    } catch (error) {
      this.logger.error(
        `Failed to refresh presence for user ${userId} in channel ${channelId}`,
        error,
      );
    }
  }

  /**
   * Clean up expired presence entries (called periodically)
   * Note: This is now less critical since getChannelPresence automatically
   * cleans up stale entries when detected.
   */
  cleanupExpiredPresence(): void {
    // With the new SET architecture, cleanup happens automatically:
    // 1. User data keys have TTL and expire naturally
    // 2. getChannelPresence() removes stale set members when detected
    // 3. This method is kept for potential future needs but is essentially a no-op
    this.logger.debug('Cleanup cron triggered (passive cleanup in use)');
  }

  /**
   * Get all channels where a user is currently in voice
   */
  async getUserVoiceChannels(userId: string): Promise<string[]> {
    try {
      const userChannelsKey = `${this.VOICE_PRESENCE_USER_CHANNELS_PREFIX}:${userId}`;
      const client = this.redisService.getClient();

      // Get all channel IDs from the user's channels set (O(1) operation)
      const channelIds = await client.smembers(userChannelsKey);

      return channelIds;
    } catch (error) {
      this.logger.error(
        `Failed to get voice channels for user ${userId}`,
        error,
      );
      return [];
    }
  }

  /**
   * Join a DM voice call (Discord-style with ringing)
   */
  async joinDmVoice(dmGroupId: string, user: UserEntity): Promise<void> {
    try {
      // Verify DM group exists and user is a member
      const dmGroup = await this.databaseService.directMessageGroup.findFirst({
        where: {
          id: dmGroupId,
          members: {
            some: {
              userId: user.id,
            },
          },
        },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!dmGroup) {
        throw new Error('DM group not found or user is not a member');
      }

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

      // Keys for Redis SET architecture (DM-specific)
      const userDataKey = `${this.DM_VOICE_PRESENCE_USER_DATA_PREFIX}:${dmGroupId}:${user.id}`;
      const dmMembersKey = `${this.DM_VOICE_PRESENCE_MEMBERS_PREFIX}:${dmGroupId}:members`;
      const userDmsKey = `${this.DM_VOICE_PRESENCE_USER_DMS_PREFIX}:${user.id}`;

      const client = this.redisService.getClient();

      // Check if this is the first user joining (for ringing logic)
      const existingMembers = await client.smembers(dmMembersKey);
      const isFirstUser = existingMembers.length === 0;

      // Use pipeline for atomic operations
      const pipeline = client.pipeline();

      // Store user data with TTL
      pipeline.set(
        userDataKey,
        JSON.stringify(voiceUser),
        'EX',
        this.VOICE_PRESENCE_TTL,
      );

      // Add user to DM members set
      pipeline.sadd(dmMembersKey, user.id);

      // Add DM to user's DMs set
      pipeline.sadd(userDmsKey, dmGroupId);

      await pipeline.exec();

      if (isFirstUser) {
        // First user joining - emit "call started" event to all DM members (ringing)
        this.websocketService.sendToRoom(
          dmGroupId,
          ServerEvents.DM_VOICE_CALL_STARTED,
          {
            dmGroupId,
            startedBy: user.id,
            starter: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
            },
          },
        );
        this.logger.log(
          `User ${user.id} started DM voice call in ${dmGroupId} (ringing other members)`,
        );
      } else {
        // Not first user - just notify that someone joined
        this.websocketService.sendToRoom(
          dmGroupId,
          ServerEvents.DM_VOICE_USER_JOINED,
          {
            dmGroupId,
            user: voiceUser,
          },
        );
        this.logger.log(`User ${user.id} joined DM voice call ${dmGroupId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to join DM voice for ${dmGroupId} by user ${user.id}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Leave a DM voice call
   */
  async leaveDmVoice(dmGroupId: string, userId: string): Promise<void> {
    try {
      // Keys for Redis SET architecture (DM-specific)
      const userDataKey = `${this.DM_VOICE_PRESENCE_USER_DATA_PREFIX}:${dmGroupId}:${userId}`;
      const dmMembersKey = `${this.DM_VOICE_PRESENCE_MEMBERS_PREFIX}:${dmGroupId}:members`;
      const userDmsKey = `${this.DM_VOICE_PRESENCE_USER_DMS_PREFIX}:${userId}`;

      // Get user info before removing
      const userDataStr = await this.redisService.get(userDataKey);
      if (!userDataStr) {
        this.logger.warn(
          `User ${userId} not found in DM voice call ${dmGroupId}`,
        );
        return;
      }

      const userData = JSON.parse(userDataStr) as VoicePresenceUser;

      const client = this.redisService.getClient();

      // Use pipeline for atomic operations
      const pipeline = client.pipeline();

      // Remove user data
      pipeline.del(userDataKey);

      // Remove user from DM members set
      pipeline.srem(dmMembersKey, userId);

      // Remove DM from user's DMs set
      pipeline.srem(userDmsKey, dmGroupId);

      await pipeline.exec();

      // Notify other users in the DM call
      this.websocketService.sendToRoom(
        dmGroupId,
        ServerEvents.DM_VOICE_USER_LEFT,
        {
          dmGroupId,
          userId,
          user: userData,
        },
      );

      this.logger.log(`User ${userId} left DM voice call ${dmGroupId}`);
    } catch (error) {
      this.logger.error(
        `Failed to leave DM voice call ${dmGroupId} for user ${userId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get all users currently in a DM voice call
   */
  async getDmPresence(dmGroupId: string): Promise<VoicePresenceUser[]> {
    try {
      const dmMembersKey = `${this.DM_VOICE_PRESENCE_MEMBERS_PREFIX}:${dmGroupId}:members`;
      const client = this.redisService.getClient();

      // Get all user IDs in the DM call (O(1) operation)
      const userIds = await client.smembers(dmMembersKey);

      if (userIds.length === 0) {
        return [];
      }

      // Build keys for user data
      const userDataKeys = userIds.map(
        (userId) =>
          `${this.DM_VOICE_PRESENCE_USER_DATA_PREFIX}:${dmGroupId}:${userId}`,
      );

      // Fetch all user data in one operation (O(m) where m is number of users)
      const values = await client.mget(userDataKeys);

      const users: VoicePresenceUser[] = [];

      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (value) {
          try {
            const user = JSON.parse(value) as VoicePresenceUser;
            users.push(user);
          } catch (error) {
            this.logger.warn('Failed to parse DM voice presence data', error);
          }
        } else {
          // User data expired but still in set - clean up
          const userId = userIds[i];
          this.logger.debug(
            `Cleaning up expired presence for user ${userId} in DM ${dmGroupId}`,
          );
          await client.srem(dmMembersKey, userId);
        }
      }

      // Sort by join time
      return users.sort(
        (a, b) =>
          new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime(),
      );
    } catch (error) {
      this.logger.error(
        `Failed to get presence for DM voice call ${dmGroupId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update user's voice state in DM call (video, screen share, etc.)
   */
  async updateDmVoiceState(
    dmGroupId: string,
    userId: string,
    updates: Partial<
      Pick<
        VoicePresenceUser,
        'isVideoEnabled' | 'isScreenSharing' | 'isMuted' | 'isDeafened'
      >
    >,
  ): Promise<void> {
    try {
      const userDataKey = `${this.DM_VOICE_PRESENCE_USER_DATA_PREFIX}:${dmGroupId}:${userId}`;
      const userDataStr = await this.redisService.get(userDataKey);

      if (!userDataStr) {
        this.logger.warn(
          `User ${userId} not found in DM voice call ${dmGroupId}`,
        );
        return;
      }

      const userData = JSON.parse(userDataStr) as VoicePresenceUser;
      const updatedData = { ...userData, ...updates };

      // Update in Redis with fresh TTL
      await this.redisService.set(
        userDataKey,
        JSON.stringify(updatedData),
        this.VOICE_PRESENCE_TTL,
      );

      // Notify other users of the state change
      this.websocketService.sendToRoom(
        dmGroupId,
        ServerEvents.DM_VOICE_USER_UPDATED,
        {
          dmGroupId,
          userId,
          user: updatedData,
          updates,
        },
      );

      this.logger.log(
        `Updated DM voice state for user ${userId} in DM ${dmGroupId}`,
        updates,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update DM voice state for user ${userId} in DM ${dmGroupId}`,
        error,
      );
      throw error;
    }
  }
}
