import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useJumpToMessage } from '../../hooks/useJumpToMessage';
import { channelMessagesQueryKey } from '../../utils/messageQueryKeys';
import { createMessage, createInfiniteData, createTestQueryClient } from '../test-utils';

// useJumpToMessage renders both useMessages (normal window) and
// useAnchoredMessages (anchored window) unconditionally, so both channel
// endpoints need mocking regardless of which mode is active.
vi.mock('../../api-client/sdk.gen', () => ({
  messagesControllerFindAllForChannel: vi.fn(async () => ({
    data: { messages: [], continuationToken: '' },
  })),
  messagesControllerFindAllForGroup: vi.fn(async () => ({
    data: { messages: [], continuationToken: '' },
  })),
  messagesControllerFindAroundForChannel: vi.fn(async () => ({
    data: { messages: [createMessage({ id: 'target-msg' })], olderContinuationToken: undefined, newerContinuationToken: undefined },
  })),
  messagesControllerFindAroundForGroup: vi.fn(async () => ({
    data: { messages: [], olderContinuationToken: undefined, newerContinuationToken: undefined },
  })),
}));

describe('useJumpToMessage — detached normal window chaining (#404)', () => {
  it('resets the normal window to the live edge when jumpToPresent drops an anchor onto a detached window', async () => {
    const queryClient = createTestQueryClient();

    // Normal window is detached from the live edge (deep scrollback evicted
    // the newest page): pageParams[0] is a cursor, not the live page.
    const detached = {
      ...createInfiniteData([createMessage({ id: 'stale-1' })]),
      pageParams: ['cursor-uuid'],
    };
    queryClient.setQueryData(channelMessagesQueryKey('chan-1'), detached);

    const resetSpy = vi.spyOn(queryClient, 'resetQueries');
    const removeSpy = vi.spyOn(queryClient, 'removeQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result, rerender } = renderHook(
      ({ highlightMessageId }: { highlightMessageId: string | undefined }) =>
        useJumpToMessage('channel', 'chan-1', highlightMessageId),
      {
        wrapper,
        initialProps: { highlightMessageId: undefined as string | undefined },
      },
    );

    // Normal window finishes its (cached, non-refetching) initial load.
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // A pinned/search link arrives for a message not present in the stale
    // normal window — the hook switches into anchored mode.
    rerender({ highlightMessageId: 'target-msg' });

    await waitFor(() => expect(result.current.mode).toBe('anchored'));

    act(() => {
      result.current.jumpToPresent();
    });

    // Anchored cache is dropped...
    expect(removeSpy).toHaveBeenCalled();

    // ...and because the normal window it falls back to is itself detached,
    // that window is reset to the live edge in the same click.
    expect(resetSpy).toHaveBeenCalledWith({
      queryKey: channelMessagesQueryKey('chan-1'),
      exact: true,
    });

    await waitFor(() => expect(result.current.mode).toBe('normal'));
  });
});
