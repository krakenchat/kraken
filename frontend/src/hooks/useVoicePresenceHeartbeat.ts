import { useEffect, useRef } from 'react';
import { voicePresenceControllerRefreshPresence } from '../api-client/sdk.gen';
import { dmVoicePresenceControllerRefreshDmPresence } from '../api-client/sdk.gen';
import { logger } from '../utils/logger';

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

interface VoicePresenceHeartbeatParams {
  channelId: string | null;
  dmGroupId: string | null;
  contextType: 'channel' | 'dm' | null;
}

/**
 * Sends periodic presence heartbeats to keep the Redis TTL alive
 * while the user is connected to a voice channel or DM call.
 *
 * Without this, the 5-minute TTL in Redis would expire and the user
 * would disappear from the sidebar even though they're still connected.
 */
export function useVoicePresenceHeartbeat({
  channelId,
  dmGroupId,
  contextType,
}: VoicePresenceHeartbeatParams) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const isChannel = contextType === 'channel' && channelId;
    const isDm = contextType === 'dm' && dmGroupId;

    if (!isChannel && !isDm) {
      return;
    }

    const sendHeartbeat = async () => {
      try {
        if (isChannel) {
          await voicePresenceControllerRefreshPresence({
            path: { channelId },
          });
        } else if (isDm) {
          await dmVoicePresenceControllerRefreshDmPresence({
            path: { dmGroupId },
          });
        }
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
  }, [channelId, dmGroupId, contextType]);
}
