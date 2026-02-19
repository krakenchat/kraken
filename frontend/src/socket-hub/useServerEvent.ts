import { useContext, useEffect, useRef } from 'react';
import type { ServerEventPayloads } from '@kraken/shared';
import { SocketHubContext } from './SocketHubContext';

/**
 * Subscribe to a server event for UI side effects (sounds, notifications, scroll).
 * Cache updates are handled by the hub — this hook is for component reactions only.
 *
 * Uses a ref pattern so consumers don't need useCallback and there's no
 * subscribe/unsubscribe churn on re-renders.
 */
export function useServerEvent<E extends keyof ServerEventPayloads>(
  event: E,
  callback: (payload: ServerEventPayloads[E]) => void,
): void {
  const eventBus = useContext(SocketHubContext);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!eventBus) return;

    const handler = (payload: ServerEventPayloads[E]) => {
      callbackRef.current(payload);
    };

    eventBus.on(event, handler);
    return () => {
      eventBus.off(event, handler);
    };
  }, [eventBus, event]);
}
