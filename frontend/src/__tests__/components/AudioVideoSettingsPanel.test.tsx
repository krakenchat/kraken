import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';

// --- Mock hooks ---
const mockDeviceSettings = {
  audioInputDevices: [{ deviceId: 'mic-1', label: 'Test Mic', kind: 'audioinput' as const, groupId: '', toJSON: vi.fn() }],
  audioOutputDevices: [{ deviceId: 'spk-1', label: 'Test Speaker', kind: 'audiooutput' as const, groupId: '', toJSON: vi.fn() }],
  videoInputDevices: [{ deviceId: 'cam-1', label: 'Test Camera', kind: 'videoinput' as const, groupId: '', toJSON: vi.fn() }],
  selectedAudioInputId: 'mic-1',
  selectedAudioOutputId: 'spk-1',
  selectedVideoInputId: 'cam-1',
  setSelectedAudioInput: vi.fn(),
  setSelectedAudioOutput: vi.fn(),
  setSelectedVideoInput: vi.fn(),
  isLoading: false,
  permissions: { microphone: true, camera: true },
  requestPermissions: vi.fn(),
  enumerateDevices: vi.fn(),
  getAudioConstraints: vi.fn(() => true),
  getVideoConstraints: vi.fn(() => true),
};

vi.mock('../../hooks/useDeviceSettings', () => ({
  useDeviceSettings: () => mockDeviceSettings,
}));

let mockTestingAudio = false;
let mockAudioLevel = 0;
let mockRawAudioLevel = 0;

vi.mock('../../hooks/useDeviceTest', () => ({
  useDeviceTest: () => ({
    testingAudio: mockTestingAudio,
    testingVideo: false,
    audioLevel: mockAudioLevel,
    rawAudioLevel: mockRawAudioLevel,
    testAudioInput: vi.fn(),
    testVideoInput: vi.fn(),
    stopAudioTest: vi.fn(),
    stopVideoTest: vi.fn(),
  }),
  getDeviceLabel: (device: { label: string }) => device.label || 'Unknown',
}));

let mockInputMode = 'voice_activity';
let mockThreshold = 25;

vi.mock('../../hooks/useVoiceSettings', () => ({
  useVoiceSettings: () => ({
    inputMode: mockInputMode,
    pushToTalkKeyDisplay: '`',
    voiceActivityThreshold: mockThreshold,
    setInputMode: vi.fn(),
    setPushToTalkKey: vi.fn(),
    setVoiceActivityThreshold: vi.fn(),
  }),
  VoiceInputMode: {},
}));

import AudioVideoSettingsPanel from '../../components/Settings/AudioVideoSettingsPanel';

describe('AudioVideoSettingsPanel — threshold preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTestingAudio = false;
    mockAudioLevel = 0;
    mockRawAudioLevel = 0;
    mockInputMode = 'voice_activity';
    mockThreshold = 25;
  });

  it('shows threshold marker when testing audio in voice activity mode', () => {
    mockTestingAudio = true;
    mockAudioLevel = 60;
    mockRawAudioLevel = 30;

    renderWithProviders(<AudioVideoSettingsPanel />);

    const marker = screen.getByTestId('threshold-marker');
    expect(marker).toBeInTheDocument();
  });

  it('shows "Transmitting" when raw audio is above threshold', () => {
    mockTestingAudio = true;
    mockAudioLevel = 60;
    mockRawAudioLevel = 30; // Above threshold of 25

    renderWithProviders(<AudioVideoSettingsPanel />);

    expect(screen.getByText('Transmitting')).toBeInTheDocument();
  });

  it('shows "Gated" when raw audio is below threshold', () => {
    mockTestingAudio = true;
    mockAudioLevel = 20;
    mockRawAudioLevel = 10; // Below threshold of 25

    renderWithProviders(<AudioVideoSettingsPanel />);

    expect(screen.getByText('Gated')).toBeInTheDocument();
  });

  it('does NOT show threshold marker in push_to_talk mode', () => {
    mockTestingAudio = true;
    mockAudioLevel = 60;
    mockRawAudioLevel = 30;
    mockInputMode = 'push_to_talk';

    renderWithProviders(<AudioVideoSettingsPanel />);

    expect(screen.queryByTestId('threshold-marker')).not.toBeInTheDocument();
  });

  it('shows percentage level in PTT mode instead of Transmitting/Gated', () => {
    mockTestingAudio = true;
    mockAudioLevel = 60;
    mockRawAudioLevel = 30;
    mockInputMode = 'push_to_talk';

    renderWithProviders(<AudioVideoSettingsPanel />);

    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.queryByText('Transmitting')).not.toBeInTheDocument();
    expect(screen.queryByText('Gated')).not.toBeInTheDocument();
  });

  it('does NOT show threshold marker when audio test is not running', () => {
    mockTestingAudio = false;

    renderWithProviders(<AudioVideoSettingsPanel />);

    expect(screen.queryByTestId('threshold-marker')).not.toBeInTheDocument();
  });

  it('shows helper text about the threshold marker', () => {
    mockTestingAudio = true;
    mockAudioLevel = 60;
    mockRawAudioLevel = 30;

    renderWithProviders(<AudioVideoSettingsPanel />);

    expect(screen.getByText(/marker shows your sensitivity threshold/i)).toBeInTheDocument();
  });
});
