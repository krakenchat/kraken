#!/bin/bash

# E2E Test Runner Script
# Runs Playwright tests against isolated Docker containers
#
# Usage:
#   ./scripts/run-e2e.sh              # Run all tests (chromium only for speed)
#   ./scripts/run-e2e.sh --all        # Run all browsers
#   ./scripts/run-e2e.sh --ui         # Run with Playwright UI
#   ./scripts/run-e2e.sh --headed     # Run with visible browser
#   ./scripts/run-e2e.sh auth         # Run specific test file
#   ./scripts/run-e2e.sh --clean      # Clean up containers only

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Parse arguments
ALL_BROWSERS=false
UI_MODE=false
HEADED=false
CLEAN_ONLY=false
TEST_PATTERN=""
EXTRA_ARGS=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --all)
      ALL_BROWSERS=true
      shift
      ;;
    --ui)
      UI_MODE=true
      shift
      ;;
    --headed)
      HEADED=true
      shift
      ;;
    --clean)
      CLEAN_ONLY=true
      shift
      ;;
    --debug)
      EXTRA_ARGS="$EXTRA_ARGS --debug"
      shift
      ;;
    -*)
      EXTRA_ARGS="$EXTRA_ARGS $1"
      shift
      ;;
    *)
      TEST_PATTERN="$1"
      shift
      ;;
  esac
done

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Kraken E2E Test Runner                             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

cleanup() {
  echo -e "\n${YELLOW}🧹 Cleaning up Docker containers...${NC}"
  cd "$PROJECT_ROOT"
  docker-compose -f docker-compose.e2e.yml down -v --remove-orphans 2>/dev/null || true
  echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Handle cleanup only
if [ "$CLEAN_ONLY" = true ]; then
  cleanup
  exit 0
fi

# Cleanup on exit
trap cleanup EXIT

# Step 1: Start E2E containers
echo -e "${BLUE}📦 Starting E2E Docker containers...${NC}"
cd "$PROJECT_ROOT"
docker-compose -f docker-compose.e2e.yml down -v --remove-orphans 2>/dev/null || true
docker-compose -f docker-compose.e2e.yml up -d mongo-test redis-test

# Wait for MongoDB to be ready
echo -e "${YELLOW}⏳ Waiting for MongoDB...${NC}"
for i in {1..30}; do
  if docker-compose -f docker-compose.e2e.yml exec -T mongo-test mongosh --eval "rs.status()" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ MongoDB is ready${NC}"
    break
  fi
  sleep 2
  if [ $i -eq 30 ]; then
    echo -e "${RED}✗ MongoDB failed to start${NC}"
    exit 1
  fi
done

# Wait for Redis to be ready
echo -e "${YELLOW}⏳ Waiting for Redis...${NC}"
for i in {1..30}; do
  if docker-compose -f docker-compose.e2e.yml exec -T redis-test redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is ready${NC}"
    break
  fi
  sleep 1
  if [ $i -eq 30 ]; then
    echo -e "${RED}✗ Redis failed to start${NC}"
    exit 1
  fi
done

# Start backend
echo -e "${BLUE}🚀 Starting backend service...${NC}"
docker-compose -f docker-compose.e2e.yml up -d backend-test

# Wait for backend
echo -e "${YELLOW}⏳ Waiting for backend...${NC}"
for i in {1..60}; do
  if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is ready${NC}"
    break
  fi
  sleep 2
  if [ $i -eq 60 ]; then
    echo -e "${RED}✗ Backend failed to start. Logs:${NC}"
    docker-compose -f docker-compose.e2e.yml logs backend-test --tail=50
    exit 1
  fi
done

# Step 2: Seed the database
echo -e "${BLUE}🌱 Seeding test database...${NC}"
docker-compose -f docker-compose.e2e.yml exec -T backend-test npx ts-node prisma/seed-e2e.ts || {
  echo -e "${YELLOW}⚠️  Seed script not found, creating test user via API...${NC}"

  # Fallback: create users via API
  curl -s -X POST http://localhost:3001/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser","password":"Test123!@#","email":"testuser@test.local","code":"test-invite"}' > /dev/null 2>&1 || true

  curl -s -X POST http://localhost:3001/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"username":"testuser2","password":"Test123!@#","email":"testuser2@test.local","code":"test-invite"}' > /dev/null 2>&1 || true
}
echo -e "${GREEN}✓ Database seeded${NC}"

# Start frontend
echo -e "${BLUE}🌐 Starting frontend service...${NC}"
docker-compose -f docker-compose.e2e.yml up -d frontend-test

# Wait for frontend
echo -e "${YELLOW}⏳ Waiting for frontend...${NC}"
for i in {1..60}; do
  if curl -s http://localhost:5174 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is ready${NC}"
    break
  fi
  sleep 2
  if [ $i -eq 60 ]; then
    echo -e "${RED}✗ Frontend failed to start. Logs:${NC}"
    docker-compose -f docker-compose.e2e.yml logs frontend-test --tail=50
    exit 1
  fi
done

# Step 3: Run Playwright tests
echo ""
echo -e "${BLUE}🎭 Running Playwright tests...${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

cd "$PROJECT_ROOT/frontend"

# Build playwright command
PLAYWRIGHT_CMD="npx playwright test"

if [ "$UI_MODE" = true ]; then
  PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --ui"
elif [ "$HEADED" = true ]; then
  PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --headed"
fi

if [ "$ALL_BROWSERS" = false ] && [ "$UI_MODE" = false ]; then
  PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD --project=chromium"
fi

if [ -n "$TEST_PATTERN" ]; then
  PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD $TEST_PATTERN"
fi

if [ -n "$EXTRA_ARGS" ]; then
  PLAYWRIGHT_CMD="$PLAYWRIGHT_CMD $EXTRA_ARGS"
fi

# Set environment variables
export E2E_BASE_URL="http://localhost:5174"

echo -e "${YELLOW}Running: $PLAYWRIGHT_CMD${NC}"
echo ""

# Run tests
$PLAYWRIGHT_CMD

TEST_EXIT_CODE=$?

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
else
  echo -e "${RED}❌ Some tests failed (exit code: $TEST_EXIT_CODE)${NC}"
  echo -e "${YELLOW}📊 View report: npm run test:e2e:report${NC}"
fi

exit $TEST_EXIT_CODE
