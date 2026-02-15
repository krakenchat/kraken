import React, { createContext, useContext, useState, useCallback } from 'react';

interface VideoOverlayContextValue {
  containerElement: HTMLDivElement | null;
  setDefaultContainer: (el: HTMLDivElement | null) => void;
  setPageContainer: (el: HTMLDivElement | null) => void;
}

const noopContext: VideoOverlayContextValue = {
  containerElement: null,
  setDefaultContainer: () => {},
  setPageContainer: () => {},
};

const VideoOverlayContext = createContext<VideoOverlayContextValue | null>(null);

export const VideoOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [defaultContainer, setDefaultContainer] = useState<HTMLDivElement | null>(null);
  const [pageContainer, setPageContainer] = useState<HTMLDivElement | null>(null);

  const handleSetDefaultContainer = useCallback((el: HTMLDivElement | null) => {
    setDefaultContainer(el);
  }, []);

  const handleSetPageContainer = useCallback((el: HTMLDivElement | null) => {
    setPageContainer(el);
  }, []);

  const containerElement = pageContainer || defaultContainer;

  return (
    <VideoOverlayContext.Provider value={{
      containerElement,
      setDefaultContainer: handleSetDefaultContainer,
      setPageContainer: handleSetPageContainer,
    }}>
      {children}
    </VideoOverlayContext.Provider>
  );
};

export function useVideoOverlay(): VideoOverlayContextValue {
  const ctx = useContext(VideoOverlayContext);
  if (!ctx) return noopContext;
  return ctx;
}
