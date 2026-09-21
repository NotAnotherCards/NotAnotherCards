import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Strips the 'user_badges' table from sync pull responses if the client
 * does not explicitly send the 'x-sync-version: 2' header. This prevents
 * older clients (which strictly reject unknown tables) from crashing.
 */
@Injectable()
export class SyncCompatibilityInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest();
    if (request.path !== '/sync/pull') {
      return next.handle();
    }
    const isV2 = request?.headers?.['x-sync-version'] === '2';

    return next.handle().pipe(
      map((data) => {
        if (!isV2 && data && data.changes && data.changes.user_badges) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { user_badges, ...restChanges } = data.changes;
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
