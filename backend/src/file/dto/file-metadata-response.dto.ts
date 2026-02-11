import { FileType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { FileTypeValues } from '@/common/enums/swagger-enums';

export class FileMetadataResponseDto {
  id: string;
  filename: string;
  mimeType: string;
  @ApiProperty({ enum: FileTypeValues })
  fileType: FileType;
  size: number;
}
