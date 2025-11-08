/**
 * useFileAttachments Hook
 *
 * Shared file attachment logic for MessageInput components.
 * Handles file selection, image previews, and file removal.
 */

import { useState, useCallback, useEffect, useRef } from "react";

export interface UseFileAttachmentsReturn {
  selectedFiles: File[];
  filePreviews: Map<number, string>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveFile: (index: number) => void;
  handleFileButtonClick: () => void;
  clearFiles: () => void;
}

/**
 * Custom hook for managing file attachments in message inputs
 */
export function useFileAttachments(): UseFileAttachmentsReturn {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<Map<number, string>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup file previews on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      setFilePreviews(new Map());
      setSelectedFiles([]);
    };
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      const startIndex = selectedFiles.length;

      // Generate previews for image files
      fileArray.forEach((file, idx) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              setFilePreviews(prev => new Map(prev).set(startIndex + idx, e.target!.result as string));
            }
          };
          reader.readAsDataURL(file);
        }
      });

      setSelectedFiles(prev => [...prev, ...fileArray]);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [selectedFiles.length]);

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => {
      const newPreviews = new Map(prev);
      newPreviews.delete(index);
      return newPreviews;
    });
  }, []);

  const handleFileButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const clearFiles = useCallback(() => {
    setSelectedFiles([]);
    setFilePreviews(new Map());
  }, []);

  return {
    selectedFiles,
    filePreviews,
    fileInputRef,
    handleFileSelect,
    handleRemoveFile,
    handleFileButtonClick,
    clearFiles,
  };
}
