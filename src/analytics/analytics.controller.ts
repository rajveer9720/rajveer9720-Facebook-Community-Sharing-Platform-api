import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('analytics/overview')
  getOverview() {
    return this.analyticsService.getOverview();
  }

  @Get('admin/overview')
  getAdminOverview() {
    return this.analyticsService.getAdminOverview();
  }
}
