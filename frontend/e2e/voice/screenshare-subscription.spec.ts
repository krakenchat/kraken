/**
 * Screen-share / video subscription behaviour, end to end against real LiveKit.
 *
 * What this proves (all green):
 *   - a participant can publish screen share and a peer RECEIVES the video
 *     (subscribed + inbound bytes growing), through real LiveKit;
 *   - stopping the share removes the publication for peers;
 *   - the "no bytes to a NON-watcher" guarantee — a bystander who never opens
 *     the tile receives zero video bytes (the autoSubscribe:false bandwidth
 *     optimisation behind [[project_voice_stability_investigation]]).
 *
 * HISTORY (#365): before that fix, `autoSubscribe: false` was passed to the
 * Room *constructor*, where livekit-client silently ignores it — so every
 * session ran with auto-subscribe ON and the non-watcher guarantee was NOT
 * observable (EVERY participant received the video regardless of the tile).
 * The "prod-vs-e2e connect-option difference" the old FIXME note guessed at
 * was exactly this bug. Fixed by moving `autoSubscribe: false` into
 * connect()'s RoomConnectOptions in voiceActions.ts.
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

  // The bandwidth guarantee, now observable after the #365 connect-option fix:
  // a bystander who never opens the share must receive zero video bytes.
  test(
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
