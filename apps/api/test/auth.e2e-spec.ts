import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

// Better Auth skips its origin check when NODE_ENV is 'test' (Jest's
// default), so this suite boots the app in production mode and sends the
// frontend's Origin header on every request to exercise the real
// browser-facing path. The env override has to happen before the app
// module is loaded, hence the deferred require in beforeAll.
const frontendOrigin = 'http://localhost:5173';

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  const previousNodeEnv = process.env.NODE_ENV;

  // Generating unique email per test.
  const testUser = {
    email: `developer-${Date.now()}@random.com`,
    password: 'randompassworD123!',
    firstName: 'Art',
    lastName: 'Emis',
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    process.env.NODE_ENV = previousNodeEnv;
    await app.close();
  });

  describe('POST /api/auth/sign-up/email', () => {
    it('should successfully register a new user and set a session cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-up/email')
        .set('Origin', frontendOrigin)
        .send({
          email: testUser.email,
          password: testUser.password,
          name: `${testUser.firstName} ${testUser.lastName}`,
          timezone: 'Europe/Berlin',
        })
        .expect(200);

      const body = response.body as {
        user: {
          email: string;
          name: string;
          timezone: string;
        };
      };

      expect(body).toBeDefined();
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(testUser.email);
      expect(body.user.name).toBe(`${testUser.firstName} ${testUser.lastName}`);
      expect(body.user.timezone).toBe('Europe/Berlin');

      const cookies = (response.headers['set-cookie'] || []) as string[];
      expect(cookies).toBeDefined();

      const hasSessionCookie = cookies.some((cookie: string) =>
        cookie.includes('better-auth.session_token'),
      );
      expect(hasSessionCookie).toBe(true);
    });

    it('ignores a client-supplied onBoardingComplete on signup', async () => {
      const signup = await request(app.getHttpServer())
        .post('/api/auth/sign-up/email')
        .set('Origin', frontendOrigin)
        .send({
          email: `bypass-${Date.now()}@random.com`,
          password: testUser.password,
          name: 'Bypass Attempt',
          onBoardingComplete: true,
        })
        .expect(200);

      // The flag is server-owned (input: false): only the /onboard
      // transaction may set it, whatever the signup body claims. Assert
      // on the session, not the signup echo, so an omitted field cannot
      // mask a stored true.
      const cookies = (signup.headers['set-cookie'] || []) as string[];
      const session = await request(app.getHttpServer())
        .get('/api/auth/get-session')
        .set('Origin', frontendOrigin)
        .set('Cookie', cookies.map((c) => c.split(';')[0]).join('; '))
        .expect(200);

      const body = session.body as {
        user: { onBoardingComplete?: boolean };
      };
      expect(body.user.onBoardingComplete).toBe(false);
    });

    it('should return an error when attempting to register a duplicate email', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-up/email')
        .set('Origin', frontendOrigin)
        .send({
          email: testUser.email, // using the same email
          password: testUser.password,
          name: 'Duplicate User',
        })
        .expect(422); // Better Auth returns a 422 Unprocessable Entity on duplicate signups

      const body = response.body as { message?: string };
      expect(body).toBeDefined();
      expect(body.message).toContain('User already exists');
    });
  });

  describe('POST /api/auth/sign-in/email', () => {
    it('should successfully login with correct credentials and set session cookie', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .set('Origin', frontendOrigin)
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      const body = response.body as { user: { email: string } };
      expect(body).toBeDefined();
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(testUser.email);

      const cookies = (response.headers['set-cookie'] || []) as string[];
      expect(cookies).toBeDefined();

      const hasSessionCookie = cookies.some((cookie: string) =>
        cookie.includes('better-auth.session_token'),
      );
      expect(hasSessionCookie).toBe(true);
    });

    it('should reject login with an incorrect password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-in/email')
        .set('Origin', frontendOrigin)
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401); // Better Auth returns a 401 Unauthorized for invalid password

      const body = response.body as { message?: string };
      expect(body).toBeDefined();
      expect(body.message).toContain('Invalid email or password');
    });
  });

  describe('GET /api/auth/check-username', () => {
    let userCookie: string[];

    beforeAll(async () => {
      // Register a user to get a session cookie
      const signupEmail = `username-check-${Date.now()}@test.com`;
      const response = await request(app.getHttpServer())
        .post('/api/auth/sign-up/email')
        .set('Origin', frontendOrigin)
        .send({
          email: signupEmail,
          password: 'TestPassword123!',
          name: 'Username Checker',
        })
        .expect(200);

      userCookie = response.get('Set-Cookie') ?? [];
    });

    it('should reject requests without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/check-username?username=random_name')
        .set('Origin', frontendOrigin)
        .expect(401);
    });

    it('should return available: true when the username is not taken', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/check-username?username=completely_fresh_username')
        .set('Origin', frontendOrigin)
        .set('Cookie', userCookie)
        .expect(200);

      expect(response.body).toEqual({ available: true });
    });

    it('should return available: true when the username is owned by the current user', async () => {
      // First, create the user profile with a specific username via the onboarding endpoint
      const username = `my_own_username_${Date.now()}`;
      await request(app.getHttpServer())
        .post('/api/auth/onboard')
        .set('Origin', frontendOrigin)
        .set('Cookie', userCookie)
        .send({
          username,
          native_language_id: '00000000-0000-0000-0000-000000000001',
          target_language_id: '00000000-0000-0000-0000-000000000002',
        })
        .expect(201);

      // Checking the same username should return available: true (since the current user owns it)
      const response = await request(app.getHttpServer())
        .get(`/api/auth/check-username?username=${username}`)
        .set('Origin', frontendOrigin)
        .set('Cookie', userCookie)
        .expect(200);

      expect(response.body).toEqual({ available: true });
    });

    it('should return available: false when the username is owned by another user', async () => {
      // 1. Create a second user and onboard them with a specific username
      const secondUserEmail = `other-user-${Date.now()}@test.com`;
      const signupResponse = await request(app.getHttpServer())
        .post('/api/auth/sign-up/email')
        .set('Origin', frontendOrigin)
        .send({
          email: secondUserEmail,
          password: 'TestPassword123!',
          name: 'Other User',
        })
        .expect(200);

      const secondUserCookie = signupResponse.get('Set-Cookie') ?? [];
      const sharedUsername = `taken_username_${Date.now()}`;

      await request(app.getHttpServer())
        .post('/api/auth/onboard')
        .set('Origin', frontendOrigin)
        .set('Cookie', secondUserCookie)
        .send({
          username: sharedUsername,
          native_language_id: '00000000-0000-0000-0000-000000000001',
          target_language_id: '00000000-0000-0000-0000-000000000002',
        })
        .expect(201);

      // 2. Check the availability of that username from the first user's session
      const response = await request(app.getHttpServer())
        .get(`/api/auth/check-username?username=${sharedUsername}`)
        .set('Origin', frontendOrigin)
        .set('Cookie', userCookie)
        .expect(200);

      // It should be unavailable (false)
      expect(response.body).toEqual({ available: false });
    });
  });
});
