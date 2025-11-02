import { useState, useEffect, useCallback } from 'react';
import { getCachedItem, setCachedItem } from '../utils/storage';

export interface MediaDeviceInfo extends MediaDeviceInfoLike {
  deviceId: string;
  groupId: string;
  kind: MediaDeviceKind;
  label: string;
}

interface MediaDeviceInfoLike {
  readonly deviceId: string;
  readonly groupId: string;
  readonly kind: MediaDeviceKind;
  readonly label: string;
}

interface DevicePreferences {
  audioInputDeviceId: string;
  audioOutputDeviceId: string;
  videoInputDeviceId: string;
}

const DEFAULT_DEVICE_ID = 'default';
const DEVICE_PREFERENCES_KEY = 'kraken_device_preferences';

export const useDeviceSettings = () => {
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState({
    camera: false,
    microphone: false,
  });

  // Load saved device preferences
  const [devicePreferences, setDevicePreferences] = useState<DevicePreferences>(() => {
    const saved = getCachedItem<DevicePreferences>(DEVICE_PREFERENCES_KEY);
    return saved || {
      audioInputDeviceId: DEFAULT_DEVICE_ID,
      audioOutputDeviceId: DEFAULT_DEVICE_ID,
      videoInputDeviceId: DEFAULT_DEVICE_ID,
    };
  });

  // Save device preferences
  const saveDevicePreferences = useCallback((preferences: Partial<DevicePreferences>) => {
    const newPreferences = { ...devicePreferences, ...preferences };
    setDevicePreferences(newPreferences);
    setCachedItem(DEVICE_PREFERENCES_KEY, newPreferences);
  }, [devicePreferences]);

  // Request permissions for media devices
  const requestPermissions = useCallback(async () => {
    let micPermission = false;
    let cameraPermission = false;

    // Request audio permission
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micPermission = audioStream.getAudioTracks().length > 0;
      audioStream.getTracks().forEach(track => track.stop());
      console.log('Microphone permission granted');
    } catch (error) {
      console.warn('Failed to get microphone permission:', error);
      micPermission = false;
    }

    // Request video permission independently
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraPermission = videoStream.getVideoTracks().length > 0;
      videoStream.getTracks().forEach(track => track.stop());
      console.log('Camera permission granted');
    } catch (error) {
      console.warn('Failed to get camera permission:', error);
      cameraPermission = false;
    }

    setPermissions({
      microphone: micPermission,
      camera: cameraPermission,
    });

    return { microphone: micPermission, camera: cameraPermission };
  }, []);

  // Enumerate available media devices
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioInputs: MediaDeviceInfo[] = [];
      const audioOutputs: MediaDeviceInfo[] = [];
      const videoInputs: MediaDeviceInfo[] = [];

      devices.forEach((device) => {
        if (device.kind === 'audioinput') {
          audioInputs.push(device as MediaDeviceInfo);
        } else if (device.kind === 'audiooutput') {
          audioOutputs.push(device as MediaDeviceInfo);
        } else if (device.kind === 'videoinput') {
          videoInputs.push(device as MediaDeviceInfo);
        }
      });

      // Log device enumeration results for debugging
      console.log('Device enumeration complete:', {
        totalDevices: devices.length,
        audioInputs: audioInputs.length,
        audioOutputs: audioOutputs.length,
        videoInputs: videoInputs.length,
      });

      if (videoInputs.length > 0) {
        console.log('Video devices found:', videoInputs.map(d => ({
          id: d.deviceId,
          label: d.label || '(no label)',
        })));
      } else {
        console.warn('No video input devices found');
      }

      setAudioInputDevices(audioInputs);
      setAudioOutputDevices(audioOutputs);
      setVideoInputDevices(videoInputs);
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
    }
  }, []);

  // Initialize device enumeration
  const initializeDevices = useCallback(async () => {
    setIsLoading(true);
    
    try {
      await requestPermissions();
      await enumerateDevices();
    } finally {
      setIsLoading(false);
    }
  }, [requestPermissions, enumerateDevices]);

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = () => {
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [enumerateDevices]);

  // Initialize on mount
  useEffect(() => {
    initializeDevices();
  }, [initializeDevices]);

  // Device selection helpers
  const setSelectedAudioInput = useCallback((deviceId: string) => {
    saveDevicePreferences({ audioInputDeviceId: deviceId });
  }, [saveDevicePreferences]);

  const setSelectedAudioOutput = useCallback((deviceId: string) => {
    saveDevicePreferences({ audioOutputDeviceId: deviceId });
  }, [saveDevicePreferences]);

  const setSelectedVideoInput = useCallback((deviceId: string) => {
    saveDevicePreferences({ videoInputDeviceId: deviceId });
  }, [saveDevicePreferences]);

  // Get device by ID helper
  const getDeviceById = useCallback((devices: MediaDeviceInfo[], deviceId: string) => {
    return devices.find(device => device.deviceId === deviceId) || devices[0];
  }, []);

  // Get constraints for selected devices
  const getAudioConstraints = useCallback(() => {
    if (devicePreferences.audioInputDeviceId === DEFAULT_DEVICE_ID) {
      return true;
    }
    return { deviceId: { ideal: devicePreferences.audioInputDeviceId } };
  }, [devicePreferences.audioInputDeviceId]);

  const getVideoConstraints = useCallback(() => {
    if (devicePreferences.videoInputDeviceId === DEFAULT_DEVICE_ID) {
      return {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      };
    }
    return {
      deviceId: { ideal: devicePreferences.videoInputDeviceId },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    };
  }, [devicePreferences.videoInputDeviceId]);

  return {
    // Device lists
    audioInputDevices,
    audioOutputDevices,
    videoInputDevices,
    
    // Selected devices
    selectedAudioInputId: devicePreferences.audioInputDeviceId,
    selectedAudioOutputId: devicePreferences.audioOutputDeviceId,
    selectedVideoInputId: devicePreferences.videoInputDeviceId,
    
    // Selection methods
    setSelectedAudioInput,
    setSelectedAudioOutput,
    setSelectedVideoInput,
    
    // Helpers
    getDeviceById,
    getAudioConstraints,
    getVideoConstraints,
    
    // State
    isLoading,
    permissions,
    
    // Actions
    requestPermissions,
    enumerateDevices,
    initializeDevices,
  };
};