import { IsOptional, IsBoolean } from 'class-validator';

export class VoiceStateUpdateDto {
  @IsOptional()
  @IsBoolean()
  isVideoEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isScreenSharing?: boolean;

  @IsOptional()
  @IsBoolean()
  isMuted?: boolean;

  @IsOptional()
  @IsBoolean()
  isDeafened?: boolean;
}
