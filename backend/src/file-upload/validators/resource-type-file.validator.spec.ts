import { ResourceType } from '@prisma/client';
import { ResourceTypeFileValidator } from './resource-type-file.validator';

describe('ResourceTypeFileValidator', () => {
  describe('MESSAGE_ATTACHMENT', () => {
    let validator: ResourceTypeFileValidator;

    beforeEach(() => {
      validator = new ResourceTypeFileValidator({
        resourceType: ResourceType.MESSAGE_ATTACHMENT,
      });
    });

    it('should be defined', () => {
      expect(validator).toBeDefined();
    });

    it('should accept valid image file', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 10 * 1024 * 1024, // 10MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await validator.isValid(file);

      expect(result).toBe(true);
    });

    it('should accept valid video file under limit', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.mp4',
        encoding: '7bit',
        mimetype: 'video/mp4',
        size: 100 * 1024 * 1024, // 100MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await validator.isValid(file);

      expect(result).toBe(true);
    });

    it('should reject file with invalid MIME type', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.exe',
        encoding: '7bit',
        mimetype: 'application/x-msdownload',
        size: 1024,
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await validator.isValid(file);

      expect(result).toBe(false);
    });

    it('should reject file exceeding size limit', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.mp4',
        encoding: '7bit',
        mimetype: 'video/mp4',
        size: 600 * 1024 * 1024, // 600MB (over 500MB limit)
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await validator.isValid(file);

      expect(result).toBe(false);
    });

    it('should return false when file is undefined', async () => {
      const result = await validator.isValid(undefined);

      expect(result).toBe(false);
    });
  });

  describe('USER_AVATAR', () => {
    let validator: ResourceTypeFileValidator;

    beforeEach(() => {
      validator = new ResourceTypeFileValidator({
        resourceType: ResourceType.USER_AVATAR,
      });
    });

    it('should accept valid image file under 10MB', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'avatar.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 5 * 1024 * 1024, // 5MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await validator.isValid(file);

      expect(result).toBe(true);
    });

    it('should reject image file over 10MB', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'avatar.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 15 * 1024 * 1024, // 15MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await validator.isValid(file);

      expect(result).toBe(false);
    });

    it('should reject non-image files', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'document.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await validator.isValid(file);

      expect(result).toBe(false);
    });
  });

  describe('COMMUNITY_BANNER', () => {
    let validator: ResourceTypeFileValidator;

    beforeEach(() => {
      validator = new ResourceTypeFileValidator({
        resourceType: ResourceType.COMMUNITY_BANNER,
      });
    });

    it('should accept valid image file under 25MB', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'banner.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 20 * 1024 * 1024, // 20MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await validator.isValid(file);

      expect(result).toBe(true);
    });

    it('should reject image file over 25MB', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'banner.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 30 * 1024 * 1024, // 30MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await validator.isValid(file);

      expect(result).toBe(false);
    });
  });

  describe('CUSTOM_EMOJI', () => {
    let validator: ResourceTypeFileValidator;

    beforeEach(() => {
      validator = new ResourceTypeFileValidator({
        resourceType: ResourceType.CUSTOM_EMOJI,
      });
    });

    it('should accept valid PNG file under 256KB', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'emoji.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 100 * 1024, // 100KB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await validator.isValid(file);

      expect(result).toBe(true);
    });

    it('should accept valid GIF file under 256KB', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'emoji.gif',
        encoding: '7bit',
        mimetype: 'image/gif',
        size: 200 * 1024, // 200KB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await validator.isValid(file);

      expect(result).toBe(true);
    });

    it('should reject file over 256KB', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'emoji.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 300 * 1024, // 300KB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await validator.isValid(file);

      expect(result).toBe(false);
    });

    it('should reject JPEG files (not in allowed types)', async () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'emoji.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 100 * 1024, // 100KB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await validator.isValid(file);

      expect(result).toBe(false);
    });
  });

  describe('buildErrorMessage', () => {
    it('should build error message for invalid MIME type', () => {
      const validator = new ResourceTypeFileValidator({
        resourceType: ResourceType.USER_AVATAR,
      });

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'document.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const message = validator.buildErrorMessage(file);

      expect(message).toContain('Invalid file type');
      expect(message).toContain('Images only');
    });

    it('should build error message for file too large', () => {
      const validator = new ResourceTypeFileValidator({
        resourceType: ResourceType.USER_AVATAR,
      });

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'avatar.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 15 * 1024 * 1024, // 15MB (over 10MB limit)
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const message = validator.buildErrorMessage(file);

      expect(message).toContain('File too large');
      expect(message).toContain('15.00MB');
      expect(message).toContain('10.00MB');
      expect(message).toContain('USER_AVATAR');
    });

    it('should build error message for invalid resource type', () => {
      const validator = new ResourceTypeFileValidator({
        resourceType: 'INVALID_TYPE' as any,
      });

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const message = validator.buildErrorMessage(file);

      expect(message).toContain('Invalid resource type');
      expect(message).toContain('INVALID_TYPE');
    });

    it('should include validation description in error message', () => {
      const validator = new ResourceTypeFileValidator({
        resourceType: ResourceType.MESSAGE_ATTACHMENT,
      });

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.exe',
        encoding: '7bit',
        mimetype: 'application/x-msdownload',
        size: 1024,
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const message = validator.buildErrorMessage(file);

      expect(message).toContain('Invalid file type');
    });
  });

  describe('edge cases', () => {
    it('should handle null file', async () => {
      const validator = new ResourceTypeFileValidator({
        resourceType: ResourceType.USER_AVATAR,
      });

      const result = await validator.isValid(null as any);

      expect(result).toBe(false);
    });

    it('should use correct strategy for USER_BANNER', async () => {
      const validator = new ResourceTypeFileValidator({
        resourceType: ResourceType.USER_BANNER,
      });

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'banner.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 5 * 1024 * 1024, // 5MB (under 10MB limit for UserAvatarStrategy)
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await validator.isValid(file);

      expect(result).toBe(true);
    });

    it('should use correct strategy for COMMUNITY_AVATAR', async () => {
      const validator = new ResourceTypeFileValidator({
        resourceType: ResourceType.COMMUNITY_AVATAR,
      });

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'avatar.png',
        encoding: '7bit',
        mimetype: 'image/png',
        size: 20 * 1024 * 1024, // 20MB (under 25MB limit for CommunityBannerStrategy)
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await validator.isValid(file);

      expect(result).toBe(true);
    });
  });
});
