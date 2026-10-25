import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendSmtpEmail, TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';

@Injectable()
export class NotificationsEmailService {
  private readonly logger = new Logger(NotificationsEmailService.name);
  private readonly client: TransactionalEmailsApi | null;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    this.fromAddress = this.configService.get<string>('SMTP_FROM') ?? 'no-reply@example.com';

    if (!apiKey) {
      this.client = null;
      return;
    }

    this.client = new TransactionalEmailsApi();
    this.client.setApiKey(TransactionalEmailsApiApiKeys.apiKey, apiKey);
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const email = new SendSmtpEmail();
      email.sender = { email: this.fromAddress };
      email.to = [{ email: to }];
      email.subject = subject;
      email.textContent = text;

      await this.client.sendTransacEmail(email);
    } catch (error) {
      this.logger.warn(`Failed to send notification email: ${(error as Error).message}`);
    }
  }
}
