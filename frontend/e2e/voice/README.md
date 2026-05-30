# Voice E2E — real LiveKit, multi-participant, no second human

These specs validate actual voice behaviour against a **real LiveKit server** by
driving 2–3 real browsers from one Playwright run and asserting "can A hear B"
via WebRTC `getStats` (inbound bytes + audio energy increasing). No human
listener and no second machine are required.

## ⚠️ Secure-context constraint — run with `--host` for real audio

`navigator.mediaDevices` / `getUserMedia` are only exposed in a **secure
context**. Chromium treats `http://localhost` as secure automatically, but
**not** an arbitrary hostname like `http://frontend-test:5173` (the in-Docker
origin). The `--unsafely-treat-insecure-origin-as-secure` flag does **not** take
effect in headless containerized Chromium here (verified: `isSecureContext`
stays `false`). Practical consequences:

- **`scripts/run-voice-e2e.sh --host`** → Playwright on the host hits
  `http://localhost:5174`, which IS secure, so the mic publishes and **audio
  actually flows**. This is the mode that makes the audio-flow assertions pass.
  Requires `npx playwright install chromium` once. On native Linux this is the
  recommended path.
- **`scripts/run-voice-e2e.sh`** (dockerized, default) → exercises join /
  subscribe / reconnect **signalling** end-to-end (transport works — the ICE UDP
  port-range fix means zero DTLS timeouts), but the mic can't publish, so
  audio-flow assertions are skipped/fail. Good for signalling regressions; not
  for "can A hear B".

**TODO to make dockerized mode fully self-contained:** serve the e2e frontend
over HTTPS (self-signed cert) and launch Playwright contexts with
`ignoreHTTPSErrors: true`. An https origin is a secure context regardless of
hostname, which would let the default in-network mode flow audio too.

## What's covered

| Spec | PR | Validates |
|------|----|-----------|
| `reconnect-asymmetry.spec.ts` | #352 | 3 participants all hear each other; audio **self-heals** after a forced `signal-reconnect` / `full-reconnect` (the asymmetry fix); manual `forceResubscribeMic` recovery |
| `device-switching.spec.ts` | #351 | Switching the mic updates the **live** capture track without rejoin (#346); sensitivity threshold is adjustable + persists (#347) |

## How it works

- A **real `livekit-e2e`** service is layered onto the e2e stack
  (`docker-compose.voice-e2e.yml`).
- The app exposes dev/test-only window hooks (`VoiceTestHooks`, active via
  `VITE_LIVEKIT_TEST_HOOK=true`): `window.__lkRoom`, `__lkGetInboundAudio`,
  `__lkForceResubscribeMic`, `__lkGetLocalMicDeviceId`, `__lkCaptureDiagnostics`.
  Playwright drives the real `Room` through these (incl. `simulateScenario` to
  trigger reconnects deterministically).
- Each participant runs in its **own** Chromium with a distinct fake-audio file
  (`assets/sample-{a,b,c}.wav`) via `--use-file-for-fake-audio-capture`, so each
  is a recognisable, always-on source. Assertions use `getStats`, which advances
  even when autoplay pauses the `<audio>` element — so it works headless.

## Running

**Default (fully dockerized — only Docker required):**

```bash
scripts/run-voice-e2e.sh                     # all voice specs
scripts/run-voice-e2e.sh reconnect-asymmetry # filter by spec
scripts/run-voice-e2e.sh --clean             # tear down volumes after
```

Browser + LiveKit share the `e2e-network` bridge, so WebRTC ICE uses
container-internal candidates — reliable on native Linux, no host ports.

**Host fallback** (debugging / if containerized UDP misbehaves, e.g. some WSL2):

```bash
scripts/run-voice-e2e.sh --headed            # host browser, host-published LiveKit ports
```

This layers `docker-compose.voice-e2e.host.yml` (publishes LiveKit on
7882/7883/7884) and runs Playwright on the host. Requires `npx playwright
install chromium` once.

## N-party scale (optional)

Add LiveKit CLI audio bots as extra participants (the real browser asserts it
hears each bot). The room name must equal the voice channel's id:

```bash
docker run --rm --network kraken_e2e-network livekit/livekit-cli \
  lk load-test --url ws://livekit-e2e:7880 --api-key devkey \
  --api-secret secret-that-is-at-least-32-characters-long \
  --room <channelId> --audio-publishers 3
```

## Regenerating the fake-audio samples

```bash
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=30:sample_rate=48000" \
  -ac 1 -c:a pcm_s16le e2e/assets/sample-a.wav   # 660Hz → b, 880Hz → c
```

## Notes / gotchas

- Assert on `getStats` deltas, never on audible playback.
- `device-switching` `#346` needs ≥2 fake audio inputs; if the environment
  exposes only one it `test.skip`s with a logged reason (not a silent skip).
- The window hooks are gated by `import.meta.env.DEV || VITE_LIVEKIT_TEST_HOOK`
  and are dead-code-eliminated from production `vite build`.
