/**
 * Re-export useAuthenticatedImage from useAuthenticatedFile for convenience.
 *
 * This hook fetches an image with authentication and converts it to a blob URL.
 * It uses the centralized file cache to prevent duplicate fetches.
 *
 * @param fileId - The file ID to fetch
 * @returns Object with blobUrl, loading state, and error
 */
export { useAuthenticatedImage } from "./useAuthenticatedFile";
