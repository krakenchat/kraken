import { IsNotEmpty, IsString } from 'class-validator';
import { IsObjectId } from 'nestjs-object-id';

export class MoveChannelDto {
  @IsNotEmpty()
  @IsString()
  @IsObjectId()
  communityId: string;
}
