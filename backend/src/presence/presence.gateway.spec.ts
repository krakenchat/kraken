import { Test, TestingModule } from '@nestjs/testing';
import { PresenceGateway } from './presence.gateway';
import { PresenceService } from './presence.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { WsJwtAuthGuard } from '@/auth/ws-jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';

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
});
