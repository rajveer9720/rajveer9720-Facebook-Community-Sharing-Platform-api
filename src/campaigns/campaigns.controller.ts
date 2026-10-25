import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ALLOWED_MEDIA_MIME_TYPES } from '../common/constants/media.constants';
import { CampaignStatus, UserRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../interfaces/auth.interface';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, UpdateCampaignDto } from '../dto/campaigns.dto';

const MAX_MEDIA_FILE_SIZE_BYTES = 100 * 1024 * 1024;

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  findAll(@Query('status') status?: CampaignStatus) {
    return this.campaignsService.findAll(status);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermission('manage', 'Campaign')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(dto, user.id);
  }

  @Get('media-download')
  async downloadMedia(@Query('objectKey') objectKey: string, @Res() res: Response) {
    if (!objectKey) {
      throw new BadRequestException('objectKey query param is required');
    }
    const { stream, contentType, fileName } = await this.campaignsService.getMediaDownload(objectKey);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.pipe(res);
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.campaignsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermission('manage', 'Campaign')
  update(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.update(id, dto, user.id);
  }

  @Post('media-signed-url')
  getMediaSignedUrl(@Body() body: { objectKey: string }) {
    if (!body?.objectKey) {
      throw new BadRequestException('objectKey is required');
    }
    return this.campaignsService.getMediaSignedUrl(body.objectKey);
  }

  @Post('media-upload')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermission('manage', 'Campaign')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_MEDIA_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MEDIA_MIME_TYPES.test(file.mimetype)) {
          callback(new BadRequestException('Only image or video files are allowed'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadMedia(@CurrentUser() user: RequestUser, @UploadedFile() file: Express.Multer.File) {
    return this.campaignsService.uploadMedia(user.id, file);
  }

  @Post(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermission('manage', 'Campaign')
  activate(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number) {
    return this.campaignsService.activate(id, user.id);
  }

  @Post(':id/pause')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermission('manage', 'Campaign')
  pause(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number) {
    return this.campaignsService.pause(id, user.id);
  }

  @Post(':id/resume')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermission('manage', 'Campaign')
  resume(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number) {
    return this.campaignsService.resume(id, user.id);
  }

  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermission('manage', 'Campaign')
  duplicate(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number) {
    return this.campaignsService.duplicate(id, user.id);
  }

  @Post(':id/archive')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermission('manage', 'Campaign')
  archive(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number) {
    return this.campaignsService.archive(id, user.id);
  }
}
