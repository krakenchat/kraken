import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateChannelMembershipDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  channelId: string;

  @IsOptional()
  @IsString()
  addedBy?: string;
}
