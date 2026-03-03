import type { ParticipantMediaState } from "../../../hooks/useParticipantTracks";

export interface VoiceUserState {
  isMuted: boolean;
  isDeafened: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isServerMuted: boolean;
}

/**
 * Derives a user's voice state by preferring LiveKit direct state
 * when a participant is connected, falling back to server-reported state.
 */
export function deriveUserState(
  livekitState: ParticipantMediaState,
  serverState: {
    isMuted?: boolean;
    isDeafened?: boolean;
    isVideoEnabled?: boolean;
    isScreenSharing?: boolean;
    isServerMuted?: boolean;
  },
): VoiceUserState {
  return {
    isMuted: livekitState.participant
      ? !livekitState.isMicrophoneEnabled
      : Boolean(serverState.isMuted),
    isDeafened: livekitState.participant
      ? livekitState.isDeafened
      : Boolean(serverState.isDeafened),
    isVideoEnabled: livekitState.participant
      ? livekitState.isCameraEnabled
      : Boolean(serverState.isVideoEnabled),
    isScreenSharing: livekitState.participant
      ? livekitState.isScreenShareEnabled
      : Boolean(serverState.isScreenSharing),
    isServerMuted: Boolean(serverState.isServerMuted),
  };
}
