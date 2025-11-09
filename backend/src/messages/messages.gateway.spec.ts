import { Test, TestingModule } from '@nestjs/testing';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { WsJwtAuthGuard } from '@/auth/ws-jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';

describe('MessagesGateway', () => {
  let gateway: MessagesGateway;
  let messagesService: MessagesService;
  let websocketService: WebsocketService;

  const mockMessagesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    addReaction: jest.fn(),
    removeReaction: jest.fn(),
  };

  const mockWebsocketService = {
    sendToRoom: jest.fn(),
    setServer: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesGateway,
        {
          provide: MessagesService,
          useValue: mockMessagesService,
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

    gateway = module.get<MessagesGateway>(MessagesGateway);
    messagesService = module.get<MessagesService>(MessagesService);
    websocketService = module.get<WebsocketService>(WebsocketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should have services', () => {
    expect(messagesService).toBeDefined();
    expect(websocketService).toBeDefined();
  });
});
