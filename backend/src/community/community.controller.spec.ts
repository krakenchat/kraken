import { Test, TestingModule } from '@nestjs/testing';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';

describe('CommunityController', () => {
  let controller: CommunityController;
  let service: CommunityService;

  const mockCommunityService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityController],
      providers: [
        {
          provide: CommunityService,
          useValue: mockCommunityService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<CommunityController>(CommunityController);
    service = module.get<CommunityService>(CommunityService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have a service', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a community', async () => {
      const createDto = {
        name: 'Test Community',
        description: 'A test community',
      };
      const mockUser = { id: 'user-123', username: 'testuser' };
      const mockReq = { user: mockUser } as any;
      const createdCommunity = {
        id: 'community-123',
        ...createDto,
        ownerId: 'user-123',
      };

      mockCommunityService.create.mockResolvedValue(createdCommunity);

      const result = await controller.create(createDto as any, mockReq);

      expect(result).toEqual(createdCommunity);
      expect(mockCommunityService.create).toHaveBeenCalledWith(
        createDto,
        'user-123',
      );
    });
  });

  describe('findAll', () => {
    it('should return all communities', async () => {
      const communities = [
        { id: 'community-1', name: 'Community 1' },
        { id: 'community-2', name: 'Community 2' },
      ];

      mockCommunityService.findAll.mockResolvedValue(communities);

      const result = await controller.findAll();

      expect(result).toEqual(communities);
      expect(mockCommunityService.findAll).toHaveBeenCalledWith();
    });
  });

  describe('findAllMine', () => {
    it('should return user communities', async () => {
      const mockUser = { id: 'user-456' };
      const mockReq = { user: mockUser } as any;
      const communities = [
        { id: 'community-1', name: 'My Community 1' },
        { id: 'community-2', name: 'My Community 2' },
      ];

      mockCommunityService.findAll.mockResolvedValue(communities);

      const result = await controller.findAllMine(mockReq);

      expect(result).toEqual(communities);
      expect(mockCommunityService.findAll).toHaveBeenCalledWith('user-456');
    });
  });

  describe('findOne', () => {
    it('should return a single community', async () => {
      const communityId = 'community-999';
      const community = {
        id: communityId,
        name: 'Specific Community',
        description: 'A specific community',
      };

      mockCommunityService.findOne.mockResolvedValue(community);

      const result = await controller.findOne(communityId);

      expect(result).toEqual(community);
      expect(mockCommunityService.findOne).toHaveBeenCalledWith(communityId);
    });
  });

  describe('update', () => {
    it('should update a community', async () => {
      const communityId = 'community-111';
      const updateDto = { name: 'Updated Community Name' };
      const updatedCommunity = {
        id: communityId,
        ...updateDto,
        description: 'Original description',
      };

      mockCommunityService.update.mockResolvedValue(updatedCommunity);

      const result = await controller.update(communityId, updateDto as any);

      expect(result).toEqual(updatedCommunity);
      expect(mockCommunityService.update).toHaveBeenCalledWith(
        communityId,
        updateDto,
      );
    });
  });

  describe('remove', () => {
    it('should remove a community', async () => {
      const communityId = 'community-222';

      mockCommunityService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(communityId);

      expect(result).toBeUndefined();
      expect(mockCommunityService.remove).toHaveBeenCalledWith(communityId);
    });
  });
});
