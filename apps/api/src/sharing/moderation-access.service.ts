import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';

// Server-only policy, captured at startup. Configuration changes require a restart
@Injectable()
export class ModerationAccessService {
  private readonly adminUserIds: ReadonlySet<string>;
  private readonly operatorKey: string | undefined;
  private readonly frontendOrigin: string;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.adminUserIds = new Set(
      (config.get<string>('MODERATION_ADMIN_USER_IDS') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    );
    this.operatorKey = config.get<string>('MODERATION_OPERATOR_KEY');
    this.frontendOrigin = new URL(
      config.getOrThrow<string>('FRONTEND_URL'),
    ).origin;
  }

  async capabilities(req: Request) {
    const userId = await this.authenticatedUserId(req);
    return { canModerate: this.adminUserIds.has(userId) };
  }

  // A key is an independent CLI credential; only a session supplies an audit actor
  async authorize(req: Request, mutation = false): Promise<string | null> {
    const received = req.header('x-moderation-operator-key');
    if (this.operatorKey && received) {
      const expectedBytes = Buffer.from(this.operatorKey);
      const receivedBytes = Buffer.from(received);
      if (
        expectedBytes.length === receivedBytes.length &&
        timingSafeEqual(expectedBytes, receivedBytes)
      ) {
        return null;
      }
    }

    const userId = await this.authenticatedUserId(req);
    if (!this.adminUserIds.has(userId)) {
      throw new ForbiddenException('Moderation permission required');
    }
    // Cookies are ambient credentials. A missing/null/foreign Origin must
    // fail closed, independently of CORS. CLI callers can use the key above.
    if (mutation && req.header('origin') !== this.frontendOrigin) {
      throw new ForbiddenException('Trusted frontend origin required');
    }
    return userId;
  }

  private async authenticatedUserId(req: Request): Promise<string> {
    const userId = await this.auth.userIdFromHeaders(req.headers);
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}
