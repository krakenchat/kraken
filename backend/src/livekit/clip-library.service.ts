import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { StorageService } from '@/storage/storage.service';
import { WebsocketService } from '@/websocket/websocket.service';
import { MessagesService } from '@/messages/messages.service';
import { CreateMessageDto } from '@/messages/dto/create-message.dto';
import { ServerEvents } from '@/websocket/events.enum/server-events.enum';
import { getErrorMessage } from '@/common/utils/error.utils';
import {
  UpdateClipDto,
  ShareClipDto,
  ClipResponseDto,
  ShareClipResponseDto,
} from './dto/clip-library.dto';

/**
 * Service for managing the user's clip library (CRUD operations)
 *
 * Extracted from LivekitReplayService to follow single responsibility principle.
 * Handles clip metadata, visibility, and sharing - not video processing.
 */
@Injectable()
export class ClipLibraryService {
  private readonly logger = new Logger(ClipLibraryService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
    private readonly websocketService: WebsocketService,
    private readonly messagesService: MessagesService,
  ) {}

  /**
   * Map database clip to response DTO
   */
  private mapClipToResponse(clip: {
    id: string;
    fileId: string;
    channelId: string | null;
    durationSeconds: number;
    isPublic: boolean;
    capturedAt: Date;
    file: {
      id: string;
      filename: string;
      size: number;
    };
  }): ClipResponseDto {
    return {
      id: clip.id,
      fileId: clip.fileId,
      channelId: clip.channelId,
      durationSeconds: clip.durationSeconds,
      isPublic: clip.isPublic,
      capturedAt: clip.capturedAt,
      downloadUrl: `/file/${clip.fileId}`,
      sizeBytes: clip.file.size,
      filename: clip.file.filename,
    };
  }

  /**
   * Get all clips for a user (their personal clip library)
   *
   * @param userId - ID of the user
   * @returns Array of clips with file metadata
   */
  async getUserClips(userId: string): Promise<ClipResponseDto[]> {
    this.logger.log(`Fetching clips for user ${userId}`);

    const clips = await this.databaseService.replayClip.findMany({
      where: { userId },
      include: {
        file: {
          select: {
            id: true,
            filename: true,
            size: true,
          },
        },
      },
      orderBy: { capturedAt: 'desc' },
    });

    return clips.map((clip) => this.mapClipToResponse(clip));
  }

  /**
   * Get public clips for a user (visible on their profile)
   *
   * @param userId - ID of the user whose public clips to fetch
   * @returns Array of public clips with file metadata
   */
  async getPublicClips(userId: string): Promise<ClipResponseDto[]> {
    this.logger.log(`Fetching public clips for user ${userId}`);

    const clips = await this.databaseService.replayClip.findMany({
      where: {
        userId,
        isPublic: true,
      },
      include: {
        file: {
          select: {
            id: true,
            filename: true,
            size: true,
          },
        },
      },
      orderBy: { capturedAt: 'desc' },
    });

    return clips.map((clip) => this.mapClipToResponse(clip));
  }

  /**
   * Update a clip (e.g., toggle public visibility)
   *
   * @param userId - ID of the user (for ownership verification)
   * @param clipId - ID of the clip to update
   * @param dto - Update data
   * @returns Updated clip
   */
  async updateClip(
    userId: string,
    clipId: string,
    dto: UpdateClipDto,
  ): Promise<ClipResponseDto> {
    this.logger.log(`Updating clip ${clipId} for user ${userId}`);

    // Verify ownership
    const clip = await this.databaseService.replayClip.findFirst({
      where: { id: clipId, userId },
      include: {
        file: {
          select: {
            id: true,
            filename: true,
            size: true,
          },
        },
      },
    });

    if (!clip) {
      throw new NotFoundException('Clip not found or access denied');
    }

    // Update clip
    const updatedClip = await this.databaseService.replayClip.update({
      where: { id: clipId },
      data: {
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
      },
      include: {
        file: {
          select: {
            id: true,
            filename: true,
            size: true,
          },
        },
      },
    });

    this.logger.log(`Updated clip ${clipId}: isPublic=${updatedClip.isPublic}`);

    return this.mapClipToResponse(updatedClip);
  }

  /**
   * Delete a clip from user's library
   *
   * @param userId - ID of the user (for ownership verification)
   * @param clipId - ID of the clip to delete
   */
  async deleteClip(userId: string, clipId: string): Promise<void> {
    this.logger.log(`Deleting clip ${clipId} for user ${userId}`);

    // Verify ownership and get file info
    const clip = await this.databaseService.replayClip.findFirst({
      where: { id: clipId, userId },
      include: {
        file: {
          select: {
            id: true,
            storagePath: true,
          },
        },
      },
    });

    if (!clip) {
      throw new NotFoundException('Clip not found or access denied');
    }

    // Delete clip record (will cascade delete due to relation)
    await this.databaseService.replayClip.delete({
      where: { id: clipId },
    });

    // Delete file record
    await this.databaseService.file.delete({
      where: { id: clip.fileId },
    });

    // Delete actual file from storage
    try {
      if (clip.file.storagePath) {
        await this.storageService.deleteFile(clip.file.storagePath);
        this.logger.log(`Deleted file from storage: ${clip.file.storagePath}`);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to delete file from storage: ${getErrorMessage(error)}`,
      );
      // Don't throw - DB records are already deleted
    }

    this.logger.log(`Successfully deleted clip ${clipId}`);
  }

  /**
   * Share an existing clip to a channel or DM
   *
   * Creates a message with the clip attached without creating a new clip
   *
   * @param userId - ID of the user sharing the clip
   * @param clipId - ID of the clip to share
   * @param dto - Share destination details
   * @returns Response with message ID
   */
  async shareClip(
    userId: string,
    clipId: string,
    dto: ShareClipDto,
  ): Promise<ShareClipResponseDto> {
    this.logger.log(`Sharing clip ${clipId} to ${dto.destination}`);

    // Verify ownership
    const clip = await this.databaseService.replayClip.findFirst({
      where: { id: clipId, userId },
      include: {
        file: {
          select: {
            id: true,
            size: true,
          },
        },
      },
    });

    if (!clip) {
      throw new NotFoundException('Clip not found or access denied');
    }

    const sizeMB = Math.round(clip.file.size / 1024 / 1024);

    // Create message with clip attached
    const messagePayload: CreateMessageDto = {
      id: '', // Will be generated by Prisma
      channelId:
        dto.destination === 'channel' && dto.targetChannelId
          ? dto.targetChannelId
          : null,
      directMessageGroupId:
        dto.destination === 'dm' && dto.targetDirectMessageGroupId
          ? dto.targetDirectMessageGroupId
          : null,
      authorId: userId,
      sentAt: new Date(),
      editedAt: null,
      deletedAt: null,
      spans: [
        {
          type: 'PLAINTEXT',
          text: `Replay clip - ${clip.durationSeconds}s (${sizeMB}MB)`,
          userId: null,
          specialKind: null,
          communityId: null,
          aliasId: null,
        },
      ],
      attachments: [clip.fileId],
      pendingAttachments: 0,
      searchText: null,
      reactions: [],
      pinned: false,
      pinnedAt: null,
      pinnedBy: null,
      deletedBy: null,
      deletedByReason: null,
      parentMessageId: null,
      replyCount: 0,
      lastReplyAt: null,
    };

    const message = await this.messagesService.create(messagePayload);

    // Enrich with file metadata for WebSocket clients
    const enrichedMessage =
      await this.messagesService.enrichMessageWithFileMetadata(message);

    // Emit WebSocket event to notify channel/DM members
    if (dto.destination === 'channel' && dto.targetChannelId) {
      this.websocketService.sendToRoom(
        dto.targetChannelId,
        ServerEvents.NEW_MESSAGE,
        { message: enrichedMessage },
      );
    } else if (dto.destination === 'dm' && dto.targetDirectMessageGroupId) {
      this.websocketService.sendToRoom(
        dto.targetDirectMessageGroupId,
        ServerEvents.NEW_DM,
        { message: enrichedMessage },
      );
    }

    this.logger.log(
      `Shared clip ${clipId} to ${dto.destination} via message ${message.id}`,
    );

    return {
      messageId: message.id,
      clipId: clip.id,
      destination: dto.destination,
    };
  }
}
