/**
 * UserModerationMenu Component
 *
 * Context menu for moderation actions on a user.
 * Shows kick, timeout, and ban options based on permissions.
 */

import React, { useState } from "react";
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import TimerIcon from "@mui/icons-material/Timer";
import BlockIcon from "@mui/icons-material/Block";
import PersonIcon from "@mui/icons-material/Person";
import { useCanPerformAction } from "../../features/roles/useUserPermissions";
import { RBAC_ACTIONS } from "../../constants/rbacActions";
import BanDialog from "./BanDialog";
import TimeoutDialog from "./TimeoutDialog";
import KickConfirmDialog from "./KickConfirmDialog";

export interface UserModerationMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  communityId: string;
  targetUserId: string;
  targetUserName: string;
  onViewProfile?: () => void;
}

const UserModerationMenu: React.FC<UserModerationMenuProps> = ({
  anchorEl,
  open,
  onClose,
  communityId,
  targetUserId,
  targetUserName,
  onViewProfile,
}) => {
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [timeoutDialogOpen, setTimeoutDialogOpen] = useState(false);
  const [kickDialogOpen, setKickDialogOpen] = useState(false);

  const canKick = useCanPerformAction("COMMUNITY", communityId, RBAC_ACTIONS.KICK_USER);
  const canTimeout = useCanPerformAction("COMMUNITY", communityId, RBAC_ACTIONS.TIMEOUT_USER);
  const canBan = useCanPerformAction("COMMUNITY", communityId, RBAC_ACTIONS.BAN_USER);

  const handleKick = () => {
    onClose();
    setKickDialogOpen(true);
  };

  const handleTimeout = () => {
    onClose();
    setTimeoutDialogOpen(true);
  };

  const handleBan = () => {
    onClose();
    setBanDialogOpen(true);
  };

  const handleViewProfile = () => {
    onClose();
    onViewProfile?.();
  };

  const hasAnyModerationAction = canKick || canTimeout || canBan;

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
      >
        {onViewProfile && (
          <MenuItem onClick={handleViewProfile}>
            <ListItemIcon>
              <PersonIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>View Profile</ListItemText>
          </MenuItem>
        )}

        {hasAnyModerationAction && onViewProfile && <Divider />}

        {canKick && (
          <MenuItem onClick={handleKick}>
            <ListItemIcon>
              <PersonRemoveIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Kick</ListItemText>
          </MenuItem>
        )}

        {canTimeout && (
          <MenuItem onClick={handleTimeout}>
            <ListItemIcon>
              <TimerIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Timeout</ListItemText>
          </MenuItem>
        )}

        {canBan && (
          <MenuItem onClick={handleBan} sx={{ color: "error.main" }}>
            <ListItemIcon sx={{ color: "error.main" }}>
              <BlockIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Ban</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <BanDialog
        open={banDialogOpen}
        onClose={() => setBanDialogOpen(false)}
        communityId={communityId}
        userId={targetUserId}
        userName={targetUserName}
      />

      <TimeoutDialog
        open={timeoutDialogOpen}
        onClose={() => setTimeoutDialogOpen(false)}
        communityId={communityId}
        userId={targetUserId}
        userName={targetUserName}
      />

      <KickConfirmDialog
        open={kickDialogOpen}
        onClose={() => setKickDialogOpen(false)}
        communityId={communityId}
        userId={targetUserId}
        userName={targetUserName}
      />
    </>
  );
};

export default UserModerationMenu;
