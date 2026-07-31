import { IsArray, IsBoolean, IsEnum, IsISO8601, IsInt, IsIn, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignCategory, CampaignPriority } from '../../common/enums';

export class CampaignMediaVariantDto {
  @IsString()
  @MinLength(1)
  mediaUrl: string;

  @IsIn(['IMAGE', 'VIDEO'])
  mediaType: 'IMAGE' | 'VIDEO';

  @IsString()
  @MinLength(1)
  caption: string;
}

export class CreateCampaignDto {
  @IsString()
  @MinLength(1)
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

  @IsString()
  @MinLength(1)
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
