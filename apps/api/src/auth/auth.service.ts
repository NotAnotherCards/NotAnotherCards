import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection';
import * as schema from '../database/schema';
import { expo } from '@better-auth/expo';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import { sendResetPasswordEmail } from '../email/reset-password-email';
import { userAdditionalFields } from './auth-fields';
import { twoFactor } from 'better-auth/plugins';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import { twoFactorOAuthChallengeHook } from './two-factor-oauth.hook';

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
    const googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const googleClientSecret = this.configService.get<string>(
      'GOOGLE_CLIENT_SECRET',
    );
    const facebookClientId =
      this.configService.get<string>('FACEBOOK_CLIENT_ID');
    const facebookClientSecret = this.configService.get<string>(
      'FACEBOOK_CLIENT_SECRET',
    );

    const socialProviders: Record<
      string,
      { clientId: string; clientSecret: string }
    > = {};
    if (googleClientId && googleClientSecret) {
      socialProviders.google = {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      };
    }
    if (facebookClientId && facebookClientSecret) {
      socialProviders.facebook = {
        clientId: facebookClientId,
        clientSecret: facebookClientSecret,
      };
    }

    const auth = betterAuth({
      database: drizzleAdapter(this.db, {
        provider: 'pg',
      }),
      socialProviders:
        Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
      account: {
        accountLinking: {
          enabled: true,
          trustedProviders: Object.keys(socialProviders),
        },
      },
      emailAndPassword: {
        enabled: true,
        revokeSessionsOnPasswordReset: true,
        sendResetPassword: async ({ user, token }) => {
          const frontendUrl =
            this.configService.getOrThrow<string>('FRONTEND_URL');
          const resetLink = `${frontendUrl}/reset-password?token=${token}`;
          await sendResetPasswordEmail({
            to: user.email,
            subject: 'Reset your password',
            text: `Click the link to reset your password: ${resetLink}`,
          });
        },
      },
      user: {
        additionalFields: userAdditionalFields,
      },
      plugins: [
        expo(),
        twoFactor({
          issuer: 'NotAnotherCards',
          skipVerificationOnEnable: false,
          allowPasswordless: false,
          accountLockout: {
            enabled: true,
            maxFailedAttempts: 5,
            durationSeconds: 300,
          },
          backupCodeOptions: {
            storeBackupCodes: 'encrypted',
            amount: 10,
          },
        }),
        // Test-only OAuth provider for the OAuth-2FA regression test.
        // Registered ONLY when OAUTH_TEST_PROVIDER_BASE_URL is set, which
        // happens exclusively in the e2e harness (real OAuth cannot run in
        // CI). Points at a loopback stub so the test drives a genuine
        // OAuth round-trip without touching Google/Facebook.
        ...(this.configService.get<string>('OAUTH_TEST_PROVIDER_BASE_URL')
          ? [
              genericOAuth({
                config: [
                  {
                    providerId: 'test-oauth',
                    clientId: 'test-oauth-client',
                    clientSecret: 'test-oauth-secret',
                    authorizationUrl: `${this.configService.getOrThrow<string>('OAUTH_TEST_PROVIDER_BASE_URL')}/authorize`,
                    tokenUrl: `${this.configService.getOrThrow<string>('OAUTH_TEST_PROVIDER_BASE_URL')}/token`,
                    // The stub issues access tokens as
                    // `fake-token-<base64url(email)>`, so the profile is
                    // decoded from the token — no userinfo HTTP call is made.
                    getUserInfo: (tokens) => {
                      if (!tokens.accessToken) return Promise.resolve(null);
                      const email = Buffer.from(
                        tokens.accessToken.replace('fake-token-', ''),
                        'base64url',
                      ).toString('utf8');
                      return Promise.resolve({
                        id: `test-oauth-${email}`,
                        email,
                        name: email.split('@')[0] || email,
                        emailVerified: true,
                      });
                    },
                  },
                ],
              }),
            ]
          : []),
      ],
      trustedOrigins: [
        this.configService.getOrThrow<string>('FRONTEND_URL'),
        'notanothercards://',
        'exp://',
        'exp://**',
      ],
      hooks: {
        after: twoFactorOAuthChallengeHook(
          this.configService.getOrThrow<string>('FRONTEND_URL'),
        ),
      },
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
