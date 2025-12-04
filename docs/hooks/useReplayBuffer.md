# useReplayBuffer

> **Location:** `frontend/src/hooks/useReplayBuffer.ts`
> **Type:** API Hook
> **Category:** voice

## Overview

Manages replay buffer state for screen sharing sessions. Handles starting/stopping egress recording and capturing clips.

## Usage

```tsx
import { useReplayBuffer } from '@/hooks/useReplayBuffer';

function VoiceControls() {
  const {
    isRecording,
    startRecording,
    stopRecording,
    captureClip,
    canCapture
  } = useReplayBuffer();

  return (
    <div>
      {isRecording && (
        <button onClick={() => captureClip(30)}>
          Save Last 30 Seconds
        </button>
      )}
    </div>
  );
}
```

## Key Features

- Auto-starts when screen sharing begins
- Saves HLS segments for clip extraction
- Integrates with TrimPreview for editing

## Related

- [Replay Buffer Feature](../features/replay-buffer.md)
- [TrimPreview Component](../components/voice/TrimPreview.md)
- [CaptureReplayModal Component](../components/voice/CaptureReplayModal.md)
