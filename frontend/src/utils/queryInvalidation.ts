import { QueryClient } from '@tanstack/react-query';

/**
 * Invalidate all TanStack queries whose _id matches any of the given operation IDs.
 * Replaces RTK Query's bare tag invalidation (e.g. invalidatesTags: ['Community']).
 */
export function invalidateByIds(queryClient: QueryClient, operationIds: readonly string[]) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key === 'object' && key !== null && '_id' in key) {
        return operationIds.includes((key as { _id: string })._id);
      }
      return false;
    },
  });
}

/**
 * Invalidate TanStack queries matching a specific operation ID + path params.
 * Replaces RTK Query's typed tag invalidation (e.g. { type: 'Community', id: communityId }).
 */
export function invalidateByIdAndPath(
  queryClient: QueryClient,
  operationId: string,
  pathMatch: Record<string, string>,
) {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'object' || key === null || !('_id' in key)) return false;
      const k = key as { _id: string; path?: Record<string, string> };
      if (k._id !== operationId) return false;
      if (!k.path) return false;
      return Object.entries(pathMatch).every(([prop, val]) => k.path![prop] === val);
    },
  });
}

/**
 * Maps former RTK Query tag names to arrays of TanStack Query operation IDs.
 * Used with invalidateByIds() to replicate tag-based cache invalidation.
 */
export const INVALIDATION_GROUPS = {
  community: [
    'communityControllerFindAll',
    'communityControllerFindAllMine',
    'communityControllerFindOne',
    'communityControllerFindAllWithStats',
    'communityControllerFindOneWithStats',
  ],
  channel: [
    'channelsControllerFindAllForCommunity',
    'channelsControllerFindOne',
    'channelsControllerGetMentionableChannels',
  ],
  membership: [
    'membershipControllerFindAllForCommunity',
    'membershipControllerFindAllForUser',
    'membershipControllerFindMyMemberships',
    'membershipControllerFindOne',
    'membershipControllerSearchCommunityMembers',
  ],
  channelMembership: [
    'channelMembershipControllerFindAllForChannel',
    'channelMembershipControllerFindAllForUser',
    'channelMembershipControllerFindMyChannelMemberships',
    'channelMembershipControllerFindOne',
  ],
  invite: [
    'inviteControllerGetInvites',
    'inviteControllerGetInvite',
  ],
  sessions: [
    'authControllerGetSessions',
  ],
  friends: [
    'friendsControllerGetFriends',
    'friendsControllerGetPendingRequests',
    'friendsControllerGetFriendshipStatus',
  ],
  aliasGroups: [
    'aliasGroupsControllerGetCommunityAliasGroups',
    'aliasGroupsControllerGetAliasGroup',
  ],
  banList: [
    'moderationControllerGetBanList',
  ],
  timeoutList: [
    'moderationControllerGetTimeoutList',
    'moderationControllerGetTimeoutStatus',
  ],
  moderationLogs: [
    'moderationControllerGetModerationLogs',
  ],
  pinnedMessages: [
    'moderationControllerGetPinnedMessages',
  ],
  clips: [
    'livekitControllerGetMyClips',
    'livekitControllerGetUserPublicClips',
  ],
  userRoles: [
    'rolesControllerGetMyRolesForCommunity',
    'rolesControllerGetMyRolesForChannel',
    'rolesControllerGetMyInstanceRoles',
    'rolesControllerGetUserRolesForCommunity',
    'rolesControllerGetUserRolesForChannel',
    'rolesControllerGetUserInstanceRoles',
  ],
  communityRoles: [
    'rolesControllerGetCommunityRoles',
    'rolesControllerGetUsersForRole',
  ],
  roleUsers: [
    'rolesControllerGetUsersForRole',
  ],
  instanceRoles: [
    'rolesControllerGetInstanceRoles',
    'rolesControllerGetInstanceRoleUsers',
  ],
  profile: [
    'userControllerGetProfile',
  ],
  user: [
    'userControllerGetUserById',
    'userControllerGetUserByName',
    'userControllerSearchUsers',
    'userControllerFindAllUsers',
  ],
  blockedUsers: [
    'userControllerGetBlockedUsers',
    'userControllerIsUserBlocked',
  ],
  notifications: [
    'notificationsControllerGetNotifications',
    'notificationsControllerGetUnreadCount',
  ],
  notificationSettings: [
    'notificationsControllerGetSettings',
  ],
  channelOverrides: [
    'notificationsControllerGetChannelOverride',
  ],
  unreadCounts: [
    'readReceiptsControllerGetUnreadCounts',
    'readReceiptsControllerGetUnreadCount',
  ],
  threadReplies: [
    'threadsControllerGetReplies',
  ],
  threadMetadata: [
    'threadsControllerGetMetadata',
  ],
  directMessageGroup: [
    'directMessagesControllerFindUserDmGroups',
    'directMessagesControllerFindDmGroup',
  ],
  directMessages: [
    'directMessagesControllerGetDmMessages',
  ],
  onboardingStatus: [
    'onboardingControllerGetStatus',
  ],
  voicePresence: [
    'voicePresenceControllerGetChannelPresence',
    'userVoicePresenceControllerGetMyVoiceChannels',
    'dmVoicePresenceControllerGetDmPresence',
  ],
  presence: [
    'presenceControllerGetUserPresence',
    'presenceControllerGetBulkPresence',
    'presenceControllerGetMultipleUserPresence',
  ],
  pushStatus: [
    'pushNotificationsControllerGetStatus',
  ],
  appearanceSettings: [
    'appearanceSettingsControllerGetSettings',
  ],
  // Admin tags
  instanceSettings: [
    'instanceControllerGetSettings',
    'instanceControllerGetPublicSettings',
  ],
  instanceStats: [
    'instanceControllerGetStats',
  ],
  adminUsers: [
    'userControllerFindAllUsersAdmin',
    'userControllerGetUserByIdAdmin',
  ],
  adminCommunities: [
    'communityControllerFindAllWithStats',
    'communityControllerFindOneWithStats',
  ],
  storageStats: [
    'storageQuotaControllerGetInstanceStorageStats',
    'storageQuotaControllerGetMyStorageStats',
  ],
  userStorage: [
    'storageQuotaControllerGetUsersStorageList',
    'storageQuotaControllerGetUserStorageStats',
  ],
} as const;
