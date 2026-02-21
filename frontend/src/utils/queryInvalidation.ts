import type { QueryClient } from "@tanstack/react-query";

export function invalidateChannelQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: [{ _id: 'channelsControllerFindAllForCommunity' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'channelsControllerFindOne' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'channelsControllerGetMentionableChannels' }] });
}

export function invalidateRoleQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetCommunityRoles' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetUsersForRole' }] });
}

export function invalidateAllRoleQueries(queryClient: QueryClient) {
  invalidateRoleQueries(queryClient);
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetMyRolesForCommunity' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetMyRolesForChannel' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetMyInstanceRoles' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetUserRolesForCommunity' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetUserRolesForChannel' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetUserInstanceRoles' }] });
}

export function invalidateMemberQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: [{ _id: 'membershipControllerFindAllForCommunity' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'membershipControllerFindAllForUser' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'membershipControllerFindMyMemberships' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'membershipControllerFindOne' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'membershipControllerSearchCommunityMembers' }] });
}

export function invalidateCommunityQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: [{ _id: 'communityControllerFindAllWithStats' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'communityControllerFindOneWithStats' }] });
}

export function invalidateInstanceRoleQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetInstanceRoles' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'rolesControllerGetInstanceRoleUsers' }] });
}

export function invalidateInviteQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: [{ _id: 'inviteControllerGetInvites' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'inviteControllerGetInvite' }] });
}

export function invalidateChannelMembershipQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: [{ _id: 'channelMembershipControllerFindAllForChannel' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'channelMembershipControllerFindAllForUser' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'channelMembershipControllerFindMyChannelMemberships' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'channelMembershipControllerFindOne' }] });
}

export function invalidateModerationQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: [{ _id: 'moderationControllerGetBanList' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'moderationControllerGetModerationLogs' }] });
}

export function invalidateTimeoutQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: [{ _id: 'moderationControllerGetTimeoutList' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'moderationControllerGetTimeoutStatus' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'moderationControllerGetModerationLogs' }] });
}
