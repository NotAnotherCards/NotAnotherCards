import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APIError, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import * as schema from '../database/schema';
import { expo } from '@better-auth/expo';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';

@Injectable()
export class AuthService {
  public readonly auth: {
    handler: (request: globalThis.Request) => Promise<globalThis.Response>;
  };
  private readonly resolveUserId: (
    headers: IncomingHttpHeaders,
  ) => Promise<string | null>;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly configService: ConfigService,
  ) {
    const auth = betterAuth({
      database: drizzleAdapter(this.db, {
        provider: 'pg',
      }),
      socialProviders: {
        google: {
          clientId: configService.getOrThrow<string>('GOOGLE_CLIENT_ID'),
          clientSecret: configService.getOrThrow<string>(
            'GOOGLE_CLIENT_SECRET')
          }
      },
      account: {
        accountLinking: {
          enabled: true,
          trustedProviders: ['google'],
        },
      },
      emailAndPassword: {
        enabled: true,
      },
      user: {
        additionalFields: {
          username: {
            type: 'string',
            required: true,
          },
          timezone: {
            type: 'string',
            required: false,
            defaultValue: 'UTC',
          },
        },
      },
      databaseHooks: {
        user: {
          create: {
            before: async (newUser) => {
              const username = newUser.username as string;
              const existingUser = await this.db.query.user.findFirst({
                columns: { id: true },
                where: eq(schema.user.username, username),
              });

              if (existingUser) {
                throw new APIError('UNPROCESSABLE_ENTITY', {
                  message: 'Username is already taken',
                });
              }

              return {
                data: {
                  ...newUser,
                  emailVerified: true,
                },
              };
            },
          },
        },
      },
      plugins: [expo()],
      trustedOrigins: [
        this.configService.getOrThrow<string>('FRONTEND_URL'),
        'notanothercards://',
        'exp://',
        'exp://**',
      ],
      secret: this.configService.getOrThrow<string>('BETTER_AUTH_SECRET'),
      baseURL: this.configService.getOrThrow<string>('BETTER_AUTH_URL'),
    });

    this.auth = auth;
    this.resolveUserId = async (headers) => {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(headers),
      });

      return session?.user.id ?? null;
    };
  }

  async userIdFromHeaders(
    headers: IncomingHttpHeaders,
  ): Promise<string | null> {
    return this.resolveUserId(headers);
  }
}
