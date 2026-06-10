import { Track } from 'livekit-client';
import { VOLUME_STORAGE_PREFIX, SCREENSHARE_VOLUME_STORAGE_PREFIX } from '../../constants/voice';

/**
 * Reads the stored per-user volume for an audio source as a percent (0-200).
 * Returns null when unset or invalid. Values are stored as 0-2.0 floats under
 * a per-source localStorage prefix (mic vs screen share audio).
 */
export function getStoredVolumePercent(
  identity: string,
  source: Track.Source | string,
): number | null {
  const prefix =
    source === Track.Source.ScreenShareAudio
      ? SCREENSHARE_VOLUME_STORAGE_PREFIX
      : VOLUME_STORAGE_PREFIX;
  try {
    const raw = localStorage.getItem(`${prefix}${identity}`);
    if (raw === null) return null;
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed)) return null;
    return Math.round(Math.min(Math.max(parsed, 0), 2) * 100);
  } catch {
    // localStorage may throw in sandboxed/private environments
    return null;
  }
}
