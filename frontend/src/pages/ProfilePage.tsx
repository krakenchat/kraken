import React from "react";
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  Container,
  Paper,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import { Edit as EditIcon, ArrowBack as ArrowBackIcon } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { userControllerGetUserByIdOptions, userControllerGetProfileOptions } from "../api-client/@tanstack/react-query.gen";
import { ProfileHeader } from "../components/Profile";
import { ClipLibrary } from "../components/Profile/ClipLibrary";

const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const { data: currentUser } = useQuery(userControllerGetProfileOptions());
  const { data: profileUser, isLoading, error } = useQuery({
    ...userControllerGetUserByIdOptions({ path: { id: userId! } }),
    enabled: !!userId,
  });

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleEditProfile = () => {
    navigate("/profile/edit");
  };

  const isOwnProfile = currentUser?.id === userId;

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !profileUser) {
    return (
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Alert severity="error">
          Failed to load user profile. Please try again.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleGoBack}
          color="inherit"
        >
          Back
        </Button>
        {isOwnProfile && (
          <Button
            startIcon={<EditIcon />}
            onClick={handleEditProfile}
            variant="contained"
          >
            Edit Profile
          </Button>
        )}
      </Box>

      <Paper>
        <ProfileHeader user={profileUser} />
      </Paper>

      <Paper sx={{ mt: 3, p: 3 }}>
        <ClipLibrary userId={userId!} isOwnProfile={isOwnProfile} />
      </Paper>
    </Container>
  );
};

export default ProfilePage;
