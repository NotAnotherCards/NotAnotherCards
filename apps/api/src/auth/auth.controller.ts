import {
  Controller,
  All,
  Req,
  Res,
  Inject,
  Post,
  Body,
  UnauthorizedException,
  BadRequestException,
  Get,
  Query,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AuthService } from './auth.service';
import { DATABASE_CONNECTION } from '../database/database-connection';
import * as schema from '../database/schema';
import { userProfiles } from '../sync/schema';
import { eq, sql } from 'drizzle-orm';
import type { AppDatabase } from '../database/database-schema';
import { syncScopeLockKey, getActiveUsernameOwner } from '../sync/sync-store';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: AppDatabase,
  ) {}

  // Advisory check only; the database uniqueness constraint (user_profiles_username_unique)
  // is the actual guard, as the advisory lock is user-specific.
  @Get('check-username')
  async checkUsername(
    @Req() req: Request,
    @Query('username') username: string,
  ) {
    const userId = await this.authService.userIdFromHeaders(req.headers);
    if (!userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    if (!username) {
      throw new BadRequestException('Username query parameter is required');
    }

    // Check if username is taken by another user in active user_profiles
    const owner = await getActiveUsernameOwner(this.db, username);
    const taken = owner !== null && owner !== userId;

    return { available: !taken };
  }

  @Post('onboard')
  async onboard(
    @Req() req: Request,
    @Body()
    body: {
      username: string;
      native_language_id: string;
      target_language_id: string;
    },
  ) {
    const userId = await this.authService.userIdFromHeaders(req.headers);
    if (!userId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const { username, native_language_id, target_language_id } = body;
    if (!username || !native_language_id || !target_language_id) {
      throw new BadRequestException('Missing onboarding fields');
    }

    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${syncScopeLockKey(userId).toString()})`,
      );
      const owner = await getActiveUsernameOwner(tx, username);
      if (owner && owner !== userId) {
        throw new BadRequestException('Username is already taken');
      }

      const now = Date.now();
      await tx
        .insert(userProfiles)
        .values({
          userId,
          username,
          nativeLanguageId: native_language_id,
          targetLanguageId: target_language_id,
          rev: sql`nextval('remelon_rev')`,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: userProfiles.userId,
          set: {
            username,
            nativeLanguageId: native_language_id,
            targetLanguageId: target_language_id,
            rev: sql`nextval('remelon_rev')`,
            updatedAt: now,
          },
        });

      await tx
        .update(schema.user)
        .set({ onBoardingComplete: true })
        .where(eq(schema.user.id, userId));
    });

    return { success: true };
  }

  @All('{*path}')
  async handleAuth(@Req() req: Request, @Res() res: Response) {
    const handler = toNodeHandler(this.authService.auth);
    return handler(req, res);
  }
}
