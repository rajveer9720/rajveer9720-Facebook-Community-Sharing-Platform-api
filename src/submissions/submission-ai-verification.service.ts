import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OpenAiVerificationPayload {
  screenshotVisible: boolean;
  ocrText: string;
  captionMatch: boolean;
  imageMatch: boolean;
  groupNameMatch: boolean;
  dateVisible: boolean;
  timeVisible: boolean;
  confidence: number;
  notes: string;
}

export interface AiVerificationResult {
  available: boolean;
  screenshotVisible: boolean;
  ocrText: string;
  captionMatch: boolean;
  imageMatch: boolean;
  groupNameMatch: boolean;
  dateVisible: boolean;
  timeVisible: boolean;
  confidence: number;
  notes: string;
}

@Injectable()
export class SubmissionAiVerificationService {
  private readonly logger = new Logger(SubmissionAiVerificationService.name);
  private readonly openAiApiKey: string | null;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.openAiApiKey = this.configService.get<string>('OPENAI_API_KEY') ?? null;
    this.model = this.configService.get<string>('OPENAI_VISION_MODEL') ?? 'gpt-4o-mini';
  }

  getAutoApproveThreshold(): number {
    const threshold = Number(this.configService.get<string>('AI_VERIFICATION_AUTO_APPROVE_THRESHOLD') ?? 0.85);
    if (!Number.isFinite(threshold)) {
      return 0.85;
    }
    return Math.max(0, Math.min(1, threshold));
  }

  async verifyScreenshot(params: {
    proofUrl: string;
    caption: string;
    expectedGroupName: string;
    submittedGroupName: string | null;
  }): Promise<AiVerificationResult> {
    if (!this.openAiApiKey) {
      return {
        available: false,
        screenshotVisible: false,
        ocrText: '',
        captionMatch: false,
        imageMatch: false,
        groupNameMatch: false,
        dateVisible: false,
        timeVisible: false,
        confidence: 0,
        notes: 'OPENAI_API_KEY is not configured',
      };
    }

    try {
      const payload = await this.requestOpenAiVerification(params);
      return {
        available: true,
        screenshotVisible: Boolean(payload.screenshotVisible),
        ocrText: String(payload.ocrText ?? '').trim(),
        captionMatch: Boolean(payload.captionMatch),
        imageMatch: Boolean(payload.imageMatch),
        groupNameMatch: Boolean(payload.groupNameMatch),
        dateVisible: Boolean(payload.dateVisible),
        timeVisible: Boolean(payload.timeVisible),
        confidence: this.clampConfidence(payload.confidence),
        notes: String(payload.notes ?? '').trim(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown AI verification error';
      this.logger.warn(`AI verification fallback engaged: ${message}`);
      return {
        available: false,
        screenshotVisible: false,
        ocrText: '',
        captionMatch: false,
        imageMatch: false,
        groupNameMatch: false,
        dateVisible: false,
        timeVisible: false,
        confidence: 0,
        notes: `AI verification failed: ${message}`,
      };
    }
  }

  private async requestOpenAiVerification(params: {
    proofUrl: string;
    caption: string;
    expectedGroupName: string;
    submittedGroupName: string | null;
  }): Promise<OpenAiVerificationPayload> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.openAiApiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'submission_verification',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  screenshotVisible: { type: 'boolean' },
                  ocrText: { type: 'string' },
                  captionMatch: { type: 'boolean' },
                  imageMatch: { type: 'boolean' },
                  groupNameMatch: { type: 'boolean' },
                  dateVisible: { type: 'boolean' },
                  timeVisible: { type: 'boolean' },
                  confidence: { type: 'number' },
                  notes: { type: 'string' },
                },
                required: [
                  'screenshotVisible',
                  'ocrText',
                  'captionMatch',
                  'imageMatch',
                  'groupNameMatch',
                  'dateVisible',
                  'timeVisible',
                  'confidence',
                  'notes',
                ],
              },
            },
          },
          messages: [
            {
              role: 'system',
              content:
                'You are an anti-fraud submission verifier. Analyze a screenshot and return strict JSON. Be conservative when uncertain.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text:
                    `Check if this screenshot is valid campaign proof.\n` +
                    `Expected caption: ${params.caption}\n` +
                    `Expected group name: ${params.expectedGroupName}\n` +
                    `Submitted group name: ${params.submittedGroupName ?? 'not provided'}\n` +
                    'Set captionMatch true only if screenshot text strongly matches caption intent/content.\n' +
                    'Set imageMatch true only if screenshot appears to be an actual Facebook/group post proof, not unrelated content.\n' +
                    'Set confidence from 0 to 1.',
                },
                {
                  type: 'image_url',
                  image_url: { url: params.proofUrl },
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${body}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OpenAI response did not include message content');
      }

      return JSON.parse(content) as OpenAiVerificationPayload;
    } finally {
      clearTimeout(timeout);
    }
  }

  private clampConfidence(confidence: number): number {
    if (!Number.isFinite(confidence)) {
      return 0;
    }
    return Math.max(0, Math.min(1, Number(confidence.toFixed(2))));
  }
}
