import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { LocalStrategy } from './local.strategy';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: Mocked<AuthService>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(LocalStrategy).compile();

    strategy = unit;
    authService = unitRef.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should have authService', () => {
    expect(authService).toBeDefined();
  });

  describe('validate', () => {
    it('should return user when credentials are valid', async () => {
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User',
      };

      authService.validateUser.mockResolvedValue(mockUser as any);

      const result = await strategy.validate('testuser', 'password123');

      expect(result).toEqual(mockUser);
      expect(authService.validateUser).toHaveBeenCalledWith(
        'testuser',
        'password123',
      );
    });

    it('should throw UnauthorizedException when user is null', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('baduser', 'badpass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is undefined', async () => {
      authService.validateUser.mockResolvedValue(undefined as any);

      await expect(strategy.validate('nouser', 'nopass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should validate multiple users with different credentials', async () => {
      const users = [
        { id: '1', username: 'alice', email: 'alice@test.com' },
        { id: '2', username: 'bob', email: 'bob@test.com' },
        { id: '3', username: 'charlie', email: 'charlie@test.com' },
      ];

      for (const user of users) {
        authService.validateUser.mockResolvedValue(user as any);

        const result = await strategy.validate(user.username, 'password');

        expect(result).toEqual(user);
        expect(authService.validateUser).toHaveBeenCalledWith(
          user.username,
          'password',
        );

        jest.clearAllMocks();
      }
    });

    it('should handle special characters in username and password', async () => {
      const mockUser = {
        id: 'user-special',
        username: 'user@domain.com',
        email: 'user@domain.com',
      };

      authService.validateUser.mockResolvedValue(mockUser as any);

      const result = await strategy.validate('user@domain.com', 'P@ssw0rd!#$%');

      expect(result).toEqual(mockUser);
      expect(authService.validateUser).toHaveBeenCalledWith(
        'user@domain.com',
        'P@ssw0rd!#$%',
      );
    });

    it('should throw UnauthorizedException on service error', async () => {
      authService.validateUser.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(strategy.validate('user', 'pass')).rejects.toThrow();
    });

    it('should handle empty username', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle empty password', async () => {
      authService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('username', '')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
