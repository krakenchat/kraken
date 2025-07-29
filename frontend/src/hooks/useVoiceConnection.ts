import { useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "../app/store";
import { useSocket } from "./useSocket";
import { useRoom } from "./useRoom";
import { useVoiceEvents } from "./useVoiceEvents";
import { useProfileQuery } from "../features/users/usersSlice";
import { useGetConnectionInfoQuery } from "../features/livekit/livekitApiSlice";
import { setShowVideoTiles } from "../features/voice/voiceSlice";
import {
  joinVoiceChannel,
  leaveVoiceChannel,
  toggleAudio,
  toggleVideo,
  toggleScreenShare,
  toggleMute,
  toggleDeafen,
} from "../features/voice/voiceThunks";

export const useVoiceConnection = () => {
  const dispatch = useDispatch<AppDispatch>();
  const socket = useSocket();
  const voiceState = useSelector((state: RootState) => state.voice);
  const { room, setRoom, getRoom } = useRoom();
  const { data: user } = useProfileQuery();
  const { data: connectionInfo } = useGetConnectionInfoQuery();

  // Set up voice event listeners
  useVoiceEvents();

  const handleJoinVoiceChannel = useCallback(
    async (
      channelId: string,
      channelName: string,
      communityId: string,
      isPrivate: boolean,
      createdAt: string
    ) => {
      if (!user || !connectionInfo) {
        throw new Error("User or connection info not available");
      }

      await dispatch(
        joinVoiceChannel({
          channelId,
          channelName,
          communityId,
          isPrivate,
          createdAt,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName ?? undefined,
          },
          connectionInfo,
          socket: socket ?? undefined,
          setRoom,
        })
      ).unwrap();
    },
    [dispatch, user, connectionInfo, socket, setRoom]
  );

  const handleLeaveVoiceChannel = useCallback(async () => {
    await dispatch(
      leaveVoiceChannel({ socket: socket ?? undefined, getRoom, setRoom })
    ).unwrap();
  }, [dispatch, socket, getRoom, setRoom]);

  const handleToggleAudio = useCallback(async () => {
    await dispatch(toggleAudio({ getRoom })).unwrap();
  }, [dispatch, getRoom]);

  const handleToggleVideo = useCallback(async () => {
    await dispatch(toggleVideo({ getRoom })).unwrap();
  }, [dispatch, getRoom]);

  const handleToggleScreenShare = useCallback(async () => {
    await dispatch(toggleScreenShare({ getRoom })).unwrap();
  }, [dispatch, getRoom]);

  const handleToggleMute = useCallback(async () => {
    await dispatch(toggleMute()).unwrap();
  }, [dispatch]);

  const handleToggleDeafen = useCallback(async () => {
    await dispatch(toggleDeafen()).unwrap();
  }, [dispatch]);

  const handleSetShowVideoTiles = useCallback(
    (show: boolean) => {
      dispatch(setShowVideoTiles(show));
    },
    [dispatch]
  );

  return {
    state: { ...voiceState, room },
    actions: {
      joinVoiceChannel: handleJoinVoiceChannel,
      leaveVoiceChannel: handleLeaveVoiceChannel,
      toggleAudio: handleToggleAudio,
      toggleVideo: handleToggleVideo,
      toggleScreenShare: handleToggleScreenShare,
      toggleMute: handleToggleMute,
      toggleDeafen: handleToggleDeafen,
      setShowVideoTiles: handleSetShowVideoTiles,
    },
  };
};
