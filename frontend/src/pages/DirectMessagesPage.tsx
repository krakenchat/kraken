import React, { useState } from "react";
import { Box, Typography, useTheme, useMediaQuery } from "@mui/material";
import DirectMessageList from "../components/DirectMessages/DirectMessageList";
import DirectMessageContainer from "../components/DirectMessages/DirectMessageContainer";
import { useGetDmGroupQuery } from "../features/directMessages/directMessagesApiSlice";
import { useProfileQuery } from "../features/users/usersSlice";

const DirectMessagesPage: React.FC = () => {
  const [selectedDmGroupId, setSelectedDmGroupId] = useState<string | undefined>();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { data: currentUser } = useProfileQuery();
  
  const { data: selectedDmGroup } = useGetDmGroupQuery(selectedDmGroupId!, {
    skip: !selectedDmGroupId,
  });

  const getDmDisplayName = (dmGroup: any): string => {
    if (dmGroup?.name) return dmGroup.name;
    
    if (!dmGroup?.isGroup && dmGroup?.members?.length === 2) {
      const otherMember = dmGroup.members.find((m: any) => m.user.id !== currentUser?.id);
      return otherMember?.user.displayName || otherMember?.user.username || "Unknown User";
    }
    
    return dmGroup?.members
      ?.filter((m: any) => m.user.id !== currentUser?.id)
      ?.map((m: any) => m.user.displayName || m.user.username)
      ?.join(", ") || "Group Chat";
  };

  if (isMobile) {
    // Mobile view: Show either list or chat, not both
    return (
      <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        {selectedDmGroupId ? (
          <>
            <Box
              sx={{
                p: 2,
                borderBottom: 1,
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              <button
                onClick={() => setSelectedDmGroupId(undefined)}
                style={{ 
                  background: "none", 
                  border: "none", 
                  cursor: "pointer",
                  fontSize: "18px"
                }}
              >
                ←
              </button>
              <Typography variant="h6" noWrap>
                {getDmDisplayName(selectedDmGroup)}
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <DirectMessageContainer dmGroupId={selectedDmGroupId} />
            </Box>
          </>
        ) : (
          <DirectMessageList
            selectedDmGroupId={selectedDmGroupId}
            onSelectDmGroup={setSelectedDmGroupId}
          />
        )}
      </Box>
    );
  }

  // Desktop view: Split pane layout
  return (
    <Box sx={{ height: "100vh", display: "flex" }}>
      {/* Left panel - DM list */}
      <Box
        sx={{
          width: 320,
          borderRight: 1,
          borderColor: "divider",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <DirectMessageList
          selectedDmGroupId={selectedDmGroupId}
          onSelectDmGroup={setSelectedDmGroupId}
        />
      </Box>

      {/* Right panel - Chat area */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {selectedDmGroupId ? (
          <>
            <Box
              sx={{
                p: 2,
                borderBottom: 1,
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              <Typography variant="h6">
                {getDmDisplayName(selectedDmGroup)}
              </Typography>
              {selectedDmGroup?.members && (
                <Typography variant="body2" color="text.secondary">
                  {selectedDmGroup.members.length} member{selectedDmGroup.members.length !== 1 ? 's' : ''}
                </Typography>
              )}
            </Box>
            <Box sx={{ flex: 1 }}>
              <DirectMessageContainer dmGroupId={selectedDmGroupId} />
            </Box>
          </>
        ) : (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <Typography variant="h5" color="text.secondary">
              Select a conversation
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Choose from your existing conversations or start a new one
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default DirectMessagesPage;