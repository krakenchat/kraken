import { InternalServerErrorException } from '@nestjs/common';
import {
  CLIP_MESSAGE_CREATE,
  ClipMessageCreateEvent,
  emitClipMessageCreate,
} from './clip-message.events';

const EVENT: ClipMessageCreateEvent = {
  authorId: 'user-1',
  fileId: 'file-1',
  durationSeconds: 60,
  sizeMB: 10,
  destination: 'channel',
  targetChannelId: 'channel-1',
};

function makeEmitter(results: unknown[]) {
  return { emitAsync: jest.fn().mockResolvedValue(results) };
}

describe('emitClipMessageCreate', () => {
  it('emits CLIP_MESSAGE_CREATE with the payload and returns the single result', async () => {
    const emitter = makeEmitter([{ messageId: 'msg-1' }]);

    const result = await emitClipMessageCreate(emitter, EVENT);

    expect(emitter.emitAsync).toHaveBeenCalledWith(CLIP_MESSAGE_CREATE, EVENT);
    expect(result).toEqual({ messageId: 'msg-1' });
  });

  it('throws when no listener handled the event (empty result array)', async () => {
    const emitter = makeEmitter([]);

    await expect(emitClipMessageCreate(emitter, EVENT)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('throws when multiple listeners handled the event', async () => {
    const emitter = makeEmitter([
      { messageId: 'msg-1' },
      { messageId: 'msg-2' },
    ]);

    await expect(emitClipMessageCreate(emitter, EVENT)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('throws when the listener returned no messageId (e.g. swallowed error)', async () => {
    const emitter = makeEmitter([undefined]);

    await expect(emitClipMessageCreate(emitter, EVENT)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('propagates listener rejections unchanged', async () => {
    const emitter = {
      emitAsync: jest.fn().mockRejectedValue(new Error('create failed')),
    };

    await expect(emitClipMessageCreate(emitter, EVENT)).rejects.toThrow(
      'create failed',
    );
  });
});
