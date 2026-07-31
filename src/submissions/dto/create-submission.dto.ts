import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateSubmissionDto {
  @IsInt()
  @Min(1)
  campaignId: number;

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
