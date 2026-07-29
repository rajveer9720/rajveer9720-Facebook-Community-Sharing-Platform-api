import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { ReviewWithdrawalDto } from './dto/review-withdrawal.dto';
import { UserRole, WithdrawalStatus } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/types/jwt-payload';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('me')
  getMyWallet(@CurrentUser() user: RequestUser) {
    return this.walletService.getForWorker(user.id);
  }

  @Get('withdrawals')
  listWithdrawals(@Query('status') status?: WithdrawalStatus) {
    return this.walletService.listWithdrawals(status);
  }

  @Post('withdrawals')
  @UseGuards(RolesGuard)
  @Roles(UserRole.WORKER)
  createWithdrawal(@CurrentUser() user: RequestUser, @Body() dto: CreateWithdrawalDto) {
    return this.walletService.createWithdrawal(user.id, dto);
  }

  @Post('withdrawals/:id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  reviewWithdrawal(@Param('id') id: string, @Body() dto: ReviewWithdrawalDto) {
    return this.walletService.reviewWithdrawal(id, dto.action);
  }

  @Post('withdrawals/:id/complete')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  completeWithdrawal(@Param('id') id: string) {
    return this.walletService.completeWithdrawal(id);
  }
}
