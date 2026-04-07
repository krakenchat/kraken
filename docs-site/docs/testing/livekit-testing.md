# Testing LiveKit Features Locally

This guide explains how to test voice/video features using synthetic LiveKit participants — no second user or real camera required.

## Prerequisites

1. **Local dev stack running**: `docker compose up`
2. **`lk` CLI installed**: Download from [livekit-cli releases](https://github.com/livekit/livekit-cli/releases)
   ```bash
   # Linux amd64 (check releases page for latest version and other platforms)
   curl -sL "https://github.com/livekit/livekit-cli/releases/download/v2.16.0/lk_2.16.0_linux_amd64.tar.gz" | tar xz -C /usr/local/bin/
   ```

## Quick Start

### 1. Join a voice channel in the app

Open the app at `http://localhost:5173`, log in, and join a voice channel.

### 2. Find the room name

```bash
./scripts/livekit-test-participant.sh --list
```

The room name is the channel ID (UUID). It appears once someone joins the voice channel.

### 3. Add a synthetic participant with video

```bash
./scripts/livekit-test-participant.sh <room-name>
```

This joins the room as `test-bot` and publishes a looping demo video (bouncing ball pattern). The participant will appear in the voice channel user list and video tiles.

Press `Ctrl+C` to make the participant leave.

### 4. Custom identity

```bash
./scripts/livekit-test-participant.sh <room-name> my-custom-name
```

## Helper Script Reference

```
./scripts/livekit-test-participant.sh <room-name> [identity]
./scripts/livekit-test-participant.sh --list
```

| Argument | Default | Description |
|----------|---------|-------------|
| `room-name` | (required) | LiveKit room = channel ID from the app |
| `identity` | `test-bot` | Participant identity shown in the UI |

### Environment Variables

All default to local Docker Compose values:

| Variable | Default |
|----------|---------|
| `LIVEKIT_URL` | `http://localhost:7880` |
| `LIVEKIT_API_KEY` | `devkey` |
| `LIVEKIT_API_SECRET` | `secret-that-is-at-least-32-characters-long` |
| `LK_PATH` | `lk` (searched in PATH, falls back to `/tmp/lk`) |

## Direct `lk` CLI Usage

The helper script wraps `lk room join`. For more advanced scenarios, use `lk` directly:

```bash
export LIVEKIT_URL=http://localhost:7880
export LIVEKIT_API_KEY=devkey
export LIVEKIT_API_SECRET=secret-that-is-at-least-32-characters-long

# List rooms
lk room list

# Join with demo video
lk room join --identity test-bot <room-name> --publish-demo

# Publish a specific video file
lk room join --identity test-bot <room-name> --publish /path/to/video.h264 --fps 30

# Create a token (for browser-based testing tools)
lk token create --room <room-name> --identity test-user --join --token-only

# List participants in a room
lk room participants <room-name>
```

## Testing Scenarios

### Per-stream video opt-in (#336)

1. Join a voice channel in the app
2. Run `./scripts/livekit-test-participant.sh <room-name>`
3. **Expected**: Test bot appears in the user list with a camera icon (muted color, not green)
4. Open video tiles — **Expected**: Placeholder tile with avatar + "Watch Camera" button
5. Click "Watch Camera" — **Expected**: Demo video stream appears
6. Click "Stop watching camera" in the user list — **Expected**: Video disappears, placeholder returns
7. Verify bandwidth: open `chrome://webrtc-internals`, check that no inbound video streams exist before clicking "Watch"

### Multiple participants

Run multiple instances with different identities:

```bash
./scripts/livekit-test-participant.sh <room-name> test-bot-1 &
./scripts/livekit-test-participant.sh <room-name> test-bot-2 &
./scripts/livekit-test-participant.sh <room-name> test-bot-3 &
```

### Automated testing with agent-browser

The `lk` CLI can be combined with browser automation:

1. Use `lk token create` to generate a join token for a test participant
2. Use agent-browser to open the app, log in, and join a voice channel
3. Run `lk room join --publish-demo` in the background
4. Use agent-browser to verify the UI state (placeholder tiles, watch buttons, etc.)
5. Use agent-browser to click "Watch" and verify video appears

```bash
# Generate a token for browser-based participant
TOKEN=$(lk token create \
  --room <room-name> \
  --identity test-user \
  --join \
  --allow-update-metadata \
  --token-only)
echo $TOKEN
```
