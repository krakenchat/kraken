import React, { useEffect } from "react";
import { Box, CircularProgress, Alert } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetCommunityByIdQuery,
  useUpdateCommunityMutation,
} from "../features/community/communityApiSlice";
import { useCommunityForm } from "../hooks/useCommunityForm";
import {
  CommunityFormLayout,
  CommunityBannerUpload,
  CommunityAvatarUpload,
  CommunityFormFields,
} from "../components/Community";

const Root = ({ children }: { children: React.ReactNode }) => (
  <Box
    sx={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      padding: 2,
      background: "background.default",
    }}
  >
    {children}
  </Box>
);

const EditCommunityPage: React.FC = () => {
  const navigate = useNavigate();
  const { communityId } = useParams<{ communityId: string }>();
  const {
    data: community,
    isLoading: isLoadingCommunity,
    error: communityError,
  } = useGetCommunityByIdQuery(communityId!);
  const [updateCommunity, { isLoading, error }] = useUpdateCommunityMutation();

  const {
    formData,
    previewUrls,
    formErrors,
    handleInputChange,
    validateForm,
    setFormData,
    setPreviewUrls,
  } = useCommunityForm();

  // Populate form when community data loads
  useEffect(() => {
    if (community) {
      setFormData({
        name: community.name || "",
        description: community.description || "",
        avatar: null, // Keep as null for file input
        banner: null, // Keep as null for file input
      });
      setPreviewUrls({
        avatar: community.avatar || null,
        banner: community.banner || null,
      });
    }
  }, [community, setFormData, setPreviewUrls]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm() || !communityId) {
      return;
    }

    try {
      // For now, we'll submit without file uploads
      // In a real app, you'd want to upload files to a storage service first
      const updateCommunityDto = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        avatar: null, // TODO: Implement file upload
        banner: null, // TODO: Implement file upload
      };

      await updateCommunity({
        id: communityId,
        data: updateCommunityDto,
      }).unwrap();

      // Navigate back to the community
      navigate(`/community/${communityId}`);
    } catch (err) {
      console.error("Failed to update community:", err);
    }
  };

  const handleGoBack = () => {
    navigate(`/community/${communityId}`);
  };

  if (isLoadingCommunity) {
    return (
      <Root>
        <Box display="flex" justifyContent="center" alignItems="center">
          <CircularProgress />
        </Box>
      </Root>
    );
  }

  if (communityError || !community) {
    return (
      <Root>
        <Alert severity="error">
          Failed to load community. Please try again.
        </Alert>
      </Root>
    );
  }

  return (
    <CommunityFormLayout
      title="Edit Community"
      onGoBack={handleGoBack}
      onSubmit={handleSubmit}
      error={error}
      errorMessage="Failed to update community. Please try again."
      isLoading={isLoading}
      isFormValid={!!formData.name.trim()}
      submitButtonText="Update Community"
      loadingText="Updating..."
    >
      <CommunityBannerUpload
        previewUrl={previewUrls.banner}
        onChange={handleInputChange("banner")}
      />

      <CommunityAvatarUpload
        previewUrl={previewUrls.avatar}
        communityName={formData.name}
        onChange={handleInputChange("avatar")}
      />

      <CommunityFormFields
        name={formData.name}
        description={formData.description}
        onNameChange={handleInputChange("name")}
        onDescriptionChange={handleInputChange("description")}
        errors={formErrors}
      />
    </CommunityFormLayout>
  );
};

export default EditCommunityPage;
