import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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