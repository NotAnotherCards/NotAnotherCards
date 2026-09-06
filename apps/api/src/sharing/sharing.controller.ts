import {
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
import type { Request } from 'express';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service';
import { SharingService } from './sharing.service';

const browseQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
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

    const page = browseQuerySchema.safeParse(query);
    if (!page.success) {
      throw new BadRequestException({
        message: 'Invalid browse parameters',
        errors: page.error.flatten().fieldErrors,
      });
    }
    return this.sharingService.listShared(page.data.limit, page.data.offset);
  }

  @Get('shared/decks/:id')
  async previewShared(@Req() req: Request, @Param('id') deckId: string) {
    const userId = await this.getAuthenticatedUserId(req);
    return this.sharingService.previewShared(userId, deckId);
  }
}
