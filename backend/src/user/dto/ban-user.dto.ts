import { IsBoolean } from 'class-validator';

export class BanUserDto {
  @IsBoolean()
  banned: boolean;
}
