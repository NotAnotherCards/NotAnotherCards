import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // skipping tracking the /metrics endpoint itself to avoid self scraping noise
    if (req.path === '/metrics') {
      return next.handle();
    }
    const startTime = process.hrtime();

    return next.handle().pipe(
      tap({
        next: () => this.recordMetric(req, res, startTime),
        error: () => this.recordMetric(req, res, startTime),
      }),
    );
  }

  private recordMetric(
    req: Request,
    res: Response,
    startTime: [number, number],
  ) {
    const diff = process.hrtime(startTime);
    const durationSeconds = diff[0] + diff[1] / 1e9;

    const route =
      (typeof req.route === 'object' &&
      req.route !== null &&
      'path' in req.route &&
      typeof (req.route as { path: unknown }).path === 'string'
        ? (req.route as { path: string }).path
        : req.baseUrl || req.path) || 'unknown';
    const statusCode = res.statusCode || 500;

    this.metricsService.observeHttpRequest(
      req.method,
      String(route),
      statusCode,
      durationSeconds,
    );
  }
}
