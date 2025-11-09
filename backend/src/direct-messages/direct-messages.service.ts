import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { CreateDmGroupDto } from './dto/create-dm-group.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { DmGroupResponseDto } from './dto/dm-group-response.dto';

@Injectable()
export class DirectMessagesService {
  private readonly logger = new Logger(DirectMessagesService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async findUserDmGroups(userId: string): Promise<DmGroupResponseDto[]> {
    try {
      const memberships =
        await this.databaseService.directMessageGroupMember.findMany({
          where: { userId },
          include: {
            group: {
              include: {
                members: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatarUrl: true,
                      },
                    },
                  },
                },
                messages: {
                  take: 1,
                  orderBy: { sentAt: 'desc' },
                  select: {
                    id: true,
                    authorId: true,
                    spans: true,
                    sentAt: true,
                  },
                },
              },
            },
          },
          orderBy: {
            group: {
              createdAt: 'desc',
            },
          },
        });

      return memberships.map((membership) => ({
        id: membership.group.id,
        name: membership.group.name,
        isGroup: membership.group.isGroup,
        createdAt: membership.group.createdAt,
        members: membership.group.members,
        lastMessage: membership.group.messages[0] || null,
      }));
    } catch (error) {
      this.logger.error('Error finding user DM groups', error);
      throw error;
    }
  }

  async createDmGroup(
    createDmGroupDto: CreateDmGroupDto,
    creatorId: string,
  ): Promise<DmGroupResponseDto> {
    try {
      // Include the creator in the user list if not already present
      const allUserIds = Array.from(
        new Set([creatorId, ...createDmGroupDto.userIds]),
      );

      // Determine if it's a group (more than 2 users) or 1:1 DM
      const isGroup = createDmGroupDto.isGroup ?? allUserIds.length > 2;

      // For 1:1 DMs, check if one already exists
      if (!isGroup && allUserIds.length === 2) {
        const existingDm = await this.findExisting1on1Dm(
          allUserIds[0],
          allUserIds[1],
        );
        if (existingDm) {
          return this.formatDmGroupResponse(existingDm);
        }
      }

      // Create the DM group
      const dmGroup = await this.databaseService.directMessageGroup.create({
        data: {
          name: createDmGroupDto.name,
          isGroup,
          members: {
            create: allUserIds.map((userId) => ({
              userId,
            })),
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          messages: {
            take: 1,
            orderBy: { sentAt: 'desc' },
            select: {
              id: true,
              authorId: true,
              spans: true,
              sentAt: true,
            },
          },
        },
      });

      return this.formatDmGroupResponse(dmGroup);
    } catch (error) {
      this.logger.error('Error creating DM group', error);
      throw error;
    }
  }

  async findDmGroup(
    groupId: string,
    userId: string,
  ): Promise<DmGroupResponseDto> {
    try {
      // Verify user is a member of this DM group
      const membership =
        await this.databaseService.directMessageGroupMember.findFirst({
          where: {
            groupId,
            userId,
          },
        });

      if (!membership) {
        throw new ForbiddenException('You are not a member of this DM group');
      }

      const dmGroup =
        await this.databaseService.directMessageGroup.findUniqueOrThrow({
          where: { id: groupId },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            messages: {
              take: 1,
              orderBy: { sentAt: 'desc' },
              select: {
                id: true,
                authorId: true,
                spans: true,
                sentAt: true,
              },
            },
          },
        });

      return this.formatDmGroupResponse(dmGroup);
    } catch (error) {
      this.logger.error('Error finding DM group', error);
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new NotFoundException('DM group not found');
    }
  }

  async addMembers(
    groupId: string,
    addMembersDto: AddMembersDto,
    userId: string,
  ): Promise<DmGroupResponseDto> {
    try {
      // Verify user is a member and the group is a group chat (not 1:1 DM)
      const dmGroup = await this.databaseService.directMessageGroup.findFirst({
        where: { id: groupId },
        include: {
          members: {
            where: { userId },
          },
        },
      });

      if (!dmGroup || dmGroup.members.length === 0) {
        throw new ForbiddenException('You are not a member of this DM group');
      }

      if (!dmGroup.isGroup) {
        throw new ForbiddenException('Cannot add members to a 1:1 DM');
      }

      // Add new members (check for duplicates manually to avoid errors)
      for (const newUserId of addMembersDto.userIds) {
        try {
          await this.databaseService.directMessageGroupMember.create({
            data: {
              groupId,
              userId: newUserId,
            },
          });
        } catch {
          // Ignore duplicate member errors
          this.logger.warn(
            `User ${newUserId} is already a member of group ${groupId}`,
          );
        }
      }

      return await this.findDmGroup(groupId, userId);
    } catch (error) {
      this.logger.error('Error adding members to DM group', error);
      throw error;
    }
  }

  async leaveDmGroup(groupId: string, userId: string): Promise<void> {
    try {
      await this.databaseService.directMessageGroupMember.delete({
        where: {
          groupId_userId: {
            groupId,
            userId,
          },
        },
      });
    } catch (error) {
      this.logger.error('Error leaving DM group', error);
      throw error;
    }
  }

  private async findExisting1on1Dm(userId1: string, userId2: string) {
    return this.databaseService.directMessageGroup.findFirst({
      where: {
        isGroup: false,
        members: {
          every: {
            userId: { in: [userId1, userId2] },
          },
        },
        // Ensure we have exactly 2 members
        AND: {
          members: {
            none: {
              userId: { notIn: [userId1, userId2] },
            },
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { sentAt: 'desc' },
          select: {
            id: true,
            authorId: true,
            spans: true,
            sentAt: true,
          },
        },
      },
    });
  }

  private formatDmGroupResponse(dmGroup: {
    id: string;
    name: string | null;
    isGroup: boolean;
    createdAt: Date;
    members: {
      id: string;
      userId: string;
      joinedAt: Date;
      user: {
        id: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
      };
    }[];
    messages: {
      id: string;
      authorId: string;
      spans: any[];
      sentAt: Date;
    }[];
  }): DmGroupResponseDto {
    return {
      id: dmGroup.id,
      name: dmGroup.name,
      isGroup: dmGroup.isGroup,
      createdAt: dmGroup.createdAt,
      members: dmGroup.members,
      lastMessage: dmGroup.messages[0] || null,
    };
  }
}
