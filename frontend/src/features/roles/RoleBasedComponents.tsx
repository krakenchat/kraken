import React from "react";
import {
  useUserPermissions,
  useMyRolesForCommunity,
  useCanPerformAction,
} from "./useUserPermissions";

interface RoleBasedComponentProps {
  communityId: string;
  children: React.ReactNode;
  requiredActions: string[];
}

/**
 * Example component that conditionally renders children based on user permissions
 */
export function RoleBasedComponent({
  communityId,
  children,
  requiredActions,
}: RoleBasedComponentProps) {
  const { hasPermissions, isLoading } = useUserPermissions({
    resourceType: "COMMUNITY",
    resourceId: communityId,
    actions: requiredActions,
  });

  if (isLoading) {
    return <div>Loading permissions...</div>;
  }

  if (!hasPermissions) {
    return null; // Don't render if user doesn't have permissions
  }

  return <>{children}</>;
}

interface CommunityRoleDisplayProps {
  communityId: string;
}

/**
 * Example component that displays user roles for a community
 */
export function CommunityRoleDisplay({
  communityId,
}: CommunityRoleDisplayProps) {
  const {
    data: userRoles,
    isLoading,
    error,
  } = useMyRolesForCommunity(communityId);

  if (isLoading) return <div>Loading roles...</div>;
  if (error) return <div>Error loading roles</div>;
  if (!userRoles || userRoles.roles.length === 0) {
    return <div>No roles assigned</div>;
  }

  return (
    <div>
      <h3>Your roles in this community:</h3>
      <ul>
        {userRoles.roles.map((role) => (
          <li key={role.id}>
            <strong>{role.name}</strong>
            <ul>
              {role.actions.map((action) => (
                <li key={action}>{action}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ConditionalButtonProps {
  communityId: string;
  action: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Example button that only renders if user has the required permission
 */
export function ConditionalButton({
  communityId,
  action,
  onClick,
  children,
  className,
}: ConditionalButtonProps) {
  const canPerformAction = useCanPerformAction(
    "COMMUNITY",
    communityId,
    action
  );

  if (!canPerformAction) {
    return null;
  }

  return (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  );
}
