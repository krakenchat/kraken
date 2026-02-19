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
