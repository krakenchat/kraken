import React, { useState, useCallback, useEffect, useRef } from 'react';
import { IconButton, Popover, Slider, Box } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import { RoomEvent, Track, type RemoteParticipant, type RemoteTrackPublication } from 'livekit-client';
import { SCREENSHARE_VOLUME_STORAGE_PREFIX } from '../../constants/voice';
import { useVoice } from '../../contexts/VoiceContext';
import { useRoom } from '../../hooks/useRoom';
import { useAudioBoost } from '../../hooks/useAudioBoost';

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

const ScreenShareVolumeControl: React.FC<ScreenShareVolumeControlProps> = ({ participant }) => {
  const theme = useTheme();
  const { isDeafened } = useVoice();
  const { room } = useRoom();
  const { applyVolume: applyBoost, muteAllGainNodes } = useAudioBoost();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const [volume, setVolume] = useState<number>(() => {
    const stored = getStoredScreenShareVolume(participant.identity);
    return stored !== null ? Math.round(stored * 100) : 100;
  });

  // Keep volume in a ref so event handlers can read the latest value
  const volumeRef = useRef(volume);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const applyVolumeToTracks = useCallback(
    (vol: number) => {
      participant.audioTrackPublications.forEach((pub) => {
        if (pub.track && pub.source === Track.Source.ScreenShareAudio) {
          const key = `${participant.identity}:screenshare`;
          applyBoost(pub.track, key, vol);
        }
      });
    },
    [participant, applyBoost],
  );

  // Apply stored volume when participant changes
  useEffect(() => {
    const stored = getStoredScreenShareVolume(participant.identity);
    if (stored !== null) {
      applyVolumeToTracks(Math.round(stored * 100));
    }
  }, [participant, applyVolumeToTracks]);

  // Handle ScreenShareAudio track arriving after the video track
  useEffect(() => {
    if (!room) return;

    const handleTrackSubscribed = (
      _track: unknown,
      publication: RemoteTrackPublication,
      subscribedParticipant: RemoteParticipant,
    ) => {
      if (
        subscribedParticipant.identity !== participant.identity ||
        publication.source !== Track.Source.ScreenShareAudio
      ) {
        return;
      }
      // Apply current volume to newly subscribed screenshare audio track
      const currentVol = volumeRef.current;
      if (publication.track) {
        const key = `${participant.identity}:screenshare`;
        applyBoost(publication.track, key, currentVol);
      }
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    return () => {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    };
  }, [room, participant.identity, applyBoost]);

  // Handle deafen: mute GainNode path when deafened, restore on undeafen
  useEffect(() => {
    if (isDeafened) {
      muteAllGainNodes();
    } else {
      // Re-apply current volume (restores GainNode gain values)
      applyVolumeToTracks(volume);
    }
  }, [isDeafened]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally only react to deafen changes

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
