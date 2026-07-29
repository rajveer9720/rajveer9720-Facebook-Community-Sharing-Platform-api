import { Controller, Get, UseGuards } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/jwt-payload';

@Controller('leaderboard')
@UseGuards(OptionalJwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  getLeaderboard(@CurrentUser() user: RequestUser | null) {
    return this.leaderboardService.getLeaderboard(user?.id);
  }

  @Get('achievements')
  getAchievements(@CurrentUser() user: RequestUser | null) {
    return this.leaderboardService.getAchievements(user?.id);
  }
}
