import { Test, TestingModule } from '@nestjs/testing';
import { LivekitController } from './livekit.controller';
import { LivekitService } from './livekit.service';
import { LivekitReplayService } from './livekit-replay.service';
import { ClipLibraryService } from './clip-library.service';
import { StorageService } from '@/storage/storage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RbacGuard } from '../auth/rbac.guard';
import { UserFactory } from '@/test-utils';
import { CreateTokenDto } from './dto/create-token.dto';

describe('LivekitController', () => {
  let controller: LivekitController;
  let service: LivekitService;

  const mockLivekitService = {
    generateToken: jest.fn(),
    getConnectionInfo: jest.fn(),
    validateConfiguration: jest.fn(),
    muteParticipant: jest.fn(),
  };

  const mockLivekitReplayService = {
    startReplayBuffer: jest.fn(),
    stopReplayBuffer: jest.fn(),
    getSessionInfo: jest.fn(),
    captureReplay: jest.fn(),
    getPlaylistContent: jest.fn(),
    getSegmentPath: jest.fn(),
    getRemuxedSegmentPath: jest.fn(),
  };

  const mockClipLibraryService = {
    getUserClips: jest.fn(),
    getPublicClips: jest.fn(),
    updateClip: jest.fn(),
    deleteClip: jest.fn(),
    shareClip: jest.fn(),
  };

  const mockStorageService = {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    deleteFile: jest.fn(),
    getFileStats: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  const mockUser = UserFactory.build();
  const mockRequest = {
    user: mockUser,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LivekitController],
      providers: [
        {
          provide: LivekitService,
          useValue: mockLivekitService,
        },
        {
          provide: LivekitReplayService,
          useValue: mockLivekitReplayService,
        },
        {
          provide: ClipLibraryService,
          useValue: mockClipLibraryService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
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

  describe('generateToken', () => {
    it('should generate LiveKit token for channel', async () => {
      const createTokenDto: CreateTokenDto = {
        roomId: 'channel-123',
        identity: 'user-456',
        name: 'Test User',
      };

      const mockTokenResponse = {
        token: 'livekit-token-abc123',
        url: 'wss://livekit.io',
        identity: 'user-456',
        roomId: 'channel-123',
      };

      jest.spyOn(service, 'generateToken').mockResolvedValue(mockTokenResponse);

      const result = await controller.generateToken(
        createTokenDto,
        mockRequest,
      );

      expect(service.generateToken).toHaveBeenCalledWith(createTokenDto);
      expect(result).toEqual(mockTokenResponse);
    });

    it('should use authenticated user ID as identity when not provided', async () => {
      const createTokenDto: CreateTokenDto = {
        roomId: 'channel-789',
        identity: '',
        name: 'User Name',
      };

      jest.spyOn(service, 'generateToken').mockResolvedValue({
        token: 'token',
        identity: mockUser.id,
        roomId: 'channel-789',
      });

      await controller.generateToken(createTokenDto, mockRequest);

      const callArgs = (service.generateToken as jest.Mock).mock.calls[0]?.[0];
      expect(callArgs.roomId).toBe('channel-789');
      expect(callArgs.identity).toBe(mockUser.id);
    });

    it('should preserve provided identity over user ID', async () => {
      const createTokenDto: CreateTokenDto = {
        roomId: 'channel-123',
        identity: 'custom-identity',
        name: 'Custom Name',
      };

      jest.spyOn(service, 'generateToken').mockResolvedValue({
        token: 'token',
        identity: 'custom-identity',
        roomId: 'channel-123',
      });

      await controller.generateToken(createTokenDto, mockRequest);

      const callArgs = (service.generateToken as jest.Mock).mock.calls[0]?.[0];
      expect(callArgs.identity).toBe('custom-identity');
    });
  });

  describe('generateDmToken', () => {
    it('should generate LiveKit token for DM call', async () => {
      const createTokenDto: CreateTokenDto = {
        roomId: 'dm-group-123',
        identity: 'user-456',
        name: 'Test User',
      };

      const mockTokenResponse = {
        token: 'dm-livekit-token-xyz',
        identity: 'user-456',
        roomId: 'dm-group-123',
      };

      jest.spyOn(service, 'generateToken').mockResolvedValue(mockTokenResponse);

      const result = await controller.generateDmToken(
        createTokenDto,
        mockRequest,
      );

      expect(service.generateToken).toHaveBeenCalledWith(createTokenDto);
      expect(result).toEqual(mockTokenResponse);
    });

    it('should use authenticated user ID as identity when not provided', async () => {
      const createTokenDto: CreateTokenDto = {
        roomId: 'dm-group-456',
        identity: '',
        name: 'DM Participant',
      };

      jest.spyOn(service, 'generateToken').mockResolvedValue({
        token: 'dm-token',
        identity: mockUser.id,
        roomId: 'dm-group-456',
      });

      await controller.generateDmToken(createTokenDto, mockRequest);

      const callArgs = (service.generateToken as jest.Mock).mock.calls[0]?.[0];
      expect(callArgs.identity).toBe(mockUser.id);
      expect(callArgs.roomId).toBe('dm-group-456');
    });
  });

  describe('getConnectionInfo', () => {
    it('should return LiveKit connection information', () => {
      const mockConnectionInfo = {
        url: 'wss://livekit.example.com',
      };

      jest
        .spyOn(service, 'getConnectionInfo')
        .mockReturnValue(mockConnectionInfo);

      const result = controller.getConnectionInfo();

      expect(service.getConnectionInfo).toHaveBeenCalled();
      expect(result).toEqual(mockConnectionInfo);
    });

    it('should call service method without parameters', () => {
      jest.spyOn(service, 'getConnectionInfo').mockReturnValue({
        url: 'wss://test.livekit.io',
      });

      controller.getConnectionInfo();

      expect(service.getConnectionInfo).toHaveBeenCalledWith();
    });
  });

  describe('validateConfiguration', () => {
    it('should return healthy status when configuration is valid', () => {
      jest.spyOn(service, 'validateConfiguration').mockReturnValue(true);

      const result = controller.validateConfiguration();

      expect(service.validateConfiguration).toHaveBeenCalled();
      expect(result).toEqual({
        status: 'healthy',
        configured: true,
      });
    });

    it('should return unhealthy status when configuration is invalid', () => {
      jest.spyOn(service, 'validateConfiguration').mockReturnValue(false);

      const result = controller.validateConfiguration();

      expect(result).toEqual({
        status: 'unhealthy',
        configured: false,
      });
    });

    it('should call service validation method', () => {
      jest.spyOn(service, 'validateConfiguration').mockReturnValue(true);

      controller.validateConfiguration();

      expect(service.validateConfiguration).toHaveBeenCalledWith();
    });
  });

  describe('muteParticipant', () => {
    it('should call service muteParticipant and return success', async () => {
      jest.spyOn(service, 'muteParticipant').mockResolvedValue(undefined);

      const result = await controller.muteParticipant('channel-123', {
        participantIdentity: 'user-456',
        mute: true,
      });

      expect(service.muteParticipant).toHaveBeenCalledWith(
        'channel-123',
        'user-456',
        true,
      );
      expect(result).toEqual({ success: true });
    });

    it('should pass mute=false for unmute', async () => {
      jest.spyOn(service, 'muteParticipant').mockResolvedValue(undefined);

      await controller.muteParticipant('channel-123', {
        participantIdentity: 'user-456',
        mute: false,
      });

      expect(service.muteParticipant).toHaveBeenCalledWith(
        'channel-123',
        'user-456',
        false,
      );
    });

    it('should propagate service errors', async () => {
      jest
        .spyOn(service, 'muteParticipant')
        .mockRejectedValue(new Error('Mute failed'));

      await expect(
        controller.muteParticipant('channel-123', {
          participantIdentity: 'user-456',
          mute: true,
        }),
      ).rejects.toThrow('Mute failed');
    });
  });
});
