import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { flattenSpansToDisplayText } from '@/common/utils/text.utils';
import {
  extractUrls,
  fetchLinkMetadata,
  LinkPreviewData,
} from './link-preview.utils';
import { groupReactions } from '@/common/utils/reactions.utils';
import { Prisma } from '@prisma/client';

@Injectable()
export class LinkPreviewsService {
  private readonly logger = new Logger(LinkPreviewsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly websocketService: WebsocketService,
  ) {}

  /**
   * Extract URLs from message spans, fetch OG metadata, store in DB,
   * and emit an update event. Called fire-and-forget after message creation.
   */
  async processMessageLinkPreviews(
    messageId: string,
    spans: { text?: string | null }[],
    roomId: string,
    serverEvent: string,
  ): Promise<void> {
    const text = flattenSpansToDisplayText(spans);
    if (!text) return;

    const urls = extractUrls(text);
    if (urls.length === 0) return;

    const previews: LinkPreviewData[] = [];
    for (const url of urls) {
      try {
        const metadata = await fetchLinkMetadata(url);
        if (metadata) {
          previews.push(metadata);
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch link preview for ${url}`, error);
      }
    }

    if (previews.length === 0) return;

    // Verify message still exists and hasn't been deleted
    const existing = await this.databaseService.message.findUnique({
      where: { id: messageId },
      select: { id: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) return;

    // Store previews
    await this.databaseService.message.update({
      where: { id: messageId },
      data: { linkPreviews: previews as unknown as Prisma.InputJsonValue },
    });

    // Re-read with full includes for broadcast
    const MESSAGE_INCLUDE = {
      spans: { orderBy: { position: 'asc' as const } },
      reactions: true,
      attachments: {
        include: {
          file: {
            select: {
              id: true,
              filename: true,
              mimeType: true,
              fileType: true,
              size: true,
              thumbnailPath: true,
            },
          },
        },
        orderBy: { position: 'asc' as const },
      },
    } as const;

    const updatedMessage = await this.databaseService.message.findUnique({
      where: { id: messageId },
      include: MESSAGE_INCLUDE,
    });

    if (!updatedMessage) return;

    // Format the message for broadcast (same shape clients expect)
    const formatted = {
      ...updatedMessage,
      linkPreviews:
        (updatedMessage.linkPreviews as LinkPreviewData[] | null) ?? undefined,
      reactions: groupReactions(updatedMessage.reactions),
      attachments: updatedMessage.attachments.map((a) => ({
        id: a.file.id,
        filename: a.file.filename,
        mimeType: a.file.mimeType,
        fileType: a.file.fileType,
        size: a.file.size,
        hasThumbnail: !!a.file.thumbnailPath,
      })),
    };

    this.websocketService.sendToRoom(roomId, serverEvent, {
      message: formatted,
    });
  }
}
