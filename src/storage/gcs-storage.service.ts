import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import * as crypto from 'crypto';

export interface ProofUploadUrlResponse {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresAt: string;
}

@Injectable()
export class GcsStorageService {
  private readonly storage: Storage;
  private readonly bucketName: string;
  private readonly uploadExpirationSeconds: number;

  constructor(private readonly configService: ConfigService) {
    const projectId = this.configService.get<string>('GCP_PROJECT_ID');
    this.bucketName = this.configService.get<string>('GCP_STORAGE_BUCKET') ?? '';
    this.uploadExpirationSeconds = Number(this.configService.get<string>('GCP_STORAGE_UPLOAD_EXPIRATION_SECONDS') ?? 900);
    this.storage = projectId ? new Storage({ projectId }) : new Storage();
  }

  async createSubmissionProofUploadUrl(params: {
    workerId: string;
    campaignId?: string;
    fileName: string;
    contentType: string;
  }): Promise<ProofUploadUrlResponse> {
    if (!this.bucketName) {
      throw new BadRequestException('GCP storage bucket is not configured');
    }

    const objectKey = this.buildObjectKey(params.workerId, params.campaignId, params.fileName);
    const expiresAt = new Date(Date.now() + this.uploadExpirationSeconds * 1000);
    const file = this.storage.bucket(this.bucketName).file(objectKey);
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expiresAt,
      contentType: params.contentType,
    });

    return {
      uploadUrl,
      objectKey,
      publicUrl: this.buildPublicUrl(objectKey),
      expiresAt: expiresAt.toISOString(),
    };
  }

  private buildObjectKey(workerId: string, campaignId: string | undefined, fileName: string): string {
    const extension = this.extractFileExtension(fileName);
    const safeCampaignId = campaignId ?? 'general';
    return `submission-proofs/${workerId}/${safeCampaignId}/${Date.now()}-${crypto.randomUUID()}${extension}`;
  }

  private extractFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex < 0) {
      return '';
    }

    const extension = fileName.slice(lastDotIndex).toLowerCase();
    return extension.length <= 10 ? extension : '';
  }

  private buildPublicUrl(objectKey: string): string {
    const encodedKey = encodeURIComponent(objectKey).replace(/%2F/g, '/');
    return `https://storage.googleapis.com/${this.bucketName}/${encodedKey}`;
  }
}