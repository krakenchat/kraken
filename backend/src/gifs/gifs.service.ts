import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GifResultDto, GifSearchResponseDto } from './dto/gif-response.dto';

const TENOR_BASE_URL = 'https://tenor.googleapis.com/v2';
const TENOR_CLIENT_KEY = 'semaphore-chat';
const MEDIA_FILTER = 'gif,tinygif';
const FETCH_TIMEOUT_MS = 5000;

interface TenorMediaFormat {
  url: string;
  dims?: [number, number];
}

interface TenorResult {
  id: string;
  title?: string;
  content_description?: string;
  media_formats?: {
    gif?: TenorMediaFormat;
    tinygif?: TenorMediaFormat;
  };
}

interface TenorApiResponse {
  results?: TenorResult[];
  next?: string;
}

/**
 * Proxies Tenor's v2 search/featured endpoints so the API key stays
 * server-side (Tenor doesn't support browser CORS for these endpoints).
 */
@Injectable()
export class GifsService {
  private readonly logger = new Logger(GifsService.name);

  constructor(private readonly configService: ConfigService) {}

  async search(
    q: string,
    limit: number,
    pos?: string,
  ): Promise<GifSearchResponseDto> {
    return this.fetchTenor('search', { q, limit, pos });
  }

  async featured(limit: number, pos?: string): Promise<GifSearchResponseDto> {
    return this.fetchTenor('featured', { limit, pos });
  }

  private async fetchTenor(
    endpoint: 'search' | 'featured',
    params: { q?: string; limit: number; pos?: string },
  ): Promise<GifSearchResponseDto> {
    const apiKey = this.configService.get<string>('TENOR_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GIF search is not configured on this instance. Set TENOR_API_KEY in .env',
      );
    }

    const url = new URL(`${TENOR_BASE_URL}/${endpoint}`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('client_key', TENOR_CLIENT_KEY);
    url.searchParams.set('media_filter', MEDIA_FILTER);
    url.searchParams.set('limit', String(params.limit));
    if (params.q) url.searchParams.set('q', params.q);
    if (params.pos) url.searchParams.set('pos', params.pos);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(
        `Tenor ${endpoint} request failed: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Failed to reach the Tenor GIF service',
      );
    }

    if (!response.ok) {
      this.logger.warn(`Tenor ${endpoint} returned HTTP ${response.status}`);
      throw new ServiceUnavailableException(
        'Failed to reach the Tenor GIF service',
      );
    }

    const data = (await response.json()) as TenorApiResponse;

    const results = (data.results ?? [])
      .map((result) => this.mapResult(result))
      .filter((result): result is GifResultDto => result !== null);

    return { results, next: data.next };
  }

  /**
   * Maps a raw Tenor result to our slim DTO. Returns null (and is filtered
   * out) when the `gif` media format is missing, since we have no URL to
   * render. Falls back to the full-size gif URL for `previewUrl` when
   * `tinygif` specifically is missing.
   */
  private mapResult(result: TenorResult): GifResultDto | null {
    const gif = result.media_formats?.gif;
    if (!gif?.url) return null;

    const tinygif = result.media_formats?.tinygif;

    return {
      id: result.id,
      title: result.content_description || result.title || '',
      url: gif.url,
      previewUrl: tinygif?.url || gif.url,
      width: gif.dims?.[0] ?? 0,
      height: gif.dims?.[1] ?? 0,
    };
  }
}
