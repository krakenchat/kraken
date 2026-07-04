import React from 'react';
import {
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import ResponsiveDialog from '../Common/ResponsiveDialog';
import AudioVideoSettingsPanel from '../Settings/AudioVideoSettingsPanel';

interface DeviceSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onDeviceChange?: (type: 'audio' | 'video' | 'audioOutput', deviceId: string) => void;
}

export const DeviceSettingsDialog: React.FC<DeviceSettingsDialogProps> = ({
  open,
  onClose,
  onDeviceChange,
}) => (
  <ResponsiveDialog
    open={open}
    onClose={onClose}
    maxWidth="md"
    fullWidth
    title="Voice & Video Settings"
    PaperProps={{ sx: { minHeight: '500px' } }}
  >
    <DialogContent dividers>
      <AudioVideoSettingsPanel
        onDeviceChange={onDeviceChange}
        active={open}
        showHeader={false}
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Done</Button>
    </DialogActions>
  </ResponsiveDialog>
);
