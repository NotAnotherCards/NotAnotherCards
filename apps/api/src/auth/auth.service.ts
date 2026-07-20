import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import * as schema from '../database/schema';

@Injectable()
export class AuthService {
  public readonly auth: any;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly configService: ConfigService,
  ) {
    this.auth = betterAuth({
      database: drizzleAdapter(this.db, {
        provider: 'pg',
      }),
      emailAndPassword: {
        enabled: true,
      },
      user: {
        additionalFields: {
          firstName: {
            type: 'string',
            required: true,
            input: true,
          },
          lastName: {
            type: 'string',
            required: true,
            input: true,
          },
        },
      },
      secret: this.configService.getOrThrow<string>('BETTER_AUTH_SECRET'),
      baseURL: this.configService.getOrThrow<string>('BETTER_AUTH_URL'),
    });
  }
}
