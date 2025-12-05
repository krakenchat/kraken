import { IsString, IsOptional } from 'class-validator';

export class KickUserDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
