import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { handleMemberAddedToCommunity } from '../../../socket-hub/handlers/communityHandlers';

describe('communityHandlers', () => {
  it('invalidates communityControllerFindAllMine queries', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    handleMemberAddedToCommunity({ communityId: 'c1', userId: 'u1' }, queryClient);

    expect(spy).toHaveBeenCalledWith({
      queryKey: [{ _id: 'communityControllerFindAllMine' }],
    });
  });
});
