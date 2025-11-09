/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { CommunityService } from './community.service';
import { DatabaseService } from '@/database/database.service';
import { ChannelsService } from '@/channels/channels.service';
import { RolesService } from '@/roles/roles.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  createMockDatabase,
  UserFactory,
  CommunityFactory,
} from '@/test-utils';

describe('CommunityService', () => {
  let service: CommunityService;
  let mockDatabase: ReturnType<typeof createMockDatabase>;
  let channelsService: ChannelsService;
  let rolesService: RolesService;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        {
          provide: DatabaseService,
          useValue: mockDatabase,
        },
        {
          provide: ChannelsService,
          useValue: {
            createDefaultGeneralChannel: jest.fn(),
            addUserToGeneralChannel: jest.fn(),
          },
        },
        {
          provide: RolesService,
          useValue: {
            createDefaultCommunityRoles: jest.fn(),
            assignUserToCommunityRole: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CommunityService>(CommunityService);
    channelsService = module.get<ChannelsService>(ChannelsService);
    rolesService = module.get<RolesService>(RolesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a community with all default setup', async () => {
      const user = UserFactory.build();

      const createDto = {
        name: 'Test Community',
        description: 'A test community',
        avatar: null,
        banner: null,
      } as any;
      const community = CommunityFactory.build();

      mockDatabase.community.create.mockResolvedValue(community);
      mockDatabase.membership.create.mockResolvedValue({
        userId: user.id,
        communityId: community.id,
      });
      jest
        .spyOn(channelsService, 'createDefaultGeneralChannel')
        .mockResolvedValue({
          id: 'channel-123',
          name: 'general',
          communityId: community.id,
          type: 'TEXT',
          isPrivate: false,
          createdAt: new Date(),
        } as any);
      jest
        .spyOn(rolesService, 'createDefaultCommunityRoles')
        .mockResolvedValue('admin-role-id');
      jest
        .spyOn(rolesService, 'assignUserToCommunityRole')
        .mockResolvedValue(undefined);

      const result = await service.create(createDto, user.id);

      expect(result).toEqual(community);

      expect(mockDatabase.community.create).toHaveBeenCalledWith({
        data: createDto,
      });
      expect(mockDatabase.membership.create).toHaveBeenCalledWith({
        data: {
          userId: user.id,
          communityId: community.id,
        },
      });
      expect(channelsService.createDefaultGeneralChannel).toHaveBeenCalledWith(
        community.id,
        user.id,
        mockDatabase,
      );
      expect(rolesService.createDefaultCommunityRoles).toHaveBeenCalledWith(
        community.id,
        mockDatabase,
      );
      expect(rolesService.assignUserToCommunityRole).toHaveBeenCalledWith(
        user.id,
        community.id,
        'admin-role-id',
        mockDatabase,
      );
    });

    it('should throw ConflictException for duplicate community name', async () => {
      const user = UserFactory.build();
      const createDto = {
        name: 'Duplicate Community',
        description: null,
        avatar: null,
        banner: null,
      } as any;

      const duplicateError = { code: 'P2002' };
      mockDatabase.community.create.mockRejectedValue(duplicateError);

      await expect(service.create(createDto, user.id)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto, user.id)).rejects.toThrow(
        'Duplicate community name',
      );
    });

    it('should rethrow non-P2002 errors', async () => {
      const user = UserFactory.build();
      const createDto = {
        name: 'Test Community',
        description: null,
        avatar: null,
        banner: null,
      } as any;

      mockDatabase.community.create.mockRejectedValue(
        new Error('DB connection error'),
      );

      await expect(service.create(createDto, user.id)).rejects.toThrow(
        'DB connection error',
      );
    });

    it('should handle transaction rollback on failure', async () => {
      const user = UserFactory.build();
      const createDto = {
        name: 'Test Community',
        description: null,
        avatar: null,
        banner: null,
      } as any;
      const community = CommunityFactory.build();

      mockDatabase.community.create.mockResolvedValue(community);
      mockDatabase.membership.create.mockResolvedValue({
        userId: user.id,
        communityId: community.id,
      });
      jest
        .spyOn(channelsService, 'createDefaultGeneralChannel')
        .mockRejectedValue(new Error('Channel creation failed'));

      await expect(service.create(createDto, user.id)).rejects.toThrow(
        'Channel creation failed',
      );
    });
  });

  describe('findAll', () => {
    it('should return all communities for a specific user', async () => {
      const user = UserFactory.build();
      const community1 = CommunityFactory.build();
      const community2 = CommunityFactory.build();

      const memberships = [
        { userId: user.id, communityId: community1.id, community: community1 },
        { userId: user.id, communityId: community2.id, community: community2 },
      ];

      mockDatabase.membership.findMany.mockResolvedValue(memberships);

      const result = await service.findAll(user.id);

      expect(result).toEqual([community1, community2]);
      expect(mockDatabase.membership.findMany).toHaveBeenCalledWith({
        where: { userId: user.id },
        include: { community: true },
      });
    });

    it('should return empty array when user has no communities', async () => {
      const user = UserFactory.build();
      mockDatabase.membership.findMany.mockResolvedValue([]);

      const result = await service.findAll(user.id);

      expect(result).toEqual([]);
    });

    it('should return all communities when no userId is provided', async () => {
      const communities = [CommunityFactory.build(), CommunityFactory.build()];
      mockDatabase.community.findMany.mockResolvedValue(communities);

      const result = await service.findAll();

      expect(result).toEqual(communities);
      expect(mockDatabase.community.findMany).toHaveBeenCalledWith();
      expect(mockDatabase.membership.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a community by ID', async () => {
      const community = CommunityFactory.build();
      mockDatabase.community.findUniqueOrThrow.mockResolvedValue(community);

      const result = await service.findOne(community.id);

      expect(result).toEqual(community);
      expect(mockDatabase.community.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: community.id },
      });
    });

    it('should throw NotFoundException when community not found', async () => {
      mockDatabase.community.findUniqueOrThrow.mockRejectedValue(
        new Error('Not found'),
      );

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Community not found',
      );
    });
  });

  describe('update', () => {
    it('should update community basic fields', async () => {
      const community = CommunityFactory.build();
      const updateDto = {
        name: 'Updated Name',
        description: 'Updated description',
      };
      const updatedCommunity = { ...community, ...updateDto };

      mockDatabase.community.findUniqueOrThrow.mockResolvedValue(community);
      mockDatabase.community.update.mockResolvedValue(updatedCommunity);

      const result = await service.update(community.id, updateDto);

      expect(result).toEqual(updatedCommunity);
      expect(mockDatabase.community.update).toHaveBeenCalledWith({
        where: { id: community.id },
        data: updateDto,
      });
    });

    it('should mark old avatar for deletion when replaced', async () => {
      const oldAvatarId = 'old-avatar-file-id';
      const newAvatarId = 'new-avatar-file-id';
      const community = CommunityFactory.build({ avatar: oldAvatarId });
      const updateDto = { avatar: newAvatarId };

      mockDatabase.community.findUniqueOrThrow.mockResolvedValue(community);
      mockDatabase.file.update.mockResolvedValue({ id: oldAvatarId });
      mockDatabase.community.update.mockResolvedValue({
        ...community,
        avatar: newAvatarId,
      });

      await service.update(community.id, updateDto);

      expect(mockDatabase.file.update).toHaveBeenCalledWith({
        where: { id: oldAvatarId },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should mark old banner for deletion when replaced', async () => {
      const oldBannerId = 'old-banner-file-id';
      const newBannerId = 'new-banner-file-id';
      const community = CommunityFactory.build({ banner: oldBannerId });
      const updateDto = { banner: newBannerId };

      mockDatabase.community.findUniqueOrThrow.mockResolvedValue(community);
      mockDatabase.file.update.mockResolvedValue({ id: oldBannerId });
      mockDatabase.community.update.mockResolvedValue({
        ...community,
        banner: newBannerId,
      });

      await service.update(community.id, updateDto);

      expect(mockDatabase.file.update).toHaveBeenCalledWith({
        where: { id: oldBannerId },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should not mark files for deletion when updating to same value', async () => {
      const avatarId = 'same-avatar-id';
      const community = CommunityFactory.build({ avatar: avatarId });
      const updateDto = { avatar: avatarId, name: 'New Name' };

      mockDatabase.community.findUniqueOrThrow.mockResolvedValue(community);
      mockDatabase.community.update.mockResolvedValue({
        ...community,
        ...updateDto,
      });

      await service.update(community.id, updateDto);

      expect(mockDatabase.file.update).not.toHaveBeenCalled();
    });

    it('should not mark files for deletion when community has no old files', async () => {
      const community = CommunityFactory.build({ avatar: null, banner: null });
      const updateDto = { avatar: 'new-avatar-id', banner: 'new-banner-id' };

      mockDatabase.community.findUniqueOrThrow.mockResolvedValue(community);
      mockDatabase.community.update.mockResolvedValue({
        ...community,
        ...updateDto,
      });

      await service.update(community.id, updateDto);

      expect(mockDatabase.file.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when community not found', async () => {
      const updateDto = { name: 'Updated Name' };
      mockDatabase.community.findUniqueOrThrow.mockRejectedValue(
        new Error('Not found'),
      );

      await expect(service.update('nonexistent', updateDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update('nonexistent', updateDto)).rejects.toThrow(
        'Community not found',
      );
    });

    it('should handle both avatar and banner replacement in one update', async () => {
      const oldAvatarId = 'old-avatar';
      const oldBannerId = 'old-banner';
      const newAvatarId = 'new-avatar';
      const newBannerId = 'new-banner';
      const community = CommunityFactory.build({
        avatar: oldAvatarId,
        banner: oldBannerId,
      });
      const updateDto = { avatar: newAvatarId, banner: newBannerId };

      mockDatabase.community.findUniqueOrThrow.mockResolvedValue(community);
      mockDatabase.file.update.mockResolvedValue({});
      mockDatabase.community.update.mockResolvedValue({
        ...community,
        ...updateDto,
      });

      await service.update(community.id, updateDto);

      expect(mockDatabase.file.update).toHaveBeenCalledTimes(2);
      expect(mockDatabase.file.update).toHaveBeenCalledWith({
        where: { id: oldAvatarId },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockDatabase.file.update).toHaveBeenCalledWith({
        where: { id: oldBannerId },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('addMemberToGeneralChannel', () => {
    it('should add user to general channel', async () => {
      const communityId = 'community-123';
      const userId = 'user-456';

      jest
        .spyOn(channelsService, 'addUserToGeneralChannel')
        .mockResolvedValue(undefined);

      await service.addMemberToGeneralChannel(communityId, userId);

      expect(channelsService.addUserToGeneralChannel).toHaveBeenCalledWith(
        communityId,
        userId,
      );
    });

    it('should swallow errors to avoid breaking membership creation', async () => {
      const communityId = 'community-123';
      const userId = 'user-456';

      jest
        .spyOn(channelsService, 'addUserToGeneralChannel')
        .mockRejectedValue(new Error('Channel not found'));

      // Should not throw
      await expect(
        service.addMemberToGeneralChannel(communityId, userId),
      ).resolves.toBeUndefined();
    });
  });

  describe('remove', () => {
    it('should delete community and all memberships', async () => {
      const communityId = 'community-123';

      mockDatabase.membership.deleteMany.mockResolvedValue({ count: 5 });
      mockDatabase.community.delete.mockResolvedValue({ id: communityId });

      await service.remove(communityId);

      expect(mockDatabase.membership.deleteMany).toHaveBeenCalledWith({
        where: { communityId },
      });
      expect(mockDatabase.community.delete).toHaveBeenCalledWith({
        where: { id: communityId },
      });
    });

    it('should throw NotFoundException when community not found', async () => {
      const communityId = 'nonexistent';

      mockDatabase.membership.deleteMany.mockResolvedValue({ count: 0 });
      mockDatabase.community.delete.mockRejectedValue(new Error('Not found'));

      await expect(service.remove(communityId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove(communityId)).rejects.toThrow(
        'Community not found',
      );
    });

    it('should delete community even if no memberships exist', async () => {
      const communityId = 'community-123';

      mockDatabase.membership.deleteMany.mockResolvedValue({ count: 0 });
      mockDatabase.community.delete.mockResolvedValue({ id: communityId });

      await expect(service.remove(communityId)).resolves.toBeUndefined();
      expect(mockDatabase.community.delete).toHaveBeenCalled();
    });
  });
});
