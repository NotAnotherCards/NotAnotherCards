import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

/**
 * Records HTTP request count and latency for every request.
 *
 * Implemented as middleware rather than an interceptor on purpose:
 *
 * - Middleware runs before guards, so requests rejected by a guard
 *   (401/403) are still counted. An interceptor never runs for those.
 * - Recording on the response `finish` event is the only place where the
 *   final status code is guaranteed to be set. Inside an interceptor the
 *   exception filter has not run yet, so a request that ends as 401 is
 *   still reported as 200.
 * - `finish` also covers requests that never reach a controller at all,
 *   such as unmatched routes.
 */
@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Skip the scrape endpoint itself so Prometheus does not measure itself.
    // req.originalUrl is used because req.path inside mounted middleware is
    // relative to the mount point, not the full request path.
    const path = (req.originalUrl ?? req.path).split('?')[0];
    if (path === '/metrics') {
      next();
      return;
    }

    const startTime = process.hrtime.bigint();

    res.once('finish', () => {
      const durationSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;

      this.metricsService.observeHttpRequest(
        req.method,
        resolveRouteLabel(req),
        res.statusCode,
        durationSeconds,
      );
    });

    next();
  }
}

/**
 * Returns the matched route pattern (for example `/api/ai/jobs/:id`) so that
 * one label value covers every id. Unmatched requests collapse into a single
 * `unmatched` bucket, otherwise a path scanner would create unbounded label
 * cardinality and blow up the time series database.
 */
function resolveRouteLabel(req: Request): string {
  const route: unknown = req.route;

  if (
    typeof route === 'object' &&
    route !== null &&
    'path' in route &&
    typeof route.path === 'string'
  ) {
    const path = (route as { path: string }).path;
    return `${req.baseUrl ?? ''}${path}` || path;
  }

  return 'unmatched';
}
