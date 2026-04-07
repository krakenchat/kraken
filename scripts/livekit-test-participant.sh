#!/usr/bin/env bash
#
# livekit-test-participant.sh — Join a LiveKit room as a synthetic test participant
#
# Publishes a demo video loop so you can test video features (opt-in, tiles, etc.)
# without needing a second user with a real camera.
#
# Prerequisites:
#   - livekit-cli (`lk`) installed: https://github.com/livekit/livekit-cli/releases
#   - Local dev stack running: docker compose up
#
# Usage:
#   ./scripts/livekit-test-participant.sh <room-name> [identity]
#
# Arguments:
#   room-name     The LiveKit room to join. In Semaphore Chat, this is the channel ID.
#                 Find it by joining a voice channel and checking the URL or backend logs.
#   identity      Participant identity (default: "test-bot"). Must match a real user ID
#                 if you want avatar/name resolution, otherwise shows as the raw identity.
#
# Examples:
#   # Join room with demo video as "test-bot":
#   ./scripts/livekit-test-participant.sh my-channel-id
#
#   # Join with a specific identity:
#   ./scripts/livekit-test-participant.sh my-channel-id test-user-123
#
#   # List active rooms to find room names:
#   ./scripts/livekit-test-participant.sh --list
#
# Finding the room name:
#   1. Join a voice channel in the app
#   2. Run: ./scripts/livekit-test-participant.sh --list
#   3. The room name is the channel ID (UUID)
#
# Environment (defaults match docker-compose.yml dev setup):
#   LIVEKIT_URL         (default: http://localhost:7880)
#   LIVEKIT_API_KEY     (default: devkey)
#   LIVEKIT_API_SECRET  (default: secret-that-is-at-least-32-characters-long)

set -euo pipefail

LIVEKIT_URL="${LIVEKIT_URL:-http://localhost:7880}"
LIVEKIT_API_KEY="${LIVEKIT_API_KEY:-devkey}"
LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:-secret-that-is-at-least-32-characters-long}"

# Find lk binary
LK="${LK_PATH:-lk}"
if ! command -v "$LK" &>/dev/null; then
  if [[ -x /tmp/lk ]]; then
    LK=/tmp/lk
  else
    echo "Error: livekit-cli (lk) not found. Install from:"
    echo "  https://github.com/livekit/livekit-cli/releases"
    echo "Or set LK_PATH to the binary location."
    exit 1
  fi
fi

export LIVEKIT_URL LIVEKIT_API_KEY LIVEKIT_API_SECRET

# Handle --list
if [[ "${1:-}" == "--list" ]]; then
  echo "Active LiveKit rooms (${LIVEKIT_URL}):"
  $LK room list
  exit 0
fi

# Validate arguments
ROOM_NAME="${1:?Usage: $0 <room-name> [identity]}"
IDENTITY="${2:-test-bot}"

echo "Joining room '${ROOM_NAME}' as '${IDENTITY}' with demo video..."
echo "Server: ${LIVEKIT_URL}"
echo "Press Ctrl+C to leave."
echo ""

$LK room join \
  --identity "$IDENTITY" \
  "$ROOM_NAME" \
  --publish-demo \
  --verbose
