import React, { useState, useCallback, useRef } from 'react';
import { IconButton, Slider, Box, Tooltip } from '@mui/material';
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
 * Volume control for a participant's screen share audio.
 *
 * Hovering the control expands a slider next to the icon (YouTube-style);
 * clicking the icon toggles mute, restoring the previous volume on unmute.
 *
 * This component only persists the chosen volume and forwards live changes
 * to the app-wide audioBoostManager. Applying stored volumes on
 * (re)subscribe and deafen handling are owned by the persistent
 * useRemoteVolumeEffect / useDeafenEffect hooks, so audio never depends on
 * this component staying mounted.
 */
const ScreenShareVolumeControl: React.FC<ScreenShareVolumeControlProps> = ({ participant }) => {
  const theme = useTheme();
  const { isDeafened } = useVoice();
  const [isHovered, setIsHovered] = useState(false);

  const [volume, setVolume] = useState<number>(() => {
    const stored = getStoredScreenShareVolume(participant.identity);
    return stored !== null ? Math.round(stored * 100) : 100;
  });

  // Volume to restore when unmuting via the icon
  const prevVolumeRef = useRef<number | null>(null);

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

  const setAndPersistVolume = useCallback(
    (val: number) => {
      setVolume(val);
      applyVolumeToTracks(val);
      setStoredScreenShareVolume(participant.identity, val / 100);
    },
    [applyVolumeToTracks, participant.identity],
  );

  const handleVolumeChange = (_event: Event, newValue: number | number[]) => {
    const val = newValue as number;
    if (val > 0) prevVolumeRef.current = null;
    setAndPersistVolume(val);
  };

  const isMuted = volume === 0;

  const handleMuteToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (isMuted) {
      setAndPersistVolume(prevVolumeRef.current ?? 100);
      prevVolumeRef.current = null;
    } else {
      prevVolumeRef.current = volume;
      setAndPersistVolume(0);
    }
  };

  const VolumeIcon = volume === 0 ? VolumeOffIcon : volume <= 50 ? VolumeDownIcon : VolumeUpIcon;

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => e.stopPropagation()}
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: 32,
        borderRadius: 16,
        backgroundColor: alpha(theme.palette.background.paper, 0.5),
        transition: 'background-color 0.2s',
        '&:hover': {
          backgroundColor: alpha(theme.palette.background.paper, 0.7),
        },
      }}
    >
      {/* Slider expands leftward into the tile on hover */}
      <Box
        sx={{
          width: isHovered ? 90 : 0,
          opacity: isHovered ? 1 : 0,
          overflow: 'hidden',
          transition: 'width 0.2s, opacity 0.2s',
          display: 'flex',
          alignItems: 'center',
          pl: isHovered ? 1.5 : 0,
        }}
      >
        {isHovered && (
          <Slider
            value={volume}
            onChange={handleVolumeChange}
            min={0}
            max={200}
            step={1}
            valueLabelDisplay="off"
            size="small"
            disabled={isDeafened}
            aria-label="Screenshare volume"
            sx={{ color: theme.palette.common.white, width: 74 }}
          />
        )}
      </Box>
      <Tooltip title={isDeafened ? 'Deafened' : isMuted ? 'Unmute' : `Mute · ${volume}%`}>
        <span>
          <IconButton
            aria-label={isMuted ? 'Unmute screenshare' : 'Mute screenshare'}
            sx={{
              color: theme.palette.common.white,
              width: 32,
              height: 32,
            }}
            size="small"
            disabled={isDeafened}
            onClick={handleMuteToggle}
          >
            <VolumeIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};

export default ScreenShareVolumeControl;
