import { IsString, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export class BanUserDto {
  @IsString()
  @IsOptional()
  reason?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string; // null = permanent ban
}

export class UnbanUserDto {
  @IsString()
  @IsOptional()
  reason?: string; // Reason for unbanning (for audit log)
}
