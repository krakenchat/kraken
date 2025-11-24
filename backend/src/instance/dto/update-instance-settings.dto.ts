import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RegistrationMode } from '@prisma/client';

export class UpdateInstanceSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(RegistrationMode)
  registrationMode?: RegistrationMode;
}
