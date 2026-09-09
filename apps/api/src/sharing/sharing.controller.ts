import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service';
import { SharingService } from './sharing.service';

// Paging is clamped, not validated: only a buggy client sends limit=101 or
// offset=-1, and a page of results serves it better than a 400 nobody reads.
const MAX_OFFSET = 1_000_000; // bigint-safe and far beyond any real list
const browseQuerySchema = z.object({
  limit: z.coerce
    .number()
    .catch(50)
    .transform((n) => (n >= 1 ? Math.min(Math.trunc(n), 100) : 50)),
  offset: z.coerce
    .number()
    .catch(0)
    .transform((n) => (n > 0 ? Math.min(Math.trunc(n), MAX_OFFSET) : 0)),
});

@Controller('api')
export class SharingController {
  constructor(
    private readonly authService: AuthService,
    private readonly sharingService: SharingService,
  ) {}

  private async getAuthenticatedUserId(req: Request): Promise<string> {
    const userId = await this.authService.userIdFromHeaders(req.headers);
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return userId;
  }

  @Post('decks/:id/publish')
  @HttpCode(200)
  async publish(@Req() req: Request, @Param('id') deckId: string) {
    const userId = await this.getAuthenticatedUserId(req);
    return this.sharingService.publish(userId, deckId);
  }

  @Post('decks/:id/unpublish')
  @HttpCode(200)
  async unpublish(@Req() req: Request, @Param('id') deckId: string) {
    const userId = await this.getAuthenticatedUserId(req);
    return this.sharingService.unpublish(userId, deckId);
  }

  @Get('shared/decks')
  async listShared(@Req() req: Request, @Query() query: unknown) {
    await this.getAuthenticatedUserId(req);

    const page = browseQuerySchema.parse(query);
    return this.sharingService.listShared(page.limit, page.offset);
  }

  @Post('shared/decks/:id/import')
  @HttpCode(201)
  async importShared(@Req() req: Request, @Param('id') deckId: string) {
    const userId = await this.getAuthenticatedUserId(req);
    return this.sharingService.importShared(userId, deckId);
  }

  @Get('shared/decks/:id')
  async previewShared(@Req() req: Request, @Param('id') deckId: string) {
    const userId = await this.getAuthenticatedUserId(req);
    return this.sharingService.previewShared(userId, deckId);
  }
}
