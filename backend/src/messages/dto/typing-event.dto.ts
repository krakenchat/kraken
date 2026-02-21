import { IsString, IsOptional, ValidateIf, IsDefined } from 'class-validator';

export class TypingEventDto {
  @IsString()
  @IsOptional()
  @ValidateIf((o: TypingEventDto) => !o.directMessageGroupId)
  @IsDefined({
    message: 'Either channelId or directMessageGroupId must be provided',
  })
  channelId?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o: TypingEventDto) => !o.channelId)
  @IsDefined({
    message: 'Either channelId or directMessageGroupId must be provided',
  })
  directMessageGroupId?: string;
}
