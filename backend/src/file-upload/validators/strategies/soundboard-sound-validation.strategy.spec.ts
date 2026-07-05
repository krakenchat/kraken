import { SoundboardSoundValidationStrategy } from './soundboard-sound-validation.strategy';

describe('SoundboardSoundValidationStrategy', () => {
  let strategy: SoundboardSoundValidationStrategy;

  beforeEach(() => {
    strategy = new SoundboardSoundValidationStrategy();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('getAllowedMimeTypes', () => {
    it('allows common short-clip audio formats', () => {
      const mimeTypes = strategy.getAllowedMimeTypes();

      expect(mimeTypes).toContain('audio/mpeg');
      expect(mimeTypes).toContain('audio/wav');
      expect(mimeTypes).toContain('audio/ogg');
      expect(mimeTypes).toContain('audio/webm');
      expect(mimeTypes).toContain('audio/aac');
    });

    it('only includes audio formats', () => {
      const mimeTypes = strategy.getAllowedMimeTypes();

      mimeTypes.forEach((type) => {
        expect(type.startsWith('audio/')).toBe(true);
      });
    });

    it('does not allow images or video', () => {
      const mimeTypes = strategy.getAllowedMimeTypes();

      expect(mimeTypes).not.toContain('image/png');
      expect(mimeTypes).not.toContain('video/mp4');
    });
  });

  describe('getMaxFileSize', () => {
    it('caps clips at 1MB to keep them short', () => {
      expect(strategy.getMaxFileSize()).toBe(1024 * 1024);
    });
  });

  describe('getValidationDescription', () => {
    it('returns a human-readable description', () => {
      expect(strategy.getValidationDescription()).toContain('audio');
    });
  });
});
