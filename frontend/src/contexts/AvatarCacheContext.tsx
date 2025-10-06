import React, { createContext, useContext, useRef, useCallback, useEffect } from "react";

interface FileCacheContextType {
  getBlob: (fileId: string) => string | null;
  setBlob: (fileId: string, blobUrl: string) => void;
  hasBlob: (fileId: string) => boolean;
  fetchBlob: (fileId: string) => Promise<string>;
}

const FileCacheContext = createContext<FileCacheContextType | null>(null);

export const useFileCache = () => {
  const context = useContext(FileCacheContext);
  if (!context) {
    throw new Error("useFileCache must be used within FileCacheProvider");
  }
  return context;
};

// Keep old name for backward compatibility
export const useAvatarCache = useFileCache;

interface FileCacheProviderProps {
  children: React.ReactNode;
}

export const FileCacheProvider: React.FC<FileCacheProviderProps> = ({ children }) => {
  // Use ref to store cache so it doesn't trigger re-renders
  const cacheRef = useRef<Map<string, string>>(new Map());
  // Track in-flight requests to prevent duplicate fetches (race condition fix)
  const pendingRef = useRef<Map<string, Promise<string>>>(new Map());

  const getBlob = useCallback((fileId: string): string | null => {
    return cacheRef.current.get(fileId) || null;
  }, []);

  const setBlob = useCallback((fileId: string, blobUrl: string) => {
    cacheRef.current.set(fileId, blobUrl);
  }, []);

  const hasBlob = useCallback((fileId: string): boolean => {
    return cacheRef.current.has(fileId);
  }, []);

  const fetchBlob = useCallback(async (fileId: string): Promise<string> => {
    // 1. Return cached blob URL if exists
    const cached = cacheRef.current.get(fileId);
    if (cached) {
      return cached;
    }

    // 2. Return in-flight promise if already fetching (prevents duplicate fetches!)
    const pending = pendingRef.current.get(fileId);
    if (pending) {
      return pending;
    }

    // 3. Start new fetch and track it
    const fetchPromise = (async () => {
      try {
        // Get auth token from localStorage
        const tokenRaw = localStorage.getItem("accessToken");
        let token: string | null = null;

        if (tokenRaw) {
          try {
            const parsed = JSON.parse(tokenRaw);
            token = parsed && typeof parsed === "object" && parsed.value
              ? parsed.value
              : parsed;
          } catch {
            token = tokenRaw;
          }
        }

        if (!token) {
          throw new Error("No authentication token found");
        }

        const response = await fetch(`/api/file/${fileId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        // Store in cache
        cacheRef.current.set(fileId, blobUrl);

        // Clean up pending tracker
        pendingRef.current.delete(fileId);

        return blobUrl;
      } catch (error) {
        // Clean up pending tracker on error
        pendingRef.current.delete(fileId);
        throw error;
      }
    })();

    // Store promise so concurrent requesters can await the same fetch
    pendingRef.current.set(fileId, fetchPromise);

    return fetchPromise;
  }, []);

  // Cleanup: Revoke all blob URLs when provider unmounts
  useEffect(() => {
    return () => {
      cacheRef.current.forEach((blobUrl) => {
        URL.revokeObjectURL(blobUrl);
      });
      cacheRef.current.clear();
      pendingRef.current.clear();
    };
  }, []);

  const value: FileCacheContextType = {
    getBlob,
    setBlob,
    hasBlob,
    fetchBlob,
  };

  return (
    <FileCacheContext.Provider value={value}>
      {children}
    </FileCacheContext.Provider>
  );
};

// Keep old name for backward compatibility
export const AvatarCacheProvider = FileCacheProvider;
