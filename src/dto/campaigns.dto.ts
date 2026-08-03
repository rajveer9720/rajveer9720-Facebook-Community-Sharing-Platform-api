import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsISO8601, IsIn, IsInt, Min, ValidateNested } from 'class-validator';
import { CAMPAIGN_MEDIA_TYPES } from '../common/constants/media.constants';
import { CampaignCategory, CampaignPriority } from '../common/enums';
import { NonEmptyStringField } from '../common/validators/field.decorators';

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
