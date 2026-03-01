import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class RemoveReactionDto {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  emoji: string;
}
