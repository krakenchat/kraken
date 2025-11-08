/**
 * Message Constants
 *
 * Configuration values for messaging features.
 */

/**
 * Maximum number of messages to keep in Redux state per channel/DM
 * Prevents memory issues with very long chat histories
 */
export const MAX_MESSAGES = 1000;

/**
 * Maximum file size for uploads (in bytes)
 * Default: 10MB
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Maximum number of files per message
 */
export const MAX_FILES_PER_MESSAGE = 10;

/**
 * Supported file types for message attachments
 * This is a permissive list - backend should also validate
 */
export const ACCEPTED_FILE_TYPES = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'text/*',
].join(',');
