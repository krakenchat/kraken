import React, { useState, useEffect, useRef } from "react";
import type { CreateCommunityFormData } from "../types/create-community.type";

interface FormErrors {
  name?: string;
  description?: string;
}

interface PreviewUrls {
  avatar: string | null;
  banner: string | null;
}

interface UseCommunityFormProps {
  initialData?: {
    name: string;
    description: string;
    avatar: string | null;
    banner: string | null;
  };
}

export const useCommunityForm = (props?: UseCommunityFormProps) => {
  const [formData, setFormData] = useState<CreateCommunityFormData>({
    name: props?.initialData?.name || "",
    description: props?.initialData?.description || "",
    avatar: null,
    banner: null,
  });

  const [previewUrls, setPreviewUrls] = useState<PreviewUrls>({
    avatar: props?.initialData?.avatar || null,
    banner: props?.initialData?.banner || null,
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const previewUrlRefs = useRef<PreviewUrls>({ avatar: null, banner: null });

  useEffect(() => {
    return () => {
      if (previewUrlRefs.current.avatar) URL.revokeObjectURL(previewUrlRefs.current.avatar);
      if (previewUrlRefs.current.banner) URL.revokeObjectURL(previewUrlRefs.current.banner);
    };
  }, []);

  const handleInputChange =
    (field: keyof CreateCommunityFormData) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (field === "avatar" || field === "banner") {
        const file = event.target.files?.[0] || null;
        setFormData((prev: CreateCommunityFormData) => ({
          ...prev,
          [field]: file,
        }));

        // Create preview URL
        if (file) {
          // Revoke old blob URL to prevent memory leak
          const oldUrl = previewUrlRefs.current[field as keyof PreviewUrls];
          if (oldUrl) {
            URL.revokeObjectURL(oldUrl);
          }
          const url = URL.createObjectURL(file);
          previewUrlRefs.current = { ...previewUrlRefs.current, [field]: url };
          setPreviewUrls((prev: PreviewUrls) => ({ ...prev, [field]: url }));
        } else {
          const oldUrl = previewUrlRefs.current[field as keyof PreviewUrls];
          if (oldUrl) {
            URL.revokeObjectURL(oldUrl);
            previewUrlRefs.current = { ...previewUrlRefs.current, [field]: null };
          }
          setPreviewUrls((prev: PreviewUrls) => ({ ...prev, [field]: null }));
        }
      } else {
        setFormData((prev: CreateCommunityFormData) => ({
          ...prev,
          [field]: event.target.value,
        }));

        // Clear error when user starts typing
        if (field in formErrors && formErrors[field as keyof FormErrors]) {
          setFormErrors((prev: FormErrors) => ({
            ...prev,
            [field]: undefined,
          }));
        }
      }
    };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.name.trim()) {
      errors.name = "Community name is required";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Community name must be at least 2 characters";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const updateFormData = (data: Partial<CreateCommunityFormData>) => {
    setFormData((prev: CreateCommunityFormData) => ({ ...prev, ...data }));
  };

  const updatePreviewUrls = (urls: Partial<PreviewUrls>) => {
    setPreviewUrls((prev) => ({ ...prev, ...urls }));
  };

  return {
    formData,
    previewUrls,
    formErrors,
    handleInputChange,
    validateForm,
    updateFormData,
    updatePreviewUrls,
    setFormData,
    setPreviewUrls,
  };
};
