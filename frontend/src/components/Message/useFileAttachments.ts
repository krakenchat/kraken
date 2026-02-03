/**
 * useFileAttachments Hook
 *
 * Shared file attachment logic for MessageInput components.
 * Handles file selection, image previews, file removal, and validation.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { MAX_FILE_SIZE, MAX_FILES_PER_MESSAGE } from "../../constants/messages";

export interface UseFileAttachmentsReturn {
  selectedFiles: File[];
  filePreviews: Map<number, string>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveFile: (index: number) => void;
  handleFileButtonClick: () => void;
  clearFiles: () => void;
  validationError: string | null;
  clearValidationError: () => void;
}

/**
 * Custom hook for managing file attachments in message inputs
 */
export function useFileAttachments(): UseFileAttachmentsReturn {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<Map<number, string>>(new Map());
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileCountRef = useRef(0);

  // Cleanup file previews on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      setFilePreviews(new Map());
      setSelectedFiles([]);
    };
  }, []);

  const clearValidationError = useCallback(() => {
    setValidationError(null);
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);

      // Validate file sizes
      const oversizedFile = fileArray.find(file => file.size > MAX_FILE_SIZE);
      if (oversizedFile) {
        setValidationError(`File "${oversizedFile.name}" exceeds the 10MB size limit`);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      // Validate total file count
      const currentCount = fileCountRef.current;
      if (currentCount + fileArray.length > MAX_FILES_PER_MESSAGE) {
        setValidationError(`Maximum ${MAX_FILES_PER_MESSAGE} files per message`);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      // Use ref for startIndex to avoid stale closure
      const startIndex = fileCountRef.current;

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

      // Update ref synchronously before React batches the state update
      fileCountRef.current += fileArray.length;
      setSelectedFiles(prev => [...prev, ...fileArray]);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    fileCountRef.current = Math.max(0, fileCountRef.current - 1);
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
    fileCountRef.current = 0;
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
    validationError,
    clearValidationError,
  };
}
