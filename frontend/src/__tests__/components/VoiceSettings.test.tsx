import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  switchAudioInputDevice: vi.fn(),
  switchAudioOutputDevice: vi.fn(),
  switchVideoInputDevice: vi.fn(),
  loggerError: vi.fn(),
  capturedOnDeviceChange: undefined as
    | ((type: 'audio' | 'video' | 'audioOutput', deviceId: string) => void | Promise<void>)
    | undefined,
}));

vi.mock('../../hooks/useVoiceConnection', () => ({
  useVoiceConnection: () => ({
    state: {},
    actions: {
      switchAudioInputDevice: mocks.switchAudioInputDevice,
      switchAudioOutputDevice: mocks.switchAudioOutputDevice,
      switchVideoInputDevice: mocks.switchVideoInputDevice,
    },
  }),
}));

// Stub panel so we can capture the onDeviceChange prop and call it directly.
vi.mock('../../components/Settings/AudioVideoSettingsPanel', () => ({
  default: (props: {
    onDeviceChange?: (type: 'audio' | 'video' | 'audioOutput', deviceId: string) => void | Promise<void>;
  }) => {
    mocks.capturedOnDeviceChange = props.onDeviceChange;
    return <div data-testid="audio-video-panel" />;
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    error: mocks.loggerError,
    info: vi.fn(),
    warn: vi.fn(),
    dev: vi.fn(),
  },
}));

import VoiceSettings from '../../components/Settings/VoiceSettings';

describe('VoiceSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.capturedOnDeviceChange = undefined;
  });

  it('passes an onDeviceChange callback to AudioVideoSettingsPanel', () => {
    render(<VoiceSettings />);
    expect(mocks.capturedOnDeviceChange).toBeInstanceOf(Function);
  });

  it('routes audio input device changes to switchAudioInputDevice', async () => {
    render(<VoiceSettings />);
    await mocks.capturedOnDeviceChange!('audio', 'mic-new');
    expect(mocks.switchAudioInputDevice).toHaveBeenCalledWith('mic-new');
    expect(mocks.switchAudioOutputDevice).not.toHaveBeenCalled();
    expect(mocks.switchVideoInputDevice).not.toHaveBeenCalled();
  });

  it('routes audio output device changes to switchAudioOutputDevice', async () => {
    render(<VoiceSettings />);
    await mocks.capturedOnDeviceChange!('audioOutput', 'spk-new');
    expect(mocks.switchAudioOutputDevice).toHaveBeenCalledWith('spk-new');
    expect(mocks.switchAudioInputDevice).not.toHaveBeenCalled();
    expect(mocks.switchVideoInputDevice).not.toHaveBeenCalled();
  });

  it('routes video input device changes to switchVideoInputDevice', async () => {
    render(<VoiceSettings />);
    await mocks.capturedOnDeviceChange!('video', 'cam-new');
    expect(mocks.switchVideoInputDevice).toHaveBeenCalledWith('cam-new');
    expect(mocks.switchAudioInputDevice).not.toHaveBeenCalled();
    expect(mocks.switchAudioOutputDevice).not.toHaveBeenCalled();
  });

  it('logs and swallows errors from the underlying action', async () => {
    mocks.switchAudioInputDevice.mockRejectedValueOnce(new Error('boom'));
    render(<VoiceSettings />);
    await expect(mocks.capturedOnDeviceChange!('audio', 'mic-bad')).resolves.toBeUndefined();
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to switch audio device'),
      expect.any(Error)
    );
  });
});
