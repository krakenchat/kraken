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
import {
  PipAnchor,
  PipPlacement,
  Point,
  Size,
  Viewport,
  toAbsolute,
  fromAbsolute,
  clampSizeToViewport,
  hitTestDockZone,
  defaultPlacement,
} from '../../utils/pipPosition';
import UserAvatar from '../Common/UserAvatar';
import VideoTile from './VideoTile';
import DockZonesOverlay from './DockZonesOverlay';

// Constants
const PIP_PLACEMENT_KEY = 'semaphore_pip_placement';
const HEADER_HEIGHT = 36;
// Approximate collapsed-pill footprint, used only to anchor it to the same
// corner as the card — the pill's real size can vary slightly with content,
// but EDGE_PADDING clamping keeps it fully on-screen regardless.
const PILL_SIZE: Size = { width: 200, height: 52 };

const ANCHORS: readonly PipAnchor[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

function isValidPlacement(value: unknown): value is PipPlacement {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  const offset = p.offset as Record<string, unknown> | undefined;
  const size = p.size as Record<string, unknown> | undefined;
  return (
    typeof p.anchor === 'string' && (ANCHORS as string[]).includes(p.anchor) &&
    !!offset && typeof offset.x === 'number' && typeof offset.y === 'number' &&
    !!size && typeof size.width === 'number' && typeof size.height === 'number' &&
    typeof p.docked === 'boolean' &&
    typeof p.collapsed === 'boolean'
  );
}

function loadInitialPlacement(): PipPlacement {
  const saved = getCachedItem<unknown>(PIP_PLACEMENT_KEY);
  return isValidPlacement(saved) ? saved : defaultPlacement();
}

function computeViewport(isConnected: boolean): Viewport {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    bottomInset: isConnected ? VOICE_BAR_HEIGHT : 0,
  };
}

/**
 * Active-speaker float card ("Stage, Float, Dock" — the Float piece). Shown
 * by PersistentVideoOverlay's desktop branch when connected to voice but the
 * embedded stage isn't mounted. Content is a single tile chosen by
 * useFloatTileSelection (watched screen share > active speaker's camera >
 * avatar), not the full VideoTiles grid.
 *
 * Position is anchor-relative (see utils/pipPosition.ts) so it survives
 * viewport resizes and supports opt-in corner docking. `placement` is the
 * persisted source of truth; `dragPos`/`liveSize` are transient absolute
 * values used only while a drag or resize gesture is in flight.
 */
export const FloatCard: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { state, actions } = useVoiceConnection();
  const { isCameraEnabled, isMicrophoneEnabled } = useLocalMediaState();
  const { isReplayBufferActive } = useReplayBufferState();
  const selection = useFloatTileSelection();
  const [isCardHovered, setIsCardHovered] = useState(false);

  const [placement, setPlacement] = useState<PipPlacement>(loadInitialPlacement);
  const [viewport, setViewport] = useState<Viewport>(() => computeViewport(state.isConnected));

  // Transient gesture state — absolute pixel position/size while a
  // drag/resize is in progress. null when idle, so rendered position/size
  // falls back to deriving from `placement` via toAbsolute.
  const [dragPos, setDragPos] = useState<Point | null>(null);
  const [liveSize, setLiveSize] = useState<Size | null>(null);
  const [pointerPos, setPointerPos] = useState<Point | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  // The pointer that started the active drag/resize. On touch, a second
  // finger produces its own pointer events on the window listeners — without
  // this filter it would teleport the overlay or end the gesture.
  const activePointerIdRef = useRef<number | null>(null);

  const pipRef = useRef<HTMLDivElement>(null);

  // Position is derived (toAbsolute), so viewport changes only need to
  // re-clamp size — the old dedicated position-clamp effect is gone.
  const recomputeViewport = useCallback(() => {
    const vp = computeViewport(state.isConnected);
    setViewport(vp);
    setPlacement(prev => {
      const clampedSize = clampSizeToViewport(prev.size, vp);
      if (clampedSize.width === prev.size.width && clampedSize.height === prev.size.height) {
        return prev;
      }
      const next = { ...prev, size: clampedSize };
      setCachedItem(PIP_PLACEMENT_KEY, next);
      return next;
    });
  }, [state.isConnected]);

  // Re-derive on mount and whenever the voice bar's presence changes.
  useEffect(() => {
    recomputeViewport();
  }, [recomputeViewport]);

  // Context (state.pipCollapsed) is the single source of truth for
  // collapsed/expanded — it can change from outside this component (e.g. the
  // VoiceBottomBar settings menu). Mirror it into the persisted placement so
  // semaphore_pip_placement stays the one on-disk record of the pill state.
  useEffect(() => {
    setPlacement(prev => {
      if (prev.collapsed === state.pipCollapsed) return prev;
      const next = { ...prev, collapsed: state.pipCollapsed };
      setCachedItem(PIP_PLACEMENT_KEY, next);
      return next;
    });
  }, [state.pipCollapsed]);

  useEffect(() => {
    window.addEventListener('resize', recomputeViewport);
    return () => window.removeEventListener('resize', recomputeViewport);
  }, [recomputeViewport]);

  // Drag handlers
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.pip-controls')) return;
    if (activePointerIdRef.current !== null) return;
    e.preventDefault();
    activePointerIdRef.current = e.pointerId;
    const abs = toAbsolute(placement, viewport);
    setDragOffset({ x: e.clientX - abs.x, y: e.clientY - abs.y });
    setDragPos(abs);
    setPointerPos({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
  }, [placement, viewport]);

  const handleDragMove = useCallback((e: PointerEvent) => {
    if (e.pointerId !== activePointerIdRef.current) return;
    setDragPos({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    setPointerPos({ x: e.clientX, y: e.clientY });
  }, [dragOffset]);

  const handleDragEnd = useCallback((e: PointerEvent) => {
    if (e.pointerId !== activePointerIdRef.current) return;
    activePointerIdRef.current = null;
    if (!isDragging) return;
    setIsDragging(false);
    setPointerPos(null);
    const dropPos = dragPos;
    setDragPos(null);
    if (!dropPos) return;
    // Dock decision is made off the pointer's drop location, not the card's
    // position — matches the highlighted zone the user was looking at.
    const zone = hitTestDockZone({ x: e.clientX, y: e.clientY }, viewport);
    const nextPlacement: PipPlacement = zone
      ? { ...placement, anchor: zone, offset: { x: 0, y: 0 }, docked: true }
      : { ...placement, ...fromAbsolute(dropPos, placement.size, viewport), docked: false };
    setPlacement(nextPlacement);
    setCachedItem(PIP_PLACEMENT_KEY, nextPlacement);
  }, [isDragging, dragPos, placement, viewport]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.PointerEvent) => {
    if (activePointerIdRef.current !== null) return;
    e.preventDefault();
    e.stopPropagation();
    activePointerIdRef.current = e.pointerId;
    // Freeze the top-left corner for the gesture; only size tracks the
    // pointer, so the card grows toward the bottom-right handle in place.
    setDragPos(toAbsolute(placement, viewport));
    setLiveSize(placement.size);
    setResizeStart({ x: e.clientX, y: e.clientY, width: placement.size.width, height: placement.size.height });
    setIsResizing(true);
  }, [placement, viewport]);

  const handleResizeMove = useCallback((e: PointerEvent) => {
    if (e.pointerId !== activePointerIdRef.current) return;
    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;
    setLiveSize(clampSizeToViewport(
      { width: resizeStart.width + deltaX, height: resizeStart.height + deltaY },
      viewport
    ));
  }, [resizeStart, viewport]);

  const handleResizeEnd = useCallback((e: PointerEvent) => {
    if (e.pointerId !== activePointerIdRef.current) return;
    activePointerIdRef.current = null;
    if (!isResizing) return;
    setIsResizing(false);
    const finalSize = liveSize;
    const frozenPos = dragPos;
    setLiveSize(null);
    setDragPos(null);
    if (!finalSize || !frozenPos) return;
    // Docked: keep the anchor, just store the new size (position re-derives
    // from the anchor). Free: recompute the anchor/offset from the frozen
    // top-left so the card doesn't jump on the next render.
    const nextPlacement: PipPlacement = placement.docked
      ? { ...placement, size: finalSize }
      : { ...placement, size: finalSize, ...fromAbsolute(frozenPos, finalSize, viewport) };
    setPlacement(nextPlacement);
    setCachedItem(PIP_PLACEMENT_KEY, nextPlacement);
  }, [isResizing, liveSize, dragPos, placement, viewport]);

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

  // Toggle collapse (card <-> pill). Source of truth is context
  // (state.pipCollapsed); the effect above persists the change.
  const toggleCollapsed = useCallback(() => {
    actions.setPipCollapsed(!state.pipCollapsed);
  }, [actions, state.pipCollapsed]);

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
  if (state.pipCollapsed) {
    const pillPos = toAbsolute(placement, viewport, PILL_SIZE);
    return (
      <Paper
        ref={pipRef}
        data-testid="float-card-pill"
        elevation={8}
        sx={{
          position: 'fixed',
          left: pillPos.x,
          top: pillPos.y,
          zIndex: 1200,
          borderRadius: 2,
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'scale(1.05)',
          },
        }}
        onClick={toggleCollapsed}
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
  const renderedPos = dragPos ?? toAbsolute(placement, viewport);
  const renderedSize = liveSize ?? placement.size;

  return (
    <>
      {isDragging && <DockZonesOverlay viewport={viewport} pointerPosition={pointerPos} />}
      <Paper
        ref={pipRef}
        elevation={8}
        onMouseEnter={() => setIsCardHovered(true)}
        onMouseLeave={() => setIsCardHovered(false)}
        sx={{
          position: 'fixed',
          left: renderedPos.x,
          top: renderedPos.y,
          width: renderedSize.width,
          height: renderedSize.height,
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
                onClick={toggleCollapsed}
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
    </>
  );
};

export default FloatCard;
