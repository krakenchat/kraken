import type { ServerEventPayloads } from '@kraken/shared';

type Handler<T = unknown> = (event: T) => void;

export interface EventBus {
  on<E extends keyof ServerEventPayloads>(event: E, handler: Handler<ServerEventPayloads[E]>): void;
  off<E extends keyof ServerEventPayloads>(event: E, handler: Handler<ServerEventPayloads[E]>): void;
  emit<E extends keyof ServerEventPayloads>(event: E, payload: ServerEventPayloads[E]): void;
  /** Remove all listeners */
  clear(): void;
}

/**
 * Minimal typed event emitter (replaces mitt).
 * Supports typed on/off/emit for ServerEventPayloads.
 */
export function createEventBus(): EventBus {
  const handlers = new Map<string, Set<Handler>>();

  return {
    on(event, handler) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler as Handler);
    },
    off(event, handler) {
      handlers.get(event)?.delete(handler as Handler);
    },
    emit(event, payload) {
      const set = handlers.get(event);
      if (set) {
        for (const h of set) h(payload);
      }
    },
    clear() {
      handlers.clear();
    },
  };
}
