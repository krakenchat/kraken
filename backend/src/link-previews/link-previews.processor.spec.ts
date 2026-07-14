import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import type { Job } from 'bullmq';
import { ServerEvents } from '@semaphore-chat/shared';
import { LinkPreviewsProcessor } from './link-previews.processor';
import { LinkPreviewsService } from './link-previews.service';
import { DatabaseService } from '@/database/database.service';
import { createMockDatabase } from '@/test-utils';
import { LinkPreviewJobData } from '@/jobs/jobs.types';

describe('LinkPreviewsProcessor', () => {
  let processor: LinkPreviewsProcessor;
  let mockDatabase: ReturnType<typeof createMockDatabase>;
  let linkPreviewsService: Mocked<LinkPreviewsService>;

  function buildJob(data: LinkPreviewJobData): Job<LinkPreviewJobData> {
    return { id: 'job-1', data } as unknown as Job<LinkPreviewJobData>;
  }

  beforeEach(async () => {
    mockDatabase = createMockDatabase();

    const { unit, unitRef } = await TestBed.solitary(LinkPreviewsProcessor)
      .mock(DatabaseService)
      .final(mockDatabase)
      .compile();

    processor = unit;
    linkPreviewsService = unitRef.get(LinkPreviewsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('re-reads spans from the DB (ordered by position) and delegates to LinkPreviewsService', async () => {
    const spans = [{ text: 'check out https://example.com' }, { text: null }];
    mockDatabase.message.findUnique.mockResolvedValue({ spans });
    linkPreviewsService.processMessageLinkPreviews.mockResolvedValue(undefined);

    await processor.process(
      buildJob({
        messageId: 'msg-1',
        room: 'channel-1',
        event: ServerEvents.UPDATE_MESSAGE,
      }),
    );

    expect(mockDatabase.message.findUnique).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      select: {
        spans: { orderBy: { position: 'asc' }, select: { text: true } },
      },
    });
    expect(linkPreviewsService.processMessageLinkPreviews).toHaveBeenCalledWith(
      'msg-1',
      spans,
      'channel-1',
      ServerEvents.UPDATE_MESSAGE,
    );
  });

  it('skips processing (without throwing) when the message no longer exists', async () => {
    mockDatabase.message.findUnique.mockResolvedValue(null);

    await expect(
      processor.process(
        buildJob({
          messageId: 'missing-msg',
          room: 'channel-1',
          event: ServerEvents.UPDATE_MESSAGE,
        }),
      ),
    ).resolves.toBeUndefined();

    expect(
      linkPreviewsService.processMessageLinkPreviews,
    ).not.toHaveBeenCalled();
  });

  it('propagates errors from LinkPreviewsService so BullMQ retries the job', async () => {
    mockDatabase.message.findUnique.mockResolvedValue({ spans: [] });
    const error = new Error('link preview processing failed');
    linkPreviewsService.processMessageLinkPreviews.mockRejectedValue(error);

    await expect(
      processor.process(
        buildJob({
          messageId: 'msg-1',
          room: 'channel-1',
          event: ServerEvents.UPDATE_MESSAGE,
        }),
      ),
    ).rejects.toThrow('link preview processing failed');
  });

  it('propagates errors from the message re-read itself', async () => {
    mockDatabase.message.findUnique.mockRejectedValue(
      new Error('connection reset'),
    );

    await expect(
      processor.process(
        buildJob({
          messageId: 'msg-1',
          room: 'channel-1',
          event: ServerEvents.UPDATE_MESSAGE,
        }),
      ),
    ).rejects.toThrow('connection reset');
    expect(
      linkPreviewsService.processMessageLinkPreviews,
    ).not.toHaveBeenCalled();
  });
});
