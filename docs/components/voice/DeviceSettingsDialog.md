# DeviceSettingsDialog

> **Location:** `frontend/src/components/Voice/DeviceSettingsDialog.tsx`
> **Type:** Modal Component
> **Category:** voice

## Overview

Dialog for selecting and testing audio/video input devices before or during voice calls. Shows live preview and audio level meter.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Whether dialog is visible |
| `onClose` | `() => void` | Handler to close dialog |
| `onDeviceChange` | `(type: 'audio' \| 'video', deviceId: string) => void` | Optional callback on device change |

## Usage

```tsx
import { DeviceSettingsDialog } from '@/components/Voice/DeviceSettingsDialog';

<DeviceSettingsDialog
  open={showSettings}
  onClose={() => setShowSettings(false)}
  onDeviceChange={handleDeviceChange}
/>
```

## Features

- Tabbed interface: Audio / Video
- Microphone device dropdown with test recording
- Audio level meter visualization
- Camera device dropdown with live preview
- Mute/unmute toggle with visual feedback
- Device refresh button
- Status indicators for working/error state

## Hook Integration

Uses `useDeviceSettings` hook for device enumeration and selection.

## Related

- [VoiceBottomBar](./VoiceBottomBar.md)
- [useVoiceConnection Hook](../../hooks/useVoiceConnection.md)
