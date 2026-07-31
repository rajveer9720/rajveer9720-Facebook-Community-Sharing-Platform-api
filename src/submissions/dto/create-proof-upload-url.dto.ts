import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateProofUploadUrlDto {
  @IsString()
  @MinLength(1)
  fileName: string;

  @IsString()
  @MinLength(1)
  contentType: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  campaignId?: number;
}