import React from "react";
import {
  IconButton,
  Tooltip,
  Avatar,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";

interface ProfileIconProps {
  userData: { displayName?: string; avatarUrl?: string } | undefined;
  anchorElUser: null | HTMLElement;
  handleOpenUserMenu: (event: React.MouseEvent<HTMLElement>) => void;
  handleCloseUserMenu: () => void;
  settings: string[];
}

const ProfileIcon: React.FC<ProfileIconProps> = ({
  userData,
  anchorElUser,
  handleOpenUserMenu,
  handleCloseUserMenu,
  settings,
}) => (
  <>
    <Tooltip title="Open settings">
      <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
        <Avatar
          alt={userData?.displayName || "User"}
          src={userData?.avatarUrl || undefined}
        />
      </IconButton>
    </Tooltip>
    <Menu
      sx={{ mt: "45px" }}
      id="menu-appbar"
      anchorEl={anchorElUser}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      keepMounted
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      open={Boolean(anchorElUser)}
      onClose={handleCloseUserMenu}
    >
      {settings.map((setting) => (
        <MenuItem key={setting} onClick={handleCloseUserMenu}>
          <Typography sx={{ textAlign: "center" }}>{setting}</Typography>
        </MenuItem>
      ))}
    </Menu>
  </>
);

export default ProfileIcon;
