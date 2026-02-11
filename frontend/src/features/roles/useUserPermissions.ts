import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  rolesControllerGetMyRolesForCommunityOptions,
  rolesControllerGetMyRolesForChannelOptions,
  rolesControllerGetMyInstanceRolesOptions,
  userControllerGetProfileOptions,
} from "../../api-client/@tanstack/react-query.gen";
import { UserRoles, ResourceType } from "../../types/roles.type";

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
  const { data: userProfile, isLoading: isProfileLoading } = useQuery(userControllerGetProfileOptions());

  // Conditionally call the appropriate query based on resource type
  const { data: communityRoles, isLoading: isCommunityLoading } =
    useQuery({
      ...rolesControllerGetMyRolesForCommunityOptions({ path: { communityId: resourceId! } }),
      enabled: resourceType === "COMMUNITY" && !!resourceId,
    });

  const { data: channelRoles, isLoading: isChannelLoading } =
    useQuery({
      ...rolesControllerGetMyRolesForChannelOptions({ path: { channelId: resourceId! } }),
      enabled: resourceType === "CHANNEL" && !!resourceId,
    });

  const { data: instanceRoles, isLoading: isInstanceLoading } =
    useQuery({
      ...rolesControllerGetMyInstanceRolesOptions(),
      enabled: resourceType === "INSTANCE",
    });

  const { roles, isLoading } = useMemo(() => {
    switch (resourceType) {
      case "COMMUNITY":
        return { roles: communityRoles as UserRoles | undefined, isLoading: isCommunityLoading };
      case "CHANNEL":
        return { roles: channelRoles as UserRoles | undefined, isLoading: isChannelLoading };
      case "INSTANCE":
        return { roles: instanceRoles as UserRoles | undefined, isLoading: isInstanceLoading };
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
    // Check this first before any loading state checks
    if (userProfile?.role === "OWNER") {
      return true;
    }

    // If profile is still loading and we don't have data yet, we don't know if user is OWNER
    if (isProfileLoading && !userProfile) return false;

    if (!roles || isLoading) return false;

    // Get all actions from all roles
    const allActions = roles.roles.flatMap((role) => role.actions);

    // Check if user has all required actions
    return actions.every((action) => allActions.includes(action));
  }, [roles, actions, isLoading, userProfile, isProfileLoading]);

  // Include profile loading in overall loading state when profile isn't loaded yet
  const overallLoading = isLoading || (isProfileLoading && !userProfile);

  return {
    hasPermissions,
    isLoading: overallLoading,
    roles,
  };
}

/**
 * Hook to get the current user's roles for a specific community
 */
export function useMyRolesForCommunity(communityId: string) {
  return useQuery(rolesControllerGetMyRolesForCommunityOptions({ path: { communityId } }));
}

/**
 * Hook to get the current user's roles for a specific channel
 */
export function useMyRolesForChannel(channelId: string) {
  return useQuery(rolesControllerGetMyRolesForChannelOptions({ path: { channelId } }));
}

/**
 * Hook to get the current user's instance roles
 */
export function useMyInstanceRoles() {
  return useQuery(rolesControllerGetMyInstanceRolesOptions());
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
