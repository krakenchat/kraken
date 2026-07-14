import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import type { Job } from 'bullmq';
import { NotificationsFanoutProcessor } from './notifications-fanout.processor';
import { NotificationsService } from './notifications.service';
import { DatabaseService } from '@/database/database.service';
import { createMockDatabase, MessageFactory } from '@/test-utils';
import { MessageFanoutJobData } from '@/jobs/jobs.types';

describe('NotificationsFanoutProcessor', () => {
  let processor: NotificationsFanoutProcessor;
  let mockDatabase: ReturnType<typeof createMockDatabase>;
  let notificationsService: Mocked<NotificationsService>;

  function buildJob(messageId: string): Job<MessageFanoutJobData> {
    return {
      id: 'job-1',
      data: { messageId },
    } as unknown as Job<MessageFanoutJobData>;
  }

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const { unit, unitRef } = await TestBed.solitary(
      NotificationsFanoutProcessor,
    )
      .mock(DatabaseService)
      .final(mockDatabase)
      .compile();

    processor = unit;
    notificationsService = unitRef.get(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('re-reads the message with spans and hands it to processMessageForNotifications', async () => {
    const message = MessageFactory.build({
      id: 'msg-1',
      channelId: 'channel-1',
    });
    mockDatabase.message.findUnique.mockResolvedValue(message);
    notificationsService.processMessageForNotifications.mockResolvedValue(
      undefined,
    );

    await processor.process(buildJob('msg-1'));

    expect(mockDatabase.message.findUnique).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      include: {
        spans: {
          select: {
            type: true,
            userId: true,
            specialKind: true,
            aliasId: true,
          },
        },
      },
    });
    expect(
      notificationsService.processMessageForNotifications,
    ).toHaveBeenCalledWith(message);
  });

  it('skips processing (without throwing) when the message no longer exists', async () => {
    mockDatabase.message.findUnique.mockResolvedValue(null);

    await expect(
      processor.process(buildJob('missing-msg')),
    ).resolves.toBeUndefined();

    expect(
      notificationsService.processMessageForNotifications,
    ).not.toHaveBeenCalled();
  });

  it('propagates errors from processMessageForNotifications so BullMQ marks the job failed and retries', async () => {
    const message = MessageFactory.build({
      id: 'msg-1',
      channelId: 'channel-1',
    });
    mockDatabase.message.findUnique.mockResolvedValue(message);
    const error = new Error('DB unavailable');
    notificationsService.processMessageForNotifications.mockRejectedValue(
      error,
    );

    await expect(processor.process(buildJob('msg-1'))).rejects.toThrow(
      'DB unavailable',
    );
  });

  it('propagates errors from the message re-read itself', async () => {
    mockDatabase.message.findUnique.mockRejectedValue(
      new Error('connection reset'),
    );

    await expect(processor.process(buildJob('msg-1'))).rejects.toThrow(
      'connection reset',
    );
    expect(
      notificationsService.processMessageForNotifications,
    ).not.toHaveBeenCalled();
  });
});
