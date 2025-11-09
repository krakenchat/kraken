import { CommunityBannerValidationStrategy } from './community-banner-validation.strategy';

describe('CommunityBannerValidationStrategy', () => {
  let strategy: CommunityBannerValidationStrategy;

  beforeEach(() => {
    strategy = new CommunityBannerValidationStrategy();
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

    it('should support all standard image formats for banners', () => {
      const mimeTypes = strategy.getAllowedMimeTypes();

      expect(mimeTypes).toHaveLength(5);
      expect(mimeTypes).toEqual(
        expect.arrayContaining([
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
        ]),
      );
    });
  });

  describe('getMaxFileSize', () => {
    it('should return 25MB', () => {
      const size = strategy.getMaxFileSize();

      expect(size).toBe(25 * 1024 * 1024);
    });

    it('should return same size for all calls', () => {
      const size1 = strategy.getMaxFileSize();
      const size2 = strategy.getMaxFileSize();
      const size3 = strategy.getMaxFileSize();

      expect(size1).toBe(size2);
      expect(size2).toBe(size3);
      expect(size1).toBe(25 * 1024 * 1024);
    });

    it('should be larger than user avatar limit', () => {
      const size = strategy.getMaxFileSize();
      const userAvatarSize = 10 * 1024 * 1024;

      expect(size).toBeGreaterThan(userAvatarSize);
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
      expect(description).toContain('25MB');
    });

    it('should mention supported formats', () => {
      const description = strategy.getValidationDescription();

      expect(description).toContain('JPEG');
      expect(description).toContain('PNG');
      expect(description).toContain('GIF');
      expect(description).toContain('WebP');
    });

    it('should indicate images only', () => {
      const description = strategy.getValidationDescription();

      expect(description.toLowerCase()).toContain('images only');
    });
  });
});
