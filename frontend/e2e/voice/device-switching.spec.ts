/**
 * PR #351 validation — live audio device switching + sensitivity UX.
 *
 * #346: changing the microphone in Settings → Voice & Video must switch the
 *       ACTIVE LiveKit capture track live (no rejoin). Proven by reading the
 *       local mic track's deviceId (via the window hook) before/after the
 *       change while asserting the room stays connected.
 * #347: the input-sensitivity threshold is adjustable and persists.
 *
 * Requires the real-LiveKit stack: scripts/run-voice-e2e.sh
 */
import { test, expect } from '@playwright/test';
import {
  launchParticipant,
  joinVoiceChannel,
  closeParticipant,
  TEST_USER,
  type Participant,
} from '../fixtures/voice.fixture';

test.describe.configure({ mode: 'serial' });

test.describe('PR #351 — live device switching + sensitivity', () => {
  let p: Participant;

  test.beforeAll(async () => {
    p = await launchParticipant(TEST_USER, 'sample-a.wav');
    await joinVoiceChannel(p);
  });

  test.afterAll(async () => {
    if (p) await closeParticipant(p);
  });

  test('#346: switching the mic updates the live track without rejoining', async () => {
    const { page } = p;

    // Enumerate fake audio inputs. Chromium's fake stack usually exposes ≥2.
    const audioInputs = await page.evaluate(async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label }));
    });

    const distinctIds = [...new Set(audioInputs.map((d) => d.deviceId))].filter(
      (id) => id && id !== 'default',
    );

    test.skip(
      distinctIds.length < 2,
      `Need ≥2 fake audio inputs to test switching; saw ${distinctIds.length}. ` +
        `(Not a failure — environment limitation; logged so it isn't a silent skip.)`,
    );

    const before = await page.evaluate(() => window.__lkGetLocalMicDeviceId());

    // Open Settings → Voice & Video and pick a different microphone.
    await page.goto('/settings');
    const micSelect = page.getByRole('combobox', { name: 'Microphone' });
    await expect(micSelect).toBeVisible({ timeout: 10_000 });
    await micSelect.click();

    // Choose an option whose deviceId differs from the current one.
    const target = audioInputs.find((d) => d.deviceId !== before && d.deviceId !== 'default');
    await page.getByRole('option', { name: target!.label }).click();

    // The room must stay connected — i.e. the device switched live, no rejoin.
    const roomState = await page.evaluate(() => window.__lkRoom?.state ?? 'none');
    expect(roomState).toBe('connected');

    // ... and the live capture track's deviceId must have changed.
    await expect
      .poll(() => page.evaluate(() => window.__lkGetLocalMicDeviceId()), {
        timeout: 10_000,
        message: 'live mic deviceId did not change after switching device',
      })
      .not.toBe(before);
  });

  test('#347: input sensitivity threshold is adjustable and persists', async () => {
    const { page } = p;
    await page.goto('/settings');

    const readThreshold = () =>
      page.evaluate(() => {
        const raw = localStorage.getItem('semaphore_voice_settings');
        if (!raw) return null;
        try {
          return JSON.parse(raw).voiceActivityThreshold ?? null;
        } catch {
          return null;
        }
      });

    // Wait for the Voice & Video panel to finish its async device enumeration.
    await expect(page.getByRole('combobox', { name: 'Microphone' })).toBeVisible({
      timeout: 15_000,
    });

    // The "Input Sensitivity" slider only renders in voice-activity input mode.
    // Select it explicitly (a real user action) — the panel can mount with
    // neither toggle pre-selected, so don't rely on the default.
    await page.getByRole('button', { name: 'Voice Activity' }).click();
    await expect(page.getByText('Input Sensitivity')).toBeVisible({ timeout: 10_000 });

    // MUI <Slider>'s <input> is visually-hidden, so focus()/keyboard on it is
    // flaky. Drive the visible thumb instead: clicking it focuses the slider
    // (only the sensitivity slider is present when not testing, so
    // .MuiSlider-thumb is unique), then arrow keys nudge it.
    const thumb = page.locator('.MuiSlider-thumb').first();
    await expect(thumb).toBeVisible({ timeout: 10_000 });

    const before = await readThreshold();
    await thumb.click();
    // Nudge the threshold a few steps; the persisted value should change.
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');

    await expect
      .poll(readThreshold, {
        timeout: 5_000,
        message: 'voiceActivityThreshold did not persist to localStorage',
      })
      .not.toBe(before);
  });
});
