import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import {
  invalidateChannelQueries,
  invalidateRoleQueries,
  invalidateAllRoleQueries,
  invalidateMemberQueries,
  invalidateCommunityQueries,
  invalidateInstanceRoleQueries,
  invalidateInviteQueries,
  invalidateChannelMembershipQueries,
  invalidateModerationQueries,
  invalidateTimeoutQueries,
} from '../../utils/queryInvalidation';

function createMockQueryClient(): QueryClient & { invalidateQueries: ReturnType<typeof vi.fn> } {
  return { invalidateQueries: vi.fn() } as unknown as QueryClient & { invalidateQueries: ReturnType<typeof vi.fn> };
}

describe('queryInvalidation', () => {
  let mockQueryClient: ReturnType<typeof createMockQueryClient>;

  beforeEach(() => {
    mockQueryClient = createMockQueryClient();
  });

  describe('invalidateChannelQueries', () => {
    it('calls invalidateQueries 3 times with correct keys', () => {
      invalidateChannelQueries(mockQueryClient);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(3);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'channelsControllerFindAllForCommunity' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'channelsControllerFindOne' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'channelsControllerGetMentionableChannels' }] });
    });
  });

  describe('invalidateRoleQueries', () => {
    it('calls invalidateQueries 2 times with correct keys', () => {
      invalidateRoleQueries(mockQueryClient);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(2);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'rolesControllerGetCommunityRoles' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'rolesControllerGetUsersForRole' }] });
    });
  });

  describe('invalidateAllRoleQueries', () => {
    it('calls invalidateQueries 8 times (2 from invalidateRoleQueries + 6 more)', () => {
      invalidateAllRoleQueries(mockQueryClient);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(8);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'rolesControllerGetCommunityRoles' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'rolesControllerGetUsersForRole' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'rolesControllerGetMyRolesForCommunity' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'rolesControllerGetMyRolesForChannel' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'rolesControllerGetMyInstanceRoles' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'rolesControllerGetUserRolesForCommunity' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'rolesControllerGetUserRolesForChannel' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'rolesControllerGetUserInstanceRoles' }] });
    });
  });

  describe('invalidateMemberQueries', () => {
    it('calls invalidateQueries 5 times with correct keys', () => {
      invalidateMemberQueries(mockQueryClient);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(5);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'membershipControllerFindAllForCommunity' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'membershipControllerFindAllForUser' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'membershipControllerFindMyMemberships' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'membershipControllerFindOne' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'membershipControllerSearchCommunityMembers' }] });
    });
  });

  describe('invalidateCommunityQueries', () => {
    it('calls invalidateQueries 2 times with correct keys', () => {
      invalidateCommunityQueries(mockQueryClient);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(2);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'communityControllerFindAllWithStats' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'communityControllerFindOneWithStats' }] });
    });
  });

  describe('invalidateInstanceRoleQueries', () => {
    it('calls invalidateQueries 2 times with correct keys', () => {
      invalidateInstanceRoleQueries(mockQueryClient);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(2);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'rolesControllerGetInstanceRoles' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'rolesControllerGetInstanceRoleUsers' }] });
    });
  });

  describe('invalidateInviteQueries', () => {
    it('calls invalidateQueries 2 times with correct keys', () => {
      invalidateInviteQueries(mockQueryClient);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(2);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'inviteControllerGetInvites' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'inviteControllerGetInvite' }] });
    });
  });

  describe('invalidateChannelMembershipQueries', () => {
    it('calls invalidateQueries 4 times with correct keys', () => {
      invalidateChannelMembershipQueries(mockQueryClient);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(4);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'channelMembershipControllerFindAllForChannel' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'channelMembershipControllerFindAllForUser' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'channelMembershipControllerFindMyChannelMemberships' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'channelMembershipControllerFindOne' }] });
    });
  });

  describe('invalidateModerationQueries', () => {
    it('calls invalidateQueries 2 times with correct keys', () => {
      invalidateModerationQueries(mockQueryClient);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(2);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'moderationControllerGetBanList' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'moderationControllerGetModerationLogs' }] });
    });
  });

  describe('invalidateTimeoutQueries', () => {
    it('calls invalidateQueries 3 times with correct keys', () => {
      invalidateTimeoutQueries(mockQueryClient);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(3);
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'moderationControllerGetTimeoutList' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'moderationControllerGetTimeoutStatus' }] });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: [{ _id: 'moderationControllerGetModerationLogs' }] });
    });
  });
});
