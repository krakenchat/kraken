/**
 * PR #352 validation — resilient voice subscriptions (audio asymmetry fix).
 *
 * Reproduces the original bug shape (a single client's reconnect silently drops
 * its mic subscriptions to peers, producing one-way audio) and proves the fix:
 * on RoomEvent.Reconnected the client force-resubscribes, so audio self-heals.
 *
 * "Can A hear B" is asserted via WebRTC inbound getStats (bytes + energy
 * increasing), read through the dev window hook — no human listener needed.
 *
 * Requires the real-LiveKit stack: scripts/run-voice-e2e.sh
 */
import { test, expect } from '@playwright/test';
import {
  launchParticipant,
  joinVoiceChannel,
  waitForAudioFlow,
  getInboundAudioStats,
  forceReconnect,
  forceResubscribeMic,
  captureDiagnostics,
  closeParticipant,
  ADMIN_USER,
  TEST_USER,
  TEST_USER_2,
  type Participant,
} from '../fixtures/voice.fixture';

// Multi-browser voice tests are heavy and share the same room — run serially.
test.describe.configure({ mode: 'serial' });

test.describe('PR #352 — voice subscription resilience', () => {
  let a: Participant;
  let b: Participant;
  let c: Participant;

  test.beforeAll(async () => {
    // Distinct fake-audio tones so each participant is a recognisable source.
    a = await launchParticipant(TEST_USER, 'sample-a.wav');
    b = await launchParticipant(TEST_USER_2, 'sample-b.wav');
    c = await launchParticipant(ADMIN_USER, 'sample-c.wav');
    // Dedicated room so this heavy reconnect spec can't contaminate others.
    await joinVoiceChannel(a, 'voice-reconnect');
    await joinVoiceChannel(b, 'voice-reconnect');
    await joinVoiceChannel(c, 'voice-reconnect');
  });

  test.afterAll(async () => {
    await Promise.all([a, b, c].filter(Boolean).map(closeParticipant));
  });

  test('baseline: all three participants hear each other', async () => {
    // All 6 ordered pairings must have audio flowing.
    await waitForAudioFlow(a, b);
    await waitForAudioFlow(a, c);
    await waitForAudioFlow(b, a);
    await waitForAudioFlow(b, c);
    await waitForAudioFlow(c, a);
    await waitForAudioFlow(c, b);
  });

  test('audio self-heals on A after a signal reconnect (the asymmetry repro)', async () => {
    // Force A to reconnect — the scenario that historically dropped A's mic
    // subscriptions to B and C while B/C kept hearing each other.
    await forceReconnect(a, 'signal-reconnect');

    // Wait for A's room to settle back to connected.
    await expect
      .poll(
        () => a.page.evaluate(() => window.__lkRoom?.state ?? 'none'),
        { timeout: 30_000, message: 'A did not reconnect' },
      )
      .toBe('connected');

    try {
      // The fix: A re-subscribes to both peers' mics on Reconnected.
      await waitForAudioFlow(a, b, { timeout: 30_000 });
      await waitForAudioFlow(a, c, { timeout: 30_000 });
      // And the rest of the mesh is unaffected.
      await waitForAudioFlow(b, a, { timeout: 30_000 });
      await waitForAudioFlow(c, a, { timeout: 30_000 });
    } catch (err) {
      // On failure, attach A's diagnostics so the failure is self-describing.
      const diag = await captureDiagnostics(a);
      await test.info().attach('participant-A-diagnostics.json', {
        body: JSON.stringify(diag, null, 2),
        contentType: 'application/json',
      });
      throw err;
    }
  });

  test('full reconnect also self-heals', async () => {
    await forceReconnect(b, 'full-reconnect');
    await expect
      .poll(() => b.page.evaluate(() => window.__lkRoom?.state ?? 'none'), {
        timeout: 30_000,
        message: 'B did not reconnect',
      })
      .toBe('connected');

    await waitForAudioFlow(b, a, { timeout: 30_000 });
    await waitForAudioFlow(b, c, { timeout: 30_000 });
    await waitForAudioFlow(a, b, { timeout: 30_000 });
  });

  test('manual Force resubscribe restores a peer mic (debug-panel recovery)', async () => {
    // The one-click recovery action must not break a healthy subscription and
    // must (re)establish flow. Exercises forceResubscribeMic end-to-end.
    await forceResubscribeMic(a, b.identity);
    await waitForAudioFlow(a, b, { timeout: 30_000 });

    // Sanity: the stats path returns a real inbound report for that peer.
    const stats = await getInboundAudioStats(a, b.identity);
    expect(stats?.hasInboundAudio).toBe(true);
  });
});
