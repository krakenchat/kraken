import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../api-client/client.gen', () => ({
  client: {
    getConfig: () => ({ baseUrl: 'http://localhost:3000' }),
  },
}));

import { useAutoSubscribe } from '../../hooks/useAutoSubscribe';
import {
  createTestQueryClient,
  createMockSocket,
  createTestWrapper,
} from '../test-utils';
import type { MockSocket } from '../test-utils';

let queryClient: ReturnType<typeof createTestQueryClient>;
let mockSocket: MockSocket;

beforeEach(() => {
  queryClient = createTestQueryClient();
  mockSocket = createMockSocket();
});

function renderAutoSubscribe(socket: MockSocket | null = mockSocket) {
  return renderHook(() => useAutoSubscribe(), {
    wrapper: createTestWrapper({ queryClient, socket }),
  });
}

describe('useAutoSubscribe', () => {
  it('emits SUBSCRIBE_ALL immediately when socket is already connected', () => {
    mockSocket.connected = true;

    renderAutoSubscribe();

    expect(mockSocket.emit).toHaveBeenCalledWith('subscribeAll');
  });

  it('registers connect event handler on mount', () => {
    renderAutoSubscribe();

    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('emits SUBSCRIBE_ALL when socket connect event fires', async () => {
    mockSocket.connected = false;

    renderAutoSubscribe();

    mockSocket.emit.mockClear();

    await act(() => mockSocket.simulateEvent('connect'));

    expect(mockSocket.emit).toHaveBeenCalledWith('subscribeAll');
  });

  it('unregisters connect handler on unmount', () => {
    const { unmount } = renderAutoSubscribe();

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
  });

  it('does not emit when socket is null', () => {
    renderAutoSubscribe(null);

    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('does not emit immediately when socket is not yet connected', () => {
    mockSocket.connected = false;

    renderAutoSubscribe();

    expect(mockSocket.emit).not.toHaveBeenCalledWith('subscribeAll');
  });
});
