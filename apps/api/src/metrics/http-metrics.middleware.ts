import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
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
