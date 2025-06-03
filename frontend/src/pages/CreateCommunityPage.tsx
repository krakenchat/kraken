import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Avatar,
  IconButton,
  CircularProgress,
  Alert,
  styled,
} from "@mui/material";
import { PhotoCamera, Upload, ArrowBack } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useCreateCommunityMutation } from "../features/community/communityApiSlice";
import type { CreateCommunityFormData } from "../types/create-community.type";

const Root = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minHeight: "100vh",
  padding: theme.spacing(2),
  background: theme.palette.background.default,
}));

const FormContainer = styled(Paper)(({ theme }) => ({
  maxWidth: 600,
  width: "100%",
  padding: theme.spacing(4),
  borderRadius: theme.spacing(2),
}));

const HeaderSection = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  marginBottom: theme.spacing(3),
  gap: theme.spacing(2),
}));

const BannerSection = styled(Box)(({ theme }) => ({
  position: "relative",
  height: 200,
  borderRadius: theme.spacing(1),
  marginBottom: theme.spacing(3),
  border: `2px dashed ${theme.palette.divider}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  backgroundColor: theme.palette.background.default,
  cursor: "pointer",
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
}));

const BannerPreview = styled("img")({
  width: "100%",
  height: "100%",
  objectFit: "cover",
});

const AvatarSection = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
  marginBottom: theme.spacing(3),
}));

const AvatarUpload = styled(Box)(() => ({
  position: "relative",
  display: "inline-block",
}));

const AvatarInput = styled("input")({
  display: "none",
});

const BannerInput = styled("input")({
  display: "none",
});

const FormFields = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
}));

const ActionButtons = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(2),
  justifyContent: "flex-end",
  marginTop: theme.spacing(3),
}));

const CreateCommunityPage: React.FC = () => {
  const navigate = useNavigate();
  const [createCommunity, { isLoading, error }] = useCreateCommunityMutation();

  const [formData, setFormData] = useState<CreateCommunityFormData>({
    name: "",
    description: "",
    avatar: null,
    banner: null,
  });

  const [previewUrls, setPreviewUrls] = useState<{
    avatar: string | null;
    banner: string | null;
  }>({
    avatar: null,
    banner: null,
  });

  const [formErrors, setFormErrors] = useState<{
    name?: string;
    description?: string;
  }>({});

  const handleInputChange =
    (field: keyof CreateCommunityFormData) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (field === "avatar" || field === "banner") {
        const file = event.target.files?.[0] || null;
        setFormData((prev) => ({ ...prev, [field]: file }));

        // Create preview URL
        if (file) {
          const url = URL.createObjectURL(file);
          setPreviewUrls((prev) => ({ ...prev, [field]: url }));
        } else {
          setPreviewUrls((prev) => ({ ...prev, [field]: null }));
        }
      } else {
        setFormData((prev) => ({ ...prev, [field]: event.target.value }));

        // Clear error when user starts typing
        if (formErrors[field]) {
          setFormErrors((prev) => ({ ...prev, [field]: undefined }));
        }
      }
    };

  const validateForm = (): boolean => {
    const errors: { name?: string; description?: string } = {};

    if (!formData.name.trim()) {
      errors.name = "Community name is required";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Community name must be at least 2 characters";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

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
    <Root>
      <FormContainer>
        <HeaderSection>
          <IconButton onClick={handleGoBack} edge="start">
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" component="h1" fontWeight={600}>
            Create Community
          </Typography>
        </HeaderSection>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Failed to create community. Please try again.
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          {/* Banner Upload */}
          <BannerSection>
            <BannerInput
              accept="image/*"
              id="banner-upload"
              type="file"
              onChange={handleInputChange("banner")}
            />
            <label
              htmlFor="banner-upload"
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {previewUrls.banner ? (
                <BannerPreview src={previewUrls.banner} alt="Banner preview" />
              ) : (
                <Box
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  gap={1}
                >
                  <Upload sx={{ fontSize: 48, color: "text.secondary" }} />
                  <Typography variant="body2" color="text.secondary">
                    Click to upload banner image
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    Recommended: 600x200px
                  </Typography>
                </Box>
              )}
            </label>
          </BannerSection>

          {/* Avatar Upload */}
          <AvatarSection>
            <AvatarUpload>
              <Avatar
                src={previewUrls.avatar || undefined}
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: "primary.main",
                  fontSize: 32,
                  fontWeight: 600,
                }}
              >
                {formData.name.slice(0, 2).toUpperCase() || "CC"}
              </Avatar>
              <AvatarInput
                accept="image/*"
                id="avatar-upload"
                type="file"
                onChange={handleInputChange("avatar")}
              />
              <label htmlFor="avatar-upload">
                <IconButton
                  component="span"
                  sx={{
                    position: "absolute",
                    bottom: -4,
                    right: -4,
                    backgroundColor: "background.paper",
                    border: "2px solid",
                    borderColor: "divider",
                    "&:hover": {
                      backgroundColor: "grey.100",
                    },
                  }}
                >
                  <PhotoCamera fontSize="small" />
                </IconButton>
              </label>
            </AvatarUpload>
            <Typography variant="body2" color="text.secondary">
              Upload a community avatar
            </Typography>
          </AvatarSection>

          {/* Form Fields */}
          <FormFields>
            <TextField
              label="Community Name"
              variant="outlined"
              value={formData.name}
              onChange={handleInputChange("name")}
              error={!!formErrors.name}
              helperText={formErrors.name}
              required
              fullWidth
              autoFocus
            />

            <TextField
              label="Description"
              variant="outlined"
              value={formData.description}
              onChange={handleInputChange("description")}
              multiline
              rows={3}
              fullWidth
              placeholder="Tell people what your community is about..."
            />
          </FormFields>

          {/* Action Buttons */}
          <ActionButtons>
            <Button
              variant="outlined"
              onClick={handleGoBack}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isLoading || !formData.name.trim()}
              startIcon={isLoading && <CircularProgress size={16} />}
            >
              {isLoading ? "Creating..." : "Create Community"}
            </Button>
          </ActionButtons>
        </form>
      </FormContainer>
    </Root>
  );
};

export default CreateCommunityPage;
