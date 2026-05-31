/**
 * Heavy multi-party + degraded-transport coverage (Piece C). Tagged @slow so the
 * PR pipeline can skip it (`--grep-invert @slow`); runs on nightly / manual.
 *
 *   1. 4-PARTICIPANT ALL-PAIRS MATRIX — all 12 ordered pairings hear each other.
 *      This is the strongest guard against the "one specific person can't hear
 *      another" asymmetry class, at a party size bigger than the 3 used elsewhere.
 *   2. FORCE-TCP DEGRADED TRANSPORT — a participant reconnects over TCP
 *      (simulateScenario('force-tcp')); audio must still flow both ways. Proves
 *      voice survives UDP being blocked (restrictive networks / firewalls).
 *
 * NOTE on deafen & per-participant volume: both are LOCAL playback concerns
 * (deafen sets <audio>.muted, volume sets the element gain) and do NOT change
 * what is received over the network — inbound getStats still grows. They have no
 * real-LiveKit-observable signal, so they're covered by unit tests rather than
 * faked here.
 *
 * Requires the real-LiveKit stack: scripts/run-voice-e2e.sh
 */
import { test } from '@playwright/test';
import {
  launchParticipant,
  joinVoiceChannel,
  closeParticipant,
  waitForAudioFlow,
  forceReconnect,
  ADMIN_USER,
  TEST_USER,
  TEST_USER_2,
  TEST_USER_3,
  type Participant,
} from '../fixtures/voice.fixture';
import { expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const CH = 'voice-matrix';

test.describe('@slow heavy multi-party + degraded transport', () => {
  test('4-participant all-pairs audio matrix: everyone hears everyone', async () => {
    const participants: Participant[] = [];
    try {
      const a = await launchParticipant(TEST_USER, 'sample-a.wav');
      const b = await launchParticipant(TEST_USER_2, 'sample-b.wav');
      const c = await launchParticipant(ADMIN_USER, 'sample-c.wav');
      // 4th participant (a 4th OWNER) reuses a tone — identity, not tone, is what
      // the audio-flow assertion keys on.
      const d = await launchParticipant(TEST_USER_3, 'sample-b.wav');
      participants.push(a, b, c, d);

      for (const p of participants) await joinVoiceChannel(p, CH);

      // All 12 ordered pairings (4×3) must have audio flowing.
      for (const from of participants) {
        for (const remote of participants) {
          if (from === remote) continue;
          await waitForAudioFlow(from, remote, { timeout: 40_000 });
        }
      }
    } finally {
      await Promise.all(participants.map((p) => closeParticipant(p).catch(() => {})));
    }
  });

  test('force-tcp: audio survives a TCP-only reconnect', async () => {
    const participants: Participant[] = [];
    try {
      const a = await launchParticipant(TEST_USER, 'sample-a.wav');
      const b = await launchParticipant(TEST_USER_2, 'sample-b.wav');
      participants.push(a, b);
      await joinVoiceChannel(a, CH);
      await joinVoiceChannel(b, CH);

      // Baseline both directions.
      await waitForAudioFlow(a, b);
      await waitForAudioFlow(b, a);

      // Force A onto TCP transport.
      await forceReconnect(a, 'force-tcp');
      await expect
        .poll(() => a.page.evaluate(() => window.__lkRoom?.state ?? 'none'), {
          timeout: 40_000,
          message: 'A did not recover after force-tcp',
        })
        .toBe('connected');

      // Audio still flows both ways over the degraded transport.
      await waitForAudioFlow(a, b, { timeout: 40_000 });
      await waitForAudioFlow(b, a, { timeout: 40_000 });
    } finally {
      await Promise.all(participants.map((p) => closeParticipant(p).catch(() => {})));
    }
  });
});
