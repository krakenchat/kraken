import React, { createContext, useContext, useState, useCallback } from "react";

interface ThreadPanelState {
  openThreadId: string | null;
  openThread: (id: string) => void;
  closeThread: () => void;
}

const ThreadPanelContext = createContext<ThreadPanelState | null>(null);

export const ThreadPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);

  const openThread = useCallback((id: string) => {
    setOpenThreadId(id);
  }, []);

  const closeThread = useCallback(() => {
    setOpenThreadId(null);
  }, []);

  return (
    <ThreadPanelContext.Provider value={{ openThreadId, openThread, closeThread }}>
      {children}
    </ThreadPanelContext.Provider>
  );
};

export function useThreadPanel(): ThreadPanelState {
  const context = useContext(ThreadPanelContext);
  if (!context) {
    throw new Error("useThreadPanel must be used within a ThreadPanelProvider");
  }
  return context;
}
