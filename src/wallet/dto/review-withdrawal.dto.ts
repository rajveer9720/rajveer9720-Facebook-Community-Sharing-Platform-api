import { IsEnum } from 'class-validator';
import { WithdrawalReviewAction } from '../../common/enums';

export class ReviewWithdrawalDto {
  @IsEnum(WithdrawalReviewAction)
  action: WithdrawalReviewAction;
}
