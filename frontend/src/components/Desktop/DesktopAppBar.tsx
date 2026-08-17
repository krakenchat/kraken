import React from "react";
import { AppBar, Toolbar, Typography, IconButton } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../ThemeToggle/ThemeToggle";
import NavigationLinks from "../NavBar/NavigationLinks";
import ProfileIcon from "../NavBar/ProfileIcon";
import NotificationBadge from "../Notifications/NotificationBadge";
import { APPBAR_HEIGHT } from "../../constants/layout";
import { useLogout } from "../../hooks/useLogout";
import type { User } from "../../types/auth.type";

const settings = ["My Profile", "Settings", "Logout"];

interface DesktopAppBarProps {
  instanceName: string;
  isLoading: boolean;
  isError: boolean;
  userData: User | undefined;
  onToggleMenu: () => void;
  onNotificationCenterOpen: () => void;
}

export const DesktopAppBar: React.FC<DesktopAppBarProps> = ({
  instanceName,
  isLoading,
  isError,
  userData,
  onToggleMenu,
  onNotificationCenterOpen,
}) => {
  const navigate = useNavigate();
  const { handleLogout, logoutLoading } = useLogout();
  const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(
    null
  );

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleSettingClick = (setting: string) => {
    if (setting === "My Profile") {
      if (userData?.id) {
        navigate(`/profile/${userData.id}`);
      }
    } else if (setting === "Settings") {
      navigate("/settings");
    } else if (setting === "Logout") {
      handleLogout();
    }
  };

  // Pass user data to ProfileIcon for authenticated avatar fetching
  const profileUserData = userData
    ? { id: userData.id }
    : undefined;

  return (
    <AppBar position="fixed">
      <Toolbar sx={{ minHeight: APPBAR_HEIGHT }}>
        <div
          style={{
            flexGrow: 1,
            flexDirection: "row",
            display: "flex",
            alignItems: "center",
            gap: "0.25em",
          }}
        >
          <IconButton
            size="large"
            edge="start"
            aria-label="menu"
            onClick={onToggleMenu}
            sx={{ mr: 2, color: "text.primary" }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ color: "text.primary" }}>{instanceName}</Typography>
        </div>
        <NavigationLinks
          isLoading={isLoading}
          isError={isError}
          userData={userData}
          handleLogout={handleLogout}
          logoutLoading={logoutLoading}
        />
        <ThemeToggle />
        &nbsp;
        {!isLoading && (
          <>
            <NotificationBadge
              onClick={onNotificationCenterOpen}
            />
            <ProfileIcon
              userData={profileUserData}
              anchorElUser={anchorElUser}
              handleOpenUserMenu={handleOpenUserMenu}
              handleCloseUserMenu={handleCloseUserMenu}
              settings={settings}
              onSettingClick={handleSettingClick}
            />
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default DesktopAppBar;
