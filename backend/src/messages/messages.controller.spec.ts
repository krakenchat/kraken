import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';
import { MessageOwnershipGuard } from '@/auth/message-ownership.guard';

describe('MessagesController', () => {
  let controller: MessagesController;
  let service: MessagesService;
  let websocketService: WebsocketService;

  const mockMessagesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockWebsocketService = {
    sendToRoom: jest.fn(),
    setServer: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
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
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .overrideGuard(MessageOwnershipGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<MessagesController>(MessagesController);
    service = module.get<MessagesService>(MessagesService);
    websocketService = module.get<WebsocketService>(WebsocketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have services', () => {
    expect(service).toBeDefined();
    expect(websocketService).toBeDefined();
  });
});
