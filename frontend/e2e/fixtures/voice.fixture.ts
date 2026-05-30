/**
 * Voice E2E fixtures — drive REAL multi-participant LiveKit sessions from a
 * single Playwright run, so "can A hear B" is verifiable without a second human.
 *
 * Strategy: each participant gets its OWN browser (Chromium shares launch args
 * across a browser's contexts, so distinct `--use-file-for-fake-audio-capture`
 * wavs require distinct browsers). After joining, we read the participant's real
 * LiveKit identity from the dev-only `window.__lkRoom` hook, so audio-flow
 * assertions never need to map usernames → user-ids.
 *
 * Requires the real-LiveKit stack (scripts/run-voice-e2e.sh) and the window test
 * hooks (VITE_LIVEKIT_TEST_HOOK=true).
 */

/* eslint-disable react-hooks/rules-of-hooks */
import { chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { TEST_USER, TEST_USER_2, loginViaApi, setAuthToken } from './auth.fixture';

export const ADMIN_USER = {
  username: 'admin',
  password: 'Admin123!@#',
  email: 'admin@test.local',
};

// cwd is the frontend dir when Playwright runs; avoids __dirname (undefined under ESM).
const ASSET_DIR = path.resolve(process.cwd(), 'e2e/assets');
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

export interface Participant {
  /** Friendly label (username) for logs. */
  name: string;
  /** Persistent browser context (owns the browser; close it to tear down). */
  context: BrowserContext;
  page: Page;
  /** Real LiveKit identity (the user id), filled in by joinVoiceChannel(). */
  identity: string;
  /** Temp profile dir backing the persistent context; removed on close. */
  userDataDir: string;
}

export interface InboundAudioSample {
  hasInboundAudio: boolean;
  bytesReceived?: number;
  packetsReceived?: number;
  totalAudioEnergy?: number;
  audioLevel?: number;
}

/**
 * Augment the in-browser `Window` with the dev/test hooks exposed by
 * `VoiceTestHooks` (mirrors voiceTestHooks.types.ts). This makes
 * `page.evaluate(() => window.__lkRoom...)` type-clean in every voice spec that
 * imports from this fixture.
 */
declare global {
  interface Window {
    __lkRoom: {
      state: string;
      localParticipant: { identity: string };
      remoteParticipants: Map<string, unknown>;
      simulateScenario: (s: string) => Promise<void> | void;
    } | null;
    __lkGetInboundAudio: (identity: string) => Promise<InboundAudioSample | undefined>;
    __lkForceResubscribeMic: (identity: string) => void;
    __lkCaptureDiagnostics: () => Promise<unknown>;
  }
}

/**
 * Launch a dedicated browser for one participant, with a distinct fake-audio
 * file, log it in via API, and land it on the app home (authenticated).
 */
export async function launchParticipant(
  creds: { username: string; password: string },
  wavFile: string,
): Promise<Participant> {
  // Use launchPersistentContext (not launch+newContext) so Chromium gets a real
  // --user-data-dir. navigator.mediaDevices (getUserMedia/enumerateDevices) is
  // only exposed in a *secure context*; the e2e frontend is plain http
  // (http://frontend-test:5173 in Docker, http://localhost:5174 on host), so we
  // mark the test origin secure with --unsafely-treat-insecure-origin-as-secure.
  // That flag is IGNORED unless a persistent profile dir is present — which is
  // exactly why launch()+newContext() left isSecureContext=false and the mic
  // never published. This is a test/dev-only launch flag, never in any app build.
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `lk-${creds.username}-`));
  const context = await chromium.launchPersistentContext(userDataDir, {
    baseURL: BASE_URL,
    permissions: ['microphone', 'camera'],
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      `--use-file-for-fake-audio-capture=${path.join(ASSET_DIR, wavFile)}`,
      `--unsafely-treat-insecure-origin-as-secure=${BASE_URL}`,
    ],
  });
  const page = context.pages()[0] ?? (await context.newPage());

  // API login → set cookie + localStorage (matches the proven auth.fixture path).
  const { accessToken } = await loginViaApi(context.request, creds);
  await page.goto('/');
  await setAuthToken(page, accessToken);
  await page.reload();

  return { name: creds.username, context, page, identity: '', userDataDir };
}

/**
 * Navigate the participant into the seeded "Test Community" → "voice-chat" VOICE
 * channel and join voice. Clicking a VOICE channel auto-joins (Channel.tsx).
 * Resolves once `window.__lkRoom` reports `connected`, and records the
 * participant's real LiveKit identity.
 */
export async function joinVoiceChannel(p: Participant): Promise<void> {
  const { page } = p;
  await page.goto('/');

  // Enter the community, then the voice channel (auto-joins voice).
  await page.getByRole('button', { name: 'Test Community' }).first().click();
  await page.getByRole('button', { name: 'voice-chat' }).first().click();

  // Wait for the real Room to be connected via the dev window hook.
  await expect
    .poll(
      () => page.evaluate(() => window.__lkRoom?.state ?? 'none'),
      { timeout: 30_000, message: `${p.name} never reached connected state` },
    )
    .toBe('connected');

  p.identity = await page.evaluate(
    () => window.__lkRoom!.localParticipant.identity,
  );
}

/**
 * Read parsed inbound audio stats for a remote participant on `from`'s page —
 * i.e. "what is `from` receiving from `remote`".
 */
export async function getInboundAudioStats(
  from: Participant,
  remoteIdentity: string,
): Promise<InboundAudioSample | undefined> {
  return from.page.evaluate(
    (id) => window.__lkGetInboundAudio(id),
    remoteIdentity,
  );
}

/**
 * Assert that audio is actively flowing from `remote` to `from`: bytesReceived
 * strictly increases across two samples AND totalAudioEnergy > 0. These metrics
 * advance even if the <audio> element is paused by autoplay policy, so the
 * assertion is robust in headless/containerized runs.
 */
export async function waitForAudioFlow(
  from: Participant,
  remote: Participant,
  opts: { timeout?: number } = {},
): Promise<void> {
  const timeout = opts.timeout ?? 25_000;
  const first = await getInboundAudioStats(from, remote.identity);
  const startBytes = first?.bytesReceived ?? 0;

  await expect
    .poll(
      async () => {
        const s = await getInboundAudioStats(from, remote.identity);
        if (!s || !s.hasInboundAudio) return false;
        const bytesGrew = (s.bytesReceived ?? 0) > startBytes;
        const hasEnergy = (s.totalAudioEnergy ?? 0) > 0;
        return bytesGrew && hasEnergy;
      },
      {
        timeout,
        message: `audio did not flow from ${remote.name} → ${from.name}`,
      },
    )
    .toBe(true);
}

/** Trigger a deterministic LiveKit reconnect on a participant (PR #352 repro). */
export async function forceReconnect(
  p: Participant,
  scenario: 'signal-reconnect' | 'full-reconnect' | 'force-tcp' = 'signal-reconnect',
): Promise<void> {
  await p.page.evaluate(
    (s) => window.__lkRoom?.simulateScenario(s),
    scenario,
  );
}

/** Manually force-resubscribe a remote participant's mic (PR #352 recovery). */
export async function forceResubscribeMic(p: Participant, remoteIdentity: string): Promise<void> {
  await p.page.evaluate(
    (id) => window.__lkForceResubscribeMic(id),
    remoteIdentity,
  );
}

/** Capture the full diagnostics snapshot (same JSON as the panel's Export). */
export async function captureDiagnostics(p: Participant): Promise<unknown> {
  return p.page.evaluate(() => window.__lkCaptureDiagnostics());
}

/** Tear down a participant's browser and remove its temp profile dir. */
export async function closeParticipant(p: Participant): Promise<void> {
  // Closing a persistent context also closes its browser.
  await p.context.close();
  try {
    fs.rmSync(p.userDataDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

export { TEST_USER, TEST_USER_2 };
