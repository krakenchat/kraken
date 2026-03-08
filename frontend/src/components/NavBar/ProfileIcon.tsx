import React from "react";
import {
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import UserAvatar from "../Common/UserAvatar";

interface ProfileIconProps {
  userData: {
    id?: string;
  } | undefined;
  anchorElUser: null | HTMLElement;
  handleOpenUserMenu: (event: React.MouseEvent<HTMLElement>) => void;
  handleCloseUserMenu: () => void;
  settings: string[];
  onSettingClick?: (setting: string) => void;
}

const ProfileIcon: React.FC<ProfileIconProps> = ({
  userData,
  anchorElUser,
  handleOpenUserMenu,
  handleCloseUserMenu,
  settings,
  onSettingClick,
}) => {
  const handleMenuItemClick = (setting: string) => {
    handleCloseUserMenu();
    if (onSettingClick) {
      onSettingClick(setting);
    }
  };

  return (
    <>
      <Tooltip title="Open settings">
        <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
          <UserAvatar userId={userData?.id} size="medium" />
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
          <MenuItem key={setting} onClick={() => handleMenuItemClick(setting)}>
            <Typography sx={{ textAlign: "center" }}>{setting}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default ProfileIcon;
