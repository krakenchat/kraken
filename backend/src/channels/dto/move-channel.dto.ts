import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class MoveChannelDto {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  communityId: string;
}
