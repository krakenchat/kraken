import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { ServerEvents } from '@kraken/shared';
import type { NewMessagePayload } from '@kraken/shared';
import { useServerEvent } from '../../socket-hub/useServerEvent';
import { createEventBus } from '../../socket-hub/emitter';
import { createTestHubWrapper, createTestWrapper } from '../test-utils/wrappers';

describe('useServerEvent', () => {
  it('calls callback when event is emitted on bus', () => {
    const queryClient = new QueryClient();
    const eventBus = createEventBus();
    const callback = vi.fn();
    const payload = { message: { id: 'm1' } } as unknown as NewMessagePayload;

    renderHook(() => useServerEvent(ServerEvents.NEW_MESSAGE, callback), {
      wrapper: createTestHubWrapper({ queryClient, eventBus }),
    });

    eventBus.emit(ServerEvents.NEW_MESSAGE, payload);
    expect(callback).toHaveBeenCalledWith(payload);
  });

  it('does not call callback after unmount', () => {
    const queryClient = new QueryClient();
    const eventBus = createEventBus();
    const callback = vi.fn();

    const { unmount } = renderHook(
      () => useServerEvent(ServerEvents.NEW_MESSAGE, callback),
      { wrapper: createTestHubWrapper({ queryClient, eventBus }) },
    );

    unmount();
    eventBus.emit(ServerEvents.NEW_MESSAGE, { message: { id: 'm1' } } as unknown as NewMessagePayload);
    expect(callback).not.toHaveBeenCalled();
  });

  it('always calls the latest callback (ref pattern)', () => {
    const queryClient = new QueryClient();
    const eventBus = createEventBus();
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    const { rerender } = renderHook(
      ({ cb }) => useServerEvent(ServerEvents.NEW_MESSAGE, cb),
      {
        wrapper: createTestHubWrapper({ queryClient, eventBus }),
        initialProps: { cb: cb1 },
      },
    );

    // Re-render with different callback
    rerender({ cb: cb2 });

    eventBus.emit(ServerEvents.NEW_MESSAGE, { message: { id: 'm1' } } as unknown as NewMessagePayload);
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it('is a no-op when no SocketHubContext is provided', () => {
    const queryClient = new QueryClient();
    const callback = vi.fn();

    // Use the non-hub wrapper (no SocketHubContext)
    renderHook(() => useServerEvent(ServerEvents.NEW_MESSAGE, callback), {
      wrapper: createTestWrapper({ queryClient }),
    });

    // No crash, callback never called
    expect(callback).not.toHaveBeenCalled();
  });
});
