import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { UserFactory } from '@/test-utils';
import { Socket, Server } from 'socket.io';

describe('RoomsGateway', () => {
  let gateway: RoomsGateway;
  let roomsService: Mocked<RoomsService>;
  let websocketService: Mocked<WebsocketService>;

  const mockUser = UserFactory.build();

  const createMockSocket = (
    user = mockUser,
  ): Socket & { handshake: { user: typeof mockUser } } => {
    return {
      id: 'socket-123',
      handshake: {
        user,
      },
    } as Socket & { handshake: { user: typeof mockUser } };
  };

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(RoomsGateway).compile();

    gateway = unit;
    roomsService = unitRef.get(RoomsService);
    websocketService = unitRef.get(WebsocketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('afterInit', () => {
    it('should set server on websocket service', () => {
      const mockServer = {} as Server;

      gateway.afterInit(mockServer);

      expect(websocketService.setServer).toHaveBeenCalledWith(mockServer);
    });

    it('should call setServer exactly once', () => {
      const mockServer = {} as Server;

      gateway.afterInit(mockServer);

      expect(websocketService.setServer).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleDisconnect', () => {
    it('should not emit any presence events (handled by PresenceGateway)', () => {
      const client = createMockSocket();

      gateway.handleDisconnect(client);

      expect(websocketService.sendToAll).not.toHaveBeenCalled();
    });

    it('should handle disconnect for unauthenticated sockets without error', () => {
      const client = {
        id: 'socket-unauthenticated',
        handshake: {},
      } as Socket;

      expect(() => gateway.handleDisconnect(client)).not.toThrow();
      expect(websocketService.sendToAll).not.toHaveBeenCalled();
    });
  });

  describe('subscribeAll', () => {
    it('should call joinAllUserRooms on the service', async () => {
      const client = createMockSocket();

      roomsService.joinAllUserRooms.mockResolvedValue(undefined);

      await gateway.subscribeAll(client);

      expect(roomsService.joinAllUserRooms).toHaveBeenCalledWith(client);
    });
  });
});
