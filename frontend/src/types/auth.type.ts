export interface Login {
  username: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  avatarUrl: string | null;
  bannerUrl?: string | null;
  lastSeen: Date | null;
  displayName: string | null;
  role: string;
}

export interface Register {
  username: string;
  password: string;
  email: string;
  code: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string; // Optional, only returned for Electron clients
}
