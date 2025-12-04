# AudioRenderer

> **Location:** `frontend/src/components/Voice/AudioRenderer.tsx`
> **Type:** Utility Component
> **Category:** voice

## Overview

Renders hidden audio elements for remote participants in voice calls. Handles attaching/detaching LiveKit audio tracks to DOM audio elements.

## Usage

```tsx
import { AudioRenderer } from '@/components/Voice/AudioRenderer';

// Typically rendered at the room level
<AudioRenderer />
```

## How It Works

1. Subscribes to LiveKit room events for track subscriptions
2. For each remote participant with audio track:
   - Creates hidden `<audio>` element
   - Attaches LiveKit AudioTrack to element
3. Handles cleanup on unmount or track change

## Internal Components

- `ParticipantAudio` - Individual audio element per participant

## Technical Details

- Uses `useRoom` hook for LiveKit room access
- Listens to `RoomEvent.TrackSubscribed` / `TrackUnsubscribed`
- Audio elements are `autoPlay` and `playsInline`
- Volume control handled by `useDeafenEffect` via `track.setVolume()`

## Related

- [VideoTiles](./VideoTiles.md)
- [useRoom Hook](../../hooks/useRoom.md)
