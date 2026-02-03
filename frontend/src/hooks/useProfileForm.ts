import { useState, useCallback, useEffect, useRef, ChangeEvent } from "react";

export interface ProfileFormData {
  displayName: string;
  avatar: File | null;
  banner: File | null;
  bio: string;
  status: string;
}

export interface ProfilePreviewUrls {
  avatar: string | null;
  banner: string | null;
}

export interface ProfileFormErrors {
  displayName?: string;
  bio?: string;
  status?: string;
}

export const useProfileForm = (
  initialDisplayName = "",
  initialBio = "",
  initialStatus = ""
) => {
  const [formData, setFormData] = useState<ProfileFormData>({
    displayName: initialDisplayName,
    avatar: null,
    banner: null,
    bio: initialBio,
    status: initialStatus,
  });

  const [previewUrls, setPreviewUrls] = useState<ProfilePreviewUrls>({
    avatar: null,
    banner: null,
  });

  const [formErrors, setFormErrors] = useState<ProfileFormErrors>({});

  const previewUrlRefs = useRef<ProfilePreviewUrls>({ avatar: null, banner: null });

  useEffect(() => {
    return () => {
      if (previewUrlRefs.current.avatar) URL.revokeObjectURL(previewUrlRefs.current.avatar);
      if (previewUrlRefs.current.banner) URL.revokeObjectURL(previewUrlRefs.current.banner);
    };
  }, []);

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

            // Revoke old preview URL to prevent memory leak
            const oldUrl = previewUrlRefs.current[field as keyof ProfilePreviewUrls];
            if (oldUrl) {
              URL.revokeObjectURL(oldUrl);
            }
            const objectUrl = URL.createObjectURL(file);
            previewUrlRefs.current = { ...previewUrlRefs.current, [field]: objectUrl };
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

    if (formData.bio.length > 500) {
      errors.bio = "Bio must be 500 characters or less";
    }

    if (formData.status.length > 128) {
      errors.status = "Status must be 128 characters or less";
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
