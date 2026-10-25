import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ReviewDecision } from '../common/enums';
import { NonEmptyStringField, OptionalNonEmptyStringField } from '../common/validators/field.decorators';

export class CreateSubmissionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  campaignId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId: number;

  @OptionalNonEmptyStringField()
  proofUrl?: string;

  @OptionalNonEmptyStringField()
  facebookPostUrl?: string;

  @OptionalNonEmptyStringField()
  groupName?: string;

  @NonEmptyStringField()
  caption: string;
}

export class CreateProofUploadUrlDto {
  @NonEmptyStringField()
  fileName: string;

  @NonEmptyStringField()
  contentType: string;

  @OptionalNonEmptyStringField()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  campaignId?: number;
}

export class ReviewSubmissionDto {
  @IsEnum(ReviewDecision)
  decision: ReviewDecision;

  @IsOptional()
  @IsString()
  note?: string;
}
