import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkersService } from '../workers/workers.service';
import { NotificationsService } from './notifications.service';
import { NotificationsEmailService } from './notifications-email.service';

interface SubmissionCreatedEvent {
  submissionId: number;
  workerId: number;
  campaignId: number;
  status: string;
  duplicateProofDetected: boolean;
  duplicateUrlDetected: boolean;
}

interface SubmissionReviewedEvent {
  submissionId: number;
  workerId: number;
  campaignId: number;
  status: string;
  note?: string | null;
}

interface CampaignCreatedEvent {
  campaignId: number;
  campaignName: string;
  workerIds: number[];
}

interface CampaignEndingSoonEvent {
  campaignId: number;
  campaignName: string;
  endDate: string;
  workerIds: number[];
}

interface WithdrawalStatusChangedEvent {
  withdrawalId: number;
  workerId: number;
  status: string;
  amountMinor: number;
  currency: string;
}

@Injectable()
export class NotificationsEvents {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsEmailService: NotificationsEmailService,
    private readonly workersService: WorkersService,
  ) {}

  @OnEvent('submission.created')
  async handleSubmissionCreated(event: SubmissionCreatedEvent): Promise<void> {
    if (event.status !== 'MANUAL_REVIEW') {
      return;
    }

    await this.notificationsService.create({
      userId: event.workerId,
      type: 'submission.manual_review',
      title: 'Submission sent for manual review',
      message: 'Your submission has been flagged for manual review due to duplicate risk checks.',
      metadata: {
        submissionId: event.submissionId,
        campaignId: event.campaignId,
        duplicateProofDetected: event.duplicateProofDetected,
        duplicateUrlDetected: event.duplicateUrlDetected,
      },
    });
  }

  @OnEvent('submission.reviewed')
  async handleSubmissionReviewed(event: SubmissionReviewedEvent): Promise<void> {
    const title = event.status === 'APPROVED' ? 'Submission approved' : 'Submission reviewed';
    const message =
      event.status === 'APPROVED'
        ? 'Your submission has been approved and reward has been credited.'
        : event.status === 'REJECTED'
          ? `Your submission was rejected.${event.note ? ` Note: ${event.note}` : ''}`
          : 'Your submission has been reviewed.';

    await this.notificationsService.create({
      userId: event.workerId,
      type: `submission.${event.status.toLowerCase()}`,
      title,
      message,
      metadata: {
        submissionId: event.submissionId,
        campaignId: event.campaignId,
      },
    });

    const user = await this.workersService.findById(event.workerId);
    if (user) {
      await this.notificationsEmailService.send(user.email, title, message);
    }
  }

  @OnEvent('campaign.created')
  async handleCampaignCreated(event: CampaignCreatedEvent): Promise<void> {
    const title = 'New campaign available';
    const message = `${event.campaignName} is now available for workers.`;

    for (const workerId of event.workerIds) {
      await this.notificationsService.create({
        userId: workerId,
        type: 'campaign.created',
        title,
        message,
        metadata: { campaignId: event.campaignId },
      });

      const user = await this.workersService.findById(workerId);
      if (user) {
        await this.notificationsEmailService.send(user.email, title, message);
      }
    }
  }

  @OnEvent('campaign.ending_soon')
  async handleCampaignEndingSoon(event: CampaignEndingSoonEvent): Promise<void> {
    const title = 'Campaign ending soon';
    const message = `${event.campaignName} will end soon on ${event.endDate}.`;

    for (const workerId of event.workerIds) {
      await this.notificationsService.create({
        userId: workerId,
        type: 'campaign.ending_soon',
        title,
        message,
        metadata: { campaignId: event.campaignId, endDate: event.endDate },
      });

      const user = await this.workersService.findById(workerId);
      if (user) {
        await this.notificationsEmailService.send(user.email, title, message);
      }
    }
  }

  @OnEvent('withdrawal.status_changed')
  async handleWithdrawalStatusChanged(event: WithdrawalStatusChangedEvent): Promise<void> {
    const title =
      event.status === 'APPROVED'
        ? 'Withdrawal approved'
        : event.status === 'COMPLETED'
          ? 'Withdrawal completed'
          : 'Withdrawal status updated';

    const message =
      event.status === 'APPROVED'
        ? `Your withdrawal request of ${event.amountMinor} ${event.currency} was approved.`
        : event.status === 'COMPLETED'
          ? `Your withdrawal request of ${event.amountMinor} ${event.currency} has been completed.`
          : `Your withdrawal status changed to ${event.status}.`;

    await this.notificationsService.create({
      userId: event.workerId,
      type: `withdrawal.${event.status.toLowerCase()}`,
      title,
      message,
      metadata: { withdrawalId: event.withdrawalId },
    });

    const user = await this.workersService.findById(event.workerId);
    if (user) {
      await this.notificationsEmailService.send(user.email, title, message);
    }
  }
}