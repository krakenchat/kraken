import { Test, TestingModule } from '@nestjs/testing';
import { InviteService } from './invite.service';
import { DatabaseService } from '@/database/database.service';
import {
  createMockDatabase,
  UserFactory,
  InstanceInviteFactory,
} from '@/test-utils';

describe('InviteService', () => {
  let service: InviteService;
  let mockDatabase: any;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteService,
        {
          provide: DatabaseService,
          useValue: mockDatabase,
        },
      ],
    }).compile();

    service = module.get<InviteService>(InviteService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createInvite', () => {
    it('should create invite with generated code', async () => {
      const creator = UserFactory.build();
      const mockInvite = InstanceInviteFactory.build({
        createdById: creator.id,
        code: 'ABC123',
      });

      mockDatabase.instanceInvite.findFirst.mockResolvedValue(null);
      mockDatabase.instanceInvite.create.mockResolvedValue(mockInvite);

      const result = await service.createInvite(creator);

      expect(result).toEqual(mockInvite);
      expect(mockDatabase.instanceInvite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          createdById: creator.id,
          code: expect.any(String),
        }),
      });
    });

    it('should create invite with maxUses', async () => {
      const creator = UserFactory.build();
      const maxUses = 10;
      const mockInvite = InstanceInviteFactory.build({
        createdById: creator.id,
        maxUses,
      });

      mockDatabase.instanceInvite.findFirst.mockResolvedValue(null);
      mockDatabase.instanceInvite.create.mockResolvedValue(mockInvite);

      const result = await service.createInvite(creator, maxUses);

      expect(result.maxUses).toBe(maxUses);
      expect(mockDatabase.instanceInvite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          maxUses,
        }),
      });
    });

    it('should create invite with validUntil date', async () => {
      const creator = UserFactory.build();
      const validUntil = new Date(Date.now() + 1000 * 60 * 60 * 24); // 1 day
      const mockInvite = InstanceInviteFactory.build({
        createdById: creator.id,
        validUntil,
      });

      mockDatabase.instanceInvite.findFirst.mockResolvedValue(null);
      mockDatabase.instanceInvite.create.mockResolvedValue(mockInvite);

      const result = await service.createInvite(creator, undefined, validUntil);

      expect(result.validUntil).toEqual(validUntil);
      expect(mockDatabase.instanceInvite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          validUntil,
        }),
      });
    });

    it('should create invite with default community IDs', async () => {
      const creator = UserFactory.build();
      const communityIds = ['community-1', 'community-2'];
      const mockInvite = InstanceInviteFactory.build({
        createdById: creator.id,
        defaultCommunityId: communityIds,
      });

      mockDatabase.instanceInvite.findFirst.mockResolvedValue(null);
      mockDatabase.instanceInvite.create.mockResolvedValue(mockInvite);

      const result = await service.createInvite(
        creator,
        undefined,
        undefined,
        communityIds,
      );

      expect(result.defaultCommunityId).toEqual(communityIds);
      expect(mockDatabase.instanceInvite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          defaultCommunityId: communityIds,
        }),
      });
    });

    it('should regenerate code on collision', async () => {
      const creator = UserFactory.build();
      const mockInvite = InstanceInviteFactory.build();

      // First call returns existing invite (collision), second returns null
      mockDatabase.instanceInvite.findFirst
        .mockResolvedValueOnce(InstanceInviteFactory.build())
        .mockResolvedValueOnce(null);
      mockDatabase.instanceInvite.create.mockResolvedValue(mockInvite);

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await service.createInvite(creator);

      expect(mockDatabase.instanceInvite.findFirst).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('collision'),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should generate 6-character code by default', async () => {
      const creator = UserFactory.build();
      const mockInvite = InstanceInviteFactory.build();

      mockDatabase.instanceInvite.findFirst.mockResolvedValue(null);
      mockDatabase.instanceInvite.create.mockResolvedValue(mockInvite);

      await service.createInvite(creator);

      const createCall = mockDatabase.instanceInvite.create.mock.calls[0][0];
      expect(createCall.data.code).toHaveLength(6);
    });
  });

  describe('validateInviteCode', () => {
    it('should return invite when valid', async () => {
      const mockInvite = InstanceInviteFactory.build({
        disabled: false,
        validUntil: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
        maxUses: 10,
        uses: 5,
      });

      mockDatabase.instanceInvite.findUnique.mockResolvedValue(mockInvite);

      const result = await service.validateInviteCode(mockInvite.code);

      expect(result).toEqual(mockInvite);
    });

    it('should return null when invite not found', async () => {
      mockDatabase.instanceInvite.findUnique.mockResolvedValue(null);

      const result = await service.validateInviteCode('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when invite is disabled', async () => {
      const mockInvite = InstanceInviteFactory.build({
        disabled: true,
      });

      mockDatabase.instanceInvite.findUnique.mockResolvedValue(mockInvite);

      const result = await service.validateInviteCode(mockInvite.code);

      expect(result).toBeNull();
    });

    it('should return null when invite is expired', async () => {
      const mockInvite = InstanceInviteFactory.build({
        disabled: false,
        validUntil: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      });

      mockDatabase.instanceInvite.findUnique.mockResolvedValue(mockInvite);

      const result = await service.validateInviteCode(mockInvite.code);

      expect(result).toBeNull();
    });

    it('should return null when invite reached max uses', async () => {
      const mockInvite = InstanceInviteFactory.build({
        disabled: false,
        maxUses: 10,
        uses: 10,
      });

      mockDatabase.instanceInvite.findUnique.mockResolvedValue(mockInvite);

      const result = await service.validateInviteCode(mockInvite.code);

      expect(result).toBeNull();
    });

    it('should return invite when maxUses is null (unlimited)', async () => {
      const mockInvite = InstanceInviteFactory.build({
        disabled: false,
        maxUses: null,
        uses: 100,
      });

      mockDatabase.instanceInvite.findUnique.mockResolvedValue(mockInvite);

      const result = await service.validateInviteCode(mockInvite.code);

      expect(result).toEqual(mockInvite);
    });

    it('should return invite when validUntil is null (no expiry)', async () => {
      const mockInvite = InstanceInviteFactory.build({
        disabled: false,
        validUntil: null,
      });

      mockDatabase.instanceInvite.findUnique.mockResolvedValue(mockInvite);

      const result = await service.validateInviteCode(mockInvite.code);

      expect(result).toEqual(mockInvite);
    });
  });

  describe('redeemInviteWithTx', () => {
    it('should redeem valid invite and increment uses', async () => {
      const userId = 'user-123';
      const inviteCode = 'ABC123';
      const mockInvite = InstanceInviteFactory.build({
        code: inviteCode,
        disabled: false,
        maxUses: 10,
        uses: 5,
        usedByIds: [],
      });

      const mockTx = {
        instanceInvite: {
          findUnique: jest.fn().mockResolvedValue(mockInvite),
          update: jest.fn().mockResolvedValue({
            ...mockInvite,
            uses: 6,
            usedByIds: [userId],
          }),
        },
      };

      const result = await service.redeemInviteWithTx(
        mockTx as any,
        inviteCode,
        userId,
      );

      expect(result).toBeDefined();
      expect(mockTx.instanceInvite.update).toHaveBeenCalledWith({
        where: { code: inviteCode },
        data: {
          uses: { increment: 1 },
          usedByIds: { push: userId },
          disabled: false,
        },
      });
    });

    it('should disable invite when reaching max uses', async () => {
      const userId = 'user-123';
      const inviteCode = 'ABC123';
      const mockInvite = InstanceInviteFactory.build({
        code: inviteCode,
        disabled: false,
        maxUses: 10,
        uses: 9, // One use away from max
        usedByIds: [],
      });

      const mockTx = {
        instanceInvite: {
          findUnique: jest.fn().mockResolvedValue(mockInvite),
          update: jest.fn().mockResolvedValue({
            ...mockInvite,
            uses: 10,
            usedByIds: [userId],
            disabled: true,
          }),
        },
      };

      await service.redeemInviteWithTx(mockTx as any, inviteCode, userId);

      expect(mockTx.instanceInvite.update).toHaveBeenCalledWith({
        where: { code: inviteCode },
        data: {
          uses: { increment: 1 },
          usedByIds: { push: userId },
          disabled: true, // Should disable
        },
      });
    });

    it('should return null when invite not found', async () => {
      const mockTx = {
        instanceInvite: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await service.redeemInviteWithTx(
        mockTx as any,
        'nonexistent',
        'user-123',
      );

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Invalid invite code',
        'nonexistent',
      );

      consoleWarnSpy.mockRestore();
    });

    it('should return null when invite is disabled', async () => {
      const mockInvite = InstanceInviteFactory.build({
        disabled: true,
      });

      const mockTx = {
        instanceInvite: {
          findUnique: jest.fn().mockResolvedValue(mockInvite),
        },
      };

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await service.redeemInviteWithTx(
        mockTx as any,
        mockInvite.code,
        'user-123',
      );

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should return null when invite is expired', async () => {
      const mockInvite = InstanceInviteFactory.build({
        disabled: false,
        validUntil: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      });

      const mockTx = {
        instanceInvite: {
          findUnique: jest.fn().mockResolvedValue(mockInvite),
        },
      };

      const result = await service.redeemInviteWithTx(
        mockTx as any,
        mockInvite.code,
        'user-123',
      );

      expect(result).toBeNull();
    });

    it('should return null when invite reached max uses', async () => {
      const mockInvite = InstanceInviteFactory.build({
        disabled: false,
        maxUses: 10,
        uses: 10,
      });

      const mockTx = {
        instanceInvite: {
          findUnique: jest.fn().mockResolvedValue(mockInvite),
        },
      };

      const result = await service.redeemInviteWithTx(
        mockTx as any,
        mockInvite.code,
        'user-123',
      );

      expect(result).toBeNull();
    });

    it('should return null when user already redeemed invite', async () => {
      const userId = 'user-123';
      const mockInvite = InstanceInviteFactory.build({
        disabled: false,
        usedByIds: [userId],
      });

      const mockTx = {
        instanceInvite: {
          findUnique: jest.fn().mockResolvedValue(mockInvite),
        },
      };

      const result = await service.redeemInviteWithTx(
        mockTx as any,
        mockInvite.code,
        userId,
      );

      expect(result).toBeNull();
    });
  });

  describe('getInvites', () => {
    it('should return all invites created by user', async () => {
      const user = UserFactory.build();
      const mockInvites = [
        InstanceInviteFactory.build({ createdById: user.id }),
        InstanceInviteFactory.build({ createdById: user.id }),
      ];

      mockDatabase.instanceInvite.findMany.mockResolvedValue(mockInvites);

      const result = await service.getInvites(user);

      expect(result).toEqual(mockInvites);
      expect(mockDatabase.instanceInvite.findMany).toHaveBeenCalledWith({
        where: { createdById: user.id },
        include: { createdBy: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when user has no invites', async () => {
      const user = UserFactory.build();

      mockDatabase.instanceInvite.findMany.mockResolvedValue([]);

      const result = await service.getInvites(user);

      expect(result).toEqual([]);
    });

    it('should order invites by creation date descending', async () => {
      const user = UserFactory.build();

      mockDatabase.instanceInvite.findMany.mockResolvedValue([]);

      await service.getInvites(user);

      expect(mockDatabase.instanceInvite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('getInviteByCode', () => {
    it('should return invite with creator info', async () => {
      const mockInvite = InstanceInviteFactory.build();

      mockDatabase.instanceInvite.findUnique.mockResolvedValue(mockInvite);

      const result = await service.getInviteByCode(mockInvite.code);

      expect(result).toEqual(mockInvite);
      expect(mockDatabase.instanceInvite.findUnique).toHaveBeenCalledWith({
        where: { code: mockInvite.code },
        include: { createdBy: true },
      });
    });

    it('should return null when invite not found', async () => {
      mockDatabase.instanceInvite.findUnique.mockResolvedValue(null);

      const result = await service.getInviteByCode('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('deleteInvite', () => {
    it('should delete invite when user is creator', async () => {
      const user = UserFactory.build();
      const mockInvite = InstanceInviteFactory.build({
        createdById: user.id,
      });

      mockDatabase.instanceInvite.findUnique.mockResolvedValue(mockInvite);
      mockDatabase.instanceInvite.delete.mockResolvedValue(mockInvite);

      await service.deleteInvite(user, mockInvite.code);

      expect(mockDatabase.instanceInvite.delete).toHaveBeenCalledWith({
        where: { code: mockInvite.code },
      });
    });

    it('should throw error when invite not found', async () => {
      const user = UserFactory.build();

      mockDatabase.instanceInvite.findUnique.mockResolvedValue(null);

      await expect(service.deleteInvite(user, 'nonexistent')).rejects.toThrow(
        'Invite not found',
      );

      expect(mockDatabase.instanceInvite.delete).not.toHaveBeenCalled();
    });

    it('should throw error when user is not creator', async () => {
      const user = UserFactory.build();
      const otherUser = UserFactory.build();
      const mockInvite = InstanceInviteFactory.build({
        createdById: otherUser.id,
      });

      mockDatabase.instanceInvite.findUnique.mockResolvedValue(mockInvite);

      await expect(service.deleteInvite(user, mockInvite.code)).rejects.toThrow(
        'Unauthorized to delete this invite',
      );

      expect(mockDatabase.instanceInvite.delete).not.toHaveBeenCalled();
    });
  });
});
