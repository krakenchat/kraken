import { Test, TestingModule } from '@nestjs/testing';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { UserFactory, MembershipFactory } from '@/test-utils';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { ForbiddenException } from '@nestjs/common';

describe('MembershipController', () => {
  let controller: MembershipController;
  let service: MembershipService;

  const mockMembershipService = {
    create: jest.fn(),
    findAllForCommunity: jest.fn(),
    findAllForUser: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    searchMembers: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  const mockUser = UserFactory.build();
  const mockRequest = {
    user: { id: mockUser.id },
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MembershipController],
      providers: [
        {
          provide: MembershipService,
          useValue: mockMembershipService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<MembershipController>(MembershipController);
    service = module.get<MembershipService>(MembershipService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a membership', async () => {
      const createDto: CreateMembershipDto = {
        userId: 'user-123',
        communityId: 'community-123',
      };

      const mockMembership = MembershipFactory.build({
        userId: 'user-123',
        communityId: 'community-123',
      });

      jest.spyOn(service, 'create').mockResolvedValue(mockMembership as any);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockMembership);
    });
  });

  describe('findAllForCommunity', () => {
    it('should return all members of a community', async () => {
      const communityId = 'community-123';
      const mockMemberships = [
        MembershipFactory.build({ communityId }),
        MembershipFactory.build({ communityId }),
      ];

      jest
        .spyOn(service, 'findAllForCommunity')
        .mockResolvedValue(mockMemberships as any);

      const result = await controller.findAllForCommunity(communityId);

      expect(service.findAllForCommunity).toHaveBeenCalledWith(communityId);
      expect(result).toEqual(mockMemberships);
    });
  });

  describe('searchCommunityMembers', () => {
    it('should search community members with default limit', async () => {
      const communityId = 'community-123';
      const query = 'john';
      const mockResults = [MembershipFactory.build()];

      jest
        .spyOn(service, 'searchMembers')
        .mockResolvedValue(mockResults as any);

      const result = await controller.searchCommunityMembers(
        communityId,
        query,
      );

      expect(service.searchMembers).toHaveBeenCalledWith(
        communityId,
        query,
        10,
      );
      expect(result).toEqual(mockResults);
    });

    it('should search with custom limit', async () => {
      const communityId = 'community-456';
      const query = 'test';
      const limit = '25';

      jest.spyOn(service, 'searchMembers').mockResolvedValue([]);

      await controller.searchCommunityMembers(communityId, query, limit);

      expect(service.searchMembers).toHaveBeenCalledWith(
        communityId,
        query,
        25,
      );
    });

    it('should use empty string when query is not provided', async () => {
      const communityId = 'community-789';

      jest.spyOn(service, 'searchMembers').mockResolvedValue([]);

      await controller.searchCommunityMembers(communityId, '');

      expect(service.searchMembers).toHaveBeenCalledWith(communityId, '', 10);
    });
  });

  describe('findAllForUser', () => {
    it('should return user memberships when user requests their own', async () => {
      const userId = mockUser.id;
      const mockMemberships = [
        MembershipFactory.build({ userId }),
        MembershipFactory.build({ userId }),
      ];

      jest
        .spyOn(service, 'findAllForUser')
        .mockResolvedValue(mockMemberships as any);

      const result = await controller.findAllForUser(userId, mockRequest);

      expect(service.findAllForUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockMemberships);
    });

    it('should throw ForbiddenException when requesting other user memberships', async () => {
      const otherUserId = 'other-user-123';

      try {
        await controller.findAllForUser(otherUserId, mockRequest);
        fail('Should have thrown ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.message).toBe('Cannot view other users memberships');
      }

      expect(service.findAllForUser).not.toHaveBeenCalled();
    });
  });

  describe('findMyMemberships', () => {
    it('should return current user memberships', async () => {
      const mockMemberships = [
        MembershipFactory.build({ userId: mockUser.id }),
        MembershipFactory.build({ userId: mockUser.id }),
      ];

      jest
        .spyOn(service, 'findAllForUser')
        .mockResolvedValue(mockMemberships as any);

      const result = await controller.findMyMemberships(mockRequest);

      expect(service.findAllForUser).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockMemberships);
    });

    it('should use authenticated user ID from request', async () => {
      jest.spyOn(service, 'findAllForUser').mockResolvedValue([]);

      await controller.findMyMemberships(mockRequest);

      expect(service.findAllForUser).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('findOne', () => {
    it('should return a specific membership', async () => {
      const userId = 'user-123';
      const communityId = 'community-123';
      const mockMembership = MembershipFactory.build({
        userId,
        communityId,
      });

      jest.spyOn(service, 'findOne').mockResolvedValue(mockMembership as any);

      const result = await controller.findOne(userId, communityId);

      expect(service.findOne).toHaveBeenCalledWith(userId, communityId);
      expect(result).toEqual(mockMembership);
    });
  });

  describe('remove', () => {
    it('should remove a membership', async () => {
      const userId = 'user-123';
      const communityId = 'community-123';

      jest.spyOn(service, 'remove').mockResolvedValue(undefined);

      await controller.remove(userId, communityId);

      expect(service.remove).toHaveBeenCalledWith(userId, communityId);
    });
  });

  describe('leaveCommunity', () => {
    it('should allow user to leave community', async () => {
      const communityId = 'community-123';

      jest.spyOn(service, 'remove').mockResolvedValue(undefined);

      await controller.leaveCommunity(communityId, mockRequest);

      expect(service.remove).toHaveBeenCalledWith(mockUser.id, communityId);
    });

    it('should use authenticated user ID', async () => {
      const communityId = 'community-456';

      jest.spyOn(service, 'remove').mockResolvedValue(undefined);

      await controller.leaveCommunity(communityId, mockRequest);

      const callArgs = (service.remove as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe(mockUser.id);
      expect(callArgs[1]).toBe(communityId);
    });
  });
});
