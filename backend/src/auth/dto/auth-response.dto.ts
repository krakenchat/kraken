export class LoginResponseDto {
  accessToken: string;
  refreshToken?: string;
}

export class LogoutResponseDto {
  message: string;
}

export class SessionInfoDto {
  id: string;
  deviceName: string;
  ipAddress: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

export class RevokeSessionResponseDto {
  message: string;
}

export class RevokeAllSessionsResponseDto {
  message: string;
  revokedCount: number;
}
