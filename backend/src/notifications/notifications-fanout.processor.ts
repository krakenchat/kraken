import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DatabaseService } from '@/database/database.service';
import { MESSAGE_FANOUT_QUEUE } from '@/jobs/jobs.constants';
import { MessageFanoutJobData } from '@/jobs/jobs.types';
import { NotificationsService } from './notifications.service';

/**
 * Max jobs this processor runs concurrently. Read directly from
 * process.env (not ConfigService) because @Processor's options are
 * evaluated at class-decoration time, before Nest's DI container exists.
 */
const CONCURRENCY = Number(process.env.JOB_WORKER_CONCURRENCY) || 4;

/**
 * Consumes the `message-fanout` queue: re-reads the message (spans + author
 * are all processMessageForNotifications needs) and runs mention/DM/
 * channel-message notification fan-out for it.
 *
 * Errors are intentionally NOT caught here — letting them propagate marks
 * the BullMQ job failed, which triggers the queue's retry/backoff policy
 * (see JobsModule). Swallowing errors would silently turn the queue back
 * into the fire-and-forget behavior this processor replaced.
 */
@Processor(MESSAGE_FANOUT_QUEUE, { concurrency: CONCURRENCY })
export class NotificationsFanoutProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsFanoutProcessor.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<MessageFanoutJobData>): Promise<void> {
    const { messageId } = job.data;

    const message = await this.databaseService.message.findUnique({
      where: { id: messageId },
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

    if (!message) {
      // The message may have been deleted between enqueue and processing —
      // this is a normal race, not a failure, so the job succeeds as a no-op
      // rather than retrying forever.
      this.logger.warn(
        `message-fanout: message ${messageId} not found (job ${job.id}) — skipping`,
      );
      return;
    }

    await this.notificationsService.processMessageForNotifications(message);
  }
}
