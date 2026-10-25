import { IsEnum, IsInt, IsObject, Min } from 'class-validator';
import { PaymentMethod, WithdrawalReviewAction } from '../common/enums';

export class CreateWithdrawalDto {
  @IsInt()
  @Min(1)
  amountMinor: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsObject()
  paymentDetails: Record<string, string>;
}

export class ReviewWithdrawalDto {
  @IsEnum(WithdrawalReviewAction)
  action: WithdrawalReviewAction;
}
