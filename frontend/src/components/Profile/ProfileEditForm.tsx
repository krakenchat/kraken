import React from "react";
import { TextField, Box } from "@mui/material";
import UserAvatarUpload from "./UserAvatarUpload";
import UserBannerUpload from "./UserBannerUpload";
import type { ProfileFormData, ProfilePreviewUrls, ProfileFormErrors } from "../../hooks/useProfileForm";

interface ProfileEditFormProps {
  formData: ProfileFormData;
  previewUrls: ProfilePreviewUrls;
  formErrors: ProfileFormErrors;
  onDisplayNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAvatarChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBannerChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
  formData,
  previewUrls,
  formErrors,
  onDisplayNameChange,
  onAvatarChange,
  onBannerChange,
}) => {
  return (
    <Box>
      <UserBannerUpload
        previewUrl={previewUrls.banner}
        onChange={onBannerChange}
      />

      <UserAvatarUpload
        previewUrl={previewUrls.avatar}
        displayName={formData.displayName}
        onChange={onAvatarChange}
      />

      <TextField
        fullWidth
        label="Display Name"
        value={formData.displayName}
        onChange={onDisplayNameChange}
        error={!!formErrors.displayName}
        helperText={formErrors.displayName || "Your display name (1-32 characters)"}
        margin="normal"
        required
      />
    </Box>
  );
};

export default ProfileEditForm;
