import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { GroupStatus } from '../../common/enums';

export class ModerateGroupDto {
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