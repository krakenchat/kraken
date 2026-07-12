import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class ForgotPasswordRequestDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordRequestDto {
  @IsString()
  @MaxLength(128)
  token: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must be at most 128 characters' })
  newPassword: string;
}
