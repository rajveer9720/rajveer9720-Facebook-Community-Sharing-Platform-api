import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProofUploadUrlDto {
  @IsString()
  @MinLength(1)
  fileName: string;

  @IsString()
  @MinLength(1)
  contentType: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  campaignId?: string;
}