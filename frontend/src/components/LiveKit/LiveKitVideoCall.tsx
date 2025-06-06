import React, { useEffect, useState } from "react";
import { 
  LiveKitRoom, 
  VideoConference, 
  RoomAudioRenderer,
  ConnectionStateToast,
} from "@livekit/components-react";
import { Room } from "livekit-client";
import { Box, Typography, CircularProgress, Alert } from "@mui/material";
import { useGenerateTokenMutation, useGetConnectionInfoQuery } from "../../features/livekit/livekitApiSlice";
import { useProfileQuery } from "../../features/users/usersSlice";

interface LiveKitVideoCallProps {
  channelId: string;
  channelName: string;
}

const LiveKitVideoCall: React.FC<LiveKitVideoCallProps> = ({ 
  channelId, 
  channelName 
}) => {
  const [token, setToken] = useState<string>("");
  const [room] = useState(() => new Room());
  
  // Get user info
  const { data: user } = useProfileQuery();
  
  // Get connection info
  const { data: connectionInfo, error: connectionError } = useGetConnectionInfoQuery();
  
  // Token generation mutation
  const [generateToken, { isLoading: isGeneratingToken, error: tokenError }] = useGenerateTokenMutation();

  // Generate token when component mounts
  useEffect(() => {
    const getToken = async () => {
      if (!user?.id || !channelId) return;
      
      try {
        const response = await generateToken({
          roomId: channelId,
          identity: user.id,
          name: user.displayName || user.username,
        }).unwrap();
        
        setToken(response.token);
      } catch (error) {
        console.error("Failed to generate LiveKit token:", error);
      }
    };

    getToken();
  }, [user, channelId, generateToken]);

  // Show loading state
  if (isGeneratingToken || !connectionInfo || !token) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Connecting to voice channel...
        </Typography>
      </Box>
    );
  }

  // Show error state
  if (connectionError || tokenError) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 2,
          p: 3,
        }}
      >
        <Alert severity="error" sx={{ width: "100%", maxWidth: 400 }}>
          <Typography variant="h6" gutterBottom>
            Failed to connect to voice channel
          </Typography>
          <Typography variant="body2">
            {connectionError ? "Could not get connection information" : "Could not generate access token"}
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Channel Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: "divider",
          backgroundColor: "background.paper",
        }}
      >
        <Typography variant="h6" component="h2">
          🔊 {channelName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Voice Channel
        </Typography>
      </Box>

      {/* LiveKit Room */}
      <Box sx={{ flex: 1, position: "relative" }}>
        <LiveKitRoom
          video={true}
          audio={true}
          token={token}
          serverUrl={connectionInfo.url}
          style={{ height: "100%", width: "100%" }}
          room={room}
          // Connect automatically when token is available
          connect={true}
        >
          {/* Video Conference UI */}
          <VideoConference 
            style={{ height: "100%" }}
          />
          
          {/* Audio renderer for participants not on video */}
          <RoomAudioRenderer />
          
          {/* Connection state toast for user feedback */}
          <ConnectionStateToast />
        </LiveKitRoom>
      </Box>
    </Box>
  );
};

export default LiveKitVideoCall;
