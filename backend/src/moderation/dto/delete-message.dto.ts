import { IsString, IsOptional } from 'class-validator';

export class DeleteMessageAsModDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
