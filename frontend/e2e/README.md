# E2E Tests

End-to-end tests using Playwright to verify critical user flows.

## Quick Start

### Run in Docker (Recommended)

This runs tests in complete isolation with a fresh database:

```bash
# From project root
./scripts/run-e2e.sh

# Or from frontend directory
npm run test:e2e:docker
```

### Options

```bash
# Run all browsers (Chrome, Firefox, Safari, Mobile)
./scripts/run-e2e.sh --all
npm run test:e2e:docker:all

# Run with Playwright UI (interactive debugging)
./scripts/run-e2e.sh --ui
npm run test:e2e:docker:ui

# Run with visible browser
./scripts/run-e2e.sh --headed

# Run specific test file
./scripts/run-e2e.sh auth
./scripts/run-e2e.sh messaging

# Clean up Docker containers
./scripts/run-e2e.sh --clean
npm run test:e2e:docker:clean
```

### Local Development (Against Running Containers)

If you already have `docker-compose up` running:

```bash
cd frontend
npm run test:e2e              # Run all tests
npm run test:e2e:chromium     # Chrome only (fastest)
npm run test:e2e:ui           # Interactive UI mode
npm run test:e2e:debug        # Debug mode
npm run test:e2e:report       # View HTML report
```

## Test Structure

```
e2e/
├── fixtures/
│   ├── auth.fixture.ts    # Authentication helpers
│   ├── test-data.ts       # Test data setup/teardown
│   └── index.ts           # Re-exports
├── auth.spec.ts           # Login, register, logout tests
├── community.spec.ts      # Community management tests
├── messaging.spec.ts      # Messaging and channel tests
├── mobile.spec.ts         # Mobile UX and PWA tests
└── README.md              # This file
```

## Test Credentials

When running with `./scripts/run-e2e.sh`, the database is seeded with:

| Username   | Password      | Role  |
|------------|---------------|-------|
| testuser   | Test123!@#    | USER  |
| testuser2  | Test123!@#    | USER  |
| admin      | Admin123!@#   | ADMIN |

Invite code: `test-invite`

## Browser Coverage

| Project       | Device          |
|---------------|-----------------|
| chromium      | Desktop Chrome  |
| firefox       | Desktop Firefox |
| webkit        | Desktop Safari  |
| mobile-chrome | Pixel 5         |
| mobile-safari | iPhone 12       |

## Viewing Reports

After tests complete:

```bash
npm run test:e2e:report
```

Reports are saved to `playwright-report/` and `test-results/`.

## CI/CD

Tests run automatically on:
- Push to `main`
- All pull requests

See `.github/workflows/e2e-tests.yml` for configuration.

## Troubleshooting

### Tests timeout waiting for elements

- Check that the app is rendering correctly
- Use `--headed` to see what's happening
- Use `--ui` for interactive debugging

### Docker containers won't start

```bash
# Clean up and rebuild
./scripts/run-e2e.sh --clean
docker-compose -f docker-compose.e2e.yml build --no-cache
```

### Database seed fails

```bash
# Check backend logs
docker-compose -f docker-compose.e2e.yml logs backend-test
```

### Browser not installed

```bash
cd frontend
npx playwright install --with-deps
```
