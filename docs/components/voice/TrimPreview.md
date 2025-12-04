# TrimPreview

> **Location:** `frontend/src/components/Voice/TrimPreview.tsx`
> **Type:** UI Component
> **Category:** voice

## Overview

HLS video player with interactive trim timeline for editing replay buffer clips before saving. Uses hls.js for streaming playback.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `onRangeChange` | `(start: number, end: number) => void` | Callback when trim range changes |

## Usage

```tsx
import { TrimPreview } from '@/components/Voice/TrimPreview';

<TrimPreview
  onRangeChange={(start, end) => setTrimRange({ start, end })}
/>
```

## Features

- HLS streaming video playback via hls.js
- Visual timeline with draggable start/end handles
- Current playback position indicator
- Play/pause, skip forward/back controls
- Loop within selected range option
- Time display in MM:SS format

## Technical Details

- Fetches session info to get HLS playlist URL
- Authenticated stream with JWT token
- Uses refs to avoid stale closures in drag handlers

## Related

- [CaptureReplayModal](./CaptureReplayModal.md)
- [Replay Buffer Feature](../../features/replay-buffer.md)
