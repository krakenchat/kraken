import { Injectable, Logger } from '@nestjs/common';
import { ServerEvents } from '@semaphore-chat/shared';
import { MessagesService } from './messages.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { NotificationsService } from '@/notifications/notifications.service';
import { LinkPreviewsService } from '@/link-previews/link-previews.service';

/** The shape returned by `MessagesService.create()` — enriched by dispatch(). */
type DispatchableMessage = Awaited<ReturnType<MessagesService['create']>>;

export interface MessageDispatchOptions {
  /** Room to broadcast to — a raw channelId or `RoomName.dmGroup(id)`. */
  room: string;
  /** Event to emit alongside the enriched message payload. */
  event: ServerEvents;
  /** Whether to fire mention/DM notification processing for this message. */
  notifications: boolean;
  /** Whether to fire link-preview processing for this message. */
  linkPreviews: boolean;
}

/**
 * Shared post-create message pipeline used by every path that creates a
 * message (channel SEND_MESSAGE, SEND_DM, incoming webhooks): enrich the
 * message with file metadata, broadcast it to the target room, then kick
 * off the non-blocking side effects (notifications, link previews).
 *
 * User-specific steps (timeout checks, slowmode, read-receipt auto-mark)
 * are NOT part of this pipeline — those stay in the caller.
 *
 * The two side-effect methods are intentionally private and separate so a
 * follow-up task can swap their bodies for job-queue enqueues without
 * touching `dispatch()` itself.
 */
@Injectable()
export class MessageDispatchService {
  private readonly logger = new Logger(MessageDispatchService.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly websocketService: WebsocketService,
    private readonly notificationsService: NotificationsService,
    private readonly linkPreviewsService: LinkPreviewsService,
  ) {}

  // Not declared `async`: every step here (enrich, sendToRoom, and kicking
  // off the two fire-and-forget side effects) is synchronous. The `Promise`
  // return type is kept because it's the public contract of this pipeline —
  // a follow-up task that awaits a queue enqueue can add `await` here
  // without changing callers.
  dispatch(
    message: DispatchableMessage,
    opts: MessageDispatchOptions,
  ): Promise<void> {
    // Enrich message with file metadata before emitting
    const enrichedMessage =
      this.messagesService.enrichMessageWithFileMetadata(message);

    this.websocketService.sendToRoom(opts.room, opts.event, {
      message: enrichedMessage,
    });

    if (opts.notifications) {
      this.dispatchNotifications(message);
    }

    if (opts.linkPreviews) {
      this.dispatchLinkPreviews(message, opts.room);
    }

    return Promise.resolve();
  }

  /**
   * Process message for notifications (mentions, etc.)
   * This runs asynchronously and doesn't block message sending.
   *
   * NOTE: kept as a standalone private method (fire-and-forget) so a
   * follow-up task can replace the body with a job-queue enqueue.
   */
  private dispatchNotifications(message: DispatchableMessage): void {
    this.notificationsService
      .processMessageForNotifications(message)
      .catch((error) =>
        this.logger.error('Failed to process notifications for message', error),
      );
  }

  /**
   * Process link previews (async, non-blocking).
   *
   * NOTE: kept as a standalone private method (fire-and-forget) so a
   * follow-up task can replace the body with a job-queue enqueue.
   */
  private dispatchLinkPreviews(
    message: DispatchableMessage,
    room: string,
  ): void {
    this.linkPreviewsService
      .processMessageLinkPreviews(
        message.id,
        message.spans,
        room,
        ServerEvents.UPDATE_MESSAGE,
      )
      .catch((error) =>
        this.logger.error('Failed to process link previews', error),
      );
  }
}
