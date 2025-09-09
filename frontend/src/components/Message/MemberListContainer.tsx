import React from "react";
import MemberList from "./MemberList";
import { useGetMembersForCommunityQuery } from "../../features/membership/membershipApiSlice";
import { useGetDmGroupQuery } from "../../features/directMessages/directMessagesApiSlice";

interface MemberData {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
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
  } = useGetMembersForCommunityQuery(communityId || "", {
    skip: contextType !== "channel" || !communityId,
  });

  // For DM context, fetch DM group members
  const {
    data: dmGroup,
    isLoading: isDmLoading,
    error: dmError,
  } = useGetDmGroupQuery(contextId, {
    skip: contextType !== "dm",
  });

  // Transform and normalize member data based on context
  const { members, isLoading, error, title } = React.useMemo(() => {
    if (contextType === "channel") {
      const normalizedMembers: MemberData[] = (communityMembers || [])
        .filter((membership) => membership.user) // Only include members with user data
        .map((membership) => ({
          id: membership.user!.id,
          username: membership.user!.username,
          displayName: membership.user!.displayName,
          avatarUrl: membership.user!.avatarUrl,
        }))
        .sort((a, b) => a.username.localeCompare(b.username)); // Sort alphabetically

      return {
        members: normalizedMembers,
        isLoading: isCommunityLoading,
        error: communityError,
        title: "Members",
      };
    } else {
      // DM context
      const normalizedMembers: MemberData[] = (dmGroup?.members || [])
        .map((member) => ({
          id: member.user.id,
          username: member.user.username,
          displayName: member.user.displayName,
          avatarUrl: member.user.avatarUrl,
        }))
        .sort((a, b) => a.username.localeCompare(b.username)); // Sort alphabetically

      return {
        members: normalizedMembers,
        isLoading: isDmLoading,
        error: dmError,
        title: dmGroup?.isGroup ? "Group Members" : "Participants",
      };
    }
  }, [
    contextType,
    communityMembers,
    dmGroup,
    isCommunityLoading,
    isDmLoading,
    communityError,
    dmError,
  ]);

  return (
    <MemberList
      members={members}
      isLoading={isLoading}
      error={error}
      title={title}
    />
  );
};

export default MemberListContainer;