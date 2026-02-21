import React, { useEffect, useMemo, useCallback, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  CropFree,
  GridView,
  ViewSidebar,
} from '@mui/icons-material';
import { useVoiceConnection } from '../../hooks/useVoiceConnection';
import { useLocalMediaState } from '../../hooks/useLocalMediaState';
import { useResponsive } from '../../hooks/useResponsive';
import { useReplayBufferState } from '../../contexts/ReplayBufferContext';
import VideoTile from './VideoTile';

// Constants
const GRID_CONSTANTS = {
  SIDEBAR_WIDTH: 200,
  SIDEBAR_TILE_HEIGHT: 150,
  HEADER_HEIGHT: 48,
  MAX_SIDEBAR_TILES: 6,
} as const;
import {
  TrackPublication,
  RemoteParticipant,
  LocalParticipant,
  RoomEvent
} from 'livekit-client';

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
  const theme = useTheme();
  const { state, actions } = useVoiceConnection();
  const { isCameraEnabled, isScreenShareEnabled } = useLocalMediaState();
  const { isMobile, isPortrait } = useResponsive();
  const { isReplayBufferActive } = useReplayBufferState();
  const [layoutMode, setLayoutMode] = useState<VideoLayoutMode>('grid');
  const [pinnedTileId, setPinnedTileId] = useState<string | null>(null);
  const [spotlightTileId, setSpotlightTileId] = useState<string | null>(null);
  const [trackUpdate, setTrackUpdate] = useState(0); // Force re-render on track changes

  // Define callbacks before any early returns (React hooks must be called unconditionally)
  // Memoize grid layout calculation
  const getGridCols = useCallback((tileCount: number) => {
    // Mobile: use 1-2 columns max for better visibility
    if (isMobile) {
      if (tileCount <= 1) return 1;
      if (tileCount <= 4) return isPortrait ? 1 : 2;
      return 2;
    }

    // Desktop: original logic
    if (tileCount <= 1) return 1;
    if (tileCount <= 4) return 2;
    if (tileCount <= 9) return 3;
    return 4;
  }, [isMobile, isPortrait]);

  const handleTilePin = useCallback((tileId: string) => {
    setPinnedTileId(prev => prev === tileId ? null : tileId);
    setLayoutMode(prev => {
      if (prev !== 'sidebar' && pinnedTileId !== tileId) {
        return 'sidebar';
      }
      return prev;
    });
  }, [pinnedTileId]);

  const handleTileSpotlight = useCallback((tileId: string) => {
    setLayoutMode(prevLayout => {
      if (prevLayout === 'spotlight' && spotlightTileId === tileId) {
        // If we're in spotlight mode and clicking the same tile, go back to grid
        setSpotlightTileId(null);
        return 'grid';
      } else {
        // Otherwise, spotlight this tile
        setSpotlightTileId(tileId);
        return 'spotlight';
      }
    });
  }, [spotlightTileId]);

  // Memoize video tiles to avoid recalculating on every render
  const videoTiles = useMemo((): VideoTile[] => {
    if (!state.room) return [];

    const tiles: VideoTile[] = [];
    const localParticipant = state.room.localParticipant;
    const participants = Array.from(state.room.remoteParticipants.values());

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- trackUpdate triggers recomputation when remote tracks change
  }, [state.room, isCameraEnabled, isScreenShareEnabled, trackUpdate]);

  // Listen to LiveKit room events for track publications/unpublications
  useEffect(() => {
    if (!state.room) return;

    const handleTrackChange = () => {
      setTrackUpdate((prev) => prev + 1);
    };

    // Local participant events
    state.room.localParticipant.on('trackPublished', handleTrackChange);
    state.room.localParticipant.on('trackUnpublished', handleTrackChange);

    // Remote participant events (Room-level events cover all remote participants)
    state.room.on(RoomEvent.TrackPublished, handleTrackChange);
    state.room.on(RoomEvent.TrackUnpublished, handleTrackChange);
    state.room.on(RoomEvent.TrackSubscribed, handleTrackChange);
    state.room.on(RoomEvent.TrackUnsubscribed, handleTrackChange);
    state.room.on(RoomEvent.TrackMuted, handleTrackChange);
    state.room.on(RoomEvent.TrackUnmuted, handleTrackChange);
    state.room.on(RoomEvent.ParticipantDisconnected, handleTrackChange);

    return () => {
      state.room?.localParticipant.off('trackPublished', handleTrackChange);
      state.room?.localParticipant.off('trackUnpublished', handleTrackChange);
      state.room?.off(RoomEvent.TrackPublished, handleTrackChange);
      state.room?.off(RoomEvent.TrackUnpublished, handleTrackChange);
      state.room?.off(RoomEvent.TrackSubscribed, handleTrackChange);
      state.room?.off(RoomEvent.TrackUnsubscribed, handleTrackChange);
      state.room?.off(RoomEvent.TrackMuted, handleTrackChange);
      state.room?.off(RoomEvent.TrackUnmuted, handleTrackChange);
      state.room?.off(RoomEvent.ParticipantDisconnected, handleTrackChange);
    };
  }, [state.room]);

  // Auto-show video panel when any remote participant starts screen sharing
  useEffect(() => {
    if (!state.room) return;

    const handleRemoteTrackPublished = (publication: TrackPublication) => {
      if (publication.source === 'screen_share') {
        actions.setShowVideoTiles(true);
      }
    };

    state.room.on(RoomEvent.TrackPublished, handleRemoteTrackPublished);
    return () => {
      state.room?.off(RoomEvent.TrackPublished, handleRemoteTrackPublished);
    };
  }, [state.room, actions]);

  // Early return if not connected
  if (!state.isConnected || !state.room) {
    return null;
  }

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
    const cols = getGridCols(videoTiles.length);
    const rows = Math.ceil(videoTiles.length / cols);
    const tileWidth = `${100 / cols}%`;
    const tileHeight = `${100 / rows}%`;

    return (
      <Box sx={{
        display: 'flex',
        flexWrap: 'wrap',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}>
        {videoTiles.map((tile) => (
          <Box
            key={tile.tileId}
            sx={{
              width: tileWidth,
              height: tileHeight,
              p: 0.5,
              boxSizing: 'border-box',
            }}
          >
            <VideoTile
              participant={tile.participant}
              videoTrack={tile.videoTrack}
              audioTrack={tile.audioTrack}
              screenTrack={tile.screenTrack}
              isLocal={tile.isLocal}
              isReplayBufferActive={isReplayBufferActive}
              onToggleFullscreen={() => handleTileSpotlight(tile.tileId)}
              onPin={undefined}
              isPinned={pinnedTileId === tile.tileId}
              isSpotlighted={spotlightTileId === tile.tileId}
            />
          </Box>
        ))}
      </Box>
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
            isReplayBufferActive={isReplayBufferActive}
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
                  isReplayBufferActive={isReplayBufferActive}
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
          isReplayBufferActive={isReplayBufferActive}
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
            borderBottom: `1px solid ${theme.palette.divider}`,
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
                  backgroundColor: layoutMode === 'grid' ? alpha(theme.palette.primary.main, 0.8) : theme.palette.action.hover,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    backgroundColor: layoutMode === 'grid' ? theme.palette.primary.main : theme.palette.action.selected,
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
                  backgroundColor: layoutMode === 'sidebar' ? alpha(theme.palette.primary.main, 0.8) : theme.palette.action.hover,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    backgroundColor: layoutMode === 'sidebar' ? theme.palette.primary.main : theme.palette.action.selected,
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
                  backgroundColor: layoutMode === 'spotlight' ? alpha(theme.palette.primary.main, 0.8) : theme.palette.action.hover,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    backgroundColor: layoutMode === 'spotlight' ? theme.palette.primary.main : theme.palette.action.selected,
                  },
                }}
              >
                <CropFree fontSize="small" />
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