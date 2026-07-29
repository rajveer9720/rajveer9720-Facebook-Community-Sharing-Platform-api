import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './wallet.entity';
import { Withdrawal } from './withdrawal.entity';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WalletResponse, WithdrawalResponse } from './wallet.response';
import { WithdrawalReviewAction, WithdrawalStatus } from '../common/enums';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet) private readonly walletsRepository: Repository<Wallet>,
    @InjectRepository(Withdrawal) private readonly withdrawalsRepository: Repository<Withdrawal>,
  ) {}

  async getForWorker(workerId: string): Promise<WalletResponse> {
    const wallet = await this.walletsRepository.findOne({ where: { workerId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return this.toWalletResponse(wallet);
  }

  async registerPendingReward(workerId: string, amountMinor: number): Promise<void> {
    const wallet = await this.walletsRepository.findOne({ where: { workerId } });
    if (!wallet) return;
    wallet.pendingMinor += amountMinor;
    wallet.totalMinor += amountMinor;
    await this.walletsRepository.save(wallet);
  }

  async approvePendingReward(workerId: string, amountMinor: number): Promise<void> {
    const wallet = await this.walletsRepository.findOne({ where: { workerId } });
    if (!wallet) return;
    wallet.pendingMinor = Math.max(0, wallet.pendingMinor - amountMinor);
    wallet.availableMinor += amountMinor;
    await this.walletsRepository.save(wallet);
  }

  async rejectPendingReward(workerId: string, amountMinor: number): Promise<void> {
    const wallet = await this.walletsRepository.findOne({ where: { workerId } });
    if (!wallet) return;
    wallet.pendingMinor = Math.max(0, wallet.pendingMinor - amountMinor);
    wallet.totalMinor = Math.max(0, wallet.totalMinor - amountMinor);
    await this.walletsRepository.save(wallet);
  }

  async listWithdrawals(status?: WithdrawalStatus): Promise<{ items: WithdrawalResponse[] }> {
    const withdrawals = await this.withdrawalsRepository.find({
      where: status ? { status } : {},
      relations: { worker: true },
      order: { requestedAt: 'DESC' },
    });
    return { items: withdrawals.map((withdrawal) => this.toWithdrawalResponse(withdrawal)) };
  }

  async createWithdrawal(workerId: string, dto: CreateWithdrawalDto): Promise<WithdrawalResponse> {
    const wallet = await this.walletsRepository.findOne({ where: { workerId }, relations: { worker: true } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    if (dto.amountMinor > wallet.availableMinor) {
      throw new BadRequestException('Withdrawal amount exceeds available balance');
    }

    wallet.availableMinor -= dto.amountMinor;
    wallet.withdrawalHoldMinor += dto.amountMinor;
    await this.walletsRepository.save(wallet);

    const withdrawal = this.withdrawalsRepository.create({
      workerId,
      amountMinor: dto.amountMinor,
      currency: wallet.currency,
      paymentMethod: dto.paymentMethod,
      paymentDetails: dto.paymentDetails,
      status: WithdrawalStatus.PENDING,
      worker: wallet.worker,
    });
    const saved = await this.withdrawalsRepository.save(withdrawal);
    saved.worker = wallet.worker;
    return this.toWithdrawalResponse(saved);
  }

  async reviewWithdrawal(id: string, action: WithdrawalReviewAction): Promise<WithdrawalResponse> {
    const withdrawal = await this.withdrawalsRepository.findOne({ where: { id }, relations: { worker: true } });
    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new ConflictException('Withdrawal already reviewed');
    }

    if (action === WithdrawalReviewAction.APPROVE) {
      withdrawal.status = WithdrawalStatus.APPROVED;
    } else {
      withdrawal.status = WithdrawalStatus.REJECTED;
      const wallet = await this.walletsRepository.findOne({ where: { workerId: withdrawal.workerId } });
      if (wallet) {
        wallet.withdrawalHoldMinor -= withdrawal.amountMinor;
        wallet.availableMinor += withdrawal.amountMinor;
        await this.walletsRepository.save(wallet);
      }
    }

    const saved = await this.withdrawalsRepository.save(withdrawal);
    return this.toWithdrawalResponse(saved);
  }

  async completeWithdrawal(id: string): Promise<WithdrawalResponse> {
    const withdrawal = await this.withdrawalsRepository.findOne({ where: { id }, relations: { worker: true } });
    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }
    if (withdrawal.status !== WithdrawalStatus.APPROVED) {
      throw new ConflictException('Only approved withdrawals can be marked paid');
    }

    withdrawal.status = WithdrawalStatus.COMPLETED;
    const wallet = await this.walletsRepository.findOne({ where: { workerId: withdrawal.workerId } });
    if (wallet) {
      wallet.withdrawalHoldMinor -= withdrawal.amountMinor;
      wallet.totalMinor -= withdrawal.amountMinor;
      await this.walletsRepository.save(wallet);
    }

    const saved = await this.withdrawalsRepository.save(withdrawal);
    return this.toWithdrawalResponse(saved);
  }

  private toWalletResponse(wallet: Wallet): WalletResponse {
    return {
      workerId: wallet.workerId,
      availableMinor: wallet.availableMinor,
      pendingMinor: wallet.pendingMinor,
      withdrawalHoldMinor: wallet.withdrawalHoldMinor,
      totalMinor: wallet.totalMinor,
      currency: wallet.currency,
    };
  }

  private toWithdrawalResponse(withdrawal: Withdrawal): WithdrawalResponse {
    return {
      id: withdrawal.id,
      workerId: withdrawal.workerId,
      worker: {
        firstName: withdrawal.worker.firstName,
        lastName: withdrawal.worker.lastName,
        email: withdrawal.worker.email,
      },
      amountMinor: withdrawal.amountMinor,
      currency: withdrawal.currency,
      paymentMethod: withdrawal.paymentMethod,
      paymentDetails: withdrawal.paymentDetails,
      status: withdrawal.status,
      requestedAt: withdrawal.requestedAt.toISOString(),
    };
  }
}
