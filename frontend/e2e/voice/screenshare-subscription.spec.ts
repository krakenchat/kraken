/**
 * Screen-share / video subscription behaviour, end to end against real LiveKit.
 *
 * What this proves today (all green):
 *   - a participant can publish screen share and a peer RECEIVES the video
 *     (subscribed + inbound bytes growing), through real LiveKit;
 *   - stopping the share removes the publication for peers.
 *
 * What it does NOT yet prove — see the `test.fixme` at the bottom:
 *   - the "no bytes to a NON-watcher" guarantee (the autoSubscribe:false
 *     bandwidth optimisation behind [[project_voice_stability_investigation]]).
 *
 * HONEST FINDING (2026-05-31, this harness): in the running e2e build, when a
 * participant shares their screen (or camera), EVERY voice participant ends up
 * subscribed and receiving the video — not just those who opened the tile. A
 * client-side `setSubscribed(false)` / `unwatchScreenShare` does NOT stop the
 * flow (the track stays subscribed and bytes keep growing). So the non-watcher
 * gating is not observable here. Whether that's a prod-vs-e2e connect-option
 * difference, a LiveKit subscriber-permission setting, or the video grid
 * auto-opening all shares is still open — hence `fixme`, not a faked pass.
 *
 * Requires the real-LiveKit stack: scripts/run-voice-e2e.sh
 */
import { test, expect } from '@playwright/test';
import {
  launchParticipant,
  joinVoiceChannel,
  closeParticipant,
  startScreenShare,
  stopScreenShare,
  watchScreenShareOf,
  waitForVideoFlow,
  expectNoVideoToNonWatcher,
  getSubscriptionState,
  ADMIN_USER,
  TEST_USER,
  TEST_USER_2,
  type Participant,
} from '../fixtures/voice.fixture';

test.describe.configure({ mode: 'serial' });

test.describe('Screen share over real LiveKit', () => {
  let sharer: Participant;
  let watcher: Participant;
  let bystander: Participant;

  test.beforeAll(async () => {
    sharer = await launchParticipant(TEST_USER, 'sample-a.wav');
    watcher = await launchParticipant(TEST_USER_2, 'sample-b.wav');
    bystander = await launchParticipant(ADMIN_USER, 'sample-c.wav');
    await joinVoiceChannel(sharer, 'voice-video');
    await joinVoiceChannel(watcher, 'voice-video');
    await joinVoiceChannel(bystander, 'voice-video');
  });

  test.afterAll(async () => {
    await Promise.all([sharer, watcher, bystander].filter(Boolean).map(closeParticipant));
  });

  test('a peer who opens the share receives the video; stopping it removes the publication', async () => {
    const started = await startScreenShare(sharer);
    test.skip(
      !started,
      'Headless Chromium screen capture is unavailable in this env; cannot publish a ' +
        'screen-share track to assert against.',
    );

    // The publication propagates to peers.
    await expect
      .poll(
        async () =>
          (await getSubscriptionState(watcher, sharer.identity))?.screenShare.published ?? false,
        { timeout: 15_000, message: 'screenshare publication never propagated' },
      )
      .toBe(true);

    // The watcher opens the share and receives real video frames.
    await watchScreenShareOf(watcher, sharer.identity);
    await waitForVideoFlow(watcher, sharer, 'screenshare');

    // Stopping the share removes the publication for peers.
    await stopScreenShare(sharer);
    await expect
      .poll(
        async () =>
          (await getSubscriptionState(watcher, sharer.identity))?.screenShare.published ?? false,
        { timeout: 15_000, message: 'screenshare publication never went away after stop' },
      )
      .toBe(false);
  });

  // The bandwidth guarantee we WANT but cannot currently observe (see file
  // header). Left as fixme so it is visible as unfinished, not silently dropped
  // and not faked green. When the gating is confirmed/fixed, drop `.fixme`.
  test.fixme(
    'no bytes to a non-watcher: a bystander who never opens the share receives zero video bytes',
    async () => {
      const started = await startScreenShare(sharer);
      test.skip(!started, 'Headless screen capture unavailable.');
      await expect
        .poll(
          async () =>
            (await getSubscriptionState(bystander, sharer.identity))?.screenShare.published ?? false,
          { timeout: 15_000 },
        )
        .toBe(true);
      await expectNoVideoToNonWatcher(bystander, sharer, 'screenshare');
      await stopScreenShare(sharer);
    },
  );
});
