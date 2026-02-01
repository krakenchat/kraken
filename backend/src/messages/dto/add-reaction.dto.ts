import { IsString, IsNotEmpty } from 'class-validator';
import { IsObjectId } from 'nestjs-object-id';

export class AddReactionDto {
  @IsNotEmpty()
  @IsString()
  @IsObjectId()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  emoji: string;
}
