import { CustomEmojiValidationStrategy } from './custom-emoji-validation.strategy';

describe('CustomEmojiValidationStrategy', () => {
  let strategy: CustomEmojiValidationStrategy;

  beforeEach(() => {
    strategy = new CustomEmojiValidationStrategy();
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

    it('should include PNG, GIF, and WebP formats', () => {
      const mimeTypes = strategy.getAllowedMimeTypes();

      expect(mimeTypes).toContain('image/png');
      expect(mimeTypes).toContain('image/gif');
      expect(mimeTypes).toContain('image/webp');
    });

    it('should not include JPEG format', () => {
      const mimeTypes = strategy.getAllowedMimeTypes();

      expect(mimeTypes).not.toContain('image/jpeg');
      expect(mimeTypes).not.toContain('image/jpg');
    });

    it('should only include image formats', () => {
      const mimeTypes = strategy.getAllowedMimeTypes();

      mimeTypes.forEach((type) => {
        expect(type).toMatch(/^image\//);
      });
    });

    it('should have exactly 3 allowed types', () => {
      const mimeTypes = strategy.getAllowedMimeTypes();

      expect(mimeTypes).toHaveLength(3);
    });

    it('should not include video or document types', () => {
      const mimeTypes = strategy.getAllowedMimeTypes();

      expect(mimeTypes).not.toContain('video/mp4');
      expect(mimeTypes).not.toContain('application/pdf');
      expect(mimeTypes).not.toContain('text/plain');
    });
  });

  describe('getMaxFileSize', () => {
    it('should return 256KB', () => {
      const size = strategy.getMaxFileSize();

      expect(size).toBe(256 * 1024);
    });

    it('should return same size for all calls', () => {
      const size1 = strategy.getMaxFileSize();
      const size2 = strategy.getMaxFileSize();
      const size3 = strategy.getMaxFileSize();

      expect(size1).toBe(size2);
      expect(size2).toBe(size3);
      expect(size1).toBe(256 * 1024);
    });

    it('should be much smaller than user avatar limit', () => {
      const size = strategy.getMaxFileSize();
      const userAvatarSize = 10 * 1024 * 1024;

      expect(size).toBeLessThan(userAvatarSize);
    });

    it('should be exactly 262144 bytes', () => {
      const size = strategy.getMaxFileSize();

      expect(size).toBe(262144);
    });
  });

  describe('getValidationDescription', () => {
    it('should return description string', () => {
      const description = strategy.getValidationDescription();

      expect(description).toBeDefined();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
    });

    it('should mention PNG, GIF, and WebP', () => {
      const description = strategy.getValidationDescription();

      expect(description).toContain('PNG');
      expect(description).toContain('GIF');
      expect(description).toContain('WebP');
    });

    it('should mention size limit', () => {
      const description = strategy.getValidationDescription();

      expect(description).toContain('256KB');
    });

    it('should mention square dimensions', () => {
      const description = strategy.getValidationDescription();

      expect(description.toLowerCase()).toContain('square');
    });

    it('should indicate only specific formats allowed', () => {
      const description = strategy.getValidationDescription();

      expect(description.toLowerCase()).toContain('only');
    });
  });
});
