import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { RedisService } from '@/redis/redis.service';
import { RolesService } from '@/roles/roles.service';
import { InstanceRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { SetupInstanceDto } from './dto/setup-instance.dto';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);
  private readonly SETUP_TOKEN_KEY = 'onboarding:setup-token';
  private readonly SETUP_TOKEN_TTL = 900; // 15 minutes

  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
    private readonly rolesService: RolesService,
  ) {}

  /**
   * Check if the instance needs initial setup
   * Returns true if there are no users AND no active instance invites
   */
  async needsSetup(): Promise<boolean> {
    const userCount = await this.database.user.count();

    if (userCount > 0) {
      return false;
    }

    // Also check if there are any active instance invites
    // If someone manually created invites, we shouldn't override that
    const activeInvites = await this.database.instanceInvite.count({
      where: {
        disabled: false,
      },
    });

    return activeInvites === 0;
  }

  /**
   * Get existing setup token from Redis if it exists
   */
  private async getExistingSetupToken(): Promise<string | null> {
    return this.redis.get(this.SETUP_TOKEN_KEY);
  }

  /**
   * Generate a temporary setup token for the onboarding process
   * Returns existing token if one is already present in Redis
   */
  async generateSetupToken(): Promise<string> {
    if (!(await this.needsSetup())) {
      throw new ConflictException('Instance setup is not needed');
    }

    // Check if token already exists
    const existingToken = await this.getExistingSetupToken();
    if (existingToken) {
      this.logger.log('Returning existing setup token from Redis');
      return existingToken;
    }

    // Generate new token only if none exists
    const setupToken = randomUUID();
    await this.redis.set(
      this.SETUP_TOKEN_KEY,
      setupToken,
      this.SETUP_TOKEN_TTL,
    );
    this.logger.log(
      'Generated new setup token for onboarding (stored in Redis)',
    );
    return setupToken;
  }

  /**
   * Validate the setup token
   */
  async validateSetupToken(token: string): Promise<boolean> {
    const storedToken = await this.redis.get(this.SETUP_TOKEN_KEY);
    if (!storedToken) {
      return false;
    }

    return storedToken === token;
  }

  /**
   * Complete the instance setup process
   */
  async completeSetup(
    dto: SetupInstanceDto,
    setupToken: string,
  ): Promise<{
    adminUser: any;
    defaultCommunity?: any;
  }> {
    // Validate setup token
    if (!(await this.validateSetupToken(setupToken))) {
      throw new ConflictException('Invalid setup token');
    }

    // Double-check that setup is still needed
    if (!(await this.needsSetup())) {
      throw new ConflictException('Instance setup is no longer needed');
    }

    const result = await this.database.$transaction(async (tx) => {
      // 1. Create admin user
      const hashedPassword = await bcrypt.hash(dto.adminPassword, 10);
      const adminUser = await tx.user.create({
        data: {
          username: dto.adminUsername.toLowerCase(),
          displayName: dto.adminUsername.toLowerCase(),
          email: dto.adminEmail,
          hashedPassword,
          verified: true, // First user is auto-verified
          role: InstanceRole.OWNER,
        },
      });

      this.logger.log(`Created admin user: ${adminUser.username}`);

      // 2. Create default community if requested
      let defaultCommunity: { id: string; name: string } | null = null;
      if (dto.createDefaultCommunity !== false) {
        const communityName = dto.defaultCommunityName || 'General';

        defaultCommunity = await tx.community.create({
          data: {
            name: communityName,
            description:
              dto.instanceDescription || `Welcome to ${dto.instanceName}!`,
          },
        });

        // Add admin user to the community
        await tx.membership.create({
          data: {
            userId: adminUser.id,
            communityId: defaultCommunity.id,
          },
        });

        // Create default channels
        const generalChannel = await tx.channel.create({
          data: {
            name: 'general',
            communityId: defaultCommunity.id,
            type: 'TEXT',
          },
        });

        const announcementsChannel = await tx.channel.create({
          data: {
            name: 'announcements',
            communityId: defaultCommunity.id,
            type: 'TEXT',
          },
        });

        const voiceChannel = await tx.channel.create({
          data: {
            name: 'voice-chat',
            communityId: defaultCommunity.id,
            type: 'VOICE',
          },
        });

        // Add admin to all channels
        await tx.channelMembership.createMany({
          data: [
            { userId: adminUser.id, channelId: generalChannel.id },
            { userId: adminUser.id, channelId: announcementsChannel.id },
            { userId: adminUser.id, channelId: voiceChannel.id },
          ],
        });

        // Create default roles for the community
        const adminRoleId = await this.rolesService.createDefaultCommunityRoles(
          defaultCommunity.id,
          tx,
        );

        // Assign the admin user to the Community Admin role
        await this.rolesService.assignUserToCommunityRole(
          adminUser.id,
          defaultCommunity.id,
          adminRoleId,
          tx,
        );

        this.logger.log(
          `Created default roles and assigned admin to Community Admin role`,
        );

        // Create welcome message
        await tx.message.create({
          data: {
            channelId: generalChannel.id,
            authorId: adminUser.id,
            spans: [
              {
                type: 'PLAINTEXT',
                text: `Welcome to ${dto.instanceName}! 🎉\n\nThis is your new Kraken instance. You can start by:\n• Inviting other users to join\n• Creating more communities and channels\n• Customizing your community settings\n\nEnjoy your new chat platform!`,
              },
            ],
          },
        });

        this.logger.log(
          `Created default community: ${communityName} with channels`,
        );
      }

      // 3. Create a permanent instance invite for future users
      await tx.instanceInvite.create({
        data: {
          code: `welcome-${randomUUID().slice(0, 8)}`,
          createdById: adminUser.id,
          defaultCommunityId: defaultCommunity ? [defaultCommunity.id] : [],
          maxUses: null, // Unlimited uses
          validUntil: null, // Never expires
          disabled: false,
        },
      });

      this.logger.log('Instance setup transaction completed');

      return {
        adminUser,
        defaultCommunity,
      };
    });

    // Clear the setup token from Redis after successful transaction
    await this.redis.del(this.SETUP_TOKEN_KEY);
    this.logger.log('Instance setup completed successfully, token cleared');

    // Store instance name in Redis (permanent, no TTL)
    await this.redis.set('instance:name', dto.instanceName);
    this.logger.log(`Stored instance name in Redis: ${dto.instanceName}`);

    return result;
  }

  /**
   * Get the current onboarding status
   */
  async getStatus(): Promise<{
    needsSetup: boolean;
    hasUsers: boolean;
    setupToken?: string;
  }> {
    const needsSetup = await this.needsSetup();
    const userCount = await this.database.user.count();

    const result = {
      needsSetup,
      hasUsers: userCount > 0,
    };

    // Generate setup token if needed
    if (needsSetup) {
      const setupToken = await this.generateSetupToken();
      return { ...result, setupToken };
    }

    return result;
  }
}
