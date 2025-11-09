import { LocalStrategy } from './local.strategy';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: AuthService;

  const mockAuthService = {
    validateUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStrategy,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    strategy = module.get<LocalStrategy>(LocalStrategy);
    authService = module.get<AuthService>(AuthService);
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

      mockAuthService.validateUser.mockResolvedValue(mockUser);

      const result = await strategy.validate('testuser', 'password123');

      expect(result).toEqual(mockUser);
      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        'testuser',
        'password123',
      );
    });

    it('should throw UnauthorizedException when user is null', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('baduser', 'badpass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is undefined', async () => {
      mockAuthService.validateUser.mockResolvedValue(undefined);

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
        mockAuthService.validateUser.mockResolvedValue(user);

        const result = await strategy.validate(user.username, 'password');

        expect(result).toEqual(user);
        expect(mockAuthService.validateUser).toHaveBeenCalledWith(
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

      mockAuthService.validateUser.mockResolvedValue(mockUser);

      const result = await strategy.validate('user@domain.com', 'P@ssw0rd!#$%');

      expect(result).toEqual(mockUser);
      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        'user@domain.com',
        'P@ssw0rd!#$%',
      );
    });

    it('should throw UnauthorizedException on service error', async () => {
      mockAuthService.validateUser.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(strategy.validate('user', 'pass')).rejects.toThrow();
    });

    it('should handle empty username', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle empty password', async () => {
      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(strategy.validate('username', '')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
