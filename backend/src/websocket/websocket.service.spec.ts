import { TestBed } from '@suites/unit';
import { WebsocketService } from './websocket.service';
import { Server } from 'socket.io';

describe('WebsocketService', () => {
  let service: WebsocketService;

  beforeEach(async () => {
    const { unit } = await TestBed.solitary(WebsocketService).compile();

    service = unit;
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
      service.sendToAll('test-event', {});

      expect(mockEmit).toHaveBeenCalled();
    });

    it('should allow changing the server instance', () => {
      const mockServer1 = { emit: jest.fn() } as any;
      const mockServer2 = { emit: jest.fn() } as any;

      service.setServer(mockServer1);
      service.sendToAll('event1', {});

      service.setServer(mockServer2);
      service.sendToAll('event2', {});

      expect(mockServer1.emit).toHaveBeenCalledWith('event1', {});
      expect(mockServer2.emit).toHaveBeenCalledWith('event2', {});
    });
  });

  describe('sendToRoom', () => {
    it('should send event to specific room successfully', () => {
      const mockTo = jest.fn().mockReturnValue({ emit: jest.fn() });
      const mockServer = { to: mockTo } as any;

      service.setServer(mockServer);
      const result = service.sendToRoom('room-123', 'test-event', {
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
      service.sendToRoom('room-456', 'message-event', payload);

      expect(mockEmit).toHaveBeenCalledWith('message-event', payload);
    });

    it('should return false when server is not initialized', () => {
      const result = service.sendToRoom('room-123', 'test-event', {});

      expect(result).toBe(false);
    });

    it('should return false on error', () => {
      const mockTo = jest.fn().mockImplementation(() => {
        throw new Error('Socket error');
      });
      const mockServer = { to: mockTo } as any;

      service.setServer(mockServer);
      const result = service.sendToRoom('room-error', 'test-event', {});

      expect(result).toBe(false);
    });

    it('should send to different rooms', () => {
      const mockEmit = jest.fn();
      const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
      const mockServer = { to: mockTo } as any;

      service.setServer(mockServer);

      service.sendToRoom('room-1', 'event-1', { data: 1 });
      service.sendToRoom('room-2', 'event-2', { data: 2 });
      service.sendToRoom('room-3', 'event-3', { data: 3 });

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

      service.sendToRoom('room-123', 'user-joined', { userId: 'user-1' });
      service.sendToRoom('room-123', 'user-left', { userId: 'user-2' });
      service.sendToRoom('room-123', 'message-sent', { message: 'hello' });

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
      const result = service.sendToAll('broadcast-event', { data: 'test' });

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
      service.sendToAll('server-announcement', payload);

      expect(mockEmit).toHaveBeenCalledWith('server-announcement', payload);
    });

    it('should return false when server is not initialized', () => {
      const result = service.sendToAll('test-event', {});

      expect(result).toBe(false);
    });

    it('should return false on error', () => {
      const mockEmit = jest.fn().mockImplementation(() => {
        throw new Error('Broadcast error');
      });
      const mockServer = { emit: mockEmit } as any;

      service.setServer(mockServer);
      const result = service.sendToAll('error-event', {});

      expect(result).toBe(false);
    });

    it('should broadcast multiple different events', () => {
      const mockEmit = jest.fn();
      const mockServer = { emit: mockEmit } as any;

      service.setServer(mockServer);

      service.sendToAll('user-online', { userId: 'user-1' });
      service.sendToAll('user-offline', { userId: 'user-2' });
      service.sendToAll('system-update', { version: '1.0.0' });

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
      const result = service.sendToAll('null-event', null);

      expect(result).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith('null-event', null);
    });

    it('should handle undefined payload', () => {
      const mockEmit = jest.fn();
      const mockServer = { emit: mockEmit } as any;

      service.setServer(mockServer);
      const result = service.sendToAll('undefined-event', undefined);

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

      const result = service.sendToAll('complex-event', complexPayload);

      expect(result).toBe(true);
      expect(mockEmit).toHaveBeenCalledWith('complex-event', complexPayload);
    });
  });
});
