import {
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { SharingService } from './sharing.service';

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
}
