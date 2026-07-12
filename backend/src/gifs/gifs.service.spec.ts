import { TestBed } from '@suites/unit';
import type { Mocked } from '@suites/doubles.jest';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { GifsService } from './gifs.service';

describe('GifsService', () => {
  let service: GifsService;
  let configService: Mocked<ConfigService>;
  let fetchSpy: jest.SpyInstance;

  beforeEach(async () => {
    const { unit, unitRef } = await TestBed.solitary(GifsService).compile();

    service = unit;
    configService = unitRef.get(ConfigService);
    configService.get.mockReturnValue('test-api-key');

    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function mockFetchResponse(body: unknown, ok = true, status = 200) {
    fetchSpy.mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
    } as Response);
  }

  describe('key-absent path', () => {
    it('throws ServiceUnavailableException from search when TENOR_API_KEY is not configured', async () => {
      configService.get.mockReturnValue(undefined);

      await expect(service.search('cats', 20)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException from featured when TENOR_API_KEY is not configured', async () => {
      configService.get.mockReturnValue(undefined);

      await expect(service.featured(20)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('maps Tenor results to the slim DTO shape', async () => {
      mockFetchResponse({
        results: [
          {
            id: 'gif-1',
            title: '',
            content_description: 'Cat jumping',
            media_formats: {
              gif: {
                url: 'https://media.tenor.com/1/cat.gif',
                dims: [220, 140],
              },
              tinygif: {
                url: 'https://media.tenor.com/1/cat-tiny.gif',
                dims: [110, 70],
              },
            },
          },
        ],
        next: 'cursor-abc',
      });

      const result = await service.search('cat', 20);

      expect(result).toEqual({
        results: [
          {
            id: 'gif-1',
            title: 'Cat jumping',
            url: 'https://media.tenor.com/1/cat.gif',
            previewUrl: 'https://media.tenor.com/1/cat-tiny.gif',
            width: 220,
            height: 140,
          },
        ],
        next: 'cursor-abc',
      });
    });

    it('passes q, limit, pos, key, client_key and media_filter as query params', async () => {
      mockFetchResponse({ results: [] });

      await service.search('dogs', 15, 'cursor-1');

      const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(calledUrl.origin + calledUrl.pathname).toBe(
        'https://tenor.googleapis.com/v2/search',
      );
      expect(calledUrl.searchParams.get('q')).toBe('dogs');
      expect(calledUrl.searchParams.get('limit')).toBe('15');
      expect(calledUrl.searchParams.get('pos')).toBe('cursor-1');
      expect(calledUrl.searchParams.get('key')).toBe('test-api-key');
      expect(calledUrl.searchParams.get('client_key')).toBe('semaphore-chat');
      expect(calledUrl.searchParams.get('media_filter')).toBe('gif,tinygif');
    });

    it('falls back to title when content_description is absent', async () => {
      mockFetchResponse({
        results: [
          {
            id: 'gif-2',
            title: 'Fallback title',
            media_formats: {
              gif: { url: 'https://media.tenor.com/2/dog.gif' },
            },
          },
        ],
      });

      const result = await service.search('dog', 20);

      expect(result.results[0].title).toBe('Fallback title');
    });

    it('omits results missing the gif media format', async () => {
      mockFetchResponse({
        results: [
          {
            id: 'gif-3',
            media_formats: {
              tinygif: { url: 'https://media.tenor.com/3/tiny-only.gif' },
            },
          },
          {
            id: 'gif-4',
            media_formats: {
              gif: {
                url: 'https://media.tenor.com/4/full.gif',
                dims: [100, 100],
              },
            },
          },
        ],
      });

      const result = await service.search('missing', 20);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe('gif-4');
    });

    it('falls back to the full gif url as previewUrl when tinygif is missing', async () => {
      mockFetchResponse({
        results: [
          {
            id: 'gif-5',
            media_formats: {
              gif: {
                url: 'https://media.tenor.com/5/full.gif',
                dims: [50, 60],
              },
            },
          },
        ],
      });

      const result = await service.search('no-tiny', 20);

      expect(result.results[0].previewUrl).toBe(
        'https://media.tenor.com/5/full.gif',
      );
    });

    it('defaults width/height to 0 when dims are missing', async () => {
      mockFetchResponse({
        results: [
          {
            id: 'gif-6',
            media_formats: {
              gif: { url: 'https://media.tenor.com/6/full.gif' },
            },
          },
        ],
      });

      const result = await service.search('no-dims', 20);

      expect(result.results[0].width).toBe(0);
      expect(result.results[0].height).toBe(0);
    });

    it('returns an empty results array and no cursor when Tenor returns no results field', async () => {
      mockFetchResponse({});

      const result = await service.search('nothing', 20);

      expect(result).toEqual({ results: [], next: undefined });
    });

    it('throws ServiceUnavailableException when Tenor responds with a non-OK status', async () => {
      mockFetchResponse({}, false, 502);

      await expect(service.search('cat', 20)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException when the fetch itself rejects (network/timeout)', async () => {
      fetchSpy.mockRejectedValue(new Error('timed out'));

      await expect(service.search('cat', 20)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('featured', () => {
    it('passes the cursor through and hits the featured endpoint without q', async () => {
      mockFetchResponse({ results: [], next: 'cursor-2' });

      const result = await service.featured(10, 'cursor-1');

      const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(calledUrl.origin + calledUrl.pathname).toBe(
        'https://tenor.googleapis.com/v2/featured',
      );
      expect(calledUrl.searchParams.has('q')).toBe(false);
      expect(calledUrl.searchParams.get('pos')).toBe('cursor-1');
      expect(result.next).toBe('cursor-2');
    });
  });
});
