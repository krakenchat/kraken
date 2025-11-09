import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CommunityMembershipStrategy } from './community-membership.strategy';
import { MembershipService } from '@/membership/membership.service';

describe('CommunityMembershipStrategy', () => {
  let strategy: CommunityMembershipStrategy;

  const mockMembershipService = {
    isMember: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityMembershipStrategy,
        {
          provide: MembershipService,
          useValue: mockMembershipService,
        },
      ],
    }).compile();

    strategy = module.get<CommunityMembershipStrategy>(
      CommunityMembershipStrategy,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('checkAccess', () => {
    it('should grant access when user is a community member', async () => {
      mockMembershipService.isMember.mockResolvedValue(true);

      const result = await strategy.checkAccess(
        'user-123',
        'community-456',
        'file-789',
      );

      expect(result).toBe(true);
      expect(mockMembershipService.isMember).toHaveBeenCalledWith(
        'user-123',
        'community-456',
      );
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      mockMembershipService.isMember.mockResolvedValue(false);

      await expect(
        strategy.checkAccess('user-123', 'community-456', 'file-789'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        strategy.checkAccess('user-123', 'community-456', 'file-789'),
      ).rejects.toThrow(
        'You must be a member of this community to access this file',
      );
    });

    it('should check membership for different users and communities', async () => {
      mockMembershipService.isMember.mockResolvedValue(true);

      await strategy.checkAccess('user-1', 'community-1', 'file-1');
      await strategy.checkAccess('user-2', 'community-2', 'file-2');

      expect(mockMembershipService.isMember).toHaveBeenCalledTimes(2);
      expect(mockMembershipService.isMember).toHaveBeenCalledWith(
        'user-1',
        'community-1',
      );
      expect(mockMembershipService.isMember).toHaveBeenCalledWith(
        'user-2',
        'community-2',
      );
    });
  });
});
