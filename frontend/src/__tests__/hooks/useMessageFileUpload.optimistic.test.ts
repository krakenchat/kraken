import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClientProvider, type InfiniteData } from '@tanstack/react-query';

// Mock the generated client (same pattern as useSendMessage.test.ts)
vi.mock('../../api-client/client.gen', () => ({
  client: {
    getConfig: () => ({ baseUrl: 'http://localhost:3000' }),
  },
}));

import { useMessageFileUpload } from '../../hooks/useMessageFileUpload';
import { VoiceSessionType } from '../../contexts/VoiceContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import { channelMessagesQueryKey } from '../../utils/messageQueryKeys';
import { userControllerGetProfileQueryKey } from '../../api-client/@tanstack/react-query.gen';
import type { PaginatedMessagesResponseDto } from '../../api-client';
import {
  createTestQueryClient,
  createMockSocket,
  createInfiniteData,
} from '../test-utils';
import type { MockSocket } from '../test-utils';
import type { Message } from '../../types/message.type';
import { SocketContext } from '../../utils/SocketContext';

let queryClient: ReturnType<typeof createTestQueryClient>;
let mockSocket: MockSocket;

const queryKey = channelMessagesQueryKey('ch-1');

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(
      SocketContext.Provider,
      { value: { socket: mockSocket as never, isConnected: true } },
      React.createElement(NotificationProvider, null, children),
    ),
  );
}

function cacheMessages(): Message[] {
  const data = queryClient.getQueryData<InfiniteData<PaginatedMessagesResponseDto>>(queryKey);
  return (data?.pages.flatMap(p => p.messages) ?? []) as unknown as Message[];
}

beforeEach(() => {
  queryClient = createTestQueryClient();
  mockSocket = createMockSocket();
  queryClient.setQueryData(userControllerGetProfileQueryKey(), { id: 'me', username: 'me' });
  queryClient.setQueryData(queryKey, createInfiniteData([]));
});

describe('useMessageFileUpload — optimistic routing (PR-13 scope guard)', () => {
  it('inserts an optimistic pending row for a plain (no-attachment) send', async () => {
    mockSocket.emit.mockImplementation(() => {
      /* never acks — just checking the synchronous insert */
    });

    const { result } = renderHook(
      () => useMessageFileUpload({ contextType: VoiceSessionType.Channel, contextId: 'ch-1', authorId: 'me' }),
      { wrapper },
    );

    act(() => {
      void result.current.handleSendMessage('hello', [{ type: 'PLAINTEXT' as never, text: 'hello' }]);
    });

    const messages = cacheMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].sendStatus).toBe('pending');
  });

  it('does NOT insert an optimistic row for a send with attachments (v1 scope exclusion)', async () => {
    mockSocket.emit.mockImplementation(() => {
      /* never acks — checking that no pending row appears regardless */
    });

    const { result } = renderHook(
      () => useMessageFileUpload({ contextType: VoiceSessionType.Channel, contextId: 'ch-1', authorId: 'me' }),
      { wrapper },
    );

    const file = new File(['data'], 'photo.png', { type: 'image/png' });

    act(() => {
      void result.current.handleSendMessage('hello', [{ type: 'PLAINTEXT' as never, text: 'hello' }], [file]);
    });

    // The raw (non-optimistic) sender was used — no pending row in the cache.
    expect(cacheMessages()).toHaveLength(0);
    expect(mockSocket.emit).toHaveBeenCalled();
  });
});
