import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EgressClient } from 'livekit-server-sdk';

export const EGRESS_CLIENT = 'EGRESS_CLIENT';

export const EgressClientProvider: Provider = {
  provide: EGRESS_CLIENT,
  useFactory: (configService: ConfigService): EgressClient | null => {
    const livekitUrl = configService.get<string>('LIVEKIT_URL');
    const apiKey = configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = configService.get<string>('LIVEKIT_API_SECRET');

    if (livekitUrl && apiKey && apiSecret) {
      return new EgressClient(livekitUrl, apiKey, apiSecret);
    }
    return null;
  },
  inject: [ConfigService],
};
