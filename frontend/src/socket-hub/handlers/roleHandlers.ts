import type { QueryClient } from '@tanstack/react-query';
import type { ServerEvents } from '@kraken/shared';
import type { SocketEventHandler } from './types';

export const handleRoleCreated: SocketEventHandler<typeof ServerEvents.ROLE_CREATED> = (
  _payload,
  queryClient: QueryClient,
) => {
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetCommunityRoles' }] });
};

export const handleRoleUpdated: SocketEventHandler<typeof ServerEvents.ROLE_UPDATED> = (
  _payload,
  queryClient: QueryClient,
) => {
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetCommunityRoles' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetMyRolesForCommunity' }] });
};

export const handleRoleDeleted: SocketEventHandler<typeof ServerEvents.ROLE_DELETED> = (
  _payload,
  queryClient: QueryClient,
) => {
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetCommunityRoles' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetMyRolesForCommunity' }] });
};

export const handleRoleAssigned: SocketEventHandler<typeof ServerEvents.ROLE_ASSIGNED> = (
  _payload,
  queryClient: QueryClient,
) => {
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetCommunityRoles' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetMyRolesForCommunity' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'membershipControllerGetMembers' }] });
};

export const handleRoleUnassigned: SocketEventHandler<typeof ServerEvents.ROLE_UNASSIGNED> = (
  _payload,
  queryClient: QueryClient,
) => {
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetCommunityRoles' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetMyRolesForCommunity' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'membershipControllerGetMembers' }] });
};
