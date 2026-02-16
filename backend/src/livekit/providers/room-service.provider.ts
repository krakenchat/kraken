import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoomServiceClient } from 'livekit-server-sdk';

export const ROOM_SERVICE_CLIENT = 'ROOM_SERVICE_CLIENT';

export const RoomServiceProvider: Provider = {
  provide: ROOM_SERVICE_CLIENT,
  useFactory: (configService: ConfigService): RoomServiceClient | null => {
    const livekitUrl = configService.get<string>('LIVEKIT_URL');
    const apiKey = configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = configService.get<string>('LIVEKIT_API_SECRET');

    if (livekitUrl && apiKey && apiSecret) {
      return new RoomServiceClient(livekitUrl, apiKey, apiSecret);
    }
    return null;
  },
  inject: [ConfigService],
};
