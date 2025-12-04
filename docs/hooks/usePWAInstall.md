# usePWAInstall

> **Location:** `frontend/src/hooks/usePWAInstall.ts`
> **Type:** Custom Hook
> **Category:** PWA

## Overview

Hook for managing Progressive Web App installation. Detects installability, handles the native install prompt, and provides iOS-specific guidance.

## Returns

| Property | Type | Description |
|----------|------|-------------|
| `isInstallable` | `boolean` | Whether app can be installed (not dismissed, not already installed) |
| `isInstalled` | `boolean` | Whether app is running in standalone mode |
| `isIOS` | `boolean` | Whether running on iOS (needs manual install instructions) |
| `install` | `() => Promise<boolean>` | Triggers native install prompt, returns true if accepted |
| `dismiss` | `() => void` | Dismisses prompt for 7 days |

## Usage

```tsx
import { usePWAInstall } from '@/hooks/usePWAInstall';

function InstallButton() {
  const { isInstallable, isIOS, install, dismiss } = usePWAInstall();

  if (!isInstallable) return null;

  const handleInstall = async () => {
    if (isIOS) {
      // Show iOS instructions
    } else {
      await install();
    }
  };

  return (
    <button onClick={handleInstall}>Install App</button>
  );
}
```

## Features

- Listens for `beforeinstallprompt` browser event
- Detects standalone display mode (already installed)
- Persists dismissal in localStorage (7 day expiry)
- Handles `appinstalled` event

## Related

- [PWAInstallPrompt Component](../components/PWA/PWAInstallPrompt.md)
