import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useMessages } from '../../hooks/useMessages';
import { channelMessagesQueryKey } from '../../utils/messageQueryKeys';
import { createMessage, createInfiniteData, createTestQueryClient } from '../test-utils';

vi.mock('../../api-client/sdk.gen', () => ({
  messagesControllerFindAllForChannel: vi.fn(async () => ({
    data: { messages: [], continuationToken: '' },
  })),
  messagesControllerFindAllForGroup: vi.fn(async () => ({
    data: { messages: [], continuationToken: '' },
  })),
}));

const setup = (seed: unknown) => {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(channelMessagesQueryKey('chan-1'), seed);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

describe('useMessages live-edge detachment', () => {
  it('reports not detached when the first page param is the live edge', () => {
    const { wrapper } = setup(createInfiniteData([createMessage()]));
    const { result } = renderHook(() => useMessages('channel', 'chan-1'), { wrapper });
    expect(result.current.isDetachedFromPresent).toBe(false);
  });

  it('reports detached when the first page param is a cursor', () => {
    const seed = { ...createInfiniteData([createMessage()]), pageParams: ['cursor-uuid'] };
    const { wrapper } = setup(seed);
    const { result } = renderHook(() => useMessages('channel', 'chan-1'), { wrapper });
    expect(result.current.isDetachedFromPresent).toBe(true);
  });

  it('resetToPresent resets the query (window returns to the live edge)', async () => {
    const seed = { ...createInfiniteData([createMessage()]), pageParams: ['cursor-uuid'] };
    const { queryClient, wrapper } = setup(seed);
    const resetSpy = vi.spyOn(queryClient, 'resetQueries');
    const { result } = renderHook(() => useMessages('channel', 'chan-1'), { wrapper });
    await result.current.resetToPresent();
    expect(resetSpy).toHaveBeenCalledWith({ queryKey: channelMessagesQueryKey('chan-1'), exact: true });
  });
});
