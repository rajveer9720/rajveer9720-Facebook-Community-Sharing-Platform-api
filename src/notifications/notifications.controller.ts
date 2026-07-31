import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/jwt-payload';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me')
  listMyNotifications(@CurrentUser() user: RequestUser) {
    return this.notificationsService.listForUser(user.id);
  }

  @Post(':id/read')
  markAsRead(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }
}