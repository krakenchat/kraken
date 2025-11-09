import { Test, TestingModule } from '@nestjs/testing';
import { LivekitController } from './livekit.controller';
import { LivekitService } from './livekit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';

describe('LivekitController', () => {
  let controller: LivekitController;
  let service: LivekitService;

  const mockLivekitService = {
    createToken: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LivekitController],
      providers: [
        {
          provide: LivekitService,
          useValue: mockLivekitService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<LivekitController>(LivekitController);
    service = module.get<LivekitService>(LivekitService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have a service', () => {
    expect(service).toBeDefined();
  });
});
