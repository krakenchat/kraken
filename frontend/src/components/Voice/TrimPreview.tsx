import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
  Tooltip,
  Button,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Replay,
  SkipPrevious,
  SkipNext,
} from '@mui/icons-material';
import Hls from 'hls.js';
import { getApiUrl } from '../../config/env';
import { getAuthToken, getAuthenticatedUrl } from '../../utils/auth';
import { useQuery } from '@tanstack/react-query';
import { livekitControllerGetSessionInfoOptions } from '../../api-client/@tanstack/react-query.gen';
import { logger } from '../../utils/logger';

interface TrimPreviewProps {
  onRangeChange: (startSeconds: number, endSeconds: number) => void;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const TrimPreview: React.FC<TrimPreviewProps> = ({ onRangeChange }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(false);

  // Trim range state
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(60);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);

  const isInitializedRef = useRef(false);

  // Refs to avoid stale closures in event handlers
  const startTimeRef = useRef(startTime);
  const endTimeRef = useRef(endTime);
  const loopEnabledRef = useRef(loopEnabled);

  // Keep refs in sync with state
  useEffect(() => {
    startTimeRef.current = startTime;
  }, [startTime]);

  useEffect(() => {
    endTimeRef.current = endTime;
  }, [endTime]);

  useEffect(() => {
    loopEnabledRef.current = loopEnabled;
  }, [loopEnabled]);

  // Fetch session info to get buffer duration
  // refetchOnMountOrArgChange ensures fresh data when component mounts
  const { data: sessionInfo, isLoading: sessionLoading } = useQuery({
    ...livekitControllerGetSessionInfoOptions(),
    staleTime: 0, // Always refetch on mount
    refetchInterval: 15_000,
  });
  const maxDuration = sessionInfo?.totalDurationSeconds || 0;

  // Initialize range when session info first loads (polling updates extend timeline only)
  useEffect(() => {
    if (sessionInfo?.totalDurationSeconds && !isInitializedRef.current) {
      const maxDur = sessionInfo.totalDurationSeconds;
      // Default to last 60 seconds or full buffer if less
      const defaultStart = Math.max(0, maxDur - 60);
      setStartTime(defaultStart);
      setEndTime(maxDur);
      onRangeChange(defaultStart, maxDur);
      isInitializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionInfo?.totalDurationSeconds]);

  // Initialize HLS.js player
  useEffect(() => {
    if (!videoRef.current || !sessionInfo?.hasActiveSession || !maxDuration) return;

    const video = videoRef.current;
    // Use authenticated URL for embedded resources (works in Electron cross-origin)
    const playlistUrl = getAuthenticatedUrl(getApiUrl('/livekit/replay/preview/playlist.m3u8'));

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        // Force remux even for unusual MPEG-TS formats
        progressive: false,
        // Relax parsing strictness for HDMV-style MPEG-TS
        stretchShortVideoTrack: true,
        forceKeyFrameOnDiscontinuity: true,
        xhrSetup: (xhr, _url) => {
          // Send cookies for same-origin requests
          xhr.withCredentials = true;
          // Also set Authorization header as backup (more reliable for XHR)
          const token = getAuthToken();
          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }
        },
      });

      hls.loadSource(playlistUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        // Wait for video to be ready before seeking
        const seekToStart = () => {
          // Use the ref to get the current startTime value (set by first effect)
          const targetTime = startTimeRef.current;
          logger.dev('HLS: Seeking to start time:', targetTime);
          video.currentTime = targetTime;
          setCurrentTime(targetTime);
        };

        // Check if video is ready, if not wait for canplay event
        if (video.readyState >= 3) {
          seekToStart();
        } else {
          const handleCanPlay = () => {
            seekToStart();
            video.removeEventListener('canplay', handleCanPlay);
          };
          video.addEventListener('canplay', handleCanPlay);
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        logger.error('HLS Error:', data);
        // Log fragment details for debugging demuxer issues
        if (data.frag) {
          logger.error('Fragment details:', {
            sn: data.frag.sn,
            url: data.frag.url,
            start: data.frag.start,
            duration: data.frag.duration,
          });
        }
        if (data.fatal) {
          let errorMessage = `Failed to load video preview: ${data.type}`;
          if (data.details) {
            errorMessage += ` (${data.details})`;
          }
          if (data.response?.code) {
            errorMessage += ` - HTTP ${data.response.code}`;
          }
          setError(errorMessage);
          setIsLoading(false);
        }
      });

      // Debug: Log when fragments are loaded successfully
      hls.on(Hls.Events.FRAG_LOADED, (_, data) => {
        logger.dev('Fragment loaded:', {
          sn: data.frag.sn,
          url: data.frag.url,
          size: data.frag.stats.total,
        });
      });

      hlsRef.current = hls;

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS - uses authenticated URL with token query param
      video.src = playlistUrl;
      const handleLoadedMetadata = () => {
        setIsLoading(false);
        const seekToStart = () => {
          const targetTime = startTimeRef.current;
          video.currentTime = targetTime;
          setCurrentTime(targetTime);
        };

        if (video.readyState >= 3) {
          seekToStart();
        } else {
          const handleCanPlay = () => {
            seekToStart();
            video.removeEventListener('canplay', handleCanPlay);
          };
          video.addEventListener('canplay', handleCanPlay);
        }
      };
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('error', () => {
        setError('Failed to load video preview');
        setIsLoading(false);
      });
    } else {
      setError('HLS playback is not supported in this browser');
      setIsLoading(false);
    }
  }, [sessionInfo?.hasActiveSession, maxDuration, retryKey]);

  // Handle video time update - constrain to selection
  // This effect depends on isLoading to ensure it runs AFTER HLS is initialized
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isLoading) return; // Wait until HLS is loaded

    logger.dev('Attaching timeupdate listener to video element');

    const handleTimeUpdate = () => {
      const time = video.currentTime;

      // Update current time on every frame for smooth playhead movement
      setCurrentTime(time);

      // Stop or loop at end of selection - use refs for current values
      // Add small buffer (0.1s) to avoid race conditions with ref updates
      if (time >= endTimeRef.current - 0.1) {
        if (loopEnabledRef.current) {
          logger.dev('Looping back to start:', startTimeRef.current);
          video.currentTime = startTimeRef.current;
        } else {
          video.pause();
          setIsPlaying(false);
        }
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      logger.dev('Removing timeupdate listener');
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [isLoading]); // Re-attach when loading completes

  // Playback controls with video readiness checks
  const handlePlaySelection = () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    videoRef.current.currentTime = startTime;
    videoRef.current.play().catch((err) => {
      logger.error('Failed to play:', err);
    });
    setIsPlaying(true);
  };

  const handleTogglePlay = () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch((err) => {
        logger.error('Failed to play:', err);
      });
      setIsPlaying(true);
    }
  };

  const handleJumpToStart = () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    videoRef.current.currentTime = startTime;
    setCurrentTime(startTime);
  };

  const handleJumpToEnd = () => {
    if (!videoRef.current || videoRef.current.readyState < 2) return;
    videoRef.current.currentTime = Math.max(startTime, endTime - 1);
    setCurrentTime(endTime - 1);
  };

  // Timeline drag handlers
  const handleTimelineMouseDown = useCallback(
    (e: React.MouseEvent, handle: 'start' | 'end') => {
      e.preventDefault();
      setIsDragging(handle);
    },
    []
  );

  const handleTimelineMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      const newTime = Math.round(percentage * maxDuration); // 1-second precision

      if (isDragging === 'start') {
        const newStart = Math.min(newTime, endTime - 1);
        setStartTime(newStart);
        onRangeChange(newStart, endTime);
        if (videoRef.current && currentTime < newStart) {
          videoRef.current.currentTime = newStart;
        }
      } else {
        const newEnd = Math.max(newTime, startTime + 1);
        setEndTime(newEnd);
        onRangeChange(startTime, newEnd);
      }
    },
    [isDragging, maxDuration, startTime, endTime, currentTime, onRangeChange]
  );

  const handleTimelineMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleTimelineMouseMove);
      window.addEventListener('mouseup', handleTimelineMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleTimelineMouseMove);
        window.removeEventListener('mouseup', handleTimelineMouseUp);
      };
    }
  }, [isDragging, handleTimelineMouseMove, handleTimelineMouseUp]);

  // Retry loading HLS after error
  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    // Destroy existing HLS instance if any
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    // Increment retry key to trigger useEffect re-run
    setRetryKey((prev) => prev + 1);
  }, []);

  // Click on timeline to seek (anywhere on the timeline, not just within selection)
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current || !videoRef.current || isDragging) return;
    if (videoRef.current.readyState < 2) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < 0 || x > rect.width) return;

    const percentage = x / rect.width;
    const clickTime = Math.max(0, Math.min(maxDuration, percentage * maxDuration));
    videoRef.current.currentTime = clickTime;
    setCurrentTime(clickTime);
  };

  if (sessionLoading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!sessionInfo?.hasActiveSession) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        No active replay buffer. Start screen sharing to enable custom trimming.
      </Alert>
    );
  }

  if (maxDuration === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        Waiting for buffer to accumulate segments...
      </Alert>
    );
  }

  const selectedDuration = endTime - startTime;
  const startPercent = (startTime / maxDuration) * 100;
  const endPercent = (endTime / maxDuration) * 100;
  const playheadPercent = (currentTime / maxDuration) * 100;

  // Generate time ruler marks
  const timeMarks: number[] = [];
  const markInterval = maxDuration > 300 ? 60 : 30; // 60s marks for >5min, else 30s
  for (let t = 0; t <= maxDuration; t += markInterval) {
    timeMarks.push(t);
  }

  return (
    <Box sx={{ mt: 2 }}>
      {/* Large Video Preview */}
      <Box
        sx={{
          position: 'relative',
          backgroundColor: 'black',
          borderRadius: 1,
          overflow: 'hidden',
          mb: 2,
        }}
      >
        {isLoading && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1,
            }}
          >
            <CircularProgress />
          </Box>
        )}
        {error && (
          <Alert
            severity="error"
            sx={{ m: 1 }}
            action={
              <Button color="inherit" size="small" onClick={handleRetry}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        <video
          ref={videoRef}
          style={{
            width: '100%',
            height: isMobile ? 'auto' : 'calc(90vh - 350px)', // Auto height on mobile
            minHeight: isMobile ? '200px' : '400px',
            maxHeight: isMobile ? '40vh' : '70vh',
            objectFit: 'contain',
            display: 'block',
          }}
          crossOrigin="use-credentials"
          aria-label="Replay buffer preview"
        />
      </Box>

      {/* Playback Controls */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          mb: 2,
        }}
      >
        <Tooltip title="Jump to start">
          <IconButton onClick={handleJumpToStart} size="small" aria-label="Jump to start of selection">
            <SkipPrevious />
          </IconButton>
        </Tooltip>
        <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
          <IconButton onClick={handleTogglePlay} size="small" aria-label={isPlaying ? 'Pause playback' : 'Play video'}>
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Play selection from start">
          <IconButton onClick={handlePlaySelection} color="primary" aria-label="Play selection from start">
            <Replay />
          </IconButton>
        </Tooltip>
        <Tooltip title="Jump to end">
          <IconButton onClick={handleJumpToEnd} size="small" aria-label="Jump to end of selection">
            <SkipNext />
          </IconButton>
        </Tooltip>
        <Chip
          label={loopEnabled ? 'Loop ON' : 'Loop OFF'}
          onClick={() => setLoopEnabled(!loopEnabled)}
          color={loopEnabled ? 'primary' : 'default'}
          size="small"
          sx={{ ml: 2 }}
          aria-pressed={loopEnabled}
          role="switch"
          aria-label="Toggle loop playback"
        />
      </Box>

      {/* Time Ruler */}
      <Box sx={{ position: 'relative', height: 20, mb: 0.5 }}>
        {timeMarks.map((t) => (
          <Typography
            key={t}
            variant="caption"
            sx={{
              position: 'absolute',
              left: `${(t / maxDuration) * 100}%`,
              transform: 'translateX(-50%)',
              color: 'text.secondary',
              fontSize: '0.65rem',
            }}
          >
            {formatTime(t)}
          </Typography>
        ))}
      </Box>

      {/* Visual Timeline */}
      <Box
        ref={timelineRef}
        onClick={handleTimelineClick}
        sx={{
          position: 'relative',
          height: isMobile ? 100 : 80, // Taller on mobile for easier touch targets
          backgroundColor: 'grey.900',
          borderRadius: 2,
          cursor: 'pointer',
          overflow: 'hidden',
          userSelect: 'none',
          border: '1px solid',
          borderColor: 'grey.700',
        }}
      >
        {/* Full buffer background with subtle pattern */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'grey.800',
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(255,255,255,0.02) 50px, rgba(255,255,255,0.02) 51px)',
          }}
        />

        {/* Dimmed areas outside selection */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: `${startPercent}%`,
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            width: `${100 - endPercent}%`,
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Selected range highlight */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${startPercent}%`,
            width: `${endPercent - startPercent}%`,
            backgroundImage: 'linear-gradient(180deg, rgba(25, 118, 210, 0.3) 0%, rgba(25, 118, 210, 0.15) 100%)',
            borderTop: '3px solid',
            borderBottom: '3px solid',
            borderColor: 'primary.main',
          }}
        />

        {/* Playhead - always visible */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${playheadPercent}%`,
            width: 3,
            backgroundColor: 'warning.main',
            zIndex: 5,
            boxShadow: '0 0 8px rgba(255, 167, 38, 0.6)',
            pointerEvents: 'none',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: -6,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid',
              borderTopColor: 'warning.main',
            },
          }}
        />

        {/* Start handle */}
        <Box
          onMouseDown={(e) => handleTimelineMouseDown(e, 'start')}
          role="slider"
          aria-label="Trim start time"
          aria-valuemin={0}
          aria-valuemax={maxDuration}
          aria-valuenow={startTime}
          aria-valuetext={`Start at ${formatTime(startTime)}`}
          tabIndex={0}
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${startPercent}%`,
            width: 12,
            transform: 'translateX(-50%)',
            backgroundImage: 'linear-gradient(180deg, #4caf50 0%, #2e7d32 100%)',
            cursor: 'ew-resize',
            zIndex: 6,
            borderRadius: '6px 0 0 6px',
            boxShadow: '2px 0 8px rgba(0,0,0,0.4)',
            transition: 'width 0.15s ease, box-shadow 0.15s ease',
            '&:hover': {
              width: 14,
              boxShadow: '2px 0 12px rgba(76, 175, 80, 0.6)',
            },
            '&:focus': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: 2,
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 3,
              height: 40,
              backgroundColor: 'rgba(255,255,255,0.8)',
              borderRadius: 2,
            },
          }}
        />

        {/* End handle */}
        <Box
          onMouseDown={(e) => handleTimelineMouseDown(e, 'end')}
          role="slider"
          aria-label="Trim end time"
          aria-valuemin={0}
          aria-valuemax={maxDuration}
          aria-valuenow={endTime}
          aria-valuetext={`End at ${formatTime(endTime)}`}
          tabIndex={0}
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${endPercent}%`,
            width: 12,
            transform: 'translateX(-50%)',
            backgroundImage: 'linear-gradient(180deg, #f44336 0%, #c62828 100%)',
            cursor: 'ew-resize',
            zIndex: 6,
            borderRadius: '0 6px 6px 0',
            boxShadow: '-2px 0 8px rgba(0,0,0,0.4)',
            transition: 'width 0.15s ease, box-shadow 0.15s ease',
            '&:hover': {
              width: 14,
              boxShadow: '-2px 0 12px rgba(244, 67, 54, 0.6)',
            },
            '&:focus': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: 2,
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 3,
              height: 40,
              backgroundColor: 'rgba(255,255,255,0.8)',
              borderRadius: 2,
            },
          }}
        />

        {/* Time marks on timeline */}
        {timeMarks.map((t) => (
          <Box
            key={t}
            sx={{
              position: 'absolute',
              bottom: 0,
              left: `${(t / maxDuration) * 100}%`,
              width: 1,
              height: 12,
              backgroundColor: 'rgba(255,255,255,0.3)',
            }}
          />
        ))}
      </Box>

      {/* Time Display Badges */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: isMobile ? 1.5 : 0,
          mt: 2,
          px: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, order: isMobile ? 1 : 0 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'success.main',
              boxShadow: '0 0 6px rgba(76, 175, 80, 0.6)',
            }}
          />
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
            Start: {formatTime(startTime)}
          </Typography>
        </Box>
        <Box
          sx={{
            px: 2,
            py: 0.5,
            borderRadius: 2,
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            order: isMobile ? 0 : 1,
          }}
        >
          <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
            Duration: {formatTime(selectedDuration)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, order: 2 }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
            End: {formatTime(endTime)}
          </Typography>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'error.main',
              boxShadow: '0 0 6px rgba(244, 67, 54, 0.6)',
            }}
          />
        </Box>
      </Box>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', textAlign: 'center', mt: 1 }}
      >
        Drag the green and red handles to adjust your clip range. Buffer: {formatTime(maxDuration)} total
      </Typography>
    </Box>
  );
};
