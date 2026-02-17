import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { LivekitController } from './livekit.controller';
import { LivekitService } from './livekit.service';
import { UserFactory } from '@/test-utils';
import { CreateTokenDto } from './dto/create-token.dto';

describe('LivekitController', () => {
  let controller: LivekitController;
  let service: Mocked<LivekitService>;

  const mockUser = UserFactory.build();
  const mockRequest = {
    user: mockUser,
  } as any;

  beforeEach(async () => {
    const { unit, unitRef } =
      await TestBed.solitary(LivekitController).compile();

    controller = unit;
    service = unitRef.get(LivekitService);
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

      service.generateToken.mockResolvedValue(mockTokenResponse as any);

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

      service.generateToken.mockResolvedValue({
        token: 'token',
        identity: mockUser.id,
        roomId: 'channel-789',
      } as any);

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

      service.generateToken.mockResolvedValue({
        token: 'token',
        identity: 'custom-identity',
        roomId: 'channel-123',
      } as any);

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

      service.generateToken.mockResolvedValue(mockTokenResponse as any);

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

      service.generateToken.mockResolvedValue({
        token: 'dm-token',
        identity: mockUser.id,
        roomId: 'dm-group-456',
      } as any);

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

      service.getConnectionInfo.mockReturnValue(mockConnectionInfo as any);

      const result = controller.getConnectionInfo();

      expect(service.getConnectionInfo).toHaveBeenCalled();
      expect(result).toEqual(mockConnectionInfo);
    });

    it('should call service method without parameters', () => {
      service.getConnectionInfo.mockReturnValue({
        url: 'wss://test.livekit.io',
      } as any);

      controller.getConnectionInfo();

      expect(service.getConnectionInfo).toHaveBeenCalledWith();
    });
  });

  describe('validateConfiguration', () => {
    it('should return healthy status when configuration is valid', () => {
      service.validateConfiguration.mockReturnValue(true);

      const result = controller.validateConfiguration();

      expect(service.validateConfiguration).toHaveBeenCalled();
      expect(result).toEqual({
        status: 'healthy',
        configured: true,
      });
    });

    it('should return unhealthy status when configuration is invalid', () => {
      service.validateConfiguration.mockReturnValue(false);

      const result = controller.validateConfiguration();

      expect(result).toEqual({
        status: 'unhealthy',
        configured: false,
      });
    });

    it('should call service validation method', () => {
      service.validateConfiguration.mockReturnValue(true);

      controller.validateConfiguration();

      expect(service.validateConfiguration).toHaveBeenCalledWith();
    });
  });

  describe('muteParticipant', () => {
    it('should call service muteParticipant and return success', async () => {
      service.muteParticipant.mockResolvedValue(undefined);

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
      service.muteParticipant.mockResolvedValue(undefined);

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
      service.muteParticipant.mockRejectedValue(new Error('Mute failed'));

      await expect(
        controller.muteParticipant('channel-123', {
          participantIdentity: 'user-456',
          mute: true,
        }),
      ).rejects.toThrow('Mute failed');
    });
  });
});
