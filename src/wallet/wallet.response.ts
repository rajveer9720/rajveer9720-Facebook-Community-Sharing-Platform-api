import { PaymentMethod, WithdrawalStatus } from '../common/enums';

export interface WalletResponse {
  workerId: string;
  availableMinor: number;
  pendingMinor: number;
  withdrawalHoldMinor: number;
  totalMinor: number;
  currency: string;
}

export interface WithdrawalWorkerResponse {
  firstName: string;
  lastName: string;
  email: string;
}

export interface WithdrawalResponse {
  id: string;
  workerId: string;
  worker: WithdrawalWorkerResponse;
  amountMinor: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentDetails: Record<string, string>;
  status: WithdrawalStatus;
  requestedAt: string;
}
