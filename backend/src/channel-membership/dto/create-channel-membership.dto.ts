import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { IsObjectId } from 'nestjs-object-id';

export class CreateChannelMembershipDto {
  @IsNotEmpty()
  @IsString()
  @IsObjectId()
  userId: string;

  @IsNotEmpty()
  @IsString()
  @IsObjectId()
  channelId: string;

  @IsOptional()
  @IsString()
  @IsObjectId()
  addedBy?: string;
}
