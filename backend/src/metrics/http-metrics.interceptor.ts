import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Request, Response } from 'express';
import { Histogram } from 'prom-client';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export const HTTP_REQUEST_DURATION_SECONDS = 'http_request_duration_seconds';

/**
 * Records a latency histogram for every HTTP request, labeled by method,
 * route template, and response status code.
 *
 * Uses the Express route TEMPLATE (req.route.path, e.g. /api/users/:id),
 * never the raw URL, so label cardinality stays bounded regardless of how
 * many distinct ids/paths are requested.
 *
 * Registered as a global APP_INTERCEPTOR by MetricsModule, which is only
 * imported when METRICS_ENABLED === 'true'.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric(HTTP_REQUEST_DURATION_SECONDS)
    private readonly httpRequestDuration: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const start = process.hrtime.bigint();
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    // Route template, not raw URL — keeps label cardinality bounded. Nest
    // registers flattened templates (req.route.path is already
    // /api/users/:id), but prepend req.baseUrl so the label stays correct if
    // a route is ever served from a mounted router.
    const routePath = (request.route as { path?: string } | undefined)?.path;
    const route =
      routePath !== undefined
        ? `${request.baseUrl ?? ''}${routePath}`
        : 'unmatched';

    const observe = (status: number): void => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.httpRequestDuration.observe(
        { method, route, status: String(status) },
        seconds,
      );
    };

    return next.handle().pipe(
      tap({
        next: () =>
          observe(context.switchToHttp().getResponse<Response>().statusCode),
        error: (error: unknown) =>
          observe(error instanceof HttpException ? error.getStatus() : 500),
      }),
    );
  }
}
