import { useEffect, useRef } from 'react';
import { voicePresenceControllerRefreshPresence } from '../api-client/sdk.gen';
import { logger } from '../utils/logger';

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Sends periodic presence heartbeats to keep the Redis TTL alive
 * while the user is connected to a voice channel.
 *
 * Without this, the 5-minute TTL in Redis would expire and the user
 * would disappear from the sidebar even though they're still connected.
 */
export function useVoicePresenceHeartbeat(channelId: string | null) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!channelId) {
      return;
    }

    const sendHeartbeat = async () => {
      try {
        await voicePresenceControllerRefreshPresence({
          path: { channelId },
        });
      } catch (err) {
        logger.warn('[VoicePresenceHeartbeat] Failed to refresh presence:', err);
      }
    };

    // Send immediately on mount, then every 30 seconds
    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [channelId]);
}
