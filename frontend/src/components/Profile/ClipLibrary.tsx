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
  Skeleton,
} from '@mui/material';
import {
  Download,
  Delete,
  Share,
  Public,
  PublicOff,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  livekitControllerGetMyClipsOptions,
  livekitControllerGetUserPublicClipsOptions,
  livekitControllerUpdateClipMutation,
  livekitControllerDeleteClipMutation,
  livekitControllerShareClipMutation,
  communityControllerFindAllMineOptions,
  channelsControllerFindAllForCommunityOptions,
  directMessagesControllerFindUserDmGroupsOptions,
} from '../../api-client/@tanstack/react-query.gen';

import type { ClipResponseDto as ClipResponse } from '../../api-client/types.gen';
import { useNotification } from '../../contexts/NotificationContext';
import { getApiUrl } from '../../config/env';
import { getAuthToken, getAuthenticatedUrl } from '../../utils/auth';
import { logger } from '../../utils/logger';
import EmptyState from '../Common/EmptyState';
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

// Skeleton card for loading state
const ClipCardSkeleton: React.FC = memo(() => (
  <Card>
    <Skeleton variant="rectangular" height={150} animation="wave" />
    <CardContent sx={{ pb: 1 }}>
      <Skeleton variant="text" width="70%" height={24} />
      <Box display="flex" gap={2} mt={1}>
        <Skeleton variant="text" width={40} />
        <Skeleton variant="text" width={50} />
      </Box>
      <Skeleton variant="text" width="60%" sx={{ mt: 0.5 }} />
      <Box display="flex" alignItems="center" gap={1} mt={1}>
        <Skeleton variant="circular" width={20} height={20} />
        <Skeleton variant="text" width={80} />
      </Box>
    </CardContent>
    <CardActions sx={{ pt: 0 }}>
      <Skeleton variant="circular" width={28} height={28} />
      <Skeleton variant="circular" width={28} height={28} />
      <Skeleton variant="circular" width={28} height={28} />
    </CardActions>
  </Card>
));

// Video card component with native video playback via cookie auth
const ClipCard: React.FC<{
  clip: ClipResponse;
  isOwnProfile: boolean;
  isDownloading: boolean;
  onTogglePublic: (clipId: string, currentValue: boolean) => void;
  onDownload: (clip: ClipResponse) => void;
  onShare: (clipId: string) => void;
  onDelete: (clipId: string) => void;
}> = memo(({ clip, isOwnProfile, isDownloading, onTogglePublic, onDownload, onShare, onDelete }) => {

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
          <source src={getAuthenticatedUrl(getApiUrl(clip.downloadUrl))} type="video/mp4" />
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
        <Tooltip title={isDownloading ? 'Downloading...' : 'Download'}>
          <span>
            <IconButton
              size="small"
              onClick={() => onDownload(clip)}
              disabled={isDownloading}
              aria-label={`Download ${clip.filename}`}
            >
              {isDownloading ? <CircularProgress size={18} /> : <Download fontSize="small" />}
            </IconButton>
          </span>
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

  const queryClient = useQueryClient();

  // Fetch clips based on whether viewing own or other's profile
  const { data: ownClips, isLoading: ownLoading, error: ownError } = useQuery({
    ...livekitControllerGetMyClipsOptions(),
    enabled: isOwnProfile,
  });
  const { data: publicClips, isLoading: publicLoading, error: publicError } = useQuery({
    ...livekitControllerGetUserPublicClipsOptions({ path: { userId } }),
    enabled: !isOwnProfile,
  });

  const clips = isOwnProfile ? ownClips : publicClips;
  const isLoading = isOwnProfile ? ownLoading : publicLoading;
  const error = isOwnProfile ? ownError : publicError;

  const { mutateAsync: updateClip } = useMutation({
    ...livekitControllerUpdateClipMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'livekitControllerGetMyClips' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'livekitControllerGetUserPublicClips' }] });
    },
  });
  const { mutateAsync: deleteClip } = useMutation({
    ...livekitControllerDeleteClipMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'livekitControllerGetMyClips' }] });
      queryClient.invalidateQueries({ queryKey: [{ _id: 'livekitControllerGetUserPublicClips' }] });
    },
  });
  const { mutateAsync: shareClip } = useMutation(livekitControllerShareClipMutation());

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [shareDestination, setShareDestination] = useState<'channel' | 'dm'>('channel');
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedDmGroupId, setSelectedDmGroupId] = useState('');

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clipToDelete, setClipToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Download state tracking
  const [downloadingClipId, setDownloadingClipId] = useState<string | null>(null);

  // Fetch communities, channels, and DMs for sharing
  const { data: communitiesData } = useQuery({
    ...communityControllerFindAllMineOptions(),
    enabled: shareDialogOpen && shareDestination === 'channel',
  });
  const { data: channelsData } = useQuery({
    ...channelsControllerFindAllForCommunityOptions({ path: { communityId: selectedCommunityId } }),
    enabled: !!selectedCommunityId && shareDialogOpen && shareDestination === 'channel',
  });
  const { data: dmsData } = useQuery({
    ...directMessagesControllerFindUserDmGroupsOptions(),
    enabled: shareDialogOpen && shareDestination === 'dm',
  });

  const textChannels = channelsData?.filter((ch: Channel) => ch.type !== 'VOICE') || [];

  // Reset channel when community changes
  React.useEffect(() => {
    setSelectedChannelId('');
  }, [selectedCommunityId]);

  const handleTogglePublic = useCallback(async (clipId: string, currentValue: boolean) => {
    try {
      await updateClip({ path: { clipId }, body: { isPublic: !currentValue } });
      showNotification(
        !currentValue ? 'Clip is now visible on your profile' : 'Clip is now private',
        'success'
      );
    } catch (err) {
      logger.error('Failed to update clip visibility:', err);
      showNotification(getErrorMessage(err, 'Failed to update clip visibility'), 'error');
    }
  }, [updateClip, showNotification]);

  const handleOpenDeleteDialog = useCallback((clipId: string) => {
    setClipToDelete(clipId);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!clipToDelete) return;

    setIsDeleting(true);
    try {
      await deleteClip({ path: { clipId: clipToDelete } });
      showNotification('Clip deleted', 'success');
      setDeleteDialogOpen(false);
      setClipToDelete(null);
    } catch (err) {
      logger.error('Failed to delete clip:', err);
      showNotification(getErrorMessage(err, 'Failed to delete clip'), 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [clipToDelete, deleteClip, showNotification]);

  const handleCloseDeleteDialog = useCallback(() => {
    if (!isDeleting) {
      setDeleteDialogOpen(false);
      setClipToDelete(null);
    }
  }, [isDeleting]);

  const handleDownload = useCallback(async (clip: ClipResponse) => {
    const token = getAuthToken();
    if (!token) {
      showNotification('Not authenticated', 'error');
      return;
    }

    setDownloadingClipId(clip.id);
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
      logger.error('Failed to download clip:', err);
      showNotification(getErrorMessage(err, 'Failed to download clip'), 'error');
    } finally {
      setDownloadingClipId(null);
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
        path: { clipId: selectedClipId },
        body: {
          destination: shareDestination,
          ...(shareDestination === 'channel' && { targetChannelId: selectedChannelId }),
          ...(shareDestination === 'dm' && { targetDirectMessageGroupId: selectedDmGroupId }),
        },
      });
      showNotification('Clip shared successfully', 'success');
      setShareDialogOpen(false);
    } catch (err) {
      logger.error('Failed to share clip:', err);
      showNotification(getErrorMessage(err, 'Failed to share clip'), 'error');
    }
  };

  if (isLoading) {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          {isOwnProfile ? 'My Clip Library' : 'Public Clips'}
        </Typography>
        <Skeleton variant="text" width={200} sx={{ mb: 3 }} />
        <Grid container spacing={2}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <ClipCardSkeleton />
            </Grid>
          ))}
        </Grid>
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
      <EmptyState
        variant="clips"
        description={
          isOwnProfile
            ? 'Capture a replay while screen sharing to save your best moments.'
            : 'This user has no public clips to show.'
        }
      />
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
              isDownloading={downloadingClipId === clip.id}
              onTogglePublic={handleTogglePublic}
              onDownload={handleDownload}
              onShare={handleOpenShareDialog}
              onDelete={handleOpenDeleteDialog}
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Clip</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this clip? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseDeleteDialog}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={16} /> : <Delete />}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
