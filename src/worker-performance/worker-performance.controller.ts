import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  workersPerformance(@Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : 100;
    return this.workerPerformanceService.listWorkersPerformance(Number.isFinite(parsedLimit) ? parsedLimit : 100);
  }
}