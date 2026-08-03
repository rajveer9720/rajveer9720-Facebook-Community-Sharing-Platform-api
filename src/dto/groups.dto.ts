import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { GROUP_MODERATION_ACTIONS, GROUP_PRIVACY_TYPES } from '../common/constants/group.constants';
import { GroupStatus } from '../common/enums';
import { NonEmptyStringField, OptionalNonEmptyStringField } from '../common/validators/field.decorators';

export class CreateGroupDiscoveryDto {
  @NonEmptyStringField()
  name: string;

  @NonEmptyStringField()
  category: string;

  @NonEmptyStringField()
  country: string;

  @OptionalNonEmptyStringField()
  url?: string;

  @OptionalNonEmptyStringField()
  language?: string;

  @OptionalNonEmptyStringField()
  @IsIn(GROUP_PRIVACY_TYPES)
  privacyType?: string;

  @IsInt()
  @Min(0)
  memberCount: number;
}

export class ModerateGroupDto {
  @IsOptional()
  @IsIn(GROUP_MODERATION_ACTIONS)
  action?: string;

  @IsOptional()
  @IsEnum(GroupStatus)
  status?: GroupStatus;

  @IsOptional()
  @IsBoolean()
  blacklisted?: boolean;

  @IsOptional()
  @Min(0)
  @Max(100)
  qualityScore?: number;

  @IsOptional()
  @Min(0)
  @Max(100)
  engagementScore?: number;

  @IsOptional()
  @Min(0)
  @Max(100)
  spamScore?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  lastCampaignId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  lastWorkerId?: number;

  @IsOptional()
  @IsString()
  adminNote?: string;
}

export class RecommendGroupsDto {
  @IsInt()
  @Min(1)
  campaignId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  limit?: number;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  language?: string;
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  @IsIn(GROUP_PRIVACY_TYPES)
  privacyType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  memberCount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  cooldownHours?: number;
}
