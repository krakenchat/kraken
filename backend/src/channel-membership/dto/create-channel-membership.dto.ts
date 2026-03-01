import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateChannelMembershipDto {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  userId: string;

  @IsNotEmpty()
  @IsString()
  @IsUUID()
  channelId: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  addedBy?: string;
}
