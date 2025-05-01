import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { DatabaseService } from '@/database/database.service';

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);
  constructor(private readonly databaseService: DatabaseService) {}
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

  update(id: string, updateCommunityDto: UpdateCommunityDto) {
    // TODO: error handling and stuff
    return this.databaseService.community.update({
      where: { id },
      data: updateCommunityDto,
    });
  }

  async remove(id: string) {
    // TODO: do we force them to remove all users first?
    await this.databaseService.$transaction(async (tx) => {
      await tx.membership.deleteMany({ where: { communityId: id } });
      return tx.community.delete({ where: { id } });
    });
  }
}
