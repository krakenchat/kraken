import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PrometheusController } from '@willsoto/nestjs-prometheus';
import type { Response } from 'express';
import { Public } from '@/auth/public.decorator';

/**
 * Prometheus scrape endpoint (served at /api/metrics under the global prefix).
 *
 * The app registers JwtAuthGuard as a global APP_GUARD, so this controller
 * must be @Public() for Prometheus to scrape without credentials. Exposure is
 * gated at the module level instead: MetricsModule is only imported when
 * METRICS_ENABLED === 'true' (see app.module.ts).
 *
 * The route path ('/metrics') is applied by PrometheusModule.register() via
 * its `path` option, so no path is passed to @Controller() here.
 */
@Public()
@ApiExcludeController()
@Controller()
export class MetricsController extends PrometheusController {
  @Get()
  async index(@Res({ passthrough: true }) response: Response): Promise<string> {
    return super.index(response);
  }
}
