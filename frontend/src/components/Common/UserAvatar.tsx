import React from "react";
import { Avatar, Skeleton, Box } from "@mui/material";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";
import UserStatusIndicator from "../Message/UserStatusIndicator";
import { useUserProfile } from "../../contexts/UserProfileContext";

type AvatarSize = "small" | "medium" | "large" | "xlarge";

const sizeMap: Record<AvatarSize, number> = {
  small: 32,
  medium: 40,
  large: 48,
  xlarge: 120,
};

interface UserAvatarProps {
  user?: {
    id?: string;
    avatarUrl?: string | null;
    username?: string;
    displayName?: string | null;
  } | null;
  size?: AvatarSize;
  showStatus?: boolean;
  isOnline?: boolean;
  clickable?: boolean;
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = "medium",
  showStatus = false,
  isOnline = false,
  clickable = false,
}) => {
  const avatarSize = sizeMap[size];
  const { blobUrl, isLoading } = useAuthenticatedImage(user?.avatarUrl);
  const { openProfile } = useUserProfile();

  // Get initials from displayName or username
  const getInitials = () => {
    if (!user) return "?";
    const name = user.displayName || user.username;
    if (!name) return "?";
    return name.charAt(0).toUpperCase();
  };

  const handleClick = () => {
    if (clickable && user?.id) {
      openProfile(user.id);
    }
  };

  if (isLoading) {
    return (
      <Skeleton
        variant="circular"
        width={avatarSize}
        height={avatarSize}
      />
    );
  }

  const avatar = (
    <Avatar
      src={blobUrl || undefined}
      sx={{
        width: avatarSize,
        height: avatarSize,
        cursor: clickable && user?.id ? "pointer" : "default",
        transition: "opacity 0.2s",
        "&:hover": clickable && user?.id ? { opacity: 0.8 } : {},
      }}
      onClick={handleClick}
    >
      {getInitials()}
    </Avatar>
  );

  if (showStatus) {
    return (
      <Box sx={{ position: "relative", display: "inline-block" }}>
        {avatar}
        <UserStatusIndicator isOnline={isOnline} />
      </Box>
    );
  }

  return avatar;
};

export default React.memo(UserAvatar);
