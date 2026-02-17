import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { ForbiddenException } from '@nestjs/common';
import { CommunityMembershipStrategy } from './community-membership.strategy';
import { MembershipService } from '@/membership/membership.service';

describe('CommunityMembershipStrategy', () => {
  let strategy: CommunityMembershipStrategy;
  let membershipService: Mocked<MembershipService>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(
      CommunityMembershipStrategy,
    ).compile();

    strategy = unit;
    membershipService = unitRef.get(MembershipService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('checkAccess', () => {
    it('should grant access when user is a community member', async () => {
      membershipService.isMember.mockResolvedValue(true);

      const result = await strategy.checkAccess(
        'user-123',
        'community-456',
        'file-789',
      );

      expect(result).toBe(true);
      expect(membershipService.isMember).toHaveBeenCalledWith(
        'user-123',
        'community-456',
      );
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      membershipService.isMember.mockResolvedValue(false);

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
      membershipService.isMember.mockResolvedValue(true);

      await strategy.checkAccess('user-1', 'community-1', 'file-1');
      await strategy.checkAccess('user-2', 'community-2', 'file-2');

      expect(membershipService.isMember).toHaveBeenCalledTimes(2);
      expect(membershipService.isMember).toHaveBeenCalledWith(
        'user-1',
        'community-1',
      );
      expect(membershipService.isMember).toHaveBeenCalledWith(
        'user-2',
        'community-2',
      );
    });
  });
});
