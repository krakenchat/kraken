import { useState, useEffect } from "react";
import { useFileCache } from "../contexts/AvatarCacheContext";

/**
 * Hook to fetch an image with authentication and convert to blob URL
 * Uses centralized fetchBlob to prevent race conditions and duplicate fetches
 * @param fileId - The file ID to fetch
 * @returns Object with blobUrl, loading state, and error
 */
export const useAuthenticatedImage = (fileId: string | null | undefined) => {
  const fileCache = useFileCache();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!fileId) {
      setBlobUrl(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isCancelled = false;

    const loadBlob = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Use centralized fetchBlob - handles caching and deduplication
        const url = await fileCache.fetchBlob(fileId);

        if (!isCancelled) {
          setBlobUrl(url);
        }
      } catch (err) {
        if (!isCancelled) {
          const error = err instanceof Error ? err : new Error("Failed to fetch image");
          setError(error);
          setBlobUrl(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadBlob();

    return () => {
      isCancelled = true;
    };
  }, [fileId, fileCache]);

  return { blobUrl, isLoading, error };
};
