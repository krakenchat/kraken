import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { WsJwtAuthGuard } from './ws-jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '@/user/user.service';
import { TokenBlacklistService } from './token-blacklist.service';
import {
  UserFactory,
  createMockHttpExecutionContext,
  createMockWsExecutionContext,
  expectNoSensitiveUserFields,
} from '@/test-utils';
import { UserEntity } from '@/user/dto/user-response.dto';

describe('WsJwtAuthGuard', () => {
  let guard: WsJwtAuthGuard;
  let jwtService: Mocked<JwtService>;
  let userService: Mocked<UserService>;
  let tokenBlacklistService: Mocked<TokenBlacklistService>;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(WsJwtAuthGuard).compile();

    guard = unit;
    jwtService = unitRef.get(JwtService);
    userService = unitRef.get(UserService);
    tokenBlacklistService = unitRef.get(TokenBlacklistService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Non-WebSocket contexts', () => {
    it('should allow access for HTTP contexts', async () => {
      const context = createMockHttpExecutionContext({});

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtService.verify).not.toHaveBeenCalled();
    });

    it('should allow access for non-ws context types', async () => {
      const context = {
        getType: jest.fn().mockReturnValue('rpc'),
      } as any;

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('Token extraction from auth.token', () => {
    it('should authenticate with valid token from auth.token', async () => {
      const user = UserFactory.build();
      const mockClient = {
        id: 'socket-123',
        handshake: {
          auth: { token: 'valid-token-123' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
      jest.spyOn(userService, 'findById').mockResolvedValue(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith('valid-token-123');
      expect(userService.findById).toHaveBeenCalledWith(user.id);

      expect((mockClient.handshake as any).user).toBeInstanceOf(UserEntity);
      expect((mockClient.handshake as any).user.id).toBe(user.id);
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('should handle Bearer token in auth.token', async () => {
      const user = UserFactory.build();
      const mockClient = {
        id: 'socket-bearer',
        handshake: {
          auth: { token: 'Bearer bearer-token-456' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
      jest.spyOn(userService, 'findById').mockResolvedValue(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith('bearer-token-456');
    });
  });

  describe('Token extraction from authorization header', () => {
    it('should authenticate with valid token from authorization header', async () => {
      const user = UserFactory.build();
      const mockClient = {
        id: 'socket-header',
        handshake: {
          auth: {},
          headers: { authorization: 'header-token-789' },
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
      jest.spyOn(userService, 'findById').mockResolvedValue(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith('header-token-789');
    });

    it('should handle Bearer token in authorization header', async () => {
      const user = UserFactory.build();
      const mockClient = {
        id: 'socket-bearer-header',
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer header-bearer-token' },
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
      jest.spyOn(userService, 'findById').mockResolvedValue(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtService.verify).toHaveBeenCalledWith('header-bearer-token');
    });

    it('should prioritize auth.token over authorization header', async () => {
      const user = UserFactory.build();
      const mockClient = {
        id: 'socket-priority',
        handshake: {
          auth: { token: 'auth-token' },
          headers: { authorization: 'header-token' },
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
      jest.spyOn(userService, 'findById').mockResolvedValue(user);

      await guard.canActivate(context);

      expect(jwtService.verify).toHaveBeenCalledWith('auth-token');
    });
  });

  describe('Missing token scenarios', () => {
    it('should disconnect client and return false when no token provided', async () => {
      const mockClient = {
        id: 'socket-no-token',
        handshake: {
          auth: {},
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
      expect(jwtService.verify).not.toHaveBeenCalled();
    });

    it('should reject non-string token in auth.token', async () => {
      const mockClient = {
        id: 'socket-invalid-type',
        handshake: {
          auth: { token: 12345 },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    });

    it('should reject non-string token in authorization header', async () => {
      const mockClient = {
        id: 'socket-invalid-header',
        handshake: {
          auth: {},
          headers: { authorization: 12345 },
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('JWT verification failure', () => {
    it('should disconnect client when JWT verification fails', async () => {
      const mockClient = {
        id: 'socket-invalid-jwt',
        handshake: {
          auth: { token: 'invalid-token' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    });

    it('should disconnect client when JWT is expired', async () => {
      const mockClient = {
        id: 'socket-expired',
        handshake: {
          auth: { token: 'expired-token' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Token expired');
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('User not found', () => {
    it('should disconnect client when user not found', async () => {
      const mockClient = {
        id: 'socket-no-user',
        handshake: {
          auth: { token: 'valid-token-no-user' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest
        .spyOn(jwtService, 'verify')
        .mockReturnValue({ sub: 'nonexistent-user-id' });
      jest.spyOn(userService, 'findById').mockResolvedValue(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    });

    it('should disconnect client when user service throws error', async () => {
      const mockClient = {
        id: 'socket-user-error',
        handshake: {
          auth: { token: 'valid-token' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: 'user-id' });
      jest
        .spyOn(userService, 'findById')
        .mockRejectedValue(new Error('Database error'));

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('User attachment to handshake', () => {
    it('should attach user as UserEntity to handshake on successful authentication', async () => {
      const user = UserFactory.buildComplete({ banned: false });
      const mockClient = {
        id: 'socket-attach',
        handshake: {
          auth: { token: 'valid-token' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
      jest.spyOn(userService, 'findById').mockResolvedValue(user);

      await guard.canActivate(context);

      expect((mockClient.handshake as any).user).toBeInstanceOf(UserEntity);
      expect((mockClient.handshake as any).user.id).toBe(user.id);
    });

    it('should not leak sensitive fields in attached user', async () => {
      const user = UserFactory.buildComplete({ banned: false });
      const mockClient = {
        id: 'socket-sensitive',
        handshake: {
          auth: { token: 'valid-token' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
      jest.spyOn(userService, 'findById').mockResolvedValue(user);

      await guard.canActivate(context);

      expectNoSensitiveUserFields((mockClient.handshake as any).user);
    });

    it('should not attach user when authentication fails', async () => {
      const mockClient = {
        id: 'socket-no-attach',
        handshake: {
          auth: { token: 'invalid-token' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await guard.canActivate(context);

      expect((mockClient.handshake as any).user).toBeUndefined();
    });
  });

  describe('Short-circuit when user already attached by middleware', () => {
    it('should return true immediately if handshake.user is already set', async () => {
      const user = UserFactory.build();
      const mockClient = {
        id: 'socket-pre-auth',
        handshake: {
          user: new UserEntity(user),
          auth: { token: 'some-token' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtService.verify).not.toHaveBeenCalled();
      expect(userService.findById).not.toHaveBeenCalled();
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined handshake.auth', async () => {
      const mockClient = {
        id: 'socket-no-auth',
        handshake: {
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    });

    it('should handle undefined handshake.headers', async () => {
      const mockClient = {
        id: 'socket-no-headers',
        handshake: {
          auth: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    });

    it('should handle empty string token', async () => {
      const mockClient = {
        id: 'socket-empty-token',
        handshake: {
          auth: { token: '' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    });

    it('should handle token with only "Bearer " prefix', async () => {
      const mockClient = {
        id: 'socket-bearer-only',
        handshake: {
          auth: { token: 'Bearer ' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
      // Empty string after stripping "Bearer " is treated as missing token
      expect(jwtService.verify).not.toHaveBeenCalled();
    });
  });

  describe('Token blacklist checks', () => {
    it('should disconnect client and return false when token is blacklisted', async () => {
      const user = UserFactory.build();
      const mockClient = {
        id: 'socket-blacklisted',
        handshake: {
          auth: { token: 'blacklisted-token' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest
        .spyOn(jwtService, 'verify')
        .mockReturnValue({ sub: user.id, jti: 'revoked-jti' });
      jest
        .spyOn(tokenBlacklistService, 'isBlacklisted')
        .mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
      expect(tokenBlacklistService.isBlacklisted).toHaveBeenCalledWith(
        'revoked-jti',
      );
      // Should not attempt to look up the user
      expect(userService.findById).not.toHaveBeenCalled();
    });

    it('should allow connection when token has jti but is not blacklisted', async () => {
      const user = UserFactory.build();
      const mockClient = {
        id: 'socket-valid-jti',
        handshake: {
          auth: { token: 'valid-token-with-jti' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest
        .spyOn(jwtService, 'verify')
        .mockReturnValue({ sub: user.id, jti: 'valid-jti' });
      jest
        .spyOn(tokenBlacklistService, 'isBlacklisted')
        .mockResolvedValue(false);
      jest.spyOn(userService, 'findById').mockResolvedValue(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(tokenBlacklistService.isBlacklisted).toHaveBeenCalledWith(
        'valid-jti',
      );
      expect(userService.findById).toHaveBeenCalledWith(user.id);
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('should skip blacklist check when token has no jti', async () => {
      const user = UserFactory.build();
      const mockClient = {
        id: 'socket-no-jti',
        handshake: {
          auth: { token: 'token-without-jti' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
      jest.spyOn(userService, 'findById').mockResolvedValue(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(tokenBlacklistService.isBlacklisted).not.toHaveBeenCalled();
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('Banned user rejection', () => {
    it('should disconnect client and return false when user is banned', async () => {
      const bannedUser = UserFactory.build({ banned: true });
      const mockClient = {
        id: 'socket-banned-user',
        handshake: {
          auth: { token: 'valid-token' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: bannedUser.id });
      jest.spyOn(userService, 'findById').mockResolvedValue(bannedUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
      // Should not attach user to handshake
      expect((mockClient.handshake as any).user).toBeUndefined();
    });

    it('should allow connection when user is not banned', async () => {
      const user = UserFactory.build({ banned: false });
      const mockClient = {
        id: 'socket-not-banned',
        handshake: {
          auth: { token: 'valid-token' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: user.id });
      jest.spyOn(userService, 'findById').mockResolvedValue(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockClient.disconnect).not.toHaveBeenCalled();
      expect((mockClient.handshake as any).user).toBeInstanceOf(UserEntity);
    });

    it('should check ban status after blacklist check passes', async () => {
      const bannedUser = UserFactory.build({ banned: true });
      const mockClient = {
        id: 'socket-banned-with-jti',
        handshake: {
          auth: { token: 'valid-token' },
          headers: {},
        },
        disconnect: jest.fn(),
      };
      const context = createMockWsExecutionContext({ client: mockClient });

      jest
        .spyOn(jwtService, 'verify')
        .mockReturnValue({ sub: bannedUser.id, jti: 'valid-jti' });
      jest
        .spyOn(tokenBlacklistService, 'isBlacklisted')
        .mockResolvedValue(false);
      jest.spyOn(userService, 'findById').mockResolvedValue(bannedUser);

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(tokenBlacklistService.isBlacklisted).toHaveBeenCalledWith(
        'valid-jti',
      );
      expect(userService.findById).toHaveBeenCalledWith(bannedUser.id);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
    });
  });
});
