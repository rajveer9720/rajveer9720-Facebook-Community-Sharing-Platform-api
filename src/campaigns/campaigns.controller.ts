import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ALLOWED_MEDIA_MIME_TYPES } from '../common/constants/media.constants';
import { CampaignStatus, UserRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../interfaces/auth.interface';
import { CampaignsService } from './campaigns.service';

const MAX_MEDIA_FILE_SIZE_BYTES = 100 * 1024 * 1024;

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  findAll(@Query('status') status?: CampaignStatus) {
    return this.campaignsService.findAll(status);
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

  @Post('media-signed-url')
  getMediaSignedUrl(@Body() body: { objectKey: string }) {
    if (!body?.objectKey) {
      throw new BadRequestException('objectKey is required');
    }
    return this.campaignsService.getMediaSignedUrl(body.objectKey);
  }

  @Post('media-upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
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

  @Post(':id/pause')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  pause(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number) {
    return this.campaignsService.pause(id, user.id);
  }

  @Post(':id/resume')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  resume(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number) {
    return this.campaignsService.resume(id, user.id);
  }

  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  duplicate(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number) {
    return this.campaignsService.duplicate(id, user.id);
  }

  @Post(':id/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  archive(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number) {
    return this.campaignsService.archive(id, user.id);
  }
}
