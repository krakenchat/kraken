# ScreenSourcePicker

> **Location:** `frontend/src/components/Voice/ScreenSourcePicker.tsx`
> **Type:** Modal Component
> **Category:** voice

## Overview

Electron-only dialog for selecting screen share source (entire screen or application window). Provides resolution, FPS, and audio capture settings.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Whether picker is visible |
| `onClose` | `() => void` | Handler to close picker |
| `onSelect` | `(sourceId: string, settings: ScreenShareSettings) => void` | Handler when source selected |

## Usage

```tsx
import { ScreenSourcePicker } from '@/components/Voice/ScreenSourcePicker';

<ScreenSourcePicker
  open={showPicker}
  onClose={() => setShowPicker(false)}
  onSelect={(sourceId, settings) => startScreenShare(sourceId, settings)}
/>
```

## Settings

```typescript
interface ScreenShareSettings {
  resolution: 'native' | '4k' | '1440p' | '1080p' | '720p' | '480p';
  fps: 15 | 30 | 60;
  enableAudio: boolean;
}
```

## Features

- Grid of available screens/windows with thumbnails
- Icons distinguish screens vs application windows
- Resolution preset selection
- FPS selection (15/30/60)
- System audio capture toggle

## Platform Note

Only appears in Electron. Browser uses native `getDisplayMedia()` dialog instead.

## Related

- [useScreenShare Hook](../../hooks/useScreenShare.md)
- [Platform Separation](../../architecture/frontend.md#platform-separation)
