import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, Typography, IconButton, Tabs, Tab, Badge } from "@mui/material";
import { Add as AddIcon, People as PeopleIcon, Chat as ChatIcon } from "@mui/icons-material";
import DirectMessageList from "../components/DirectMessages/DirectMessageList";
import DirectMessageContainer from "../components/DirectMessages/DirectMessageContainer";
import { DMChatHeader } from "../components/DirectMessages/DMChatHeader";
import { FriendsPanel } from "../components/Friends";
import { useQuery } from "@tanstack/react-query";
import {
  directMessagesControllerFindDmGroupOptions,
  friendsControllerGetPendingRequestsOptions,
} from "../api-client/@tanstack/react-query.gen";
import { styled } from "@mui/material/styles";
import { getDmDisplayName } from "../utils/dmHelpers";
import { useVideoOverlay } from "../contexts/VideoOverlayContext";
import { useCurrentUser } from "../hooks/useCurrentUser";
import TwoColumnLayout from "../components/Common/TwoColumnLayout";
import { useResponsive } from "../hooks/useResponsive";

const DMHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(1.5),
  padding: theme.spacing(0, 2, 1.5, 2),
}));

const SidebarTabs = styled(Tabs)(({ theme }) => ({
  minHeight: 40,
  borderBottom: `1px solid ${theme.palette.divider}`,
  '& .MuiTab-root': {
    minHeight: 40,
    textTransform: 'none',
    fontWeight: 500,
  },
}));

type SidebarTab = "messages" | "friends";

const DirectMessagesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDmGroupId, setSelectedDmGroupId] = useState<string | undefined>();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("messages");
  const { isMobile } = useResponsive();
  const { user: currentUser } = useCurrentUser();
  const { data: pendingRequests } = useQuery(friendsControllerGetPendingRequestsOptions());
  const { setPageContainer } = useVideoOverlay();

  // Count of incoming friend requests for badge
  const incomingRequestCount = pendingRequests?.received?.length || 0;

  // Handle DM creation from Friends panel (switches to messages tab and selects the DM)
  const handleSelectDmFromFriends = (dmGroupId: string) => {
    setSidebarTab("messages");
    setSelectedDmGroupId(dmGroupId);
  };

  // Handle ?group=<id> query param for deep linking (e.g., from notifications)
  useEffect(() => {
    const groupFromUrl = searchParams.get("group");
    if (groupFromUrl && groupFromUrl !== selectedDmGroupId) {
      setSelectedDmGroupId(groupFromUrl);
      // Clear only the group param, preserve highlight for the message container
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("group");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, selectedDmGroupId, setSearchParams]);

  const { data: selectedDmGroup } = useQuery({
    ...directMessagesControllerFindDmGroupOptions({ path: { id: selectedDmGroupId! } }),
    enabled: !!selectedDmGroupId,
  });

  if (isMobile) {
    // Mobile view: Show either list or chat, not both
    return (
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {selectedDmGroupId ? (
          <>
            <DMChatHeader
              dmGroupId={selectedDmGroupId}
              dmGroupName={getDmDisplayName(selectedDmGroup, currentUser?.id)}
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
                {sidebarTab === "messages" ? "Direct Messages" : "Friends"}
              </Typography>
              {sidebarTab === "messages" && (
                <IconButton onClick={() => setShowCreateDialog(true)} size="small">
                  <AddIcon />
                </IconButton>
              )}
            </DMHeader>
            <SidebarTabs
              value={sidebarTab}
              onChange={(_, newValue) => setSidebarTab(newValue)}
              variant="fullWidth"
            >
              <Tab
                icon={<ChatIcon fontSize="small" />}
                iconPosition="start"
                label="Messages"
                value="messages"
              />
              <Tab
                icon={
                  <Badge badgeContent={incomingRequestCount} color="error">
                    <PeopleIcon fontSize="small" />
                  </Badge>
                }
                iconPosition="start"
                label="Friends"
                value="friends"
              />
            </SidebarTabs>
            {sidebarTab === "messages" ? (
              <DirectMessageList
                selectedDmGroupId={selectedDmGroupId}
                onSelectDmGroup={setSelectedDmGroupId}
                showCreateDialog={showCreateDialog}
                setShowCreateDialog={setShowCreateDialog}
              />
            ) : (
              <FriendsPanel
                onSelectDmGroup={handleSelectDmFromFriends}
                compact
              />
            )}
          </>
        )}
      </Box>
    );
  }

  // Desktop view: Use shared TwoColumnLayout
  return (
    <TwoColumnLayout
      sidebar={
        <>
          <DMHeader>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {sidebarTab === "messages" ? "Direct Messages" : "Friends"}
            </Typography>
            {sidebarTab === "messages" && (
              <IconButton onClick={() => setShowCreateDialog(true)} size="small">
                <AddIcon />
              </IconButton>
            )}
          </DMHeader>
          <SidebarTabs
            value={sidebarTab}
            onChange={(_, newValue) => setSidebarTab(newValue)}
            variant="fullWidth"
          >
            <Tab
              icon={<ChatIcon fontSize="small" />}
              iconPosition="start"
              label="Messages"
              value="messages"
            />
            <Tab
              icon={
                <Badge badgeContent={incomingRequestCount} color="error">
                  <PeopleIcon fontSize="small" />
                </Badge>
              }
              iconPosition="start"
              label="Friends"
              value="friends"
            />
          </SidebarTabs>
          {sidebarTab === "messages" ? (
            <DirectMessageList
              selectedDmGroupId={selectedDmGroupId}
              onSelectDmGroup={setSelectedDmGroupId}
              showCreateDialog={showCreateDialog}
              setShowCreateDialog={setShowCreateDialog}
            />
          ) : (
            <FriendsPanel
              onSelectDmGroup={handleSelectDmFromFriends}
            />
          )}
        </>
      }
      contentRef={setPageContainer}
    >
      {selectedDmGroupId ? (
        <>
          <DMChatHeader
            dmGroupId={selectedDmGroupId}
            dmGroupName={getDmDisplayName(selectedDmGroup, currentUser?.id)}
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
    </TwoColumnLayout>
  );
};

export default DirectMessagesPage;