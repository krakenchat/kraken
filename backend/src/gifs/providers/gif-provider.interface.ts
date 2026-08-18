import { GifSearchResponseDto } from '../dto/gif-response.dto';

/**
 * Swappable GIF backend contract. GifsService delegates entirely to the
 * provider registered under GIF_PROVIDER — see gifs.module.ts (currently
 * GiphyProvider, providers/giphy.provider.ts). Implementations own their own
 * API-key gating (throwing ServiceUnavailableException when unconfigured)
 * and are responsible for translating their own pagination scheme to/from
 * our opaque `pos` cursor string.
 */
export interface GifProvider {
  search(q: string, limit: number, pos?: string): Promise<GifSearchResponseDto>;
  featured(limit: number, pos?: string): Promise<GifSearchResponseDto>;
}

export const GIF_PROVIDER = Symbol('GIF_PROVIDER');
