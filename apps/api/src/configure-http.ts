import type { NestExpressApplication } from '@nestjs/platform-express';

// Shared by bootstrap and HTTP integration tests so their body limits agree.
export function configureHttp(app: NestExpressApplication): void {
  // Express is a transitive dependency; configure parsers through Nest.
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' });
}
