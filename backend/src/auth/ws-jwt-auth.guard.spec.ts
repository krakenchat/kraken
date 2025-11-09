/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { WsJwtAuthGuard } from './ws-jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '@/user/user.service';
import {
  UserFactory,
  createMockHttpExecutionContext,
  createMockWsExecutionContext,
} from '@/test-utils';

describe('WsJwtAuthGuard', () => {
  let guard: WsJwtAuthGuard;
  let jwtService: JwtService;
  let userService: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WsJwtAuthGuard,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<WsJwtAuthGuard>(WsJwtAuthGuard);
    jwtService = module.get<JwtService>(JwtService);
    userService = module.get<UserService>(UserService);
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

      expect((mockClient.handshake as any).user).toBe(user);
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
    it('should attach user to handshake on successful authentication', async () => {
      const user = UserFactory.build();
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

      expect((mockClient.handshake as any).user).toBe(user);
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

      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);
      expect(jwtService.verify).toHaveBeenCalledWith('');
    });
  });
});
