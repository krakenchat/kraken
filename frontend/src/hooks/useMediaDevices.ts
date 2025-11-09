/**
 * useMediaDevices Hook
 *
 * Platform-aware media device management hook for camera and microphone access.
 * Handles browser permission requirements and Electron-specific device APIs.
 */

import { useState, useEffect, useCallback } from 'react';
import { supportsMediaDevices, isSecureContext } from '../utils/platform';

interface MediaDeviceInfo {
  deviceId: string;
  kind: MediaDeviceKind;
  label: string;
  groupId: string;
}

interface UseMediaDevicesReturn {
  audioInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  videoInputDevices: MediaDeviceInfo[];
  isSupported: boolean;
  isSecure: boolean;
  hasPermissions: boolean;
  requestPermissions: () => Promise<boolean>;
  refreshDevices: () => Promise<void>;
  error: string | null;
}

/**
 * Hook for managing media devices across platforms
 */
export const useMediaDevices = (): UseMediaDevicesReturn => {
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupported = supportsMediaDevices();
  const isSecure = isSecureContext();

  /**
   * Enumerate and categorize available media devices
   */
  const enumerateDevices = useCallback(async (): Promise<void> => {
    if (!isSupported) {
      setError('Media devices API not supported');
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioInputs: MediaDeviceInfo[] = [];
      const audioOutputs: MediaDeviceInfo[] = [];
      const videoInputs: MediaDeviceInfo[] = [];

      devices.forEach((device) => {
        const deviceInfo: MediaDeviceInfo = {
          deviceId: device.deviceId,
          kind: device.kind,
          label: device.label || `${device.kind} ${device.deviceId.slice(0, 8)}`,
          groupId: device.groupId,
        };

        switch (device.kind) {
          case 'audioinput':
            audioInputs.push(deviceInfo);
            break;
          case 'audiooutput':
            audioOutputs.push(deviceInfo);
            break;
          case 'videoinput':
            videoInputs.push(deviceInfo);
            break;
        }
      });

      setAudioInputDevices(audioInputs);
      setAudioOutputDevices(audioOutputs);
      setVideoInputDevices(videoInputs);

      // If we got device labels, we have permissions
      const hasLabels = devices.some((device) => device.label !== '');
      setHasPermissions(hasLabels);
      setError(null);
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
      setError(err instanceof Error ? err.message : 'Failed to enumerate devices');
    }
  }, [isSupported]);

  /**
   * Request media permissions
   * Must be called in response to user gesture for browsers
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Media devices API not supported');
      return false;
    }

    if (!isSecure) {
      setError('Media access requires HTTPS or localhost');
      return false;
    }

    try {
      // Request both audio and video permissions
      // This works in both Electron and browsers
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      // Stop the tracks immediately - we just needed to trigger permission prompt
      stream.getTracks().forEach((track) => track.stop());

      // Enumerate devices now that we have permissions
      await enumerateDevices();

      return true;
    } catch (err) {
      console.error('Failed to request permissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to request permissions');

      // Try to enumerate anyway - might get device IDs without labels
      await enumerateDevices();

      return false;
    }
  }, [isSupported, isSecure, enumerateDevices]);

  /**
   * Refresh device list
   */
  const refreshDevices = useCallback(async (): Promise<void> => {
    await enumerateDevices();
  }, [enumerateDevices]);

  /**
   * Initial device enumeration on mount
   */
  useEffect(() => {
    if (isSupported) {
      enumerateDevices();

      // Listen for device changes
      const handleDeviceChange = () => {
        enumerateDevices();
      };

      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, [isSupported, enumerateDevices]);

  return {
    audioInputDevices,
    audioOutputDevices,
    videoInputDevices,
    isSupported,
    isSecure,
    hasPermissions,
    requestPermissions,
    refreshDevices,
    error,
  };
};
