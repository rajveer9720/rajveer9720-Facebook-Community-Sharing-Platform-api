import { IsEnum, IsInt, IsObject, Min } from 'class-validator';
import { PaymentMethod } from '../../common/enums';

export class CreateWithdrawalDto {
  @IsInt()
  @Min(1)
  amountMinor: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsObject()
  paymentDetails: Record<string, string>;
}
