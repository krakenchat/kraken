import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Card,
  Fade,
  Tooltip,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  ScreenShare,
  CropFree,
  PushPin,
  PushPinOutlined,
  FiberManualRecord,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import type {
  TrackPublication,
  VideoTrack,
  RemoteParticipant,
  LocalParticipant,
} from 'livekit-client';
import UserAvatar from '../Common/UserAvatar';
import ScreenShareVolumeControl from './ScreenShareVolumeControl';

export interface VideoTileProps {
  participant: RemoteParticipant | LocalParticipant;
  videoTrack?: TrackPublication;
  audioTrack?: TrackPublication;
  screenTrack?: TrackPublication;
  isLocal?: boolean;
  isReplayBufferActive?: boolean;
  onToggleFullscreen?: () => void;
  onPin?: () => void;
  isPinned?: boolean;
  isSpotlighted?: boolean;
  isPlaceholder?: boolean;
  placeholderType?: 'camera' | 'screen';
  onWatch?: () => void;
  onStopWatching?: () => void;
}

const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  videoTrack,
  audioTrack,
  screenTrack,
  isLocal = false,
  isReplayBufferActive = false,
  onToggleFullscreen,
  onPin,
  isPinned = false,
  isSpotlighted = false,
  isPlaceholder = false,
  placeholderType,
  onWatch,
  onStopWatching,
}) => {
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  // Handle video track
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !videoTrack) return;

    const track = videoTrack.track as VideoTrack;
    if (track) {
      track.attach(videoElement);
      videoElement.play().catch(() => {
        // Ignore autoplay errors - browser policy might block auto-play
      });
      return () => {
        track.detach(videoElement);
      };
    }
  }, [videoTrack, videoTrack?.track]);

  // Handle screen share track
  useEffect(() => {
    const screenElement = screenRef.current;
    if (!screenElement || !screenTrack) return;

    const track = screenTrack.track as VideoTrack;
    if (track) {
      track.attach(screenElement);
      screenElement.play().catch(() => {
        // Ignore autoplay errors
      });
      return () => {
        track.detach(screenElement);
      };
    }
  }, [screenTrack, screenTrack?.track]);

  const hasVideo = videoTrack && !videoTrack.isMuted;
  const hasScreen = screenTrack && !screenTrack.isMuted;
  const hasAudio = audioTrack && !audioTrack.isMuted;
  const displayName = participant.name || participant.identity;
  const isSharing = hasScreen;

  // Placeholder tile for unwatched streams — shows avatar + "Watch" button
  if (isPlaceholder && onWatch) {
    return (
      <Card
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          backgroundColor: 'grey.900',
          overflow: 'hidden',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'grey.800',
          },
        }}
        onClick={onWatch}
        role="button"
        tabIndex={0}
        aria-label={`Watch ${displayName} ${placeholderType === 'screen' ? 'screen share' : 'camera'}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onWatch();
          }
        }}
      >
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
          }}
        >
          <UserAvatar userId={participant.identity} displayName={participant.name} size="xlarge" />
          <Typography variant="caption" sx={{ color: 'grey.300', fontWeight: 'bold' }}>
            {displayName}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              backgroundColor: alpha(theme.palette.primary.main, 0.2),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
            }}
          >
            <Visibility sx={{ fontSize: 16, color: theme.palette.primary.light }} />
            <Typography variant="caption" sx={{ color: theme.palette.primary.light, fontWeight: 600 }}>
              {placeholderType === 'screen' ? 'Watch Screen Share' : 'Watch Camera'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {placeholderType === 'screen' ? (
              <ScreenShare sx={{ fontSize: 14, color: 'grey.500' }} />
            ) : (
              <Videocam sx={{ fontSize: 14, color: 'grey.500' }} />
            )}
            <Typography variant="caption" sx={{ color: 'grey.500', fontSize: '0.7rem' }}>
              {placeholderType === 'screen' ? 'Sharing screen' : 'Camera on'}
            </Typography>
          </Box>
        </Box>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: 'grey.900',
        overflow: 'hidden',
        cursor: onToggleFullscreen ? 'pointer' : 'default',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onToggleFullscreen}
    >
      {hasScreen ? (
        <video
          ref={screenRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            backgroundColor: 'black',
          }}
        />
      ) : hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={{
            width: '100%',
            height: '100%',
            objectFit: isSpotlighted ? 'contain' : 'cover',
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
          <UserAvatar userId={participant.identity} displayName={participant.name} size="xlarge" />
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
            backgroundImage: `linear-gradient(transparent, ${alpha(theme.palette.background.paper, 0.85)})`,
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
              {displayName} {isLocal && '(You)'} {isSharing && ' - Screen'}
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
                backgroundColor: hasAudio ? alpha(theme.palette.semantic.status.positive, 0.8) : alpha(theme.palette.semantic.status.negative, 0.8),
              }}
            >
              {hasAudio ? (
                <Mic sx={{ fontSize: 12, color: 'white' }} />
              ) : (
                <MicOff sx={{ fontSize: 12, color: 'white' }} />
              )}
            </Box>

            {/* Video/Screen share indicator */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: (hasVideo || hasScreen) ? alpha(theme.palette.semantic.status.positive, 0.8) : alpha(theme.palette.semantic.status.negative, 0.8),
              }}
            >
              {hasScreen ? (
                <ScreenShare sx={{ fontSize: 12, color: 'white' }} />
              ) : hasVideo ? (
                <Videocam sx={{ fontSize: 12, color: 'white' }} />
              ) : (
                <VideocamOff sx={{ fontSize: 12, color: 'white' }} />
              )}
            </Box>
          </Box>
        </Box>
      </Fade>

      {/* Action buttons - top right */}
      <Fade in={isHovered || isPinned || isSpotlighted}>
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 0.5,
          }}
        >
          {/* Stop watching button */}
          {onStopWatching && !isLocal && (
            <Tooltip title="Stop watching">
              <IconButton
                sx={{
                  backgroundColor: alpha(theme.palette.background.paper, 0.5),
                  color: theme.palette.common.white,
                  width: 32,
                  height: 32,
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.semantic.status.negative, 0.8),
                  },
                }}
                size="small"
                aria-label="Stop watching"
                onClick={(e) => {
                  e.stopPropagation();
                  onStopWatching();
                }}
              >
                <VisibilityOff fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {/* Screenshare volume control */}
          {hasScreen && !isLocal && (
            <ScreenShareVolumeControl participant={participant as RemoteParticipant} />
          )}

          {/* Pin button */}
          {onPin && (
            <IconButton
              sx={{
                backgroundColor: isPinned ? alpha(theme.palette.semantic.status.positive, 0.8) : alpha(theme.palette.background.paper, 0.5),
                color: theme.palette.common.white,
                width: 32,
                height: 32,
                '&:hover': {
                  backgroundColor: isPinned ? theme.palette.semantic.status.positive : alpha(theme.palette.background.paper, 0.7),
                },
              }}
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onPin();
              }}
            >
              {isPinned ? <PushPin fontSize="small" /> : <PushPinOutlined fontSize="small" />}
            </IconButton>
          )}

          {/* Spotlight/Fullscreen button */}
          {onToggleFullscreen && (
            <IconButton
              sx={{
                backgroundColor: isSpotlighted ? alpha(theme.palette.semantic.status.positive, 0.8) : alpha(theme.palette.background.paper, 0.5),
                color: theme.palette.common.white,
                width: 32,
                height: 32,
                '&:hover': {
                  backgroundColor: isSpotlighted ? theme.palette.semantic.status.positive : alpha(theme.palette.background.paper, 0.7),
                },
              }}
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFullscreen();
              }}
            >
              <CropFree fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Fade>

      {/* Recording indicator - top left (only for local screen share) */}
      {isLocal && isSharing && isReplayBufferActive && (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            left: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            backgroundColor: alpha(theme.palette.background.paper, 0.7),
            borderRadius: 1,
            px: 1,
            py: 0.5,
          }}
        >
          <FiberManualRecord
            sx={{
              width: 8,
              height: 8,
              color: theme.palette.semantic.status.positive,
              animation: 'pulse 1.5s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          />
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.75rem',
              textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
            }}
          >
            Replay Available
          </Typography>
        </Box>
      )}
    </Card>
  );
};

export default VideoTile;
