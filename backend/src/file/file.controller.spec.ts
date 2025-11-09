import { Test, TestingModule } from '@nestjs/testing';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { FileAccessGuard } from '@/file/file-access/file-access.guard';
import { NotFoundException } from '@nestjs/common';
import { StorageType, FileType } from '@prisma/client';
import { Response } from 'express';
import * as fs from 'fs';

jest.mock('fs');

describe('FileController', () => {
  let controller: FileController;
  let service: FileService;

  const mockFileService = {
    findOne: jest.fn(),
    markForDeletion: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  const mockResponse = {
    set: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileController],
      providers: [
        {
          provide: FileService,
          useValue: mockFileService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(FileAccessGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<FileController>(FileController);
    service = module.get<FileService>(FileService);

    // Reset mocks
    jest.clearAllMocks();

    // Mock createReadStream
    const mockStream = {
      on: jest.fn(),
      pipe: jest.fn(),
    };
    (fs.createReadStream as jest.Mock).mockReturnValue(mockStream);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have a service', () => {
    expect(service).toBeDefined();
  });

  describe('getFileMetadata', () => {
    it('should return file metadata', async () => {
      const fileId = 'file-123';
      const mockFile = {
        id: fileId,
        filename: 'test.png',
        mimeType: 'image/png',
        fileType: FileType.IMAGE,
        size: 1024,
        storageType: StorageType.LOCAL,
        storagePath: '/tmp/test.png',
      };

      mockFileService.findOne.mockResolvedValue(mockFile);

      const result = await controller.getFileMetadata(fileId);

      expect(result).toEqual({
        id: fileId,
        filename: 'test.png',
        mimeType: 'image/png',
        fileType: FileType.IMAGE,
        size: 1024,
      });
      expect(mockFileService.findOne).toHaveBeenCalledWith(fileId);
    });

    it('should throw NotFoundException if file not found', async () => {
      const fileId = 'non-existent';

      mockFileService.findOne.mockResolvedValue(null);

      await expect(controller.getFileMetadata(fileId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException on service error', async () => {
      const fileId = 'error-file';

      mockFileService.findOne.mockRejectedValue(new Error('Database error'));

      await expect(controller.getFileMetadata(fileId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle different file types', async () => {
      const fileTypes = [
        { type: FileType.VIDEO, mime: 'video/mp4' },
        { type: FileType.AUDIO, mime: 'audio/mpeg' },
        { type: FileType.DOCUMENT, mime: 'application/pdf' },
      ];

      for (const { type, mime } of fileTypes) {
        const mockFile = {
          id: 'file-123',
          filename: `test.${type.toLowerCase()}`,
          mimeType: mime,
          fileType: type,
          size: 2048,
          storageType: StorageType.LOCAL,
          storagePath: '/tmp/test',
        };

        mockFileService.findOne.mockResolvedValue(mockFile);

        const result = await controller.getFileMetadata('file-123');

        expect(result.fileType).toBe(type);
        expect(result.mimeType).toBe(mime);

        jest.clearAllMocks();
      }
    });
  });

  describe('getFile', () => {
    it('should return file stream for local storage', async () => {
      const fileId = 'file-456';
      const mockFile = {
        id: fileId,
        filename: 'download.pdf',
        mimeType: 'application/pdf',
        fileType: FileType.DOCUMENT,
        size: 4096,
        storageType: StorageType.LOCAL,
        storagePath: '/tmp/download.pdf',
      };

      mockFileService.findOne.mockResolvedValue(mockFile);

      const result = await controller.getFile(fileId, mockResponse);

      expect(mockFileService.findOne).toHaveBeenCalledWith(fileId);
      expect(fs.createReadStream).toHaveBeenCalledWith('/tmp/download.pdf');
      expect(mockResponse.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="download.pdf"',
      });
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException for non-local storage', async () => {
      const fileId = 'file-s3';
      const mockFile = {
        id: fileId,
        filename: 'remote.png',
        mimeType: 'image/png',
        fileType: FileType.IMAGE,
        size: 1024,
        storageType: StorageType.S3,
        storagePath: 's3://bucket/remote.png',
      };

      mockFileService.findOne.mockResolvedValue(mockFile);

      // Controller catches NotImplementedException and converts to NotFoundException
      await expect(controller.getFile(fileId, mockResponse)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if file not found', async () => {
      const fileId = 'missing-file';

      mockFileService.findOne.mockResolvedValue(null);

      await expect(controller.getFile(fileId, mockResponse)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException on service error', async () => {
      const fileId = 'error-file';

      mockFileService.findOne.mockRejectedValue(new Error('Database error'));

      await expect(controller.getFile(fileId, mockResponse)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should set correct content type for different file types', async () => {
      const files = [
        { mime: 'image/jpeg', filename: 'photo.jpg' },
        { mime: 'video/mp4', filename: 'video.mp4' },
        { mime: 'audio/mpeg', filename: 'song.mp3' },
        { mime: 'text/plain', filename: 'document.txt' },
      ];

      for (const { mime, filename } of files) {
        const mockFile = {
          id: 'file-123',
          filename,
          mimeType: mime,
          fileType: FileType.IMAGE,
          size: 1024,
          storageType: StorageType.LOCAL,
          storagePath: `/tmp/${filename}`,
        };

        mockFileService.findOne.mockResolvedValue(mockFile);

        await controller.getFile('file-123', mockResponse);

        expect(mockResponse.set).toHaveBeenCalledWith(
          expect.objectContaining({
            'Content-Type': mime,
          }),
        );

        jest.clearAllMocks();
      }
    });

    it('should handle filenames with special characters', async () => {
      const mockFile = {
        id: 'file-special',
        filename: 'my "special" file.pdf',
        mimeType: 'application/pdf',
        fileType: FileType.DOCUMENT,
        size: 2048,
        storageType: StorageType.LOCAL,
        storagePath: '/tmp/special.pdf',
      };

      mockFileService.findOne.mockResolvedValue(mockFile);

      await controller.getFile('file-special', mockResponse);

      expect(mockResponse.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Disposition': 'inline; filename="my "special" file.pdf"',
        }),
      );
    });
  });
});
