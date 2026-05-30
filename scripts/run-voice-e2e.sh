#!/bin/bash
# Voice E2E Runner — spins up a REAL LiveKit server alongside the e2e stack and
# runs the Playwright "voice" project against it, so voice behaviour (audio flow,
# reconnect self-heal, live device switching) can be validated without a second
# human in the call.
#
# TWO MODES, because of a WebRTC/secure-context constraint:
#
#   default (dockerized):  Chromium runs in a Playwright container on the same
#                          docker network as LiveKit. Transport works (ICE over
#                          the published UDP port range), BUT the app origin is
#                          http://frontend-test:5173 — NOT a secure context — so
#                          navigator.mediaDevices/getUserMedia is unavailable and
#                          the mic can't publish. Use this mode to exercise
#                          join/subscribe/reconnect signalling; full audio-flow
#                          assertions need a secure context (see --host).
#
#   --host:                Playwright runs on the HOST against http://localhost:
#                          5174. localhost IS a secure context in Chromium, so
#                          getUserMedia works and audio actually flows — this is
#                          the mode that makes the audio-flow assertions pass.
#                          Requires `npx playwright install chromium` once.
#
# (A future improvement to make the dockerized mode fully self-contained is to
#  serve the e2e frontend over HTTPS with a self-signed cert + ignoreHTTPSErrors;
#  see frontend/e2e/voice/README.md.)
#
#   scripts/run-voice-e2e.sh                       # dockerized signalling run
#   scripts/run-voice-e2e.sh --host                # host run (real audio flow)
#   scripts/run-voice-e2e.sh --host reconnect-asymmetry  # filter by spec
#   scripts/run-voice-e2e.sh --clean               # tear down volumes after
set -uo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.e2e.yml -f docker-compose.voice-e2e.yml"
CLEAN=false
HOST=false
SPEC=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --clean) CLEAN=true; shift ;;
    --host|--headed) HOST=true; shift ;;
    *) SPEC="$1"; shift ;;
  esac
done

cleanup() {
  if [ "$CLEAN" = true ]; then
    echo -e "${YELLOW}Tearing down voice-e2e stack (volumes too)...${NC}"
    $COMPOSE down -v
  fi
}
trap cleanup EXIT

PW_VER=$(node -p "require('./frontend/package.json').devDependencies['@playwright/test'].replace(/[^0-9.]/g,'')" 2>/dev/null || echo "1.57.0")

echo -e "${GREEN}== Voice E2E ==${NC}"
echo -e "${YELLOW}Starting stack (postgres, redis, livekit, backend, frontend)...${NC}"
if [ "$HOST" = true ]; then
  # Host mode: layer the host overlay so LiveKit + frontend are published to the
  # host (localhost:7882 / :5174), and run the browser on the host.
  COMPOSE="$COMPOSE -f docker-compose.voice-e2e.host.yml"
fi
$COMPOSE up -d --build postgres-test redis-test livekit-e2e backend-test frontend-test

echo -e "${YELLOW}Waiting for backend-test:3001 ...${NC}"
for i in $(seq 1 45); do
  curl -sf http://localhost:3001/api/livekit/health >/dev/null 2>&1 && break
  sleep 3
  [ "$i" = 45 ] && { echo -e "${RED}backend-test never became healthy${NC}"; exit 1; }
done
echo -e "${YELLOW}Waiting for frontend-test:5174 ...${NC}"
for i in $(seq 1 30); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5174 2>/dev/null)" = "200" ] && break
  sleep 3
done

echo -e "${YELLOW}Applying migrations + seeding test data...${NC}"
$COMPOSE exec -T backend-test pnpm run prisma:migrate >/dev/null 2>&1 || true
$COMPOSE exec -T backend-test pnpm run seed:e2e >/dev/null 2>&1 || true

RUN_EXIT=0
if [ "$HOST" = true ]; then
  echo -e "${YELLOW}Running voice specs on the HOST against http://localhost:5174 (secure context → real audio)...${NC}"
  ( cd frontend && E2E_BASE_URL=http://localhost:5174 \
      npx playwright test --project=voice --reporter=list,json ${SPEC:+"$SPEC"} ); RUN_EXIT=$?
else
  echo -e "${YELLOW}Running voice specs in a Playwright container (signalling only — see header note)...${NC}"
  docker run --rm --network kraken_e2e-network \
    -v "$(pwd)/frontend:/app" -w /app \
    -e E2E_BASE_URL=http://frontend-test:5173 -e CI=true \
    "mcr.microsoft.com/playwright:v${PW_VER}-jammy" \
    bash -c "./node_modules/.bin/playwright test --project=voice --reporter=list,json ${SPEC:+$SPEC}"
  RUN_EXIT=$?
fi

if [ "$RUN_EXIT" = 0 ]; then
  echo -e "${GREEN}Voice E2E passed.${NC}"
else
  echo -e "${RED}Voice E2E failed (exit $RUN_EXIT). See frontend/playwright-report + frontend/test-results/.${NC}"
fi
exit $RUN_EXIT
