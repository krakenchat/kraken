import { useQuery } from "@tanstack/react-query";
import {
  voicePresenceControllerGetChannelPresenceOptions,
  dmVoicePresenceControllerGetDmPresenceOptions,
} from "../api-client/@tanstack/react-query.gen";
import { VoiceSessionType } from "../contexts/VoiceContext";

interface UseVoiceParticipantCountParams {
  /** The channel ID (for channel voice) */
  channelId?: string | null;
  /** The DM group ID (for DM voice) */
  dmGroupId?: string | null;
  /** The context type - 'channel' or 'dm' */
  contextType: VoiceSessionType;
}

interface UseVoiceParticipantCountResult {
  /** Number of participants in the voice session */
  participantCount: number;
  /** Whether the query is loading */
  isLoading: boolean;
}

/**
 * Hook to get the participant count for a voice session
 *
 * Handles both channel voice and DM voice contexts, fetching
 * presence data from the appropriate endpoint.
 *
 * @param params - Object with channelId, dmGroupId, and contextType
 * @returns Object with participantCount and isLoading state
 *
 * @example
 * ```tsx
 * const { participantCount, isLoading } = useVoiceParticipantCount({
 *   channelId: state.currentChannelId,
 *   dmGroupId: state.currentDmGroupId,
 *   contextType: state.contextType,
 * });
 *
 * return <Badge badgeContent={participantCount}>...</Badge>;
 * ```
 */
export function useVoiceParticipantCount({
  channelId,
  dmGroupId,
  contextType,
}: UseVoiceParticipantCountParams): UseVoiceParticipantCountResult {
  const {
    data: channelPresence,
    isLoading: isChannelLoading,
  } = useQuery({
    ...voicePresenceControllerGetChannelPresenceOptions({ path: { channelId: channelId ?? "" } }),
    enabled: !!channelId && contextType === VoiceSessionType.Channel,
  });

  const {
    data: dmPresence,
    isLoading: isDmLoading,
  } = useQuery({
    ...dmVoicePresenceControllerGetDmPresenceOptions({ path: { dmGroupId: dmGroupId ?? "" } }),
    enabled: !!dmGroupId && contextType === VoiceSessionType.Dm,
  });

  const participantCount =
    contextType === VoiceSessionType.Channel
      ? channelPresence?.count ?? 0
      : dmPresence?.count ?? 0;

  const isLoading =
    contextType === VoiceSessionType.Channel ? isChannelLoading : isDmLoading;

  return {
    participantCount,
    isLoading,
  };
}
