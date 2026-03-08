import React, { useState, useCallback, useEffect, useRef } from 'react';
import { IconButton, Popover, Slider, Box } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import { Track, type RemoteParticipant } from 'livekit-client';
import { SCREENSHARE_VOLUME_STORAGE_PREFIX } from '../../constants/voice';
import { useVoice } from '../../contexts/VoiceContext';

function getStoredScreenShareVolume(userId: string): number | null {
  try {
    const stored = localStorage.getItem(`${SCREENSHARE_VOLUME_STORAGE_PREFIX}${userId}`);
    return stored !== null ? parseFloat(stored) : null;
  } catch {
    return null;
  }
}

function setStoredScreenShareVolume(userId: string, volume: number): void {
  try {
    localStorage.setItem(`${SCREENSHARE_VOLUME_STORAGE_PREFIX}${userId}`, String(volume));
  } catch {
    // ignore storage errors
  }
}

interface ScreenShareVolumeControlProps {
  participant: RemoteParticipant;
}

const ScreenShareVolumeControl: React.FC<ScreenShareVolumeControlProps> = ({ participant }) => {
  const theme = useTheme();
  const { isDeafened } = useVoice();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const [volume, setVolume] = useState<number>(() => {
    const stored = getStoredScreenShareVolume(participant.identity);
    return stored !== null ? Math.round(stored * 100) : 100;
  });

  // Web Audio GainNode for >100% amplification
  const gainNodesRef = useRef<Map<string, { gainNode: GainNode; source: MediaStreamAudioSourceNode; context: AudioContext }>>(new Map());

  // Cleanup gain nodes on unmount
  useEffect(() => {
    const nodes = gainNodesRef.current;
    return () => {
      nodes.forEach(({ context }) => context.close());
      nodes.clear();
    };
  }, []);

  const applyVolume = useCallback(
    (vol: number) => {
      participant.audioTrackPublications.forEach((pub) => {
        if (pub.track && pub.source === Track.Source.ScreenShareAudio) {
          const key = `${participant.identity}:screenshare`;

          if (vol <= 100) {
            const existingEntry = gainNodesRef.current.get(key);
            if (existingEntry) {
              existingEntry.source.disconnect();
              existingEntry.context.close();
              gainNodesRef.current.delete(key);
            }
            pub.track.setVolume(vol / 100);
          } else {
            pub.track.setVolume(0);

            const mediaStream = pub.track.mediaStream;
            if (mediaStream) {
              let entry = gainNodesRef.current.get(key);

              if (!entry) {
                const context = new AudioContext();
                const source = context.createMediaStreamSource(mediaStream);
                const gainNode = context.createGain();
                source.connect(gainNode);
                gainNode.connect(context.destination);
                entry = { gainNode, source, context };
                gainNodesRef.current.set(key, entry);
              }

              entry.gainNode.gain.value = vol / 100;
            }
          }
        }
      });
    },
    [participant],
  );

  // Apply stored volume when participant changes
  useEffect(() => {
    const stored = getStoredScreenShareVolume(participant.identity);
    if (stored !== null) {
      applyVolume(Math.round(stored * 100));
    }
  }, [participant, applyVolume]);

  const handleVolumeChange = (_event: Event, newValue: number | number[]) => {
    const val = newValue as number;
    setVolume(val);
    applyVolume(val);
    setStoredScreenShareVolume(participant.identity, val / 100);
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = (e?: React.SyntheticEvent | Event) => {
    if (e) {
      (e as React.SyntheticEvent).stopPropagation?.();
    }
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  const VolumeIcon = volume === 0 ? VolumeOffIcon : volume <= 50 ? VolumeDownIcon : VolumeUpIcon;

  return (
    <>
      <IconButton
        sx={{
          backgroundColor: alpha(theme.palette.background.paper, 0.5),
          color: theme.palette.common.white,
          width: 32,
          height: 32,
          '&:hover': {
            backgroundColor: alpha(theme.palette.background.paper, 0.7),
          },
        }}
        size="small"
        onClick={handleClick}
      >
        <VolumeIcon fontSize="small" />
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <Box sx={{ px: 2, py: 1.5, width: 180 }}>
          <Slider
            value={volume}
            onChange={handleVolumeChange}
            min={0}
            max={200}
            step={1}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}%`}
            size="small"
            disabled={isDeafened}
          />
        </Box>
      </Popover>
    </>
  );
};

export default ScreenShareVolumeControl;
