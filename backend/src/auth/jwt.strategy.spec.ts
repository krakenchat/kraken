import { TestBed } from '@suites/unit';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '@/database/database.service';
import { createMockDatabase } from '@/test-utils';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockDatabase: ReturnType<typeof createMockDatabase>;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test-secret-key';
      return null;
    }),
  };

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const { unit } = await TestBed.solitary(JwtStrategy)
      .mock(ConfigService)
      .final(mockConfigService)
      .mock(DatabaseService)
      .final(mockDatabase)
      .compile();

    strategy = unit;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('constructor', () => {
    it('should throw error when JWT_SECRET is not set', () => {
      const badConfigService = {
        get: jest.fn(() => null),
      };

      expect(() => {
        new JwtStrategy(badConfigService as any, mockDatabase as any);
      }).toThrow('JWT_SECRET not set');
    });

    it('should initialize with JWT_SECRET from config', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('JWT_SECRET');
      expect(strategy).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should validate JWT payload and return user', async () => {
      const payload = {
        sub: 'user-123',
        username: 'testuser',
      };

      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
      };

      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      expect(result).toEqual(mockUser);
      expect(mockDatabase.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should throw error when user not found', async () => {
      const payload = {
        sub: 'non-existent-user',
        username: 'ghost',
      };

      mockDatabase.user.findUniqueOrThrow.mockRejectedValue(
        new Error('User not found'),
      );

      await expect(strategy.validate(payload)).rejects.toThrow(
        'User not found',
      );
    });

    it('should validate multiple different users', async () => {
      const users = [
        { id: 'user-1', username: 'alice', email: 'alice@test.com' },
        { id: 'user-2', username: 'bob', email: 'bob@test.com' },
        { id: 'user-3', username: 'charlie', email: 'charlie@test.com' },
      ];

      for (const user of users) {
        mockDatabase.user.findUniqueOrThrow.mockResolvedValue(user);

        const result = await strategy.validate({
          sub: user.id,
          username: user.username,
        });

        expect(result).toEqual(user);
        expect(mockDatabase.user.findUniqueOrThrow).toHaveBeenCalledWith({
          where: { id: user.id },
        });

        jest.clearAllMocks();
      }
    });

    it('should handle payload with only sub field', async () => {
      const payload = {
        sub: 'user-456',
        username: 'anyname',
      };

      const mockUser = {
        id: 'user-456',
        username: 'actualname',
        email: 'actual@test.com',
      };

      mockDatabase.user.findUniqueOrThrow.mockResolvedValue(mockUser);

      const result = await strategy.validate(payload);

      // Should return actual user data from DB, not payload username
      expect(result.username).toBe('actualname');
      expect(result.id).toBe('user-456');
    });
  });
});
