import type { QueryClient } from '@tanstack/react-query';
import type { ServerEventPayloads } from '@kraken/shared';

/**
 * A pure handler function that updates TanStack Query cache in response
 * to a WebSocket event. No React dependencies — just payload + queryClient.
 */
export type SocketEventHandler<E extends keyof ServerEventPayloads> = (
  payload: ServerEventPayloads[E],
  queryClient: QueryClient,
) => void | Promise<void>;
