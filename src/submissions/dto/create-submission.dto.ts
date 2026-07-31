import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateSubmissionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  campaignId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  proofUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  facebookPostUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  groupName?: string;

  @IsString()
  caption: string;
}
