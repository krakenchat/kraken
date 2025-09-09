import { useMemo } from "react";
import {
  useGetMyRolesForCommunityQuery,
  useGetMyRolesForChannelQuery,
  useGetMyInstanceRolesQuery,
} from "./rolesApiSlice";
import { UserRoles, ResourceType } from "../../types/roles.type";
import { useProfileQuery } from "../users/usersSlice";

export interface UseUserPermissionsOptions {
  resourceType: ResourceType;
  resourceId?: string;
  actions: string[];
}

export interface UseUserPermissionsResult {
  hasPermissions: boolean;
  isLoading: boolean;
  roles: UserRoles | undefined;
}

/**
 * Hook to check if the current user has specific permissions for a resource
 */
export function useUserPermissions({
  resourceType,
  resourceId,
  actions,
}: UseUserPermissionsOptions): UseUserPermissionsResult {
  // Get user profile to check if they're an OWNER (which bypasses all RBAC checks)
  const { data: userProfile } = useProfileQuery(undefined);
  
  // Conditionally call the appropriate query based on resource type
  const { data: communityRoles, isLoading: isCommunityLoading } =
    useGetMyRolesForCommunityQuery(resourceId!, {
      skip: resourceType !== "COMMUNITY" || !resourceId,
    });

  const { data: channelRoles, isLoading: isChannelLoading } =
    useGetMyRolesForChannelQuery(resourceId!, {
      skip: resourceType !== "CHANNEL" || !resourceId,
    });

  const { data: instanceRoles, isLoading: isInstanceLoading } =
    useGetMyInstanceRolesQuery(undefined, {
      skip: resourceType !== "INSTANCE",
    });

  const { roles, isLoading } = useMemo(() => {
    switch (resourceType) {
      case "COMMUNITY":
        return { roles: communityRoles, isLoading: isCommunityLoading };
      case "CHANNEL":
        return { roles: channelRoles, isLoading: isChannelLoading };
      case "INSTANCE":
        return { roles: instanceRoles, isLoading: isInstanceLoading };
      default:
        return { roles: undefined, isLoading: false };
    }
  }, [
    resourceType,
    communityRoles,
    channelRoles,
    instanceRoles,
    isCommunityLoading,
    isChannelLoading,
    isInstanceLoading,
  ]);

  const hasPermissions = useMemo(() => {
    // OWNER users bypass all RBAC checks (same as backend logic)
    if (userProfile?.role === "OWNER") {
      return true;
    }

    if (!roles || isLoading) return false;

    // Get all actions from all roles
    const allActions = roles.roles.flatMap((role) => role.actions);

    // Check if user has all required actions
    return actions.every((action) => allActions.includes(action));
  }, [roles, actions, isLoading, userProfile]);

  return {
    hasPermissions,
    isLoading,
    roles,
  };
}

/**
 * Hook to get the current user's roles for a specific community
 */
export function useMyRolesForCommunity(communityId: string) {
  return useGetMyRolesForCommunityQuery(communityId);
}

/**
 * Hook to get the current user's roles for a specific channel
 */
export function useMyRolesForChannel(channelId: string) {
  return useGetMyRolesForChannelQuery(channelId);
}

/**
 * Hook to get the current user's instance roles
 */
export function useMyInstanceRoles() {
  return useGetMyInstanceRolesQuery();
}

/**
 * Simple hook to check if user has any of the specified actions for a resource
 */
export function useHasAnyPermission(
  resourceType: ResourceType,
  resourceId: string | undefined,
  actions: string[]
): boolean {
  const { hasPermissions } = useUserPermissions({
    resourceType,
    resourceId,
    actions,
  });
  return hasPermissions;
}

/**
 * Hook to check if user can perform a specific action on a resource
 */
export function useCanPerformAction(
  resourceType: ResourceType,
  resourceId: string | undefined,
  action: string
): boolean {
  return useHasAnyPermission(resourceType, resourceId, [action]);
}
