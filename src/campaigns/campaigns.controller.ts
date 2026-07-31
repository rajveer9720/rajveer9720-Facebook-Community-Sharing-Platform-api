import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CampaignStatus, UserRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/jwt-payload';

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  findAll(@Query('status') status?: CampaignStatus) {
    return this.campaignsService.findAll(status);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.campaignsService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(dto, user.id);
  }

  @Post(':id/pause')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  pause(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.campaignsService.pause(id, user.id);
  }

  @Post(':id/resume')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  resume(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.campaignsService.resume(id, user.id);
  }

  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  duplicate(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.campaignsService.duplicate(id, user.id);
  }

  @Post(':id/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  archive(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.campaignsService.archive(id, user.id);
  }
}
