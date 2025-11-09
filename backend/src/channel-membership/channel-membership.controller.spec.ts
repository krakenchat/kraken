import { Test, TestingModule } from '@nestjs/testing';
import { ChannelMembershipController } from './channel-membership.controller';
import { ChannelMembershipService } from './channel-membership.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RbacGuard } from '@/auth/rbac.guard';

describe('ChannelMembershipController', () => {
  let controller: ChannelMembershipController;
  let service: ChannelMembershipService;

  const mockChannelMembershipService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChannelMembershipController],
      providers: [
        {
          provide: ChannelMembershipService,
          useValue: mockChannelMembershipService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RbacGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<ChannelMembershipController>(
      ChannelMembershipController,
    );
    service = module.get<ChannelMembershipService>(ChannelMembershipService);
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
