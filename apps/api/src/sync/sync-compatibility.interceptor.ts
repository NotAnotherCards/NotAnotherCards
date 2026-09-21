import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Strips the 'user_badges' table from sync responses if the client
 * does not explicitly send an 'x-sync-version' header >= 2. This prevents
 * older clients (which strictly reject unknown tables) from crashing.
 */
@Injectable()
export class SyncCompatibilityInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
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
      map((data: Record<string, any>) => {
        const changes = data.changes as Record<string, any> | undefined;
        if (isLegacy && data && changes && changes.user_badges) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { user_badges, ...restChanges } = changes;
          return {
            ...data,
            changes: restChanges,
          };
        }
        return data;
      }),
    );
  }
}
