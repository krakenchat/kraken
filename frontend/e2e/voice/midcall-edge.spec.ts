/**
 * Mid-call edge cases — the messy real-world timing the happy-path specs don't
 * cover, all asserted via real audio flow through real LiveKit:
 *
 *   1. JOIN WHILE A PEER IS MUTED — a late joiner hears the unmuted peers and
 *      does NOT receive the muted peer; when that peer unmutes, audio appears.
 *   2. LEAVE DURING ANOTHER'S RECONNECT — one participant disconnects while a
 *      second is mid-reconnect; the reconnecting peer recovers a clean mesh with
 *      only the survivors (no audio from the departed, audio with the survivor).
 *   3. AUDIO CONTINUITY ACROSS A DEVICE SWITCH — switching the mic device mid-call
 *      keeps the peer receiving audio (the switch must not drop the stream).
 *
 * Requires the real-LiveKit stack: scripts/run-voice-e2e.sh
 */
import { test, expect } from '@playwright/test';
import {
  launchParticipant,
  joinVoiceChannel,
  closeParticipant,
  waitForAudioFlow,
  expectNoAudioGrowth,
  setMicEnabled,
  switchMic,
  listAudioInputs,
  getLocalMicDeviceId,
  forceReconnect,
  ADMIN_USER,
  TEST_USER,
  TEST_USER_2,
  type Participant,
} from '../fixtures/voice.fixture';

test.describe.configure({ mode: 'serial' });

const CH = 'voice-edge';

test.describe('Mid-call edge cases', () => {
  let a: Participant;
  let b: Participant;
  let c: Participant;

  test.afterEach(async () => {
    // Each test manages its own participants; ensure none linger between tests.
    await Promise.all(
      [a, b, c].filter(Boolean).map((p) => closeParticipant(p).catch(() => {})),
    );
    a = b = c = undefined as unknown as Participant;
  });

  test('join while a peer is muted: late joiner hears unmuted peers, not the muted one', async () => {
    a = await launchParticipant(TEST_USER, 'sample-a.wav');
    b = await launchParticipant(TEST_USER_2, 'sample-b.wav');
    await joinVoiceChannel(a, CH);
    await joinVoiceChannel(b, CH);

    // A mutes BEFORE C joins.
    await setMicEnabled(a, false);

    // C joins late.
    c = await launchParticipant(ADMIN_USER, 'sample-c.wav');
    await joinVoiceChannel(c, CH);

    // C hears B (unmuted) but not A (muted at join time).
    await waitForAudioFlow(c, b);
    await expectNoAudioGrowth(c, a);

    // When A unmutes, C starts receiving A.
    await setMicEnabled(a, true);
    await waitForAudioFlow(c, a, { timeout: 30_000 });
  });

  test("leave during another's reconnect: reconnecting peer recovers a clean mesh", async () => {
    a = await launchParticipant(TEST_USER, 'sample-a.wav');
    b = await launchParticipant(TEST_USER_2, 'sample-b.wav');
    c = await launchParticipant(ADMIN_USER, 'sample-c.wav');
    await joinVoiceChannel(a, CH);
    await joinVoiceChannel(b, CH);
    await joinVoiceChannel(c, CH);

    // Baseline: A hears both peers.
    await waitForAudioFlow(a, b);
    await waitForAudioFlow(a, c);

    const departed = c.identity;

    // Kick A into a full reconnect, and while it's reconnecting, C leaves.
    await forceReconnect(a, 'full-reconnect');
    await closeParticipant(c);
    c = undefined as unknown as Participant;

    // A settles back to connected…
    await expect
      .poll(() => a.page.evaluate(() => window.__lkRoom?.state ?? 'none'), {
        timeout: 30_000,
        message: 'A did not reconnect',
      })
      .toBe('connected');

    // …still hears the survivor B (subscriptions self-healed)…
    await waitForAudioFlow(a, b, { timeout: 30_000 });

    // …and the departed peer is gone from A's roster (no ghost).
    await expect
      .poll(
        () =>
          a.page.evaluate(
            (id) => !!window.__lkRoom && !window.__lkRoom.remoteParticipants.has(id),
            departed,
          ),
        { timeout: 30_000, message: 'departed participant lingered on A after leaving mid-reconnect' },
      )
      .toBe(true);
  });

  test('audio continuity across a mic device switch: peer keeps receiving', async () => {
    a = await launchParticipant(TEST_USER, 'sample-a.wav');
    b = await launchParticipant(TEST_USER_2, 'sample-b.wav');
    await joinVoiceChannel(a, CH);
    await joinVoiceChannel(b, CH);

    // B is receiving A.
    await waitForAudioFlow(b, a);

    const inputs = await listAudioInputs(a);
    const distinct = inputs.filter((d) => d.deviceId && d.deviceId !== 'default');
    test.skip(
      distinct.length < 2,
      `Need >=2 distinct audio inputs on the publisher to switch; env has ${distinct.length}.`,
    );

    const before = await getLocalMicDeviceId(a);
    const target = distinct.find((d) => d.deviceId !== before) ?? distinct[0];
    await switchMic(a, target.deviceId);

    // After the switch, B must STILL be receiving audio from A (continuity) —
    // waitForAudioFlow samples a fresh bytes baseline, so this proves the stream
    // resumed growth post-switch, not merely that old bytes existed.
    await waitForAudioFlow(b, a, { timeout: 30_000 });
  });
});
