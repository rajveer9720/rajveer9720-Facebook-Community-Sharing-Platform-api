import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { CreateProofUploadUrlDto } from './dto/create-proof-upload-url.dto';
import { ReviewSubmissionDto } from './dto/review-submission.dto';
import { SubmissionStatus, UserRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/jwt-payload';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get()
  findAll(@Query('workerId') workerId?: string, @Query('status') status?: SubmissionStatus) {
    return this.submissionsService.findAll(workerId, status);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSubmissionDto) {
    return this.submissionsService.create(user, dto);
  }

  @Post('proof-upload-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  createProofUploadUrl(@CurrentUser() user: RequestUser, @Body() dto: CreateProofUploadUrlDto) {
    return this.submissionsService.createProofUploadUrl(user.id, dto);
  }

  @Post(':id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  review(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ReviewSubmissionDto) {
    return this.submissionsService.review(id, dto.decision, dto.note, user.id);
  }
}
