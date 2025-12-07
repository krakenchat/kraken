import React from "react";
import { Link } from "react-router-dom";
import { Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import type { User } from "../../types/auth.type";
import { useUserPermissions } from "../../features/roles/useUserPermissions";

const NavLink = styled(Link)(({ theme }) => ({
  color: theme.palette.text.primary,
  textDecoration: "none",
  marginRight: 16,
  opacity: 0.9,
  transition: "opacity 0.15s ease",
  "&:hover": {
    opacity: 1,
  },
  "&:last-of-type": {
    marginRight: 0,
  },
}));

interface NavigationLinksProps {
  isLoading: boolean;
  isError: boolean;
  userData: User | undefined;
  handleLogout: () => void;
  logoutLoading: boolean;
}

const NavigationLinks: React.FC<NavigationLinksProps> = ({
  isLoading,
  isError,
  userData,
  handleLogout,
  logoutLoading,
}) => {
  const { hasPermissions: canViewInvites } = useUserPermissions({
    resourceType: "INSTANCE",
    actions: ["READ_INSTANCE_INVITE"],
  });

  return (
    <>
      <NavLink to="/">Home</NavLink>
      {isLoading ? (
        <Typography variant="body2" sx={{ color: "text.primary", marginRight: 16 }}>
          Loading...
        </Typography>
      ) : isError || !userData ? (
        <>
          <NavLink to="/login">Login</NavLink>
          <NavLink to="/register">Register</NavLink>
        </>
      ) : (
        <>
          {canViewInvites && <NavLink to="/admin">Admin</NavLink>}
          <NavLink
            to="#"
            onClick={(e) => {
              e.preventDefault();
              if (!logoutLoading) handleLogout();
            }}
            style={logoutLoading ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
          >
            Logout
          </NavLink>
        </>
      )}
    </>
  );
};

export default NavigationLinks;
