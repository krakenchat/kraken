/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from "react";
import { useReplayBuffer } from "../hooks/useReplayBuffer";

interface ReplayBufferContextType {
  isReplayBufferActive: boolean;
}

const ReplayBufferContext = createContext<ReplayBufferContextType | undefined>(
  undefined
);

export const useReplayBufferState = () => {
  const context = useContext(ReplayBufferContext);
  if (!context) {
    throw new Error(
      "useReplayBufferState must be used within a ReplayBufferProvider"
    );
  }
  return context;
};

interface ReplayBufferProviderProps {
  children: React.ReactNode;
}

export const ReplayBufferProvider: React.FC<ReplayBufferProviderProps> = ({
  children,
}) => {
  // Run the hook once here - manages LiveKit events and API calls
  const { isReplayBufferActive } = useReplayBuffer();

  return (
    <ReplayBufferContext.Provider value={{ isReplayBufferActive }}>
      {children}
    </ReplayBufferContext.Provider>
  );
};
