export class TokenResponseDto {
  token: string;
  url?: string;
  identity: string;
  roomId: string;
  expiresAt?: Date;
}
