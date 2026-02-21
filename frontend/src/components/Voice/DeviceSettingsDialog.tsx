import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  Tabs,
  Tab,
  Paper,
  IconButton,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  Refresh,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useDeviceSettings } from '../../hooks/useDeviceSettings';
import { useDeviceTest, getDeviceLabel } from '../../hooks/useDeviceTest';

interface DeviceSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onDeviceChange?: (type: 'audio' | 'video', deviceId: string) => void;
  initialTab?: 'audio' | 'video';
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`device-tabpanel-${index}`}
    aria-labelledby={`device-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
  </div>
);

export const DeviceSettingsDialog: React.FC<DeviceSettingsDialogProps> = ({
  open,
  onClose,
  onDeviceChange,
  initialTab,
}) => {
  const [tabValue, setTabValue] = useState(initialTab === 'video' ? 1 : 0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    audioInputDevices,
    audioOutputDevices,
    videoInputDevices,
    selectedAudioInputId,
    selectedAudioOutputId,
    selectedVideoInputId,
    setSelectedAudioInput,
    setSelectedAudioOutput,
    setSelectedVideoInput,
    isLoading,
    permissions,
    requestPermissions,
    enumerateDevices,
    getAudioConstraints,
    getVideoConstraints,
  } = useDeviceSettings();

  const {
    testingAudio,
    testingVideo,
    audioLevel,
    testAudioInput,
    testVideoInput,
    stopAudioTest,
    stopVideoTest,
  } = useDeviceTest({ videoRef, getAudioConstraints, getVideoConstraints });

  // Sync tab when initialTab changes (e.g., dialog opens to a different tab)
  useEffect(() => {
    if (open) {
      setTabValue(initialTab === 'video' ? 1 : 0);
    }
  }, [open, initialTab]);

  // Clean up tests when dialog closes
  useEffect(() => {
    if (!open) {
      stopAudioTest();
      stopVideoTest();
    }
  }, [open, stopAudioTest, stopVideoTest]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    stopAudioTest();
    stopVideoTest();
  };

  const handleAudioInputChange = (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    onDeviceChange?.('audio', deviceId);
  };

  const handleAudioOutputChange = (deviceId: string) => {
    setSelectedAudioOutput(deviceId);
  };

  const handleVideoInputChange = (deviceId: string) => {
    setSelectedVideoInput(deviceId);
    stopVideoTest();
    onDeviceChange?.('video', deviceId);
  };

  const handleRefreshDevices = async () => {
    await requestPermissions();
    await enumerateDevices();
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          Voice & Video Settings
          <IconButton onClick={handleRefreshDevices} disabled={isLoading}>
            <Refresh />
          </IconButton>
        </Box>
      </DialogTitle>

      {isLoading && <LinearProgress />}

      <DialogContent>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="device settings tabs">
          <Tab label="Audio" icon={<Mic />} />
          <Tab label="Video" icon={<Videocam />} />
        </Tabs>

        {/* Audio Settings Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Permissions Status */}
            <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2">Microphone Permission</Typography>
                <Chip
                  size="small"
                  icon={permissions.microphone ? <CheckCircle /> : <ErrorIcon />}
                  label={permissions.microphone ? 'Granted' : 'Not Granted'}
                  color={permissions.microphone ? 'success' : 'error'}
                />
              </Box>
              {!permissions.microphone && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Microphone permission is required to use voice features. 
                  <Button size="small" onClick={requestPermissions} sx={{ ml: 1 }}>
                    Request Permission
                  </Button>
                </Alert>
              )}
            </Paper>

            {/* Audio Input Device */}
            <FormControl fullWidth>
              <InputLabel>Microphone</InputLabel>
              <Select
                value={selectedAudioInputId}
                label="Microphone"
                onChange={(e) => handleAudioInputChange(e.target.value)}
                disabled={!permissions.microphone || audioInputDevices.length === 0}
              >
                {audioInputDevices.length === 0 ? (
                  <MenuItem value="">No devices found</MenuItem>
                ) : (
                  audioInputDevices.map((device) => (
                    <MenuItem key={device.deviceId} value={device.deviceId}>
                      {getDeviceLabel(device)}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {/* Audio Output Device */}
            <FormControl fullWidth>
              <InputLabel>Speakers</InputLabel>
              <Select
                value={selectedAudioOutputId}
                label="Speakers"
                onChange={(e) => handleAudioOutputChange(e.target.value)}
                disabled={audioOutputDevices.length === 0}
              >
                {audioOutputDevices.length === 0 ? (
                  <MenuItem value="">No devices found</MenuItem>
                ) : (
                  audioOutputDevices.map((device) => (
                    <MenuItem key={device.deviceId} value={device.deviceId}>
                      {getDeviceLabel(device)}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {/* Audio Test */}
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2">Test Microphone</Typography>
                <Button
                  variant="outlined"
                  startIcon={testingAudio ? <MicOff /> : <Mic />}
                  onClick={testAudioInput}
                  disabled={!permissions.microphone}
                >
                  {testingAudio ? 'Stop Test' : 'Test Mic'}
                </Button>
              </Box>
              {testingAudio && (
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Microphone Level
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {Math.round(audioLevel)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={audioLevel}
                    sx={{
                      height: 8,
                      borderRadius: 1,
                      backgroundColor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: audioLevel > 80 ? 'error.main' : audioLevel > 50 ? 'warning.main' : 'success.main',
                      }
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {audioLevel < 5
                      ? 'Speak into your microphone to see the level'
                      : audioLevel > 80
                      ? 'Volume is high - your mic is working great!'
                      : 'Your microphone is working!'}
                  </Typography>
                </Box>
              )}
              {!testingAudio && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                  Click "Test Mic" and speak to verify your microphone is working
                </Typography>
              )}
            </Paper>
          </Box>
        </TabPanel>

        {/* Video Settings Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Permissions Status */}
            <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2">Camera Permission</Typography>
                <Chip
                  size="small"
                  icon={permissions.camera ? <CheckCircle /> : <ErrorIcon />}
                  label={permissions.camera ? 'Granted' : 'Not Granted'}
                  color={permissions.camera ? 'success' : 'error'}
                />
              </Box>
              {!permissions.camera && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Camera permission is required to use video features.
                  <Button size="small" onClick={requestPermissions} sx={{ ml: 1 }}>
                    Request Permission
                  </Button>
                </Alert>
              )}
            </Paper>

            {/* Video Input Device */}
            <FormControl fullWidth>
              <InputLabel>Camera</InputLabel>
              <Select
                value={selectedVideoInputId}
                label="Camera"
                onChange={(e) => handleVideoInputChange(e.target.value)}
                disabled={!permissions.camera || videoInputDevices.length === 0}
              >
                {videoInputDevices.length === 0 ? (
                  <MenuItem value="">No devices found</MenuItem>
                ) : (
                  videoInputDevices.map((device) => (
                    <MenuItem key={device.deviceId} value={device.deviceId}>
                      {getDeviceLabel(device)}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {/* Video Test */}
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle2">Test Camera</Typography>
                <Button
                  variant="outlined"
                  startIcon={testingVideo ? <VideocamOff /> : <Videocam />}
                  onClick={testVideoInput}
                  disabled={!permissions.camera}
                >
                  {testingVideo ? 'Stop Test' : 'Test Camera'}
                </Button>
              </Box>
              
              <Box
                sx={{
                  width: '100%',
                  height: 240,
                  backgroundColor: 'grey.100',
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {testingVideo ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                    <Videocam sx={{ fontSize: 48, mb: 1 }} />
                    <Typography variant="body2">
                      Click "Test Camera" to preview your camera
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
};