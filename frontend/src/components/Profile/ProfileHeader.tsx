import React from "react";
import { Box, Avatar, Typography, styled } from "@mui/material";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";
import type { User } from "../../types/auth.type";

const BannerContainer = styled(Box)(({ theme }) => ({
  position: "relative",
  height: 200,
  width: "100%",
  backgroundColor: theme.palette.primary.dark,
  borderRadius: theme.spacing(1, 1, 0, 0),
  overflow: "hidden",
}));

const BannerImage = styled("img")({
  width: "100%",
  height: "100%",
  objectFit: "cover",
});

const ProfileContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  paddingTop: theme.spacing(8),
  position: "relative",
}));

const AvatarContainer = styled(Box)(() => ({
  position: "absolute",
  top: -60,
  left: 24,
}));

interface ProfileHeaderProps {
  user: User;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ user }) => {
  const { blobUrl: bannerUrl } = useAuthenticatedImage(
    user.bannerUrl || null
  );
  const { blobUrl: avatarUrl } = useAuthenticatedImage(
    user.avatarUrl || null
  );

  return (
    <Box>
      <BannerContainer>
        {bannerUrl && <BannerImage src={bannerUrl} alt="Profile banner" />}
      </BannerContainer>
      <ProfileContent>
        <AvatarContainer>
          <Avatar
            src={avatarUrl || undefined}
            sx={{
              width: 120,
              height: 120,
              border: "4px solid",
              borderColor: "background.paper",
              bgcolor: "primary.main",
              fontSize: 48,
              fontWeight: 600,
            }}
          >
            {(user.displayName || user.username).slice(0, 2).toUpperCase()}
          </Avatar>
        </AvatarContainer>
        <Box ml={17}>
          <Typography variant="h4" fontWeight={600} gutterBottom>
            {user.displayName || user.username}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            @{user.username}
          </Typography>
        </Box>
      </ProfileContent>
    </Box>
  );
};

export default ProfileHeader;
