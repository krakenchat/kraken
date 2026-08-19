import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Typography,
  Tooltip,
  Badge,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Minimize,
  OpenInFull,
  DragIndicator,
  People,
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useVoiceConnection } from '../../hooks/useVoiceConnection';
import { useLocalMediaState } from '../../hooks/useLocalMediaState';
import { useFloatTileSelection } from '../../hooks/useFloatTileSelection';
import { useReplayBufferState } from '../../contexts/ReplayBufferContext';
import { VoiceSessionType } from '../../contexts/VoiceContext';
import { getFloatNavigationTarget } from '../../utils/voiceNavigation';
import { getCachedItem, setCachedItem } from '../../utils/storage';
import { VOICE_BAR_HEIGHT } from '../../constants/layout';
import UserAvatar from '../Common/UserAvatar';
import VideoTile from './VideoTile';

// Constants
const PIP_SETTINGS_KEY = 'semaphore_pip_settings';
const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;
const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 360;
const HEADER_HEIGHT = 36;

interface PipSettings {
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
}

const clampSize = (width: number, height: number) => ({
  width: Math.max(MIN_WIDTH, Math.min(width, window.innerWidth - 16)),
  height: Math.max(MIN_HEIGHT, Math.min(height, window.innerHeight - VOICE_BAR_HEIGHT - 16)),
});

const getDefaultSettings = (): PipSettings => ({
  position: {
    x: window.innerWidth - DEFAULT_WIDTH - 16,
    y: window.innerHeight - DEFAULT_HEIGHT - VOICE_BAR_HEIGHT - 16
  },
  size: { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
  isMinimized: false,
});

/**
 * Active-speaker float card ("Stage, Float, Dock" — the Float piece). Shown
 * by PersistentVideoOverlay's desktop branch when connected to voice but the
 * embedded stage isn't mounted. Content is a single tile chosen by
 * useFloatTileSelection (watched screen share > active speaker's camera >
 * avatar), not the full VideoTiles grid.
 */
export const FloatCard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { state, actions } = useVoiceConnection();
  const { isCameraEnabled, isMicrophoneEnabled } = useLocalMediaState();
  const { isReplayBufferActive } = useReplayBufferState();
  const selection = useFloatTileSelection();
  const [isCardHovered, setIsCardHovered] = useState(false);

  // Load saved settings or use defaults, clamping size on initial load
  const [settings, setSettings] = useState<PipSettings>(() => {
    const saved = getCachedItem<PipSettings>(PIP_SETTINGS_KEY);
    if (saved) {
      const clamped = clampSize(saved.size.width, saved.size.height);
      // Re-constrain position with clamped size
      const maxX = window.innerWidth - clamped.width - 8;
      const maxY = window.innerHeight - clamped.height - VOICE_BAR_HEIGHT - 8;
      // Strip any persisted isMaximized field (removed feature) so old users
      // don't restore into a stuck-maximized layout.
      const { isMaximized: _isMaximized, ...rest } = saved as PipSettings & { isMaximized?: boolean };
      return {
        ...rest,
        size: clamped,
        position: {
          x: Math.max(8, Math.min(saved.position.x, maxX)),
          y: Math.max(8, Math.min(saved.position.y, maxY)),
        },
      };
    }
    return getDefaultSettings();
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  // The pointer that started the active drag/resize. On touch, a second
  // finger produces its own pointer events on the window listeners — without
  // this filter it would teleport the overlay or end the gesture.
  const activePointerIdRef = useRef<number | null>(null);
  // Tracked (unread) so window resizes force a re-render even when clamping
  // leaves size/position unchanged.
  const [, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  const pipRef = useRef<HTMLDivElement>(null);

  // Save settings to localStorage
  const saveSettings = useCallback((newSettings: PipSettings) => {
    setSettings(newSettings);
    setCachedItem(PIP_SETTINGS_KEY, newSettings);
  }, []);

  // Constrain position within viewport
  const constrainPosition = useCallback((x: number, y: number, width: number, height: number) => {
    const maxX = window.innerWidth - width - 8;
    const maxY = window.innerHeight - height - VOICE_BAR_HEIGHT - 8;
    return {
      x: Math.max(8, Math.min(x, maxX)),
      y: Math.max(8, Math.min(y, maxY)),
    };
  }, []);

  // Handle window resize - clamp both size and position
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      setSettings(prev => {
        const clamped = clampSize(prev.size.width, prev.size.height);
        const constrained = constrainPosition(
          prev.position.x,
          prev.position.y,
          clamped.width,
          clamped.height
        );
        const sizeChanged = clamped.width !== prev.size.width || clamped.height !== prev.size.height;
        const posChanged = constrained.x !== prev.position.x || constrained.y !== prev.position.y;
        if (sizeChanged || posChanged) {
          const newSettings = { ...prev, size: clamped, position: constrained };
          setCachedItem(PIP_SETTINGS_KEY, newSettings);
          return newSettings;
        }
        return prev;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [constrainPosition]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.pip-controls')) return;
    if (activePointerIdRef.current !== null) return;
    e.preventDefault();
    activePointerIdRef.current = e.pointerId;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - settings.position.x,
      y: e.clientY - settings.position.y,
    });
  }, [settings.position]);

  const handleDragMove = useCallback((e: PointerEvent) => {
    if (!isDragging) return;
    if (e.pointerId !== activePointerIdRef.current) return;
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    const constrained = constrainPosition(newX, newY, settings.size.width, settings.size.height);
    setSettings(prev => ({ ...prev, position: constrained }));
  }, [isDragging, dragOffset, settings.size, constrainPosition]);

  const handleDragEnd = useCallback((e: PointerEvent) => {
    if (e.pointerId !== activePointerIdRef.current) return;
    activePointerIdRef.current = null;
    if (isDragging) {
      setIsDragging(false);
      saveSettings(settings);
    }
  }, [isDragging, settings, saveSettings]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    if (activePointerIdRef.current !== null) return;
    e.preventDefault();
    e.stopPropagation();
    activePointerIdRef.current = e.pointerId;
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: settings.size.width,
      height: settings.size.height,
    });
  }, [settings.size]);

  const handleResizeMove = useCallback((e: PointerEvent) => {
    if (!isResizing) return;
    if (e.pointerId !== activePointerIdRef.current) return;
    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;
    setSettings(prev => {
      const maxWidth = window.innerWidth - prev.position.x - 8;
      const maxHeight = window.innerHeight - prev.position.y - VOICE_BAR_HEIGHT - 8;
      const newWidth = Math.max(MIN_WIDTH, Math.min(resizeStart.width + deltaX, maxWidth));
      const newHeight = Math.max(MIN_HEIGHT, Math.min(resizeStart.height + deltaY, maxHeight));
      return {
        ...prev,
        size: { width: newWidth, height: newHeight },
      };
    });
  }, [isResizing, resizeStart]);

  const handleResizeEnd = useCallback((e: PointerEvent) => {
    if (e.pointerId !== activePointerIdRef.current) return;
    activePointerIdRef.current = null;
    if (isResizing) {
      setIsResizing(false);
      // Constrain position after resize
      const constrained = constrainPosition(
        settings.position.x,
        settings.position.y,
        settings.size.width,
        settings.size.height
      );
      const newSettings = { ...settings, position: constrained };
      saveSettings(newSettings);
    }
  }, [isResizing, settings, constrainPosition, saveSettings]);

  // Global pointer event listeners for drag/resize (pointer events unify mouse
  // and touch, so this works for touch tablets as well as mouse users)
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handleDragMove);
      window.addEventListener('pointerup', handleDragEnd);
      // Touch can end with pointercancel (OS gesture / scroll takeover);
      // without this the drag state would stick.
      window.addEventListener('pointercancel', handleDragEnd);
      return () => {
        window.removeEventListener('pointermove', handleDragMove);
        window.removeEventListener('pointerup', handleDragEnd);
        window.removeEventListener('pointercancel', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('pointermove', handleResizeMove);
      window.addEventListener('pointerup', handleResizeEnd);
      window.addEventListener('pointercancel', handleResizeEnd);
      return () => {
        window.removeEventListener('pointermove', handleResizeMove);
        window.removeEventListener('pointerup', handleResizeEnd);
        window.removeEventListener('pointercancel', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Toggle minimize (collapse to pill)
  const toggleMinimize = useCallback(() => {
    saveSettings({ ...settings, isMinimized: !settings.isMinimized });
  }, [settings, saveSettings]);

  const displayName = state.contextType === VoiceSessionType.Dm
    ? state.dmGroupName || 'DM Call'
    : state.channelName || 'Voice';

  const participantCount = (state.room?.remoteParticipants.size ?? 0) + 1;

  // Navigate back to the session's stage. Skipped when there's nowhere to go
  // (no route resolvable) or the stage is already mounted (nothing to float over).
  const handleCardClick = useCallback(() => {
    if (state.stageMounted) return;
    const target = getFloatNavigationTarget(state);
    if (!target) return;
    navigate(target);
  }, [state, navigate]);

  // Minimized view (pill)
  if (settings.isMinimized) {
    return (
      <Paper
        ref={pipRef}
        data-testid="float-card-pill"
        elevation={8}
        sx={{
          position: 'fixed',
          right: 16,
          bottom: VOICE_BAR_HEIGHT + 16,
          zIndex: 1200,
          borderRadius: 2,
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'scale(1.05)',
          },
        }}
        onClick={toggleMinimize}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Badge badgeContent={participantCount} color="primary">
            <People />
          </Badge>
          <Typography variant="body2" fontWeight="medium">
            {displayName}
          </Typography>
          <Tooltip title="Expand">
            <IconButton size="small">
              <OpenInFull fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
    );
  }

  const isLocalSelection = !!selection && state.room?.localParticipant === selection.participant;

  return (
    <Paper
      ref={pipRef}
      elevation={8}
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
      sx={{
        position: 'fixed',
        left: settings.position.x,
        top: settings.position.y,
        width: settings.size.width,
        height: settings.size.height,
        zIndex: 1200,
        borderRadius: 2,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${theme.palette.divider}`,
        userSelect: isDragging || isResizing ? 'none' : 'auto',
      }}
    >
      {/* Header - Draggable */}
      <Box
        sx={{
          height: HEADER_HEIGHT,
          backgroundColor: alpha(theme.palette.background.paper, 0.95),
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          cursor: isDragging ? 'grabbing' : 'grab',
          flexShrink: 0,
          // Prevent the browser treating a touch-drag on the header as a scroll
          touchAction: 'none',
        }}
        onPointerDown={handleDragStart}
      >
        <DragIndicator fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography variant="caption" fontWeight="medium" noWrap sx={{ maxWidth: 200 }}>
          {displayName}
        </Typography>
      </Box>

      {/* Video Content — single tile from useFloatTileSelection */}
      <Box
        data-testid="float-card-body"
        sx={{ flex: 1, overflow: 'hidden', minHeight: 0, position: 'relative', cursor: 'pointer' }}
        onClick={handleCardClick}
      >
        {!selection ? null : selection.kind === 'avatar' ? (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'grey.800',
              position: 'relative',
            }}
          >
            <Box sx={{ height: 'min(120px, 60%)', aspectRatio: '1 / 1', flexShrink: 1, minHeight: 32 }}>
              <UserAvatar userId={selection.participant.identity} displayName={selection.participant.name} size="fluid" />
            </Box>
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundImage: `linear-gradient(transparent, ${alpha(theme.palette.background.paper, 0.85)})`,
                p: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: 'white', fontWeight: 'bold', textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
              >
                {selection.participant.name || selection.participant.identity}
                {isLocalSelection && ' (You)'}
              </Typography>
            </Box>
          </Box>
        ) : (
          <VideoTile
            participant={selection.participant}
            videoTrack={selection.kind === 'camera' ? selection.publication : undefined}
            screenTrack={selection.kind === 'screen' ? selection.publication : undefined}
            isLocal={isLocalSelection}
            isReplayBufferActive={isReplayBufferActive}
          />
        )}

        {/* Hover control strip — mirrors VoiceBottomBar's mic/camera actions */}
        <Box
          className="pip-controls"
          data-testid="float-card-controls"
          onClick={(e) => e.stopPropagation()}
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 1,
            p: 1,
            backgroundImage: `linear-gradient(transparent, ${alpha(theme.palette.common.black, 0.6)})`,
            opacity: isCardHovered ? 1 : 0,
            transition: 'opacity 0.15s ease',
            '@media (hover: none)': {
              opacity: 1,
            },
          }}
        >
          <Tooltip title={isMicrophoneEnabled ? 'Mute' : 'Unmute'}>
            <IconButton
              size="small"
              onClick={actions.toggleMute}
              sx={{
                backgroundColor: alpha(theme.palette.background.paper, 0.7),
                color: !isMicrophoneEnabled ? theme.palette.error.main : theme.palette.text.primary,
              }}
            >
              {isMicrophoneEnabled ? <Mic fontSize="small" /> : <MicOff fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title={isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}>
            <IconButton
              size="small"
              onClick={actions.toggleVideo}
              sx={{
                backgroundColor: alpha(theme.palette.background.paper, 0.7),
                color: isCameraEnabled ? theme.palette.primary.main : theme.palette.text.primary,
              }}
            >
              {isCameraEnabled ? <Videocam fontSize="small" /> : <VideocamOff fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Minimize">
            <IconButton
              size="small"
              onClick={toggleMinimize}
              sx={{
                backgroundColor: alpha(theme.palette.background.paper, 0.7),
                color: theme.palette.text.primary,
              }}
            >
              <Minimize fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Resize Handle */}
      <Box
        sx={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 20,
          height: 20,
          cursor: 'se-resize',
          touchAction: 'none',
          '&::after': {
            content: '""',
            position: 'absolute',
            right: 4,
            bottom: 4,
            width: 8,
            height: 8,
            borderRight: `2px solid ${theme.palette.text.secondary}`,
            borderBottom: `2px solid ${theme.palette.text.secondary}`,
          },
        }}
        onPointerDown={handleResizeStart}
      />
    </Paper>
  );
};

export default FloatCard;
