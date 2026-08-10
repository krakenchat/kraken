import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PushMarkReadDto {
  @ApiProperty({
    description:
      'Signed action token embedded in the push payload (data.markReadToken).',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
