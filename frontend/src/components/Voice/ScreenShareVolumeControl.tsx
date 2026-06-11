import React, { useState, useCallback } from 'react';
import { IconButton, Popover, Slider, Box } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import { Track, type RemoteParticipant } from 'livekit-client';
import { SCREENSHARE_VOLUME_STORAGE_PREFIX } from '../../constants/voice';
import { useVoice } from '../../contexts/VoiceContext';
import { audioBoostManager, boostKey } from '../../features/voice/audioBoostManager';
import { isBoostableAudioTrack } from '../../features/voice/isBoostableAudioTrack';

function getStoredScreenShareVolume(userId: string): number | null {
  try {
    const stored = localStorage.getItem(`${SCREENSHARE_VOLUME_STORAGE_PREFIX}${userId}`);
    if (stored === null) return null;
    const parsed = parseFloat(stored);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) return null;
    return parsed;
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

/**
 * Volume slider for a participant's screen share audio.
 *
 * This component only persists the chosen volume and forwards live slider
 * changes to the app-wide audioBoostManager. Applying stored volumes on
 * (re)subscribe and deafen handling are owned by the persistent
 * useRemoteVolumeEffect / useDeafenEffect hooks, so audio never depends on
 * this component staying mounted.
 */
const ScreenShareVolumeControl: React.FC<ScreenShareVolumeControlProps> = ({ participant }) => {
  const theme = useTheme();
  const { isDeafened } = useVoice();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const [volume, setVolume] = useState<number>(() => {
    const stored = getStoredScreenShareVolume(participant.identity);
    return stored !== null ? Math.round(stored * 100) : 100;
  });

  const applyVolumeToTracks = useCallback(
    (vol: number) => {
      participant.audioTrackPublications.forEach((pub) => {
        if (
          pub.track &&
          pub.source === Track.Source.ScreenShareAudio &&
          isBoostableAudioTrack(pub.track)
        ) {
          audioBoostManager.applyVolume(
            pub.track,
            boostKey(participant.identity, pub.source),
            vol,
          );
        }
      });
    },
    [participant],
  );

  const handleVolumeChange = (_event: Event, newValue: number | number[]) => {
    const val = newValue as number;
    setVolume(val);
    applyVolumeToTracks(val);
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
        aria-label="Screenshare volume"
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
        onClose={() => handleClose()}
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
