import { useState, useEffect } from "react";
import { getCachedItem } from "../utils/storage";

/**
 * Hook to fetch an image with authentication and convert to blob URL
 * @param fileId - The file ID to fetch
 * @returns Object with blobUrl, loading state, and error
 */
export const useAuthenticatedImage = (fileId: string | null | undefined) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Clean up previous blob URL
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  useEffect(() => {
    if (!fileId) {
      setBlobUrl(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isCancelled = false;

    const fetchImage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const token = getCachedItem<string>("accessToken");
        if (!token) {
          throw new Error("No authentication token found");
        }

        const response = await fetch(`/api/file/${fileId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const blob = await response.blob();

        if (!isCancelled) {
          // Revoke old blob URL before setting new one
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
          }
          const url = URL.createObjectURL(blob);
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

    fetchImage();

    return () => {
      isCancelled = true;
    };
  }, [fileId]); // Only depend on fileId, not blobUrl

  return { blobUrl, isLoading, error };
};
