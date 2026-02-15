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
  Fullscreen,
  FullscreenExit,
} from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { useVoice, useVoiceDispatch } from '../../contexts/VoiceContext';
import { useVoiceConnection } from '../../hooks/useVoiceConnection';
import { useVideoOverlay } from '../../contexts/VideoOverlayContext';
import { VideoTiles } from './VideoTiles';
import { getCachedItem, setCachedItem } from '../../utils/storage';
import { VOICE_BAR_HEIGHT } from '../../constants/layout';

// Constants
const PIP_SETTINGS_KEY = 'kraken_pip_settings';
const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;
const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 360;
const HEADER_HEIGHT = 36;

interface PipSettings {
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  isMaximized: boolean;
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
  isMaximized: false,
});

export const PersistentVideoOverlay: React.FC = () => {
  const theme = useTheme();
  const voiceState = useVoice();
  const { dispatch } = useVoiceDispatch();
  const { actions } = useVoiceConnection();
  const { containerRef: overlayContainerRef } = useVideoOverlay();

  // Load saved settings or use defaults, clamping size on initial load
  const [settings, setSettings] = useState<PipSettings>(() => {
    const saved = getCachedItem<PipSettings>(PIP_SETTINGS_KEY);
    if (saved) {
      const clamped = clampSize(saved.size.width, saved.size.height);
      // Re-constrain position with clamped size
      const maxX = window.innerWidth - clamped.width - 8;
      const maxY = window.innerHeight - clamped.height - VOICE_BAR_HEIGHT - 8;
      return {
        ...saved,
        isMaximized: saved.isMaximized ?? false,
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
  // Track window size for maximized mode re-renders
  const [, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Track the video overlay container's bounds for maximized positioning
  const [containerBounds, setContainerBounds] = useState<DOMRect | null>(null);

  const pipRef = useRef<HTMLDivElement>(null);

  // Auto-restore PIP from maximized when navigating to a different page
  const location = useLocation();
  const prevPathnameRef = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== prevPathnameRef.current) {
      prevPathnameRef.current = location.pathname;
      // Skip restore if requestMaximize is pending (channel click → maximize)
      if (voiceState.requestMaximize) return;
      setSettings(prev => {
        if (!prev.isMaximized) return prev;
        const updated = { ...prev, isMaximized: false };
        setCachedItem(PIP_SETTINGS_KEY, updated);
        return updated;
      });
    }
  }, [location.pathname, voiceState.requestMaximize]);

  // Observe the content container's bounds for dynamic maximize positioning
  useEffect(() => {
    const el = overlayContainerRef.current;
    if (!el) return;

    const updateBounds = () => setContainerBounds(el.getBoundingClientRect());
    updateBounds();

    const observer = new ResizeObserver(updateBounds);
    observer.observe(el);
    window.addEventListener('resize', updateBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
    };
  }, [overlayContainerRef]);

  // Handle requestMaximize from channel click
  useEffect(() => {
    if (voiceState.requestMaximize) {
      setSettings(prev => {
        const updated = { ...prev, isMaximized: true, isMinimized: false };
        setCachedItem(PIP_SETTINGS_KEY, updated);
        return updated;
      });
      dispatch({ type: 'SET_REQUEST_MAXIMIZE', payload: false });
    }
  }, [voiceState.requestMaximize, dispatch]);

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
        if (prev.isMaximized) return prev;
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
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (settings.isMaximized) return;
    if ((e.target as HTMLElement).closest('.pip-controls')) return;
    e.preventDefault();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - settings.position.x,
      y: e.clientY - settings.position.y,
    });
  }, [settings.position, settings.isMaximized]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    const constrained = constrainPosition(newX, newY, settings.size.width, settings.size.height);
    setSettings(prev => ({ ...prev, position: constrained }));
  }, [isDragging, dragOffset, settings.size, constrainPosition]);

  const handleDragEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      saveSettings(settings);
    }
  }, [isDragging, settings, saveSettings]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (settings.isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: settings.size.width,
      height: settings.size.height,
    });
  }, [settings.size, settings.isMaximized]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
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

  const handleResizeEnd = useCallback(() => {
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

  // Global mouse event listeners for drag/resize
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Toggle minimize
  const toggleMinimize = useCallback(() => {
    saveSettings({ ...settings, isMinimized: !settings.isMinimized });
  }, [settings, saveSettings]);

  // Toggle maximize
  const toggleMaximize = useCallback(() => {
    saveSettings({ ...settings, isMaximized: !settings.isMaximized });
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

  const displayName = voiceState.contextType === 'dm'
    ? voiceState.dmGroupName || 'DM Call'
    : voiceState.channelName || 'Voice';

  // Compute effective position and size based on maximize state + container bounds
  const effectivePosition = settings.isMaximized && containerBounds
    ? { x: containerBounds.left, y: containerBounds.top }
    : settings.position;
  const effectiveSize = settings.isMaximized && containerBounds
    ? { width: containerBounds.width, height: containerBounds.height }
    : settings.size;

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
        left: effectivePosition.x,
        top: effectivePosition.y,
        width: effectiveSize.width,
        height: effectiveSize.height,
        zIndex: 1200,
        borderRadius: settings.isMaximized ? 0 : 2,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: settings.isMaximized ? 'none' : `1px solid ${theme.palette.divider}`,
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
          cursor: settings.isMaximized ? 'default' : (isDragging ? 'grabbing' : 'grab'),
          flexShrink: 0,
        }}
        onMouseDown={handleDragStart}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {!settings.isMaximized && (
            <DragIndicator fontSize="small" sx={{ color: 'text.secondary' }} />
          )}
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
          <Tooltip title={settings.isMaximized ? 'Restore' : 'Maximize'}>
            <IconButton size="small" onClick={toggleMaximize}>
              {settings.isMaximized ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
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

      {/* Resize Handle - hidden when maximized */}
      {!settings.isMaximized && (
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 20,
            height: 20,
            cursor: 'se-resize',
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
          onMouseDown={handleResizeStart}
        />
      )}
    </Paper>
  );
};

export default PersistentVideoOverlay;
