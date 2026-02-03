import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEmail,
  MinLength,
  MaxLength,
} from 'class-validator';

export class SetupInstanceDto {
  // Admin user creation
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  adminUsername: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  adminPassword: string;

  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  // Instance configuration
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  instanceName: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  instanceDescription?: string;

  // Default community setup
  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultCommunityName?: string;

  @IsOptional()
  @IsBoolean()
  createDefaultCommunity?: boolean;

  // Setup token for validation
  @IsNotEmpty()
  @IsString()
  setupToken: string;
}

export class OnboardingStatusDto {
  needsSetup: boolean;
  hasUsers: boolean;
  setupToken?: string;
}
