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
  VolumeUp,
  Refresh,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useDeviceSettings } from '../../hooks/useDeviceSettings';

interface DeviceSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onDeviceChange?: (type: 'audio' | 'video', deviceId: string) => void;
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
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [testingAudio, setTestingAudio] = useState(false);
  const [testingVideo, setTestingVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const testStreamRef = useRef<MediaStream | null>(null);
  
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

  // Clean up test stream when dialog closes
  useEffect(() => {
    if (!open) {
      stopTestStream();
    }
  }, [open]);

  const stopTestStream = () => {
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach(track => track.stop());
      testStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTestingVideo(false);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    stopTestStream();
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
    stopTestStream();
    onDeviceChange?.('video', deviceId);
  };

  const testAudioInput = async () => {
    if (testingAudio) return;
    
    setTestingAudio(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: getAudioConstraints(),
        video: false,
      });
      
      // Create a simple audio level indicator
      // For now, just show that we successfully got audio
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
        setTestingAudio(false);
      }, 2000);
      
    } catch (error) {
      console.error('Failed to test audio:', error);
      setTestingAudio(false);
    }
  };

  const testVideoInput = async () => {
    if (testingVideo) {
      stopTestStream();
      return;
    }

    setTestingVideo(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: getVideoConstraints(),
      });

      testStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Failed to test video:', error);
      setTestingVideo(false);
    }
  };

  const handleRefreshDevices = async () => {
    await requestPermissions();
    await enumerateDevices();
  };

  const getDeviceLabel = (device: any) => {
    if (!device.label || device.label === '') {
      return `${device.kind} (${device.deviceId.slice(0, 8)}...)`;
    }
    return device.label;
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
                  disabled={!permissions.microphone || testingAudio}
                >
                  {testingAudio ? 'Testing...' : 'Test Mic'}
                </Button>
              </Box>
              {testingAudio && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Testing microphone input...
                  </Typography>
                  <LinearProgress sx={{ mt: 1 }} />
                </Box>
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