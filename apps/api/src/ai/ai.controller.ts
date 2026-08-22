import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { AiLimitsService } from './ai-limits.service';
import { AiQueueService } from './ai-queue.service';
import { createAiJobSchema } from './dto/create-generation-job.dto';

@Controller('api/ai')
export class AiController {
  constructor(
    private readonly authService: AuthService,
    private readonly limitsService: AiLimitsService,
    private readonly queueService: AiQueueService,
  ) {}

  private async getAuthenticatedUserId(req: Request): Promise<string> {
    const userId = await this.authService.userIdFromHeaders(req.headers);
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return userId;
  }

  @Post('generate')
  async createGenerationJob(@Req() req: Request, @Body() body: unknown) {
    const userId = await this.getAuthenticatedUserId(req);

    const validationResult = createAiJobSchema.safeParse(body);
    if (!validationResult.success) {
      throw new BadRequestException({
        message: 'Invalid generation job parameters',
        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    await this.limitsService.checkUserCanSubmitJob(userId);

    const job = await this.queueService.enqueueJob(
      userId,
      validationResult.data,
    );
    return { job };
  }

  @Get('jobs/:id')
  async getJobById(@Req() req: Request, @Param('id') jobId: string) {
    const userId = await this.getAuthenticatedUserId(req);
    const job = await this.queueService.getJobById(userId, jobId);
    return { job };
  }

  @Get('jobs')
  async listJobs(@Req() req: Request) {
    const userId = await this.getAuthenticatedUserId(req);
    const jobs = await this.queueService.listUserJobs(userId);
    return { jobs };
  }

  @Get('quota')
  async getQuota(@Req() req: Request) {
    const userId = await this.getAuthenticatedUserId(req);
    const quota = await this.limitsService.getQuotaStatus(userId);
    return { quota };
  }
}
