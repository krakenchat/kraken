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
  Close,
  Minimize,
  OpenInFull,
  DragIndicator,
  People,
} from '@mui/icons-material';
import { useVoice, VoiceSessionType } from '../../contexts/VoiceContext';
import { useVoiceConnection } from '../../hooks/useVoiceConnection';
import { useResponsive } from '../../hooks/useResponsive';
import { VideoTiles } from './VideoTiles';
import { getCachedItem, setCachedItem } from '../../utils/storage';
import { VOICE_BAR_HEIGHT, VOICE_BAR_HEIGHT_MOBILE } from '../../constants/layout';

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

export const PersistentVideoOverlay: React.FC = () => {
  const theme = useTheme();
  const voiceState = useVoice();
  const { actions } = useVoiceConnection();
  const { isMobile } = useResponsive();

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

  // Toggle minimize
  const toggleMinimize = useCallback(() => {
    saveSettings({ ...settings, isMinimized: !settings.isMinimized });
  }, [settings, saveSettings]);

  // Get participant count
  const getParticipantCount = () => {
    const room = (window as unknown as { __livekit_room?: { remoteParticipants?: Map<string, unknown> } }).__livekit_room;
    if (room?.remoteParticipants) {
      return room.remoteParticipants.size + 1; // +1 for local participant
    }
    return 1;
  };

  // Only show if connected AND video tiles are enabled
  // Note: We show the overlay when video tiles are enabled (not just when camera is on)
  // because remote participants may have video even if local user doesn't
  const shouldShow = voiceState.isConnected && voiceState.showVideoTiles;

  if (!shouldShow) {
    return null;
  }

  // The embedded stage already renders the session's video; suppress the
  // floating overlay so the same tiles aren't shown twice on desktop.
  if (!isMobile && voiceState.stageMounted) {
    return null;
  }

  // Mobile: simplified full-screen overlay (no drag/resize)
  if (isMobile) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: VOICE_BAR_HEIGHT_MOBILE,
          zIndex: 1200,
          backgroundColor: 'grey.900',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Close button */}
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 1,
          }}
        >
          <IconButton
            size="small"
            onClick={() => actions.setShowVideoTiles(false)}
            sx={{
              backgroundColor: alpha(theme.palette.background.paper, 0.7),
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: alpha(theme.palette.background.paper, 0.9),
              },
            }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>

        {/* Video content */}
        <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <VideoTiles />
        </Box>
      </Box>
    );
  }

  const displayName = voiceState.contextType === VoiceSessionType.Dm
    ? voiceState.dmGroupName || 'DM Call'
    : voiceState.channelName || 'Voice';

  // Minimized view
  if (settings.isMinimized) {
    return (
      <Paper
        ref={pipRef}
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
          <Badge badgeContent={getParticipantCount()} color="primary">
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

  // Full PiP view
  return (
    <Paper
      ref={pipRef}
      elevation={8}
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
          justifyContent: 'space-between',
          px: 1,
          cursor: isDragging ? 'grabbing' : 'grab',
          flexShrink: 0,
          // Prevent the browser treating a touch-drag on the header as a scroll
          touchAction: 'none',
        }}
        onPointerDown={handleDragStart}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <DragIndicator fontSize="small" sx={{ color: 'text.secondary' }} />
          <Typography variant="caption" fontWeight="medium" noWrap sx={{ maxWidth: 200 }}>
            {displayName}
          </Typography>
        </Box>
        <Box className="pip-controls" sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Minimize">
            <IconButton size="small" onClick={toggleMinimize}>
              <Minimize fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Close video">
            <IconButton
              size="small"
              onClick={() => actions.setShowVideoTiles(false)}
            >
              <Close fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Video Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <VideoTiles />
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

export default PersistentVideoOverlay;
