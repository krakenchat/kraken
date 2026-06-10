import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  makeHistogramProvider,
  PrometheusModule,
} from '@willsoto/nestjs-prometheus';
import {
  HTTP_REQUEST_DURATION_SECONDS,
  HttpMetricsInterceptor,
} from './http-metrics.interceptor';
import { MetricsController } from './metrics.controller';

/**
 * Prometheus metrics: default Node.js/process metrics plus an HTTP request
 * duration histogram, exposed at /api/metrics (the '/metrics' path below is
 * served under the global 'api' prefix).
 *
 * This module is conditionally imported in AppModule — only when
 * METRICS_ENABLED === 'true' — so the endpoint simply does not exist
 * otherwise (same pattern as DebugModule/ADMIN_DEBUG_PANEL).
 */
@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics', // served under global prefix -> /api/metrics
      defaultMetrics: { enabled: true },
      // Custom controller so the endpoint can opt out of the global
      // JwtAuthGuard via @Public().
      controller: MetricsController,
    }),
  ],
  providers: [
    makeHistogramProvider({
      name: HTTP_REQUEST_DURATION_SECONDS,
      help: 'Duration of HTTP requests in seconds, labeled by method, route template, and status code.',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    }),
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
})
export class MetricsModule {}
