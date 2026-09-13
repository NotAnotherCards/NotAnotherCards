import {
  Body,
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
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
const reportBodySchema = z.object({
  reason: z.string().trim().min(1).max(2_000),
});
const takedownBodySchema = z.object({
  reason: z.string().trim().min(1).max(2_000),
});

const reasonFrom = (schema: typeof reportBodySchema, body: unknown) => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new BadRequestException('A reason is required');
  return parsed.data.reason;
};

@Controller('api')
export class SharingController {
  constructor(
    private readonly authService: AuthService,
    private readonly sharingService: SharingService,
    private readonly config: ConfigService,
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

  @Post('shared/decks/:id/report')
  @HttpCode(201)
  async reportShared(
    @Req() req: Request,
    @Param('id') deckId: string,
    @Body() body: unknown,
  ) {
    const userId = await this.getAuthenticatedUserId(req);
    const reason = reasonFrom(reportBodySchema, body);
    return this.sharingService.report(userId, deckId, reason);
  }

  @Get('shared/decks/:id')
  async previewShared(@Req() req: Request, @Param('id') deckId: string) {
    const userId = await this.getAuthenticatedUserId(req);
    return this.sharingService.previewShared(userId, deckId);
  }

  @Get('decks/:id/moderation')
  async ownerModerationStatus(
    @Req() req: Request,
    @Param('id') deckId: string,
  ) {
    const userId = await this.getAuthenticatedUserId(req);
    return this.sharingService.ownerModerationStatus(userId, deckId);
  }

  @Get('operator/deck-reports')
  async listReports(@Req() req: Request, @Query() query: unknown) {
    this.assertOperator(req);
    const page = browseQuerySchema.parse(query);
    return this.sharingService.listReports(page.limit, page.offset);
  }

  @Post('operator/decks/:id/takedown')
  @HttpCode(200)
  async operatorTakedown(
    @Req() req: Request,
    @Param('id') deckId: string,
    @Body() body: unknown,
  ) {
    this.assertOperator(req);
    const reason = reasonFrom(takedownBodySchema, body);
    return this.sharingService.operatorTakedown(deckId, reason);
  }

  private assertOperator(req: Request) {
    const expected = this.config.get<string>('MODERATION_OPERATOR_KEY');
    const received = req.header('x-moderation-operator-key');
    if (!expected || !received) {
      throw new UnauthorizedException('Operator authentication required');
    }
    const expectedBytes = Buffer.from(expected);
    const receivedBytes = Buffer.from(received);
    if (
      expectedBytes.length !== receivedBytes.length ||
      !timingSafeEqual(expectedBytes, receivedBytes)
    ) {
      throw new UnauthorizedException('Operator authentication required');
    }
  }
}
