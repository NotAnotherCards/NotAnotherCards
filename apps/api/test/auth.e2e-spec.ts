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
        })
        .expect(200);

      const body = response.body as {
        user: {
          email: string;
          name: string;
        };
      };

      expect(body).toBeDefined();
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(testUser.email);
      expect(body.user.name).toBe(`${testUser.firstName} ${testUser.lastName}`);

      const cookies = (response.headers['set-cookie'] || []) as string[];
      expect(cookies).toBeDefined();

      const hasSessionCookie = cookies.some((cookie: string) =>
        cookie.includes('better-auth.session_token'),
      );
      expect(hasSessionCookie).toBe(true);
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
});
