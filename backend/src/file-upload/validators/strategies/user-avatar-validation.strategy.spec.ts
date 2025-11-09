import { UserAvatarValidationStrategy } from './user-avatar-validation.strategy';

describe('UserAvatarValidationStrategy', () => {
  let strategy: UserAvatarValidationStrategy;

  beforeEach(() => {
    strategy = new UserAvatarValidationStrategy();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('getAllowedMimeTypes', () => {
    it('should return array of allowed MIME types', () => {
      const mimeTypes = strategy.getAllowedMimeTypes();

      expect(Array.isArray(mimeTypes)).toBe(true);
      expect(mimeTypes.length).toBeGreaterThan(0);
    });

    it('should include common image formats', () => {
      const mimeTypes = strategy.getAllowedMimeTypes();

      expect(mimeTypes).toContain('image/jpeg');
      expect(mimeTypes).toContain('image/jpg');
      expect(mimeTypes).toContain('image/png');
      expect(mimeTypes).toContain('image/gif');
      expect(mimeTypes).toContain('image/webp');
    });

    it('should only include image formats', () => {
      const mimeTypes = strategy.getAllowedMimeTypes();

      mimeTypes.forEach((type) => {
        expect(type).toMatch(/^image\//);
      });
    });

    it('should not include video or document types', () => {
      const mimeTypes = strategy.getAllowedMimeTypes();

      expect(mimeTypes).not.toContain('video/mp4');
      expect(mimeTypes).not.toContain('application/pdf');
      expect(mimeTypes).not.toContain('text/plain');
    });
  });

  describe('getMaxFileSize', () => {
    it('should return 10MB', () => {
      const size = strategy.getMaxFileSize();

      expect(size).toBe(10 * 1024 * 1024);
    });

    it('should return same size for all calls', () => {
      const size1 = strategy.getMaxFileSize();
      const size2 = strategy.getMaxFileSize();
      const size3 = strategy.getMaxFileSize();

      expect(size1).toBe(size2);
      expect(size2).toBe(size3);
      expect(size1).toBe(10 * 1024 * 1024);
    });
  });

  describe('getValidationDescription', () => {
    it('should return description string', () => {
      const description = strategy.getValidationDescription();

      expect(description).toBeDefined();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
    });

    it('should mention images and size limit', () => {
      const description = strategy.getValidationDescription();

      expect(description).toContain('Images');
      expect(description).toContain('10MB');
    });

    it('should mention supported formats', () => {
      const description = strategy.getValidationDescription();

      expect(description).toContain('JPEG');
      expect(description).toContain('PNG');
      expect(description).toContain('GIF');
      expect(description).toContain('WebP');
    });
  });
});
