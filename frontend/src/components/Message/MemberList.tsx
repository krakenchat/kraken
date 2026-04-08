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

export interface MemberData {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  isOnline?: boolean;
  status?: string | null;
  displayRole?: { id: string; name: string; position: number };
}

interface MemberListProps {
  members: MemberData[];
  isLoading?: boolean;
  error?: unknown;
  title?: string;
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
  position: { top: number; left: number } | null;
  member: MemberData | null;
}

interface RoleGroup {
  roleId: string;
  roleName: string;
  position: number;
  members: MemberData[];
}

/**
 * Section header for role groups and online/offline sections.
 * Styled like Discord's uppercase, muted section headers.
 */
const SectionHeader: React.FC<{ label: string; count: number }> = ({ label, count }) => (
  <ListItem sx={{ px: 2, pt: 2, pb: 0.5 }}>
    <Typography
      variant="overline"
      sx={{
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.05em",
        color: "text.secondary",
        lineHeight: 1.5,
      }}
    >
      {label} — {count}
    </Typography>
  </ListItem>
);

const MemberList: React.FC<MemberListProps> = ({
  members,
  isLoading = false,
  error = null,
  title = "Members",
  communityId,
}) => {
  const theme = useTheme();
  const { openProfile } = useUserProfile();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    position: null,
    member: null,
  });

  const handleContextMenu = (event: React.MouseEvent<HTMLElement>, member: MemberData) => {
    event.preventDefault();
    setContextMenu({
      position: { top: event.clientY, left: event.clientX },
      member,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ position: null, member: null });
  };

  // Group members by display role
  const { roleGroups, onlineMembers, offlineMembers } = React.useMemo(() => {
    const groupMap = new Map<string, RoleGroup>();
    const ungroupedOnline: MemberData[] = [];
    const ungroupedOffline: MemberData[] = [];

    for (const member of members) {
      if (member.displayRole) {
        const key = member.displayRole.id;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            roleId: member.displayRole.id,
            roleName: member.displayRole.name,
            position: member.displayRole.position,
            members: [],
          });
        }
        groupMap.get(key)!.members.push(member);
      } else if (member.isOnline) {
        ungroupedOnline.push(member);
      } else {
        ungroupedOffline.push(member);
      }
    }

    // Sort role groups by position (lowest first = highest priority)
    const sortedGroups = Array.from(groupMap.values()).sort(
      (a, b) => a.position - b.position,
    );

    // Sort members within each group: online first, then alphabetically
    for (const group of sortedGroups) {
      group.members.sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return (a.displayName || a.username).localeCompare(b.displayName || b.username);
      });
    }

    // Sort ungrouped members alphabetically
    ungroupedOnline.sort((a, b) =>
      (a.displayName || a.username).localeCompare(b.displayName || b.username),
    );
    ungroupedOffline.sort((a, b) =>
      (a.displayName || a.username).localeCompare(b.displayName || b.username),
    );

    return {
      roleGroups: sortedGroups,
      onlineMembers: ungroupedOnline,
      offlineMembers: ungroupedOffline,
    };
  }, [members]);

  const renderMember = (member: MemberData) => (
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
          userId={member.id}
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
  );

  if (error) {
    return (
      <Box sx={{ width: 240, p: 2 }}>
        <Alert severity="error" size="small">
          Failed to load members
        </Alert>
      </Box>
    );
  }

  const hasRoleGroups = roleGroups.length > 0;

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
            : (
              <>
                {/* Role groups */}
                {roleGroups.map((group) => (
                  <React.Fragment key={group.roleId}>
                    <SectionHeader label={group.roleName} count={group.members.length} />
                    {group.members.map(renderMember)}
                  </React.Fragment>
                ))}

                {/* Online members without special roles */}
                {onlineMembers.length > 0 && (
                  <>
                    <SectionHeader
                      label={hasRoleGroups ? "Online" : "Online"}
                      count={onlineMembers.length}
                    />
                    {onlineMembers.map(renderMember)}
                  </>
                )}

                {/* Offline members without special roles */}
                {offlineMembers.length > 0 && (
                  <>
                    <SectionHeader label="Offline" count={offlineMembers.length} />
                    {offlineMembers.map(renderMember)}
                  </>
                )}
              </>
            )}
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
      {contextMenu.member && (
        <UserModerationMenu
          anchorEl={null}
          anchorPosition={contextMenu.position ?? undefined}
          open={Boolean(contextMenu.position)}
          onClose={handleCloseContextMenu}
          targetUserId={contextMenu.member.id}
          targetUserName={contextMenu.member.username}
          communityId={communityId || ""}
          onViewProfile={() => {
            handleCloseContextMenu();
            openProfile(contextMenu.member!.id);
          }}
        />
      )}
    </Box>
  );
};

export default MemberList;