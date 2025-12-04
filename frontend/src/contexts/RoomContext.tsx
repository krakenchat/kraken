import React, { useRef, useEffect } from "react";
import { Room } from "livekit-client";
import { useSelector } from "react-redux";
import { RootState } from "../app/store";
import { RoomContext, RoomContextType } from "./RoomContextDef";
import { getApiBaseUrl } from "../config/env";
import { getCachedItem } from "../utils/storage";

interface RoomProviderProps {
  children: React.ReactNode;
}

export const RoomProvider: React.FC<RoomProviderProps> = ({ children }) => {
  const roomRef = useRef<Room | null>(null);
  const isConnected = useSelector(
    (state: RootState) => state.voice.isConnected
  );
  const currentChannelId = useSelector(
    (state: RootState) => state.voice.currentChannelId
  );
  const currentDmGroupId = useSelector(
    (state: RootState) => state.voice.currentDmGroupId
  );

  // Use refs to access current values in beforeunload handler without re-registering
  const channelIdRef = useRef(currentChannelId);
  const dmGroupIdRef = useRef(currentDmGroupId);
  const roomRefForUnload = useRef(roomRef.current);

  // Keep refs in sync with state
  useEffect(() => {
    channelIdRef.current = currentChannelId;
  }, [currentChannelId]);

  useEffect(() => {
    dmGroupIdRef.current = currentDmGroupId;
  }, [currentDmGroupId]);

  useEffect(() => {
    roomRefForUnload.current = roomRef.current;
  });

  // Handle page unload - notify backend before disconnect
  useEffect(() => {
    const handleBeforeUnload = () => {
      const token = getCachedItem<string>("accessToken");
      const baseUrl = getApiBaseUrl();
      const channelId = channelIdRef.current;
      const dmGroupId = dmGroupIdRef.current;

      // Use fetch with keepalive to ensure request completes during page unload
      if (channelId) {
        fetch(`${baseUrl}/channels/${channelId}/voice-presence/leave`, {
          method: "DELETE",
          keepalive: true,
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }).catch(() => {
          // Ignore errors during unload - best effort
        });
      }

      if (dmGroupId) {
        fetch(`${baseUrl}/dm-groups/${dmGroupId}/voice-presence/leave`, {
          method: "DELETE",
          keepalive: true,
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }).catch(() => {
          // Ignore errors during unload - best effort
        });
      }

      // Also disconnect LiveKit room immediately
      if (roomRefForUnload.current) {
        roomRefForUnload.current.disconnect();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

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
