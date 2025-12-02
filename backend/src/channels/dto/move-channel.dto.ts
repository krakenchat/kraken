import { IsString, IsNotEmpty } from 'class-validator';

export class MoveChannelDto {
  @IsString()
  @IsNotEmpty()
  communityId: string;
}
