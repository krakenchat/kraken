import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class AddReactionDto {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  emoji: string;
}
