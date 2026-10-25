import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { RequestUser } from '../interfaces/auth.interface';
import { WorkerPerformanceService } from './worker-performance.service';

@Controller()
export class WorkerPerformanceController {
  constructor(private readonly workerPerformanceService: WorkerPerformanceService) {}

  @Get('worker-performance/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.WORKER)
  myPerformance(@CurrentUser() user: RequestUser) {
    return this.workerPerformanceService.getForWorker(user.id);
  }

  @Get('admin/worker-performance')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermission('read', 'WorkerDirectory')
  async workersPerformance(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 100;
    const items = await this.workerPerformanceService.listWorkersPerformance(Number.isFinite(parsedLimit) ? parsedLimit : 100);
    return { items };
  }
}