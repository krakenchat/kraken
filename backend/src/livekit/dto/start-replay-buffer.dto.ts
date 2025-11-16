import { IsString, IsMongoId } from 'class-validator';

export class StartReplayBufferDto {
  @IsMongoId()
  channelId: string;

  @IsString()
  roomName: string;

  @IsString()
  videoTrackId: string;

  @IsString()
  audioTrackId: string;
}
