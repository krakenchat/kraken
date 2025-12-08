import { IsOptional, IsIn } from 'class-validator';

export class UpdateAppearanceSettingsDto {
  @IsOptional()
  @IsIn(['dark', 'light'])
  themeMode?: string;

  @IsOptional()
  @IsIn(['teal', 'blue', 'indigo', 'purple', 'rose', 'red', 'orange', 'amber', 'lime', 'emerald', 'cyan', 'slate'])
  accentColor?: string;

  @IsOptional()
  @IsIn(['minimal', 'subtle', 'vibrant'])
  intensity?: string;
}
