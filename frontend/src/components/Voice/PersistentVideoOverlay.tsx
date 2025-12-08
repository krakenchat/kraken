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
import { useSelector } from 'react-redux';
import { RootState } from '../../app/store';
import { useVoiceConnection } from '../../hooks/useVoiceConnection';
import { VideoTiles } from './VideoTiles';
import { getCachedItem, setCachedItem } from '../../utils/storage';

// Constants
const PIP_SETTINGS_KEY = 'kraken_pip_settings';
const MIN_WIDTH = 320;
const MIN_HEIGHT = 240;
const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 360;
const HEADER_HEIGHT = 36;
const VOICE_BAR_HEIGHT = 64;

interface PipSettings {
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
}

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
  const voiceState = useSelector((state: RootState) => state.voice);
  const { actions } = useVoiceConnection();

  // Load saved settings or use defaults
  const [settings, setSettings] = useState<PipSettings>(() => {
    const saved = getCachedItem<PipSettings>(PIP_SETTINGS_KEY);
    return saved || getDefaultSettings();
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

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

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setSettings(prev => {
        const constrained = constrainPosition(
          prev.position.x,
          prev.position.y,
          prev.size.width,
          prev.size.height
        );
        if (constrained.x !== prev.position.x || constrained.y !== prev.position.y) {
          const newSettings = { ...prev, position: constrained };
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
    if ((e.target as HTMLElement).closest('.pip-controls')) return;
    e.preventDefault();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - settings.position.x,
      y: e.clientY - settings.position.y,
    });
  }, [settings.position]);

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
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: settings.size.width,
      height: settings.size.height,
    });
  }, [settings.size]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;
    const newWidth = Math.max(MIN_WIDTH, Math.min(resizeStart.width + deltaX, window.innerWidth * 0.8));
    const newHeight = Math.max(MIN_HEIGHT, Math.min(resizeStart.height + deltaY, window.innerHeight * 0.8));

    setSettings(prev => ({
      ...prev,
      size: { width: newWidth, height: newHeight },
    }));
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

  // Minimized view
  if (settings.isMinimized) {
    return (
      <Paper
        ref={containerRef}
        elevation={8}
        sx={{
          position: 'fixed',
          right: 16,
          bottom: VOICE_BAR_HEIGHT + 16,
          zIndex: 1400,
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
      ref={containerRef}
      elevation={8}
      sx={{
        position: 'fixed',
        left: settings.position.x,
        top: settings.position.y,
        width: settings.size.width,
        height: settings.size.height,
        zIndex: 1400,
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
        }}
        onMouseDown={handleDragStart}
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
    </Paper>
  );
};

export default PersistentVideoOverlay;
