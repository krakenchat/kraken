export class VapidPublicKeyResponseDto {
  publicKey: string | null;
  enabled: boolean;
}

export class PushStatusResponseDto {
  enabled: boolean;
  subscriptionCount: number;
}

export class TestPushResponseDto {
  success: boolean;
  sent: number;
  failed: number;
  message: string;
}
