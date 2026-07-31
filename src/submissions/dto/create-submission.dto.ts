import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateSubmissionDto {
  @IsInt()
  @Min(1)
  campaignId: number;

  @IsInt()
  @Min(1)
  groupId: number;

  @IsString()
  @MinLength(1)
  proofUrl: string;

  @IsString()
  caption: string;
}
