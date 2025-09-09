import React from "react";
import {
  Box,
  Avatar,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Skeleton,
  Alert,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

interface MemberData {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

interface MemberListProps {
  members: MemberData[];
  isLoading?: boolean;
  error?: unknown;
  title?: string;
  maxHeight?: number | string;
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

const MemberList: React.FC<MemberListProps> = ({
  members,
  isLoading = false,
  error = null,
  title = "Members",
  maxHeight = 400,
}) => {
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
                <ListItem
                  key={member.id}
                  sx={{
                    px: 2,
                    py: 0.5,
                    "&:hover": {
                      backgroundColor: alpha("#000", 0.02),
                    },
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 40 }}>
                    <Avatar
                      src={member.avatarUrl || ""}
                      sx={{ width: 32, height: 32 }}
                    >
                      {member.username.charAt(0).toUpperCase()}
                    </Avatar>
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
                        {member.username}
                      </Typography>
                    }
                    secondary={
                      member.displayName && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                            fontSize: "12px",
                            lineHeight: 1.2,
                          }}
                        >
                          {member.displayName}
                        </Typography>
                      )
                    }
                  />
                </ListItem>
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
    </Box>
  );
};

export default MemberList;