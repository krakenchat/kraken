import type { QueryClient } from '@tanstack/react-query';
import type { ServerEvents } from '@kraken/shared';
import type { SocketEventHandler } from './types';

export const handleMemberAddedToCommunity: SocketEventHandler<typeof ServerEvents.MEMBER_ADDED_TO_COMMUNITY> = (
  _payload,
  queryClient: QueryClient,
) => {
  queryClient.invalidateQueries({
    queryKey: [{ _id: 'communityControllerFindAllMine' }],
  });
};

// =============================================================================
// Channel Reorder
// =============================================================================

export const handleChannelsReordered: SocketEventHandler<typeof ServerEvents.CHANNELS_REORDERED> = (
  payload,
  queryClient: QueryClient,
) => {
  queryClient.invalidateQueries({
    queryKey: [{ _id: 'channelsControllerFindAllForCommunity' }],
  });
};

// =============================================================================
// Channel Lifecycle
// =============================================================================

export const handleChannelCreated: SocketEventHandler<typeof ServerEvents.CHANNEL_CREATED> = (
  _payload,
  queryClient: QueryClient,
) => {
  queryClient.invalidateQueries({
    queryKey: [{ _id: 'channelsControllerFindAllForCommunity' }],
  });
};

export const handleChannelUpdated: SocketEventHandler<typeof ServerEvents.CHANNEL_UPDATED> = (
  _payload,
  queryClient: QueryClient,
) => {
  queryClient.invalidateQueries({
    queryKey: [{ _id: 'channelsControllerFindAllForCommunity' }],
  });
};

export const handleChannelDeleted: SocketEventHandler<typeof ServerEvents.CHANNEL_DELETED> = (
  _payload,
  queryClient: QueryClient,
) => {
  queryClient.invalidateQueries({
    queryKey: [{ _id: 'channelsControllerFindAllForCommunity' }],
  });
};

// =============================================================================
// Community Lifecycle
// =============================================================================

export const handleCommunityUpdated: SocketEventHandler<typeof ServerEvents.COMMUNITY_UPDATED> = (
  _payload,
  queryClient: QueryClient,
) => {
  queryClient.invalidateQueries({ queryKey: [{ _id: 'communityControllerFindOne' }] });
  queryClient.invalidateQueries({ queryKey: [{ _id: 'communityControllerFindAllMine' }] });
};

export const handleCommunityDeleted: SocketEventHandler<typeof ServerEvents.COMMUNITY_DELETED> = (
  _payload,
  queryClient: QueryClient,
) => {
  queryClient.invalidateQueries({ queryKey: [{ _id: 'communityControllerFindAllMine' }] });
};
