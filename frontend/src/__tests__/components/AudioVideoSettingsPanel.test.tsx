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
let mockEchoCancellation = true;
let mockNoiseSuppression = true;
let mockAutoGainControl = true;
let mockVoiceIsolation = false;
const mockSetAudioProcessing = vi.fn();

vi.mock('../../hooks/useVoiceSettings', () => ({
  useVoiceSettings: () => ({
    inputMode: mockInputMode,
    pushToTalkKeyDisplay: '`',
    voiceActivityThreshold: mockThreshold,
    echoCancellation: mockEchoCancellation,
    noiseSuppression: mockNoiseSuppression,
    autoGainControl: mockAutoGainControl,
    voiceIsolation: mockVoiceIsolation,
    setInputMode: vi.fn(),
    setPushToTalkKey: vi.fn(),
    setVoiceActivityThreshold: vi.fn(),
    setAudioProcessing: mockSetAudioProcessing,
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
    mockEchoCancellation = true;
    mockNoiseSuppression = true;
    mockAutoGainControl = true;
    mockVoiceIsolation = false;
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

describe('AudioVideoSettingsPanel — audio processing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTestingAudio = false;
    mockAudioLevel = 0;
    mockRawAudioLevel = 0;
    mockInputMode = 'voice_activity';
    mockThreshold = 25;
    mockEchoCancellation = true;
    mockNoiseSuppression = true;
    mockAutoGainControl = true;
    mockVoiceIsolation = false;
  });

  it('renders all 4 audio processing switches', () => {
    renderWithProviders(<AudioVideoSettingsPanel />);

    expect(screen.getByText('Echo Cancellation')).toBeInTheDocument();
    expect(screen.getByText('Noise Suppression')).toBeInTheDocument();
    expect(screen.getByText('Auto Gain Control')).toBeInTheDocument();
    expect(screen.getByText('Voice Isolation')).toBeInTheDocument();
  });

  it('renders the Audio Processing heading', () => {
    renderWithProviders(<AudioVideoSettingsPanel />);

    expect(screen.getByText('Audio Processing')).toBeInTheDocument();
  });

  it('renders the Experimental chip on Voice Isolation', () => {
    renderWithProviders(<AudioVideoSettingsPanel />);

    expect(screen.getByText('Experimental')).toBeInTheDocument();
  });

  it('shows the info note about changes taking effect on next join', () => {
    renderWithProviders(<AudioVideoSettingsPanel />);

    expect(screen.getByText(/changes take effect the next time you join a voice channel/i)).toBeInTheDocument();
  });

  it('renders switches with correct default states', () => {
    renderWithProviders(<AudioVideoSettingsPanel />);

    const echoSwitch = screen.getByText('Echo Cancellation').closest('label')?.querySelector('input');
    const noiseSwitch = screen.getByText('Noise Suppression').closest('label')?.querySelector('input');
    const agcSwitch = screen.getByText('Auto Gain Control').closest('label')?.querySelector('input');
    const voiceIsoSwitch = screen.getByText('Voice Isolation').closest('label')?.querySelector('input');

    expect(echoSwitch).toBeChecked();
    expect(noiseSwitch).toBeChecked();
    expect(agcSwitch).toBeChecked();
    expect(voiceIsoSwitch).not.toBeChecked();
  });

  it('calls setAudioProcessing when toggling Echo Cancellation', async () => {
    const { user } = renderWithProviders(<AudioVideoSettingsPanel />);

    const echoSwitch = screen.getByText('Echo Cancellation').closest('label')?.querySelector('input');
    await user.click(echoSwitch!);

    expect(mockSetAudioProcessing).toHaveBeenCalledWith('echoCancellation', false);
  });

  it('calls setAudioProcessing when toggling Noise Suppression', async () => {
    const { user } = renderWithProviders(<AudioVideoSettingsPanel />);

    const noiseSwitch = screen.getByText('Noise Suppression').closest('label')?.querySelector('input');
    await user.click(noiseSwitch!);

    expect(mockSetAudioProcessing).toHaveBeenCalledWith('noiseSuppression', false);
  });

  it('calls setAudioProcessing when toggling Auto Gain Control', async () => {
    const { user } = renderWithProviders(<AudioVideoSettingsPanel />);

    const agcSwitch = screen.getByText('Auto Gain Control').closest('label')?.querySelector('input');
    await user.click(agcSwitch!);

    expect(mockSetAudioProcessing).toHaveBeenCalledWith('autoGainControl', false);
  });

  it('calls setAudioProcessing when enabling Voice Isolation', async () => {
    const { user } = renderWithProviders(<AudioVideoSettingsPanel />);

    const voiceIsoSwitch = screen.getByText('Voice Isolation').closest('label')?.querySelector('input');
    await user.click(voiceIsoSwitch!);

    expect(mockSetAudioProcessing).toHaveBeenCalledWith('voiceIsolation', true);
  });

  it('reflects disabled state when echoCancellation is off', () => {
    mockEchoCancellation = false;

    renderWithProviders(<AudioVideoSettingsPanel />);

    const echoSwitch = screen.getByText('Echo Cancellation').closest('label')?.querySelector('input');
    expect(echoSwitch).not.toBeChecked();
  });
});
