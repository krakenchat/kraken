import { useState, useCallback, ChangeEvent } from "react";

export interface ProfileFormData {
  displayName: string;
  avatar: File | null;
  banner: File | null;
}

export interface ProfilePreviewUrls {
  avatar: string | null;
  banner: string | null;
}

export interface ProfileFormErrors {
  displayName?: string;
}

export const useProfileForm = (initialDisplayName = "") => {
  const [formData, setFormData] = useState<ProfileFormData>({
    displayName: initialDisplayName,
    avatar: null,
    banner: null,
  });

  const [previewUrls, setPreviewUrls] = useState<ProfilePreviewUrls>({
    avatar: null,
    banner: null,
  });

  const [formErrors, setFormErrors] = useState<ProfileFormErrors>({});

  const handleInputChange = useCallback(
    (field: keyof ProfileFormData) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (event.target instanceof HTMLInputElement && event.target.files) {
          const file = event.target.files[0];
          if (file) {
            setFormData((prev) => ({
              ...prev,
              [field]: file,
            }));

            // Create preview URL for image files
            const objectUrl = URL.createObjectURL(file);
            setPreviewUrls((prev) => ({
              ...prev,
              [field]: objectUrl,
            }));
          }
        } else {
          setFormData((prev) => ({
            ...prev,
            [field]: event.target.value,
          }));
        }
      },
    []
  );

  const validateForm = useCallback((): boolean => {
    const errors: ProfileFormErrors = {};

    if (formData.displayName.trim() === "") {
      errors.displayName = "Display name is required";
    } else if (formData.displayName.trim().length > 32) {
      errors.displayName = "Display name must be 32 characters or less";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  return {
    formData,
    previewUrls,
    formErrors,
    handleInputChange,
    validateForm,
    setFormData,
    setPreviewUrls,
  };
};
