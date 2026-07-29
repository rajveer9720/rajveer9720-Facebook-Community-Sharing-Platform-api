import { IsEnum, IsISO8601, IsInt, IsString, Min, MinLength } from 'class-validator';
import { CampaignCategory, CampaignPriority } from '../../common/enums';

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
}
