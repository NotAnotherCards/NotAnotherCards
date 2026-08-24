import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  // HTTP METRICS
  public readonly httpRequestsTotal: Counter<string>;
  public readonly httpRequestDurationSeconds: Histogram<string>;

  // AI Queue Metrics
  public readonly aiJobsPending: Gauge<string>;
  public readonly aiJobsProcessing: Gauge<string>;
  public readonly aiJobsCompletedTotal: Counter<string>;
  public readonly aiJobsFailedTotal: Counter<string>;
  public readonly aiTokensConsumedTotal: Counter<string>;

  constructor() {
    this.registry = new Registry();

    // 1. HTTP Request Metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests handled by the API',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request latency in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // 2. AI Queue Metrics
    this.aiJobsPending = new Gauge({
      name: 'ai_jobs_pending',
      help: 'Current number of AI generation jobs in pending state',
      registers: [this.registry],
    });

    this.aiJobsProcessing = new Gauge({
      name: 'ai_jobs_processing',
      help: 'Current number of AI generation jobs currently being processed',
      registers: [this.registry],
    });

    this.aiJobsCompletedTotal = new Counter({
      name: 'ai_jobs_completed_total',
      help: 'Total number of successfully completed AI generation jobs',
      registers: [this.registry],
    });

    this.aiJobsFailedTotal = new Counter({
      name: 'ai_jobs_failed_total',
      help: 'Total number of failed AI generation jobs',
      registers: [this.registry],
    });

    this.aiTokensConsumedTotal = new Counter({
      name: 'ai_tokens_consumed_total',
      help: 'Total LLM tokens consumed across generation requests',
      labelNames: ['model'],
      registers: [this.registry],
    });
  }

  private aiQueueDepthProvider?: () => Promise<{
    pending: number;
    processing: number;
  }>;

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }

  registerAiQueueDepthProvider(
    provider: () => Promise<{ pending: number; processing: number }>,
  ) {
    this.aiQueueDepthProvider = provider;
  }

  observeHttpRequest(
    method: string,
    route: string,
    status_code: number,
    durationSeconds: number,
  ) {
    const labels = {
      method: method.toUpperCase(),
      route: route || 'unknown',
      status_code: String(status_code),
    };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationSeconds);
  }

  async getMetrics(): Promise<string> {
    if (this.aiQueueDepthProvider) {
      try {
        const { pending, processing } = await this.aiQueueDepthProvider();
        this.aiJobsPending.set(pending);
        this.aiJobsProcessing.set(processing);
      } catch {}
    }
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
