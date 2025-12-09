import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '@/database/database.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  UserFactory,
  RefreshTokenFactory,
  createMockDatabase,
  createMockJwtService,
  createMockConfigService,
} from '@/test-utils';
import { UserEntity } from '@/user/dto/user-response.dto';

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let jwtService: JwtService;
  let mockDatabase: ReturnType<typeof createMockDatabase>;

  const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findByUsername: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: createMockJwtService(),
        },
        {
          provide: DatabaseService,
          useValue: mockDatabase,
        },
        {
          provide: ConfigService,
          useValue: createMockConfigService({
            JWT_REFRESH_SECRET: 'test-refresh-secret',
          }),
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw error if JWT_REFRESH_SECRET is not set', () => {
      expect(() => {
        new AuthService(
          userService,
          jwtService,
          mockDatabase as unknown as DatabaseService,
          createMockConfigService({
            JWT_REFRESH_SECRET: undefined,
          }) as unknown as ConfigService,
        );
      }).toThrow('JWT_REFRESH_SECRET not set');
    });
  });

  describe('validateUser', () => {
    it('should return user entity when credentials are valid', async () => {
      const mockUser = UserFactory.build({
        username: 'testuser',
        hashedPassword: 'hashed-password',
      });

      jest.spyOn(userService, 'findByUsername').mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.validateUser('TestUser', 'correct-password');

      expect(result).toBeInstanceOf(UserEntity);
      expect(result?.username).toBe(mockUser.username);
      expect(userService.findByUsername).toHaveBeenCalledWith('testuser');
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'correct-password',
        mockUser.hashedPassword,
      );
    });

    it('should return null when user is not found', async () => {
      jest.spyOn(userService, 'findByUsername').mockResolvedValue(null);

      const result = await service.validateUser('nonexistent', 'password');

      expect(result).toBeNull();
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should return null when password is incorrect', async () => {
      const mockUser = UserFactory.build({
        username: 'testuser',
        hashedPassword: 'hashed-password',
      });

      jest.spyOn(userService, 'findByUsername').mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false as never);

      const result = await service.validateUser('testuser', 'wrong-password');

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'wrong-password',
        mockUser.hashedPassword,
      );
    });

    it('should convert username to lowercase before querying', async () => {
      const mockUser = UserFactory.build({ username: 'testuser' });

      jest.spyOn(userService, 'findByUsername').mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true as never);

      await service.validateUser('TESTUSER', 'password');

      expect(userService.findByUsername).toHaveBeenCalledWith('testuser');
    });
  });

  describe('login', () => {
    it('should generate JWT token with correct payload', () => {
      const user = new UserEntity(UserFactory.build());
      const mockToken = 'mock-jwt-token';

      jest.spyOn(jwtService, 'sign').mockReturnValue(mockToken);

      const result = service.login(user);

      expect(result).toBe(mockToken);
      expect(jwtService.sign).toHaveBeenCalledWith({
        username: user.username,
        sub: user.id,
        role: user.role,
      });
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token and store hash in database', async () => {
      const userId = 'user-123';
      const mockRefreshToken = 'mock-refresh-token';
      const mockHash = 'hashed-token';

      jest.spyOn(jwtService, 'sign').mockReturnValue(mockRefreshToken);
      mockBcrypt.hash.mockResolvedValue(mockHash as never);
      mockDatabase.refreshToken.create.mockResolvedValue({
        id: 'token-id',
        userId,
        tokenHash: mockHash,
      });

      const result = await service.generateRefreshToken(userId);

      expect(result).toBe(mockRefreshToken);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: userId }),
        expect.objectContaining({
          secret: 'test-refresh-secret',
          expiresIn: '30d',
        }),
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(mockRefreshToken, 10);
      expect(mockDatabase.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('should use transaction client when provided', async () => {
      const userId = 'user-123';
      const mockTx = createMockDatabase();
      const mockRefreshToken = 'mock-refresh-token';
      const mockHash = 'hashed-token';

      jest.spyOn(jwtService, 'sign').mockReturnValue(mockRefreshToken);
      mockBcrypt.hash.mockResolvedValue(mockHash as never);
      mockTx.refreshToken.create.mockResolvedValue({
        id: 'token-id',
        userId,
        tokenHash: mockHash,
      });

      await service.generateRefreshToken(
        userId,
        undefined, // deviceInfo
        mockTx as unknown as Parameters<typeof service.generateRefreshToken>[2],
      );

      expect(mockTx.refreshToken.create).toHaveBeenCalled();
      expect(mockDatabase.refreshToken.create).not.toHaveBeenCalled();
    });

    it('should generate unique jti for each token', async () => {
      const userId = 'user-123';
      const calls: Array<{ sub: string; jti: string }> = [];

      jest
        .spyOn(jwtService, 'sign')
        .mockImplementation((payload: { sub: string; jti: string }) => {
          calls.push(payload);
          return 'mock-token';
        });
      mockBcrypt.hash.mockResolvedValue('hash' as never);
      mockDatabase.refreshToken.create.mockResolvedValue({
        id: 'id',
        userId,
        tokenHash: 'hash',
        expiresAt: new Date(),
      });

      await service.generateRefreshToken(userId);
      await service.generateRefreshToken(userId);

      expect(calls[0]?.jti).toBeDefined();
      expect(calls[1]?.jti).toBeDefined();
      expect(calls[0]?.jti).not.toBe(calls[1]?.jti);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token and return user with jti', async () => {
      const mockUser = UserFactory.build();
      const jti = 'token-jti-123';
      const refreshToken = 'valid-refresh-token';

      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        sub: mockUser.id,
        jti,
      });
      jest.spyOn(userService, 'findById').mockResolvedValue(mockUser);

      const [user, returnedJti] =
        await service.verifyRefreshToken(refreshToken);

      expect(user).toBeInstanceOf(UserEntity);
      expect(user.id).toBe(mockUser.id);
      expect(returnedJti).toBe(jti);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(refreshToken, {
        secret: 'test-refresh-secret',
        ignoreExpiration: false,
      });
    });

    it('should throw UnauthorizedException when token verification fails', async () => {
      jest
        .spyOn(jwtService, 'verifyAsync')
        .mockResolvedValue(
          undefined as unknown as { sub: string; jti: string },
        );

      await expect(service.verifyRefreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({
        sub: 'nonexistent-user-id',
        jti: 'jti-123',
      });
      jest.spyOn(userService, 'findById').mockResolvedValue(null);

      await expect(service.verifyRefreshToken('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('validateRefreshToken', () => {
    it('should return token id when token is valid and not expired', async () => {
      const jti = 'token-jti-123';
      const refreshToken = 'valid-token';
      const mockToken = RefreshTokenFactory.build({
        id: jti,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
      });

      mockDatabase.refreshToken.findUnique.mockResolvedValue(mockToken);
      mockBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.validateRefreshToken(jti, refreshToken);

      expect(result).toBe(jti);
      expect(mockDatabase.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { id: jti },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        refreshToken,
        mockToken.tokenHash,
      );
    });

    it('should return null when token is expired', async () => {
      const jti = 'expired-token-jti';
      const refreshToken = 'expired-token';
      const mockToken = RefreshTokenFactory.buildExpired({ id: jti });

      mockDatabase.refreshToken.findUnique.mockResolvedValue(mockToken);
      mockBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.validateRefreshToken(jti, refreshToken);

      expect(result).toBeNull();
    });

    it('should return null when token not found in database', async () => {
      mockDatabase.refreshToken.findUnique.mockResolvedValue(null);
      mockBcrypt.compare.mockResolvedValue(false as never);

      const result = await service.validateRefreshToken('nonexistent', 'token');

      expect(result).toBeNull();
      // bcrypt.compare should still be called with dummy hash to prevent timing attacks
      expect(bcrypt.compare).toHaveBeenCalled();
    });

    it('should always call bcrypt.compare to prevent timing attacks (token exists)', async () => {
      const jti = 'existing-token';
      const mockToken = RefreshTokenFactory.build({ id: jti });

      mockDatabase.refreshToken.findUnique.mockResolvedValue(mockToken);
      mockBcrypt.compare.mockResolvedValue(true as never);

      await service.validateRefreshToken(jti, 'token');

      expect(bcrypt.compare).toHaveBeenCalledWith('token', mockToken.tokenHash);
    });

    it('should always call bcrypt.compare to prevent timing attacks (token missing)', async () => {
      mockDatabase.refreshToken.findUnique.mockResolvedValue(null);
      mockBcrypt.compare.mockResolvedValue(false as never);

      await service.validateRefreshToken('nonexistent', 'token');

      // Should compare against dummy hash when token not found
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'token',
        expect.stringContaining('$2b$10$'),
      );
    });

    it('should return null when token hash does not match', async () => {
      const jti = 'token-jti-123';
      const refreshToken = 'wrong-token';
      const mockToken = RefreshTokenFactory.build({ id: jti });

      mockDatabase.refreshToken.findUnique.mockResolvedValue(mockToken);
      mockBcrypt.compare.mockResolvedValue(false as never);

      const result = await service.validateRefreshToken(jti, refreshToken);

      expect(result).toBeNull();
    });
  });

  describe('removeRefreshToken', () => {
    it('should delete valid refresh token', async () => {
      const jti = 'token-jti-123';
      const refreshToken = 'valid-token';
      const mockToken = RefreshTokenFactory.build({ id: jti });

      mockDatabase.refreshToken.findUnique.mockResolvedValue(mockToken);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockDatabase.refreshToken.delete.mockResolvedValue(mockToken);

      await service.removeRefreshToken(jti, refreshToken);

      expect(mockDatabase.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: jti },
      });
    });

    it('should throw UnauthorizedException when token not found', async () => {
      mockDatabase.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        service.removeRefreshToken('nonexistent', 'token'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockDatabase.refreshToken.delete).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when token hash does not match', async () => {
      const jti = 'token-jti-123';
      const mockToken = RefreshTokenFactory.build({ id: jti });

      mockDatabase.refreshToken.findUnique.mockResolvedValue(mockToken);
      mockBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.removeRefreshToken(jti, 'wrong-token'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockDatabase.refreshToken.delete).not.toHaveBeenCalled();
    });

    it('should use transaction client when provided', async () => {
      const mockTx = createMockDatabase();
      const jti = 'token-jti-123';
      const mockToken = RefreshTokenFactory.build({ id: jti });

      mockTx.refreshToken.findUnique.mockResolvedValue(mockToken);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockTx.refreshToken.delete.mockResolvedValue(mockToken);

      await service.removeRefreshToken(
        jti,
        'token',
        mockTx as unknown as Parameters<typeof service.removeRefreshToken>[2],
      );

      expect(mockTx.refreshToken.delete).toHaveBeenCalled();
      expect(mockDatabase.refreshToken.delete).not.toHaveBeenCalled();
    });
  });

  describe('cleanExpiredTokens', () => {
    it('should delete expired tokens and log count', async () => {
      const mockDeleteResult = { count: 5 };

      mockDatabase.refreshToken.deleteMany.mockResolvedValue(mockDeleteResult);

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.cleanExpiredTokens();

      expect(mockDatabase.refreshToken.deleteMany).toHaveBeenCalledTimes(1);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('5 expired refresh tokens'),
      );
    });

    it('should handle zero expired tokens', async () => {
      mockDatabase.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.cleanExpiredTokens();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('0 expired refresh tokens'),
      );
    });
  });
});
