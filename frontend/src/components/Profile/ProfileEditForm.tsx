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
  onBioChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onStatusChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
  formData,
  previewUrls,
  formErrors,
  onDisplayNameChange,
  onAvatarChange,
  onBannerChange,
  onBioChange,
  onStatusChange,
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
        error={Boolean(formErrors.displayName)}
        helperText={formErrors.displayName || "Your display name (1-32 characters)"}
        margin="normal"
        required
      />

      <TextField
        fullWidth
        label="Status"
        value={formData.status}
        onChange={onStatusChange}
        error={Boolean(formErrors.status)}
        helperText={formErrors.status || "What are you up to? (max 128 characters)"}
        margin="normal"
        placeholder="Set a custom status..."
      />

      <TextField
        fullWidth
        label="About Me"
        value={formData.bio}
        onChange={onBioChange}
        error={Boolean(formErrors.bio)}
        helperText={formErrors.bio || `${formData.bio.length}/500 characters`}
        margin="normal"
        multiline
        rows={4}
        placeholder="Tell others about yourself..."
      />
    </Box>
  );
};

export default ProfileEditForm;
