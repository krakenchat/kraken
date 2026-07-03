/**
 * Screen-share / video subscription behavior, end to end against real LiveKit.
 *
 * What this proves (all green):
 *   - a participant can publish screen share and a peer RECEIVES the video
 *     (subscribed + inbound bytes growing), through real LiveKit;
 *   - stopping the share removes the publication for peers;
 *   - the "no bytes to a NON-watcher" guarantee — a bystander who never opens
 *     the tile receives zero video bytes (the autoSubscribe:false bandwidth
 *     optimization);
 *   - the "non-watcher silence" guarantee — ScreenShareAudio obeys the same
 *     opt-in gating: a bystander has ZERO subscribed ScreenShareAudio tracks
 *     until they click watch.
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
  countScreenShareAudio,
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

  // The audio twin of the guarantee above: ScreenShareAudio must obey the same
  // opt-in gating as the video, or a share-with-audio would play sound to every
  // peer in the room whether or not they opened the tile.
  test(
    'non-watcher silence: zero subscribed ScreenShareAudio tracks until watch is clicked',
    async () => {
      // Request the share WITH audio, using the app's real capture constraints.
      //
      // LIMITATION: headless Chromium's fake display capture exposes no
      // capturable tab/system audio, so the ScreenShareAudio publication is
      // best-effort in this harness. When it cannot be published, the
      // room-wide "zero subscribed ScreenShareAudio" sweep below still pins
      // the policy at the strongest observable level (publication-level:
      // nothing is subscribed), and the subscribe-on-watch branch is asserted
      // only when the publication actually exists (headed / audio-capable
      // environments).
      const started = await startScreenShare(sharer, { audio: true });
      test.skip(!started, 'Headless screen capture unavailable.');

      await expect
        .poll(
          async () =>
            (await getSubscriptionState(bystander, sharer.identity))?.screenShare.published ?? false,
          { timeout: 15_000, message: 'screenshare publication never propagated' },
        )
        .toBe(true);

      // Let a would-be ScreenShareAudio publication propagate alongside the
      // video before sampling (they arrive as separate publications).
      await bystander.page.waitForTimeout(2_000);
      const audioCounts = await countScreenShareAudio(bystander);

      // The invariant under test: the bystander never clicked watch, so their
      // room must contain ZERO subscribed ScreenShareAudio tracks.
      expect(
        audioCounts.subscribed,
        `bystander is subscribed to ${audioCounts.subscribed} ScreenShareAudio ` +
          'track(s) despite never watching — opt-in audio gating leaked',
      ).toBe(0);

      // The BYSTANDER performs the watch transition — not the shared `watcher`,
      // whose watchingScreenShares entry from earlier serial tests persists and
      // would auto-resubscribe the moment the share republishes, making
      // "subscribe only after watch" a false positive. The bystander was just
      // proven unsubscribed, so this asserts a genuine zero → subscribed
      // transition. (Last test in the serial suite, so polluting the
      // bystander's watch state afterwards is harmless.)
      await watchScreenShareOf(bystander, sharer.identity);
      await expect
        .poll(
          async () =>
            (await getSubscriptionState(bystander, sharer.identity))?.screenShare.subscribed ??
            false,
          { timeout: 15_000, message: 'bystander never subscribed after clicking watch' },
        )
        .toBe(true);

      // ...and — when the environment could actually publish share audio — the
      // ScreenShareAudio subscription appears with it (watchScreenShare targets
      // ScreenShare + ScreenShareAudio).
      if (audioCounts.published > 0) {
        await expect
          .poll(
            async () =>
              (await getSubscriptionState(bystander, sharer.identity))?.screenShareAudio
                .subscribed ?? false,
            {
              timeout: 15_000,
              message: 'bystander never subscribed to the ScreenShareAudio track after watching',
            },
          )
          .toBe(true);
      }

      await stopScreenShare(sharer);
    },
  );
});
