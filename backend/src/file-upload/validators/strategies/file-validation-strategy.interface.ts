export interface IFileValidationStrategy {
  /**
   * Get the list of allowed MIME types for this resource type
   */
  getAllowedMimeTypes(): string[];

  /**
   * Get the maximum file size in bytes for this resource type
   */
  getMaxFileSize(mimeType: string): number;

  /**
   * Perform additional validation (e.g., image dimensions)
   * @param file - The uploaded file
   * @returns true if valid, false otherwise
   */
  validateAdditional?(file: Express.Multer.File): Promise<boolean>;

  /**
   * Get a human-readable description of the validation rules
   */
  getValidationDescription(): string;
}
