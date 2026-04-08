import React from "react";
import MemberList, { type MemberData } from "./MemberList";
import { useQuery } from "@tanstack/react-query";
import {
  membershipControllerFindAllForCommunityOptions,
  presenceControllerGetMultipleUserPresenceOptions,
  directMessagesControllerFindDmGroupOptions,
  channelMembershipControllerFindAllForChannelOptions,
} from "../../api-client/@tanstack/react-query.gen";
import type { RoleDto } from "../../api-client/types.gen";
import { VoiceSessionType } from "../../contexts/VoiceContext";

interface MemberListContainerProps {
  contextType: VoiceSessionType;
  contextId: string;
  communityId?: string;
  isPrivate?: boolean;
}

/**
 * Compute a member's "display role" from their roles list.
 * The display role is the role with the lowest position (highest priority),
 * excluding the default "Member" role (position 100, isDefault=true).
 */
function computeDisplayRole(
  roles?: RoleDto[],
): MemberData["displayRole"] | undefined {
  if (!roles || roles.length === 0) return undefined;

  // Filter out the default Member role (catch-all)
  const nonMemberRoles = roles.filter(
    (r) => !(r.isDefault && r.name === "Member"),
  );

  if (nonMemberRoles.length === 0) return undefined;

  // Find the role with the lowest position (highest priority)
  const bestRole = nonMemberRoles.reduce((best, role) =>
    role.position < best.position ? role : best,
  );

  return {
    id: bestRole.id,
    name: bestRole.name,
    position: bestRole.position,
  };
}

const MemberListContainer: React.FC<MemberListContainerProps> = ({
  contextType,
  contextId,
  communityId,
  isPrivate,
}) => {
  // For private channels, fetch channel-specific members
  const {
    data: channelMembers,
    isLoading: isChannelMembersLoading,
    error: channelMembersError,
  } = useQuery({
    ...channelMembershipControllerFindAllForChannelOptions({ path: { channelId: contextId } }),
    enabled: contextType === VoiceSessionType.Channel && !!isPrivate,
  });

  // For public channels, fetch community members
  const {
    data: communityMembers,
    isLoading: isCommunityLoading,
    error: communityError,
  } = useQuery({
    ...membershipControllerFindAllForCommunityOptions({ path: { communityId: communityId || "" } }),
    enabled: contextType === VoiceSessionType.Channel && !!communityId && isPrivate === false,
  });

  // For DM context, fetch DM group members
  const {
    data: dmGroup,
    isLoading: isDmLoading,
    error: dmError,
  } = useQuery({
    ...directMessagesControllerFindDmGroupOptions({ path: { id: contextId } }),
    enabled: contextType === VoiceSessionType.Dm,
  });

  // Get base member data first
  const baseMembers = React.useMemo(() => {
    if (contextType === VoiceSessionType.Channel) {
      if (isPrivate) {
        // Private channel: use channel-specific members (no roles available)
        return (channelMembers || [])
          .filter((membership) => membership.user)
          .map((membership) => ({
            id: membership.user!.id,
            username: membership.user!.username,
            displayName: membership.user!.displayName,
            avatarUrl: membership.user!.avatarUrl,
            status: membership.user!.status,
          }));
      }
      // Public channel: use community members (includes roles)
      return (communityMembers || [])
        .filter((membership) => membership.user)
        .map((membership) => ({
          id: membership.user!.id,
          username: membership.user!.username,
          displayName: membership.user!.displayName,
          avatarUrl: membership.user!.avatarUrl,
          status: membership.user!.status,
          displayRole: computeDisplayRole(membership.roles),
        }));
    } else {
      // DM context
      return (dmGroup?.members || [])
        .map((member) => ({
          id: member.user.id,
          username: member.user.username,
          displayName: member.user.displayName,
          avatarUrl: member.user.avatarUrl,
          status: member.user.status,
        }));
    }
  }, [contextType, isPrivate, channelMembers, communityMembers, dmGroup]);

  // Extract user IDs for presence lookup
  const userIds = React.useMemo(() =>
    baseMembers.map(member => member.id),
    [baseMembers]
  );

  // Fetch presence data for all members
  const {
    data: presenceData,
    isLoading: isPresenceLoading,
    error: presenceError,
  } = useQuery({
    ...presenceControllerGetMultipleUserPresenceOptions({ path: { userIds: userIds.join(',') } }),
    enabled: userIds.length > 0,
    staleTime: 60_000,
  });

  // Transform and normalize member data with presence
  const { members, isLoading, error, title } = React.useMemo(() => {
    const membersWithPresence: MemberData[] = baseMembers
      .map((member) => ({
        ...member,
        isOnline: presenceData?.presence?.[member.id] || false,
      }));

    const combinedLoading = contextType === VoiceSessionType.Channel
      ? (isPrivate === undefined ? true : isPrivate ? isChannelMembersLoading : isCommunityLoading) || isPresenceLoading
      : isDmLoading || isPresenceLoading;

    const combinedError = contextType === VoiceSessionType.Channel
      ? (isPrivate ? channelMembersError : communityError) || presenceError
      : dmError || presenceError;

    const listTitle = contextType === VoiceSessionType.Channel
      ? "Members"
      : (dmGroup?.isGroup ? "Group Members" : "Participants");

    return {
      members: membersWithPresence,
      isLoading: combinedLoading,
      error: combinedError,
      title: listTitle,
    };
  }, [
    baseMembers,
    presenceData,
    contextType,
    isPrivate,
    isChannelMembersLoading,
    isCommunityLoading,
    isDmLoading,
    isPresenceLoading,
    channelMembersError,
    communityError,
    dmError,
    presenceError,
    dmGroup?.isGroup,
  ]);

  return (
    <MemberList
      members={members}
      isLoading={isLoading}
      error={error}
      title={title}
      communityId={communityId}
    />
  );
};

export default MemberListContainer;