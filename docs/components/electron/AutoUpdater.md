# AutoUpdater

> **Location:** `frontend/src/components/Electron/AutoUpdater.tsx`
> **Type:** UI Component
> **Category:** electron

## Overview

Desktop app auto-update notification system. Shows snackbar alerts when updates are available, downloading, or ready to install.

## Usage

```tsx
import { AutoUpdater } from '@/components/Electron/AutoUpdater';

// Render at app root level
<AutoUpdater />
```

## States

1. **Update Available** - Shows version info, starts download
2. **Downloading** - Shows progress bar with percentage
3. **Downloaded** - Shows "Restart to Update" button
4. **Error** - Shows error message

## Electron API Events

- `onUpdateAvailable` - New version detected
- `onDownloadProgress` - Download progress updates
- `onUpdateDownloaded` - Ready to install
- `onUpdateError` - Error occurred

## Platform Note

Only active in Electron. Returns null in browser environment.

## Related

- [Platform Utilities](../../architecture/frontend.md#platform-separation)
