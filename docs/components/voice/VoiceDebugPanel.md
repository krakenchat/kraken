# VoiceDebugPanel

> **Location:** `frontend/src/components/Voice/VoiceDebugPanel.tsx`
> **Type:** Debug Component
> **Category:** voice

## Overview

Developer debug panel showing real-time LiveKit connection state, audio levels, and speaking detection status. Useful for diagnosing voice issues.

## Usage

```tsx
import { VoiceDebugPanel } from '@/components/Voice/VoiceDebugPanel';

// Typically shown conditionally in dev mode
{isDev && <VoiceDebugPanel />}
```

## Displays

- Room connection state (connected/disconnected)
- Local microphone track status
- Current user speaking status
- Real-time audio level meter
- Speaking detection map for all participants
- Participant IDs and speaking states

## Technical Details

- Creates AudioContext to analyze microphone levels
- Uses `useSpeakingDetection` hook for speaking state
- Uses `useRoom` hook for LiveKit room access
- Animates audio level bar in real-time

## Related

- [useRoom Hook](../../hooks/useRoom.md)
- [useSpeakingDetection Hook](../../hooks/useSpeakingDetection.md)
