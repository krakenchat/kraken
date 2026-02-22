import { describe, it, expect } from 'vitest';
import {
  getResolutionConfig,
  getScreenShareAudioConfig,
} from '../../utils/screenShareResolution';

describe('getResolutionConfig', () => {
  it('returns correct dimensions for 4k preset', () => {
    const config = getResolutionConfig('4k');
    expect(config.width).toBe(3840);
    expect(config.height).toBe(2160);
  });

  it('returns correct dimensions for 1440p preset', () => {
    const config = getResolutionConfig('1440p');
    expect(config.width).toBe(2560);
    expect(config.height).toBe(1440);
  });

  it('returns correct dimensions for 1080p preset', () => {
    const config = getResolutionConfig('1080p');
    expect(config.width).toBe(1920);
    expect(config.height).toBe(1080);
  });

  it('returns correct dimensions for 720p preset', () => {
    const config = getResolutionConfig('720p');
    expect(config.width).toBe(1280);
    expect(config.height).toBe(720);
  });

  it('returns correct dimensions for 480p preset', () => {
    const config = getResolutionConfig('480p');
    expect(config.width).toBe(854);
    expect(config.height).toBe(480);
  });

  it('omits width and height for "native" preset', () => {
    const config = getResolutionConfig('native');
    expect(config.width).toBeUndefined();
    expect(config.height).toBeUndefined();
  });

  it('defaults frame rate to 30', () => {
    const config = getResolutionConfig('1080p');
    expect(config.frameRate).toBe(30);
  });

  it('uses the provided FPS value', () => {
    const config = getResolutionConfig('1080p', 60);
    expect(config.frameRate).toBe(60);
  });

  it('falls back to 30 FPS when fps is 0 (falsy)', () => {
    const config = getResolutionConfig('1080p', 0);
    expect(config.frameRate).toBe(30);
  });

  it('handles an unknown resolution string gracefully (no dimensions)', () => {
    const config = getResolutionConfig('unknown');
    expect(config.width).toBeUndefined();
    expect(config.height).toBeUndefined();
    expect(config.frameRate).toBe(30);
  });

  it('handles an empty string gracefully (treated like native)', () => {
    const config = getResolutionConfig('');
    expect(config.width).toBeUndefined();
    expect(config.height).toBeUndefined();
  });
});

describe('getScreenShareAudioConfig', () => {
  it('returns false when audio is disabled', () => {
    expect(getScreenShareAudioConfig(false)).toBe(false);
  });

  it('returns audio constraints when audio is enabled', () => {
    const config = getScreenShareAudioConfig(true);
    expect(config).not.toBe(false);
    expect(config).toMatchObject({
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false,
    });
  });

  it('requests 48kHz stereo audio when enabled', () => {
    const config = getScreenShareAudioConfig(true) as MediaTrackConstraints;
    expect(config.sampleRate).toBe(48000);
    expect(config.channelCount).toBe(2);
  });
});
