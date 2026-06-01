import React, { useCallback } from 'react';
import { Card, CardContent } from '@mui/material';
import AudioVideoSettingsPanel from './AudioVideoSettingsPanel';
import { useVoiceConnection } from '../../hooks/useVoiceConnection';
import { logger } from '../../utils/logger';

const VoiceSettings: React.FC = () => {
  const { actions } = useVoiceConnection();

  const handleDeviceChange = useCallback(
    async (type: 'audio' | 'video' | 'audioOutput', deviceId: string) => {
      try {
        if (type === 'audio') {
          await actions.switchAudioInputDevice(deviceId);
        } else if (type === 'audioOutput') {
          await actions.switchAudioOutputDevice(deviceId);
        } else {
          await actions.switchVideoInputDevice(deviceId);
        }
      } catch (error) {
        logger.error(`Failed to switch ${type} device:`, error);
      }
    },
    [actions]
  );

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <AudioVideoSettingsPanel onDeviceChange={handleDeviceChange} />
      </CardContent>
    </Card>
  );
};

export default VoiceSettings;
