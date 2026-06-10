import { InternalServerErrorException } from '@nestjs/common';

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

/**
 * Emit CLIP_MESSAGE_CREATE and return the single listener's result.
 *
 * Guards the request/response contract: exactly one listener
 * (ClipMessageListener in the messages module) must handle the event. If the
 * listener is missing from the module graph, emitAsync resolves to [] and the
 * caller would otherwise crash on `undefined.messageId` — throw a clear error
 * instead. Listener exceptions propagate unchanged (the handler is registered
 * with suppressErrors: false), preserving HTTP error semantics.
 */
export async function emitClipMessageCreate(
  eventEmitter: {
    emitAsync(event: string, payload: ClipMessageCreateEvent): Promise<any[]>;
  },
  payload: ClipMessageCreateEvent,
): Promise<ClipMessageCreateResult> {
  const results = (await eventEmitter.emitAsync(
    CLIP_MESSAGE_CREATE,
    payload,
  )) as Array<ClipMessageCreateResult | undefined>;

  if (results.length !== 1) {
    throw new InternalServerErrorException(
      `CLIP_MESSAGE_CREATE expected exactly one listener result, got ${results.length}`,
    );
  }
  const result = results[0];
  if (!result?.messageId) {
    throw new InternalServerErrorException(
      'CLIP_MESSAGE_CREATE listener returned no messageId (was the error suppressed?)',
    );
  }
  return result;
}
