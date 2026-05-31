# Voice E2E — real LiveKit, multi-participant, no second human

These specs validate actual voice behaviour against a **real LiveKit server** by
driving 2–3 real browsers from one Playwright run and asserting "can A hear B"
via WebRTC `getStats` (inbound bytes + audio energy increasing). No human
listener and no second machine are required.

**Status:** full `--project=voice` suite is green (6/6) — real audio flows end to
end through real LiveKit.

## Run it

```bash
scripts/run-voice-e2e.sh            # headless, all voice specs
scripts/run-voice-e2e.sh --headed   # watch the browsers join a call live
scripts/run-voice-e2e.sh reconnect-asymmetry   # filter by spec name
scripts/run-voice-e2e.sh --clean    # tear down volumes afterward
```

One-time host prereq: `cd frontend && npx playwright install chromium`.

## How it works (and the gotchas it took to get here)

- **LiveKit / backend / frontend run in Docker** (the e2e stack + a real
  `livekit-e2e`). The **browser runs on the host** against `http://localhost:5174`.
- **Secure context (the key constraint):** `getUserMedia` — needed for the mic
  to publish, i.e. for any audio at all — is only available in a *secure
  context*. `http://localhost` (and `127.0.0.1`, `*.localhost`) **is** a secure
  context with no TLS, but an arbitrary hostname like `http://frontend-test:5173`
  is **not**, and `--unsafely-treat-insecure-origin-as-secure` does not work in
  headless Chromium. So we point the host browser at `localhost` and need no
  HTTPS, no certs, no flags. (This is also the standard WebRTC test setup.)
- **LiveKit in Docker reachable from the host:** the host overlay
  (`docker-compose.voice-e2e.host.yml`) publishes LiveKit on `localhost:7882`
  with `node_ip: 127.0.0.1` so the host browser's ICE candidates resolve, and
  uses an **ICE UDP port range** (50000–50019) rather than single-port mux —
  single-port mux misroutes the DTLS handshake between peers and causes
  `dtls timeout` with no media. (Refs: livekit#4149, LiveKit ports/firewall docs.)
- **Fake media:** each participant launches its own Chromium with
  `--use-file-for-fake-audio-capture=<wav>` (distinct tones in `assets/`), so
  each is a deterministic, recognisable audio source.
- **Dev-only window hooks** (`src/features/voice/VoiceTestHooks.tsx`, active under
  `VITE_LIVEKIT_TEST_HOOK`): the specs drive the real `Room` via `window.__lkRoom`
  / `__lkCaptureDiagnostics` / `__lkGetInboundAudio` / `__lkForceResubscribeMic` /
  `__lkGetLocalMicDeviceId` / `__lkEnableMic`.

## What's covered

| Spec | PR | Validates |
|------|----|-----------|
| `reconnect-asymmetry.spec.ts` | #352 | 3 participants all hear each other; audio **self-heals** after a forced `signal-reconnect` and `full-reconnect`; manual `forceResubscribeMic` recovery |
| `device-switching.spec.ts` | #351 | mic switch updates the **live** track with no rejoin (#346); input-sensitivity threshold adjustable + persists (#347) |

## Notes / gotchas

- Assert on `getStats` deltas (bytes + energy increasing), never on audible
  playback — those increment even when autoplay pauses the `<audio>` element.
- The mic is (re)published via `window.__lkEnableMic` after join: the app enables
  it once at connect, which can race the page becoming a stable secure context in
  a fresh headless tab. Mirrors a user unmuting; the product's join-time enable
  is unchanged.
- Playwright in the container vs host: run on the host (this is the supported
  path). For a fully-in-Docker run you'd need the frontend reachable at a
  `*.localhost` name or over HTTPS so the in-container origin is secure — not
  wired up; the host path is simpler and is what `run-voice-e2e.sh` uses.

## Regenerating the fake-audio samples

```bash
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=10:sample_rate=48000" \
  -ac 1 -c:a pcm_s16le e2e/assets/sample-a.wav   # 660Hz -> b, 880Hz -> c
```
