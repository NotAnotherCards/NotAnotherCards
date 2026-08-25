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
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AuthService } from './auth.service';
import { DATABASE_CONNECTION } from '../database/database-connection';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';
import { userProfiles } from '../sync/schema';
import { eq, sql } from 'drizzle-orm';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

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

    // 1. Check if username is already taken in user_profiles
    const existingProfile = await this.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.username, username))
      .limit(1);

    if (existingProfile.length > 0 && existingProfile[0].userId !== userId) {
      throw new BadRequestException('Username is already taken');
    }

    // 2. Update user table (set onBoardingComplete = true)
    await this.db
      .update(schema.user)
      .set({ onBoardingComplete: true })
      .where(eq(schema.user.id, userId));

    // 3. Upsert userProfile in user_profiles table.
    const now = Date.now();
    await this.db
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

    return { success: true };
  }

  @All('{*path}')
  async handleAuth(@Req() req: Request, @Res() res: Response) {
    const handler = toNodeHandler(this.authService.auth);
    return handler(req, res);
  }
}
