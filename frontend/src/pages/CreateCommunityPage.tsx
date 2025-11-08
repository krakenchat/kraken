import React from "react";
import { useNavigate } from "react-router-dom";
import { useCreateCommunityMutation } from "../features/community/communityApiSlice";
import { useCommunityForm } from "../hooks/useCommunityForm";
import {
  CommunityFormLayout,
  CommunityFormContent,
} from "../components/Community";

const CreateCommunityPage: React.FC = () => {
  const navigate = useNavigate();
  const [createCommunity, { isLoading, error }] = useCreateCommunityMutation();
  
  const {
    formData,
    previewUrls,
    formErrors,
    handleInputChange,
    validateForm,
  } = useCommunityForm();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      // For now, we'll submit without file uploads
      // In a real app, you'd want to upload files to a storage service first
      const createCommunityDto = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        avatar: null, // TODO: Implement file upload
        banner: null, // TODO: Implement file upload
      };

      const result = await createCommunity(createCommunityDto).unwrap();

      // Navigate to the newly created community
      navigate(`/community/${result.id}`);
    } catch (err) {
      console.error("Failed to create community:", err);
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <CommunityFormLayout
      title="Create Community"
      onGoBack={handleGoBack}
      onSubmit={handleSubmit}
      error={error}
      errorMessage="Failed to create community. Please try again."
      isLoading={isLoading}
      isFormValid={formData.name.trim().length > 0}
      submitButtonText="Create Community"
      loadingText="Creating..."
    >
      <CommunityFormContent
        formData={formData}
        previewUrls={previewUrls}
        formErrors={formErrors}
        onNameChange={handleInputChange("name")}
        onDescriptionChange={handleInputChange("description")}
        onAvatarChange={handleInputChange("avatar")}
        onBannerChange={handleInputChange("banner")}
      />
    </CommunityFormLayout>
  );
};

export default CreateCommunityPage;
