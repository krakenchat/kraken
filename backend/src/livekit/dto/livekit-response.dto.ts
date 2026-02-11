export class ConnectionInfoResponseDto {
  url?: string;
}

export class LivekitHealthResponseDto {
  status: string;
  configured: boolean;
}

export class StartReplayResponseDto {
  sessionId: string;
  egressId: string;
  status: string;
}

export class StopReplayResponseDto {
  sessionId: string;
  egressId: string;
  status: string;
}
