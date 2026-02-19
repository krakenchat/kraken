import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { ServerEvents, ClientEvents } from '@kraken/shared';
import { useSocketHub } from '../../socket-hub/useSocketHub';
import { createEventBus } from '../../socket-hub/emitter';
import { createMockSocket } from '../test-utils/mockSocket';
import { createTestWrapper } from '../test-utils/wrappers';

describe('useSocketHub', () => {
  let queryClient: QueryClient;
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockSocket = createMockSocket();
  });

  it('subscribes to all ServerEvents on the socket', () => {
    const eventBus = createEventBus();
    const wrapper = createTestWrapper({ queryClient, socket: mockSocket });

    renderHook(() => useSocketHub(eventBus), { wrapper });

    // Should have called socket.on for every ServerEvent value
    const allEvents = Object.values(ServerEvents);
    for (const event of allEvents) {
      expect(mockSocket.on).toHaveBeenCalledWith(event, expect.any(Function));
    }
  });

  it('emits SUBSCRIBE_ALL and PRESENCE_ONLINE on connect', async () => {
    const eventBus = createEventBus();
    const wrapper = createTestWrapper({ queryClient, socket: mockSocket });

    renderHook(() => useSocketHub(eventBus), { wrapper });

    // Simulate socket connect
    await act(async () => {
      await mockSocket.simulateEvent('connect');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith(ClientEvents.SUBSCRIBE_ALL);
    expect(mockSocket.emit).toHaveBeenCalledWith(ClientEvents.PRESENCE_ONLINE);
  });

  it('re-emits socket events on the event bus', async () => {
    const eventBus = createEventBus();
    const wrapper = createTestWrapper({ queryClient, socket: mockSocket });
    const handler = vi.fn();

    renderHook(() => useSocketHub(eventBus), { wrapper });

    eventBus.on(ServerEvents.USER_ONLINE, handler);

    const payload = { userId: 'u1' };
    await act(async () => {
      await mockSocket.simulateEvent(ServerEvents.USER_ONLINE, payload);
    });

    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('cleans up socket listeners on unmount', () => {
    const eventBus = createEventBus();
    const wrapper = createTestWrapper({ queryClient, socket: mockSocket });

    const { unmount } = renderHook(() => useSocketHub(eventBus), { wrapper });

    const offCallCountBefore = mockSocket.off.mock.calls.length;
    unmount();

    // off should have been called for all events + the 'connect' listener
    expect(mockSocket.off.mock.calls.length).toBeGreaterThan(offCallCountBefore);
  });
});
