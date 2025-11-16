# Replay Buffer - Frontend Components Documentation

React components for replay buffer feature.

## Component Architecture

```
Voice Channel UI
├── ReplayBufferToggle          (Enable/disable buffer)
├── ReplayIndicatorBadge         (Show who's recording)
├── CaptureReplayButton          (Trigger capture)
└── CaptureReplayModal           (Configure & capture)

User Settings
└── ReplayLibrary                (View & manage clips)

Admin Settings
├── CommunityReplaySettings      (Configure limits)
└── UserQuotaSettings            (Manage quotas)
```

---

## ReplayBufferToggle

Enable/disable replay buffer while screen sharing.

**Location**: `frontend/src/components/voice/ReplayBufferToggle.tsx`

**Props**:
```typescript
interface ReplayBufferToggleProps {
  roomName: string;          // Voice channel ID
  communityId?: string;      // For concurrent limit check
  isScreenSharing: boolean;  // Only show when screen sharing
}
```

**State**:
```typescript
const [isActive, setIsActive] = useState(false);
const [sessionId, setSessionId] = useState<string | null>(null);
const [loading, setLoading] = useState(false);
```

**Implementation**:
```tsx
import React, { useState } from 'react';
import { Switch, FormControlLabel, CircularProgress } from '@mui/material';
import { usestartReplayBufferMutation, useStopReplayBufferMutation } from '@/features/replay/replayApi';

export const ReplayBufferToggle: React.FC<ReplayBufferToggleProps> = ({
  roomName,
  communityId,
  isScreenSharing,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [startBuffer, { isLoading: starting }] = useStartReplayBufferMutation();
  const [stopBuffer, { isLoading: stopping }] = useStopReplayBufferMutation();

  const handleToggle = async () => {
    if (isActive && sessionId) {
      // Stop buffer
      await stopBuffer(sessionId);
      setIsActive(false);
      setSessionId(null);
    } else {
      // Start buffer
      const result = await startBuffer({
        roomName,
        communityId,
        quality: '1080p',
      }).unwrap();

      setIsActive(true);
      setSessionId(result.id);
    }
  };

  if (!isScreenSharing) return null;

  return (
    <FormControlLabel
      control={
        <Switch
          checked={isActive}
          onChange={handleToggle}
          disabled={starting || stopping}
        />
      }
      label={
        <Box display="flex" alignItems="center" gap={1}>
          Replay Buffer
          {(starting || stopping) && <CircularProgress size={16} />}
        </Box>
      }
    />
  );
};
```

**RBAC Integration**:
```tsx
import { usePermission } from '@/hooks/usePermission';

const hasPermission = usePermission('ENABLE_REPLAY_BUFFER', communityId);

if (!hasPermission) return null;
```

---

## ReplayIndicatorBadge

Visual indicator showing who has replay buffer active.

**Location**: `frontend/src/components/voice/ReplayIndicatorBadge.tsx`

**Props**:
```typescript
interface ReplayIndicatorBadgeProps {
  userId: string;
  roomName: string;
}
```

**Implementation**:
```tsx
import React from 'react';
import { Badge, Tooltip } from '@mui/material';
import { FiberManualRecord as RecordIcon } from '@mui/icons-material';
import { useGetActiveSessionsQuery } from '@/features/replay/replayApi';

export const ReplayIndicatorBadge: React.FC<ReplayIndicatorBadgeProps> = ({
  userId,
  roomName,
  children,
}) => {
  const { data: sessions } = useGetActiveSessionsQuery(roomName, {
    pollingInterval: 5000, // Refresh every 5 seconds
  });

  const isRecording = sessions?.activeSessions.some(s => s.userId === userId);

  if (!isRecording) return <>{children}</>;

  return (
    <Tooltip title="Recording replay buffer">
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        badgeContent={
          <RecordIcon
            sx={{
              color: 'error.main',
              fontSize: 12,
              animation: 'pulse 2s infinite',
            }}
          />
        }
      >
        {children}
      </Badge>
    </Tooltip>
  );
};
```

**Usage**:
```tsx
<ReplayIndicatorBadge userId={user.id} roomName={channel.id}>
  <Avatar src={user.avatar} />
</ReplayIndicatorBadge>
```

---

## CaptureReplayButton

Button to trigger replay capture modal.

**Location**: `frontend/src/components/voice/CaptureReplayButton.tsx`

**Props**:
```typescript
interface CaptureReplayButtonProps {
  sessionId: string | null;  // Active session ID
}
```

**Implementation**:
```tsx
import React, { useState } from 'react';
import { Button } from '@mui/material';
import { Videocam as VideocamIcon } from '@mui/icons-material';
import { CaptureReplayModal } from './CaptureReplayModal';

export const CaptureReplayButton: React.FC<CaptureReplayButtonProps> = ({
  sessionId,
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  if (!sessionId) return null;

  return (
    <>
      <Button
        variant="contained"
        startIcon={<VideocamIcon />}
        onClick={() => setModalOpen(true)}
      >
        Capture Replay
      </Button>

      <CaptureReplayModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        sessionId={sessionId}
      />
    </>
  );
};
```

---

## CaptureReplayModal

Modal for configuring and capturing replay.

**Location**: `frontend/src/components/voice/CaptureReplayModal.tsx`

**Props**:
```typescript
interface CaptureReplayModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
}
```

**State**:
```typescript
const [durationMinutes, setDurationMinutes] = useState<1 | 2 | 5 | 10>(5);
const [shareOption, setShareOption] = useState<'dm' | 'channel'>('dm');
const [targetChannelId, setTargetChannelId] = useState<string | null>(null);
const [processing, setProcessing] = useState(false);
```

**Implementation**:
```tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Autocomplete,
  TextField,
  LinearProgress,
  Alert,
} from '@mui/material';
import { useCaptureReplayMutation } from '@/features/replay/replayApi';
import { useGetChannelsQuery } from '@/features/channels/channelsApi';

export const CaptureReplayModal: React.FC<CaptureReplayModalProps> = ({
  open,
  onClose,
  sessionId,
}) => {
  const [durationMinutes, setDurationMinutes] = useState<1 | 2 | 5 | 10>(5);
  const [shareOption, setShareOption] = useState<'dm' | 'channel'>('dm');
  const [targetChannelId, setTargetChannelId] = useState<string | null>(null);

  const [captureReplay, { isLoading, error }] = useCaptureReplayMutation();
  const { data: channels } = useGetChannelsQuery();

  const estimatedSize = durationMinutes * 45; // MB

  const handleCapture = async () => {
    try {
      await captureReplay({
        sessionId,
        durationMinutes,
        shareOption,
        targetChannelId: shareOption === 'channel' ? targetChannelId : undefined,
      }).unwrap();

      onClose();
    } catch (err) {
      console.error('Capture failed:', err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Capture Replay</DialogTitle>

      <DialogContent>
        {/* Duration Selection */}
        <FormLabel>Duration</FormLabel>
        <ToggleButtonGroup
          value={durationMinutes}
          exclusive
          onChange={(_, value) => value && setDurationMinutes(value)}
          fullWidth
        >
          <ToggleButton value={1}>1 min</ToggleButton>
          <ToggleButton value={2}>2 min</ToggleButton>
          <ToggleButton value={5}>5 min</ToggleButton>
          <ToggleButton value={10}>10 min</ToggleButton>
        </ToggleButtonGroup>

        <Alert severity="info" sx={{ mt: 2 }}>
          Estimated size: ~{estimatedSize} MB
        </Alert>

        {/* Share Options */}
        <FormLabel sx={{ mt: 3 }}>Share To</FormLabel>
        <RadioGroup value={shareOption} onChange={(e) => setShareOption(e.target.value as any)}>
          <FormControlLabel value="dm" control={<Radio />} label="Send to Me (DM)" />
          <FormControlLabel value="channel" control={<Radio />} label="Post to Channel" />
        </RadioGroup>

        {/* Channel Selector */}
        {shareOption === 'channel' && (
          <Autocomplete
            options={channels || []}
            getOptionLabel={(option) => option.name}
            onChange={(_, value) => setTargetChannelId(value?.id || null)}
            renderInput={(params) => (
              <TextField {...params} label="Select Channel" required />
            )}
          />
        )}

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error.data?.message || 'Failed to capture replay'}
          </Alert>
        )}

        {/* Progress */}
        {isLoading && <LinearProgress sx={{ mt: 2 }} />}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleCapture}
          variant="contained"
          disabled={isLoading || (shareOption === 'channel' && !targetChannelId)}
        >
          {isLoading ? 'Processing...' : 'Capture'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

---

## ReplayLibrary

User's replay clip library with download/delete.

**Location**: `frontend/src/components/settings/ReplayLibrary.tsx`

**Implementation**:
```tsx
import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  IconButton,
  LinearProgress,
  Grid,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useGetMyClipsQuery, useDeleteClipMutation } from '@/features/replay/replayApi';

export const ReplayLibrary: React.FC = () => {
  const { data, isLoading } = useGetMyClipsQuery();
  const [deleteClip] = useDeleteClipMutation();

  const handleDownload = (clip) => {
    window.open(clip.downloadUrl, '_blank');
  };

  const handleDelete = async (clipId: string) => {
    if (confirm('Delete this replay?')) {
      await deleteClip(clipId);
    }
  };

  if (isLoading) return <LinearProgress />;

  return (
    <Box>
      {/* Quota Display */}
      <Box mb={3}>
        <Typography variant="h6">Storage Used</Typography>
        <LinearProgress
          variant="determinate"
          value={(data?.quotaUsed / data?.quotaTotal) * 100}
        />
        <Typography variant="caption">
          {formatBytes(data?.quotaUsed)} / {formatBytes(data?.quotaTotal)}
        </Typography>
      </Box>

      {/* Clips Grid */}
      <Grid container spacing={2}>
        {data?.clips.map((clip) => (
          <Grid item xs={12} sm={6} md={4} key={clip.id}>
            <Card>
              <CardContent>
                <Typography variant="h6">
                  {formatDuration(clip.durationSeconds)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(clip.createdAt).toLocaleDateString()}
                </Typography>
                <Typography variant="caption">
                  {formatBytes(clip.sizeBytes)}
                </Typography>
              </CardContent>
              <CardActions>
                <IconButton onClick={() => handleDownload(clip)}>
                  <DownloadIcon />
                </IconButton>
                <IconButton onClick={() => handleDelete(clip.id)} color="error">
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};
```

---

## RTK Query API Slice

**Location**: `frontend/src/features/replay/replayApi.ts`

```typescript
import { createApi } from '@reduxjs/toolkit/query/react';
import { authedBaseQuery } from '@/app/store';

export const replayApi = createApi({
  reducerPath: 'replayApi',
  baseQuery: authedBaseQuery,
  tagTypes: ['ReplaySessions', 'ReplayClips'],
  endpoints: (builder) => ({
    startReplayBuffer: builder.mutation({
      query: (body) => ({
        url: '/livekit-replay/start',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ReplaySessions'],
    }),

    stopReplayBuffer: builder.mutation({
      query: (sessionId) => ({
        url: `/livekit-replay/stop/${sessionId}`,
        method: 'POST',
      }),
      invalidatesTags: ['ReplaySessions'],
    }),

    captureReplay: builder.mutation({
      query: (body) => ({
        url: '/livekit-replay/capture',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ReplayClips'],
    }),

    getActiveSessions: builder.query({
      query: (roomName) => `/livekit-replay/status/${roomName}`,
      providesTags: ['ReplaySessions'],
    }),

    getMyClips: builder.query({
      query: (params) => ({
        url: '/livekit-replay/my-clips',
        params,
      }),
      providesTags: ['ReplayClips'],
    }),

    deleteClip: builder.mutation({
      query: (clipId) => ({
        url: `/livekit-replay/clips/${clipId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ReplayClips'],
    }),
  }),
});

export const {
  useStartReplayBufferMutation,
  useStopReplayBufferMutation,
  useCaptureReplayMutation,
  useGetActiveSessionsQuery,
  useGetMyClipsQuery,
  useDeleteClipMutation,
} = replayApi;
```

---

## Integration Example

**Voice Channel Component**:

```tsx
import React from 'react';
import { Box, Stack } from '@mui/material';
import { ReplayBufferToggle } from '@/components/voice/ReplayBufferToggle';
import { CaptureReplayButton } from '@/components/voice/CaptureReplayButton';
import { ReplayIndicatorBadge } from '@/components/voice/ReplayIndicatorBadge';

export const VoiceChannelControls: React.FC<{ channel }> = ({ channel }) => {
  const { isScreenSharing } = useScreenShare();
  const [sessionId, setSessionId] = useState(null);

  return (
    <Stack spacing={2}>
      {/* Participants List with Recording Indicators */}
      {participants.map((user) => (
        <ReplayIndicatorBadge key={user.id} userId={user.id} roomName={channel.id}>
          <UserAvatar user={user} />
        </ReplayIndicatorBadge>
      ))}

      {/* Replay Buffer Controls */}
      <Box>
        <ReplayBufferToggle
          roomName={channel.id}
          communityId={channel.communityId}
          isScreenSharing={isScreenSharing}
          onSessionChange={setSessionId}
        />

        <CaptureReplayButton sessionId={sessionId} />
      </Box>
    </Stack>
  );
};
```

---

## Styling

**Material-UI Theme Customization**:

```typescript
// theme.ts
export const theme = createTheme({
  components: {
    MuiBadge: {
      styleOverrides: {
        badge: {
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.5 },
          },
        },
      },
    },
  },
});
```

---

## Error Handling

```tsx
const [captureReplay, { error, isError }] = useCaptureReplayMutation();

// Display errors
{isError && (
  <Alert severity="error">
    {error.status === 507 ? 'Storage quota exceeded' :
     error.status === 429 ? 'Too many concurrent buffers' :
     'Failed to capture replay'}
  </Alert>
)}
```

---

## WebSocket Integration (Optional)

Real-time updates for session status:

```tsx
import { useSocket } from '@/hooks/useSocket';

const socket = useSocket();

useEffect(() => {
  socket.on('replay_buffer_started', (data) => {
    // Update UI
  });

  socket.on('replay_buffer_stopped', (data) => {
    // Update UI
  });

  return () => {
    socket.off('replay_buffer_started');
    socket.off('replay_buffer_stopped');
  };
}, [socket]);
```

---

## Testing

**Component Tests**:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ReplayBufferToggle } from './ReplayBufferToggle';

test('shows toggle when screen sharing', () => {
  render(<ReplayBufferToggle isScreenSharing={true} roomName="room-1" />);
  expect(screen.getByText('Replay Buffer')).toBeInTheDocument();
});

test('starts buffer when toggled', async () => {
  const { user } = render(<ReplayBufferToggle isScreenSharing={true} roomName="room-1" />);

  await user.click(screen.getByRole('checkbox'));
  expect(mockStartMutation).toHaveBeenCalled();
});
```

---

## Next Steps

- Implement components in frontend codebase
- Add to voice channel UI
- Add to user settings
- Test with real LiveKit integration
- Add WebSocket real-time updates (optional)
