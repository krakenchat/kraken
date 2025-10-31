import { useState, useEffect } from "react";
import { getCachedItem } from "../utils/storage";
import { useFileCache } from "../contexts/AvatarCacheContext";
import { getApiUrl } from "../config/env";
import type { FileMetadata } from "../types/message.type";

/**
 * Hook to fetch file metadata and/or blob URL with authentication
 * Uses global cache to prevent duplicate fetches for the same fileId
 * @param fileId - The file ID to fetch
 * @param options - Optional configuration
 * @returns Object with blobUrl, metadata, loading states, and errors
 */
export const useAuthenticatedFile = (
  fileId: string | null | undefined,
  options?: {
    fetchBlob?: boolean; // Default: true
    fetchMetadata?: boolean; // Default: false
  }
) => {
  const { fetchBlob = true, fetchMetadata = false } = options || {};
  const fileCache = useFileCache();

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);
  const [isLoadingBlob, setIsLoadingBlob] = useState(false);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!fileId) {
      setBlobUrl(null);
      setMetadata(null);
      setIsLoadingBlob(false);
      setIsLoadingMetadata(false);
      setError(null);
      return;
    }

    let isCancelled = false;

    const fetchData = async () => {
      setError(null);

      try {
        // Fetch blob using centralized fetchBlob (handles caching and deduplication)
        if (fetchBlob) {
          setIsLoadingBlob(true);
          const url = await fileCache.fetchBlob(fileId);

          if (!isCancelled) {
            setBlobUrl(url);
            setIsLoadingBlob(false);
          }
        }

        // Fetch metadata if requested
        if (fetchMetadata) {
          setIsLoadingMetadata(true);

          const token = getCachedItem<string>("accessToken");
          if (!token) {
            throw new Error("No authentication token found");
          }

          const metadataResponse = await fetch(getApiUrl(`/file/${fileId}/metadata`), {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!metadataResponse.ok) {
            throw new Error(`Failed to fetch metadata: ${metadataResponse.status}`);
          }

          const metadataData = await metadataResponse.json();
          if (!isCancelled) {
            setMetadata(metadataData);
            setIsLoadingMetadata(false);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          const error = err instanceof Error ? err : new Error("Failed to fetch file");
          setError(error);
          setBlobUrl(null);
          setMetadata(null);
          setIsLoadingBlob(false);
          setIsLoadingMetadata(false);
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [fileId, fetchBlob, fetchMetadata, fileCache]);

  return {
    blobUrl,
    metadata,
    isLoading: isLoadingBlob || isLoadingMetadata,
    isLoadingBlob,
    isLoadingMetadata,
    error,
  };
};

// Backward compatibility alias - delegates to useAuthenticatedFile with cache
export const useAuthenticatedImage = (fileId: string | null | undefined) => {
  return useAuthenticatedFile(fileId, { fetchBlob: true, fetchMetadata: false });
};
