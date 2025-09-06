# useDeviceSettings

> **Location:** `frontend/src/hooks/useDeviceSettings.ts`  
> **Type:** State Hook  
> **Category:** device

## Overview

A comprehensive hook that manages audio and video device enumeration, permissions, preferences, and constraints for WebRTC applications. It handles device discovery, persistent user preferences via local storage, and provides optimized media constraints for LiveKit integration. This hook is essential for providing users control over their microphone, camera, and speaker devices.

## Hook Signature

```typescript
function useDeviceSettings(): UseDeviceSettingsReturn
```

### Parameters

This hook takes no parameters.

### Return Value

```typescript
interface UseDeviceSettingsReturn {
  // Device lists
  audioInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  videoInputDevices: MediaDeviceInfo[];
  
  // Selected devices
  selectedAudioInputId: string;
  selectedAudioOutputId: string;  
  selectedVideoInputId: string;
  
  // Selection methods
  setSelectedAudioInput: (deviceId: string) => void;
  setSelectedAudioOutput: (deviceId: string) => void;
  setSelectedVideoInput: (deviceId: string) => void;
  
  // Helpers
  getDeviceById: (devices: MediaDeviceInfo[], deviceId: string) => MediaDeviceInfo | undefined;
  getAudioConstraints: () => MediaTrackConstraints | true;
  getVideoConstraints: () => MediaTrackConstraints;
  
  // State
  isLoading: boolean;
  permissions: {
    camera: boolean;
    microphone: boolean;
  };
  
  // Actions
  requestPermissions: () => Promise<{ microphone: boolean; camera: boolean }>;
  enumerateDevices: () => Promise<void>;
  initializeDevices: () => Promise<void>;
}

interface MediaDeviceInfo {
  deviceId: string;
  groupId: string;
  kind: MediaDeviceKind;
  label: string;
}
```

## Usage Examples

### Basic Device Selection

```tsx
import { useDeviceSettings } from '@/hooks/useDeviceSettings';

function DeviceSelector() {
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
    permissions
  } = useDeviceSettings();

  if (isLoading) {
    return <div>Loading devices...</div>;
  }

  return (
    <div className="device-settings">
      <h3>Audio & Video Settings</h3>
      
      <div className="device-group">
        <label>Microphone:</label>
        <select 
          value={selectedAudioInputId} 
          onChange={(e) => setSelectedAudioInput(e.target.value)}
          disabled={!permissions.microphone}
        >
          {audioInputDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </div>

      <div className="device-group">
        <label>Speaker:</label>
        <select 
          value={selectedAudioOutputId}
          onChange={(e) => setSelectedAudioOutput(e.target.value)}
        >
          {audioOutputDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </div>

      <div className="device-group">
        <label>Camera:</label>
        <select 
          value={selectedVideoInputId}
          onChange={(e) => setSelectedVideoInput(e.target.value)}
          disabled={!permissions.camera}
        >
          {videoInputDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

### Advanced Integration with Voice Connection

```tsx
import { useDeviceSettings } from '@/hooks/useDeviceSettings';
import { useVoiceConnection } from '@/hooks/useVoiceConnection';

function VoiceSettingsPanel() {
  const { state: voiceState, actions: voiceActions } = useVoiceConnection();
  const {
    audioInputDevices,
    audioOutputDevices,
    selectedAudioInputId,
    selectedAudioOutputId,
    setSelectedAudioInput,
    setSelectedAudioOutput,
    getAudioConstraints,
    permissions,
    requestPermissions
  } = useDeviceSettings();

  const handleMicrophoneChange = async (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    
    // If currently in a voice call, switch the active device
    if (voiceState.isConnected) {
      try {
        await voiceActions.switchAudioInputDevice(deviceId);
      } catch (error) {
        console.error('Failed to switch microphone:', error);
      }
    }
  };

  const handleSpeakerChange = async (deviceId: string) => {
    setSelectedAudioOutput(deviceId);
    
    if (voiceState.isConnected) {
      try {
        await voiceActions.switchAudioOutputDevice(deviceId);
      } catch (error) {
        console.error('Failed to switch speaker:', error);
      }
    }
  };

  const handleRequestPermissions = async () => {
    try {
      const result = await requestPermissions();
      if (result.microphone) {
        console.log('Microphone permission granted');
      }
      if (result.camera) {
        console.log('Camera permission granted');
      }
    } catch (error) {
      console.error('Permission request failed:', error);
    }
  };

  return (
    <div className="voice-settings-panel">
      <h3>Voice Settings</h3>
      
      {!permissions.microphone && (
        <div className="permission-warning">
          <p>Microphone permission required for voice chat</p>
          <button onClick={handleRequestPermissions}>
            Grant Permissions
          </button>
        </div>
      )}
      
      <div className="device-selectors">
        <div className="input-selector">
          <label>Microphone:</label>
          <select 
            value={selectedAudioInputId}
            onChange={(e) => handleMicrophoneChange(e.target.value)}
            disabled={!permissions.microphone}
          >
            <option value="default">Default</option>
            {audioInputDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>

        <div className="output-selector">
          <label>Speaker:</label>
          <select 
            value={selectedAudioOutputId}
            onChange={(e) => handleSpeakerChange(e.target.value)}
          >
            <option value="default">Default</option>
            {audioOutputDevices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="audio-test">
        <p>Current constraints: {JSON.stringify(getAudioConstraints())}</p>
      </div>
    </div>
  );
}
```

### Device Settings Dialog

```tsx
function DeviceSettingsDialog({ open, onClose }) {
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
    getDeviceById,
    permissions,
    requestPermissions,
    isLoading
  } = useDeviceSettings();

  const [testingAudio, setTestingAudio] = useState(false);

  const testAudioOutput = async () => {
    setTestingAudio(true);
    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
        setTestingAudio(false);
      }, 1000);
    } catch (error) {
      console.error('Audio test failed:', error);
      setTestingAudio(false);
    }
  };

  const getCurrentDevice = (devices: MediaDeviceInfo[], selectedId: string) => {
    return getDeviceById(devices, selectedId) || devices[0];
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Device Settings</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <div>Loading devices...</div>
        ) : (
          <div className="device-settings-content">
            <div className="permission-section">
              <h4>Permissions</h4>
              <div className="permissions-grid">
                <div className="permission-item">
                  <span>Microphone:</span>
                  <span className={permissions.microphone ? 'granted' : 'denied'}>
                    {permissions.microphone ? '✓ Granted' : '✗ Denied'}
                  </span>
                </div>
                <div className="permission-item">
                  <span>Camera:</span>
                  <span className={permissions.camera ? 'granted' : 'denied'}>
                    {permissions.camera ? '✓ Granted' : '✗ Denied'}
                  </span>
                </div>
              </div>
              {(!permissions.microphone || !permissions.camera) && (
                <button onClick={requestPermissions}>
                  Request Permissions
                </button>
              )}
            </div>

            <div className="device-selection-section">
              <div className="device-selector">
                <h4>Audio Input (Microphone)</h4>
                <select 
                  value={selectedAudioInputId}
                  onChange={(e) => setSelectedAudioInput(e.target.value)}
                  disabled={!permissions.microphone}
                >
                  <option value="default">System Default</option>
                  {audioInputDevices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Device ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
                <p className="device-info">
                  Selected: {getCurrentDevice(audioInputDevices, selectedAudioInputId)?.label || 'Default'}
                </p>
              </div>

              <div className="device-selector">
                <h4>Audio Output (Speaker)</h4>
                <select 
                  value={selectedAudioOutputId}
                  onChange={(e) => setSelectedAudioOutput(e.target.value)}
                >
                  <option value="default">System Default</option>
                  {audioOutputDevices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Device ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
                <button 
                  onClick={testAudioOutput}
                  disabled={testingAudio}
                >
                  {testingAudio ? 'Testing...' : 'Test Audio'}
                </button>
              </div>

              <div className="device-selector">
                <h4>Video Input (Camera)</h4>
                <select 
                  value={selectedVideoInputId}
                  onChange={(e) => setSelectedVideoInput(e.target.value)}
                  disabled={!permissions.camera}
                >
                  <option value="default">System Default</option>
                  {videoInputDevices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Device ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <button onClick={onClose}>Close</button>
      </DialogActions>
    </Dialog>
  );
}
```

## Implementation Details

### Internal State

The hook manages multiple pieces of state:

```typescript
const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [permissions, setPermissions] = useState({
  camera: false,
  microphone: false,
});

// Persistent preferences loaded from localStorage
const [devicePreferences, setDevicePreferences] = useState<DevicePreferences>(() => {
  const saved = getCachedItem<DevicePreferences>(DEVICE_PREFERENCES_KEY);
  return saved || {
    audioInputDeviceId: DEFAULT_DEVICE_ID,
    audioOutputDeviceId: DEFAULT_DEVICE_ID,
    videoInputDeviceId: DEFAULT_DEVICE_ID,
  };
});
```

### Dependencies

#### Internal Hooks
- `useState` - Manages device lists, loading state, and permissions
- `useEffect` - Handles initialization and device change listeners
- `useCallback` - Memoizes functions for performance

#### External Dependencies
- `navigator.mediaDevices` - Web API for device enumeration and permissions
- Local storage utilities - For persistent device preferences

## Device Enumeration

### Permission Request Strategy

```typescript
const requestPermissions = useCallback(async () => {
  try {
    // Request both audio and video permissions to get device labels
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    const micPermission = stream.getAudioTracks().length > 0;
    const cameraPermission = stream.getVideoTracks().length > 0;

    setPermissions({
      microphone: micPermission,
      camera: cameraPermission,
    });

    // Stop the stream immediately - we just needed it for permissions
    stream.getTracks().forEach(track => track.stop());
    
    return { microphone: micPermission, camera: cameraPermission };
  } catch (error) {
    // Fall back to audio-only if video fails
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const micPermission = audioStream.getAudioTracks().length > 0;
      audioStream.getTracks().forEach(track => track.stop());
      
      setPermissions({ microphone: micPermission, camera: false });
      return { microphone: micPermission, camera: false };
    } catch {
      setPermissions({ microphone: false, camera: false });
      return { microphone: false, camera: false };
    }
  }
}, []);
```

### Device Discovery

```typescript
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

    setAudioInputDevices(audioInputs);
    setAudioOutputDevices(audioOutputs);  
    setVideoInputDevices(videoInputs);
  } catch (error) {
    console.error('Failed to enumerate devices:', error);
  }
}, []);
```

## Local Storage Integration

### Preference Persistence

```typescript
const saveDevicePreferences = useCallback((preferences: Partial<DevicePreferences>) => {
  const newPreferences = { ...devicePreferences, ...preferences };
  setDevicePreferences(newPreferences);
  setCachedItem(DEVICE_PREFERENCES_KEY, newPreferences);
}, [devicePreferences]);

// Device selection helpers that save preferences
const setSelectedAudioInput = useCallback((deviceId: string) => {
  saveDevicePreferences({ audioInputDeviceId: deviceId });
}, [saveDevicePreferences]);
```

### Storage Schema

```typescript
interface DevicePreferences {
  audioInputDeviceId: string;
  audioOutputDeviceId: string;
  videoInputDeviceId: string;
}

const DEVICE_PREFERENCES_KEY = 'kraken_device_preferences';
const DEFAULT_DEVICE_ID = 'default';
```

## Media Constraints Generation

### Audio Constraints

```typescript
const getAudioConstraints = useCallback(() => {
  if (devicePreferences.audioInputDeviceId === DEFAULT_DEVICE_ID) {
    return true; // Use browser default
  }
  return { deviceId: { exact: devicePreferences.audioInputDeviceId } };
}, [devicePreferences.audioInputDeviceId]);
```

### Video Constraints

```typescript
const getVideoConstraints = useCallback(() => {
  const baseConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  };

  if (devicePreferences.videoInputDeviceId === DEFAULT_DEVICE_ID) {
    return baseConstraints;
  }
  
  return {
    ...baseConstraints,
    deviceId: { exact: devicePreferences.videoInputDeviceId },
  };
}, [devicePreferences.videoInputDeviceId]);
```

## Side Effects

### Device Change Listening

```typescript
useEffect(() => {
  const handleDeviceChange = () => {
    enumerateDevices(); // Re-enumerate when devices change
  };

  navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
  
  return () => {
    navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  };
}, [enumerateDevices]);
```

### Initialization

```typescript
const initializeDevices = useCallback(async () => {
  setIsLoading(true);
  
  try {
    await requestPermissions();
    await enumerateDevices();
  } finally {
    setIsLoading(false);
  }
}, [requestPermissions, enumerateDevices]);

// Initialize on mount
useEffect(() => {
  initializeDevices();
}, [initializeDevices]);
```

## Performance Considerations

### Memoization Strategy

- **Device Lists:** Stored in state, updated only when devices change
- **Constraint Functions:** Memoized with useCallback to prevent unnecessary re-computations
- **Event Handlers:** Stable references to prevent listener re-registration

### Memory Management

- **Permission Streams:** Immediately stopped after permission check
- **Device Change Listeners:** Properly cleaned up on unmount
- **Preference Updates:** Debounced to prevent excessive localStorage writes

## Error Handling

### Permission Errors

```typescript
// Graceful fallback when permissions are denied
try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  // Handle success
} catch (error) {
  if (error.name === 'NotAllowedError') {
    console.log('User denied media permissions');
  } else if (error.name === 'NotFoundError') {
    console.log('No media devices found');
  }
  // Continue with limited functionality
}
```

### Device Enumeration Errors

```typescript
const enumerateDevices = useCallback(async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    // Process devices
  } catch (error) {
    console.error('Failed to enumerate devices:', error);
    // Provide fallback empty arrays
    setAudioInputDevices([]);
    setAudioOutputDevices([]);
    setVideoInputDevices([]);
  }
}, []);
```

## Testing

### Test Examples

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useDeviceSettings } from '../useDeviceSettings';

// Mock navigator.mediaDevices
const mockEnumerateDevices = jest.fn();
const mockGetUserMedia = jest.fn();

Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    enumerateDevices: mockEnumerateDevices,
    getUserMedia: mockGetUserMedia,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  writable: true,
});

describe('useDeviceSettings', () => {
  beforeEach(() => {
    mockEnumerateDevices.mockResolvedValue([
      { deviceId: 'audio1', kind: 'audioinput', label: 'Microphone 1', groupId: 'group1' },
      { deviceId: 'audio2', kind: 'audiooutput', label: 'Speaker 1', groupId: 'group1' },
      { deviceId: 'video1', kind: 'videoinput', label: 'Camera 1', groupId: 'group2' },
    ]);
    
    mockGetUserMedia.mockResolvedValue({
      getAudioTracks: () => [{}],
      getVideoTracks: () => [{}],
      getTracks: () => [{ stop: jest.fn() }, { stop: jest.fn() }],
    });
  });

  it('should initialize with default device preferences', () => {
    const { result } = renderHook(() => useDeviceSettings());
    
    expect(result.current.selectedAudioInputId).toBe('default');
    expect(result.current.selectedAudioOutputId).toBe('default');
    expect(result.current.selectedVideoInputId).toBe('default');
  });

  it('should enumerate devices on initialization', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useDeviceSettings());
    
    await waitForNextUpdate();
    
    expect(result.current.audioInputDevices).toHaveLength(1);
    expect(result.current.audioOutputDevices).toHaveLength(1);
    expect(result.current.videoInputDevices).toHaveLength(1);
  });

  it('should update device selection', () => {
    const { result } = renderHook(() => useDeviceSettings());
    
    act(() => {
      result.current.setSelectedAudioInput('audio1');
    });
    
    expect(result.current.selectedAudioInputId).toBe('audio1');
  });
});
```

## Common Patterns

### Pattern 1: Settings Dialog Integration

```tsx
function VoiceSettingsDialog() {
  const deviceSettings = useDeviceSettings();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <button onClick={() => setDialogOpen(true)}>
        Device Settings
      </button>
      <DeviceSettingsDialog 
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        deviceSettings={deviceSettings}
      />
    </>
  );
}
```

### Pattern 2: Live Device Switching

```tsx
function LiveDeviceSwitcher() {
  const { actions: voiceActions } = useVoiceConnection();
  const {
    audioInputDevices,
    selectedAudioInputId,
    setSelectedAudioInput
  } = useDeviceSettings();

  const handleDeviceSwitch = async (deviceId: string) => {
    setSelectedAudioInput(deviceId);
    
    // Apply immediately if in active call
    try {
      await voiceActions.switchAudioInputDevice(deviceId);
    } catch (error) {
      console.error('Live device switch failed:', error);
    }
  };

  return (
    <select 
      value={selectedAudioInputId}
      onChange={(e) => handleDeviceSwitch(e.target.value)}
    >
      {audioInputDevices.map(device => (
        <option key={device.deviceId} value={device.deviceId}>
          {device.label}
        </option>
      ))}
    </select>
  );
}
```

## Related Hooks

- **useVoiceConnection** - Uses device constraints from this hook for LiveKit integration
- **useRoom** - Room operations may use device IDs for track switching
- **useLocalStorage** - For persistent device preferences

## Troubleshooting

### Common Issues

1. **Empty device labels**
   - **Symptoms:** Device lists show generic labels like "Camera 1"
   - **Cause:** Insufficient permissions or HTTPS requirement
   - **Solution:** Ensure proper permissions and HTTPS context

2. **Device selection not persisting**
   - **Symptoms:** Selected devices reset on page reload
   - **Cause:** localStorage not saving or loading correctly
   - **Solution:** Check localStorage availability and error handling

3. **No devices enumerated**
   - **Symptoms:** All device arrays are empty
   - **Cause:** Permission denied or no devices connected
   - **Solution:** Request permissions and check device connections

### Best Practices

- **Permission timing:** Request permissions before enumerating devices
- **Error boundaries:** Wrap components using this hook in error boundaries
- **Loading states:** Show loading indicators during device enumeration
- **Fallback devices:** Always provide system default options

## Version History

- **1.0.0:** Initial implementation with basic device enumeration
- **1.1.0:** Added persistent preferences via localStorage
- **1.2.0:** Enhanced permission handling and constraint generation
- **1.3.0:** Added device change event handling and live updates

## Related Documentation

- [Voice Connection Hook](./useVoiceConnection.md)
- [Device Settings Dialog Component](../components/voice/DeviceSettingsDialog.md)
- [LiveKit Integration](../api/livekit.md)
- [Media Constraints Guide](../guides/media-constraints.md)