import { TestBed } from '@suites/unit';
import { WebsocketService } from './websocket.service';
import { Server } from 'socket.io';

describe('WebsocketService', () => {
  let service: WebsocketService;
  // sendToRoom/sendToAll are now generically typed to the real
  // ServerToClientEvents contract (Task 3, commit 3). These tests
  // deliberately exercise the generic wrapper mechanism itself (routing,
  // error handling, arg pass-through) with made-up event names, agnostic
  // of any specific event contract — so they call through this loosened
  // view of the same instance rather than the strict public type.
  let looseService: {
    setServer: (server: unknown) => void;
    sendToRoom: (room: string, event: string, payload: unknown) => boolean;
    sendToAll: (event: string, payload: unknown) => boolean;
    joinSocketsToRoom: (source: string, rooms: string | string[]) => void;
    removeSocketsFromRoom: (source: string, rooms: string | string[]) => void;
  };

  beforeEach(async () => {
    const { unit } = await TestBed.solitary(WebsocketService).compile();

    service = unit;
    looseService = service as unknown as typeof looseService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setServer', () => {
    it('should set the server instance', () => {
      const mockServer = {} as Server;

      service.setServer(mockServer);

      // Verify server was set by checking sendToAll returns true
      const mockEmit = jest.fn();
      service.setServer({ emit: mockEmit } as any);
      looseService.sendToAll('test-event', {});

      expect(mockEmit).toHaveBeenCalled();
    });

    it('should allow changing the server instance', () => {
      const mockServer1 = { emit: jest.fn() } as any;
      const mockServer2 = { emit: jest.fn() } as any;

      service.setServer(mockServer1);
      looseService.sendToAll('event1', {});

      service.setServer(mockServer2);
      looseService.sendToAll('event2', {});

      expect(mockServer1.emit).toHaveBeenCalledWith('event1', {});
      expect(mockServer2.emit).toHaveBeenCalledWith('event2', {});
    });
  });

  describe('sendToRoom', () => {
    it('should send event to specific room successfully', () => {
      const mockTo = jest.fn().mockReturnValue({ emit: jest.fn() });
      const mockServer = { to: mockTo } as any;

      service.setServer(mockServer);
      const result = looseService.sendToRoom('room-123', 'test-event', {
        data: 'test',
      });

      expect(result).toBe(true);
      expect(mockTo).toHaveBeenCalledWith('room-123');
    });

    it('should emit event with payload to room', () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      const mockServer = { to: mockTo } as any;

      service.setServer(mockServer);

      const payload = { userId: 'user-123', message: 'hello' };
      looseService.sendToRoom('room-456', 'message-event', payload);

      expect(mockEmit).toHaveBeenCalledWith('message-event', payload);
    });

    it('should return false when server is not initialized', () => {
      const result = looseService.sendToRoom('room-123', 'test-event', {});

      expect(result).toBe(false);
    });

    it('should return false on error', () => {
      const mockTo = jest.fn().mockImplementation(() => {
        throw new Error('Socket error');
      });
      const mockServer = { to: mockTo } as any;

      service.setServer(mockServer);
      const result = looseService.sendToRoom('room-error', 'test-event', {});

      expect(result).toBe(false);
    });

    it('should send to different rooms', () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      const mockServer = { to: mockTo } as any;

      service.setServer(mockServer);

      looseService.sendToRoom('room-1', 'event-1', { data: 1 });
      looseService.sendToRoom('room-2', 'event-2', { data: 2 });
      looseService.sendToRoom('room-3', 'event-3', { data: 3 });

      expect(mockTo).toHaveBeenCalledTimes(3);
      expect(mockTo).toHaveBeenCalledWith('room-1');
      expect(mockTo).toHaveBeenCalledWith('room-2');
      expect(mockTo).toHaveBeenCalledWith('room-3');
    });

    it('should send different events to same room', () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      const mockServer = { to: mockTo } as any;

      service.setServer(mockServer);

      looseService.sendToRoom('room-123', 'user-joined', { userId: 'user-1' });
      looseService.sendToRoom('room-123', 'user-left', { userId: 'user-2' });
      looseService.sendToRoom('room-123', 'message-sent', { message: 'hello' });

      expect(mockTo).toHaveBeenCalledTimes(3);
      expect(mockEmit).toHaveBeenCalledWith('user-joined', {
        userId: 'user-1',
      });
      expect(mockEmit).toHaveBeenCalledWith('user-left', { userId: 'user-2' });
      expect(mockEmit).toHaveBeenCalledWith('message-sent', {
        message: 'hello',
      });
    });
  });

  describe('sendToAll', () => {
    it('should broadcast event to all clients successfully', () => {
      const mockEmit = jest.fn();
      const mockServer = { emit: mockEmit } as any;

      service.setServer(mockServer);
      const result = looseService.sendToAll('broadcast-event', { data: 'test' });

      expect(result).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith('broadcast-event', {
        data: 'test',
      });
    });

    it('should emit event with payload to all clients', () => {
      const mockEmit = jest.fn();
      const mockServer = { emit: mockEmit } as any;

      service.setServer(mockServer);

      const payload = { announcement: 'Server maintenance in 5 minutes' };
      looseService.sendToAll('server-announcement', payload);

      expect(mockEmit).toHaveBeenCalledWith('server-announcement', payload);
    });

    it('should return false when server is not initialized', () => {
      const result = looseService.sendToAll('test-event', {});

      expect(result).toBe(false);
    });

    it('should return false on error', () => {
      const mockEmit = jest.fn().mockImplementation(() => {
        throw new Error('Broadcast error');
      });
      const mockServer = { emit: mockEmit } as any;

      service.setServer(mockServer);
      const result = looseService.sendToAll('error-event', {});

      expect(result).toBe(false);
    });

    it('should broadcast multiple different events', () => {
      const mockEmit = jest.fn();
      const mockServer = { emit: mockEmit } as any;

      service.setServer(mockServer);

      looseService.sendToAll('user-online', { userId: 'user-1' });
      looseService.sendToAll('user-offline', { userId: 'user-2' });
      looseService.sendToAll('system-update', { version: '1.0.0' });

      expect(mockEmit).toHaveBeenCalledTimes(3);
      expect(mockEmit).toHaveBeenCalledWith('user-online', {
        userId: 'user-1',
      });
      expect(mockEmit).toHaveBeenCalledWith('user-offline', {
        userId: 'user-2',
      });
      expect(mockEmit).toHaveBeenCalledWith('system-update', {
        version: '1.0.0',
      });
    });

    it('should handle null payload', () => {
      const mockEmit = jest.fn();
      const mockServer = { emit: mockEmit } as any;

      service.setServer(mockServer);
      const result = looseService.sendToAll('null-event', null);

      expect(result).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith('null-event', null);
    });

    it('should handle undefined payload', () => {
      const mockEmit = jest.fn();
      const mockServer = { emit: mockEmit } as any;

      service.setServer(mockServer);
      const result = looseService.sendToAll('undefined-event', undefined);

      expect(result).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith('undefined-event', undefined);
    });

    it('should handle complex payloads', () => {
      const mockEmit = jest.fn();
      const mockServer = { emit: mockEmit } as any;

      service.setServer(mockServer);

      const complexPayload = {
        user: {
          id: 'user-123',
          name: 'Test User',
          metadata: {
            lastSeen: new Date('2024-01-01'),
            roles: ['admin', 'moderator'],
          },
        },
        action: 'login',
        timestamp: Date.now(),
      };

      const result = looseService.sendToAll('complex-event', complexPayload);

      expect(result).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith('complex-event', complexPayload);
    });
  });

  describe('joinSocketsToRoom', () => {
    it('should join sockets from source room to target room', () => {
      const mockSocketsJoin = jest.fn();
      const mockIn = jest
        .fn()
        .mockReturnValue({ socketsJoin: mockSocketsJoin });
      const mockServer = { in: mockIn } as any;

      service.setServer(mockServer);
      service.joinSocketsToRoom('user-123', 'channel-456');

      expect(mockIn).toHaveBeenCalledWith('user-123');
      expect(mockSocketsJoin).toHaveBeenCalledWith('channel-456');
    });

    it('should join sockets to multiple rooms', () => {
      const mockSocketsJoin = jest.fn();
      const mockIn = jest
        .fn()
        .mockReturnValue({ socketsJoin: mockSocketsJoin });
      const mockServer = { in: mockIn } as any;

      service.setServer(mockServer);
      service.joinSocketsToRoom('user-123', ['room-1', 'room-2', 'room-3']);

      expect(mockIn).toHaveBeenCalledWith('user-123');
      expect(mockSocketsJoin).toHaveBeenCalledWith([
        'room-1',
        'room-2',
        'room-3',
      ]);
    });

    it('should not throw when server is not initialized', () => {
      expect(() => {
        service.joinSocketsToRoom('user-123', 'channel-456');
      }).not.toThrow();
    });

    it('should not throw on error', () => {
      const mockIn = jest.fn().mockImplementation(() => {
        throw new Error('Socket error');
      });
      const mockServer = { in: mockIn } as any;

      service.setServer(mockServer);

      expect(() => {
        service.joinSocketsToRoom('user-123', 'channel-456');
      }).not.toThrow();
    });
  });

  describe('removeSocketsFromRoom', () => {
    it('should remove sockets from source room from target room', () => {
      const mockSocketsLeave = jest.fn();
      const mockIn = jest
        .fn()
        .mockReturnValue({ socketsLeave: mockSocketsLeave });
      const mockServer = { in: mockIn } as any;

      service.setServer(mockServer);
      service.removeSocketsFromRoom('user-123', 'channel-456');

      expect(mockIn).toHaveBeenCalledWith('user-123');
      expect(mockSocketsLeave).toHaveBeenCalledWith('channel-456');
    });

    it('should remove sockets from multiple rooms', () => {
      const mockSocketsLeave = jest.fn();
      const mockIn = jest
        .fn()
        .mockReturnValue({ socketsLeave: mockSocketsLeave });
      const mockServer = { in: mockIn } as any;

      service.setServer(mockServer);
      service.removeSocketsFromRoom('user-123', ['room-1', 'room-2']);

      expect(mockIn).toHaveBeenCalledWith('user-123');
      expect(mockSocketsLeave).toHaveBeenCalledWith(['room-1', 'room-2']);
    });

    it('should not throw when server is not initialized', () => {
      expect(() => {
        service.removeSocketsFromRoom('user-123', 'channel-456');
      }).not.toThrow();
    });

    it('should not throw on error', () => {
      const mockIn = jest.fn().mockImplementation(() => {
        throw new Error('Socket error');
      });
      const mockServer = { in: mockIn } as any;

      service.setServer(mockServer);

      expect(() => {
        service.removeSocketsFromRoom('user-123', 'channel-456');
      }).not.toThrow();
    });
  });
});
