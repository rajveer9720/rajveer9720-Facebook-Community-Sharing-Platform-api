import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminsService } from './admins.service';
import { CreateStaffDto, UpdateStaffDto } from '../dto/admins.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { RequestUser } from '../interfaces/auth.interface';

@Controller('admins')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Roles(UserRole.ADMIN)
@RequirePermission('manage', 'Staff')
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Get()
  findAll() {
    return this.adminsService.findAllStaff();
  }

  @Post()
  create(@Body() dto: CreateStaffDto) {
    return this.adminsService.createStaff(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStaffDto, @CurrentUser() currentUser: RequestUser) {
    return this.adminsService.updateStaff(id, dto, currentUser.id);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() currentUser: RequestUser) {
    return this.adminsService.deleteStaff(id, currentUser.id);
  }
}
