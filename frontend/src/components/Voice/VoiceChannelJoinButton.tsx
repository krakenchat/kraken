import React from 'react';
import { Box, Button, Tooltip, CircularProgress } from '@mui/material';
import { VolumeUp, VolumeOff, VideoCall } from '@mui/icons-material';
import { useVoiceConnection } from '../../hooks/useVoiceConnection';
import { useLocalMediaState } from '../../hooks/useLocalMediaState';
import { ChannelType } from '../../types/channel.type';
import { Channel } from '../../types/channel.type';

interface VoiceChannelJoinButtonProps {
  channel: Channel;
  disabled?: boolean;
}

export const VoiceChannelJoinButton: React.FC<VoiceChannelJoinButtonProps> = ({
  channel,
  disabled = false
}) => {
  const { state, actions } = useVoiceConnection();
  const { isCameraEnabled } = useLocalMediaState();

  if (channel.type !== ChannelType.VOICE) {
    return null;
  }

  const isCurrentChannel = state.currentChannelId === channel.id;
  const isConnecting = state.isConnecting && state.currentChannelId === channel.id;

  const handleJoinLeave = async () => {
    if (isCurrentChannel) {
      await actions.leaveVoiceChannel();
    } else {
      await actions.joinVoiceChannel(channel.id, channel.name);
    }
  };

  const getButtonText = () => {
    if (isConnecting) return 'Connecting...';
    if (isCurrentChannel) return 'Disconnect';
    return 'Join Voice';
  };

  const getButtonColor = () => {
    if (isCurrentChannel) return 'secondary';
    return 'primary';
  };

  const getButtonIcon = () => {
    if (isConnecting) {
      return <CircularProgress size={16} color="inherit" />;
    }
    if (isCurrentChannel) {
      return isCameraEnabled ? <VideoCall /> : <VolumeOff />;
    }
    return <VolumeUp />;
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title={isCurrentChannel ? 'Leave voice channel' : 'Join voice channel'}>
        <Button
          variant={isCurrentChannel ? 'contained' : 'outlined'}
          color={getButtonColor()}
          size="small"
          startIcon={getButtonIcon()}
          onClick={handleJoinLeave}
          disabled={disabled || isConnecting}
          sx={{
            minWidth: 120,
            transition: 'all 0.2s ease',
            '&:hover': {
              transform: 'translateY(-1px)',
            },
          }}
        >
          {getButtonText()}
        </Button>
      </Tooltip>
      
      {state.connectionError && isCurrentChannel && (
        <Tooltip title={state.connectionError}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'error.main',
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.5 },
                '100%': { opacity: 1 },
              },
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
};