import { IsString, IsNotEmpty } from 'class-validator';

export class AddReactionDto {
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  emoji: string;
}
