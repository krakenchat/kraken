import { Test, TestingModule } from '@nestjs/testing';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { WsJwtAuthGuard } from '@/auth/ws-jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { UserFactory } from '@/test-utils';
import { Socket, Server } from 'socket.io';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';

describe('RoomsGateway', () => {
  let gateway: RoomsGateway;
  let roomsService: RoomsService;
  let websocketService: WebsocketService;

  const mockRoomsService = {
    joinAll: jest.fn(),
    join: jest.fn(),
  };

  const mockWebsocketService = {
    sendToRoom: jest.fn(),
    sendToAll: jest.fn(),
    setServer: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsGateway,
        {
          provide: RoomsService,
          useValue: mockRoomsService,
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

    gateway = module.get<RoomsGateway>(RoomsGateway);
    roomsService = module.get<RoomsService>(RoomsService);
    websocketService = module.get<WebsocketService>(WebsocketService);
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
    it('should send USER_OFFLINE event when client disconnects', () => {
      const client = createMockSocket();

      gateway.handleDisconnect(client);

      expect(websocketService.sendToAll).toHaveBeenCalledWith(
        ServerEvents.USER_OFFLINE,
        {
          userId: mockUser.id,
        },
      );
    });

    it('should handle disconnect for different users', () => {
      const user1 = UserFactory.build({ id: 'user-1' });
      const user2 = UserFactory.build({ id: 'user-2' });

      const client1 = createMockSocket(user1);
      const client2 = createMockSocket(user2);

      gateway.handleDisconnect(client1);
      gateway.handleDisconnect(client2);

      expect(websocketService.sendToAll).toHaveBeenCalledTimes(2);
      expect(websocketService.sendToAll).toHaveBeenCalledWith(
        ServerEvents.USER_OFFLINE,
        { userId: 'user-1' },
      );
      expect(websocketService.sendToAll).toHaveBeenCalledWith(
        ServerEvents.USER_OFFLINE,
        { userId: 'user-2' },
      );
    });

    it('should handle disconnect when user is not authenticated', () => {
      const client = {
        id: 'socket-unauthenticated',
        handshake: {},
      } as Socket;

      gateway.handleDisconnect(client);

      expect(websocketService.sendToAll).toHaveBeenCalledWith(
        ServerEvents.USER_OFFLINE,
        { userId: undefined },
      );
    });
  });

  describe('joinAll', () => {
    it('should join all rooms for community', async () => {
      const communityId = 'community-123';
      const client = createMockSocket();

      jest.spyOn(roomsService, 'joinAll').mockResolvedValue(undefined);

      await gateway.joinAll(client, communityId);

      expect(roomsService.joinAll).toHaveBeenCalledWith(client, communityId);
      expect(websocketService.sendToAll).toHaveBeenCalledWith(
        ServerEvents.USER_ONLINE,
        {
          userId: mockUser.id,
        },
      );
    });

    it('should send USER_ONLINE before joining rooms', async () => {
      const communityId = 'community-456';
      const client = createMockSocket();

      jest.spyOn(roomsService, 'joinAll').mockResolvedValue(undefined);

      await gateway.joinAll(client, communityId);

      // Verify order: sendToAll called before joinAll
      const sendToAllOrder = (websocketService.sendToAll as jest.Mock).mock
        .invocationCallOrder[0];
      const joinAllOrder = (roomsService.joinAll as jest.Mock).mock
        .invocationCallOrder[0];

      expect(sendToAllOrder).toBeLessThan(joinAllOrder);
    });

    it('should use authenticated user from socket', async () => {
      const customUser = UserFactory.build({ id: 'custom-user-id' });
      const client = createMockSocket(customUser);
      const communityId = 'community-789';

      jest.spyOn(roomsService, 'joinAll').mockResolvedValue(undefined);

      await gateway.joinAll(client, communityId);

      expect(websocketService.sendToAll).toHaveBeenCalledWith(
        ServerEvents.USER_ONLINE,
        { userId: 'custom-user-id' },
      );
    });

    it('should handle different community IDs', async () => {
      const client = createMockSocket();

      jest.spyOn(roomsService, 'joinAll').mockResolvedValue(undefined);

      await gateway.joinAll(client, 'community-1');
      await gateway.joinAll(client, 'community-2');
      await gateway.joinAll(client, 'community-3');

      expect(roomsService.joinAll).toHaveBeenCalledTimes(3);
      expect(roomsService.joinAll).toHaveBeenCalledWith(client, 'community-1');
      expect(roomsService.joinAll).toHaveBeenCalledWith(client, 'community-2');
      expect(roomsService.joinAll).toHaveBeenCalledWith(client, 'community-3');
    });
  });

  describe('findOne (JOIN_ROOM)', () => {
    it('should join a specific room', async () => {
      const client = createMockSocket();
      const roomId = 'room-123';

      jest.spyOn(roomsService, 'join').mockResolvedValue(undefined);

      await gateway.findOne(client, roomId);

      expect(roomsService.join).toHaveBeenCalledWith(client, roomId);
    });

    it('should join multiple different rooms', async () => {
      const client = createMockSocket();

      jest.spyOn(roomsService, 'join').mockResolvedValue(undefined);

      await gateway.findOne(client, 'room-1');
      await gateway.findOne(client, 'room-2');
      await gateway.findOne(client, 'room-3');

      expect(roomsService.join).toHaveBeenCalledTimes(3);
      expect(roomsService.join).toHaveBeenCalledWith(client, 'room-1');
      expect(roomsService.join).toHaveBeenCalledWith(client, 'room-2');
      expect(roomsService.join).toHaveBeenCalledWith(client, 'room-3');
    });

    it('should work with different authenticated users', async () => {
      const user1 = UserFactory.build({ id: 'user-1' });
      const user2 = UserFactory.build({ id: 'user-2' });

      const client1 = createMockSocket(user1);
      const client2 = createMockSocket(user2);

      jest.spyOn(roomsService, 'join').mockResolvedValue(undefined);

      await gateway.findOne(client1, 'room-abc');
      await gateway.findOne(client2, 'room-xyz');

      expect(roomsService.join).toHaveBeenCalledTimes(2);
      expect(roomsService.join).toHaveBeenCalledWith(client1, 'room-abc');
      expect(roomsService.join).toHaveBeenCalledWith(client2, 'room-xyz');
    });
  });

  describe('joinDmRoom', () => {
    it('should join DM room', async () => {
      const client = createMockSocket();
      const dmGroupId = 'dm-group-123';

      jest.spyOn(roomsService, 'join').mockResolvedValue(undefined);

      await gateway.joinDmRoom(client, dmGroupId);

      expect(roomsService.join).toHaveBeenCalledWith(client, dmGroupId);
    });

    it('should join multiple DM rooms', async () => {
      const client = createMockSocket();

      jest.spyOn(roomsService, 'join').mockResolvedValue(undefined);

      await gateway.joinDmRoom(client, 'dm-1');
      await gateway.joinDmRoom(client, 'dm-2');
      await gateway.joinDmRoom(client, 'dm-3');

      expect(roomsService.join).toHaveBeenCalledTimes(3);
      expect(roomsService.join).toHaveBeenCalledWith(client, 'dm-1');
      expect(roomsService.join).toHaveBeenCalledWith(client, 'dm-2');
      expect(roomsService.join).toHaveBeenCalledWith(client, 'dm-3');
    });

    it('should use authenticated user ID from socket', async () => {
      const customUser = UserFactory.build({
        id: 'dm-user-id',
        username: 'dmuser',
      });
      const client = createMockSocket(customUser);
      const dmGroupId = 'dm-group-456';

      jest.spyOn(roomsService, 'join').mockResolvedValue(undefined);

      await gateway.joinDmRoom(client, dmGroupId);

      expect(roomsService.join).toHaveBeenCalledWith(client, dmGroupId);
    });

    it('should handle different DM group IDs', async () => {
      const client = createMockSocket();
      const dmGroupIds = ['dm-a', 'dm-b', 'dm-c', 'dm-d'];

      jest.spyOn(roomsService, 'join').mockResolvedValue(undefined);

      for (const dmGroupId of dmGroupIds) {
        await gateway.joinDmRoom(client, dmGroupId);
      }

      expect(roomsService.join).toHaveBeenCalledTimes(4);
      dmGroupIds.forEach((id) => {
        expect(roomsService.join).toHaveBeenCalledWith(client, id);
      });
    });
  });
});
