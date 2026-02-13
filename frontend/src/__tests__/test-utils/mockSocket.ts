import { vi } from 'vitest';

type Handler = (...args: unknown[]) => void;

export interface MockSocket {
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  /** Invoke all registered handlers for a given event name */
  simulateEvent: (event: string, ...args: unknown[]) => Promise<void>;
  /** Get all handlers currently registered for an event */
  getHandlers: (event: string) => Handler[];
}

export function createMockSocket(): MockSocket {
  const handlers = new Map<string, Set<Handler>>();

  const on = vi.fn((event: string, handler: Handler) => {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(handler);
  });

  const off = vi.fn((event: string, handler: Handler) => {
    handlers.get(event)?.delete(handler);
  });

  const emit = vi.fn();

  const simulateEvent = async (event: string, ...args: unknown[]) => {
    const eventHandlers = handlers.get(event);
    if (!eventHandlers) return;
    const results = [...eventHandlers].map(h => h(...args));
    // Await any promises returned by async handlers
    await Promise.all(results);
  };

  const getHandlers = (event: string): Handler[] => {
    return [...(handlers.get(event) ?? [])];
  };

  return { on, off, emit, simulateEvent, getHandlers };
}
