import { getAccessToken } from './tokenService';
import { getApiUrl } from '../config/env';

/**
 * Build an authenticated streaming URL for a file.
 * The browser's <video>/<audio> element can use this URL directly
 * and will send Range requests for efficient streaming.
 */
export const getStreamUrl = (fileId: string): string => {
  const token = getAccessToken();
  const baseUrl = getApiUrl(`/file/${fileId}`);
  if (!token) return baseUrl;
  return `${baseUrl}?token=${encodeURIComponent(token)}`;
};
