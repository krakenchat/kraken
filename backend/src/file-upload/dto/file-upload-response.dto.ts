import { FileType, StorageType, ResourceType } from '@prisma/client';

export class FileUploadResponseDto {
  id: string;
  filename: string;
  mimeType: string;
  fileType: FileType;
  size: number;
  checksum: string;
  uploadedById: string | null;
  uploadedAt: Date;
  deletedAt: Date | null;
  resourceType: ResourceType;
  resourceId: string | null;
  storageType: StorageType;
  storagePath: string;
}
