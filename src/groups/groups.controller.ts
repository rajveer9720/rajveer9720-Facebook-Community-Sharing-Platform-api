import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CreateGroupDiscoveryDto, ModerateGroupDto, RecommendGroupsDto, UpdateGroupDto } from '../dto/groups.dto';
import { GroupsService } from './groups.service';
import { GroupStatus, UserRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../interfaces/auth.interface';

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

  @Post('groups/recommendations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  recommend(@CurrentUser() user: RequestUser, @Body() dto: RecommendGroupsDto) {
    return this.groupsService.recommendForWorker(user.id, dto);
  }

  @Post('groups/:id/moderate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  moderate(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number, @Body() dto: ModerateGroupDto) {
    return this.groupsService.moderate(id, dto, user.id);
  }

  @Patch('groups/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto, user.id);
  }
}
