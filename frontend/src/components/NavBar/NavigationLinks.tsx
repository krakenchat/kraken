import React from "react";
import { Link } from "react-router-dom";
import { Button, Typography } from "@mui/material";
import type { User } from "../../types/auth.type";
import styled from "@emotion/styled";
import { useUserPermissions } from "../../features/roles/useUserPermissions";

const NavLink = styled(Link)`
  color: white;
  text-decoration: none;
  margin-right: 16px;
  &:last-of-type {
    margin-right: 0;
  }
`;

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
        <Typography variant="body2" sx={{ color: "white", marginRight: 16 }}>
          Loading...
        </Typography>
      ) : isError || !userData ? (
        <>
          <NavLink to="/login">Login</NavLink>
          <NavLink to="/register">Register</NavLink>
        </>
      ) : (
        <>
          {canViewInvites && <NavLink to="/admin/invites">Invites</NavLink>}
          <Button
            onClick={handleLogout}
            disabled={logoutLoading}
            sx={{ color: "white", textTransform: "none" }}
          >
            Logout
          </Button>
        </>
      )}
    </>
  );
};

export default NavigationLinks;
