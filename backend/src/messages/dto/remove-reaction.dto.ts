import { IsString, IsNotEmpty } from 'class-validator';
import { IsObjectId } from 'nestjs-object-id';

export class RemoveReactionDto {
  @IsNotEmpty()
  @IsString()
  @IsObjectId()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  emoji: string;
}
