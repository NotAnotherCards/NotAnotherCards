import type { Response } from 'express';
import { MetricsService } from '../metrics/metrics.service';
import { MetricsController } from '../metrics/metrics.controller';

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
