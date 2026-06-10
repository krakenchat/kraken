/**
 * Domain event contract for voice presence changes.
 *
 * Lives in `common/events` so the VoicePresence module (emitter) does not
 * need to import the LiveKit module (listener) — this breaks the
 * VoicePresenceModule -> LivekitModule edge of the former
 * LivekitModule <-> VoicePresenceModule circular dependency.
 *
 * Emitted fire-and-forget with `EventEmitter2.emit`; listeners must handle
 * their own errors (cleanup must never fail the presence operation).
 */
export const VOICE_USER_LEFT = 'voice.user.left';

/** Emitted when a user leaves a voice channel so other modules can clean up
 *  (e.g. LiveKit stops any active replay buffer egress for the user). */
export interface VoiceUserLeftEvent {
  userId: string;
  channelId: string;
}
