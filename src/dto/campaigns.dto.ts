import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsISO8601, IsIn, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';
import { CAMPAIGN_MEDIA_TYPES } from '../common/constants/media.constants';
import { CampaignCategory, CampaignPriority } from '../common/enums';
import { NonEmptyStringField, OptionalNonEmptyStringField } from '../common/validators/field.decorators';

export class CampaignMediaVariantDto {
  @NonEmptyStringField()
  mediaUrl: string;

  @IsIn(CAMPAIGN_MEDIA_TYPES)
  mediaType: 'IMAGE' | 'VIDEO';

  @NonEmptyStringField()
  caption: string;
}

export class CreateCampaignDto {
  @NonEmptyStringField()
  name: string;

  @IsEnum(CampaignCategory)
  category: CampaignCategory;

  @IsEnum(CampaignPriority)
  priority: CampaignPriority;

  @IsISO8601()
  startDate: string;

  @IsISO8601()
  endDate: string;

  @IsInt()
  @Min(1)
  budgetMinor: number;

  @IsInt()
  @Min(1)
  rewardPerPostMinor: number;

  @IsInt()
  @Min(1)
  maximumWorkers: number;

  @IsInt()
  @Min(1)
  maximumPostsPerWorker: number;

  @IsInt()
  @Min(1)
  dailyPostingLimit: number;

  @NonEmptyStringField()
  instructions: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignMediaVariantDto)
  mediaVariants: CampaignMediaVariantDto[];

  @IsBoolean()
  screenshotRequired: boolean;

  @IsBoolean()
  facebookPostUrlRequired: boolean;

  @IsBoolean()
  groupNameRequired: boolean;

  @IsBoolean()
  manualReviewRequired: boolean;

  @IsBoolean()
  aiVerificationEnabled: boolean;

  @IsBoolean()
  autoApprovalEnabled: boolean;
}

export class UpdateCampaignDto {
  @OptionalNonEmptyStringField()
  name?: string;

  @IsOptional()
  @IsEnum(CampaignCategory)
  category?: CampaignCategory;

  @IsOptional()
  @IsEnum(CampaignPriority)
  priority?: CampaignPriority;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  budgetMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  rewardPerPostMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maximumWorkers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maximumPostsPerWorker?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  dailyPostingLimit?: number;

  @OptionalNonEmptyStringField()
  instructions?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignMediaVariantDto)
  mediaVariants?: CampaignMediaVariantDto[];

  @IsOptional()
  @IsBoolean()
  screenshotRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  facebookPostUrlRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  groupNameRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  manualReviewRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  aiVerificationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoApprovalEnabled?: boolean;
}
