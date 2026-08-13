import { Module, type OnApplicationShutdown } from '@nestjs/common';
import { DATABASE_CONNECTION } from './database-connection';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { databaseSchema } from './database-schema';

const PG_POOL = 'database_pg_pool';

// Without ending the pool on shutdown, its connections linger until the
// server terminates them - noisy in tests, unclean in deploys.
class PoolLifecycle implements OnApplicationShutdown {
  constructor(private readonly pool: Pool) {}
  onApplicationShutdown() {
    return this.pool.end();
  }
}

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PG_POOL,
      useFactory: (configService: ConfigService) =>
        new Pool({
          connectionString: configService.getOrThrow('DATABASE_URL'),
        }),
      inject: [ConfigService],
    },
    {
      provide: DATABASE_CONNECTION,
      useFactory: (pool: Pool) => drizzle(pool, { schema: databaseSchema }),
      inject: [PG_POOL],
    },
    {
      provide: PoolLifecycle,
      useFactory: (pool: Pool) => new PoolLifecycle(pool),
      inject: [PG_POOL],
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
