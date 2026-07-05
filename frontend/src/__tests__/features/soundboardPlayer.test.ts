import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Track } from 'livekit-client';
import {
  soundboardPlayer,
  SOUNDBOARD_TRACK_NAME,
} from '../../features/voice/soundboardPlayer';

// --- Mock WebAudio (jsdom has no AudioContext) ---
const decodedBuffer = { duration: 1 } as unknown as AudioBuffer;

function createMockSource() {
  return {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as null | (() => void),
  };
}

let lastSource: ReturnType<typeof createMockSource>;
let mockDestinationTrack: { id: string };
const closeSpy = vi.fn();
const resumeSpy = vi.fn().mockResolvedValue(undefined);
const decodeSpy = vi.fn().mockResolvedValue(decodedBuffer);

class MockAudioContext {
  state = 'running';
  destination = { name: 'ctx-destination' };
  createMediaStreamDestination() {
    mockDestinationTrack = { id: 'sb-track' };
    return { stream: { getAudioTracks: () => [mockDestinationTrack] } };
  }
  createBufferSource() {
    lastSource = createMockSource();
    return lastSource;
  }
  decodeAudioData(buf: ArrayBuffer) {
    return decodeSpy(buf);
  }
  resume() {
    return resumeSpy();
  }
  close() {
    this.state = 'closed';
    return closeSpy();
  }
}

// --- Mock LiveKit Room / localParticipant ---
function createMockRoom() {
  const publications = new Map<string, unknown>();
  const publishTrack = vi.fn().mockImplementation((_track, opts) => {
    const pub = {
      trackSid: 'pub-sid',
      trackName: opts.name,
      source: opts.source,
      track: { mediaStreamTrack: _track },
    };
    publications.set(pub.trackSid, pub);
    return Promise.resolve(pub);
  });
  const unpublishTrack = vi.fn().mockResolvedValue(undefined);
  return {
    localParticipant: {
      trackPublications: publications,
      publishTrack,
      unpublishTrack,
    },
  };
}

describe('soundboardPlayer', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', MockAudioContext);
    decodeSpy.mockClear();
    resumeSpy.mockClear();
    closeSpy.mockClear();
  });

  afterEach(async () => {
    await soundboardPlayer.dispose(null);
    vi.unstubAllGlobals();
  });

  it('publishes a track named "soundboard" with Source.Unknown on first play', async () => {
    const room = createMockRoom();
    const buf = new ArrayBuffer(8);

    await soundboardPlayer.play(room as never, 'file-1', buf);

    expect(room.localParticipant.publishTrack).toHaveBeenCalledTimes(1);
    const [, opts] = room.localParticipant.publishTrack.mock.calls[0];
    expect(opts.name).toBe(SOUNDBOARD_TRACK_NAME);
    expect(opts.source).toBe(Track.Source.Unknown);
    expect(lastSource.start).toHaveBeenCalled();
    // Connects to both the remote destination and the local monitor
    expect(lastSource.connect).toHaveBeenCalledTimes(2);
  });

  it('reuses the published track and caches the decoded buffer on repeat plays', async () => {
    const room = createMockRoom();
    const buf = new ArrayBuffer(8);

    await soundboardPlayer.play(room as never, 'file-1', buf);
    const firstSource = lastSource;
    await soundboardPlayer.play(room as never, 'file-1', buf);

    // Only published once for the session
    expect(room.localParticipant.publishTrack).toHaveBeenCalledTimes(1);
    // Decoded once (cached by fileId)
    expect(decodeSpy).toHaveBeenCalledTimes(1);
    // Previous source was stopped (stop-and-restart)
    expect(firstSource.stop).toHaveBeenCalled();
  });

  it('unpublishes the track and closes the context on dispose', async () => {
    const room = createMockRoom();
    await soundboardPlayer.play(room as never, 'file-1', new ArrayBuffer(8));

    await soundboardPlayer.dispose(room as never);

    expect(room.localParticipant.unpublishTrack).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalled();
  });

  it('does nothing harmful when disposed without ever playing', async () => {
    await expect(soundboardPlayer.dispose(null)).resolves.toBeUndefined();
  });

  it('warmup eagerly publishes the track without playing anything', async () => {
    const room = createMockRoom();

    await soundboardPlayer.warmup(room as never);

    expect(room.localParticipant.publishTrack).toHaveBeenCalledTimes(1);
    const [, opts] = room.localParticipant.publishTrack.mock.calls[0];
    expect(opts.name).toBe(SOUNDBOARD_TRACK_NAME);
    // Nothing decoded or started
    expect(decodeSpy).not.toHaveBeenCalled();
  });

  it('play after warmup reuses the already-published track', async () => {
    const room = createMockRoom();

    await soundboardPlayer.warmup(room as never);
    await soundboardPlayer.play(room as never, 'file-1', new ArrayBuffer(8));

    expect(room.localParticipant.publishTrack).toHaveBeenCalledTimes(1);
    expect(lastSource.start).toHaveBeenCalled();
  });

  it('warmup swallows publish errors (play retries later)', async () => {
    const room = createMockRoom();
    room.localParticipant.publishTrack.mockRejectedValueOnce(
      new Error('not connected'),
    );

    await expect(
      soundboardPlayer.warmup(room as never),
    ).resolves.toBeUndefined();
  });
});
