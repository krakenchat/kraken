import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Tooltip,
  Card,
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
  GridView,
  ViewSidebar,
  PushPin,
  PushPinOutlined,
} from '@mui/icons-material';
import { useVoiceConnection } from '../../hooks/useVoiceConnection';
import { useLocalMediaState } from '../../hooks/useLocalMediaState';
import { useResponsive } from '../../hooks/useResponsive';

// Constants
const GRID_CONSTANTS = {
  MIN_TILE_HEIGHT: 200,
  SIDEBAR_WIDTH: 200,
  SIDEBAR_TILE_HEIGHT: 150,
  HEADER_HEIGHT: 48,
  MAX_SIDEBAR_TILES: 6,
  MOBILE_MIN_TILE_HEIGHT: 150,
  MOBILE_HEADER_HEIGHT: 40,
} as const;
import { 
  TrackPublication, 
  VideoTrack, 
  RemoteParticipant,
  LocalParticipant
} from 'livekit-client';

interface VideoTileProps {
  participant: RemoteParticipant | LocalParticipant;
  videoTrack?: TrackPublication;
  audioTrack?: TrackPublication;
  screenTrack?: TrackPublication;
  isLocal?: boolean;
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
  onToggleFullscreen,
  onPin,
  isPinned = false,
  isSpotlighted = false,
}) => {
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
        minHeight: '200px',
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
            objectFit: 'contain', // Use contain for screen shares to avoid cropping
            backgroundColor: 'black',
          }}
        />
      ) : hasVideo ? (
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
                backgroundColor: hasAudio ? 'rgba(76, 175, 80, 0.8)' : 'rgba(244, 67, 54, 0.8)',
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
                backgroundColor: (hasVideo || hasScreen) ? 'rgba(76, 175, 80, 0.8)' : 'rgba(244, 67, 54, 0.8)',
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
                backgroundColor: isPinned ? 'rgba(76, 175, 80, 0.8)' : 'rgba(0,0,0,0.5)',
                color: 'white',
                width: 32,
                height: 32,
                '&:hover': {
                  backgroundColor: isPinned ? 'rgba(76, 175, 80, 1)' : 'rgba(0,0,0,0.7)',
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
                backgroundColor: isSpotlighted ? 'rgba(76, 175, 80, 0.8)' : 'rgba(0,0,0,0.5)',
                color: 'white',
                width: 32,
                height: 32,
                '&:hover': {
                  backgroundColor: isSpotlighted ? 'rgba(76, 175, 80, 1)' : 'rgba(0,0,0,0.7)',
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
          )}
        </Box>
      </Fade>
    </Card>
  );
};

type VideoLayoutMode = 'grid' | 'sidebar' | 'spotlight';

interface VideoTile {
  participant: RemoteParticipant | LocalParticipant;
  videoTrack?: TrackPublication;
  screenTrack?: TrackPublication;
  audioTrack?: TrackPublication;
  isLocal: boolean;
  tileType: 'camera' | 'screen';
  tileId: string; // unique identifier for this tile
}

interface VideoTilesProps {
  isFullscreen?: boolean;
  onExitFullscreen?: () => void;
}

export const VideoTiles: React.FC<VideoTilesProps> = () => {
  const { state } = useVoiceConnection();
  const { isCameraEnabled, isScreenShareEnabled } = useLocalMediaState();
  const { isMobile, isPortrait } = useResponsive();
  const [layoutMode, setLayoutMode] = useState<VideoLayoutMode>('grid');
  const [pinnedTileId, setPinnedTileId] = useState<string | null>(null);
  const [spotlightTileId, setSpotlightTileId] = useState<string | null>(null);
  const [, setTrackUpdate] = useState(0); // Force re-render on track changes

  // Listen to LiveKit room events for track publications/unpublications
  useEffect(() => {
    if (!state.room) return;

    const handleTrackPublished = () => {
      setTrackUpdate((prev) => prev + 1);
    };

    const handleTrackUnpublished = () => {
      setTrackUpdate((prev) => prev + 1);
    };

    // Local participant events
    state.room.localParticipant.on('trackPublished', handleTrackPublished);
    state.room.localParticipant.on('trackUnpublished', handleTrackUnpublished);

    // Remote participant events
    state.room.on('trackPublished', handleTrackPublished);
    state.room.on('trackUnpublished', handleTrackUnpublished);

    return () => {
      state.room?.localParticipant.off('trackPublished', handleTrackPublished);
      state.room?.localParticipant.off('trackUnpublished', handleTrackUnpublished);
      state.room?.off('trackPublished', handleTrackPublished);
      state.room?.off('trackUnpublished', handleTrackUnpublished);
    };
  }, [state.room]);

  if (!state.isConnected || !state.room) {
    return null;
  }

  const participants = Array.from(state.room.remoteParticipants.values());
  const localParticipant = state.room.localParticipant;
  
  // Create tiles for each participant's tracks (camera and/or screen share)
  const createParticipantTiles = (): VideoTile[] => {
    const tiles: VideoTile[] = [];

    // Add local participant tiles
    if (isCameraEnabled || isScreenShareEnabled) {
      const videoTracks = Array.from(localParticipant.videoTrackPublications.values());
      const audioTrack = Array.from(localParticipant.audioTrackPublications.values())[0];
      
      const videoTrack = videoTracks.find((track: TrackPublication) => 
        track.source !== 'screen_share' && track.source !== 'screen_share_audio'
      );
      const screenTrack = videoTracks.find((track: TrackPublication) => 
        track.source === 'screen_share' || track.source === 'screen_share_audio'
      );

      if (videoTrack && !videoTrack.isMuted && screenTrack) {
        // Both camera and screen share - create two tiles
        tiles.push({
          participant: localParticipant,
          videoTrack,
          audioTrack,
          isLocal: true,
          tileType: 'camera',
          tileId: `${localParticipant.identity}-camera`
        });
        tiles.push({
          participant: localParticipant,
          screenTrack,
          audioTrack,
          isLocal: true,
          tileType: 'screen',
          tileId: `${localParticipant.identity}-screen`
        });
      } else if (videoTrack && !videoTrack.isMuted) {
        tiles.push({
          participant: localParticipant,
          videoTrack,
          audioTrack,
          isLocal: true,
          tileType: 'camera',
          tileId: `${localParticipant.identity}-camera`
        });
      } else if (screenTrack) {
        tiles.push({
          participant: localParticipant,
          screenTrack,
          audioTrack,
          isLocal: true,
          tileType: 'screen',
          tileId: `${localParticipant.identity}-screen`
        });
      }
    }

    // Add remote participant tiles
    participants.forEach(participant => {
      const videoTracks = Array.from(participant.videoTrackPublications.values());
      const audioTrack = Array.from(participant.audioTrackPublications.values())[0];
      
      const videoTrack = videoTracks.find((track: TrackPublication) => 
        track.source !== 'screen_share' && track.source !== 'screen_share_audio'
      );
      const screenTrack = videoTracks.find((track: TrackPublication) => 
        track.source === 'screen_share' || track.source === 'screen_share_audio'
      );

      if (videoTrack && !videoTrack.isMuted && screenTrack) {
        // Both camera and screen share - create two tiles
        tiles.push({
          participant,
          videoTrack,
          audioTrack,
          isLocal: false,
          tileType: 'camera',
          tileId: `${participant.identity}-camera`
        });
        tiles.push({
          participant,
          screenTrack,
          audioTrack,
          isLocal: false,
          tileType: 'screen',
          tileId: `${participant.identity}-screen`
        });
      } else if (videoTrack && !videoTrack.isMuted) {
        tiles.push({
          participant,
          videoTrack,
          audioTrack,
          isLocal: false,
          tileType: 'camera',
          tileId: `${participant.identity}-camera`
        });
      } else if (screenTrack) {
        tiles.push({
          participant,
          screenTrack,
          audioTrack,
          isLocal: false,
          tileType: 'screen',
          tileId: `${participant.identity}-screen`
        });
      }
    });

    return tiles;
  };

  const videoTiles = createParticipantTiles();

  // Layout calculation functions
  const getGridLayout = (tileCount: number) => {
    // Mobile: use 1-2 columns max for better visibility
    if (isMobile) {
      if (tileCount <= 1) return { cols: 1, maxHeight: '100%' };
      if (tileCount <= 4) return { cols: isPortrait ? 1 : 2, maxHeight: isPortrait ? '50%' : '50%' };
      return { cols: 2, maxHeight: '33.333%' };
    }

    // Desktop: original logic
    if (tileCount <= 1) return { cols: 1, maxHeight: '100%' };
    if (tileCount <= 4) return { cols: 2, maxHeight: '50%' };
    if (tileCount <= 9) return { cols: 3, maxHeight: '33.333%' };
    return { cols: 4, maxHeight: '25%' };
  };

  const handleTilePin = (tileId: string) => {
    setPinnedTileId(pinnedTileId === tileId ? null : tileId);
    if (layoutMode !== 'sidebar' && pinnedTileId !== tileId) {
      setLayoutMode('sidebar');
    }
  };

  const handleTileSpotlight = (tileId: string) => {
    if (layoutMode === 'spotlight' && spotlightTileId === tileId) {
      // If we're in spotlight mode and clicking the same tile, go back to grid
      setSpotlightTileId(null);
      setLayoutMode('grid');
    } else {
      // Otherwise, spotlight this tile
      setSpotlightTileId(tileId);
      setLayoutMode('spotlight');
    }
  };

  if (videoTiles.length === 0) {
    // Show a placeholder when connected but no video tracks
    return (
      <Box sx={{ 
        width: '100%', 
        height: '100%', 
        backgroundColor: 'grey.900', 
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 2
      }}>
        <Typography variant="h5" color="white">
          🔊 Connected to {state.channelName}
        </Typography>
        <Typography variant="body1" color="grey.400" textAlign="center">
          Enable your camera or screen share to see video tiles here.
        </Typography>
      </Box>
    );
  }

  // Layout rendering functions
  const renderGridLayout = () => {
    const { cols, maxHeight } = getGridLayout(videoTiles.length);
    const gridSize = Math.floor(12 / cols);

    return (
      <Grid container spacing={1} sx={{ 
        height: '100%', 
        overflow: 'hidden',
        alignItems: 'stretch'
      }}>
        {videoTiles.map((tile) => (
          <Grid 
            item 
            xs={gridSize}
            key={tile.tileId}
            sx={{ 
              height: videoTiles.length === 1 ? '100%' : maxHeight,
              display: 'flex',
              minHeight: GRID_CONSTANTS.MIN_TILE_HEIGHT
            }}
          >
            <Box sx={{ width: '100%', height: '100%' }}>
              <VideoTile
                participant={tile.participant}
                videoTrack={tile.videoTrack}
                audioTrack={tile.audioTrack}
                screenTrack={tile.screenTrack}
                isLocal={tile.isLocal}
                onToggleFullscreen={() => handleTileSpotlight(tile.tileId)}
                onPin={undefined}
                isPinned={pinnedTileId === tile.tileId}
                isSpotlighted={spotlightTileId === tile.tileId}
              />
            </Box>
          </Grid>
        ))}
      </Grid>
    );
  };

  const renderSidebarLayout = () => {
    const pinnedTile = videoTiles.find(tile => tile.tileId === pinnedTileId) || videoTiles[0];
    const otherTiles = videoTiles.filter(tile => tile.tileId !== pinnedTile.tileId).slice(0, GRID_CONSTANTS.MAX_SIDEBAR_TILES);

    return (
      <Box sx={{ display: 'flex', height: '100%', gap: 1, overflow: 'hidden' }}>
        {/* Main pinned video */}
        <Box sx={{ flex: 1, minWidth: 0, height: '100%' }}>
          <VideoTile
            participant={pinnedTile.participant}
            videoTrack={pinnedTile.videoTrack}
            audioTrack={pinnedTile.audioTrack}
            screenTrack={pinnedTile.screenTrack}
            isLocal={pinnedTile.isLocal}
            onToggleFullscreen={() => handleTileSpotlight(pinnedTile.tileId)}
            onPin={undefined}
            isPinned={true}
            isSpotlighted={spotlightTileId === pinnedTile.tileId}
          />
        </Box>
        
        {/* Sidebar with other videos */}
        {otherTiles.length > 0 && (
          <Box sx={{ 
            width: GRID_CONSTANTS.SIDEBAR_WIDTH, 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 1, 
            overflowY: 'auto',
            height: '100%',
            flexShrink: 0
          }}>
            {otherTiles.map((tile) => (
              <Box key={tile.tileId} sx={{ 
                height: GRID_CONSTANTS.SIDEBAR_TILE_HEIGHT, 
                flexShrink: 0
              }}>
                <VideoTile
                  participant={tile.participant}
                  videoTrack={tile.videoTrack}
                  audioTrack={tile.audioTrack}
                  screenTrack={tile.screenTrack}
                  isLocal={tile.isLocal}
                  onToggleFullscreen={() => handleTilePin(tile.tileId)}
                  onPin={undefined}
                  isPinned={pinnedTileId === tile.tileId}
                  isSpotlighted={spotlightTileId === tile.tileId}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  const renderSpotlightLayout = () => {
    const spotlightedTile = videoTiles.find(tile => tile.tileId === spotlightTileId) || videoTiles[0];

    return (
      <Box sx={{ height: '100%', width: '100%' }}>
        <VideoTile
          participant={spotlightedTile.participant}
          videoTrack={spotlightedTile.videoTrack}
          audioTrack={spotlightedTile.audioTrack}
          screenTrack={spotlightedTile.screenTrack}
          isLocal={spotlightedTile.isLocal}
          onToggleFullscreen={() => handleTileSpotlight(spotlightedTile.tileId)}
          onPin={() => handleTilePin(spotlightedTile.tileId)}
          isPinned={pinnedTileId === spotlightedTile.tileId}
          isSpotlighted={true}
        />
      </Box>
    );
  };

  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      backgroundColor: 'grey.900',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Layout Controls Header - hide on mobile */}
      {!isMobile && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            p: 1,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            minHeight: GRID_CONSTANTS.HEADER_HEIGHT,
            flexShrink: 0
          }}
        >
          {/* Layout mode buttons */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Grid Layout">
              <IconButton
                size="small"
                onClick={() => setLayoutMode('grid')}
                sx={{
                  backgroundColor: layoutMode === 'grid' ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255,255,255,0.1)',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: layoutMode === 'grid' ? 'rgba(76, 175, 80, 1)' : 'rgba(255,255,255,0.2)',
                  },
                }}
              >
                <GridView fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Sidebar Layout">
              <IconButton
                size="small"
                onClick={() => setLayoutMode('sidebar')}
                sx={{
                  backgroundColor: layoutMode === 'sidebar' ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255,255,255,0.1)',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: layoutMode === 'sidebar' ? 'rgba(76, 175, 80, 1)' : 'rgba(255,255,255,0.2)',
                  },
                }}
              >
                <ViewSidebar fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Spotlight Layout">
              <IconButton
                size="small"
                onClick={() => setLayoutMode('spotlight')}
                sx={{
                  backgroundColor: layoutMode === 'spotlight' ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255,255,255,0.1)',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: layoutMode === 'spotlight' ? 'rgba(76, 175, 80, 1)' : 'rgba(255,255,255,0.2)',
                  },
                }}
              >
                <Fullscreen fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}

      {/* Main Video Area */}
      <Box sx={{ flex: 1, overflow: 'hidden', p: isMobile ? 0.5 : 1, minHeight: 0 }}>
        {layoutMode === 'grid' && renderGridLayout()}
        {layoutMode === 'sidebar' && renderSidebarLayout()}
        {layoutMode === 'spotlight' && renderSpotlightLayout()}
      </Box>
    </Box>
  );
};