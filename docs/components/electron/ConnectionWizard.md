# ConnectionWizard

> **Location:** `frontend/src/components/Electron/ConnectionWizard.tsx`
> **Type:** Modal Component
> **Category:** electron

## Overview

First-run wizard for Electron desktop app to connect to a Kraken server instance. Guides user through entering server URL and testing connection.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Whether wizard is visible |
| `onComplete` | `() => void` | Handler when wizard completes successfully |

## Usage

```tsx
import { ConnectionWizard } from '@/components/Electron/ConnectionWizard';

<ConnectionWizard
  open={!hasServer}
  onComplete={() => navigateToLogin()}
/>
```

## Steps

1. **Welcome** - Introduction text
2. **Server Details** - Enter server URL and display name
3. **Complete** - Success confirmation

## Features

- URL validation (http/https)
- Connection test to `/api/onboarding/status`
- Error handling with user feedback
- Saves server to local storage via `addServer()`

## Related

- [AutoUpdater](./AutoUpdater.md)
- [Onboarding Module](../../modules/onboarding.md)
