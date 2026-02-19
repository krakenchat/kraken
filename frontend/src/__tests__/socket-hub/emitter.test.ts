import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from '../../socket-hub/emitter';
import { ServerEvents } from '@kraken/shared';
import type { NewMessagePayload } from '@kraken/shared';

describe('createEventBus', () => {
  it('calls handler when event is emitted', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const payload = { message: { id: '1' } } as unknown as NewMessagePayload;

    bus.on(ServerEvents.NEW_MESSAGE, handler);
    bus.emit(ServerEvents.NEW_MESSAGE, payload);

    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('supports multiple handlers for the same event', () => {
    const bus = createEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    const payload = { message: { id: '1' } } as unknown as NewMessagePayload;

    bus.on(ServerEvents.NEW_MESSAGE, h1);
    bus.on(ServerEvents.NEW_MESSAGE, h2);
    bus.emit(ServerEvents.NEW_MESSAGE, payload);

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('removes handler with off', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const payload = { message: { id: '1' } } as unknown as NewMessagePayload;

    bus.on(ServerEvents.NEW_MESSAGE, handler);
    bus.off(ServerEvents.NEW_MESSAGE, handler);
    bus.emit(ServerEvents.NEW_MESSAGE, payload);

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not throw when emitting an event with no handlers', () => {
    const bus = createEventBus();
    expect(() => {
      bus.emit(ServerEvents.NEW_MESSAGE, { message: { id: '1' } } as unknown as NewMessagePayload);
    }).not.toThrow();
  });

  it('clear removes all handlers', () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.on(ServerEvents.NEW_MESSAGE, handler);
    bus.on(ServerEvents.USER_ONLINE, vi.fn());
    bus.clear();
    bus.emit(ServerEvents.NEW_MESSAGE, { message: { id: '1' } } as unknown as NewMessagePayload);

    expect(handler).not.toHaveBeenCalled();
  });
});
