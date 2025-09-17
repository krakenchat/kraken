export interface StorageResult {
  path: string;
  size: number;
}

export interface IStorageService {
  // Core operations
  upload(file: any, fileId: string): Promise<StorageResult>;
  download(fileId: string, extension: string): Promise<Buffer>;
  delete(fileId: string, extension: string): Promise<void>;
  exists(fileId: string, extension: string): Promise<boolean>;

  // Utility operations
  generatePath(fileId: string, extension: string): string;
  getFileExtension(filename: string): string;
}