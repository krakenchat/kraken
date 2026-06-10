/**
 * Domain event contract for replay-clip message creation.
 *
 * Lives in `common/events` so neither the LiveKit module (emitter) nor the
 * Messages module (listener) needs to import the other — this breaks the
 * LivekitModule -> MessagesModule edge of the former circular dependency:
 * MessagesModule -> RoomsModule -> VoicePresenceModule -> LivekitModule -> MessagesModule.
 *
 * Emitted with `EventEmitter2.emitAsync` (request/response semantics): the
 * emitter awaits the listener and receives `ClipMessageCreateResult` back.
 */
export const CLIP_MESSAGE_CREATE = 'clip.message.create';

/** Payload for requesting a clip message; the messages module owns creation + broadcast. */
export interface ClipMessageCreateEvent {
  authorId: string;
  fileId: string;
  durationSeconds: number;
  sizeMB: number;
  destination: 'channel' | 'dm';
  targetChannelId?: string;
  targetDirectMessageGroupId?: string;
}

export interface ClipMessageCreateResult {
  messageId: string;
}
