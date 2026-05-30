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
    // The AudioVideoSettingsPanel renders a "Microphone" combobox (MUI Select).
    const micSelect = page.getByRole('combobox', { name: 'Microphone' });
    await expect(micSelect).toBeVisible({ timeout: 10_000 });
    await micSelect.click();

    // Choose an option whose deviceId differs from the current one.
    const target = audioInputs.find((d) => d.deviceId !== before && d.deviceId !== 'default');
    await page.getByRole('option', { name: target!.label }).click();

    // The room must stay connected (no rejoin) ...
    const state = await page.evaluate(() => window.__lkRoom?.state ?? 'none');
    expect(state).toBe('connected');

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

    // Read the persisted voice settings before.
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

    // The sensitivity slider is keyboard-operable (aria-label "Input sensitivity").
    const slider = page.getByLabel('Input sensitivity');
    await expect(slider).toBeVisible({ timeout: 10_000 });

    await slider.focus();
    // Nudge the threshold up a few steps; persisted value should change.
    const before = await readThreshold();
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');

    await expect
      .poll(readThreshold, {
        timeout: 5_000,
        message: 'voiceActivityThreshold did not persist to localStorage',
      })
      .not.toBe(before);
  });
});
