import React, { createContext, useContext, useRef, useCallback } from 'react';

interface VideoOverlayContextValue {
  containerRef: React.RefObject<HTMLDivElement | null>;
  setContainerElement: (el: HTMLDivElement | null) => void;
}

const VideoOverlayContext = createContext<VideoOverlayContextValue | null>(null);

export const VideoOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const setContainerElement = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
  }, []);

  return (
    <VideoOverlayContext.Provider value={{ containerRef, setContainerElement }}>
      {children}
    </VideoOverlayContext.Provider>
  );
};

export function useVideoOverlay(): VideoOverlayContextValue {
  const ctx = useContext(VideoOverlayContext);
  if (!ctx) throw new Error('useVideoOverlay must be used within a VideoOverlayProvider');
  return ctx;
}
