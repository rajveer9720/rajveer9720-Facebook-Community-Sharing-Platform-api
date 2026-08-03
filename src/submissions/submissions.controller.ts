import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CreateProofUploadUrlDto, CreateSubmissionDto, ReviewSubmissionDto } from '../dto/submissions.dto';
import { SubmissionsService } from './submissions.service';
import { SubmissionStatus, UserRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../interfaces/auth.interface';

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.WORKER)
  findAll(@CurrentUser() user: RequestUser, @Query('workerId') workerId?: string, @Query('status') status?: SubmissionStatus) {
    return this.submissionsService.findAll(user, workerId ? Number(workerId) : undefined, status);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateSubmissionDto) {
    return this.submissionsService.create(user, dto);
  }

  @Post('proof-upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadProof(
    @CurrentUser() user: RequestUser,
    @UploadedFile() file: Express.Multer.File,
    @Query('campaignId') campaignId?: string,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.submissionsService.uploadProof(user.id, campaignId ? Number(campaignId) : undefined, file);
  }

  @Post('proof-upload-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  createProofUploadUrl(@CurrentUser() user: RequestUser, @Body() dto: CreateProofUploadUrlDto) {
    return this.submissionsService.createProofUploadUrl(user.id, dto);
  }

  @Get(':id/proof-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.WORKER)
  getProofSignedUrl(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number) {
    return this.submissionsService.getProofSignedUrl(user, id);
  }

  @Post(':id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  review(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ReviewSubmissionDto) {
    return this.submissionsService.review(id, dto.decision, dto.note, user.id);
  }
}
