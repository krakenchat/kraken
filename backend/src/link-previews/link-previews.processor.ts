import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DatabaseService } from '@/database/database.service';
import { LINK_PREVIEWS_QUEUE } from '@/jobs/jobs.constants';
import { LinkPreviewJobData } from '@/jobs/jobs.types';
import { LinkPreviewsService } from './link-previews.service';

/**
 * Max jobs this processor runs concurrently. Read directly from
 * process.env (not ConfigService) because @Processor's options are
 * evaluated at class-decoration time, before Nest's DI container exists.
 */
const CONCURRENCY = Number(process.env.JOB_WORKER_CONCURRENCY) || 4;

/**
 * Consumes the `link-previews` queue. Re-reads spans from the DB (ordered
 * like every other span read in this codebase) instead of trusting a
 * payload snapshot, so a job processed after further edits still reflects
 * the message's current content rather than stale text captured at enqueue
 * time.
 */
@Processor(LINK_PREVIEWS_QUEUE, { concurrency: CONCURRENCY })
export class LinkPreviewsProcessor extends WorkerHost {
  private readonly logger = new Logger(LinkPreviewsProcessor.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly linkPreviewsService: LinkPreviewsService,
  ) {
    super();
  }

  async process(job: Job<LinkPreviewJobData>): Promise<void> {
    const { messageId, room, event } = job.data;

    const message = await this.databaseService.message.findUnique({
      where: { id: messageId },
      select: {
        spans: {
          orderBy: { position: 'asc' },
          select: { text: true },
        },
      },
    });

    if (!message) {
      this.logger.warn(
        `link-previews: message ${messageId} not found (job ${job.id}) — skipping`,
      );
      return;
    }

    await this.linkPreviewsService.processMessageLinkPreviews(
      messageId,
      message.spans,
      room,
      event,
    );
  }
}
