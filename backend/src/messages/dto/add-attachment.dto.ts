import { IsString, IsOptional } from 'class-validator';

export class AddAttachmentDto {
  @IsOptional()
  @IsString()
  fileId?: string; // Optional - if not provided, just decrements pendingAttachments
}
