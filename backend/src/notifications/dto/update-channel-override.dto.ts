import { IsNotEmpty, IsString, IsIn } from 'class-validator';

export class UpdateChannelOverrideDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['all', 'mentions', 'none'])
  level: string;
}
