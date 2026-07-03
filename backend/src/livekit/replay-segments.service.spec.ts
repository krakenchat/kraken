import { TestBed } from '@suites/unit';
import { ConfigService } from '@nestjs/config';
import { ReplaySegmentsService } from './replay-segments.service';
import { DatabaseService } from '@/database/database.service';
import { StorageService } from '@/storage/storage.service';
import { EGRESS_CLIENT } from './providers/egress-client.provider';

// Mock fluent-ffmpeg
const mockFfmpegCommand = {
  input: jest.fn().mockReturnThis(),
  outputOptions: jest.fn().mockReturnThis(),
  output: jest.fn().mockReturnThis(),
  on: jest.fn().mockImplementation(function (
    this: typeof mockFfmpegCommand,
    event: string,
    cb: () => void,
  ) {
    if (event === 'end') {
      (this as { _endCb?: () => void })._endCb = cb;
    }
    return this;
  }),
  run: jest.fn().mockImplementation(function (this: typeof mockFfmpegCommand) {
    const self = this as { _endCb?: () => void };
    if (self._endCb) self._endCb();
  }),
};
jest.mock('fluent-ffmpeg', () => {
  return jest.fn(() => mockFfmpegCommand);
});

describe('ReplaySegmentsService', () => {
  let service: ReplaySegmentsService;

  let databaseService: any;

  let storageService: any;

  const mockEgressClient = {
    startTrackCompositeEgress: jest.fn(),
    stopEgress: jest.fn(),
    listEgress: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const { unit, unitRef } = await TestBed.solitary(ReplaySegmentsService)
      .mock(EGRESS_CLIENT)
      .final(mockEgressClient)
      .mock(ConfigService)
      .final({
        get: jest.fn().mockImplementation((key: string) => {
          const config: Record<string, string> = {
            REPLAY_SEGMENT_CLEANUP_AGE_MINUTES: '20',
          };
          return config[key];
        }),
      })
      .compile();

    service = unit;
    databaseService = unitRef.get(DatabaseService);
    storageService = unitRef.get(StorageService);

    // Set up default return values for StorageService
    storageService.resolveSegmentPath.mockImplementation(
      (relativePath: string) => `/app/storage/replay-segments/${relativePath}`,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listCompleteSegments', () => {
    it('should list segments sorted by sequence number', async () => {
      storageService.listFiles.mockResolvedValue([
        '2025-01-01T000010-segment_00001.ts',
        '2025-01-01T000000-segment_00000.ts',
      ]);
      storageService.getFileStats.mockResolvedValue({ size: 50000 });

      const result = await service.listCompleteSegments(
        '/app/storage/replay-segments/session-1',
      );

      expect(result).toHaveLength(2);
      expect(result[0].sequence).toBe(0);
      expect(result[1].sequence).toBe(1);
    });

    it('should filter out incomplete segments (< 10KB)', async () => {
      storageService.listFiles.mockResolvedValue([
        '2025-01-01T000000-segment_00000.ts',
        '2025-01-01T000010-segment_00001.ts',
      ]);
      storageService.getFileStats
        .mockResolvedValueOnce({ size: 50000 }) // Complete
        .mockResolvedValueOnce({ size: 1000 }); // Incomplete (< 10KB)

      const result = await service.listCompleteSegments(
        '/app/storage/replay-segments/session-1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].sequence).toBe(0);
    });

    it('should skip segments that cannot be stat-ed', async () => {
      storageService.listFiles.mockResolvedValue([
        '2025-01-01T000000-segment_00000.ts',
        '2025-01-01T000010-segment_00001.ts',
      ]);
      storageService.getFileStats
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce({ size: 50000 });

      const result = await service.listCompleteSegments(
        '/app/storage/replay-segments/session-1',
      );

      expect(result).toHaveLength(1);
      expect(result[0].sequence).toBe(1);
    });

    it('should return empty array when listing fails', async () => {
      storageService.listFiles.mockRejectedValue(
        new Error('Permission denied'),
      );

      const result = await service.listCompleteSegments(
        '/app/storage/replay-segments/session-1',
      );

      expect(result).toEqual([]);
    });
  });

  describe('getRemuxedSegmentPath', () => {
    const userId = 'user-123';
    const segmentFile = 'segment_00001.ts';

    beforeEach(() => {
      databaseService.egressSession.findFirst.mockResolvedValue({
        id: 'session-1',
        userId,
        status: 'active',
        segmentPath: 'session-1',
      });
      storageService.ensureDirectory.mockResolvedValue(undefined);
      // First call: original segment exists (getSegmentPath check)
      // Second call: remuxed cache doesn't exist yet
      storageService.fileExists
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      storageService.getFileStats.mockResolvedValue({ size: 50000 });
    });

    it('should pass -copyts to FFmpeg to preserve segment timestamps', async () => {
      await service.getRemuxedSegmentPath(userId, segmentFile);

      expect(mockFfmpegCommand.outputOptions).toHaveBeenCalledWith(
        expect.arrayContaining(['-copyts']),
      );
    });

    it('should pass all required output options', async () => {
      await service.getRemuxedSegmentPath(userId, segmentFile);

      expect(mockFfmpegCommand.outputOptions).toHaveBeenCalledWith([
        '-c copy',
        '-f mpegts',
        '-copyts',
      ]);
    });

    it('should return cached path if already remuxed', async () => {
      storageService.fileExists
        .mockReset()
        .mockResolvedValueOnce(true) // original exists
        .mockResolvedValueOnce(true); // cache exists

      const result = await service.getRemuxedSegmentPath(userId, segmentFile);

      expect(result).toContain(segmentFile);
      expect(mockFfmpegCommand.outputOptions).not.toHaveBeenCalled();
    });

    it('should return original path for incomplete segments', async () => {
      storageService.fileExists
        .mockReset()
        .mockResolvedValueOnce(true) // original exists
        .mockResolvedValueOnce(false); // cache doesn't exist
      storageService.getFileStats.mockResolvedValue({ size: 500 });

      const result = await service.getRemuxedSegmentPath(userId, segmentFile);

      // Should return the original path (resolved from segmentPath)
      expect(result).toContain('session-1');
      expect(mockFfmpegCommand.outputOptions).not.toHaveBeenCalled();
    });

    it('should return original path when remux fails', async () => {
      storageService.fileExists
        .mockReset()
        .mockResolvedValueOnce(true) // original exists
        .mockResolvedValueOnce(false); // cache doesn't exist
      mockFfmpegCommand.on.mockImplementation(function (
        this: typeof mockFfmpegCommand,
        event: string,
        cb: (err?: Error) => void,
      ) {
        if (event === 'error') {
          (this as { _errorCb?: (err: Error) => void })._errorCb = cb;
        }
        return this;
      });
      mockFfmpegCommand.run.mockImplementation(function (
        this: typeof mockFfmpegCommand,
      ) {
        const self = this as { _errorCb?: (err: Error) => void };
        if (self._errorCb) self._errorCb(new Error('FFmpeg failed'));
      });

      const result = await service.getRemuxedSegmentPath(userId, segmentFile);

      // Falls back to original path
      expect(result).toContain('session-1');

      // Restore default mock behavior for other tests
      mockFfmpegCommand.on.mockImplementation(function (
        this: typeof mockFfmpegCommand,
        event: string,
        cb: () => void,
      ) {
        if (event === 'end') {
          (this as { _endCb?: () => void })._endCb = cb;
        }
        return this;
      });
      mockFfmpegCommand.run.mockImplementation(function (
        this: typeof mockFfmpegCommand,
      ) {
        const self = this as { _endCb?: () => void };
        if (self._endCb) self._endCb();
      });
    });
  });

  describe('getSegmentPath', () => {
    const userId = 'user-123';

    beforeEach(() => {
      databaseService.egressSession.findFirst.mockResolvedValue({
        id: 'session-1',
        userId,
        status: 'active',
        segmentPath: 'session-1',
      });
      storageService.fileExists.mockResolvedValue(true);
    });

    it('should reject filenames with path traversal attempts', async () => {
      await expect(
        service.getSegmentPath(userId, '../../../etc/passwd'),
      ).rejects.toThrow('That replay segment is not valid.');
    });

    it('should reject filenames with invalid format', async () => {
      await expect(
        service.getSegmentPath(userId, 'segment.mp4'),
      ).rejects.toThrow('That replay segment is not valid.');
    });

    it('should throw NotFoundException when no active session', async () => {
      databaseService.egressSession.findFirst.mockResolvedValue(null);

      await expect(
        service.getSegmentPath(userId, 'segment_00001.ts'),
      ).rejects.toThrow('No active replay found. Start screen sharing first.');
    });

    it('should throw NotFoundException when segment file does not exist', async () => {
      storageService.fileExists.mockResolvedValue(false);

      await expect(
        service.getSegmentPath(userId, 'segment_00001.ts'),
      ).rejects.toThrow('That part of the replay is no longer available.');
    });

    it('should return resolved segment path', async () => {
      const result = await service.getSegmentPath(userId, 'segment_00001.ts');

      expect(result).toBe(
        '/app/storage/replay-segments/session-1/segment_00001.ts',
      );
    });
  });

  describe('cleanupOldSegments', () => {
    it('should delete old segment files from active sessions', async () => {
      const activeSessions = [
        {
          id: 'session-1',
          segmentPath: 'session-1', // Relative path
          status: 'active',
        },
      ];

      databaseService.egressSession.findMany.mockResolvedValue(activeSessions);
      storageService.segmentDirectoryExists.mockResolvedValue(true);
      storageService.deleteOldFiles.mockResolvedValue(5);

      await service.cleanupOldSegments();

      // deleteOldFiles is called with resolved path
      expect(storageService.deleteOldFiles).toHaveBeenCalledWith(
        '/app/storage/replay-segments/session-1',
        expect.any(Date),
      );
      expect(storageService.resolveSegmentPath).toHaveBeenCalledWith(
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

      databaseService.egressSession.findMany.mockResolvedValue(activeSessions);
      storageService.segmentDirectoryExists.mockResolvedValue(false);

      await service.cleanupOldSegments();

      expect(storageService.deleteOldFiles).not.toHaveBeenCalled();
    });

    it('should handle deletion failure gracefully', async () => {
      const activeSessions = [
        {
          id: 'session-1',
          segmentPath: 'session-1', // Relative path
          status: 'active',
        },
      ];

      databaseService.egressSession.findMany.mockResolvedValue(activeSessions);
      storageService.segmentDirectoryExists.mockResolvedValue(true);
      storageService.deleteOldFiles.mockRejectedValue(
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

      databaseService.egressSession.findMany.mockResolvedValue([oldSession]);
      mockEgressClient.stopEgress.mockResolvedValue(undefined);
      databaseService.egressSession.update.mockResolvedValue({
        ...oldSession,
        status: 'stopped',
      });
      storageService.segmentDirectoryExists.mockResolvedValue(true);
      storageService.deleteSegmentDirectory.mockResolvedValue(undefined);

      await service.cleanupOrphanedSessions();

      expect(mockEgressClient.stopEgress).toHaveBeenCalledWith('old-egress');
      expect(databaseService.egressSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'old-session' },
          data: expect.objectContaining({
            status: 'stopped',
          }),
        }),
      );
      // Now uses deleteSegmentDirectory with relative path
      expect(storageService.deleteSegmentDirectory).toHaveBeenCalledWith(
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

      databaseService.egressSession.findMany.mockResolvedValue([oldSession]);
      mockEgressClient.stopEgress.mockRejectedValue(
        new Error('Egress not found'),
      );
      databaseService.egressSession.update.mockResolvedValue({
        ...oldSession,
        status: 'stopped',
      });
      storageService.segmentDirectoryExists.mockResolvedValue(false);

      // Should still cleanup DB record
      await service.cleanupOrphanedSessions();

      expect(databaseService.egressSession.update).toHaveBeenCalled();
    });
  });
});
