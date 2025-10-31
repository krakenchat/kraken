import React, { useState } from "react";
import { Box, Typography, useTheme, useMediaQuery, Paper, IconButton } from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import DirectMessageList from "../components/DirectMessages/DirectMessageList";
import DirectMessageContainer from "../components/DirectMessages/DirectMessageContainer";
import { DMChatHeader } from "../components/DirectMessages/DMChatHeader";
import { useGetDmGroupQuery } from "../features/directMessages/directMessagesApiSlice";
import { useProfileQuery } from "../features/users/usersSlice";
import { styled } from "@mui/material/styles";
import { DirectMessageGroup, DirectMessageGroupMember } from "../types/direct-message.type";

const Root = styled(Box)({
  display: "flex",
  height: "100%",
  width: "100%",
  position: "absolute",
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
});

const Sidebar = styled(Paper)(({ theme }) => ({
  position: "absolute",
  top: 0,
  left: 0,
  bottom: 0,
  width: 280,
  minWidth: 220,
  maxWidth: 320,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  borderRadius: 0,
  boxShadow: "none",
  borderRight: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(2, 0, 0, 0),
  overflowY: "auto",
  zIndex: 2,
}));

const DMHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(1.5),
  padding: theme.spacing(0, 2, 2, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const Content = styled(Box)(() => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "flex-start",
  overflowY: "auto",
  marginLeft: 280, // match Sidebar width
  height: "100%",
}));

const DirectMessagesPage: React.FC = () => {
  const [selectedDmGroupId, setSelectedDmGroupId] = useState<string | undefined>();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { data: currentUser } = useProfileQuery();
  
  const { data: selectedDmGroup } = useGetDmGroupQuery(selectedDmGroupId!, {
    skip: !selectedDmGroupId,
  });

  const getDmDisplayName = (dmGroup: DirectMessageGroup): string => {
    if (dmGroup?.name) return dmGroup.name;

    if (!dmGroup?.isGroup && dmGroup?.members?.length === 2) {
      const otherMember = dmGroup.members.find((m: DirectMessageGroupMember) => m.user.id !== currentUser?.id);
      return otherMember?.user.displayName || otherMember?.user.username || "Unknown User";
    }

    return dmGroup?.members
      ?.filter((m: DirectMessageGroupMember) => m.user.id !== currentUser?.id)
      ?.map((m: DirectMessageGroupMember) => m.user.displayName || m.user.username)
      ?.join(", ") || "Group Chat";
  };

  if (isMobile) {
    // Mobile view: Show either list or chat, not both
    return (
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {selectedDmGroupId ? (
          <>
            <DMChatHeader
              dmGroupId={selectedDmGroupId}
              dmGroupName={getDmDisplayName(selectedDmGroup)}
              showBackButton={true}
              onBack={() => setSelectedDmGroupId(undefined)}
            />
            <Box sx={{ flex: 1 }}>
              <DirectMessageContainer dmGroupId={selectedDmGroupId} />
            </Box>
          </>
        ) : (
          <>
            <DMHeader>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Direct Messages
              </Typography>
              <IconButton onClick={() => setShowCreateDialog(true)} size="small">
                <AddIcon />
              </IconButton>
            </DMHeader>
            <DirectMessageList
              selectedDmGroupId={selectedDmGroupId}
              onSelectDmGroup={setSelectedDmGroupId}
              showCreateDialog={showCreateDialog}
              setShowCreateDialog={setShowCreateDialog}
            />
          </>
        )}
      </Box>
    );
  }

  // Desktop view: Use CommunityPage layout structure
  return (
    <Root>
      <Sidebar>
        <DMHeader>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Direct Messages
          </Typography>
          <IconButton onClick={() => setShowCreateDialog(true)} size="small">
            <AddIcon />
          </IconButton>
        </DMHeader>
        <DirectMessageList
          selectedDmGroupId={selectedDmGroupId}
          onSelectDmGroup={setSelectedDmGroupId}
          showCreateDialog={showCreateDialog}
          setShowCreateDialog={setShowCreateDialog}
        />
      </Sidebar>
      <Content>
        {selectedDmGroupId ? (
          <>
            <DMChatHeader
              dmGroupId={selectedDmGroupId}
              dmGroupName={getDmDisplayName(selectedDmGroup)}
            />
            <Box sx={{ flex: 1, overflow: "hidden" }}>
              <DirectMessageContainer dmGroupId={selectedDmGroupId} />
            </Box>
          </>
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Typography variant="h5" color="text.secondary">
              Select a conversation
            </Typography>
            <Typography variant="body1" color="text.secondary" textAlign="center">
              Choose from your existing conversations or start a new one
            </Typography>
          </Box>
        )}
      </Content>
    </Root>
  );
};

export default DirectMessagesPage;