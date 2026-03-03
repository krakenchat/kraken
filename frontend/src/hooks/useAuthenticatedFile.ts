import { useState, useEffect } from "react";
import { useFileCache } from "../contexts/AvatarCacheContext";
import { getAccessToken } from "../utils/tokenService";
import { getApiUrl } from "../config/env";
import type { FileMetadata } from "../types/message.type";

interface FileState {
  blobUrl: string | null;
  metadata: FileMetadata | null;
  isLoadingBlob: boolean;
  isLoadingMetadata: boolean;
  error: Error | null;
}

const initialState: FileState = {
  blobUrl: null,
  metadata: null,
  isLoadingBlob: false,
  isLoadingMetadata: false,
  error: null,
};

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

  const [state, setState] = useState<FileState>(initialState);

  useEffect(() => {
    if (!fileId) {
      setState(initialState);
      return;
    }

    let isCancelled = false;

    const fetchData = async () => {
      setState(prev => ({ ...prev, error: null }));

      try {
        // Fetch blob using centralized fetchBlob (handles caching and deduplication)
        if (fetchBlob) {
          setState(prev => ({ ...prev, isLoadingBlob: true }));
          const url = await fileCache.fetchBlob(fileId);

          if (!isCancelled) {
            setState(prev => ({ ...prev, blobUrl: url, isLoadingBlob: false }));
          }
        }

        // Fetch metadata if requested
        if (fetchMetadata) {
          setState(prev => ({ ...prev, isLoadingMetadata: true }));

          const token = getAccessToken();
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
            setState(prev => ({ ...prev, metadata: metadataData, isLoadingMetadata: false }));
          }
        }
      } catch (err) {
        if (!isCancelled) {
          const error = err instanceof Error ? err : new Error("Failed to fetch file");
          setState({ ...initialState, error });
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [fileId, fetchBlob, fetchMetadata, fileCache]);

  return {
    blobUrl: state.blobUrl,
    metadata: state.metadata,
    isLoading: state.isLoadingBlob || state.isLoadingMetadata,
    isLoadingBlob: state.isLoadingBlob,
    isLoadingMetadata: state.isLoadingMetadata,
    error: state.error,
  };
};

// Backward compatibility alias - delegates to useAuthenticatedFile with cache
export const useAuthenticatedImage = (fileId: string | null | undefined) => {
  return useAuthenticatedFile(fileId, { fetchBlob: true, fetchMetadata: false });
};
