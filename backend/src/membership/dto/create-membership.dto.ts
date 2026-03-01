import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateMembershipDto {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  userId: string;

  @IsNotEmpty()
  @IsString()
  @IsUUID()
  communityId: string;
}
