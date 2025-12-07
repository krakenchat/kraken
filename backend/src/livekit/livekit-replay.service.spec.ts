import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LivekitReplayService } from './livekit-replay.service';
import { DatabaseService } from '@/database/database.service';
import { StorageService } from '@/storage/storage.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { FfmpegService } from './ffmpeg.service';
import { MessagesService } from '@/messages/messages.service';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';
import { EgressStatus } from 'livekit-server-sdk';

// Mock livekit-server-sdk
jest.mock('livekit-server-sdk', () => ({
  EgressClient: jest.fn().mockImplementation(() => ({
    startTrackCompositeEgress: jest.fn(),
    stopEgress: jest.fn(),
    listEgress: jest.fn(),
  })),
  RoomServiceClient: jest.fn().mockImplementation(() => ({
    getParticipant: jest.fn(),
  })),
  SegmentedFileOutput: jest.fn(),
  SegmentedFileProtocol: {
    HLS_PROTOCOL: 'HLS_PROTOCOL',
  },
  EncodingOptions: jest.fn().mockImplementation((opts) => opts),
  EncodingOptionsPreset: {
    H264_1080P_30: 'H264_1080P_30',
    H264_1080P_60: 'H264_1080P_60',
  },
  VideoCodec: {
    H264_HIGH: 'H264_HIGH',
  },
  AudioCodec: {
    OPUS: 'OPUS',
  },
  TrackType: {
    VIDEO: 1,
    AUDIO: 2,
  },
  EgressStatus: {
    EGRESS_COMPLETE: 4,
    EGRESS_FAILED: 5,
    EGRESS_ABORTED: 6,
    EGRESS_ACTIVE: 2,
    EGRESS_STARTING: 1,
  },
}));

// Mock fluent-ffmpeg
jest.mock('fluent-ffmpeg', () => {
  const mockCommand = {
    input: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    run: jest.fn(),
  };
  return jest.fn(() => mockCommand);
});

describe('LivekitReplayService', () => {
  let service: LivekitReplayService;
  let mockEgressClient: {
    startTrackCompositeEgress: jest.Mock;
    stopEgress: jest.Mock;
    listEgress: jest.Mock;
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockDatabaseService = {
    egressSession: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    replayClip: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    file: {
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockStorageService = {
    ensureDirectory: jest.fn(),
    getDirectoryContents: jest.fn(),
    readTextFile: jest.fn(),
    getFileStats: jest.fn(),
    deleteDirectory: jest.fn(),
    deleteFile: jest.fn(),
    directoryExists: jest.fn(),
    deleteOldFiles: jest.fn(),
    fileExists: jest.fn(),
    listFiles: jest.fn(),
    // New prefix-aware methods
    getSegmentsPrefix: jest
      .fn()
      .mockReturnValue('/app/storage/replay-segments'),
    resolveSegmentPath: jest
      .fn()
      .mockImplementation(
        (relativePath: string) =>
          `/app/storage/replay-segments/${relativePath}`,
      ),
    deleteSegmentDirectory: jest.fn(),
    segmentDirectoryExists: jest.fn(),
    listSegmentFiles: jest.fn(),
    readSegmentFile: jest.fn(),
    getSegmentFileStats: jest.fn(),
  };

  const mockWebsocketService = {
    sendToRoom: jest.fn(),
  };

  const mockFfmpegService = {
    concatenateSegments: jest.fn(),
    getVideoDuration: jest.fn(),
    getEstimatedDuration: jest.fn(),
    getEstimatedFileSize: jest.fn(),
  };

  const mockMessagesService = {
    create: jest.fn(),
    enrichMessageWithFileMetadata: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup default config values
    mockConfigService.get.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        LIVEKIT_URL: 'wss://test.livekit.io',
        LIVEKIT_API_KEY: 'test-api-key',
        LIVEKIT_API_SECRET: 'test-api-secret',
        REPLAY_SEGMENTS_PATH: '/app/storage/replay-segments',
        REPLAY_EGRESS_OUTPUT_PATH: '/out',
        REPLAY_CLIPS_PATH: './uploads/replays',
        REPLAY_SEGMENT_CLEANUP_AGE_MINUTES: '20',
      };
      return config[key];
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LivekitReplayService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: WebsocketService, useValue: mockWebsocketService },
        { provide: FfmpegService, useValue: mockFfmpegService },
        { provide: MessagesService, useValue: mockMessagesService },
      ],
    }).compile();

    service = module.get<LivekitReplayService>(LivekitReplayService);

    // Get the mocked EgressClient
    mockEgressClient = (
      service as unknown as { egressClient: typeof mockEgressClient }
    ).egressClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw error when LiveKit config is missing', async () => {
    mockConfigService.get.mockReturnValue(undefined);

    await expect(
      Test.createTestingModule({
        providers: [
          LivekitReplayService,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: DatabaseService, useValue: mockDatabaseService },
          { provide: StorageService, useValue: mockStorageService },
          { provide: WebsocketService, useValue: mockWebsocketService },
          { provide: FfmpegService, useValue: mockFfmpegService },
          { provide: MessagesService, useValue: mockMessagesService },
        ],
      }).compile(),
    ).rejects.toThrow(
      'LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set',
    );
  });

  describe('startReplayBuffer', () => {
    const startParams = {
      userId: 'user-123',
      channelId: 'channel-456',
      roomName: 'room-789',
      videoTrackId: 'video-track-1',
      audioTrackId: 'audio-track-1',
    };

    beforeEach(() => {
      mockDatabaseService.egressSession.findFirst.mockResolvedValue(null);
      mockEgressClient.startTrackCompositeEgress.mockResolvedValue({
        egressId: 'egress-123',
      });
      mockDatabaseService.egressSession.create.mockResolvedValue({
        id: 'session-1',
        egressId: 'egress-123',
        status: 'active',
      });
      mockStorageService.deleteDirectory.mockResolvedValue(undefined);
    });

    it('should start new egress session', async () => {
      const result = await service.startReplayBuffer(startParams);

      expect(result.egressId).toBe('egress-123');
      expect(result.sessionId).toBe('session-1');
      expect(result.status).toBe('active');
      expect(mockEgressClient.startTrackCompositeEgress).toHaveBeenCalled();
      expect(mockDatabaseService.egressSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
            channelId: 'channel-456',
            roomName: 'room-789',
            egressId: 'egress-123',
            status: 'active',
          }),
        }),
      );
    });

    it('should stop existing session before starting new one', async () => {
      const existingSession = {
        id: 'old-session',
        egressId: 'old-egress-123',
        userId: 'user-123',
        status: 'active',
        segmentPath: 'old-session', // Relative path (just sessionId)
      };

      mockDatabaseService.egressSession.findFirst
        .mockResolvedValueOnce(existingSession) // For startReplayBuffer check
        .mockResolvedValueOnce(existingSession) // For stopReplayBuffer lookup
        .mockResolvedValueOnce(null); // After stop, for new start
      mockEgressClient.stopEgress.mockResolvedValue(undefined);
      mockDatabaseService.egressSession.update.mockResolvedValue({
        ...existingSession,
        status: 'stopped',
      });
      mockStorageService.deleteSegmentDirectory.mockResolvedValue(undefined);

      await service.startReplayBuffer(startParams);

      expect(mockEgressClient.stopEgress).toHaveBeenCalledWith(
        'old-egress-123',
      );
      expect(mockDatabaseService.egressSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'old-session' },
          data: expect.objectContaining({
            status: 'stopped',
          }),
        }),
      );
    });

    it('should throw BadRequestException when egress client fails to start', async () => {
      mockEgressClient.startTrackCompositeEgress.mockRejectedValue(
        new Error('LiveKit connection failed'),
      );

      await expect(service.startReplayBuffer(startParams)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('stopReplayBuffer', () => {
    it('should stop active egress session', async () => {
      const activeSession = {
        id: 'session-1',
        egressId: 'egress-123',
        userId: 'user-123',
        status: 'active',
        segmentPath: 'session-1', // Relative path
      };

      mockDatabaseService.egressSession.findFirst.mockResolvedValue(
        activeSession,
      );
      mockEgressClient.stopEgress.mockResolvedValue(undefined);
      mockDatabaseService.egressSession.update.mockResolvedValue({
        ...activeSession,
        status: 'stopped',
      });
      mockStorageService.deleteSegmentDirectory.mockResolvedValue(undefined);

      const result = await service.stopReplayBuffer('user-123');

      expect(result.sessionId).toBe('session-1');
      expect(result.egressId).toBe('egress-123');
      expect(result.status).toBe('stopped');
      expect(mockEgressClient.stopEgress).toHaveBeenCalledWith('egress-123');
      expect(mockDatabaseService.egressSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            status: 'stopped',
          }),
        }),
      );
    });

    it('should throw NotFoundException when no active session', async () => {
      mockDatabaseService.egressSession.findFirst.mockResolvedValue(null);

      await expect(service.stopReplayBuffer('user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle egress already stopped on LiveKit side', async () => {
      const activeSession = {
        id: 'session-1',
        egressId: 'egress-123',
        userId: 'user-123',
        status: 'active',
        segmentPath: 'session-1', // Relative path
      };

      mockDatabaseService.egressSession.findFirst.mockResolvedValue(
        activeSession,
      );
      mockEgressClient.stopEgress.mockRejectedValue(
        new Error('egress does not exist'),
      );
      mockDatabaseService.egressSession.update.mockResolvedValue({
        ...activeSession,
        status: 'stopped',
      });
      mockStorageService.deleteSegmentDirectory.mockResolvedValue(undefined);

      // Should still succeed and update database
      const result = await service.stopReplayBuffer('user-123');
      expect(result.status).toBe('stopped');
      expect(mockDatabaseService.egressSession.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException for other egress stop failures', async () => {
      const activeSession = {
        id: 'session-1',
        egressId: 'egress-123',
        userId: 'user-123',
        status: 'active',
        segmentPath: 'session-1', // Relative path
      };

      mockDatabaseService.egressSession.findFirst.mockResolvedValue(
        activeSession,
      );
      mockEgressClient.stopEgress.mockRejectedValue(
        new Error('Network timeout'),
      );

      await expect(service.stopReplayBuffer('user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should cleanup segment directory after stopping', async () => {
      const activeSession = {
        id: 'session-1',
        egressId: 'egress-123',
        userId: 'user-123',
        status: 'active',
        segmentPath: 'session-1', // Relative path
      };

      mockDatabaseService.egressSession.findFirst.mockResolvedValue(
        activeSession,
      );
      mockEgressClient.stopEgress.mockResolvedValue(undefined);
      mockDatabaseService.egressSession.update.mockResolvedValue({
        ...activeSession,
        status: 'stopped',
      });
      mockStorageService.deleteSegmentDirectory.mockResolvedValue(undefined);

      await service.stopReplayBuffer('user-123');

      // Now uses deleteSegmentDirectory with relative path
      expect(mockStorageService.deleteSegmentDirectory).toHaveBeenCalledWith(
        'session-1',
        { recursive: true, force: true },
      );
    });
  });

  describe('handleEgressEnded', () => {
    it('should update session status to stopped on success', async () => {
      const session = {
        id: 'session-1',
        userId: 'user-123',
        egressId: 'egress-123',
        channelId: 'channel-1',
        status: 'active',
        segmentPath: 'session-1', // Relative path
      };

      mockDatabaseService.egressSession.findUnique.mockResolvedValue(session);
      mockDatabaseService.egressSession.update.mockResolvedValue({
        ...session,
        status: 'stopped',
      });
      mockStorageService.deleteSegmentDirectory.mockResolvedValue(undefined);

      await service.handleEgressEnded('egress-123', 'stopped');

      expect(mockDatabaseService.egressSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            status: 'stopped',
          }),
        }),
      );
    });

    it('should update session status to failed on error', async () => {
      const session = {
        id: 'session-1',
        userId: 'user-123',
        egressId: 'egress-123',
        channelId: 'channel-1',
        status: 'active',
        segmentPath: 'session-1', // Relative path
      };

      mockDatabaseService.egressSession.findUnique.mockResolvedValue(session);
      mockDatabaseService.egressSession.update.mockResolvedValue({
        ...session,
        status: 'failed',
      });
      mockStorageService.deleteSegmentDirectory.mockResolvedValue(undefined);

      await service.handleEgressEnded(
        'egress-123',
        'failed',
        'Network timeout',
      );

      expect(mockDatabaseService.egressSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            status: 'failed',
            error: 'Network timeout',
          }),
        }),
      );
    });

    it('should handle session not found', async () => {
      mockDatabaseService.egressSession.findUnique.mockResolvedValue(null);

      // Should not throw, just log warning
      await expect(
        service.handleEgressEnded('unknown-egress', 'stopped'),
      ).resolves.toBeUndefined();
    });

    it('should skip update if session already stopped', async () => {
      const session = {
        id: 'session-1',
        userId: 'user-123',
        egressId: 'egress-123',
        status: 'stopped', // Already stopped
      };

      mockDatabaseService.egressSession.findUnique.mockResolvedValue(session);

      await service.handleEgressEnded('egress-123', 'stopped');

      // Should not call update
      expect(mockDatabaseService.egressSession.update).not.toHaveBeenCalled();
    });

    it('should send REPLAY_BUFFER_FAILED websocket event on failure', async () => {
      const session = {
        id: 'session-1',
        userId: 'user-123',
        egressId: 'egress-123',
        channelId: 'channel-1',
        status: 'active',
        segmentPath: 'session-1', // Relative path
      };

      mockDatabaseService.egressSession.findUnique.mockResolvedValue(session);
      mockDatabaseService.egressSession.update.mockResolvedValue({
        ...session,
        status: 'failed',
      });
      mockStorageService.deleteSegmentDirectory.mockResolvedValue(undefined);

      await service.handleEgressEnded('egress-123', 'failed', 'Codec error');

      expect(mockWebsocketService.sendToRoom).toHaveBeenCalledWith(
        'user-123',
        ServerEvents.REPLAY_BUFFER_FAILED,
        expect.objectContaining({
          sessionId: 'session-1',
          egressId: 'egress-123',
          channelId: 'channel-1',
          error: 'Codec error',
        }),
      );
    });

    it('should send REPLAY_BUFFER_STOPPED websocket event on success', async () => {
      const session = {
        id: 'session-1',
        userId: 'user-123',
        egressId: 'egress-123',
        channelId: 'channel-1',
        status: 'active',
        segmentPath: 'session-1', // Relative path
      };

      mockDatabaseService.egressSession.findUnique.mockResolvedValue(session);
      mockDatabaseService.egressSession.update.mockResolvedValue({
        ...session,
        status: 'stopped',
      });
      mockStorageService.deleteSegmentDirectory.mockResolvedValue(undefined);

      await service.handleEgressEnded('egress-123', 'stopped');

      expect(mockWebsocketService.sendToRoom).toHaveBeenCalledWith(
        'user-123',
        ServerEvents.REPLAY_BUFFER_STOPPED,
        expect.objectContaining({
          sessionId: 'session-1',
          egressId: 'egress-123',
          channelId: 'channel-1',
        }),
      );
    });

    it('should cleanup segment directory after handling', async () => {
      const session = {
        id: 'session-1',
        userId: 'user-123',
        egressId: 'egress-123',
        channelId: 'channel-1',
        status: 'active',
        segmentPath: 'session-1', // Relative path
      };

      mockDatabaseService.egressSession.findUnique.mockResolvedValue(session);
      mockDatabaseService.egressSession.update.mockResolvedValue({
        ...session,
        status: 'stopped',
      });
      mockStorageService.deleteSegmentDirectory.mockResolvedValue(undefined);

      await service.handleEgressEnded('egress-123', 'stopped');

      // Now uses deleteSegmentDirectory with relative path
      expect(mockStorageService.deleteSegmentDirectory).toHaveBeenCalledWith(
        'session-1',
        { recursive: true, force: true },
      );
    });
  });

  describe('getSessionInfo', () => {
    it('should return session info for active session with segments', async () => {
      const session = {
        id: 'session-1',
        egressId: 'egress-123',
        status: 'active',
        segmentPath: 'session-1', // Relative path
        startedAt: new Date('2025-01-01'),
      };

      mockDatabaseService.egressSession.findFirst.mockResolvedValue(session);
      // listFiles is called with the resolved path (via listAndSortSegments)
      mockStorageService.listFiles.mockResolvedValue([
        '2025-01-01T000000-segment_00000.ts',
        '2025-01-01T000010-segment_00001.ts',
      ]);
      mockStorageService.getFileStats
        .mockResolvedValueOnce({ size: 50000 }) // Complete segment
        .mockResolvedValueOnce({ size: 50000 }); // Complete segment

      const result = await service.getSessionInfo('user-123');

      expect(result.hasActiveSession).toBe(true);
      expect(result.sessionId).toBe('session-1');
      expect(result.totalSegments).toBe(2);
      expect(result.totalDurationSeconds).toBe(20); // 2 segments * 10 seconds
      // Verify resolveSegmentPath was called with relative path
      expect(mockStorageService.resolveSegmentPath).toHaveBeenCalledWith(
        'session-1',
      );
    });

    it('should return inactive status when no session', async () => {
      mockDatabaseService.egressSession.findFirst.mockResolvedValue(null);

      const result = await service.getSessionInfo('user-123');

      expect(result.hasActiveSession).toBe(false);
      expect(result.sessionId).toBeUndefined();
    });

    it('should filter out incomplete segments', async () => {
      const session = {
        id: 'session-1',
        status: 'active',
        segmentPath: 'session-1', // Relative path
        startedAt: new Date('2025-01-01'),
      };

      mockDatabaseService.egressSession.findFirst.mockResolvedValue(session);
      mockStorageService.listFiles.mockResolvedValue([
        '2025-01-01T000000-segment_00000.ts',
        '2025-01-01T000010-segment_00001.ts',
      ]);
      mockStorageService.getFileStats
        .mockResolvedValueOnce({ size: 50000 }) // Complete
        .mockResolvedValueOnce({ size: 1000 }); // Incomplete (< 10KB)

      const result = await service.getSessionInfo('user-123');

      expect(result.totalSegments).toBe(1); // Only 1 complete segment
      expect(result.totalDurationSeconds).toBe(10);
    });

    it('should handle empty segment directory', async () => {
      const session = {
        id: 'session-1',
        status: 'active',
        segmentPath: 'session-1', // Relative path
        startedAt: new Date('2025-01-01'),
      };

      mockDatabaseService.egressSession.findFirst.mockResolvedValue(session);
      mockStorageService.listFiles.mockResolvedValue([]);

      const result = await service.getSessionInfo('user-123');

      expect(result.hasActiveSession).toBe(true);
      expect(result.totalSegments).toBe(0);
      expect(result.totalDurationSeconds).toBe(0);
    });
  });

  // Clip library tests (getUserClips, getPublicClips, updateClip, deleteClip, shareClip)
  // have been moved to clip-library.service.spec.ts

  describe('cleanupOldSegments', () => {
    it('should delete old segment files from active sessions', async () => {
      const activeSessions = [
        {
          id: 'session-1',
          segmentPath: 'session-1', // Relative path
          status: 'active',
        },
      ];

      mockDatabaseService.egressSession.findMany.mockResolvedValue(
        activeSessions,
      );
      mockStorageService.segmentDirectoryExists.mockResolvedValue(true);
      mockStorageService.deleteOldFiles.mockResolvedValue(5);

      await service.cleanupOldSegments();

      // deleteOldFiles is called with resolved path
      expect(mockStorageService.deleteOldFiles).toHaveBeenCalledWith(
        '/app/storage/replay-segments/session-1',
        expect.any(Date),
      );
      expect(mockStorageService.resolveSegmentPath).toHaveBeenCalledWith(
        'session-1',
      );
    });

    it('should skip non-existent directories', async () => {
      const activeSessions = [
        {
          id: 'session-1',
          segmentPath: 'missing', // Relative path
          status: 'active',
        },
      ];

      mockDatabaseService.egressSession.findMany.mockResolvedValue(
        activeSessions,
      );
      mockStorageService.segmentDirectoryExists.mockResolvedValue(false);

      await service.cleanupOldSegments();

      expect(mockStorageService.deleteOldFiles).not.toHaveBeenCalled();
    });

    it('should handle deletion failure gracefully', async () => {
      const activeSessions = [
        {
          id: 'session-1',
          segmentPath: 'session-1', // Relative path
          status: 'active',
        },
      ];

      mockDatabaseService.egressSession.findMany.mockResolvedValue(
        activeSessions,
      );
      mockStorageService.segmentDirectoryExists.mockResolvedValue(true);
      mockStorageService.deleteOldFiles.mockRejectedValue(
        new Error('Permission denied'),
      );

      // Should not throw
      await expect(service.cleanupOldSegments()).resolves.toBeUndefined();
    });
  });

  describe('cleanupOrphanedSessions', () => {
    it('should cleanup sessions older than 3 hours', async () => {
      const oldSession = {
        id: 'old-session',
        egressId: 'old-egress',
        segmentPath: 'old-session', // Relative path
        status: 'active',
        startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      };

      mockDatabaseService.egressSession.findMany.mockResolvedValue([
        oldSession,
      ]);
      mockEgressClient.stopEgress.mockResolvedValue(undefined);
      mockDatabaseService.egressSession.update.mockResolvedValue({
        ...oldSession,
        status: 'stopped',
      });
      mockStorageService.segmentDirectoryExists.mockResolvedValue(true);
      mockStorageService.deleteSegmentDirectory.mockResolvedValue(undefined);

      await service.cleanupOrphanedSessions();

      expect(mockEgressClient.stopEgress).toHaveBeenCalledWith('old-egress');
      expect(mockDatabaseService.egressSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'old-session' },
          data: expect.objectContaining({
            status: 'stopped',
          }),
        }),
      );
      // Now uses deleteSegmentDirectory with relative path
      expect(mockStorageService.deleteSegmentDirectory).toHaveBeenCalledWith(
        'old-session',
        { recursive: true, force: true },
      );
    });

    it('should handle egress already stopped', async () => {
      const oldSession = {
        id: 'old-session',
        egressId: 'old-egress',
        segmentPath: 'old-session', // Relative path
        status: 'active',
        startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      };

      mockDatabaseService.egressSession.findMany.mockResolvedValue([
        oldSession,
      ]);
      mockEgressClient.stopEgress.mockRejectedValue(
        new Error('Egress not found'),
      );
      mockDatabaseService.egressSession.update.mockResolvedValue({
        ...oldSession,
        status: 'stopped',
      });
      mockStorageService.segmentDirectoryExists.mockResolvedValue(false);

      // Should still cleanup DB record
      await service.cleanupOrphanedSessions();

      expect(mockDatabaseService.egressSession.update).toHaveBeenCalled();
    });
  });

  describe('reconcileEgressStatus', () => {
    it('should update session when egress not found in LiveKit', async () => {
      const activeSession = {
        id: 'session-1',
        egressId: 'missing-egress',
        status: 'active',
      };

      mockDatabaseService.egressSession.findMany.mockResolvedValue([
        activeSession,
      ]);
      mockEgressClient.listEgress.mockResolvedValue([]); // Egress not found

      await service.reconcileEgressStatus();

      expect(mockDatabaseService.egressSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            status: 'stopped',
          }),
        }),
      );
    });

    it('should update session when LiveKit shows failed status', async () => {
      const activeSession = {
        id: 'session-1',
        egressId: 'failed-egress',
        status: 'active',
      };

      mockDatabaseService.egressSession.findMany.mockResolvedValue([
        activeSession,
      ]);
      mockEgressClient.listEgress.mockResolvedValue([
        { status: EgressStatus.EGRESS_FAILED },
      ]);

      await service.reconcileEgressStatus();

      expect(mockDatabaseService.egressSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            status: 'failed',
          }),
        }),
      );
    });

    it('should not update when status matches', async () => {
      const activeSession = {
        id: 'session-1',
        egressId: 'active-egress',
        status: 'active',
      };

      mockDatabaseService.egressSession.findMany.mockResolvedValue([
        activeSession,
      ]);
      mockEgressClient.listEgress.mockResolvedValue([
        { status: EgressStatus.EGRESS_ACTIVE },
      ]);

      await service.reconcileEgressStatus();

      expect(mockDatabaseService.egressSession.update).not.toHaveBeenCalled();
    });
  });
});
