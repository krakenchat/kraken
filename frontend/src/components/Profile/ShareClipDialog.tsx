import React, { useState, useEffect } from 'react';
import {
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
  FormControlLabel,
} from '@mui/material';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  livekitControllerShareClipMutation,
  communityControllerFindAllMineOptions,
  channelsControllerFindAllForCommunityOptions,
  directMessagesControllerFindUserDmGroupsOptions,
} from '../../api-client/@tanstack/react-query.gen';
import { useNotification } from '../../contexts/NotificationContext';
import { logger } from '../../utils/logger';
import type { Community } from '../../types/community.type';
import type { Channel } from '../../types/channel.type';
import type { DirectMessageGroup } from '../../types/direct-message.type';

interface ShareClipDialogProps {
  open: boolean;
  onClose: () => void;
  clipId: string | null;
}

const getErrorMessage = (err: unknown, defaultMessage: string): string => {
  if (err && typeof err === 'object') {
    if ('data' in err && err.data && typeof err.data === 'object' && 'message' in err.data) {
      const message = (err.data as { message: string }).message;
      return typeof message === 'string' ? message : defaultMessage;
    }
    if (err instanceof Error) {
      return err.message || defaultMessage;
    }
  }
  return defaultMessage;
};

const ShareClipDialog: React.FC<ShareClipDialogProps> = ({ open, onClose, clipId }) => {
  const { showNotification } = useNotification();

  const [shareDestination, setShareDestination] = useState<'channel' | 'dm'>('channel');
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [selectedDmGroupId, setSelectedDmGroupId] = useState('');

  const { mutateAsync: shareClip } = useMutation(livekitControllerShareClipMutation());

  // Fetch communities, channels, and DMs for sharing
  const { data: communitiesData } = useQuery({
    ...communityControllerFindAllMineOptions(),
    enabled: open && shareDestination === 'channel',
  });
  const { data: channelsData } = useQuery({
    ...channelsControllerFindAllForCommunityOptions({ path: { communityId: selectedCommunityId } }),
    enabled: !!selectedCommunityId && open && shareDestination === 'channel',
  });
  const { data: dmsData } = useQuery({
    ...directMessagesControllerFindUserDmGroupsOptions(),
    enabled: open && shareDestination === 'dm',
  });

  const textChannels = channelsData?.filter((ch: Channel) => ch.type !== 'VOICE') || [];

  // Reset channel when community changes
  useEffect(() => {
    setSelectedChannelId('');
  }, [selectedCommunityId]);

  const handleShare = async () => {
    if (!clipId) return;

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
        path: { clipId },
        body: {
          destination: shareDestination,
          ...(shareDestination === 'channel' && { targetChannelId: selectedChannelId }),
          ...(shareDestination === 'dm' && { targetDirectMessageGroupId: selectedDmGroupId }),
        },
      });
      showNotification('Clip shared successfully', 'success');
      onClose();
    } catch (err) {
      logger.error('Failed to share clip:', err);
      showNotification(getErrorMessage(err, 'Failed to share clip'), 'error');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
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
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleShare}>
          Share
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShareClipDialog;
