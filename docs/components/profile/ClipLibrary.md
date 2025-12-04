# ClipLibrary

> **Location:** `frontend/src/components/Profile/ClipLibrary.tsx`
> **Type:** UI Component
> **Category:** voice

## Overview

Grid view of user's saved replay buffer clips. Supports viewing own clips or another user's public clips. Provides download, delete, share, and visibility toggle actions.

## Usage

```tsx
import { ClipLibrary } from '@/components/Profile/ClipLibrary';

// View own clips (editable)
<ClipLibrary />

// View another user's public clips (read-only)
<ClipLibrary userId="other-user-id" />
```

## Features

- Grid of clip cards with thumbnail and metadata
- Play clip in browser
- Download as MP4
- Toggle public/private visibility
- Share to channel or DM (opens destination picker)
- Delete clips
- Shows clip duration and creation date

## API Integration

- `useGetMyClipsQuery` - Fetch current user's clips
- `useGetUserPublicClipsQuery` - Fetch another user's public clips
- `useUpdateClipMutation` - Update clip visibility
- `useDeleteClipMutation` - Delete clip
- `useShareClipMutation` - Share clip to destination

## Related

- [CaptureReplayModal](../voice/CaptureReplayModal.md)
- [TrimPreview](../voice/TrimPreview.md)
- [Replay Buffer Feature](../../features/replay-buffer.md)
