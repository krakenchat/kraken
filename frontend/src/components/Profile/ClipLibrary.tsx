import React, { useState, useCallback, memo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Switch,
  FormControlLabel,
  CircularProgress,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  Radio,
} from '@mui/material';
import {
  Download,
  Delete,
  Share,
  Public,
  PublicOff,
  VideoFile,
  PlayArrow,
} from '@mui/icons-material';
import { format } from 'date-fns';
import {
  useGetMyClipsQuery,
  useGetUserPublicClipsQuery,
  useUpdateClipMutation,
  useDeleteClipMutation,
  useShareClipMutation,
  ClipResponse,
} from '../../features/livekit/livekitApiSlice';
import { useMyCommunitiesQuery } from '../../features/community/communityApiSlice';
import { useGetChannelsForCommunityQuery } from '../../features/channel/channelApiSlice';
import { useGetUserDmGroupsQuery } from '../../features/directMessages/directMessagesApiSlice';
import { useNotification } from '../../contexts/NotificationContext';
import { getApiUrl } from '../../config/env';
import { getAuthToken } from '../../utils/auth';
import type { Community } from '../../types/community.type';
import type { Channel } from '../../types/channel.type';
import type { DirectMessageGroup } from '../../types/direct-message.type';

interface ClipLibraryProps {
  userId: string;
  isOwnProfile: boolean;
}

// Helper to extract error message from RTK Query error or fetch error
const getErrorMessage = (err: unknown, defaultMessage: string): string => {
  if (err && typeof err === 'object') {
    // RTK Query error with server message
    if ('data' in err && err.data && typeof err.data === 'object' && 'message' in err.data) {
      const message = (err.data as { message: string }).message;
      return typeof message === 'string' ? message : defaultMessage;
    }
    // Standard Error object
    if (err instanceof Error) {
      return err.message || defaultMessage;
    }
  }
  return defaultMessage;
};

// Helper functions outside component to avoid recreation
const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

const formatFileSize = (bytes: number) => {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
};

// Video card component with native video playback via cookie auth
const ClipCard: React.FC<{
  clip: ClipResponse;
  isOwnProfile: boolean;
  onTogglePublic: (clipId: string, currentValue: boolean) => void;
  onDownload: (clip: ClipResponse) => void;
  onShare: (clipId: string) => void;
  onDelete: (clipId: string) => void;
}> = memo(({ clip, isOwnProfile, onTogglePublic, onDownload, onShare, onDelete }) => {

  return (
    <Card>
      {/* Video Player - uses cookie-based auth for native browser video */}
      <Box
        sx={{
          position: 'relative',
          backgroundColor: 'black',
          minHeight: '150px',
        }}
      >
        <video
          controls
          style={{ width: '100%', maxHeight: '200px', display: 'block' }}
          preload="metadata"
          crossOrigin="use-credentials"
          aria-label={`Video clip: ${clip.filename}`}
        >
          <source src={getApiUrl(clip.downloadUrl)} type="video/mp4" />
          Your browser does not support video playback.
        </video>
      </Box>
      <CardContent sx={{ pb: 1 }}>
        <Typography variant="subtitle2" noWrap gutterBottom>
          {clip.filename}
        </Typography>
        <Box display="flex" gap={2} flexWrap="wrap">
          <Typography variant="body2" color="text.secondary">
            {formatDuration(clip.durationSeconds)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatFileSize(clip.sizeBytes)}
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {format(new Date(clip.capturedAt), 'MMM d, yyyy h:mm a')}
        </Typography>

        {isOwnProfile && (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={clip.isPublic}
                onChange={() => onTogglePublic(clip.id, clip.isPublic)}
              />
            }
            label={
              <Box display="flex" alignItems="center" gap={0.5}>
                {clip.isPublic ? (
                  <Public fontSize="small" color="primary" />
                ) : (
                  <PublicOff fontSize="small" color="disabled" />
                )}
                <Typography variant="caption">
                  {clip.isPublic ? 'Visible on profile' : 'Private'}
                </Typography>
              </Box>
            }
            sx={{ mt: 1, ml: 0 }}
          />
        )}
      </CardContent>
      <CardActions sx={{ pt: 0 }}>
        <Tooltip title="Download">
          <IconButton size="small" onClick={() => onDownload(clip)} aria-label={`Download ${clip.filename}`}>
            <Download fontSize="small" />
          </IconButton>
        </Tooltip>
        {isOwnProfile && (
          <>
            <Tooltip title="Share to channel or DM">
              <IconButton size="small" onClick={() => onShare(clip.id)} aria-label={`Share ${clip.filename}`}>
                <Share fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={() => onDelete(clip.id)} aria-label={`Delete ${clip.filename}`}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </CardActions>
    </Card>
  );
});

export const ClipLibrary: React.FC<ClipLibraryProps> = ({ userId, isOwnProfile }) => {
  const { showNotification } = useNotification();

  // Fetch clips based on whether viewing own or other's profile
  const { data: ownClips, isLoading: ownLoading, error: ownError } = useGetMyClipsQuery(undefined, {
    skip: !isOwnProfile,
  });
  const { data: publicClips, isLoading: publicLoading, error: publicError } = useGetUserPublicClipsQuery(userId, {
    skip: isOwnProfile,
  });

  const clips = isOwnProfile ? ownClips : publicClips;
  const isLoading = isOwnProfile ? ownLoading : publicLoading;
  const error = isOwnProfile ? ownError : publicError;

  const [updateClip] = useUpdateClipMutation();
  const [deleteClip] = useDeleteClipMutation();
  const [shareClip] = useShareClipMutation();

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [shareDestination, setShareDestination] = useState<'channel' | 'dm'>('channel');
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedDmGroupId, setSelectedDmGroupId] = useState('');

  // Fetch communities, channels, and DMs for sharing
  const { data: communitiesData } = useMyCommunitiesQuery(undefined, {
    skip: !shareDialogOpen || shareDestination !== 'channel',
  });
  const { data: channelsData } = useGetChannelsForCommunityQuery(selectedCommunityId, {
    skip: !selectedCommunityId || !shareDialogOpen || shareDestination !== 'channel',
  });
  const { data: dmsData } = useGetUserDmGroupsQuery(undefined, {
    skip: !shareDialogOpen || shareDestination !== 'dm',
  });

  const textChannels = channelsData?.filter((ch: Channel) => ch.type !== 'VOICE') || [];

  // Reset channel when community changes
  React.useEffect(() => {
    setSelectedChannelId('');
  }, [selectedCommunityId]);

  const handleTogglePublic = useCallback(async (clipId: string, currentValue: boolean) => {
    try {
      await updateClip({ clipId, data: { isPublic: !currentValue } }).unwrap();
      showNotification(
        !currentValue ? 'Clip is now visible on your profile' : 'Clip is now private',
        'success'
      );
    } catch (err) {
      console.error('Failed to update clip visibility:', err);
      showNotification(getErrorMessage(err, 'Failed to update clip visibility'), 'error');
    }
  }, [updateClip, showNotification]);

  const handleDelete = useCallback(async (clipId: string) => {
    if (!confirm('Are you sure you want to delete this clip? This cannot be undone.')) {
      return;
    }
    try {
      await deleteClip(clipId).unwrap();
      showNotification('Clip deleted', 'success');
    } catch (err) {
      console.error('Failed to delete clip:', err);
      showNotification(getErrorMessage(err, 'Failed to delete clip'), 'error');
    }
  }, [deleteClip, showNotification]);

  const handleDownload = useCallback(async (clip: ClipResponse) => {
    const token = getAuthToken();
    if (!token) {
      showNotification('Not authenticated', 'error');
      return;
    }

    try {
      const response = await fetch(getApiUrl(clip.downloadUrl), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = clip.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      console.error('Failed to download clip:', err);
      showNotification(getErrorMessage(err, 'Failed to download clip'), 'error');
    }
  }, [showNotification]);

  const handleOpenShareDialog = useCallback((clipId: string) => {
    setSelectedClipId(clipId);
    setShareDialogOpen(true);
  }, []);

  const handleShare = async () => {
    if (!selectedClipId) return;

    if (shareDestination === 'channel' && !selectedChannelId) {
      showNotification('Please select a channel', 'error');
      return;
    }
    if (shareDestination === 'dm' && !selectedDmGroupId) {
      showNotification('Please select a DM conversation', 'error');
      return;
    }

    try {
      await shareClip({
        clipId: selectedClipId,
        data: {
          destination: shareDestination,
          ...(shareDestination === 'channel' && { targetChannelId: selectedChannelId }),
          ...(shareDestination === 'dm' && { targetDirectMessageGroupId: selectedDmGroupId }),
        },
      }).unwrap();
      showNotification('Clip shared successfully', 'success');
      setShareDialogOpen(false);
    } catch (err) {
      console.error('Failed to share clip:', err);
      showNotification(getErrorMessage(err, 'Failed to share clip'), 'error');
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load clips
      </Alert>
    );
  }

  if (!clips || clips.length === 0) {
    return (
      <Box py={4} textAlign="center">
        <VideoFile sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography color="text.secondary">
          {isOwnProfile
            ? 'No clips in your library yet. Capture a replay while screen sharing to get started!'
            : 'No public clips to show'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {isOwnProfile ? 'My Clip Library' : 'Public Clips'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {isOwnProfile
          ? 'Manage your saved replay clips. Toggle "Show on profile" to make clips visible to others.'
          : `${clips.length} public clip${clips.length !== 1 ? 's' : ''}`}
      </Typography>

      <Grid container spacing={2}>
        {clips.map((clip) => (
          <Grid item xs={12} sm={6} md={4} key={clip.id}>
            <ClipCard
              clip={clip}
              isOwnProfile={isOwnProfile}
              onTogglePublic={handleTogglePublic}
              onDownload={handleDownload}
              onShare={handleOpenShareDialog}
              onDelete={handleDelete}
            />
          </Grid>
        ))}
      </Grid>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Share Clip</DialogTitle>
        <DialogContent>
          <RadioGroup
            value={shareDestination}
            onChange={(e) => setShareDestination(e.target.value as 'channel' | 'dm')}
            sx={{ mt: 1 }}
          >
            <FormControlLabel value="channel" control={<Radio />} label="Share to channel" />
            <FormControlLabel value="dm" control={<Radio />} label="Share to DM" />
          </RadioGroup>

          {shareDestination === 'channel' && (
            <>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Select Community</InputLabel>
                <Select
                  value={selectedCommunityId}
                  onChange={(e) => setSelectedCommunityId(e.target.value)}
                  label="Select Community"
                >
                  {communitiesData?.map((community: Community) => (
                    <MenuItem key={community.id} value={community.id}>
                      {community.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {selectedCommunityId && (
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Select Channel</InputLabel>
                  <Select
                    value={selectedChannelId}
                    onChange={(e) => setSelectedChannelId(e.target.value)}
                    label="Select Channel"
                  >
                    {textChannels.map((channel: Channel) => (
                      <MenuItem key={channel.id} value={channel.id}>
                        #{channel.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </>
          )}

          {shareDestination === 'dm' && (
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Select DM</InputLabel>
              <Select
                value={selectedDmGroupId}
                onChange={(e) => setSelectedDmGroupId(e.target.value)}
                label="Select DM"
              >
                {dmsData?.map((dm: DirectMessageGroup) => (
                  <MenuItem key={dm.id} value={dm.id}>
                    {dm.members.map((member) => member.user.username).join(', ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleShare}>
            Share
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
