import React, { useRef, useEffect } from "react";
import { Room } from "livekit-client";
import { useSelector } from "react-redux";
import { RootState } from "../app/store";
import { RoomContext, RoomContextType } from "./RoomContextDef";

interface RoomProviderProps {
  children: React.ReactNode;
}

export const RoomProvider: React.FC<RoomProviderProps> = ({ children }) => {
  const roomRef = useRef<Room | null>(null);
  const isConnected = useSelector(
    (state: RootState) => state.voice.isConnected
  );

  // Clean up room when disconnected
  useEffect(() => {
    if (!isConnected && roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
  }, [isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  const setRoom = (room: Room | null) => {
    if (roomRef.current && roomRef.current !== room) {
      roomRef.current.disconnect();
    }
    roomRef.current = room;
  };

  const getRoom = () => roomRef.current;

  const value: RoomContextType = {
    room: roomRef.current,
    setRoom,
    getRoom,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};
