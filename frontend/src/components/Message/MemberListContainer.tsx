import React from "react";
import MemberList from "./MemberList";
import { useQuery } from "@tanstack/react-query";
import {
  membershipControllerFindAllForCommunityOptions,
  presenceControllerGetMultipleUserPresenceOptions,
} from "../../api-client/@tanstack/react-query.gen";
import { directMessagesControllerFindDmGroupOptions } from "../../api-client/@tanstack/react-query.gen";

interface MemberData {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  isOnline?: boolean;
  status?: string | null;
}

interface MemberListContainerProps {
  contextType: "channel" | "dm";
  contextId: string;
  communityId?: string;
}

const MemberListContainer: React.FC<MemberListContainerProps> = ({
  contextType,
  contextId,
  communityId,
}) => {
  // For channel context, fetch community members
  const {
    data: communityMembers,
    isLoading: isCommunityLoading,
    error: communityError,
  } = useQuery({
    ...membershipControllerFindAllForCommunityOptions({ path: { communityId: communityId || "" } }),
    enabled: contextType === "channel" && !!communityId,
  });

  // For DM context, fetch DM group members
  const {
    data: dmGroup,
    isLoading: isDmLoading,
    error: dmError,
  } = useQuery({
    ...directMessagesControllerFindDmGroupOptions({ path: { id: contextId } }),
    enabled: contextType === "dm",
  });

  // Get base member data first
  const baseMembers = React.useMemo(() => {
    if (contextType === "channel") {
      return (communityMembers || [])
        .filter((membership) => membership.user) // Only include members with user data
        .map((membership) => ({
          id: membership.user!.id,
          username: membership.user!.username,
          displayName: membership.user!.displayName,
          avatarUrl: membership.user!.avatarUrl,
          status: membership.user!.status,
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
  }, [contextType, communityMembers, dmGroup]);

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
      }))
      .sort((a, b) => {
        // Sort by online status first (online users first), then alphabetically
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return a.username.localeCompare(b.username);
      });

    const combinedLoading = contextType === "channel" 
      ? isCommunityLoading || isPresenceLoading
      : isDmLoading || isPresenceLoading;
    
    const combinedError = contextType === "channel" 
      ? communityError || presenceError
      : dmError || presenceError;

    const listTitle = contextType === "channel" 
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
    isCommunityLoading,
    isDmLoading,
    isPresenceLoading,
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