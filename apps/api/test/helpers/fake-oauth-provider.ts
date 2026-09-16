import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { randomUUID } from 'node:crypto';

/**
 * Minimal loopback OAuth2 stub for the OAuth-2FA regression test.
 *
 * Implements just enough of the authorization-code flow for Better Auth's
 * genericOAuth provider: `GET /authorize` issues a one-time code via 302,
 * `POST /token` exchanges it for a stub access token. User profile
 * resolution happens without HTTP: the app under test decodes the profile
 * from the stub-issued token (see the `OAUTH_TEST_PROVIDER_BASE_URL`
 * provider in AuthService), so no `/userinfo` endpoint is needed.
 *
 * Bodies on /token are parsed leniently (form-encoded or JSON) because the
 * exact encoding is a client detail this stub must not couple to.
 */
export interface FakeOAuthProfile {
  email: string;
  name: string;
}

export function encodeFakeToken(email: string): string {
  return `fake-token-${Buffer.from(email, 'utf8').toString('base64url')}`;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

export function createFakeOAuthProvider() {
  let profile: FakeOAuthProfile = {
    email: 'nobody@example.com',
    name: 'Nobody',
  };
  const codes = new Map<string, FakeOAuthProfile>();
  const server: Server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://stub');
      if (req.method === 'GET' && url.pathname === '/authorize') {
        const redirectUri = url.searchParams.get('redirect_uri') ?? '';
        const state = url.searchParams.get('state') ?? '';
        if (!redirectUri) {
          json(res, 400, { error: 'missing redirect_uri' });
          return;
        }
        const code = randomUUID();
        codes.set(code, { ...profile });
        const separator = redirectUri.includes('?') ? '&' : '?';
        res.writeHead(302, {
          Location: `${redirectUri}${separator}code=${code}&state=${state}`,
        });
        res.end();
        return;
      }
      if (req.method === 'POST' && url.pathname === '/token') {
        const raw = await readBody(req);
        let code = new URLSearchParams(raw).get('code');
        if (!code) {
          try {
            code = (JSON.parse(raw) as { code?: string }).code ?? null;
          } catch {
            code = null;
          }
        }
        const stored = (code && codes.get(code)) || null;
        if (code) codes.delete(code);
        if (!stored) {
          json(res, 400, { error: 'invalid_grant' });
          return;
        }
        json(res, 200, {
          access_token: encodeFakeToken(stored.email),
          token_type: 'Bearer',
          expires_in: 3600,
        });
        return;
      }
      json(res, 404, { error: 'not_found' });
    })().catch(() => {
      try {
        json(res, 500, { error: 'stub_failure' });
      } catch {
        // response already sent; nothing to do
      }
    });
  });

  return {
    setProfile(next: FakeOAuthProfile): void {
      profile = next;
    },
    start(): Promise<string> {
      return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          const address = server.address();
          const port =
            typeof address === 'object' && address ? address.port : 0;
          resolve(`http://127.0.0.1:${port}`);
        });
      });
    },
    stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

export type FakeOAuthProvider = ReturnType<typeof createFakeOAuthProvider>;
