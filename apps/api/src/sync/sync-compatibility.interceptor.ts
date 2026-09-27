import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { SyncPullResult, SyncPushResult } from '@remelondb/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

// What the sync endpoints answer: a pull's changes and cursor (or a resync
// request), or a push's cursor, echoed changes and rejections.
type SyncResponse = SyncPullResult | SyncPushResult;

/**
 * Strips the 'user_badges' table from sync responses if the client
 * does not explicitly send an 'x-sync-version' header >= 2. This prevents
 * older clients (which strictly reject unknown tables) from crashing.
 */
@Injectable()
export class SyncCompatibilityInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler<SyncResponse>,
  ): Observable<SyncResponse> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const request = context
      .switchToHttp()
      .getRequest<{ path: string; headers: Record<string, string> }>();
    if (!request.path.startsWith('/sync/')) {
      return next.handle();
    }
    const versionHeader = request.headers['x-sync-version'];
    const isLegacy = !versionHeader || parseInt(versionHeader, 10) < 2;

    return next.handle().pipe(
      map((data) => {
        if (!isLegacy || !('changes' in data) || !data.changes?.user_badges) {
          return data;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { user_badges, ...changes } = data.changes;
        return { ...data, changes };
      }),
    );
  }
}
