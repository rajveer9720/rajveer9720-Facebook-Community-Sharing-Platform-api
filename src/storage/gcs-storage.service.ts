import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { File as GcsFile, Storage } from '@google-cloud/storage';
import * as crypto from 'crypto';

export interface SignedUploadUrlResponse {
  uploadUrl: string;
  objectKey: string;
  publicUrl: string;
  expiresAt: string;
}

@Injectable()
export class GcsStorageService {
  private readonly logger = new Logger(GcsStorageService.name);
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
    workerId: number;
    campaignId?: number;
    fileName: string;
    contentType: string;
  }): Promise<SignedUploadUrlResponse> {
    const objectKey = this.buildObjectKey(
      `submission-proofs/${params.workerId}/${params.campaignId ?? 'general'}`,
      params.fileName,
    );
    return this.createSignedUploadUrl(objectKey, params.contentType);
  }

  async uploadCampaignMedia(adminId: number, file: Express.Multer.File): Promise<{ mediaUrl: string; objectKey: string }> {
    if (!this.bucketName) {
      throw new BadRequestException('GCP storage bucket is not configured');
    }

    const objectKey = this.buildObjectKey(`campaign-media/${adminId}`, file.originalname);
    const blob = this.storage.bucket(this.bucketName).file(objectKey);

    try {
      await this.writeObject(blob, file, { predefinedAcl: 'publicRead' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/uniform bucket-level access/i.test(message)) {
        this.logger.error(`Campaign media upload failed for object ${objectKey}: ${message}`, error instanceof Error ? error.stack : undefined);
        throw new BadRequestException('Media upload failed. Please try again.');
      }
      this.logger.warn(
        `Bucket ${this.bucketName} has uniform bucket-level access enabled; retrying upload without a per-object ACL. ` +
          'Grant "allUsers" the Storage Object Viewer role on the bucket for uploaded media to be publicly viewable.',
      );
      try {
        await this.writeObject(blob, file, {});
      } catch (retryError) {
        const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
        this.logger.error(`Campaign media upload retry failed for object ${objectKey}: ${retryMessage}`, retryError instanceof Error ? retryError.stack : undefined);
        throw new BadRequestException('Media upload failed. Please try again.');
      }
    }

    return { mediaUrl: this.buildPublicUrl(objectKey), objectKey };
  }

  private writeObject(blob: GcsFile, file: Express.Multer.File, options: { predefinedAcl?: 'publicRead' }): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const blobStream = blob.createWriteStream({
        resumable: false,
        contentType: file.mimetype,
        ...options,
      });
      blobStream.on('error', reject);
      blobStream.on('finish', () => resolve());
      blobStream.end(file.buffer);
    });
  }

  private async createSignedUploadUrl(objectKey: string, contentType: string): Promise<SignedUploadUrlResponse> {
    if (!this.bucketName) {
      throw new BadRequestException('GCP storage bucket is not configured');
    }

    const expiresAt = new Date(Date.now() + this.uploadExpirationSeconds * 1000);
    const file = this.storage.bucket(this.bucketName).file(objectKey);
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expiresAt,
      contentType,
    });

    return {
      uploadUrl,
      objectKey,
      publicUrl: this.buildPublicUrl(objectKey),
      expiresAt: expiresAt.toISOString(),
    };
  }

  private buildObjectKey(prefix: string, fileName: string): string {
    const extension = this.extractFileExtension(fileName);
    return `${prefix}/${Date.now()}-${crypto.randomUUID()}${extension}`;
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