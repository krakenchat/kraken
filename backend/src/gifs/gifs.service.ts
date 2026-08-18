import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GifSearchResponseDto } from './dto/gif-response.dto';
import { GIF_PROVIDER, GifProvider } from './providers/gif-provider.interface';

/**
 * Thin delegation layer over the configured GifProvider (see
 * providers/gif-provider.interface.ts, registered in gifs.module.ts).
 * Deliberately provider-agnostic: it doesn't gate on any provider's API key
 * itself — the provider owns that check and throws
 * ServiceUnavailableException when unconfigured, which propagates through
 * search()/featured() untouched.
 */
@Injectable()
export class GifsService {
  private readonly logger = new Logger(GifsService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(GIF_PROVIDER) private readonly gifProvider: GifProvider,
  ) {
    if (this.configService.get<string>('TENOR_API_KEY')) {
      this.logger.warn(
        'TENOR_API_KEY is no longer used; GIF search now uses Giphy — set GIPHY_API_KEY',
      );
    }
  }

  async search(
    q: string,
    limit: number,
    pos?: string,
  ): Promise<GifSearchResponseDto> {
    return this.gifProvider.search(q, limit, pos);
  }

  async featured(limit: number, pos?: string): Promise<GifSearchResponseDto> {
    return this.gifProvider.featured(limit, pos);
  }
}
