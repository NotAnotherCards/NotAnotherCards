import type { NextFunction, Request, Response } from 'express';
import { MetricsService } from '../metrics/metrics.service';
import { MetricsController } from '../metrics/metrics.controller';
import { HttpMetricsMiddleware } from '../metrics/http-metrics.middleware';

/**
 * Minimal express response double that lets a test fire the `finish` event,
 * which is when the middleware records its metrics.
 */
function createResponseDouble(statusCode: number) {
  const listeners: Array<() => void> = [];
  return {
    statusCode,
    once: jest.fn((event: string, cb: () => void) => {
      if (event === 'finish') listeners.push(cb);
    }),
    finish: () => listeners.forEach((cb) => cb()),
  };
}

describe('MetricsService & MetricsController', () => {
  let service: MetricsService;
  let controller: MetricsController;

  beforeEach(() => {
    service = new MetricsService();
    service.onModuleInit();
    controller = new MetricsController(service);
  });

  it('collects default metrics and custom HTTP metrics', async () => {
    service.observeHttpRequest('GET', '/api/test', 200, 0.045);

    const text = await service.getMetrics();
    expect(text).toContain('http_requests_total');
    expect(text).toContain('http_request_duration_seconds');
    expect(text).toContain('method="GET"');
    expect(text).toContain('status_code="200"');
    expect(text).toContain('process_cpu_user_seconds_total');
  });

  it('records AI queue and token consumption metrics', async () => {
    service.aiJobsPending.set(3);
    service.aiJobsProcessing.set(1);
    service.aiJobsCompletedTotal.inc();
    service.aiJobsFailedTotal.inc();
    service.aiTokensConsumedTotal.inc({ model: 'qwen' }, 120);

    const text = await service.getMetrics();
    expect(text).toContain('ai_jobs_pending 3');
    expect(text).toContain('ai_jobs_processing 1');
    expect(text).toContain('ai_jobs_completed_total 1');
    expect(text).toContain('ai_jobs_failed_total 1');
    expect(text).toContain('ai_tokens_consumed_total{model="qwen"} 120');
  });

  it('refreshes queue gauges from the registered provider at scrape time', async () => {
    service.registerAiQueueDepthProvider(() =>
      Promise.resolve({ pending: 7, processing: 2 }),
    );

    const text = await service.getMetrics();
    expect(text).toContain('ai_jobs_pending 7');
    expect(text).toContain('ai_jobs_processing 2');
  });

  it('keeps the scrape alive when the queue depth provider fails', async () => {
    service.aiJobsPending.set(4);
    service.registerAiQueueDepthProvider(() =>
      Promise.reject(new Error('database down')),
    );

    // Scrape must not throw, and the last known gauge value survives.
    const text = await service.getMetrics();
    expect(text).toContain('ai_jobs_pending 4');
  });

  it('MetricsController responds with metrics text and content type header', async () => {
    const mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    await controller.getMetrics(mockRes as unknown as Response);

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      expect.stringContaining('text/plain'),
    );
    expect(mockRes.send).toHaveBeenCalledWith(
      expect.stringContaining('http_requests_total'),
    );
  });
});

describe('HttpMetricsMiddleware', () => {
  let service: MetricsService;
  let middleware: HttpMetricsMiddleware;
  let next: NextFunction;

  beforeEach(() => {
    service = new MetricsService();
    middleware = new HttpMetricsMiddleware(service);
    next = jest.fn();
  });

  it('records the real final status code for failed requests', async () => {
    // Regression guard: an interceptor reads res.statusCode before the
    // exception filter runs and reports 401s as 200. Recording on `finish`
    // is what keeps error-rate alerting honest.
    const req = {
      method: 'GET',
      path: '/api/ai/quota',
      originalUrl: '/api/ai/quota',
      baseUrl: '',
      route: { path: '/api/ai/quota' },
    } as unknown as Request;
    const res = createResponseDouble(401);

    middleware.use(req, res as unknown as Response, next);
    res.finish();

    const text = await service.getMetrics();
    expect(text).toContain(
      'http_requests_total{method="GET",route="/api/ai/quota",status_code="401"} 1',
    );
    expect(text).not.toContain('status_code="200"');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses the route pattern so ids do not explode label cardinality', async () => {
    const req = {
      method: 'GET',
      path: '/api/ai/jobs/8f3c1b2a-dead-beef-0000-111122223333',
      originalUrl: '/api/ai/jobs/8f3c1b2a-dead-beef-0000-111122223333',
      baseUrl: '',
      route: { path: '/api/ai/jobs/:id' },
    } as unknown as Request;
    const res = createResponseDouble(200);

    middleware.use(req, res as unknown as Response, next);
    res.finish();

    const text = await service.getMetrics();
    expect(text).toContain('route="/api/ai/jobs/:id"');
    expect(text).not.toContain('8f3c1b2a-dead-beef-0000-111122223333');
  });

  it('collapses unmatched routes into a single bucket', async () => {
    const req = {
      method: 'GET',
      path: '/wp-admin/setup-config.php',
      originalUrl: '/wp-admin/setup-config.php',
      baseUrl: '',
      route: undefined,
    } as unknown as Request;
    const res = createResponseDouble(404);

    middleware.use(req, res as unknown as Response, next);
    res.finish();

    const text = await service.getMetrics();
    expect(text).toContain('route="unmatched"');
    expect(text).not.toContain('wp-admin');
  });

  it('does not measure the /metrics scrape endpoint itself', () => {
    // req.path inside mounted middleware is relative to the mount point,
    // so the skip must be based on originalUrl (here deliberately different)
    const req = {
      method: 'GET',
      path: '/',
      originalUrl: '/metrics?param=1',
      baseUrl: '',
      route: { path: '/metrics' },
    } as unknown as Request;
    const res = createResponseDouble(200);

    middleware.use(req, res as unknown as Response, next);

    expect(res.once).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
