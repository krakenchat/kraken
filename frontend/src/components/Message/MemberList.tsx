import React, { useState } from "react";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Divider,
  Skeleton,
  Alert,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import UserAvatar from "../Common/UserAvatar";
import { UserModerationMenu } from "../Moderation";
import { useUserProfile } from "../../contexts/UserProfileContext";

interface MemberData {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  isOnline?: boolean;
  status?: string | null;
}

interface MemberListProps {
  members: MemberData[];
  isLoading?: boolean;
  error?: unknown;
  title?: string;
  maxHeight?: number | string;
  communityId?: string; // For moderation actions
}

const MemberListSkeleton: React.FC = () => (
  <ListItem sx={{ px: 1, py: 0.5 }}>
    <ListItemAvatar sx={{ minWidth: 40 }}>
      <Skeleton variant="circular" width={32} height={32} />
    </ListItemAvatar>
    <ListItemText
      primary={<Skeleton variant="text" width="60%" />}
      secondary={<Skeleton variant="text" width="40%" />}
    />
  </ListItem>
);

interface ContextMenuState {
  anchorEl: HTMLElement | null;
  member: MemberData | null;
}

const MemberList: React.FC<MemberListProps> = ({
  members,
  isLoading = false,
  error = null,
  title = "Members",
  maxHeight = 400,
  communityId,
}) => {
  const theme = useTheme();
  const { openProfile } = useUserProfile();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    anchorEl: null,
    member: null,
  });

  const handleContextMenu = (event: React.MouseEvent<HTMLElement>, member: MemberData) => {
    event.preventDefault();
    setContextMenu({
      anchorEl: event.currentTarget,
      member,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ anchorEl: null, member: null });
  };

  if (error) {
    return (
      <Box sx={{ width: 240, p: 2 }}>
        <Alert severity="error" size="small">
          Failed to load members
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: 240,
        height: "100%",
        borderLeft: 1,
        borderColor: "divider",
        backgroundColor: "background.paper",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, pb: 1 }}>
        <Typography variant="h6" sx={{ fontSize: "14px", fontWeight: 600 }}>
          {title} — {isLoading ? "..." : members.length}
        </Typography>
      </Box>
      <Divider />

      {/* Member List */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
          "&::-webkit-scrollbar": {
            width: 8,
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: alpha("#000", 0.2),
            borderRadius: 4,
          },
        }}
      >
        <List disablePadding>
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <MemberListSkeleton key={index} />
              ))
            : members.map((member) => (
                <ListItemButton
                  key={member.id}
                  onClick={() => openProfile(member.id)}
                  onContextMenu={(e) => handleContextMenu(e, member)}
                  sx={{
                    px: 2,
                    py: 0.5,
                    "&:hover": {
                      backgroundColor: theme.palette.semantic.overlay.light,
                    },
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 40 }}>
                    <UserAvatar
                      user={member}
                      size="small"
                      showStatus={true}
                      isOnline={member.isOnline}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          fontSize: "14px",
                          lineHeight: 1.2,
                        }}
                      >
                        {member.displayName || member.username}
                      </Typography>
                    }
                    secondary={
                      member.status ? (
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                            fontSize: "11px",
                            lineHeight: 1.2,
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 150,
                          }}
                        >
                          {member.status}
                        </Typography>
                      ) : null
                    }
                  />
                </ListItemButton>
              ))}
        </List>

        {/* Empty State */}
        {!isLoading && members.length === 0 && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              py: 4,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No members
            </Typography>
          </Box>
        )}
      </Box>

      {/* Moderation Context Menu */}
      {communityId && contextMenu.member && (
        <UserModerationMenu
          anchorEl={contextMenu.anchorEl}
          open={Boolean(contextMenu.anchorEl)}
          onClose={handleCloseContextMenu}
          targetUserId={contextMenu.member.id}
          targetUserName={contextMenu.member.username}
          communityId={communityId}
        />
      )}
    </Box>
  );
};

export default MemberList;