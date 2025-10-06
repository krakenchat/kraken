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
import { useGetUserByIdQuery, useProfileQuery } from "../features/users/usersSlice";
import { ProfileHeader } from "../components/Profile";

const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const { data: currentUser } = useProfileQuery();
  const { data: profileUser, isLoading, error } = useGetUserByIdQuery(userId!, {
    skip: !userId,
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
    </Container>
  );
};

export default ProfilePage;
