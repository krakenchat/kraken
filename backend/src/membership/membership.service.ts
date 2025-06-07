import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { MembershipResponseDto } from './dto/membership-response.dto';
import { DatabaseService } from '@/database/database.service';
import { CommunityService } from '@/community/community.service';
import type { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly communityService: CommunityService,
  ) {}

  async create(
    createMembershipDto: CreateMembershipDto,
  ): Promise<MembershipResponseDto> {
    const { userId, communityId } = createMembershipDto;

    try {
      // Check if community exists
      await this.databaseService.community.findUniqueOrThrow({
        where: { id: communityId },
      });

      // Check if user exists
      await this.databaseService.user.findUniqueOrThrow({
        where: { id: userId },
      });

      // Check if membership already exists
      const existingMembership =
        await this.databaseService.membership.findUnique({
          where: {
            userId_communityId: {
              userId,
              communityId,
            },
          },
        });

      if (existingMembership) {
        throw new ConflictException(
          'User is already a member of this community',
        );
      }

      const membership = await this.databaseService.membership.create({
        data: {
          userId,
          communityId,
        },
      });

      // Add user to the general channel of the community
      try {
        await this.communityService.addMemberToGeneralChannel(
          communityId,
          userId,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to add user ${userId} to general channel in community ${communityId}`,
          error,
        );
        // Don't fail the membership creation for this
      }

      return new MembershipResponseDto(membership);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error('Error creating membership', error);

      // Handle Prisma errors
      const prismaError = error as PrismaClientKnownRequestError;
      if (prismaError.code === 'P2002') {
        throw new ConflictException(
          'User is already a member of this community',
        );
      }
      if (prismaError.code === 'P2025') {
        throw new NotFoundException('User or community not found');
      }

      throw error;
    }
  }

  async findAllForCommunity(
    communityId: string,
  ): Promise<MembershipResponseDto[]> {
    try {
      const memberships = await this.databaseService.membership.findMany({
        where: { communityId },
        include: {
          user: true,
        },
      });

      return memberships.map(
        (membership) => new MembershipResponseDto(membership),
      );
    } catch (error) {
      this.logger.error(
        `Error finding memberships for community ${communityId}`,
        error,
      );
      throw error;
    }
  }

  async findAllForUser(userId: string): Promise<MembershipResponseDto[]> {
    try {
      const memberships = await this.databaseService.membership.findMany({
        where: { userId },
        include: {
          community: {
            select: {
              id: true,
              name: true,
              description: true,
              avatar: true,
            },
          },
        },
      });

      return memberships.map(
        (membership) => new MembershipResponseDto(membership),
      );
    } catch (error) {
      this.logger.error(`Error finding memberships for user ${userId}`, error);
      throw error;
    }
  }

  async findOne(
    userId: string,
    communityId: string,
  ): Promise<MembershipResponseDto> {
    try {
      const membership =
        await this.databaseService.membership.findUniqueOrThrow({
          where: {
            userId_communityId: {
              userId,
              communityId,
            },
          },
        });

      return new MembershipResponseDto(membership);
    } catch (error) {
      this.logger.error(
        `Error finding membership for user ${userId} in community ${communityId}`,
        error,
      );
      throw new NotFoundException('Membership not found');
    }
  }

  async remove(userId: string, communityId: string): Promise<void> {
    try {
      // Check if membership exists
      await this.databaseService.membership.findUniqueOrThrow({
        where: {
          userId_communityId: {
            userId,
            communityId,
          },
        },
      });

      await this.databaseService.$transaction(async (tx) => {
        // Remove user from all channels in the community
        await tx.channelMembership.deleteMany({
          where: {
            userId,
            channel: {
              communityId,
            },
          },
        });

        // Remove user roles in the community
        await tx.userRoles.deleteMany({
          where: {
            userId,
            communityId,
          },
        });

        // Remove the membership
        await tx.membership.delete({
          where: {
            userId_communityId: {
              userId,
              communityId,
            },
          },
        });
      });

      this.logger.log(`Removed user ${userId} from community ${communityId}`);
    } catch (error) {
      this.logger.error(
        `Error removing membership for user ${userId} from community ${communityId}`,
        error,
      );

      const prismaError = error as PrismaClientKnownRequestError;
      if (prismaError.code === 'P2025') {
        throw new NotFoundException('Membership not found');
      }

      throw error;
    }
  }

  // Helper method to check if user is member of community
  async isMember(userId: string, communityId: string): Promise<boolean> {
    try {
      const membership = await this.databaseService.membership.findUnique({
        where: {
          userId_communityId: {
            userId,
            communityId,
          },
        },
      });

      return !!membership;
    } catch (error) {
      this.logger.error(
        `Error checking membership for user ${userId} in community ${communityId}`,
        error,
      );
      return false;
    }
  }
}
