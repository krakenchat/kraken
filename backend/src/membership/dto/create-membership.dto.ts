import { IsNotEmpty, IsString } from 'class-validator';
import { IsObjectId } from 'nestjs-object-id';

export class CreateMembershipDto {
  @IsNotEmpty()
  @IsString()
  @IsObjectId()
  userId: string;

  @IsNotEmpty()
  @IsString()
  @IsObjectId()
  communityId: string;
}
