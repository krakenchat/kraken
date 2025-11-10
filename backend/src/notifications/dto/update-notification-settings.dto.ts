import {
  IsBoolean,
  IsOptional,
  IsString,
  IsIn,
  Matches,
} from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  desktopEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  playSound?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['default', 'mention', 'dm'])
  soundType?: string;

  @IsOptional()
  @IsBoolean()
  doNotDisturb?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'dndStartTime must be in HH:mm format (24-hour)',
  })
  dndStartTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'dndEndTime must be in HH:mm format (24-hour)',
  })
  dndEndTime?: string;

  @IsOptional()
  @IsString()
  @IsIn(['all', 'mentions', 'none'])
  defaultChannelLevel?: string;

  @IsOptional()
  @IsBoolean()
  dmNotifications?: boolean;
}
