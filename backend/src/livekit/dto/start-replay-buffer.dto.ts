import { IsString, IsMongoId, IsOptional } from 'class-validator';

export class StartReplayBufferDto {
  @IsMongoId()
  channelId: string;

  @IsString()
  roomName: string;

  @IsString()
  videoTrackId: string;

  @IsOptional()
  @IsString()
  audioTrackId?: string;

  /**
   * Participant identity (usually the user ID)
   * Used to query track resolution for matching egress encoding to source quality
   */
  @IsOptional()
  @IsString()
  participantIdentity?: string;
}
