import { IsString, IsOptional } from 'class-validator';

export class PinMessageDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class UnpinMessageDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
