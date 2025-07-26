import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Fade,
  Grid,
} from '@mui/material';
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  ScreenShare,
  Fullscreen,
  Close,
  PictureInPicture,
} from '@mui/icons-material';
import { useVoiceConnection } from '../../contexts/VoiceConnectionContext';
import { 
  TrackPublication, 
  RemoteTrack, 
  Track, 
  VideoTrack, 
  LocalTrack,
  RemoteParticipant,
  LocalParticipant
} from 'livekit-client';

interface VideoTileProps {
  participant: RemoteParticipant | LocalParticipant;
  videoTrack?: TrackPublication;
  audioTrack?: TrackPublication;
  isLocal?: boolean;
  onToggleFullscreen?: () => void;
}

const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  videoTrack,
  audioTrack,
  isLocal = false,
  onToggleFullscreen,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !videoTrack) return;

    const track = videoTrack.track as VideoTrack;
    if (track) {
      track.attach(videoElement);
      return () => {
        track.detach(videoElement);
      };
    }
  }, [videoTrack]);

  const hasVideo = videoTrack && !videoTrack.isMuted;
  const hasAudio = audioTrack && !audioTrack.isMuted;
  const displayName = participant.name || participant.identity;

  return (
    <Card
      sx={{
        position: 'relative',
        aspectRatio: '16/9',
        backgroundColor: 'grey.900',
        overflow: 'hidden',
        cursor: onToggleFullscreen ? 'pointer' : 'default',
        transition: 'transform 0.2s ease',
        '&:hover': {
          transform: onToggleFullscreen ? 'scale(1.02)' : 'none',
        },
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onToggleFullscreen}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // Mute local video to prevent echo
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: 'black',
          }}
        />
      ) : (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'grey.800',
          }}
        >
          <Avatar
            sx={{
              width: 80,
              height: 80,
              fontSize: '2rem',
              backgroundColor: 'primary.main',
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </Avatar>
        </Box>
      )}

      {/* Overlay Controls */}
      <Fade in={isHovered || !hasVideo}>
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="caption"
              sx={{
                color: 'white',
                fontWeight: 'bold',
                textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
              }}
            >
              {displayName} {isLocal && '(You)'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {/* Audio indicator */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: hasAudio ? 'rgba(76, 175, 80, 0.8)' : 'rgba(244, 67, 54, 0.8)',
              }}
            >
              {hasAudio ? (
                <Mic sx={{ fontSize: 12, color: 'white' }} />
              ) : (
                <MicOff sx={{ fontSize: 12, color: 'white' }} />
              )}
            </Box>

            {/* Video indicator */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: hasVideo ? 'rgba(76, 175, 80, 0.8)' : 'rgba(244, 67, 54, 0.8)',
              }}
            >
              {hasVideo ? (
                <Videocam sx={{ fontSize: 12, color: 'white' }} />
              ) : (
                <VideocamOff sx={{ fontSize: 12, color: 'white' }} />
              )}
            </Box>
          </Box>
        </Box>
      </Fade>

      {/* Fullscreen button */}
      {onToggleFullscreen && (
        <Fade in={isHovered}>
          <IconButton
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(0,0,0,0.5)',
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.7)',
              },
            }}
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFullscreen();
            }}
          >
            <Fullscreen fontSize="small" />
          </IconButton>
        </Fade>
      )}
    </Card>
  );
};

interface VideoTilesProps {
  isFullscreen?: boolean;
  onExitFullscreen?: () => void;
}

export const VideoTiles: React.FC<VideoTilesProps> = ({
  isFullscreen = false,
  onExitFullscreen,
}) => {
  const { state } = useVoiceConnection();
  const [fullscreenParticipant, setFullscreenParticipant] = useState<string | null>(null);

  if (!state.isConnected || !state.room || !state.showVideoTiles) {
    return null;
  }

  const participants = Array.from(state.room.participants.values());
  const localParticipant = state.room.localParticipant;
  
  // Get all participants with video enabled
  const videoParticipants = [
    ...(state.isVideoEnabled ? [localParticipant] : []),
    ...participants.filter(p => 
      Array.from(p.videoTracks.values()).some(track => !track.isMuted)
    ),
  ];

  if (videoParticipants.length === 0) {
    return null;
  }

  const handleToggleFullscreen = (participantId: string) => {
    setFullscreenParticipant(
      fullscreenParticipant === participantId ? null : participantId
    );
  };

  const containerStyle = isFullscreen
    ? {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1400,
        backgroundColor: 'rgba(0,0,0,0.9)',
        p: 2,
      }
    : {
        position: 'fixed' as const,
        top: 80,
        right: 20,
        width: 320,
        maxHeight: 'calc(100vh - 160px)',
        zIndex: 1200,
        overflowY: 'auto' as const,
      };

  return (
    <Box sx={containerStyle}>
      {/* Header with close button for fullscreen */}
      {isFullscreen && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography variant="h6" color="white">
            Video Call — {state.channelName}
          </Typography>
          <IconButton
            onClick={onExitFullscreen}
            sx={{ color: 'white' }}
          >
            <Close />
          </IconButton>
        </Box>
      )}

      {/* Video Grid */}
      <Grid container spacing={isFullscreen ? 2 : 1}>
        {videoParticipants.map((participant) => {
          const isLocal = participant === localParticipant;
          const videoTrack = Array.from(participant.videoTracks.values())[0];
          const audioTrack = Array.from(participant.audioTracks.values())[0];
          
          return (
            <Grid 
              item 
              xs={
                isFullscreen 
                  ? videoParticipants.length === 1 
                    ? 12 
                    : videoParticipants.length <= 4 
                      ? 6 
                      : 4
                  : 12
              }
              key={participant.identity}
            >
              <VideoTile
                participant={participant}
                videoTrack={videoTrack}
                audioTrack={audioTrack}
                isLocal={isLocal}
                onToggleFullscreen={
                  isFullscreen 
                    ? undefined 
                    : () => handleToggleFullscreen(participant.identity)
                }
              />
            </Grid>
          );
        })}
      </Grid>

      {/* Picture-in-picture toggle for non-fullscreen */}
      {!isFullscreen && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mt: 1,
          }}
        >
          <Tooltip title="Open in fullscreen">
            <IconButton
              size="small"
              onClick={() => {
                state.actions?.setShowVideoTiles?.(false);
                // TODO: Implement fullscreen video overlay
              }}
              sx={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.7)',
                },
              }}
            >
              <PictureInPicture />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};