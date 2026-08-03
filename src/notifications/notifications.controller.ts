import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../interfaces/auth.interface';
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
  markAsRead(@CurrentUser() user: RequestUser, @Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.markAsRead(user.id, id);
  }
}