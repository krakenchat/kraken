import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Histogram } from 'prom-client';
import { lastValueFrom, Observable, of, throwError } from 'rxjs';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';

describe('HttpMetricsInterceptor', () => {
  let interceptor: HttpMetricsInterceptor;
  let histogram: { observe: jest.Mock };

  interface HttpContextOptions {
    method?: string;
    // null = request matched no Express route (request.route undefined)
    route?: { path: string } | null;
    // Express mount path; '' for Nest's flattened routes (the normal case)
    baseUrl?: string;
    statusCode?: number;
  }

  const createHttpContext = ({
    method = 'GET',
    route = { path: '/api/users/:id' },
    baseUrl = '',
    statusCode = 200,
  }: HttpContextOptions = {}): ExecutionContext =>
    ({
      getType: jest.fn(() => 'http'),
      switchToHttp: jest.fn(() => ({
        getRequest: () => ({
          method,
          route: route ?? undefined,
          baseUrl,
          url: '/api/users/123',
          originalUrl: '/api/users/123',
        }),
        getResponse: () => ({ statusCode }),
      })),
    }) as unknown as ExecutionContext;

  const createNext = (result$: Observable<unknown>): CallHandler => ({
    handle: jest.fn(() => result$),
  });

  beforeEach(() => {
    histogram = { observe: jest.fn() };
    interceptor = new HttpMetricsInterceptor(
      histogram as unknown as Histogram<string>,
    );
  });

  describe('successful responses', () => {
    it('observes the histogram with method, route template, and status', async () => {
      const context = createHttpContext({ method: 'POST', statusCode: 201 });

      const result = await lastValueFrom(
        interceptor.intercept(context, createNext(of('ok'))),
      );

      expect(result).toBe('ok');
      expect(histogram.observe).toHaveBeenCalledTimes(1);
      const [labels, seconds] = histogram.observe.mock.calls[0] as [
        Record<string, string>,
        number,
      ];
      expect(labels).toEqual({
        method: 'POST',
        route: '/api/users/:id',
        status: '201',
      });
      expect(seconds).toBeGreaterThanOrEqual(0);
    });

    it('uses the route template, never the raw URL', async () => {
      const context = createHttpContext();

      await lastValueFrom(interceptor.intercept(context, createNext(of(1))));

      const [labels] = histogram.observe.mock.calls[0] as [
        Record<string, string>,
      ];
      expect(labels.route).toBe('/api/users/:id');
      expect(labels.route).not.toContain('123');
    });

    it('prepends req.baseUrl when the route is served from a mounted router', async () => {
      const context = createHttpContext({
        baseUrl: '/mounted',
        route: { path: '/users/:id' },
      });

      await lastValueFrom(interceptor.intercept(context, createNext(of(1))));

      expect(histogram.observe).toHaveBeenCalledWith(
        expect.objectContaining({ route: '/mounted/users/:id' }),
        expect.any(Number),
      );
    });

    it('falls back to "unmatched" when no route template is present', async () => {
      const context = createHttpContext({ route: null });

      await lastValueFrom(interceptor.intercept(context, createNext(of(1))));

      expect(histogram.observe).toHaveBeenCalledWith(
        expect.objectContaining({ route: 'unmatched' }),
        expect.any(Number),
      );
    });
  });

  describe('error responses', () => {
    it('labels HttpException errors with their status and rethrows', async () => {
      const context = createHttpContext();
      const next = createNext(throwError(() => new NotFoundException('nope')));

      await expect(
        lastValueFrom(interceptor.intercept(context, next)),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(histogram.observe).toHaveBeenCalledTimes(1);
      expect(histogram.observe).toHaveBeenCalledWith(
        { method: 'GET', route: '/api/users/:id', status: '404' },
        expect.any(Number),
      );
    });

    it('labels 403s from guards-style exceptions correctly', async () => {
      const context = createHttpContext();
      const next = createNext(throwError(() => new ForbiddenException()));

      await expect(
        lastValueFrom(interceptor.intercept(context, next)),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(histogram.observe).toHaveBeenCalledWith(
        expect.objectContaining({ status: '403' }),
        expect.any(Number),
      );
    });

    it('labels non-HttpException errors as 500 and rethrows', async () => {
      const context = createHttpContext();
      const boom = new Error('boom');
      const next = createNext(throwError(() => boom));

      await expect(
        lastValueFrom(interceptor.intercept(context, next)),
      ).rejects.toBe(boom);

      expect(histogram.observe).toHaveBeenCalledWith(
        expect.objectContaining({ status: '500' }),
        expect.any(Number),
      );
    });
  });

  describe('non-HTTP contexts', () => {
    it('passes through without observing (e.g. ws)', async () => {
      const context = {
        getType: jest.fn(() => 'ws'),
      } as unknown as ExecutionContext;
      const next = createNext(of('event'));

      const result = await lastValueFrom(interceptor.intercept(context, next));

      expect(result).toBe('event');
      expect(next.handle).toHaveBeenCalledTimes(1);
      expect(histogram.observe).not.toHaveBeenCalled();
    });
  });
});
