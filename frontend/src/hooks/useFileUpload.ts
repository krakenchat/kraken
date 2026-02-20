import { useState } from "react";
import { getApiUrl } from "../config/env";
import { getAccessToken } from "../utils/tokenService";

export type ResourceType =
  | "USER_AVATAR"
  | "USER_BANNER"
  | "COMMUNITY_AVATAR"
  | "COMMUNITY_BANNER"
  | "MESSAGE_ATTACHMENT"
  | "CUSTOM_EMOJI";

interface UploadFileOptions {
  resourceType: ResourceType;
  resourceId?: string | null;
}

interface UploadedFile {
  id: string;
  filename: string;
  mimeType: string;
  fileType: string;
  size: number;
  checksum: string;
  uploadedById: string;
  uploadedAt: string;
  resourceType: ResourceType;
  resourceId: string | null;
  storageType: string;
  storagePath: string;
  deletedAt: string | null;
}

interface UseFileUploadReturn {
  uploadFile: (file: File, options: UploadFileOptions) => Promise<UploadedFile>;
  isUploading: boolean;
  error: Error | null;
  resetError: () => void;
}

export const useFileUpload = (): UseFileUploadReturn => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const uploadFile = async (
    file: File,
    options: UploadFileOptions
  ): Promise<UploadedFile> => {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("resourceType", options.resourceType);

      if (options.resourceId !== undefined) {
        formData.append("resourceId", options.resourceId || "");
      }

      const token = getAccessToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch(getApiUrl("/file-upload"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Upload failed with status ${response.status}`
        );
      }

      const uploadedFile: UploadedFile = await response.json();
      return uploadedFile;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Upload failed");
      setError(error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const resetError = () => setError(null);

  return {
    uploadFile,
    isUploading,
    error,
    resetError,
  };
};
