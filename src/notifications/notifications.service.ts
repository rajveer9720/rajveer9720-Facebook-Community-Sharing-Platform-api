import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { NotificationResponse } from '../interfaces/notifications.interface';

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(Notification) private readonly notificationsRepository: Repository<Notification>) {}

  async listForUser(userId: number): Promise<NotificationResponse[]> {
    const notifications = await this.notificationsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return notifications.map((notification) => this.toResponse(notification));
  }

  async markAsRead(userId: number, id: number): Promise<NotificationResponse> {
    const notification = await this.notificationsRepository.findOne({ where: { id, userId } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.read = true;
    const saved = await this.notificationsRepository.save(notification);
    return this.toResponse(saved);
  }

  async create(input: {
    userId: number;
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<NotificationResponse> {
    const notification = this.notificationsRepository.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      metadata: input.metadata ?? null,
      read: false,
    });
    const saved = await this.notificationsRepository.save(notification);
    return this.toResponse(saved);
  }

  private toResponse(notification: Notification): NotificationResponse {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      read: notification.read,
      metadata: notification.metadata,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}