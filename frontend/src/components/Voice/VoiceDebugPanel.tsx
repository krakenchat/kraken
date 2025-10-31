import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, Chip, Divider } from '@mui/material';
import { useRoom } from '../../hooks/useRoom';
import { useSpeakingDetection } from '../../hooks/useSpeakingDetection';
import { useProfileQuery } from '../../features/users/usersSlice';

/**
 * Debug panel to help diagnose voice and speaking detection issues
 * Shows:
 * - LiveKit room connection status
 * - Microphone track status
 * - Speaking detection state
 * - Audio levels
 */
export const VoiceDebugPanel: React.FC = () => {
  const { room } = useRoom();
  const { speakingMap, isSpeaking } = useSpeakingDetection();
  const { data: currentUser } = useProfileQuery();
  const [audioLevel, setAudioLevel] = useState(0);

  const isCurrentUserSpeaking = currentUser ? isSpeaking(currentUser.id) : false;

  // Monitor audio levels from local microphone
  useEffect(() => {
    if (!room) return;

    const localParticipant = room.localParticipant;
    const audioTrack = localParticipant.getTrackPublications().find(
      (pub) => pub.kind === 'audio'
    );

    if (!audioTrack?.track) return;

    // Create audio context to monitor levels
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    const mediaStreamTrack = audioTrack.track.mediaStreamTrack;
    const stream = new MediaStream([mediaStreamTrack]);
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationFrameId: number;

    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const level = Math.min(100, (average / 255) * 100 * 2);
      setAudioLevel(level);

      animationFrameId = requestAnimationFrame(updateLevel);
    };

    updateLevel();

    return () => {
      cancelAnimationFrame(animationFrameId);
      audioContext.close();
    };
  }, [room]);

  if (!room) {
    return (
      <Paper
        sx={{
          position: 'fixed',
          top: 80,
          right: 16,
          p: 2,
          zIndex: 9999,
          minWidth: 300,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
        }}
      >
        <Typography variant="h6" gutterBottom>
          🔧 Voice Debug Panel
        </Typography>
        <Divider sx={{ mb: 2, borderColor: 'grey.700' }} />
        <Chip label="NOT CONNECTED TO ROOM" color="error" size="small" />
      </Paper>
    );
  }

  const localParticipant = room.localParticipant;
  const audioPublication = Array.from(localParticipant.trackPublications.values()).find(
    (pub) => pub.kind === 'audio'
  );

  const allSpeakingUsers = Array.from(speakingMap.entries())
    .filter(([, speaking]) => speaking)
    .map(([identity]) => identity);

  return (
    <Paper
      sx={{
        position: 'fixed',
        top: 80,
        right: 16,
        p: 2,
        zIndex: 9999,
        minWidth: 300,
        maxWidth: 400,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
      }}
    >
      <Typography variant="h6" gutterBottom>
        🔧 Voice Debug Panel
      </Typography>
      <Divider sx={{ mb: 2, borderColor: 'grey.700' }} />

      {/* Room Status */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: 'grey.400' }}>
          Room Status
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
          <Chip
            label={`Connected: ${room.state}`}
            color="success"
            size="small"
          />
          <Chip
            label={`Participants: ${room.numParticipants}`}
            color="info"
            size="small"
          />
        </Box>
      </Box>

      {/* Audio Track Status */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: 'grey.400' }}>
          Microphone Track
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
          {audioPublication ? (
            <>
              <Chip
                label={audioPublication.isMuted ? 'MUTED' : 'UNMUTED'}
                color={audioPublication.isMuted ? 'error' : 'success'}
                size="small"
              />
              <Chip
                label={audioPublication.track ? 'Track Active' : 'No Track'}
                color={audioPublication.track ? 'success' : 'error'}
                size="small"
              />
            </>
          ) : (
            <Chip label="NO AUDIO TRACK" color="error" size="small" />
          )}
        </Box>
      </Box>

      {/* Speaking Detection */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" sx={{ color: 'grey.400' }}>
          Speaking Detection
        </Typography>
        <Box sx={{ mt: 0.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 1,
            }}
          >
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                backgroundColor: isCurrentUserSpeaking ? '#00ff00' : '#666',
                transition: 'background-color 0.2s',
              }}
            />
            <Typography variant="body2">
              {isCurrentUserSpeaking ? 'YOU ARE SPEAKING' : 'Not speaking'}
            </Typography>
          </Box>
          <Chip
            label={`LiveKit isSpeaking: ${localParticipant.isSpeaking}`}
            color={localParticipant.isSpeaking ? 'success' : 'default'}
            size="small"
          />
        </Box>
      </Box>

      {/* Audio Level Meter */}
      {audioPublication && !audioPublication.isMuted && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ color: 'grey.400' }}>
            Audio Level: {Math.round(audioLevel)}%
          </Typography>
          <Box
            sx={{
              width: '100%',
              height: 8,
              backgroundColor: 'grey.800',
              borderRadius: 1,
              mt: 0.5,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: `${audioLevel}%`,
                height: '100%',
                backgroundColor:
                  audioLevel > 50 ? '#00ff00' : audioLevel > 20 ? '#ffff00' : '#ff0000',
                transition: 'width 0.1s',
              }}
            />
          </Box>
        </Box>
      )}

      {/* All Speaking Users */}
      {allSpeakingUsers.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" sx={{ color: 'grey.400' }}>
            Currently Speaking ({allSpeakingUsers.length})
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            {allSpeakingUsers.map((identity) => (
              <Chip
                key={identity}
                label={identity === currentUser?.id ? 'YOU' : identity.slice(0, 8)}
                color="success"
                size="small"
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Instructions */}
      <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'grey.700' }}>
        <Typography variant="caption" sx={{ color: 'grey.400', display: 'block' }}>
          <strong>How to test:</strong>
        </Typography>
        <Typography variant="caption" sx={{ color: 'grey.500', display: 'block', mt: 0.5 }}>
          1. Check if "Microphone Track" shows UNMUTED
          <br />
          2. Speak - watch "Audio Level" bar move
          <br />
          3. If audio level moves but no speaking detection:
          <br />
          &nbsp;&nbsp;→ LiveKit threshold may be too high
          <br />
          4. Green dot appears when LiveKit detects speaking
        </Typography>
      </Box>
    </Paper>
  );
};
