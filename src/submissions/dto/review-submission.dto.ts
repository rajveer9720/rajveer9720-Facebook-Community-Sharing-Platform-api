import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReviewDecision } from '../../common/enums';

export class ReviewSubmissionDto {
  @IsEnum(ReviewDecision)
  decision: ReviewDecision;

  @IsOptional()
  @IsString()
  note?: string;
}
