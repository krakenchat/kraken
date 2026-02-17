import { IsBoolean } from 'class-validator';

export class UpdateDeafenStateDto {
  @IsBoolean()
  isDeafened: boolean;
}
