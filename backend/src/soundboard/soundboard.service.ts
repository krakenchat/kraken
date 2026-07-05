import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ResourceType } from '@prisma/client';
import { DatabaseService } from '@/database/database.service';
import { CreateSoundboardSoundDto } from './dto/create-soundboard-sound.dto';
import { SoundboardSoundDto } from './dto/soundboard-sound-response.dto';

@Injectable()
export class SoundboardService {
  private readonly logger = new Logger(SoundboardService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  private toDto(sound: {
    id: string;
    communityId: string;
    name: string;
    emoji: string | null;
    fileId: string;
    createdBy: string | null;
    createdAt: Date;
  }): SoundboardSoundDto {
    return {
      id: sound.id,
      communityId: sound.communityId,
      name: sound.name,
      emoji: sound.emoji,
      fileId: sound.fileId,
      createdBy: sound.createdBy,
      createdAt: sound.createdAt,
    };
  }

  /**
   * List all soundboard sounds for a community.
   */
  async listCommunitySounds(
    communityId: string,
  ): Promise<SoundboardSoundDto[]> {
    const sounds = await this.databaseService.soundboardSound.findMany({
      where: { communityId },
      orderBy: { name: 'asc' },
    });
    return sounds.map((s) => this.toDto(s));
  }

  /**
   * Create a soundboard sound. The audio file must already be uploaded via
   * /file-upload with resourceType SOUNDBOARD_SOUND for this community.
   */
  async createSound(
    communityId: string,
    userId: string,
    dto: CreateSoundboardSoundDto,
  ): Promise<SoundboardSoundDto> {
    // Enforce unique sound name within the community
    const existing = await this.databaseService.soundboardSound.findUnique({
      where: {
        communityId_name: { communityId, name: dto.name },
      },
    });
    if (existing) {
      throw new ConflictException(
        `A soundboard sound named "${dto.name}" already exists in this community`,
      );
    }

    // Validate the referenced file: must exist, be an audio soundboard file,
    // and belong to this community (prevents cross-community file references).
    const file = await this.databaseService.file.findUnique({
      where: { id: dto.fileId },
      select: {
        id: true,
        resourceType: true,
        fileCommunityId: true,
        deletedAt: true,
      },
    });
    if (!file || file.deletedAt) {
      throw new NotFoundException('Referenced file not found');
    }
    if (
      file.resourceType !== ResourceType.SOUNDBOARD_SOUND ||
      file.fileCommunityId !== communityId
    ) {
      throw new BadRequestException(
        'File is not a soundboard sound for this community',
      );
    }

    // Guard against reusing the same file for multiple sounds
    const fileInUse = await this.databaseService.soundboardSound.findFirst({
      where: { fileId: dto.fileId },
    });
    if (fileInUse) {
      throw new ConflictException(
        'This audio file is already used by another soundboard sound',
      );
    }

    const sound = await this.databaseService.soundboardSound.create({
      data: {
        communityId,
        name: dto.name,
        emoji: dto.emoji ?? null,
        fileId: dto.fileId,
        createdBy: userId,
      },
    });

    this.logger.log(
      `Created soundboard sound "${dto.name}" in community ${communityId}`,
    );
    return this.toDto(sound);
  }

  /**
   * Delete a soundboard sound (scoped to its community). Also removes the
   * backing file so storage does not leak.
   */
  async deleteSound(communityId: string, soundId: string): Promise<void> {
    const sound = await this.databaseService.soundboardSound.findUnique({
      where: { id: soundId },
    });
    if (!sound || sound.communityId !== communityId) {
      throw new NotFoundException('Soundboard sound not found');
    }

    // Deleting the sound row first; then soft/hard delete the backing file.
    await this.databaseService.soundboardSound.delete({
      where: { id: soundId },
    });

    // Remove the backing file record (cascade-safe: sound row already gone).
    await this.databaseService.file
      .delete({ where: { id: sound.fileId } })
      .catch((err: unknown) => {
        this.logger.warn(
          `Failed to delete backing file ${sound.fileId} for sound ${soundId}: ${String(
            err,
          )}`,
        );
      });

    this.logger.log(
      `Deleted soundboard sound "${sound.name}" (${soundId}) from community ${communityId}`,
    );
  }
}
