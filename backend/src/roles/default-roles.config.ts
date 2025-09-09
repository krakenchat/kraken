import { RbacActions } from '@prisma/client';

export interface DefaultRoleConfig {
  name: string;
  actions: RbacActions[];
}

/**
 * Default admin role with all community permissions
 */
export const DEFAULT_ADMIN_ROLE: DefaultRoleConfig = {
  name: 'Community Admin',
  actions: [
    // All CRUD operations for communities
    RbacActions.UPDATE_COMMUNITY,
    RbacActions.DELETE_COMMUNITY,
    RbacActions.READ_COMMUNITY,

    // Channel management
    RbacActions.CREATE_CHANNEL,
    RbacActions.UPDATE_CHANNEL,
    RbacActions.DELETE_CHANNEL,
    RbacActions.READ_CHANNEL,

    // Member management
    RbacActions.CREATE_MEMBER,
    RbacActions.UPDATE_MEMBER,
    RbacActions.DELETE_MEMBER,
    RbacActions.READ_MEMBER,

    // Message management
    RbacActions.CREATE_MESSAGE,
    RbacActions.DELETE_MESSAGE,
    RbacActions.READ_MESSAGE,

    // Role management within community
    RbacActions.CREATE_ROLE,
    RbacActions.UPDATE_ROLE,
    RbacActions.DELETE_ROLE,
    RbacActions.READ_ROLE,

    // Invite management
    RbacActions.CREATE_INVITE,
    RbacActions.DELETE_INVITE,
    RbacActions.CREATE_INSTANCE_INVITE,
    RbacActions.DELETE_INSTANCE_INVITE,
    RbacActions.READ_INSTANCE_INVITE,

    // Alias group management
    RbacActions.CREATE_ALIAS_GROUP,
    RbacActions.UPDATE_ALIAS_GROUP,
    RbacActions.DELETE_ALIAS_GROUP,
    RbacActions.READ_ALIAS_GROUP,
    RbacActions.CREATE_ALIAS_GROUP_MEMBER,
    RbacActions.DELETE_ALIAS_GROUP_MEMBER,
    RbacActions.READ_ALIAS_GROUP_MEMBER,

    // Reaction management
    RbacActions.CREATE_REACTION,
    RbacActions.DELETE_REACTION,

    // Attachment management
    RbacActions.CREATE_ATTACHMENT,
    RbacActions.DELETE_ATTACHMENT,
  ],
};

/**
 * Default moderator role with limited permissions
 */
export const DEFAULT_MODERATOR_ROLE: DefaultRoleConfig = {
  name: 'Moderator',
  actions: [
    // Read permissions
    RbacActions.READ_COMMUNITY,
    RbacActions.READ_CHANNEL,
    RbacActions.READ_MEMBER,
    RbacActions.READ_MESSAGE,
    RbacActions.READ_ROLE,

    // Message moderation
    RbacActions.CREATE_MESSAGE,
    RbacActions.DELETE_MESSAGE,

    // Basic channel management
    RbacActions.CREATE_CHANNEL,
    RbacActions.UPDATE_CHANNEL,

    // Member management (limited)
    RbacActions.CREATE_MEMBER,
    RbacActions.UPDATE_MEMBER,

    // Reaction management
    RbacActions.CREATE_REACTION,
    RbacActions.DELETE_REACTION,

    // Attachment management
    RbacActions.CREATE_ATTACHMENT,
    RbacActions.DELETE_ATTACHMENT,

    // Alias group management (limited)
    RbacActions.READ_ALIAS_GROUP,
    RbacActions.READ_ALIAS_GROUP_MEMBER,
  ],
};

/**
 * Default member role with basic permissions for regular users
 */
export const DEFAULT_MEMBER_ROLE: DefaultRoleConfig = {
  name: 'Member',
  actions: [
    // Basic read permissions
    RbacActions.READ_COMMUNITY,
    RbacActions.READ_CHANNEL,
    RbacActions.READ_MEMBER,
    RbacActions.READ_MESSAGE,

    // Basic message permissions
    RbacActions.CREATE_MESSAGE,

    // Basic reaction permissions
    RbacActions.CREATE_REACTION,
    RbacActions.DELETE_REACTION,

    // Basic attachment permissions
    RbacActions.CREATE_ATTACHMENT,

    // Basic alias group reading
    RbacActions.READ_ALIAS_GROUP,
    RbacActions.READ_ALIAS_GROUP_MEMBER,
  ],
};

/**
 * Get all default roles for a community
 */
export function getDefaultCommunityRoles(): DefaultRoleConfig[] {
  return [DEFAULT_ADMIN_ROLE, DEFAULT_MODERATOR_ROLE, DEFAULT_MEMBER_ROLE];
}

/**
 * Get a specific default role by name
 */
export function getDefaultRoleByName(
  name: string,
): DefaultRoleConfig | undefined {
  const roles = getDefaultCommunityRoles();
  return roles.find((role) => role.name === name);
}
