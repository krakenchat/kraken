import { TestBed } from '@suites/unit';
import { PublicAccessStrategy } from './public-access.strategy';

describe('PublicAccessStrategy', () => {
  let strategy: PublicAccessStrategy;

  beforeEach(async () => {
    const { unit } = await TestBed.solitary(PublicAccessStrategy).compile();

    strategy = unit;
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('checkAccess', () => {
    it('should always grant access for public files', async () => {
      const result = await strategy.checkAccess(
        'user-123',
        'resource-456',
        'file-789',
      );

      expect(result).toBe(true);
    });

    it('should grant access regardless of user ID', async () => {
      const result1 = await strategy.checkAccess(
        'user-1',
        'resource-1',
        'file-1',
      );
      const result2 = await strategy.checkAccess(
        'user-2',
        'resource-2',
        'file-2',
      );
      const result3 = await strategy.checkAccess(
        'anonymous',
        'resource-3',
        'file-3',
      );

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it('should grant access for any file ID', async () => {
      const fileIds = ['file-1', 'file-2', 'avatar-123', 'banner-456'];

      for (const fileId of fileIds) {
        const result = await strategy.checkAccess('user-1', 'resource', fileId);
        expect(result).toBe(true);
      }
    });
  });
});
