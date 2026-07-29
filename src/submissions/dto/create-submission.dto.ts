import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateSubmissionDto {
  @IsUUID()
  campaignId: string;

  @IsUUID()
  groupId: string;

  @IsString()
  @MinLength(1)
  proofUrl: string;

  @IsString()
  caption: string;
}
