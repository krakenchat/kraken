/**
 * Converts a file ID to the API URL for file retrieval
 * @param fileId - The file ID from the database
 * @returns The full API path to retrieve the file, or null if no fileId
 */
export function getFileUrl(fileId: string | null | undefined): string | null {
  if (!fileId) return null;
  return `/api/file/${fileId}`;
}
