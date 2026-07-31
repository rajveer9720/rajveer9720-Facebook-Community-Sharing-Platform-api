import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from './submission.entity';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { GroupsModule } from '../groups/groups.module';
import { WalletModule } from '../wallet/wallet.module';
import { StorageModule } from '../storage/storage.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { WorkerPerformanceModule } from '../worker-performance/worker-performance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission]),
    CampaignsModule,
    GroupsModule,
    WalletModule,
    StorageModule,
    AuditLogsModule,
    WorkerPerformanceModule,
  ],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
