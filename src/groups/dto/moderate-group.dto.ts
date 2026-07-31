import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { GroupStatus } from '../../common/enums';

export class ModerateGroupDto {
  @IsOptional()
  @IsIn(['approve', 'reject', 'blacklist', 'unblacklist', 'APPROVE', 'REJECT', 'BLACKLIST', 'UNBLACKLIST'])
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