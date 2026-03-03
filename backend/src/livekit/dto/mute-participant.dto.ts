import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';

export class MuteParticipantDto {
  @IsString()
  @IsNotEmpty()
  participantIdentity: string;

  @IsBoolean()
  mute: boolean;
}
