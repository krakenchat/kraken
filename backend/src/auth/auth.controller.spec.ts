import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DatabaseService } from '@/database/database.service';
import { LocalAuthGuard } from './local-auth.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let databaseService: DatabaseService;

  const mockAuthService = {
    login: jest.fn(),
    generateRefreshToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
    validateRefreshToken: jest.fn(),
    removeRefreshToken: jest.fn(),
  };

  const mockDatabaseService = {
    $transaction: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    })
      .overrideGuard(LocalAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have services', () => {
    expect(authService).toBeDefined();
    expect(databaseService).toBeDefined();
  });
});
