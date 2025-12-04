# CaptureReplayModal

> **Location:** `frontend/src/components/Voice/CaptureReplayModal.tsx`
> **Type:** Modal Component
> **Category:** voice

## Overview

Modal for capturing replay buffer clips from active screen share sessions. Offers duration presets, optional trim editing, and destination selection for sharing.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Whether modal is visible |
| `onClose` | `() => void` | Handler to close modal |

## Usage

```tsx
import { CaptureReplayModal } from '@/components/Voice/CaptureReplayModal';

<CaptureReplayModal
  open={showCaptureModal}
  onClose={() => setShowCaptureModal(false)}
/>
```

## Features

- Duration presets: 1, 2, 5, 10 minutes with size estimates
- Workflow options:
  - Save to library only
  - Save and share to channel/DM
  - Trim before saving (opens TrimPreview)
- Channel and DM destination picker
- Progress indicator during capture

## API Integration

- `useCaptureReplayMutation` - Captures and saves clip from egress buffer

## Related

- [TrimPreview](./TrimPreview.md)
- [ClipLibrary](../profile/ClipLibrary.md)
- [useReplayBuffer Hook](../../hooks/useReplayBuffer.md)
