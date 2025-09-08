import { IsString, IsNotEmpty } from 'class-validator';

export class RemoveReactionDto {
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  emoji: string;
}
