# useScreenShare

> **Location:** `frontend/src/hooks/useScreenShare.ts`
> **Type:** State Hook
> **Category:** voice

## Overview

Platform-aware screen sharing hook. Handles differences between browser (native getDisplayMedia) and Electron (custom source picker).

## Usage

```tsx
import { useScreenShare } from '@/hooks/useScreenShare';

function ScreenShareButton() {
  const {
    isScreenSharing,
    toggleScreenShare,
    showSourcePicker,
    sources
  } = useScreenShare();

  return (
    <button onClick={toggleScreenShare}>
      {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
    </button>
  );
}
```

## Platform Behavior

- **Browser**: Uses native `getDisplayMedia()` API
- **Electron**: Shows custom `ScreenSourcePicker` dialog with window/screen options

## Related

- [ScreenSourcePicker Component](../components/voice/ScreenSourcePicker.md)
- [useVoiceConnection](./useVoiceConnection.md)
- [Platform Utilities](../architecture/frontend.md#platform-separation)
