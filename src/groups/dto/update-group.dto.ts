import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
  @IsIn(['PUBLIC', 'PRIVATE', 'MIXED'])
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