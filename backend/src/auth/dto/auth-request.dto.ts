import { ApiPropertyOptional } from '@nestjs/swagger';

export class LoginRequestDto {
  username: string;
  password: string;
}

export class RefreshRequestDto {
  @ApiPropertyOptional()
  refreshToken?: string;
}
