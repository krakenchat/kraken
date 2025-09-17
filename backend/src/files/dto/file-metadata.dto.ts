export class FileMetadataDto {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  isPublic: boolean;
  uploadedById: string;
  createdAt: Date;
  downloadUrl: string;
}