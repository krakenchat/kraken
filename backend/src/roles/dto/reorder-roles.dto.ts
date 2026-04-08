import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderRolesDto {
  @ApiProperty({
    description:
      'Ordered array of role IDs. First role gets highest priority (lowest position).',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  roleIds: string[];
}
