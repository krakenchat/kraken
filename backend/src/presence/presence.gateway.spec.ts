import { Test, TestingModule } from '@nestjs/testing';
import { PresenceGateway } from './presence.gateway';
import { PresenceService } from './presence.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { WsJwtAuthGuard } from '@/auth/ws-jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';

describe('PresenceGateway', () => {
  let gateway: PresenceGateway;
  let presenceService: PresenceService;
  let websocketService: WebsocketService;

  const mockPresenceService = {
    addConnection: jest.fn(),
    removeConnection: jest.fn(),
    isUserOnline: jest.fn(),
    getOnlineUsers: jest.fn(),
  };

  const mockWebsocketService = {
    sendToRoom: jest.fn(),
    sendToAll: jest.fn(),
    setServer: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceGateway,
        {
          provide: PresenceService,
          useValue: mockPresenceService,
        },
        {
          provide: WebsocketService,
          useValue: mockWebsocketService,
        },
      ],
    })
      .overrideGuard(WsJwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .compile();

    gateway = module.get<PresenceGateway>(PresenceGateway);
    presenceService = module.get<PresenceService>(PresenceService);
    websocketService = module.get<WebsocketService>(WebsocketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should have services', () => {
    expect(presenceService).toBeDefined();
    expect(websocketService).toBeDefined();
  });

  describe('afterInit', () => {
    it('should log initialization', () => {
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');
      const mockServer = {} as any;

      gateway.afterInit(mockServer);

      expect(loggerSpy).toHaveBeenCalledWith('PresenceGateway initialized');
    });
  });

  describe('handleConnection', () => {
    it('should log client connection', () => {
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');
      const mockClient = { id: 'test-socket-id' } as any;

      gateway.handleConnection(mockClient);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Client connected to PresenceGateway: test-socket-id',
      );
    });

    it('should handle multiple connections', () => {
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');

      gateway.handleConnection({ id: 'socket-1' } as any);
      gateway.handleConnection({ id: 'socket-2' } as any);
      gateway.handleConnection({ id: 'socket-3' } as any);

      expect(loggerSpy).toHaveBeenCalledTimes(3);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Client connected to PresenceGateway: socket-1',
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        'Client connected to PresenceGateway: socket-2',
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        'Client connected to PresenceGateway: socket-3',
      );
    });
  });

  describe('handleMessage (PRESENCE_ONLINE)', () => {
    it('should add connection and broadcast when user goes online', async () => {
      const mockClient = {
        id: 'socket-123',
        handshake: {
          user: {
            id: 'user-123',
            username: 'testuser',
            displayName: 'Test User',
            avatarUrl: 'https://example.com/avatar.jpg',
          },
        },
      } as any;

      mockPresenceService.addConnection.mockResolvedValue(true); // User went online

      const result = await gateway.handleMessage(mockClient);

      expect(result).toBe('ACK');
      expect(mockPresenceService.addConnection).toHaveBeenCalledWith(
        'user-123',
        'socket-123',
        60,
      );
      expect(mockWebsocketService.sendToAll).toHaveBeenCalledWith(
        ServerEvents.USER_ONLINE,
        {
          userId: 'user-123',
          username: 'testuser',
          displayName: 'Test User',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
      );
    });

    it('should not broadcast when user already online', async () => {
      const mockClient = {
        id: 'socket-456',
        handshake: {
          user: {
            id: 'user-456',
            username: 'existinguser',
            displayName: 'Existing User',
            avatarUrl: null,
          },
        },
      } as any;

      mockPresenceService.addConnection.mockResolvedValue(false); // User was already online

      const result = await gateway.handleMessage(mockClient);

      expect(result).toBe('ACK');
      expect(mockPresenceService.addConnection).toHaveBeenCalledWith(
        'user-456',
        'socket-456',
        60,
      );
      expect(mockWebsocketService.sendToAll).not.toHaveBeenCalled();
    });

    it('should handle multiple clients from same user', async () => {
      const mockClient1 = {
        id: 'socket-1',
        handshake: {
          user: {
            id: 'user-multi',
            username: 'multiuser',
            displayName: 'Multi User',
            avatarUrl: null,
          },
        },
      } as any;

      const mockClient2 = {
        id: 'socket-2',
        handshake: {
          user: {
            id: 'user-multi',
            username: 'multiuser',
            displayName: 'Multi User',
            avatarUrl: null,
          },
        },
      } as any;

      mockPresenceService.addConnection
        .mockResolvedValueOnce(true) // First connection - goes online
        .mockResolvedValueOnce(false); // Second connection - already online

      await gateway.handleMessage(mockClient1);
      await gateway.handleMessage(mockClient2);

      expect(mockWebsocketService.sendToAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleDisconnect', () => {
    it('should remove connection and broadcast when user goes offline', async () => {
      const mockClient = {
        id: 'socket-789',
        handshake: {
          user: {
            id: 'user-789',
            username: 'disconnectuser',
            displayName: 'Disconnect User',
            avatarUrl: 'https://example.com/avatar2.jpg',
          },
        },
      } as any;

      mockPresenceService.removeConnection.mockResolvedValue(true); // User went offline

      await gateway.handleDisconnect(mockClient);

      expect(mockPresenceService.removeConnection).toHaveBeenCalledWith(
        'user-789',
        'socket-789',
      );
      expect(mockWebsocketService.sendToAll).toHaveBeenCalledWith(
        ServerEvents.USER_OFFLINE,
        {
          userId: 'user-789',
          username: 'disconnectuser',
          displayName: 'Disconnect User',
          avatarUrl: 'https://example.com/avatar2.jpg',
        },
      );
    });

    it('should not broadcast when user still has other connections', async () => {
      const mockClient = {
        id: 'socket-999',
        handshake: {
          user: {
            id: 'user-999',
            username: 'activeuser',
            displayName: 'Active User',
            avatarUrl: null,
          },
        },
      } as any;

      mockPresenceService.removeConnection.mockResolvedValue(false); // User still online

      await gateway.handleDisconnect(mockClient);

      expect(mockPresenceService.removeConnection).toHaveBeenCalledWith(
        'user-999',
        'socket-999',
      );
      expect(mockWebsocketService.sendToAll).not.toHaveBeenCalled();
    });

    it('should handle disconnect without user in handshake', async () => {
      const mockClient = {
        id: 'socket-no-user',
        handshake: {},
      } as any;

      await gateway.handleDisconnect(mockClient);

      expect(mockPresenceService.removeConnection).not.toHaveBeenCalled();
      expect(mockWebsocketService.sendToAll).not.toHaveBeenCalled();
    });

    it('should handle disconnect with partial user data', async () => {
      const mockClient = {
        id: 'socket-partial',
        handshake: {
          user: null,
        },
      } as any;

      await gateway.handleDisconnect(mockClient);

      expect(mockPresenceService.removeConnection).not.toHaveBeenCalled();
      expect(mockWebsocketService.sendToAll).not.toHaveBeenCalled();
    });
  });
});
