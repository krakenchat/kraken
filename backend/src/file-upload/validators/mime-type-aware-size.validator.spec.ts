import { MimeTypeAwareSizeValidator } from './mime-type-aware-size.validator';

describe('MimeTypeAwareSizeValidator', () => {
  let validator: MimeTypeAwareSizeValidator;

  beforeEach(() => {
    validator = new MimeTypeAwareSizeValidator({});
  });

  it('should be defined', () => {
    expect(validator).toBeDefined();
  });

  describe('isValid', () => {
    it('should return false when file is undefined', () => {
      const result = validator.isValid(undefined);

      expect(result).toBe(false);
    });

    it('should return false when file is null', () => {
      const result = validator.isValid(null as any);

      expect(result).toBe(false);
    });

    it('should return true for video file under 500MB', () => {
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

      const result = validator.isValid(file);

      expect(result).toBe(true);
    });

    it('should return false for video file over 500MB', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.mp4',
        encoding: '7bit',
        mimetype: 'video/mp4',
        size: 600 * 1024 * 1024, // 600MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = validator.isValid(file);

      expect(result).toBe(false);
    });

    it('should return true for image file under 25MB', () => {
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

      const result = validator.isValid(file);

      expect(result).toBe(true);
    });

    it('should return false for image file over 25MB', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 30 * 1024 * 1024, // 30MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = validator.isValid(file);

      expect(result).toBe(false);
    });

    it('should return true for audio file under 50MB', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.mp3',
        encoding: '7bit',
        mimetype: 'audio/mpeg',
        size: 25 * 1024 * 1024, // 25MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = validator.isValid(file);

      expect(result).toBe(true);
    });

    it('should return false for audio file over 50MB', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.mp3',
        encoding: '7bit',
        mimetype: 'audio/mpeg',
        size: 60 * 1024 * 1024, // 60MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = validator.isValid(file);

      expect(result).toBe(false);
    });

    it('should return true for document file under 100MB', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 50 * 1024 * 1024, // 50MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = validator.isValid(file);

      expect(result).toBe(true);
    });

    it('should return false for document file over 100MB', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 150 * 1024 * 1024, // 150MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = validator.isValid(file);

      expect(result).toBe(false);
    });

    it('should accept file at exact size limit', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 25 * 1024 * 1024, // Exactly 25MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = validator.isValid(file);

      expect(result).toBe(true);
    });
  });

  describe('buildErrorMessage', () => {
    it('should build error message for oversized video', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.mp4',
        encoding: '7bit',
        mimetype: 'video/mp4',
        size: 600 * 1024 * 1024, // 600MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const message = validator.buildErrorMessage(file);

      expect(message).toContain('File too large');
      expect(message).toContain('600.00MB');
      expect(message).toContain('500.00MB');
      expect(message).toContain('video/mp4');
    });

    it('should build error message for oversized image', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 30 * 1024 * 1024, // 30MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const message = validator.buildErrorMessage(file);

      expect(message).toContain('File too large');
      expect(message).toContain('30.00MB');
      expect(message).toContain('25.00MB');
      expect(message).toContain('image/jpeg');
    });

    it('should build error message for oversized audio', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.mp3',
        encoding: '7bit',
        mimetype: 'audio/mpeg',
        size: 60 * 1024 * 1024, // 60MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const message = validator.buildErrorMessage(file);

      expect(message).toContain('File too large');
      expect(message).toContain('60.00MB');
      expect(message).toContain('50.00MB');
      expect(message).toContain('audio/mpeg');
    });

    it('should build error message for oversized document', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 150 * 1024 * 1024, // 150MB
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const message = validator.buildErrorMessage(file);

      expect(message).toContain('File too large');
      expect(message).toContain('150.00MB');
      expect(message).toContain('100.00MB');
      expect(message).toContain('application/pdf');
    });

    it('should format file sizes to 2 decimal places', () => {
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 26214400, // 25.00MB exactly
        buffer: Buffer.from(''),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const message = validator.buildErrorMessage(file);

      expect(message).toMatch(/\d+\.\d{2}MB/);
    });
  });
});
