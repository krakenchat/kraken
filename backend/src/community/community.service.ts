import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { DatabaseService } from '@/database/database.service';
import { ChannelsService } from '@/channels/channels.service';
import { RolesService } from '@/roles/roles.service';

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly channelsService: ChannelsService,
    private readonly rolesService: RolesService,
  ) {}
  async create(createCommunityDto: CreateCommunityDto, creatorId: string) {
    try {
      return await this.databaseService.$transaction(async (tx) => {
        const community = await tx.community.create({
          data: createCommunityDto,
        });

        await tx.membership.create({
          data: {
            userId: creatorId,
            communityId: community.id,
          },
        });

        // Create default "general" channel and add creator as member
        await this.channelsService.createDefaultGeneralChannel(
          community.id,
          creatorId,
          tx,
        );

        // Create default roles for the community
        const adminRoleId = await this.rolesService.createDefaultCommunityRoles(
          community.id,
          tx,
        );

        // Assign the creator as admin of the community
        await this.rolesService.assignUserToCommunityRole(
          creatorId,
          community.id,
          adminRoleId,
          tx,
        );

        return community;
      });
    } catch (error) {
      // TODO: handle this better
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (error.code === 'P2002') {
        throw new ConflictException('Duplicate community name');
      } else {
        throw error;
      }
    }
  }

  async findAll(userId?: string) {
    if (userId) {
      const communities = await this.databaseService.membership.findMany({
        where: { userId },
        include: { community: true },
      });

      return communities.map((membership) => membership.community);
    } else {
      return this.databaseService.community.findMany();
    }
  }

  async findOne(id: string) {
    // TODO: do we want to do it by user id?
    try {
      return await this.databaseService.community.findUniqueOrThrow({
        where: { id },
      });
    } catch (error) {
      this.logger.error(error);
      throw new NotFoundException('Community not found');
    }
  }

  async update(id: string, updateCommunityDto: UpdateCommunityDto) {
    // TODO: error handling and stuff
    try {
      return await this.databaseService.$transaction(async (tx) => {
        // Get the current community to check for old files
        const currentCommunity = await tx.community.findUniqueOrThrow({
          where: { id },
        });

        // Mark old avatar for deletion if being replaced
        if (
          updateCommunityDto.avatar &&
          currentCommunity.avatar &&
          updateCommunityDto.avatar !== currentCommunity.avatar
        ) {
          await tx.file.update({
            where: { id: currentCommunity.avatar },
            data: { deletedAt: new Date() },
          });
        }

        // Mark old banner for deletion if being replaced
        if (
          updateCommunityDto.banner &&
          currentCommunity.banner &&
          updateCommunityDto.banner !== currentCommunity.banner
        ) {
          await tx.file.update({
            where: { id: currentCommunity.banner },
            data: { deletedAt: new Date() },
          });
        }

        // Update the community
        return await tx.community.update({
          where: { id },
          data: updateCommunityDto,
        });
      });
    } catch (error) {
      this.logger.error(error);
      throw new NotFoundException('Community not found');
    }
  }

  async addMemberToGeneralChannel(communityId: string, userId: string) {
    try {
      await this.channelsService.addUserToGeneralChannel(communityId, userId);
    } catch (error) {
      this.logger.error(
        `Failed to add user ${userId} to general channel in community ${communityId}`,
        error,
      );
      // Don't throw error to avoid breaking membership creation
    }
  }

  async remove(id: string) {
    // TODO: do we force them to remove all users first?
    try {
      await this.databaseService.$transaction(async (tx) => {
        await tx.membership.deleteMany({ where: { communityId: id } });
        return tx.community.delete({ where: { id } });
      });
    } catch (error) {
      this.logger.error(error);
      throw new NotFoundException('Community not found');
    }
  }
}
