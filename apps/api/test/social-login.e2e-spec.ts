import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const frontendOrigin = 'http://localhost:5173';

describe('Redirects and Session Creation (e2e)', () => {
  let app: INestApplication<App>;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousGoogleId = process.env.GOOGLE_CLIENT_ID;
  const previousGoogleSecret = process.env.GOOGLE_CLIENT_SECRET;
  const previousFacebookId = process.env.FACEBOOK_CLIENT_ID;
  const previousFacebookSecret = process.env.FACEBOOK_CLIENT_SECRET;

  const testUser = {
    email: `redirect-tester-${Date.now()}@random.com`,
    password: 'securePassword123!',
    name: 'Redirect Tester',
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.GOOGLE_CLIENT_ID = 'dummy-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'dummy-google-client-secret';
    process.env.FACEBOOK_CLIENT_ID = 'dummy-facebook-client-id';
    process.env.FACEBOOK_CLIENT_SECRET = 'dummy-facebook-client-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    const restoreEnv = (key: string, value: string | undefined) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    };

    restoreEnv('NODE_ENV', previousNodeEnv);
    restoreEnv('GOOGLE_CLIENT_ID', previousGoogleId);
    restoreEnv('GOOGLE_CLIENT_SECRET', previousGoogleSecret);
    restoreEnv('FACEBOOK_CLIENT_ID', previousFacebookId);
    restoreEnv('FACEBOOK_CLIENT_SECRET', previousFacebookSecret);

    await app.close();
  });

  describe('OAuth Redirect Responses', () => {
    it('should initiate Google OAuth flow and return the redirect URL', async () => {
      const callbackURL = `${frontendOrigin}/app/dashboard`;
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-in/social')
        .set('Origin', frontendOrigin)
        .send({
          provider: 'google',
          callbackURL,
        });

      // Better Auth redirects to the OAuth provider. Depending on the environment / headers,
      // it might either return a 302 Found redirect or a 200 OK with the redirect URL in JSON.
      // Let's support both assertions to be robust.
      if (response.status === 302) {
        const location = response.headers.location;
        expect(location).toBeDefined();
        expect(location).toContain('accounts.google.com');
      } else {
        expect(response.status).toBe(200);
        expect(response.body).toBeDefined();
        const body = response.body as { url: string };
        expect(body.url).toContain('accounts.google.com');
      }
    });

    it('should initiate Facebook OAuth flow and return the redirect URL', async () => {
      const callbackURL = `${frontendOrigin}/app/dashboard`;
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-in/social')
        .set('Origin', frontendOrigin)
        .send({
          provider: 'facebook',
          callbackURL,
        });

      if (response.status === 302) {
        const location = response.headers.location;
        expect(location).toBeDefined();
        expect(location).toContain('facebook.com');
      } else {
        expect(response.status).toBe(200);
        expect(response.body).toBeDefined();
        const body = response.body as { url: string };
        expect(body.url).toContain('facebook.com');
      }
    });
  });

  describe('Session Creation and Management', () => {
    let sessionCookie: string;

    it('should create a session cookie upon email sign-up', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-up/email')
        .set('Origin', frontendOrigin)
        .send({
          email: testUser.email,
          password: testUser.password,
          name: testUser.name,
        })
        .expect(200);

      const cookies = (response.headers['set-cookie'] || []) as string[];
      const sessionTokenCookie = cookies.find((c: string) =>
        c.includes('better-auth.session_token'),
      );

      expect(sessionTokenCookie).toBeDefined();
      sessionCookie = sessionTokenCookie!;
    });

    it('should successfully retrieve session info using the session cookie', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/get-session')
        .set('Origin', frontendOrigin)
        .set('Cookie', [sessionCookie])
        .expect(200);

      const body = response.body as {
        user: { email: string; name: string };
        session: { userId: string };
      };

      expect(body).toBeDefined();
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(testUser.email);
      expect(body.user.name).toBe(testUser.name);
      expect(body.session).toBeDefined();
    });

    it('should return null or unauthorized when retrieving session info with an invalid cookie', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/get-session')
        .set('Origin', frontendOrigin)
        .set('Cookie', [
          'better-auth.session_token=invalid_token; Path=/; HttpOnly',
        ])
        .expect(200); // better-auth returns null (or empty body/200 ok with null) if session doesn't exist

      expect(response.body).toBeNull();
    });

    it('should clear/invalidate session on sign-out', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-out')
        .set('Origin', frontendOrigin)
        .set('Cookie', [sessionCookie])
        .expect(200);

      // Verify the response asks to clear the cookie (Max-Age=0 or Expires in past)
      const cookies = (response.headers['set-cookie'] || []) as string[];
      const clearedCookie = cookies.find((c: string) =>
        c.includes('better-auth.session_token'),
      );
      expect(clearedCookie).toBeDefined();
      expect(clearedCookie).toMatch(/Max-Age=0|Expires=/i);
    });
  });
});
