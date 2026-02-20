/**
 * Screen Share Resolution Utilities
 *
 * Provides resolution presets for screen sharing across different quality levels.
 * Used by voice thunks to configure LiveKit screen share resolution.
 */

export interface ResolutionConfig {
  width?: number;
  height?: number;
  frameRate: number;
}

export type ResolutionPreset = 'native' | '4k' | '1440p' | '1080p' | '720p' | '480p';

/**
 * Resolution preset mappings
 */
const RESOLUTION_MAP: Record<string, { width: number; height: number }> = {
  '4k': { width: 3840, height: 2160 },
  '1440p': { width: 2560, height: 1440 },
  '1080p': { width: 1920, height: 1080 },
  '720p': { width: 1280, height: 720 },
  '480p': { width: 854, height: 480 },
};

/**
 * Get resolution configuration from preset and FPS
 *
 * @param resolution - Resolution preset ('native', '4k', '1440p', '1080p', '720p', '480p')
 * @param fps - Frame rate (default: 30)
 * @returns Resolution configuration for LiveKit
 */
export function getResolutionConfig(
  resolution: string,
  fps: number = 30
): ResolutionConfig {
  const config: ResolutionConfig = {
    frameRate: fps || 30,
  };

  // Skip width/height for 'native' - let browser use source resolution
  if (resolution && resolution !== 'native') {
    const res = RESOLUTION_MAP[resolution];
    if (res) {
      config.width = res.width;
      config.height = res.height;
    }
  }

  return config;
}

/**
 * Get audio configuration for screen sharing
 *
 * @param enableAudio - Whether to capture system/tab audio
 * @returns Audio configuration for LiveKit or false to disable
 */
export function getScreenShareAudioConfig(enableAudio: boolean) {
  if (!enableAudio) {
    return false;
  }

  return {
    autoGainControl: false,
    echoCancellation: false,
    noiseSuppression: false,
    sampleRate: 48000,
    channelCount: 2,
    restrictOwnAudio: true,
  } as MediaTrackConstraints;
}
