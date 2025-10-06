import { useState, useEffect } from "react";
import { getCachedItem } from "../utils/storage";
import type { FileMetadata } from "../types/message.type";

/**
 * Hook to fetch file metadata and/or blob URL with authentication
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
        const token = getCachedItem<string>("accessToken");
        if (!token) {
          throw new Error("No authentication token found");
        }

        // Fetch metadata if requested
        if (fetchMetadata) {
          setIsLoadingMetadata(true);
          const metadataResponse = await fetch(`/api/file/${fileId}/metadata`, {
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
          }
        }

        // Fetch blob if requested
        if (fetchBlob) {
          setIsLoadingBlob(true);
          const blobResponse = await fetch(`/api/file/${fileId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!blobResponse.ok) {
            throw new Error(`Failed to fetch file: ${blobResponse.status}`);
          }

          const blob = await blobResponse.blob();

          if (!isCancelled) {
            const url = URL.createObjectURL(blob);
            setBlobUrl(url);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          const error = err instanceof Error ? err : new Error("Failed to fetch file");
          setError(error);
          setBlobUrl(null);
          setMetadata(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingBlob(false);
          setIsLoadingMetadata(false);
        }
      }
    };

    fetchData();

    return () => {
      isCancelled = true;
      // Clean up blob URL if it was created
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [fileId, fetchBlob, fetchMetadata]);

  return {
    blobUrl,
    metadata,
    isLoading: isLoadingBlob || isLoadingMetadata,
    isLoadingBlob,
    isLoadingMetadata,
    error,
  };
};

// Backward compatibility alias
export const useAuthenticatedImage = (fileId: string | null | undefined) => {
  return useAuthenticatedFile(fileId, { fetchBlob: true, fetchMetadata: false });
};
