import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ServerEvents, ClientEvents } from '@kraken/shared';
import type { ServerEventPayloads } from '@kraken/shared';
import { useSocket } from '../hooks/useSocket';
import { handlerRegistry } from './handlers';
import { handleReconnect } from './handlers/reconnectHandlers';
import type { EventBus } from './emitter';
import { logger } from '../utils/logger';

const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * All ServerEvents values as an array, used to subscribe to every event.
 */
const ALL_SERVER_EVENTS = Object.values(ServerEvents) as (keyof ServerEventPayloads)[];

/**
 * Central hub hook: subscribes to ALL socket events, runs cache handlers,
 * re-emits to the event bus, and manages auto-subscribe + presence heartbeat.
 *
 * Must be called exactly once (inside SocketHubProvider).
 */
export function useSocketHub(eventBus: EventBus) {
  const socket = useSocket();
  const queryClient = useQueryClient();

  // Track first connect vs reconnect to skip unnecessary invalidation on initial load
  const hasConnectedRef = useRef(false);

  // --- Auto-subscribe + heartbeat + reconnect ---
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      // Auto-subscribe to all rooms
      socket.emit(ClientEvents.SUBSCRIBE_ALL);

      // Send initial heartbeat
      socket.emit(ClientEvents.PRESENCE_ONLINE);

      // On reconnect (not first connect), invalidate stale caches
      if (hasConnectedRef.current) {
        logger.dev('[SocketHub] Reconnected — invalidating stale caches');
        handleReconnect(queryClient);
      }
      hasConnectedRef.current = true;
    };

    // If already connected, fire immediately
    if (socket.connected) {
      handleConnect();
    }

    socket.on('connect', handleConnect);

    // Presence heartbeat interval
    const heartbeatId = setInterval(() => {
      if (socket.connected) {
        socket.emit(ClientEvents.PRESENCE_ONLINE);
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      socket.off('connect', handleConnect);
      clearInterval(heartbeatId);
    };
  }, [socket, queryClient]);

  // --- Event subscriptions: cache handlers + event bus re-emit ---
  useEffect(() => {
    if (!socket) return;

    const listeners: Array<[string, (...args: unknown[]) => void]> = [];

    for (const event of ALL_SERVER_EVENTS) {
      const listener = async (payload: ServerEventPayloads[typeof event]) => {
        // 1. Run cache handlers (if any)
        const handlers = handlerRegistry[event];
        if (handlers) {
          for (const handler of handlers) {
            try {
              await (handler as (p: typeof payload, qc: typeof queryClient) => void | Promise<void>)(
                payload,
                queryClient,
              );
            } catch (err) {
              logger.error(`[SocketHub] Handler error for ${event}:`, err);
            }
          }
        }

        // 2. Re-emit on event bus for UI side effects
        eventBus.emit(event, payload);
      };

      socket.on(event as string, listener as never);
      listeners.push([event as string, listener as never]);
    }

    return () => {
      for (const [event, listener] of listeners) {
        socket.off(event as string, listener as never);
      }
    };
  }, [socket, queryClient, eventBus]);
}
