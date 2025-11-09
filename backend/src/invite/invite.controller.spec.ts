import { Test, TestingModule } from '@nestjs/testing';
import { InviteController } from './invite.controller';
import { InviteService } from './invite.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';

describe('InviteController', () => {
  let controller: InviteController;
  let service: InviteService;

  const mockInviteService = {
    createInvite: jest.fn(),
    getInvites: jest.fn(),
    getInviteByCode: jest.fn(),
    deleteInvite: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InviteController],
      providers: [
        {
          provide: InviteService,
          useValue: mockInviteService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<InviteController>(InviteController);
    service = module.get<InviteService>(InviteService);
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

  describe('createInvite', () => {
    it('should create an invite', async () => {
      const mockUser = { id: 'user-123', username: 'testuser' };
      const mockReq = { user: mockUser } as any;
      const createDto = {
        maxUses: 10,
        validUntil: new Date('2025-12-31'),
        communityIds: ['community-1', 'community-2'],
      };
      const createdInvite = {
        id: 'invite-123',
        code: 'ABC123XYZ',
        maxUses: 10,
        uses: 0,
        validUntil: createDto.validUntil,
        createdById: 'user-123',
      };

      mockInviteService.createInvite.mockResolvedValue(createdInvite);

      const result = await controller.createInvite(mockReq, createDto as any);

      expect(result).toEqual(createdInvite);
      expect(mockInviteService.createInvite).toHaveBeenCalledWith(
        mockUser,
        10,
        createDto.validUntil,
        ['community-1', 'community-2'],
      );
    });
  });

  describe('getInvites', () => {
    it('should return all invites for user', async () => {
      const mockUser = { id: 'user-456' };
      const mockReq = { user: mockUser } as any;
      const invites = [
        { id: 'invite-1', code: 'CODE1', uses: 5, maxUses: 10 },
        { id: 'invite-2', code: 'CODE2', uses: 0, maxUses: 5 },
      ];

      mockInviteService.getInvites.mockResolvedValue(invites);

      const result = await controller.getInvites(mockReq);

      expect(result).toEqual(invites);
      expect(mockInviteService.getInvites).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('getPublicInvite', () => {
    it('should return invite by code without authentication', async () => {
      const code = 'PUBLIC123';
      const invite = {
        id: 'invite-789',
        code: 'PUBLIC123',
        uses: 2,
        maxUses: 50,
      };

      mockInviteService.getInviteByCode.mockResolvedValue(invite);

      const result = await controller.getPublicInvite(code);

      expect(result).toEqual(invite);
      expect(mockInviteService.getInviteByCode).toHaveBeenCalledWith(code);
    });

    it('should return null when invite not found', async () => {
      const code = 'NOTFOUND';

      mockInviteService.getInviteByCode.mockResolvedValue(null);

      const result = await controller.getPublicInvite(code);

      expect(result).toBeNull();
      expect(mockInviteService.getInviteByCode).toHaveBeenCalledWith(code);
    });
  });

  describe('getInvite', () => {
    it('should return invite by code with authentication', async () => {
      const code = 'AUTH456';
      const invite = {
        id: 'invite-999',
        code: 'AUTH456',
        uses: 3,
        maxUses: 10,
      };

      mockInviteService.getInviteByCode.mockResolvedValue(invite);

      const result = await controller.getInvite(code);

      expect(result).toEqual(invite);
      expect(mockInviteService.getInviteByCode).toHaveBeenCalledWith(code);
    });
  });

  describe('deleteInvite', () => {
    it('should delete an invite', async () => {
      const mockUser = { id: 'user-789' };
      const mockReq = { user: mockUser } as any;
      const code = 'DELETE123';

      mockInviteService.deleteInvite.mockResolvedValue(undefined);

      const result = await controller.deleteInvite(mockReq, code);

      expect(result).toBeUndefined();
      expect(mockInviteService.deleteInvite).toHaveBeenCalledWith(
        mockUser,
        code,
      );
    });
  });
});
