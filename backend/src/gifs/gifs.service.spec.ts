import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { TestBed } from '@suites/unit';
import { ConfigService } from '@nestjs/config';
import { GifsService } from './gifs.service';
import { GIF_PROVIDER } from './providers/gif-provider.interface';

describe('GifsService', () => {
  let service: GifsService;
  let mockProvider: Record<'search' | 'featured', jest.Mock>;

  beforeEach(async () => {
    mockProvider = {
      search: jest.fn(),
      featured: jest.fn(),
    };

    const { unit } = await TestBed.solitary(GifsService)
      .mock(GIF_PROVIDER)
      .final(mockProvider)
      .compile();

    service = unit;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('delegation', () => {
    it('forwards search args to the provider and returns its resolved value', async () => {
      const response = { results: [], next: undefined };
      mockProvider.search.mockResolvedValue(response);

      const result = await service.search('cats', 20, 'cursor-1');

      expect(mockProvider.search).toHaveBeenCalledWith('cats', 20, 'cursor-1');
      expect(result).toBe(response);
    });

    it('forwards featured args to the provider and returns its resolved value', async () => {
      const response = { results: [], next: 'cursor-2' };
      mockProvider.featured.mockResolvedValue(response);

      const result = await service.featured(15, 'cursor-1');

      expect(mockProvider.featured).toHaveBeenCalledWith(15, 'cursor-1');
      expect(result).toBe(response);
    });
  });

  describe('key-absent path (delegated to the provider)', () => {
    it('propagates ServiceUnavailableException from search when the provider rejects', async () => {
      mockProvider.search.mockRejectedValue(
        new ServiceUnavailableException(
          'GIF search is not configured on this instance. Set GIPHY_API_KEY in .env',
        ),
      );

      await expect(service.search('cats', 20)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('propagates ServiceUnavailableException from featured when the provider rejects', async () => {
      mockProvider.featured.mockRejectedValue(
        new ServiceUnavailableException('GIF search is not configured'),
      );

      await expect(service.featured(20)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('TENOR_API_KEY deprecation warning', () => {
    it('logs a deprecation warning at construction when TENOR_API_KEY is set', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await TestBed.solitary(GifsService)
        .mock(GIF_PROVIDER)
        .final(mockProvider)
        .mock(ConfigService)
        .final({ get: jest.fn().mockReturnValue('legacy-tenor-key') })
        .compile();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('TENOR_API_KEY'),
      );

      warnSpy.mockRestore();
    });

    it('does not log a deprecation warning when TENOR_API_KEY is unset', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

      await TestBed.solitary(GifsService)
        .mock(GIF_PROVIDER)
        .final(mockProvider)
        .mock(ConfigService)
        .final({ get: jest.fn().mockReturnValue(undefined) })
        .compile();

      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });
});
