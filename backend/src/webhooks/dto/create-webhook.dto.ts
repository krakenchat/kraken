import { IsOptional, IsString, Length } from 'class-validator';

export class CreateWebhookDto {
  @IsString()
  @Length(1, 80, { message: 'Name must be between 1 and 80 characters' })
  name: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
