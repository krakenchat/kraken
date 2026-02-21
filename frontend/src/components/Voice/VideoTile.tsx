import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Card,
  Fade,
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
} from '@mui/icons-material';
import type {
  TrackPublication,
  VideoTrack,
  RemoteParticipant,
  LocalParticipant,
} from 'livekit-client';

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
  }, [videoTrack]);

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
  }, [screenTrack]);

  const hasVideo = videoTrack && !videoTrack.isMuted;
  const hasScreen = screenTrack && !screenTrack.isMuted;
  const hasAudio = audioTrack && !audioTrack.isMuted;
  const displayName = participant.name || participant.identity;
  const isSharing = hasScreen;

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
