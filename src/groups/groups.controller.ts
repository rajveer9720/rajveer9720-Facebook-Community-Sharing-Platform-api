import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDiscoveryDto } from './dto/create-group-discovery.dto';
import { GroupStatus, UserRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/jwt-payload';

@Controller()
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get('groups')
  findAll(@Query('status') status?: GroupStatus) {
    return this.groupsService.findAll(status);
  }

  @Get('groups/coverage')
  coverage() {
    return this.groupsService.coverage();
  }

  @Get('groups/library')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  library(@CurrentUser() user: RequestUser) {
    return this.groupsService.libraryForWorker(user.id);
  }

  @Post('groups')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  create(@Body() dto: CreateGroupDiscoveryDto) {
    return this.groupsService.create(dto);
  }
}
