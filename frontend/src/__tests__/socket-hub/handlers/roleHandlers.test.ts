import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  handleRoleCreated,
  handleRoleUpdated,
  handleRoleDeleted,
  handleRoleAssigned,
  handleRoleUnassigned,
} from '../../../socket-hub/handlers/roleHandlers';

describe('roleHandlers', () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient();
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  });

  function queryKeysInvalidated(): string[] {
    return invalidateSpy.mock.calls.map(
      (call) => ((call[0] as { queryKey: [{ _id: string }] }).queryKey[0] as { _id: string })._id,
    );
  }

  describe('handleRoleCreated', () => {
    it('invalidates the community roles list', () => {
      handleRoleCreated({} as never, queryClient);

      expect(queryKeysInvalidated()).toContain('rolesControllerGetCommunityRoles');
    });

    it('does NOT invalidate my roles or members (no assignment change)', () => {
      handleRoleCreated({} as never, queryClient);

      const keys = queryKeysInvalidated();
      expect(keys).not.toContain('rolesControllerGetMyRolesForCommunity');
      expect(keys).not.toContain('membershipControllerGetMembers');
      expect(invalidateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleRoleUpdated', () => {
    it('invalidates community roles and my roles', () => {
      handleRoleUpdated({} as never, queryClient);

      const keys = queryKeysInvalidated();
      expect(keys).toContain('rolesControllerGetCommunityRoles');
      expect(keys).toContain('rolesControllerGetMyRolesForCommunity');
    });

    it('does NOT invalidate members (permissions may change but no role reassignment)', () => {
      handleRoleUpdated({} as never, queryClient);

      const keys = queryKeysInvalidated();
      expect(keys).not.toContain('membershipControllerGetMembers');
      expect(invalidateSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleRoleDeleted', () => {
    it('invalidates community roles and my roles', () => {
      handleRoleDeleted({} as never, queryClient);

      const keys = queryKeysInvalidated();
      expect(keys).toContain('rolesControllerGetCommunityRoles');
      expect(keys).toContain('rolesControllerGetMyRolesForCommunity');
      expect(invalidateSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleRoleAssigned', () => {
    it('invalidates community roles, my roles, AND members', () => {
      handleRoleAssigned({} as never, queryClient);

      const keys = queryKeysInvalidated();
      expect(keys).toContain('rolesControllerGetCommunityRoles');
      expect(keys).toContain('rolesControllerGetMyRolesForCommunity');
      expect(keys).toContain('membershipControllerGetMembers');
      expect(invalidateSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('handleRoleUnassigned', () => {
    it('invalidates community roles, my roles, AND members', () => {
      handleRoleUnassigned({} as never, queryClient);

      const keys = queryKeysInvalidated();
      expect(keys).toContain('rolesControllerGetCommunityRoles');
      expect(keys).toContain('rolesControllerGetMyRolesForCommunity');
      expect(keys).toContain('membershipControllerGetMembers');
      expect(invalidateSpy).toHaveBeenCalledTimes(3);
    });
  });
});
