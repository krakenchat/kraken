import {
  IsString,
  IsOptional,
  IsUUID,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateSoundboardSoundDto {
  @IsString()
  @MinLength(1, { message: 'Sound name must not be empty' })
  @MaxLength(50, { message: 'Sound name must not exceed 50 characters' })
  @Matches(/^[a-zA-Z0-9 _-]+$/, {
    message:
      'Sound name can only contain letters, numbers, spaces, underscores, and hyphens',
  })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(16, { message: 'Emoji must not exceed 16 characters' })
  emoji?: string;

  @IsUUID('all')
  fileId: string;
}
