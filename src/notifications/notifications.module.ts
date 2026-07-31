import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { Notification } from './notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsEmailService } from './notifications-email.service';
import { NotificationsEvents } from './notifications.events';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), UsersModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsEmailService, NotificationsEvents],
  exports: [NotificationsService],
})
export class NotificationsModule {}