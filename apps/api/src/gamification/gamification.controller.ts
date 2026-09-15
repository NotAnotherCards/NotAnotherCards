import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service';
import { GamificationService } from './gamification.service';

export const MAX_LEADERBOARD_PAGE_SIZE = 100;
const DEFAULT_LEADERBOARD_PAGE_SIZE = 50;
const MAX_LEADERBOARD_OFFSET = 1_000_000;

const leaderboardQuerySchema = z.object({
  limit: z.coerce
    .number()
    .catch(DEFAULT_LEADERBOARD_PAGE_SIZE)
    .transform((value) =>
      value >= 1
        ? Math.min(Math.trunc(value), MAX_LEADERBOARD_PAGE_SIZE)
        : DEFAULT_LEADERBOARD_PAGE_SIZE,
    ),
  offset: z.coerce
    .number()
    .catch(0)
    .transform((value) =>
      value > 0 ? Math.min(Math.trunc(value), MAX_LEADERBOARD_OFFSET) : 0,
    ),
});

@Controller('api/gamification')
export class GamificationController {
  constructor(
    private readonly authService: AuthService,
    private readonly gamificationService: GamificationService,
  ) {}

  @Get('me')
  async me(@Req() request: Request) {
    const userId = await this.authenticatedUserId(request);
    return this.gamificationService.refreshAwards(userId);
  }

  @Get('leaderboard')
  async leaderboard(@Req() request: Request, @Query() query: unknown) {
    const userId = await this.authenticatedUserId(request);
    const page = leaderboardQuerySchema.parse(query);
    return this.gamificationService.leaderboard(
      userId,
      page.limit,
      page.offset,
    );
  }

  private async authenticatedUserId(request: Request): Promise<string> {
    const userId = await this.authService.userIdFromHeaders(request.headers);
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}
